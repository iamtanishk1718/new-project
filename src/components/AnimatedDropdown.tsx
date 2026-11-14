import React, { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'cyan';
  hint?: string;
}

interface Props<T extends string = string> {
  label?: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  testId?: string;
}

const TONE_DOT: Record<NonNullable<DropdownOption['tone']>, string> = {
  emerald: 'bg-emerald-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  cyan: 'bg-cyan-400',
};

export function AnimatedDropdown<T extends string = string>({
  label,
  value,
  options,
  onChange,
  testId,
}: Props<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => o.value === value))
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const prefersReducedMotion = useReducedMotion();

  const activeOption = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const idx = options.findIndex((o) => o.value === value);
    if (idx >= 0) setHighlightedIndex(idx);
  }, [value, options]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) => (prev + 1) % options.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      if (isOpen) {
        e.preventDefault();
        const chosen = options[highlightedIndex];
        if (chosen) {
          onChange(chosen.value);
          setIsOpen(false);
        }
      }
    }
  };

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      {label && (
        <span className="text-[11px] font-mono text-slate-400 block mb-1">
          {label}
        </span>
      )}

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between gap-2 bg-slate-950 border rounded-lg px-3 py-2 text-xs font-mono text-white transition-colors focus:outline-none ${
          isOpen
            ? 'border-cyan-400 ring-1 ring-cyan-500/30'
            : 'border-slate-800 hover:border-slate-600'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {activeOption?.tone && (
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[activeOption.tone]}`}
              aria-hidden="true"
            />
          )}
          <span className="truncate">{activeOption?.label}</span>
        </span>

        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 360, damping: 24 }
          }
          className="text-cyan-400 shrink-0 flex items-center"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            id={listboxId}
            role="listbox"
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -8, scaleY: 0.9, filter: 'blur(4px)' }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, y: 0, scaleY: 1, filter: 'blur(0px)' }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, y: -6, scaleY: 0.92, filter: 'blur(3px)' }
            }
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'top center' }}
            className="absolute left-0 right-0 mt-1.5 z-50 bg-[#090b10] border border-cyan-500/40 rounded-lg shadow-2xl p-1 space-y-0.5 overflow-hidden"
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <motion.li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { delay: idx * 0.035, duration: 0.16, ease: [0.16, 1, 0.3, 1] }
                  }
                >
                  <button
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-left text-xs font-mono transition-transform duration-150 ${
                      isSelected
                        ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/35'
                        : isHighlighted
                        ? 'bg-slate-900 text-white translate-x-0.5'
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {opt.tone && (
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${TONE_DOT[opt.tone]}`}
                          aria-hidden="true"
                        />
                      )}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
