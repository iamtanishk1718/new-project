import React, { useState, useEffect } from 'react';
import {
  AIRecommendation,
  EnvironmentalTelemetry,
  HabitatProfile,
  RiskAssessmentResult,
} from '../types/habitat';
import {
  Brain,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Clock,
  Shield,
  Layers,
  ArrowRight,
  BookmarkCheck,
} from 'lucide-react';

interface Props {
  recommendations: AIRecommendation[];
  setRecommendations: React.Dispatch<React.SetStateAction<AIRecommendation[]>>;
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  assessment: RiskAssessmentResult;
  onNavigate: (tab: any) => void;
}

export const RecommendationsView: React.FC<Props> = ({
  recommendations,
  setRecommendations,
  telemetry,
  habitat,
  assessment,
  onNavigate,
}) => {
  const [modelChoice, setModelChoice] = useState<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' | 'free-space-ai'>('gemini-4-hydrogen');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeEngineLabel, setActiveEngineLabel] = useState<string>('Free Space AI Engine');
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const fetchRecommendations = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetry,
          habitat,
          assessment,
          modelChoice,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server returned status ${res.status}`);
      }

      if (data.notice) {
        setErrorMsg(data.notice);
      }
      if (data.modelUsed) {
        setActiveEngineLabel(data.modelUsed);
      }
      if (data.recommendations && data.recommendations.length > 0) {
        setRecommendations(data.recommendations);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to reach AI decision server. Displaying verified safety fallback rules.');
      if (recommendations.length === 0) {
        setRecommendations(
          assessment.hazards.map((h, i) => ({
            id: `det-rec-${i}`,
            problem: h.name,
            whyDangerous: h.potentialConsequences.join('; '),
            correctiveActions: h.recommendedActions,
            expectedBenefit: 'Rapid reduction in habitat risk index and restoration of safe crew environment.',
            priority: h.severity === 'extreme' || h.severity === 'critical' ? 'CRITICAL' : 'HIGH',
            urgency: h.severity === 'extreme' ? 'IMMEDIATE' : 'WITHIN_1_HOUR',
            monitoredParameters: h.affectedParameters,
            rationale: 'NASA-STD-3001 Human Integration Design Standards Vol 2',
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recommendations.length === 0) {
      fetchRecommendations();
    }
  }, []);

  const toggleStep = (stepKey: string) => {
    setCompletedSteps((prev) => ({ ...prev, [stepKey]: !prev[stepKey] }));
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-950 text-rose-300 border-rose-600';
      case 'HIGH':
        return 'bg-amber-950 text-amber-300 border-amber-600';
      case 'MEDIUM':
        return 'bg-yellow-950 text-yellow-300 border-yellow-600';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Model Selector */}
      <div className="p-5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" />
            <h1 className="text-base font-bold text-white font-mono uppercase tracking-wide">
              AI Space Safety Decision Support
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Generates intelligent, prioritised engineering corrective actions evaluated against real-time telemetry and NASA flight procedures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Model Choice Picker */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <span className="text-slate-500 text-[10px] uppercase px-2">Model:</span>
            <button
              onClick={() => setModelChoice('gemini-4-hydrogen')}
              className={`px-2.5 py-1 rounded transition-colors ${
                modelChoice === 'gemini-4-hydrogen'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              4 Hydrogen (Free)
            </button>
            <button
              onClick={() => setModelChoice('gemini-3.1-flash-lite')}
              className={`px-2.5 py-1 rounded transition-colors ${
                modelChoice === 'gemini-3.1-flash-lite'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Lite (Free)
            </button>
            <button
              onClick={() => setModelChoice('free-space-ai')}
              className={`px-2.5 py-1 rounded transition-colors ${
                modelChoice === 'free-space-ai'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Free Space AI
            </button>
          </div>

          <button
            onClick={fetchRecommendations}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-semibold font-mono transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Evaluating...' : 'Recalculate Advisor'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-cyan-950/30 border border-cyan-500/40 rounded-lg text-xs text-cyan-200 font-mono flex flex-wrap items-center justify-between gap-2">
          <span>{errorMsg}</span>
          <span className="text-[11px] text-cyan-300 uppercase">Engine: {activeEngineLabel}</span>
        </div>
      )}

      {/* Recommendations Cards */}
      <div className="space-y-4">
        {recommendations.length === 0 && !loading && (
          <div className="p-8 bg-slate-900/60 border border-slate-800 rounded-xl text-center font-mono">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <div className="text-sm text-white font-semibold">No Critical Remediation Required</div>
            <p className="text-xs text-slate-400 mt-1">All environmental parameters are in optimal range.</p>
          </div>
        )}

        {recommendations.map((rec, index) => (
          <div
            key={rec.id || index}
            className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <span
                  className={`px-2.5 py-0.5 rounded text-[11px] font-mono uppercase font-bold border ${getPriorityStyle(
                    rec.priority
                  )}`}
                >
                  {rec.priority} PRIORITY
                </span>
                <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                  Urgency: {rec.urgency.replace('_', ' ')}
                </span>
                <h3 className="text-sm font-bold text-white font-mono">{rec.problem}</h3>
              </div>
            </div>

            {/* Why Dangerous */}
            <div className="mt-3 text-xs leading-relaxed text-slate-300">
              <strong className="font-mono text-rose-400 uppercase text-[11px]">Hazard Rationale: </strong>
              {rec.whyDangerous}
            </div>

            {/* Corrective Actions Checklist */}
            <div className="mt-4 pt-3 border-t border-slate-800">
              <span className="text-[11px] font-mono text-emerald-400 uppercase font-bold block mb-2">
                Prescribed Corrective Action Steps:
              </span>
              <div className="space-y-2">
                {rec.correctiveActions.map((action, stepIdx) => {
                  const stepKey = `${rec.id}-${stepIdx}`;
                  const isChecked = !!completedSteps[stepKey];
                  return (
                    <div
                      key={stepIdx}
                      onClick={() => toggleStep(stepKey)}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-emerald-950/30 border-emerald-800 text-slate-400 line-through'
                          : 'bg-slate-950/70 border-slate-800/80 text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 accent-emerald-500 rounded cursor-pointer"
                      />
                      <span className="font-sans leading-relaxed">{action}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expected Benefit & Monitored Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-800 text-xs font-mono">
              <div>
                <span className="text-[11px] text-cyan-400 uppercase font-bold block mb-1">
                  Expected Benefit:
                </span>
                <div className="text-slate-300 text-[11px] leading-relaxed font-sans">
                  {rec.expectedBenefit}
                </div>
              </div>

              <div>
                <span className="text-[11px] text-amber-400 uppercase font-bold block mb-1">
                  Post-Action Monitored Parameters:
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {rec.monitoredParameters.map((p, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Scientific Rationale Reference */}
            <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-500 flex items-center justify-between">
              <span>Standard: {rec.rationale}</span>
              <span className="text-slate-600">Decision-Support Verified</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
