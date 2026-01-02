// ============================================================================
// RATE LIMIT GUARD
// Proactive protection against Supabase 429 errors
// Based on Supabase Free Tier: ~1000-1200 RPS benchmark (PostgreSQL API)
// ============================================================================

/**
 * Configuration for rate limiting
 * Conservative values to stay well within Supabase free tier limits
 */
const CONFIG = {
    /** Minimum delay between sequential DB write operations (ms) */
    MIN_DELAY_MS: 100,

    /** Cooldown period after batch operations complete (ms) */
    COOLDOWN_AFTER_BATCH_MS: 2000,

    /** Maximum concurrent requests (for future use) */
    MAX_CONCURRENT: 5,
};

// ============================================================================
// COOLDOWN STATE
// ============================================================================

let cooldownEndTime: number = 0;
let cooldownCallbacks: Set<() => void> = new Set();

/**
 * Check if currently in cooldown period
 */
export function isOnCooldown(): boolean {
    return Date.now() < cooldownEndTime;
}

/**
 * Get remaining cooldown time in milliseconds
 * Returns 0 if not on cooldown
 */
export function getCooldownRemaining(): number {
    const remaining = cooldownEndTime - Date.now();
    return remaining > 0 ? remaining : 0;
}

/**
 * Start a cooldown period after batch operations
 * @param durationMs - Cooldown duration in milliseconds (default: CONFIG.COOLDOWN_AFTER_BATCH_MS)
 */
export function startBatchCooldown(durationMs: number = CONFIG.COOLDOWN_AFTER_BATCH_MS): void {
    cooldownEndTime = Date.now() + durationMs;

    // Notify all registered callbacks when cooldown ends
    setTimeout(() => {
        cooldownCallbacks.forEach(cb => {
            try { cb(); } catch (e) { /* ignore */ }
        });
    }, durationMs);
}

/**
 * Register a callback to be notified when cooldown ends
 */
export function onCooldownEnd(callback: () => void): () => void {
    cooldownCallbacks.add(callback);
    return () => cooldownCallbacks.delete(callback);
}

/**
 * Clear any active cooldown (use with caution)
 */
export function clearCooldown(): void {
    cooldownEndTime = 0;
}

// ============================================================================
// SEQUENTIAL EXECUTION WITH DELAY
// ============================================================================

/**
 * Execute an array of async operations sequentially with delay between each
 * This prevents overwhelming Supabase with parallel requests
 * 
 * @param operations - Array of async functions to execute
 * @param delayMs - Delay between each operation (default: CONFIG.MIN_DELAY_MS)
 * @returns Array of results from each operation
 * 
 * @example
 * const results = await executeSequentially(
 *   exercises.map(ex => () => updateExercise(ex)),
 *   100
 * );
 */
export async function executeSequentially<T>(
    operations: (() => Promise<T>)[],
    delayMs: number = CONFIG.MIN_DELAY_MS
): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < operations.length; i++) {
        const result = await operations[i]();
        results.push(result);

        // Add delay between operations (skip after last one)
        if (i < operations.length - 1 && delayMs > 0) {
            await delay(delayMs);
        }
    }

    return results;
}

/**
 * Simple delay helper
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// THROTTLED EXECUTION (for individual operations)
// ============================================================================

let lastExecutionTime: number = 0;

/**
 * Execute a function with minimum time gap from last execution
 * Useful for throttling individual DB operations
 * 
 * @param fn - Async function to execute
 * @param minGapMs - Minimum gap from last execution (default: CONFIG.MIN_DELAY_MS)
 */
export async function throttledExecute<T>(
    fn: () => Promise<T>,
    minGapMs: number = CONFIG.MIN_DELAY_MS
): Promise<T> {
    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutionTime;

    if (timeSinceLastExecution < minGapMs) {
        await delay(minGapMs - timeSinceLastExecution);
    }

    lastExecutionTime = Date.now();
    return fn();
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Check if an error is a rate limit (429) error
 */
export function isRateLimitError(error: any): boolean {
    if (!error) return false;

    // Check error message
    const message = error?.message?.toLowerCase() || '';
    if (message.includes('429') || message.includes('rate limit') || message.includes('too many')) {
        return true;
    }

    // Check error code/status
    if (error?.code === '429' || error?.status === 429) {
        return true;
    }

    return false;
}

/**
 * Get user-friendly message for rate limit errors
 */
export function getRateLimitMessage(cooldownMs?: number): string {
    if (cooldownMs && cooldownMs > 0) {
        const seconds = Math.ceil(cooldownMs / 1000);
        return `Vui lòng đợi ${seconds} giây trước khi thay đổi tiếp...`;
    }
    return 'Quá nhiều thay đổi liên tiếp. Vui lòng đợi một chút.';
}

// ============================================================================
// EXPORTS
// ============================================================================

export const RateLimitConfig = CONFIG;
