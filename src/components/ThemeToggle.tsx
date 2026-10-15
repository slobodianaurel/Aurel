import React from 'react';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  theme: 'light' | 'dark';
  onToggle: () => void;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  theme,
  onToggle,
  className = '',
}) => {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
      title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
      onClick={onToggle}
      className={`group relative inline-flex h-8 w-16 shrink-0 cursor-pointer items-center rounded-full p-1 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-inner select-none ${
        isDark
          ? 'bg-slate-800 border border-slate-700/80 hover:bg-slate-750 hover:border-slate-600'
          : 'bg-slate-200 border border-slate-300/80 hover:bg-slate-250 hover:border-slate-400'
      } ${className}`}
    >
      {/* Background Icons Inside Switch Track */}
      <div className="absolute inset-x-1.5 flex items-center justify-between pointer-events-none">
        {/* Sun Icon (Left) */}
        <Sun
          className={`h-3.5 w-3.5 transition-all duration-300 ${
            isDark
              ? 'text-slate-500 opacity-40 scale-90'
              : 'text-amber-500 opacity-100 scale-100'
          }`}
          aria-hidden="true"
        />

        {/* Moon Icon (Right) */}
        <Moon
          className={`h-3.5 w-3.5 transition-all duration-300 ${
            isDark
              ? 'text-indigo-400 opacity-100 scale-100'
              : 'text-slate-400 opacity-40 scale-90'
          }`}
          aria-hidden="true"
        />
      </div>

      {/* Sliding Knob */}
      <span
        className={`pointer-events-none relative z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-all duration-300 ease-out ${
          isDark
            ? 'translate-x-8 bg-slate-900 border border-slate-600/80 text-indigo-300 shadow-slate-950/60'
            : 'translate-x-0 bg-white border border-slate-200/80 text-amber-500 shadow-slate-400/30'
        }`}
      >
        {isDark ? (
          <Moon className="h-3.5 w-3.5 transition-transform duration-300 rotate-0" />
        ) : (
          <Sun className="h-3.5 w-3.5 transition-transform duration-300 rotate-0" />
        )}
      </span>
    </button>
  );
};
