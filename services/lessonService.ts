import { supabase } from './supabaseClient';
import { Lesson, Exercise } from '../types';
import { updateGamificationStats } from './authService';
import { cacheManager, CacheKeys, CacheTTL } from './cacheManager';

// ============================================================================
// CACHING CONFIGURATION
// ============================================================================
interface FetchOptions {
    useCache?: boolean;
    forceRefresh?: boolean;
}

export const getLessons = async (options: FetchOptions = {}): Promise<Lesson[]> => {
    const { useCache = true, forceRefresh = false } = options;

    if (useCache && !forceRefresh) {
        return cacheManager.getOrFetch(
            CacheKeys.lessons(),
            async () => {
                const { data: lessonsData, error: lessonsError } = await supabase
                    .from('lessons')
                    .select(`
                      *,
                      exercises (*)
                    `)
                    .order('created_at', { ascending: false })
                    .order('order_index', { ascending: true, foreignTable: 'exercises' });

                if (lessonsError) {
                    console.error('Error fetching lessons:', lessonsError);
                    return [];
                }
                return lessonsData as Lesson[];
            },
            { ttl: CacheTTL.LESSONS, forceRefresh }
        );
    }

    // Direct fetch without cache
    const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select(`
          *,
          exercises (*)
        `)
        .order('created_at', { ascending: false })
        .order('order_index', { ascending: true, foreignTable: 'exercises' });

    if (lessonsError) {
        console.error('Error fetching lessons:', lessonsError);
        return [];
    }

    // Update cache for future requests
    cacheManager.set(CacheKeys.lessons(), lessonsData as Lesson[], { ttl: CacheTTL.LESSONS });
    return lessonsData as Lesson[];
};

export const getLessonById = async (id: string): Promise<Lesson | null> => {
    const { data, error } = await supabase
        .from('lessons')
        .select(`
      *,
      exercises (*)
    `)
        .eq('id', id)
        .order('order_index', { ascending: true, foreignTable: 'exercises' })
        .single();

    if (error) {
        console.error(`Error fetching lesson ${id}:`, error);
        return null;
    }

    return data as Lesson;
};

export const saveLesson = async (lesson: Omit<Lesson, 'id' | 'exercises'>, exercises: Omit<Exercise, 'id'>[]): Promise<Lesson | null> => {
    // 1. Insert lesson
    const { data: lessonData, error: lessonError } = await supabase
        .from('lessons')
        .insert([lesson])
        .select()
        .single();

    if (lessonError) {
        console.error('Error saving lesson:', lessonError);
        return null;
    }

    // 2. Insert exercises with lesson_id
    const exercisesToSave = exercises.map(ex => ({
        ...ex,
        lesson_id: lessonData.id
    }));

    const { data: exercisesData, error: exercisesError } = await supabase
        .from('exercises')
        .insert(exercisesToSave)
        .select();

    if (exercisesError) {
        console.error('Error saving exercises:', exercisesError);
        // Note: In a production app, you might want to rollback the lesson insertion here
        return null;
    }

    return {
        ...lessonData,
        exercises: exercisesData
    } as Lesson;
};

export const deleteLesson = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', id);

    if (error) {
        console.error(`Error deleting lesson ${id}:`, error);
        return false;
    }
    return true;
};

export const saveProgress = async (userId: string, lessonId: string, score: number) => {
    if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log('[DB] saveProgress called:', { userId, lessonId, score });
    }

    const { data, error } = await supabase
        .from('user_progress')
        .insert([{ user_id: userId, lesson_id: lessonId, score }])
        .select();

    if (error) {
        console.error('[DB] Error saving progress:', error);
        throw error;
    }

    if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log('[DB] Progress saved successfully:', data);
    }

    // Bonus XP for completing a lesson
    if (score >= 70) {
        await updateGamificationStats(userId, 50);
    }
};

export const getUserProgress = async (userId: string, options: FetchOptions = {}) => {
    const { useCache = true, forceRefresh = false } = options;

    return cacheManager.getOrFetch(
        CacheKeys.userProgress(userId),
        async () => {
            const { data, error } = await supabase
                .from('user_progress')
                .select('*')
                .eq('user_id', userId);

            if (error) {
                console.error('Error fetching user progress:', error);
                return [];
            }
            return data;
        },
        { ttl: CacheTTL.PROGRESS, forceRefresh: forceRefresh || !useCache }
    );
};

