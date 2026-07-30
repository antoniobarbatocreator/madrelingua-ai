import React from 'react';
import { X, Check } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterGroup {
  id: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: FilterOption[];
}

interface FilterSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  groups: FilterGroup[];
  onReset?: () => void;
  hasActiveFilters?: boolean;
}

export const FilterSheet: React.FC<FilterSheetProps> = ({
  isOpen,
  onClose,
  title = 'Filtri e Ordinamento',
  groups,
  onReset,
  hasActiveFilters = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 animate-fadeIn">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl p-5 space-y-5 text-slate-100 z-10 max-h-[85vh] overflow-y-auto animate-slideUp shadow-2xl">
        {/* Top Handle bar for mobile */}
        <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="font-bold text-sm text-amber-400">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Groups */}
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id} className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                {group.label}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {group.options.map((opt) => {
                  const isSelected = group.value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => group.onChange(opt.value)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
          {hasActiveFilters && onReset && (
            <button
              onClick={onReset}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer border border-slate-700"
            >
              Rimuovi filtri
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-lg shadow-amber-500/10"
          >
            Applica
          </button>
        </div>
      </div>
    </div>
  );
};
