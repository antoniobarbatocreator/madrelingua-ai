import React from 'react';

interface SkeletonListProps {
  count?: number;
  className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ count = 3, className = '' }) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl animate-pulse space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-800 rounded w-1/3" />
            <div className="h-3 bg-slate-800 rounded w-16" />
          </div>
          <div className="h-3 bg-slate-800/60 rounded w-2/3" />
          <div className="h-3 bg-slate-800/40 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
};