export const saveExerciseProgress = async (userId: string, exerciseId: string, score: number) => {
    const { error } = await supabase
        .from('user_exercise_progress')
        .upsert({
            user_id: userId,
            exercise_id: exerciseId,
            last_score: score,
            is_completed: true,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,exercise_id' });

    if (error) {
        console.error('Error saving exercise progress:', error);
        throw error;
    }

    // XP for specific exercise (10 XP per correct answer)
    if (score >= 70) {
        await updateGamificationStats(userId, 10);
    }
};

export const getExerciseProgress = async (userId: string, options: FetchOptions = {}) => {
    const { useCache = true, forceRefresh = false } = options;

    return cacheManager.getOrFetch(
        CacheKeys.exerciseProgress(userId),
        async () => {
            const { data, error } = await supabase
                .from('user_exercise_progress')
                .select('*')
                .eq('user_id', userId);

            if (error) {
                console.error('Error fetching exercise progress:', error);
                return [];
            }
            return data;
        },
        { ttl: CacheTTL.PROGRESS, forceRefresh: forceRefresh || !useCache }
    );
};

export const getAdminStats = async (options: FetchOptions = {}) => {
    const { useCache = true, forceRefresh = false } = options;

    return cacheManager.getOrFetch(
        CacheKeys.adminStats(),
        async () => {
            // Parallel fetch for better performance
            const [
                { count: studentCount },
                { count: lessonCount },
                { data: progressData, error: progressError },
                { data: lessonsData },
                { data: profilesData }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('lessons').select('*', { count: 'exact', head: true }),
                supabase.from('user_progress').select('id, score, completed_at, lesson_id, user_id'),
                supabase.from('lessons').select('id, title'),
                supabase.from('profiles').select('id, full_name, created_at, avatar_url')
            ]);

            if (progressError) {
                console.error('Error fetching progress:', progressError);
                return {
                    totalStudents: studentCount || 0,
                    totalLessons: lessonCount || 0,
                    totalCompletions: 0,
                    avgScore: 0,
                    difficultLessons: [],
                    topLearners: [],
                    atRiskStudents: [],
                    weeklyGrowth: 0,
                    activeToday: 0
                };
            }

            // Create lookup maps
            const lessonMap = new Map<string, string>((lessonsData || []).map(l => [l.id, l.title]));
            const profileMap = new Map<string, { name: string, avatar_url: string | null }>((profilesData || []).map(p => [p.id, { name: p.full_name, avatar_url: p.avatar_url || null }]));

            const now = new Date();
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Calculate metrics
            const totalCompletions = progressData?.length || 0;
            const avgScore = totalCompletions > 0
                ? progressData!.reduce((acc, curr) => acc + curr.score, 0) / totalCompletions
                : 0;

            // Weekly comparison
            const thisWeekCompletions = (progressData || []).filter(p =>
                new Date(p.completed_at) >= weekAgo
            ).length;
            const lastWeekCompletions = (progressData || []).filter(p => {
                const date = new Date(p.completed_at);
                return date >= twoWeeksAgo && date < weekAgo;
            }).length;
            const weeklyGrowth = lastWeekCompletions > 0
                ? Math.round(((thisWeekCompletions - lastWeekCompletions) / lastWeekCompletions) * 100)
                : thisWeekCompletions > 0 ? 100 : 0;

            // Active today
            const activeToday = new Set((progressData || [])
                .filter(p => new Date(p.completed_at) >= today)
                .map(p => p.user_id)
            ).size;

            // Lesson and user aggregations
            const lessonScores: Record<string, { title: string, total: number, count: number }> = {};
            const userStats: Record<string, { name: string, avatar_url: string | null, completions: number, totalScore: number, lastActive: Date }> = {};

            (progressData || []).forEach(p => {
                // Lessons
                if (p.lesson_id) {
                    if (!lessonScores[p.lesson_id]) {
                        lessonScores[p.lesson_id] = { title: lessonMap.get(p.lesson_id) || 'Unknown', total: 0, count: 0 };
                    }
                    lessonScores[p.lesson_id].total += p.score;
                    lessonScores[p.lesson_id].count += 1;
                }

                // Users
                if (p.user_id) {
                    const actDate = new Date(p.completed_at);
                    if (!userStats[p.user_id]) {
                        const profile = profileMap.get(p.user_id);
                        userStats[p.user_id] = {
                            name: profile?.name || 'User',
                            avatar_url: profile?.avatar_url || null,
                            completions: 0,
                            totalScore: 0,
                            lastActive: actDate
                        };
                    }
                    userStats[p.user_id].completions += 1;
                    userStats[p.user_id].totalScore += p.score;
                    if (actDate > userStats[p.user_id].lastActive) {
                        userStats[p.user_id].lastActive = actDate;
                    }
                }
            });

            // Difficult lessons: require minimum 3 completions for accuracy
            const difficultLessons = Object.entries(lessonScores)
                .filter(([_, data]) => data.count >= 3)  // Minimum threshold
                .map(([id, data]) => ({ id, title: data.title, avgScore: Math.round(data.total / data.count), attempts: data.count }))
                .sort((a, b) => a.avgScore - b.avgScore)
                .slice(0, 3);

            // Top learners
            const topLearners = Object.entries(userStats)
                .map(([id, data]) => ({
                    id,
                    full_name: data.name,
                    avatar_url: data.avatar_url,
                    completions: data.completions,
                    avgScore: Math.round(data.totalScore / data.completions)
                }))
                .sort((a, b) => b.completions - a.completions || b.avgScore - a.avgScore)
                .slice(0, 5);

            // At-risk students: low avg score OR inactive for 7+ days
            const atRiskStudents = Object.entries(userStats)
                .map(([id, data]) => ({
                    id,
                    full_name: data.name,
                    avgScore: Math.round(data.totalScore / data.completions),
                    lastActive: data.lastActive,
                    daysSinceActive: Math.floor((now.getTime() - data.lastActive.getTime()) / (24 * 60 * 60 * 1000)),
                    reason: '' as string
                }))
                .filter(u => {
                    if (u.avgScore < 50) { u.reason = 'Điểm thấp'; return true; }
                    if (u.daysSinceActive >= 7) { u.reason = 'Không hoạt động'; return true; }
                    return false;
                })
                .sort((a, b) => a.avgScore - b.avgScore)
                .slice(0, 5);

            return {
                totalStudents: studentCount || 0,
                totalLessons: lessonCount || 0,
                totalCompletions,
                avgScore: Math.round(avgScore),
                difficultLessons,
                topLearners,
                atRiskStudents,
                weeklyGrowth,
                activeToday,
                thisWeekCompletions
            };
        },
        { ttl: 2 * 60 * 1000, forceRefresh: forceRefresh || !useCache } // 2 minute cache for admin stats
    );
};

export const getRecentActivity = async (options: FetchOptions = {}) => {
    const { useCache = true, forceRefresh = false } = options;

    return cacheManager.getOrFetch(
        CacheKeys.recentActivity(),
        async () => {
            // Fetch progress data without nested selects (causes 400 error)
            const { data: progressData, error } = await supabase
                .from('user_progress')
                .select('id, score, completed_at, lesson_id, user_id')
                .order('completed_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error fetching recent activity:', error);
                return [];
            }

            if (!progressData || progressData.length === 0) return [];

            // Get unique lesson and user IDs
            const lessonIds = [...new Set(progressData.map(p => p.lesson_id))];
            const userIds = [...new Set(progressData.map(p => p.user_id))];

            // Fetch lessons and profiles
            const [lessonsRes, profilesRes] = await Promise.all([
                supabase.from('lessons').select('id, title').in('id', lessonIds),
                supabase.from('profiles').select('id, full_name, avatar_url').in('id', userIds)
            ]);

            const lessonMap = new Map<string, string>((lessonsRes.data || []).map(l => [l.id, l.title]));
            const profileMap = new Map<string, { full_name: string, avatar_url: string | null }>((profilesRes.data || []).map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url || null }]));

            return progressData.map(p => ({
                ...p,
                lessons: { title: lessonMap.get(p.lesson_id) || 'Unknown' },
                profiles: profileMap.get(p.user_id) || { full_name: 'User', avatar_url: null }
            }));
        },
        { ttl: 60 * 1000, forceRefresh: forceRefresh || !useCache } // 1 minute cache for recent activity
    );
};

