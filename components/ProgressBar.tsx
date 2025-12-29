import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = Math.min(100, ((current + 1) / total) * 100);

  return (
    <div className="w-full">
      {/* Minimal thin progress bar */}
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-slow ease-material-decel"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Subtle stats */}
      <div className="flex justify-between items-center mt-3">
        <span className="text-xs text-slate-500 font-medium">
          Bài {current + 1} / {total}
        </span>
        <span className="text-xs text-slate-400 font-medium">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
};
