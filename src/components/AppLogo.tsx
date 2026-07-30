import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
}) => {
  const sizeMap = {
    sm: { box: 'w-7 h-7', icon: 'w-4 h-4', text: 'text-sm' },
    md: { box: 'w-8 h-8 sm:w-9 sm:h-9', icon: 'w-5 h-5', text: 'text-base sm:text-lg' },
    lg: { box: 'w-11 h-11', icon: 'w-6 h-6', text: 'text-xl' },
    xl: { box: 'w-16 h-16', icon: 'w-9 h-9', text: 'text-2xl sm:text-3xl' },
  };

  const currentSize = sizeMap[size];

  return (
    <div className={`flex items-center space-x-2.5 ${className}`}>
      {/* Logo Emblem Badge - Blend of Italian & British flag colors */}
      <div
        className={`${currentSize.box} rounded-xl bg-slate-950 border border-slate-700/80 shadow-lg flex items-center justify-center shrink-0 relative overflow-hidden group transition-all duration-300 hover:border-slate-500 hover:shadow-indigo-500/20`}
      >
        {/* Italian to UK Flag Gradient Border Accent Glow */}
        <div className="absolute inset-0 p-[1px] rounded-xl bg-gradient-to-r from-emerald-500 via-rose-500 to-blue-600 opacity-70 group-hover:opacity-100 transition-opacity">
          <div className="w-full h-full bg-slate-950 rounded-[11px]" />
        </div>

        {/* Subtle background ambient glow blending Green -> Red -> Blue */}
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-rose-500/10 to-blue-600/20 opacity-80 group-hover:opacity-100 transition-opacity" />

        {/* Custom SVG Logo Icon: Speech Bubble + Soundwave Bridge + Flag Fusion */}
        <svg
          className={`${currentSize.icon} relative z-10 transition-transform duration-300 group-hover:scale-105`}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* IT to UK Flag Gradient for Bubble Outline */}
            <linearGradient id="itUkGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />   {/* Italian Green */}
              <stop offset="30%" stopColor="#f8fafc" />  {/* White */}
              <stop offset="65%" stopColor="#ef4444" />  {/* Italian / UK Red */}
              <stop offset="100%" stopColor="#2563eb" /> {/* UK Royal Blue */}
            </linearGradient>

            <linearGradient id="itBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            <linearGradient id="ukBarGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>

          {/* Speech bubble outline with Italian -> British gradient */}
          <path
            d="M16 4C9.37258 4 4 8.92487 4 15C4 18.2588 5.53051 21.1824 8.00067 23.1894C7.45869 25.107 6.32626 26.8373 4.67578 28.0264C4.38555 28.2355 4.54019 28.7 4.9 28.7C8.5 28.7 11.5 26.8 13.5 25.4C14.3053 25.7909 15.1384 26 16 26C22.6274 26 28 21.0751 28 15C28 8.92487 22.6274 4 16 4Z"
            stroke="url(#itUkGrad)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Soundwave Bars: Green (IT) -> White -> Red -> Royal Blue (UK) */}
          <line x1="10.5" y1="12" x2="10.5" y2="18" stroke="url(#itBarGrad)" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="14" y1="10" x2="14" y2="20" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          <line x1="17.5" y1="8" x2="17.5" y2="22" stroke="#f43f5e" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="21" y1="11" x2="21" y2="19" stroke="url(#ukBarGrad)" strokeWidth="2.2" strokeLinecap="round" />

          {/* AI Spark Star top right in Union Jack White/Blue accent */}
          <path
            d="M24 7L24.7 8.3L26 9L24.7 9.7L24 11L23.3 9.7L22 9L23.3 8.3L24 7Z"
            fill="#38bdf8"
          />
        </svg>
      </div>

      {/* Brand Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`font-bold tracking-tight text-slate-100 ${currentSize.text} leading-tight flex items-center gap-1.5`}>
            <span>Madrelingua</span>
            <span className="bg-gradient-to-r from-emerald-400 via-rose-400 to-sky-400 bg-clip-text text-transparent font-extrabold">
              AI
            </span>
          </span>
          {size === 'xl' && (
            <span className="text-xs text-slate-400 font-medium tracking-wide">
              Voice Studio & Personal English Coach
            </span>
          )}
        </div>
      )}
    </div>
  );
};
