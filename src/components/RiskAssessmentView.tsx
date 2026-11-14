import React from 'react';
import {
  DetectedHazard,
  EnvironmentalTelemetry,
  HabitatProfile,
  RiskAssessmentResult,
} from '../types/habitat';
import { getScoreAccent, getThresholdParamAccent } from '../lib/telemetryAccent';
import {
  ShieldAlert,
  AlertTriangle,
  Flame,
  Wind,
  Thermometer,
  Radio,
  Zap,
  Activity,
  Layers,
  ArrowRight,
  Brain,
  CheckCircle2,
  Dna,
} from 'lucide-react';

interface Props {
  assessment: RiskAssessmentResult;
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  onNavigate: (tab: any) => void;
}

export const RiskAssessmentView: React.FC<Props> = ({
  assessment,
  telemetry,
  habitat,
  onNavigate,
}) => {
  const getSeverityBadge = (severity: DetectedHazard['severity']) => {
    switch (severity) {
      case 'extreme':
        return 'bg-rose-950 text-rose-300 border-rose-600';
      case 'critical':
        return 'bg-red-950 text-red-300 border-red-600';
      case 'high':
        return 'bg-amber-950 text-amber-300 border-amber-600';
      case 'caution':
        return 'bg-yellow-950 text-yellow-300 border-yellow-600';
      default:
        return 'bg-emerald-950 text-emerald-300 border-emerald-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Risk Header */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              Multi-Parameter AI Risk Assessment Engine
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Deterministic evaluation of cross-parameter correlations, compound system failures, and human life-support survivability envelopes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-500 uppercase block">Calculated Risk Index</span>
            <span
              className={`text-2xl font-bold font-mono tabular-nums ${
                assessment.overallRiskScore > 60
                  ? 'text-rose-400'
                  : assessment.overallRiskScore > 30
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {assessment.overallRiskScore} / 100
            </span>
          </div>
          <button
            onClick={() => onNavigate('environment')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-mono transition-colors whitespace-nowrap"
          >
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Configure Thresholds</span>
          </button>
          <button
            onClick={() => onNavigate('recommendations')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg text-xs font-semibold font-mono transition-colors whitespace-nowrap"
          >
            <Brain className="w-4 h-4" />
            <span>Generate AI Safety Plan</span>
          </button>
        </div>
      </div>

      {/* Correlation Matrix & Category Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(assessment.categoryScores).map(([cat, score]) => {
          const catAccent = getScoreAccent(score, false);
          return (
            <div
              key={cat}
              className={`bg-slate-900/90 border rounded-xl p-3 flex flex-col justify-between transition-colors duration-300 ${catAccent.cardSurface}`}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 truncate">
                {cat}
              </span>
              <div className="flex items-baseline gap-1 my-1">
                <span className={`text-xl font-bold font-mono tabular-nums transition-colors duration-300 ${catAccent.valueText}`}>
                  {score}
                </span>
                <span className="text-[10px] font-mono text-slate-500">/ 100</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${catAccent.barFill}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Live 5-Tier Parameter Threshold Evaluations */}
      {assessment.parameterEvaluations && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
              Configured {habitat.type.toUpperCase()} 5-Tier Parameter Threshold Status
            </h2>
            <span className="text-[11px] font-mono text-slate-400">
              Profile: {habitat.name}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
            {Object.values(assessment.parameterEvaluations).map((ev) => {
              const paramAccent = getThresholdParamAccent(ev.value, habitat.thresholds[ev.key]);
              const badgeCls =
                paramAccent.tone === 'red'
                  ? 'bg-red-950 text-red-300 border-red-600'
                  : paramAccent.tone === 'amber'
                  ? 'bg-amber-950 text-amber-300 border-amber-500'
                  : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/60';
              return (
                <div
                  key={ev.key}
                  className={`bg-slate-950/80 border rounded-lg p-3 flex flex-col justify-between gap-1.5 transition-colors duration-300 ${paramAccent.cardSurface}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-300 truncate">{ev.label}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase border ${badgeCls}`}>
                      {ev.tier === 'normal' ? paramAccent.statusLabel : ev.tier.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px]">
                    <span className={`font-bold tabular-nums transition-colors duration-300 ${paramAccent.valueText}`}>
                      {ev.value} {ev.unit}
                    </span>
                    <span className="text-slate-500 tabular-nums">
                      Normal: {ev.normalBounds.lower}–{ev.normalBounds.upper}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detected Hazards List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>Identified Compound Hazards ({assessment.hazards.length})</span>
          </h2>
          <span className="text-xs font-mono text-slate-500">
            Multi-Parameter Correlated Failures
          </span>
        </div>

        {assessment.hazards.length === 0 ? (
          <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white font-mono">
              All Habitat Subsystems Nominal
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              No cross-parameter compound hazards detected. Cabin atmospheric, thermal, life-support, and radiation metrics remain within NASA-STD-3001 baseline limits.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {assessment.hazards.map((hazard) => (
              <div
                key={hazard.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-mono uppercase font-bold border ${getSeverityBadge(
                        hazard.severity
                      )}`}
                    >
                      {hazard.severity}
                    </span>
                    <h3 className="text-sm font-bold text-white font-mono">{hazard.name}</h3>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-slate-400">
                      Likelihood: <strong className="text-white">{hazard.likelihood}%</strong>
                    </span>
                    <span className="text-slate-400">
                      Hazard Score: <strong className="text-rose-400">{hazard.score} / 100</strong>
                    </span>
                  </div>
                </div>

                {/* Explanation */}
                <div className="mt-3 text-xs text-slate-300 leading-relaxed font-sans">
                  <strong className="font-mono text-cyan-400 uppercase text-[11px]">Detection Rationale: </strong>
                  {hazard.explanation}
                </div>

                {/* Affected Parameters Chips */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-mono text-slate-400">Affected Parameters:</span>
                  {hazard.affectedParameters.map((param, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800"
                    >
                      {param}
                    </span>
                  ))}
                </div>

                {/* Consequences & Corrective Actions Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[11px] text-rose-400 uppercase font-bold block mb-1">
                      Potential Consequences:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
                      {hazard.potentialConsequences.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-[11px] text-emerald-400 uppercase font-bold block mb-1">
                      Immediate Corrective Actions:
                    </span>
                    <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                      {hazard.recommendedActions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Space Bioscience & Human Physiology Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Dna className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 font-mono">
            Spaceflight Human Biology & Cellular Pathway Telemetry
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 uppercase block mb-1">HYPOXIC STRESS STATUS</span>
            <div className="text-sm font-bold text-white mb-1">
              Risk: <span className="uppercase text-cyan-400">{assessment.bioscienceImpacts.hypoxiaRisk}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              Evaluates alveolar O2 partial pressure against the Hill equation to project hemoglobin SpO2 saturation.
            </p>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 uppercase block mb-1">CO2 HYPERCAPNIA TOLERANCE</span>
            <div className="text-sm font-bold text-white mb-1">
              Risk: <span className="uppercase text-amber-400">{assessment.bioscienceImpacts.hypercapniaRisk}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              NASA-STD-3001 guideline: CO2 levels above 3,800 ppm correlate with astronaut headache and microvascular cerebral dilation.
            </p>
          </div>

          <div className="bg-slate-950/80 p-3.5 rounded-lg border border-slate-800">
            <span className="text-slate-400 uppercase block mb-1">IONIZING RADIATION DAMAGE</span>
            <div className="text-sm font-bold text-white mb-1">
              Tier: <span className="uppercase text-purple-400">{assessment.bioscienceImpacts.radiationRiskDoseTier}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
              ATM/Rad51 double-strand break repair response active under ambient space ionizing flux.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
