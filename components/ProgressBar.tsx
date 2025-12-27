import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = Math.min(100, (current / total) * 100);

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-4 px-2">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Module Velocity</span>
          <span className="text-xl font-black text-slate-900 leading-none">Step {current + 1} <span className="text-slate-300">/ {total}</span></span>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black italic text-indigo-600 block leading-none">{Math.round(percentage)}%</span>
        </div>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden p-1 border border-slate-200/60 shadow-inner">
        <div
          className="bg-indigo-600 h-full rounded-full transition-all duration-1000 ease-[cubic-bezier(0.19,1,0.22,1)] relative"
          style={{ width: `${percentage}%` }}
        >
          {/* Internal Shine Effect */}
          <div className="absolute inset-0 bg-white/20 blur-[1px] rounded-full"></div>
          {/* Animated Pulse End */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg border-2 border-indigo-600 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};