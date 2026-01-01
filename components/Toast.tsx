import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

// ============================================================================
// INDUSTRY-STANDARD TOAST NOTIFICATION SYSTEM
// Follows Material Design 3, WCAG 2.1 AA accessibility standards
// ============================================================================

// Types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
    label: string;
    onClick: () => void;
}

interface Toast {
    id: string;
    type: ToastType;
    message: string;
    duration?: number;
    action?: ToastAction;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, duration?: number, action?: ToastAction) => void;
}

// Configuration
const MAX_VISIBLE_TOASTS = 5;
const DEFAULT_DURATION = 4000;

// Context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Provider Component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((
        message: string,
        type: ToastType = 'info',
        duration = DEFAULT_DURATION,
        action?: ToastAction
    ) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        setToasts(prev => {
            const newToasts = [...prev, { id, type, message, duration, action }];
            // Limit visible toasts to prevent UI clutter
            if (newToasts.length > MAX_VISIBLE_TOASTS) {
                return newToasts.slice(-MAX_VISIBLE_TOASTS);
            }
            return newToasts;
        });
    }, []);

    const dismissToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container - ARIA Live Region for Accessibility */}
            <div
                className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
                role="region"
                aria-label="Thông báo"
            >
                <AnimatePresence mode="popLayout">
                    {toasts.map(toast => (
                        <ToastItem
                            key={toast.id}
                            toast={toast}
                            onDismiss={() => dismissToast(toast.id)}
                        />
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

// Toast Item Component with Full Accessibility
const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
    useEffect(() => {
        if (toast.duration && toast.duration > 0) {
            const timer = setTimeout(onDismiss, toast.duration);
            return () => clearTimeout(timer);
        }
    }, [toast.duration, onDismiss]);

    // Icon mapping with consistent sizing
    const icons: Record<ToastType, React.ReactNode> = {
        success: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />,
        error: <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />,
        warning: <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />,
        info: <Info className="w-5 h-5 text-indigo-600 flex-shrink-0" />,
    };

    // M3-compliant color schemes
    const styles: Record<ToastType, string> = {
        success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        error: 'bg-rose-50 border-rose-200 text-rose-900',
        warning: 'bg-amber-50 border-amber-200 text-amber-900',
        info: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    };

    // ARIA live region politeness based on toast type
    const ariaLive = toast.type === 'error' ? 'assertive' : 'polite';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
                mass: 0.8
            }}
            role="alert"
            aria-live={ariaLive}
            aria-atomic="true"
            className={`
                pointer-events-auto flex items-center gap-3 
                pl-4 pr-3 py-3.5 rounded-2xl border shadow-lg 
                max-w-sm backdrop-blur-sm
                ${styles[toast.type]}
            `}
        >
            {icons[toast.type]}

            <p className="flex-1 text-sm font-medium leading-snug">
                {toast.message}
            </p>

            {/* Optional Action Button */}
            {toast.action && (
                <button
                    onClick={() => {
                        toast.action?.onClick();
                        onDismiss();
                    }}
                    className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide 
                               rounded-lg bg-white/60 hover:bg-white/80 
                               transition-colors flex-shrink-0"
                >
                    {toast.action.label}
                </button>
            )}

            {/* Dismiss Button */}
            <button
                onClick={onDismiss}
                className="p-1.5 rounded-lg hover:bg-black/5 transition-colors flex-shrink-0"
                aria-label="Đóng thông báo"
            >
                <X className="w-4 h-4 opacity-60" />
            </button>
        </motion.div>
    );
};

// Hook for consuming toast context
export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
