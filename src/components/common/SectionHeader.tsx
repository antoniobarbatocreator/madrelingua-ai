import React from 'react';

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 ${className}`}>
      <div className="space-y-1">
        <div className="flex items-center space-x-2.5">
          {icon && <div className="text-amber-400 shrink-0">{icon}</div>}
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{title}</h2>
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
};
