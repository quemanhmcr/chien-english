import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface FeedbackSkeletonProps {
    isExiting?: boolean;
}

/**
 * Simple skeleton UI while waiting for AI response.
 * Material Motion 3: subtle, non-distracting loading state.
 */
export const FeedbackSkeleton: React.FC<FeedbackSkeletonProps> = ({
    isExiting = false
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: isExiting ? 0 : 1, y: 0, scale: isExiting ? 0.98 : 1 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className={`mt-6 rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden ${isExiting ? 'pointer-events-none' : ''}`}
        >
            {/* Header */}
            <div className="px-6 py-5 flex items-center gap-4 border-b border-slate-50">
                {/* Score placeholder */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 animate-pulse" />

                {/* Title lines */}
                <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 bg-slate-100 rounded-lg animate-pulse" />
                    <div className="h-3 w-20 bg-slate-50 rounded animate-pulse" />
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
                {/* Text lines */}
                <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                    <div className="h-3 w-4/5 bg-slate-50 rounded animate-pulse" />
                    <div className="h-3 w-3/5 bg-slate-50 rounded animate-pulse" />
                </div>

                {/* Loading indicator */}
                <div className="flex items-center justify-center gap-2 py-4">
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    <span className="text-sm text-slate-400">Đang phân tích...</span>
                </div>
            </div>
        </motion.div>
    );
};
