import { supabase } from './supabaseClient';
import { UserProfile } from '../types';

const getRedirectUrl = () => {
    return window.location.origin;
};

export const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo: getRedirectUrl(),
            data: {
                full_name: fullName,
            },
        },
    });

    if (error) throw error;
    return data;
};

export const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) throw error;
    return data;
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
};

export const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getRedirectUrl()}/#reset_password=true`,
    });
    if (error) throw error;
};

export const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    });
    if (error) throw error;
};

export const getProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('Profile not found for user:', userId);
                return null;
            }
            throw error;
        }
        return data;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
};

export const ensureProfile = async (userId: string, metadata?: any): Promise<UserProfile | null> => {
    const profile = await getProfile(userId);
    if (profile) return profile;

    console.log('Attempting to create missing profile for user:', userId);
    const { data, error } = await supabase
        .from('profiles')
        .insert([
            {
                id: userId,
                full_name: metadata?.full_name || 'User',
                avatar_url: metadata?.avatar_url || null,
                role: 'student'
            }
        ])
        .select()
        .single();

    if (error) {
        console.error('Error creating profile:', error);
        return null;
    }
    return data;
};

export const updateProfile = async (userId: string, updates: Partial<UserProfile>) => {
    const { error } = await supabase
        .from('profiles')
        .update({
            ...updates,
            updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

    if (error) throw error;
};

export const getAllProfiles = async (): Promise<UserProfile[]> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching all profiles:', error);
        return [];
    }
    return data || [];
};
export const getUserDetailedProgress = async (userId: string) => {
    const { data, error } = await supabase
        .from('user_progress')
        .select(`
            id,
            score,
            completed_at,
            lesson_id,
            lessons (title)
        `)
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

    if (error) {
        console.error('Error fetching user detailed progress:', error);
        return [];
    }
    return data;
};

export const updateGamificationStats = async (userId: string, xpGain: number) => {
    try {
        const profile = await getProfile(userId);
        if (!profile) return null;

        const now = new Date();
        const lastActive = profile.last_active_at ? new Date(profile.last_active_at) : null;
        let newStreak = profile.streak_current || 0;

        // Streak Logic
        if (lastActive) {
            const tempNow = new Date(now);
            const tempLast = new Date(lastActive);
            // Reset hours to compare dates only
            tempNow.setHours(0, 0, 0, 0);
            tempLast.setHours(0, 0, 0, 0);

            const diffTime = Math.abs(tempNow.getTime() - tempLast.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                newStreak += 1;
            } else if (diffDays > 1) {
                newStreak = 1; // Reset if missed more than 1 day
            }
            // If diffDays === 0 (same day), do nothing to streak
        } else {
            newStreak = 1;
        }

        // XP & Level Logic (Simple: Level = XP / 1000 + 1)
        const newXP = (profile.xp || 0) + xpGain;
        const newLevel = Math.floor(newXP / 1000) + 1;
        const leveledUp = newLevel > (profile.level || 1);

        const updates = {
            xp: newXP,
            level: newLevel,
            streak_current: newStreak,
            last_active_at: now.toISOString()
        };

        await updateProfile(userId, updates);

        return { ...updates, leveledUp, xpGained: xpGain };
    } catch (err) {
        console.error('Error updating gamification stats:', err);
        return null; // Fail silently to not block user flow
    }
};
