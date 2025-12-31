import { createClient, SupabaseClientOptions } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
}

/**
 * Enhanced Supabase client configuration
 * - Auth: Auto-refresh tokens, persistent sessions
 * - Realtime: Rate-limited to prevent excessive subscriptions
 * - Global: Client identification for debugging
 */
const supabaseOptions: SupabaseClientOptions<'public'> = {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
    },
    global: {
        headers: {
            'x-client-info': 'chien-english/1.0'
        },
        fetch: (url, options) => {
            // Add retry logic for failed requests
            return fetch(url, {
                ...options,
                // Ensure credentials are included
                credentials: 'same-origin'
            });
        }
    },
    db: {
        schema: 'public'
    },
    realtime: {
        params: {
            eventsPerSecond: 2 // Rate limit realtime events to prevent flooding
        }
    }
};

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', supabaseOptions);