export const updateLesson = async (id: string, updates: Partial<Lesson>): Promise<boolean> => {
    const { error } = await supabase
        .from('lessons')
        .update({
            title: updates.title,
            description: updates.description,
            level: updates.level
        })
        .eq('id', id);

    if (error) {
        console.error('Error updating lesson:', error);
        return false;
    }
    return true;
};

export const updateExercise = async (id: string, updates: Partial<Exercise>): Promise<boolean> => {
    // Input validation
    if (!id || typeof id !== 'string') {
        console.error('Invalid exercise ID');
        return false;
    }

    // Build update payload with only defined values (avoid overwriting with undefined)
    const updatePayload: Record<string, any> = {};

    if (updates.vietnamese !== undefined) {
        const trimmed = updates.vietnamese.trim();
        if (!trimmed) {
            console.error('Vietnamese content cannot be empty');
            return false;
        }
        updatePayload.vietnamese = trimmed;
    }

    if (updates.hint !== undefined) {
        updatePayload.hint = updates.hint?.trim() || null;
    }

    if (updates.difficulty !== undefined && updates.difficulty !== null) {
        if (!['Easy', 'Medium', 'Hard'].includes(updates.difficulty)) {
            console.error('Invalid difficulty value:', updates.difficulty);
            return false;
        }
        updatePayload.difficulty = updates.difficulty;
    }

    if (updates.type !== undefined) {
        if (!['translation', 'roleplay', 'detective'].includes(updates.type)) {
            console.error('Invalid exercise type');
            return false;
        }
        updatePayload.type = updates.type;
    }

    // Nothing to update
    if (Object.keys(updatePayload).length === 0) {
        return true;
    }

    const { error } = await supabase
        .from('exercises')
        .update(updatePayload)
        .eq('id', id);

    if (error) {
        console.error('Error updating exercise:', error);
        return false;
    }

    // Invalidate lesson cache to ensure fresh data on next fetch
    invalidateLessonCache();

    return true;
};

