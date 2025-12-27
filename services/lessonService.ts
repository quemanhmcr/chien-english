import { supabase } from './supabaseClient';
import { Lesson, Exercise } from '../types';

export const getLessons = async (): Promise<Lesson[]> => {
    const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select(`
      *,
      exercises (*)
    `)
        .order('created_at', { ascending: false });

    if (lessonsError) {
        console.error('Error fetching lessons:', lessonsError);
        return [];
    }

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
    const { error } = await supabase
        .from('user_progress')
        .insert([{ user_id: userId, lesson_id: lessonId, score }]);

    if (error) {
        console.error('Error saving progress:', error);
        throw error;
    }
};

export const getUserProgress = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching user progress:', error);
        return [];
    }
    return data;
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
};

export const getExerciseProgress = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_exercise_progress')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.error('Error fetching exercise progress:', error);
        return [];
    }
    return data;
};

export const getAdminStats = async () => {
    const { count: studentCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: lessonCount } = await supabase.from('lessons').select('*', { count: 'exact', head: true });

    const { data: progressData } = await supabase
        .from('user_progress')
        .select(`
            id,
            score,
            completed_at,
            lesson_id,
            lessons (title),
            user_id,
            profiles (full_name)
        `);

    const totalCompletions = progressData?.length || 0;
    const avgScore = totalCompletions > 0
        ? progressData!.reduce((acc, curr) => acc + curr.score, 0) / totalCompletions
        : 0;

    // Algorithm: Find difficult lessons (lowest avg scores)
    const lessonScores: Record<string, { title: string, total: number, count: number }> = {};
    const userStats: Record<string, { name: string, completions: number, totalScore: number }> = {};

    progressData?.forEach(p => {
        // Lessons
        if (p.lesson_id) {
            if (!lessonScores[p.lesson_id]) {
                lessonScores[p.lesson_id] = { title: (p.lessons as any)?.title || 'Unknown', total: 0, count: 0 };
            }
            lessonScores[p.lesson_id].total += p.score;
            lessonScores[p.lesson_id].count += 1;
        }

        // Users
        if (p.user_id) {
            if (!userStats[p.user_id]) {
                userStats[p.user_id] = { name: (p.profiles as any)?.full_name || 'User', completions: 0, totalScore: 0 };
            }
            userStats[p.user_id].completions += 1;
            userStats[p.user_id].totalScore += p.score;
        }
    });

    const difficultLessons = Object.entries(lessonScores)
        .map(([id, data]) => ({ id, title: data.title, avgScore: Math.round(data.total / data.count) }))
        .sort((a, b) => a.avgScore - b.avgScore)
        .slice(0, 3);

    const topLearners = Object.entries(userStats)
        .map(([id, data]) => ({
            id,
            full_name: data.name,
            completions: data.completions,
            avgScore: Math.round(data.totalScore / data.completions)
        }))
        .sort((a, b) => b.completions - a.completions || b.avgScore - a.avgScore)
        .slice(0, 3);

    return {
        totalStudents: studentCount || 0,
        totalLessons: lessonCount || 0,
        totalCompletions,
        avgScore: Math.round(avgScore),
        difficultLessons,
        topLearners
    };
};

export const getRecentActivity = async () => {
    const { data, error } = await supabase
        .from('user_progress')
        .select(`
            id,
            score,
            completed_at,
            lesson_id,
            lessons (title),
            user_id,
            profiles (full_name)
        `)
        .order('completed_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching recent activity:', error);
        return [];
    }
    return data;
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
    const { error } = await supabase
        .from('exercises')
        .update({
            vietnamese: updates.vietnamese,
            hint: updates.hint,
            difficulty: updates.difficulty
        })
        .eq('id', id);

    if (error) {
        console.error('Error updating exercise:', error);
        return false;
    }
    return true;
};
