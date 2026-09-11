import React from "react";

interface LogoProps {
  size?: number;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 48, className = "" }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Rounded square background with warm gradient */}
    <rect x="0" y="0" width="120" height="120" rx="30" fill="url(#bg-grad)" />

    {/* Speech bubble shape — the coach */}
    <rect x="22" y="24" width="76" height="54" rx="14" fill="white" fillOpacity="0.95" />
    <path d="M38 78L30 96L52 78" fill="white" fillOpacity="0.95" />

    {/* "EN" text inside the bubble — English coach identity */}
    <text
      x="60"
      y="60"
      textAnchor="middle"
      dominantBaseline="central"
      fontFamily="system-ui, -apple-system, sans-serif"
      fontWeight="800"
      fontSize="30"
      letterSpacing="-1"
      fill="url(#text-grad)"
    >
      EN
    </text>

    {/* Small sound waves — voice assistant indicator */}
    <path
      d="M86 42C89 42 92 45 92 51C92 57 89 60 86 60"
      stroke="url(#text-grad)"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.7"
    />
    <path
      d="M90 37C95 37 100 43 100 51C100 59 95 65 90 65"
      stroke="url(#text-grad)"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
      opacity="0.4"
    />

    <defs>
      <linearGradient id="bg-grad" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F59E0B" />
        <stop offset="0.5" stopColor="#D97706" />
        <stop offset="1" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="text-grad" x1="30" y1="30" x2="95" y2="75" gradientUnits="userSpaceOnUse">
        <stop stopColor="#B45309" />
        <stop offset="1" stopColor="#92400E" />
      </linearGradient>
    </defs>
  </svg>
);

export const LogoMark: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <Logo size={44} />
    <div>
      <div className="text-xl font-bold text-primary tracking-tight leading-tight">Madrelingua</div>
      <div className="text-xs text-muted font-medium -mt-0.5">English Coach</div>
    </div>
  </div>
);
