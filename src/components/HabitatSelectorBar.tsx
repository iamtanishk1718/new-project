import React from 'react';
import { HabitatProfile, HabitatType } from '../types/habitat';
import { HABITAT_ANIMATION_META } from '../lib/habitatScenesBuilder';
import { Orbit, Sparkles } from 'lucide-react';

interface Props {
  activeType: HabitatType;
  habitatProfiles: Record<HabitatType, HabitatProfile>;
  onSelectHabitat: (type: HabitatType) => void;
  title?: string;
}

const ORDERED_TYPES: HabitatType[] = [
  'iss',
  'lunar',
  'mars',
  'spacecraft',
  'rover',
  'module',
  'custom',
];

export const HabitatSelectorBar: React.FC<Props> = ({
  activeType,
  habitatProfiles,
  onSelectHabitat,
  title = 'Select Space Habitat & Live 3D Digital Twin',
}) => {
  return (
    <div
      className="panel-surface rounded-xl p-3.5"
      data-testid="habitat-selector-bar"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Orbit className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{HABITAT_ANIMATION_META[activeType].animationSummary}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {ORDERED_TYPES.map((type) => {
          const profile = habitatProfiles[type];
          const meta = HABITAT_ANIMATION_META[type];
          const isSelected = activeType === type;
          return (
            <button
              key={type}
              type="button"
              data-habitat-option={type}
              aria-pressed={isSelected}
              onClick={() => onSelectHabitat(type)}
              className={`px-3 py-2 rounded-lg border text-left transition-all ${
                isSelected
                  ? 'bg-[#0d192b] border-cyan-400/80 text-white shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                  : 'bg-[#060912] border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold truncate">{meta.shortName}</span>
                <span className={`text-[9px] font-mono uppercase shrink-0 ${isSelected ? 'text-cyan-300' : 'text-slate-500'}`}>
                  {type}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                {meta.animationSummary}
              </div>
              <div className="text-[9px] font-mono text-slate-500 truncate mt-0.5 tabular-nums">
                {profile.volumeM3} m³ · {profile.activeOccupants}/{profile.maxOccupancy} crew
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
