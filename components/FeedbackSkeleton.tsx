import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, Sparkles } from 'lucide-react';
import { LocalDiffResult } from '../services/localDiff';

interface FeedbackSkeletonProps {
    localDiff?: LocalDiffResult;
    exerciseType?: string;
}

/**
 * Skeleton UI that appears instantly (<10ms) while waiting for AI response.
 * Shows predictive structure and local diff highlighting.
 */
export const FeedbackSkeleton: React.FC<FeedbackSkeletonProps> = ({
    localDiff,
    exerciseType
}) => {
    const estimatedScore = localDiff?.estimatedScore ?? 75;
    const hasLocalTokens = localDiff && localDiff.tokens.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            className="mt-6 rounded-[2rem] bg-white border border-slate-200/80 flex flex-col shadow-xl relative overflow-hidden"
        >
            {/* Background pulse effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-purple-50/30 animate-pulse" />

            {/* Header Skeleton */}
            <div className="px-6 py-5 flex items-center gap-4 border-b border-slate-100 relative">
                {/* Animated Score Circle */}
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: [0.8, 1.05, 1] }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                    className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-indigo-400 to-purple-500 text-white relative overflow-hidden"
                >
                    {/* Shimmer effect */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    />
                    <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="text-lg font-black relative z-10"
                    >
                        {estimatedScore}
                    </motion.span>
                </motion.div>

                {/* Title skeleton */}
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                        <motion.div
                            className="h-5 w-32 bg-slate-200 rounded-lg"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <motion.div
                            className="h-4 w-16 bg-indigo-100 rounded-full"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                        />
                    </div>
                    <motion.div
                        className="h-3 w-24 bg-slate-100 rounded"
                        animate={{ opacity: [0.3, 0.7, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                    />
                </div>

                {/* Audio button placeholder */}
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center opacity-50">
                    <Volume2 className="w-5 h-5 text-indigo-400" />
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="px-6 py-5 space-y-5 relative">
                {/* Local Diff Preview (if available) */}
                {hasLocalTokens && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.05 }}
                        className="space-y-2"
                    >
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-4 bg-indigo-400 rounded-full animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                Phân tích nhanh...
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-x-0.5 gap-y-2 py-3 px-3 bg-slate-50/80 rounded-xl border border-slate-100">
                            {localDiff.tokens.map((token, idx) => (
                                <motion.span
                                    key={idx}
                                    initial={{ opacity: 0, y: 3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.1, delay: idx * 0.03 }}
                                    className={`text-lg font-semibold px-1.5 py-0.5 rounded-lg transition-all
                    ${token.status === 'correct'
                                            ? 'text-slate-700'
                                            : 'bg-rose-100/80 text-rose-600 line-through decoration-2'
                                        }`}
                                >
                                    {token.text}
                                </motion.span>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* Explanation Skeleton */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl"
                >
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                <motion.div
                                    className="h-3 w-20 bg-indigo-200 rounded"
                                    animate={{ opacity: [0.5, 1, 0.5] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                                {/* Typing cursor */}
                                <motion.div
                                    className="w-2 h-4 bg-indigo-400 rounded-sm"
                                    animate={{ opacity: [1, 0] }}
                                    transition={{ duration: 0.5, repeat: Infinity }}
                                />
                            </div>
                            <motion.div
                                className="h-3 w-full bg-indigo-100 rounded"
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                            />
                            <motion.div
                                className="h-3 w-3/4 bg-indigo-100 rounded"
                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 py-2">
                    <motion.div
                        className="w-2 h-2 bg-indigo-500 rounded-full"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                        className="w-2 h-2 bg-indigo-500 rounded-full"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.div
                        className="w-2 h-2 bg-indigo-500 rounded-full"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
                    />
                </div>
            </div>
        </motion.div>
    );
};
