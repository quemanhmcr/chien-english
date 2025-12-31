/**
 * Enterprise-grade Cache Manager
 * 
 * Features:
 * - LRU eviction with configurable max size
 * - TTL-based expiration with stale-while-revalidate
 * - Request deduplication (Promise coalescence)
 * - Optimistic cache updates for mutations
 * - Memory-efficient with automatic cleanup
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
    staleTime?: number;
}

interface CacheOptions {
    ttl?: number;           // Time to live in ms (default: 5 min)
    staleTime?: number;     // Time before considered stale (default: 1 min)
    forceRefresh?: boolean; // Bypass cache
}

type PendingRequest<T> = Promise<T>;

class CacheManager {
    private cache = new Map<string, CacheEntry<any>>();
    private pendingRequests = new Map<string, PendingRequest<any>>();
    private readonly MAX_CACHE_SIZE = 100;
    private readonly DEFAULT_TTL = 5 * 60 * 1000;      // 5 minutes
    private readonly DEFAULT_STALE_TIME = 60 * 1000;   // 1 minute

    // Cleanup interval reference
    private cleanupInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Auto-cleanup expired entries every 2 minutes
        if (typeof window !== 'undefined') {
            this.cleanupInterval = setInterval(() => this.cleanup(), 2 * 60 * 1000);
        }
    }

    /**
     * Get cached data or execute fetcher if cache miss/expired
     */
    async getOrFetch<T>(
        key: string,
        fetcher: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<T> {
        const { ttl = this.DEFAULT_TTL, staleTime = this.DEFAULT_STALE_TIME, forceRefresh = false } = options;

        // Check for pending request (deduplication)
        const pending = this.pendingRequests.get(key);
        if (pending && !forceRefresh) {
            return pending as Promise<T>;
        }

        // Check cache
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && !forceRefresh) {
            const age = now - cached.timestamp;

            // Fresh data - return immediately
            if (age < (cached.staleTime || staleTime)) {
                return cached.data;
            }

            // Stale but not expired - return stale data and refresh in background
            if (age < cached.ttl) {
                this.refreshInBackground(key, fetcher, { ttl, staleTime });
                return cached.data;
            }
        }

        // Cache miss or expired - fetch fresh data
        return this.fetchAndCache(key, fetcher, { ttl, staleTime });
    }

    /**
     * Get cached data without fetching
     */
    get<T>(key: string): T | null {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const age = Date.now() - cached.timestamp;
        if (age >= cached.ttl) {
            this.cache.delete(key);
            return null;
        }

        return cached.data as T;
    }

    /**
     * Check if cached data is fresh (within threshold)
     */
    isFresh(key: string, freshThreshold: number = this.DEFAULT_STALE_TIME): boolean {
        const cached = this.cache.get(key);
        if (!cached) return false;
        return (Date.now() - cached.timestamp) < freshThreshold;
    }

    /**
     * Set cache data directly (for optimistic updates)
     */
    set<T>(key: string, data: T, options: CacheOptions = {}): void {
        const { ttl = this.DEFAULT_TTL, staleTime = this.DEFAULT_STALE_TIME } = options;

        // Enforce max size with LRU eviction
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl,
            staleTime
        });
    }

    /**
     * Invalidate cache entries matching a pattern
     */
    invalidate(pattern: string | RegExp): void {
        const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Invalidate a specific key
     */
    invalidateKey(key: string): void {
        this.cache.delete(key);
        this.pendingRequests.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear(): void {
        this.cache.clear();
        this.pendingRequests.clear();
    }

    /**
     * Optimistic update - update cache immediately, rollback on failure
     */
    async optimisticUpdate<T>(
        key: string,
        optimisticData: T,
        mutator: () => Promise<T>,
        options: CacheOptions = {}
    ): Promise<T> {
        const previousData = this.get<T>(key);

        // Optimistically update cache
        this.set(key, optimisticData, options);

        try {
            const result = await mutator();
            // Update with actual result
            this.set(key, result, options);
            return result;
        } catch (error) {
            // Rollback on failure
            if (previousData !== null) {
                this.set(key, previousData, options);
            } else {
                this.invalidateKey(key);
            }
            throw error;
        }
    }

    /**
     * Batch get multiple keys
     */
    batchGet<T>(keys: string[]): Map<string, T | null> {
        const results = new Map<string, T | null>();
        for (const key of keys) {
            results.set(key, this.get<T>(key));
        }
        return results;
    }

    /**
     * Get cache statistics for debugging
     */
    getStats(): { size: number; keys: string[] } {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }

    // === Private Methods ===

    private async fetchAndCache<T>(
        key: string,
        fetcher: () => Promise<T>,
        options: { ttl: number; staleTime: number }
    ): Promise<T> {
        const fetchPromise = fetcher()
            .then(data => {
                this.set(key, data, options);
                this.pendingRequests.delete(key);
                return data;
            })
            .catch(error => {
                this.pendingRequests.delete(key);
                throw error;
            });

        this.pendingRequests.set(key, fetchPromise);
        return fetchPromise;
    }

    private refreshInBackground<T>(
        key: string,
        fetcher: () => Promise<T>,
        options: { ttl: number; staleTime: number }
    ): void {
        // Only refresh if not already refreshing
        if (this.pendingRequests.has(key)) return;

        const refreshPromise = fetcher()
            .then(data => {
                this.set(key, data, options);
                this.pendingRequests.delete(key);
            })
            .catch(() => {
                this.pendingRequests.delete(key);
                // Silently fail - stale data is still valid
            });

        this.pendingRequests.set(key, refreshPromise);
    }

    private cleanup(): void {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp >= entry.ttl) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Cleanup on unmount (for SSR safety)
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
    }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Cache key generators for consistent key patterns
export const CacheKeys = {
    lessons: () => 'lessons_all',
    lessonById: (id: string) => `lesson_${id}`,
    userProfile: (userId: string) => `profile_${userId}`,
    userProgress: (userId: string) => `progress_${userId}`,
    exerciseProgress: (userId: string) => `exercise_progress_${userId}`,
    adminStats: () => 'admin_stats',
    recentActivity: () => 'recent_activity',
    allProfiles: () => 'profiles_all',
} as const;

// TTL presets for different data types
export const CacheTTL = {
    STATIC: 10 * 60 * 1000,      // 10 minutes - rarely changes
    LESSONS: 5 * 60 * 1000,      // 5 minutes - admin may update
    PROFILES: 5 * 60 * 1000,     // 5 minutes
    PROGRESS: 60 * 1000,         // 1 minute - changes frequently
    REALTIME: 30 * 1000,         // 30 seconds - near real-time data
} as const;
