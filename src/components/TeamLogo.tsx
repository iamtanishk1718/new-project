import React, { useState } from 'react';

interface Props {
  className?: string;
  glow?: boolean;
}

export const TeamLogo: React.FC<Props> = ({ className = 'w-9 h-9', glow = true }) => {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        className={`${className} rounded-full bg-slate-900 border border-amber-400/50 text-amber-300 font-display text-sm font-bold inline-flex items-center justify-center shrink-0`}
        aria-label="Team Tejasvi Logo"
      >
        T
      </span>
    );
  }

  return (
    <img
      src="/assets/aistudio/ss_7087d4c4.jpg"
      alt="Team Tejasvi Logo"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} rounded-full object-cover border border-amber-400/40 shrink-0 ${
        glow ? 'ring-1 ring-cyan-400/25 shadow-[0_0_18px_rgba(34,211,238,0.14)]' : ''
      }`}
    />
  );
};
