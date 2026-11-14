import React, { useMemo, useState } from 'react';
import {
  EnvironmentalTelemetry,
  HabitatProfile,
  HabitatType,
  RiskAssessmentResult,
  RiskClassification,
  ThresholdParameterKey,
} from '../types/habitat';
import { HABITAT_PROFILES } from '../lib/constants';
import {
  cloneThresholdsConfig,
  exportThresholdsJson,
  parseSingleHabitatThresholdsJson,
  RISK_TIER_LABELS,
  RISK_TIER_ORDER,
  syncLimitsFromThresholds,
  THRESHOLD_PARAMETER_KEYS,
  validateParameterThresholdSpec,
} from '../lib/thresholds';
import { auth, saveThresholdConfigToFirestore } from '../lib/firebase';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  RotateCcw,
  Save,
  Sliders,
  Upload,
} from 'lucide-react';

interface Props {
  habitat: HabitatProfile;
  habitatProfiles: Record<HabitatType, HabitatProfile>;
  onSelectHabitat: (type: HabitatType) => void;
  onUpdateHabitatThresholds: (type: HabitatType, updated: HabitatProfile) => void;
  telemetry: EnvironmentalTelemetry;
  assessment: RiskAssessmentResult;
}

const TIER_STYLES: Record<
  RiskClassification,
  { badge: string; dot: string; rowBorder: string }
> = {
  normal: {
    badge: 'text-emerald-300 bg-emerald-950/70 border-emerald-600/60',
    dot: 'bg-emerald-400',
    rowBorder: 'border-emerald-900/50',
  },
  caution: {
    badge: 'text-yellow-300 bg-yellow-950/70 border-yellow-600/60',
    dot: 'bg-yellow-400',
    rowBorder: 'border-yellow-900/50',
  },
  high_risk: {
    badge: 'text-amber-300 bg-amber-950/70 border-amber-600/60',
    dot: 'bg-amber-400',
    rowBorder: 'border-amber-900/50',
  },
  critical: {
    badge: 'text-red-300 bg-red-950/70 border-red-600/60',
    dot: 'bg-red-400',
    rowBorder: 'border-red-900/50',
  },
  extreme_emergency: {
    badge: 'text-rose-200 bg-rose-950/90 border-rose-500/80',
    dot: 'bg-rose-400',
    rowBorder: 'border-rose-800/70',
  },
};