// Insert a new exercise into an existing lesson
export const insertExercise = async (
    lessonId: string,
    exercise: Omit<Exercise, 'id'>
): Promise<Exercise | null> => {
    const { data, error } = await supabase
        .from('exercises')
        .insert([{ ...exercise, lesson_id: lessonId }])
        .select()
        .single();

    if (error) {
        console.error('Error inserting exercise:', error);
        return null;
    }
    return data as Exercise;
};
export const deleteExercise = async (id: string): Promise<boolean> => {
    const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting exercise:', error);
        return false;
    }
    return true;
};

export const updateExerciseOrder = async (exercises: { id: string; order_index: number }[]): Promise<void> => {
    if (exercises.length === 0) return;

    // ============================================================================
    // ATOMIC UPSERT - Google/Meta Production Standard
    // Single database request regardless of N exercises
    // Eliminates 429 rate limit errors completely
    // ============================================================================

    try {
        // Fetch current exercise data to preserve all fields during upsert
        const exerciseIds = exercises.map(ex => ex.id);
        const { data: existingExercises, error: fetchError } = await supabase
            .from('exercises')
            .select('*')  // Select all columns to preserve during upsert
            .in('id', exerciseIds);

        if (fetchError || !existingExercises) {
            console.error('Failed to fetch existing exercises:', fetchError);
            throw new Error('Failed to fetch exercise data');
        }

        // Build upsert payload with updated order_index
        const orderMap = new Map(exercises.map(ex => [ex.id, ex.order_index]));
        const upsertPayload = existingExercises.map(ex => ({
            ...ex,
            order_index: orderMap.get(ex.id) ?? 0
        }));

        // Single atomic upsert - 1 request for all exercises
        const { error: upsertError } = await supabase
            .from('exercises')
            .upsert(upsertPayload, {
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (upsertError) {
            console.error('Atomic upsert failed:', upsertError);
            throw new Error(`Database error: ${upsertError.message}`);
        }

        // Invalidate lessons cache since order changed
        cacheManager.invalidate(/^lessons/);

        if (import.meta.env.DEV) {
            console.log(`[DB] Reordered ${exercises.length} exercises in single atomic operation`);
        }
    } catch (err) {
        console.error('Error in atomic reorder:', err);
        throw err; // Propagate for proper error handling in UI
    }
};

// ============================================================================
// CACHE INVALIDATION HELPERS
// ============================================================================

/**
 * Invalidate all lesson-related caches
 * Call this when lessons or exercises are modified
 */
export const invalidateLessonCache = () => {
    cacheManager.invalidate(/^lesson/);
};

/**
 * Invalidate user progress caches
 * Call this when progress is saved
 */
export const invalidateProgressCache = (userId: string) => {
    cacheManager.invalidateKey(CacheKeys.userProgress(userId));
    cacheManager.invalidateKey(CacheKeys.exerciseProgress(userId));
};

/**
 * Invalidate admin stats cache
 * Call this when data changes that affects stats
 */
export const invalidateAdminCache = () => {
    cacheManager.invalidateKey(CacheKeys.adminStats());
    cacheManager.invalidateKey(CacheKeys.recentActivity());
};
