import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`p-6 sm:p-8 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 max-w-md mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 text-amber-400 flex items-center justify-center shadow-inner">
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="font-bold text-sm sm:text-base text-white">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">{description}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
        >
          {action.icon}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};
