import React from 'react';
import type { IntegrationId } from '../types/integrations';

interface Props {
  id: IntegrationId;
  className?: string;
}

const ACCENTS: Record<IntegrationId, { bg: string; border: string; text: string }> = {
  telegram: { bg: 'bg-sky-500/15', border: 'border-sky-500/40', text: 'text-sky-400' },
  discord: { bg: 'bg-indigo-500/15', border: 'border-indigo-500/40', text: 'text-indigo-400' },
  slack: { bg: 'bg-fuchsia-500/15', border: 'border-fuchsia-500/40', text: 'text-fuchsia-300' },
  trello: { bg: 'bg-blue-500/15', border: 'border-blue-500/40', text: 'text-blue-400' },
  home_assistant: { bg: 'bg-sky-500/15', border: 'border-sky-400/40', text: 'text-sky-300' },
  esp32_iot: { bg: 'bg-violet-500/15', border: 'border-violet-500/40', text: 'text-violet-300' },
  github: { bg: 'bg-slate-400/15', border: 'border-slate-500/40', text: 'text-slate-200' },
};

export const IntegrationLogo: React.FC<Props> = ({ id, className = 'w-10 h-10' }) => {
  const style = ACCENTS[id] || ACCENTS.github;

  const renderGlyph = () => {
    switch (id) {
      case 'telegram':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M21 4L3 11.5l6.5 2.3L18 7l-6.2 8.2 5.2 4.3L21 4z" />
          </svg>
        );
      case 'discord':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8.5 6.5C10.5 5.8 13.5 5.8 15.5 6.5l3 1.5c1.2 2.5 1.5 6 .5 9l-3.2 1.5-1.3-1.7c-1.6.4-3.4.4-5 0L8.2 18.5 5 17c-1-3-.7-6.5.5-9l3-1.5z" />
            <circle cx="9.5" cy="12" r="1" fill="currentColor" />
            <circle cx="14.5" cy="12" r="1" fill="currentColor" />
          </svg>
        );
      case 'slack':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 15a2 2 0 1 1-2-2h2v2zm1 0a2 2 0 0 1 4 0v5a2 2 0 1 1-4 0v-5z" />
            <path d="M9 6a2 2 0 1 1 2-2v2H9zm0 1a2 2 0 0 1 0 4H4a2 2 0 1 1 0-4h5z" />
            <path d="M18 9a2 2 0 1 1 2 2h-2V9zm-1 0a2 2 0 0 1-4 0V4a2 2 0 1 1 4 0v5z" />
            <path d="M15 18a2 2 0 1 1-2 2v-2h2zm0-1a2 2 0 0 1 0-4h5a2 2 0 1 1 0 4h-5z" />
          </svg>
        );
      case 'trello':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
            <rect x="3" y="4" width="18" height="16" rx="2.5" />
            <rect x="6.5" y="7.5" width="4" height="9" rx="1" />
            <rect x="13.5" y="7.5" width="4" height="5.5" rx="1" />
          </svg>
        );
      case 'home_assistant':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9z" />
            <path d="M12 20v-7M12 13l-3-2M12 15l3-2" />
          </svg>
        );
      case 'esp32_iot':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="7" y="7" width="10" height="10" rx="1.5" />
            <path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4" />
          </svg>
        );
      case 'github':
        return (
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 19v-2.2c-2.5.5-3-1.2-3-1.2-.4-1-1-1.3-1-1.3-.8-.5.1-.5.1-.5.9.1 1.4.9 1.4.9.8 1.3 2.1.9 2.6.7.1-.6.3-1 .6-1.2-2-.2-4-1-4-4.3 0-1 .3-1.8.9-2.4-.1-.2-.4-1.1.1-2.3 0 0 .7-.2 2.4.9a8.4 8.4 0 0 1 4.4 0c1.7-1.1 2.4-.9 2.4-.9.5 1.2.2 2.1.1 2.3.6.6.9 1.4.9 2.4 0 3.3-2 4.1-4 4.3.3.3.6.8.6 1.7V19" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`rounded-xl border flex items-center justify-center shrink-0 ${style.bg} ${style.border} ${style.text} ${className}`}
      aria-hidden="true"
    >
      {renderGlyph()}
    </div>
  );
};