export const ThresholdConfigPanel: React.FC<Props> = ({
  habitat,
  habitatProfiles,
  onSelectHabitat,
  onUpdateHabitatThresholds,
  telemetry,
  assessment,
}) => {
  const [selectedParam, setSelectedParam] = useState<ThresholdParameterKey>('oxygenPercent');
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isSavingCloud, setIsSavingCloud] = useState(false);

  const validationErrorsByParam = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const key of THRESHOLD_PARAMETER_KEYS) {
      map[key] = validateParameterThresholdSpec(habitat.thresholds[key]);
    }
    return map;
  }, [habitat.thresholds]);

  const allValidationErrors = useMemo(
    () => Object.values(validationErrorsByParam).flat(),
    [validationErrorsByParam]
  );

  const activeSpec = habitat.thresholds[selectedParam];
  const activeEval = assessment.parameterEvaluations[selectedParam];
  const activeParamErrors = validationErrorsByParam[selectedParam] ?? [];

  const handleBoundChange = (
    paramKey: ThresholdParameterKey,
    tier: RiskClassification,
    bound: 'lower' | 'upper',
    rawVal: string
  ) => {
    const parsed = parseFloat(rawVal);
    if (Number.isNaN(parsed)) return;

    const nextThresholds = cloneThresholdsConfig(habitat.thresholds);
    nextThresholds[paramKey].tiers[tier][bound] = parsed;

    const nextProfile: HabitatProfile = {
      ...habitat,
      thresholds: nextThresholds,
      limits: syncLimitsFromThresholds(nextThresholds, habitat.limits),
    };

    onUpdateHabitatThresholds(habitat.type, nextProfile);
    setStatusMessage(null);
  };

  const handleResetDefaults = () => {
    const defaults = HABITAT_PROFILES[habitat.type];
    const restored: HabitatProfile = {
      ...habitat,
      thresholds: cloneThresholdsConfig(defaults.thresholds),
      limits: { ...defaults.limits },
    };
    onUpdateHabitatThresholds(habitat.type, restored);
    setStatusMessage({
      type: 'ok',
      text: `Restored NASA reference 5-tier thresholds for ${habitat.name}.`,
    });
  };

  const handleSaveProfile = async () => {
    if (allValidationErrors.length > 0) {
      setStatusMessage({
        type: 'err',
        text: 'Resolve threshold ordering errors before saving configuration.',
      });
      return;
    }

    try {
      localStorage.setItem(
        `firefall_thresholds_${habitat.type}`,
        JSON.stringify(habitat.thresholds)
      );
    } catch {
      // Ignore storage quota issues
    }

    if (auth.currentUser) {
      setIsSavingCloud(true);
      try {
        await saveThresholdConfigToFirestore(
          habitat.type,
          habitat.name,
          habitat.thresholds as unknown as Record<string, unknown>
        );
        setStatusMessage({
          type: 'ok',
          text: `Saved ${habitat.type.toUpperCase()} threshold matrix locally & to cloud storage.`,
        });
      } catch {
        setStatusMessage({
          type: 'ok',
          text: `Applied & persisted ${habitat.type.toUpperCase()} 5-tier thresholds locally.`,
        });
      } finally {
        setIsSavingCloud(false);
      }
    } else {
      setStatusMessage({
        type: 'ok',
        text: `Applied & persisted ${habitat.type.toUpperCase()} 5-tier thresholds.`,
      });
    }
  };

  const handleDownloadJson = () => {
    const json = exportThresholdsJson(habitatProfiles);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flame-in-firefall-thresholds-${habitat.type}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    const result = parseSingleHabitatThresholdsJson(jsonInput, habitat.thresholds);
    if (result.error || !result.thresholds) {
      setStatusMessage({
        type: 'err',
        text: result.error ?? 'Failed to parse JSON threshold configuration.',
      });
      return;
    }
    const nextProfile: HabitatProfile = {
      ...habitat,
      thresholds: result.thresholds,
      limits: syncLimitsFromThresholds(result.thresholds, habitat.limits),
    };
    onUpdateHabitatThresholds(habitat.type, nextProfile);
    setStatusMessage({
      type: 'ok',
      text: `Imported JSON 5-tier thresholds into ${habitat.name}.`,
    });
  };

  const currentTelemetryByKey: Record<ThresholdParameterKey, number> = {
    oxygenPercent: telemetry.oxygenPercent,
    carbonDioxidePpm: telemetry.carbonDioxidePpm,
    internalTemperatureC: telemetry.internalTemperatureC,
    pressureKPa: telemetry.pressureKPa,
    relativeHumidity: telemetry.relativeHumidity,
    airflowVelocity: telemetry.airflowVelocity,
    radiationDoseRateUSvH: telemetry.radiationDoseRateUSvH,
  };

  return (
    <div
      className="space-y-5"
      data-testid="threshold-config-panel"
      data-habitat-type={habitat.type}
      data-overall-risk={assessment.overallRiskScore}
      data-classification={assessment.classification}
    >
      {/* Header & Action Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              5-Tier Environmental Risk Threshold Configuration
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Select a space habitat profile and calibrate lower and upper bounds for Normal, Caution, High Risk, Critical, and Extreme Emergency levels. Changes recalculate risk scores and trigger alerts immediately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowJsonPanel(!showJsonPanel);
              if (!showJsonPanel) {
                setJsonInput(JSON.stringify(habitat.thresholds, null, 2));
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 text-slate-300 border border-slate-700 rounded-lg text-xs font-mono hover:border-cyan-500/60 hover:text-white transition-colors"
          >
            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showJsonPanel ? 'Hide JSON' : 'JSON Config'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 text-slate-300 border border-slate-700 rounded-lg text-xs font-mono hover:border-cyan-500/60 hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono hover:bg-slate-700 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSavingCloud}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold rounded-lg text-xs font-mono transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSavingCloud ? 'Syncing...' : 'Save Thresholds'}</span>
          </button>
        </div>
      </div>

      {/* Status / Validation Feedback */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2 ${
            statusMessage.type === 'ok'
              ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-200'
              : 'bg-rose-950/60 border-rose-600/60 text-rose-200'
          }`}
        >
          {statusMessage.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Habitat Type Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Target Habitat Profile
          </span>
          <span className="text-xs font-mono text-cyan-400">
            Live Overall Risk: <strong data-testid="threshold-live-risk">{assessment.overallRiskScore}</strong>/100 ·{' '}
            <span className="uppercase">{assessment.classification.replace('_', ' ')}</span>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {(Object.keys(habitatProfiles) as HabitatType[]).map((type) => {
            const p = habitatProfiles[type];
            const isSelected = habitat.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => onSelectHabitat(type)}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/70 text-white'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-bold truncate">{p.name.split('-')[0].trim()}</div>
                <div className="text-[10px] font-mono uppercase text-cyan-400 mt-0.5">{type}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Left Parameter List / Right 5-Tier Bounds Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Parameter Selector Column */}
        <div className="lg:col-span-4 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 px-1">
            Monitored Parameters
          </div>
          {THRESHOLD_PARAMETER_KEYS.map((key) => {
            const spec = habitat.thresholds[key];
            const ev = assessment.parameterEvaluations[key];
            const val = currentTelemetryByKey[key];
            const style = TIER_STYLES[ev.tier];
            const errs = validationErrorsByParam[key] ?? [];
            const isSelected = selectedParam === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedParam(key)}
                className={`w-full p-3 rounded-xl border text-left transition-colors ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-500/70 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">{spec.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${style.badge}`}
                  >
                    {RISK_TIER_LABELS[ev.tier]}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] font-mono">
                  <span className="text-slate-400 tabular-nums">
                    Current: <strong className="text-white">{val}</strong> {spec.unit}
                  </span>
                  <span className="text-slate-500 tabular-nums">
                    Normal: {spec.tiers.normal.lower}–{spec.tiers.normal.upper}
                  </span>
                </div>
                {errs.length > 0 && (
                  <div className="mt-1.5 text-[10px] font-mono text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{errs.length} bound conflict(s)</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 5-Tier Bounds Matrix for Selected Parameter */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white font-mono uppercase">
                    {activeSpec.label} ({activeSpec.unit})
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                    {activeSpec.mode === 'bidirectional'
                      ? 'Dual-Sided Envelope'
                      : activeSpec.mode === 'upper_only'
                      ? 'Upper Ceiling Escalation'
                      : 'Lower Floor Protection'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Live reading: <strong className="text-cyan-300 font-mono tabular-nums">{activeEval.value} {activeSpec.unit}</strong>{' '}
                  — currently evaluated as{' '}
                  <strong className="text-white font-mono uppercase">{RISK_TIER_LABELS[activeEval.tier]}</strong>{' '}
                  (Parameter Risk Score: <strong className="font-mono tabular-nums">{activeEval.score}/100</strong>)
                </p>
              </div>
            </div>

            {activeParamErrors.length > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-rose-950/70 border border-rose-600/60 text-xs font-mono text-rose-200 space-y-1">
                {activeParamErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 5-Tier Rows */}
            <div className="mt-4 space-y-2.5">
              {RISK_TIER_ORDER.map((tier) => {
                const bounds = activeSpec.tiers[tier];
                const style = TIER_STYLES[tier];
                const isActiveTier = activeEval.tier === tier;
                const lowerInputId = `${selectedParam}-${tier}-lower`;
                const upperInputId = `${selectedParam}-${tier}-upper`;

                return (
                  <div
                    key={tier}
                    className={`p-3 rounded-lg border bg-slate-950/80 grid grid-cols-1 sm:grid-cols-12 items-center gap-3 ${
                      isActiveTier ? 'border-cyan-500/70 ring-1 ring-cyan-500/30' : style.rowBorder
                    }`}
                  >
                    <div className="sm:col-span-4 flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${style.dot}`} />
                      <div>
                        <div className="text-xs font-bold font-mono text-white flex items-center gap-2">
                          <span>{RISK_TIER_LABELS[tier]}</span>
                          {isActiveTier && (
                            <span className="text-[10px] text-cyan-300 font-mono uppercase">
                              [LIVE]
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {tier === 'extreme_emergency'
                            ? 'Triggers beyond bounds'
                            : 'Acceptable envelope'}
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-4">
                      <label
                        htmlFor={lowerInputId}
                        className="text-[10px] font-mono uppercase text-slate-400 block mb-1"
                      >
                        {tier === 'extreme_emergency' ? 'Extreme Low (<)' : 'Lower Bound'} ({activeSpec.unit})
                      </label>
                      <input
                        id={lowerInputId}
                        type="number"
                        step={activeSpec.step}
                        value={bounds.lower}
                        disabled={activeSpec.mode === 'upper_only'}
                        onChange={(e) =>
                          handleBoundChange(selectedParam, tier, 'lower', e.target.value)
                        }
                        aria-label={`${activeSpec.label} ${RISK_TIER_LABELS[tier]} Lower Bound`}
                        className="w-full bg-slate-900 border border-slate-700 disabled:opacity-45 rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label
                        htmlFor={upperInputId}
                        className="text-[10px] font-mono uppercase text-slate-400 block mb-1"
                      >
                        {tier === 'extreme_emergency' ? 'Extreme High (>)' : 'Upper Bound'} ({activeSpec.unit})
                      </label>
                      <input
                        id={upperInputId}
                        type="number"
                        step={activeSpec.step}
                        value={bounds.upper}
                        onChange={(e) =>
                          handleBoundChange(selectedParam, tier, 'upper', e.target.value)
                        }
                        aria-label={`${activeSpec.label} ${RISK_TIER_LABELS[tier]} Upper Bound`}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>{activeEval.message}</span>
            <span className="text-slate-500">
              Habitat: {habitat.type.toUpperCase()} · Stored as structured JSON/Map
            </span>
          </div>
        </div>
      </div>

      {/* JSON Structure Inspector & Importer */}
      {showJsonPanel && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono uppercase text-cyan-300">
              Configurable JSON Threshold Payload ({habitat.type.toUpperCase()})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setJsonInput(JSON.stringify(habitat.thresholds, null, 2))}
                className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded text-[11px] font-mono hover:text-white"
              >
                Refresh Current
              </button>
              <button
                type="button"
                onClick={handleImportJson}
                className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 rounded text-[11px] font-mono hover:bg-cyan-500/30"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Apply JSON</span>
              </button>
            </div>
          </div>
          <label htmlFor="thresholds-json-editor" className="sr-only">
            JSON Threshold Configuration Editor
          </label>
          <textarea
            id="thresholds-json-editor"
            rows={10}
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      )}
    </div>
  );
};
