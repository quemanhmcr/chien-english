import { useRef, useCallback, useState } from 'react';
import { updateExerciseOrder as apiUpdateOrder } from '../services/lessonService';

// ============================================================================
// REORDER MANAGER HOOK
// Industry-standard debounced batch update with optimistic UI and rollback
// ============================================================================

export interface OrderUpdate {
    id: string;
    order_index: number;
}

export interface ReorderCallbacks {
    onPending?: () => void;
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

interface ReorderState {
    isPending: boolean;
    lastSavedOrder: OrderUpdate[] | null;
    error: string | null;
}

// Configuration
const DEBOUNCE_MS = 800;        // Wait 800ms after last change before saving
const MAX_RETRIES = 2;          // Retry twice on transient failures
const RETRY_DELAY_MS = 1000;    // Wait 1s between retries

/**
 * useReorderManager - Manages debounced batch updates for drag-and-drop reordering
 * 
 * Features:
 * - Debounced batch updates (800ms settle time)
 * - Request coalescing (merges rapid changes) 
 * - Optimistic UI with rollback on failure
 * - Undo functionality
 * - Retry with exponential backoff
 * 
 * @example
 * const { scheduleUpdate, undo, isPending } = useReorderManager();
 * 
 * const handleDragEnd = (newOrder) => {
 *   scheduleUpdate(newOrder, {
 *     onPending: () => showSnackbar('Đang lưu...'),
 *     onSuccess: () => showSnackbar('Đã lưu!', { action: { label: 'Hoàn tác', onClick: undo } }),
 *     onError: (err) => showSnackbar(`Lỗi: ${err}`, 'error')
 *   });
 * };
 */
export function useReorderManager() {
    // State
    const [state, setState] = useState<ReorderState>({
        isPending: false,
        lastSavedOrder: null,
        error: null
    });

    // Refs for debouncing and coalescing
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pendingChangesRef = useRef<Map<string, number>>(new Map());
    const callbacksRef = useRef<ReorderCallbacks>({});
    const previousOrderRef = useRef<OrderUpdate[] | null>(null);
    const isProcessingRef = useRef(false);

    /**
     * Execute the batch update with retry logic
     */
    const executeBatchUpdate = useCallback(async (
        updates: OrderUpdate[]
    ): Promise<{ success: boolean; error?: string }> => {
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                await apiUpdateOrder(updates);
                return { success: true };
            } catch (err: any) {
                const errorMessage = err?.message || 'Unknown error';

                // Don't retry on 429 - it means we're being rate limited
                if (errorMessage.includes('429') || attempt === MAX_RETRIES) {
                    return { success: false, error: errorMessage };
                }

                // Wait before retry with exponential backoff
                await new Promise(resolve =>
                    setTimeout(resolve, RETRY_DELAY_MS * Math.pow(2, attempt))
                );
            }
        }
        return { success: false, error: 'Max retries exceeded' };
    }, []);

    /**
     * Flush pending changes to the database
     */
    const flushPendingChanges = useCallback(async () => {
        if (isProcessingRef.current || pendingChangesRef.current.size === 0) {
            return;
        }

        isProcessingRef.current = true;
        setState(prev => ({ ...prev, isPending: true, error: null }));

        // Capture current pending changes and clear the map
        const updates: OrderUpdate[] = [];
        pendingChangesRef.current.forEach((order_index, id) => {
            updates.push({ id, order_index });
        });
        pendingChangesRef.current.clear();

        // Call pending callback
        callbacksRef.current.onPending?.();

        // Execute update
        const result = await executeBatchUpdate(updates);

        if (result.success) {
            // Store for undo functionality
            setState(prev => ({
                ...prev,
                isPending: false,
                lastSavedOrder: updates,
                error: null
            }));
            callbacksRef.current.onSuccess?.();
        } else {
            setState(prev => ({
                ...prev,
                isPending: false,
                error: result.error || 'Failed to save order'
            }));
            callbacksRef.current.onError?.(result.error || 'Failed to save order');
        }

        isProcessingRef.current = false;
    }, [executeBatchUpdate]);

    /**
     * Schedule an order update with debouncing
     * Multiple rapid calls will be coalesced into a single batch
     * @param updates - The NEW order to save
     * @param callbacks - Callback handlers
     * @param previousOrder - Optional: the PREVIOUS order before this change (for undo)
     */
    const scheduleUpdate = useCallback((
        updates: OrderUpdate[],
        callbacks?: ReorderCallbacks,
        previousOrder?: OrderUpdate[]
    ) => {
        // Store callbacks for use when batch executes
        if (callbacks) {
            callbacksRef.current = callbacks;
        }

        // Store previous order for undo (only the first time in a drag sequence)
        // This captures the state BEFORE any reordering started
        if (previousOrder && !previousOrderRef.current) {
            previousOrderRef.current = previousOrder;
        }

        // Merge new updates with pending changes (coalescing)
        updates.forEach(u => {
            pendingChangesRef.current.set(u.id, u.order_index);
        });

        // Clear existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Schedule new batch update
        debounceTimerRef.current = setTimeout(() => {
            flushPendingChanges();
        }, DEBOUNCE_MS);
    }, [flushPendingChanges]);

    /**
     * Immediately flush any pending changes (useful before navigation)
     */
    const flushNow = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        return flushPendingChanges();
    }, [flushPendingChanges]);

    /**
     * Undo the last saved reorder operation
     * Returns the previous order to restore, or null if no undo available
     */
    const undo = useCallback(async (): Promise<OrderUpdate[] | null> => {
        const previousOrder = previousOrderRef.current;
        if (!previousOrder) {
            return null;
        }

        // Wait if a save is currently in progress (prevents concurrent API calls)
        while (isProcessingRef.current) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Clear any pending changes
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        pendingChangesRef.current.clear();

        // Mark as processing to prevent concurrent operations
        isProcessingRef.current = true;
        setState(prev => ({ ...prev, isPending: true }));

        const result = await executeBatchUpdate(previousOrder);

        isProcessingRef.current = false;

        if (result.success) {
            previousOrderRef.current = null;
            setState(prev => ({ ...prev, isPending: false, lastSavedOrder: null }));
            return previousOrder;
        } else {
            setState(prev => ({ ...prev, isPending: false, error: result.error || 'Undo failed' }));
            return null;
        }
    }, [executeBatchUpdate]);

    /**
     * Cancel any pending updates without saving
     */
    const cancel = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        pendingChangesRef.current.clear();
        previousOrderRef.current = null;
    }, []);

    return {
        scheduleUpdate,
        flushNow,
        undo,
        cancel,
        isPending: state.isPending,
        error: state.error,
        hasPendingChanges: pendingChangesRef.current.size > 0 || state.isPending
    };
}

export default useReorderManager;
