import React, { useState } from 'react';
import {
  SelfHealingPermissionStatus,
  SelfHealingPlan,
} from '../types/habitat';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
  AlertTriangle,
  Activity,
  X,
} from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SelfHealingPermissionStatus;
  plan: SelfHealingPlan | null;
  progress: number;
  sessionAutoHealPermitted: boolean;
  onGrantPermission: (rememberForSession: boolean) => void;
  onDenyPermission: () => void;
  onAbortExecution: () => void;
}

export const SelfHealingModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  status,
  plan,
  progress,
  sessionAutoHealPermitted,
  onGrantPermission,
  onDenyPermission,
  onAbortExecution,
}) => {
  const [rememberForSession, setRememberForSession] = useState(sessionAutoHealPermitted);

  if (!isOpen || !plan) return null;

  const pct = Math.min(100, Math.round(progress * 100));

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      data-testid="self-healing-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="self-healing-modal-title"
    >
      <div className="w-full max-w-2xl bg-[#070b14] border border-teal-500/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-rose-950/70 via-slate-900 to-teal-950/60 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300">
              {status === 'executing' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : status === 'completed' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-teal-300">
                Autonomous ECLSS & Structural Recovery System
              </div>
              <h2 id="self-healing-modal-title" className="text-base font-bold text-white font-mono">
                {status === 'executing'
                  ? 'Executing Staged Self-Healing Sequence...'
                  : status === 'completed'
                  ? 'Self-Healing Sequence Completed'
                  : 'Alarm Hit — Permission Required for Self-Healing'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Self-Healing Dialog"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Context Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">ACTIVE HABITAT</span>
              <span className="text-white font-semibold truncate block mt-0.5">{plan.habitatName}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">TRIGGER CLASSIFICATION</span>
              <span className="text-rose-300 font-bold uppercase block mt-0.5">
                {plan.classification.replace('_', ' ')} ({plan.riskScore}/100)
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-500 block">EST. RECOVERY TIME</span>
              <span className="text-teal-300 font-bold tabular-nums block mt-0.5">
                {plan.estimatedDurationSec} seconds ({plan.steps.length} stages)
              </span>
            </div>
          </div>

          {/* Detected Hazards Summary */}
          <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30">
            <div className="text-[11px] font-mono uppercase text-rose-300 font-semibold flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Diagnosed Anomalies Requiring Intervention</span>
            </div>
            <ul className="space-y-1 text-xs text-slate-200 list-disc list-inside">
              {plan.hazardsSummary.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </div>

          {/* Execution Progress Bar */}
          {(status === 'executing' || status === 'completed') && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-teal-300">
                  {status === 'completed' ? 'Habitat Envelope Restored' : 'Remediation Progress'}
                </span>
                <span className="text-white font-bold tabular-nums">{pct}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-150 ${
                    status === 'completed' ? 'bg-emerald-400' : 'bg-teal-400'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Ordered Remediation Steps */}
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Proposed Autonomous Remediation Plan
            </div>
            {plan.steps.map((step, idx) => (
              <div
                key={step.id}
                className={`p-3.5 rounded-xl border transition-colors flex items-start gap-3 ${
                  step.status === 'completed'
                    ? 'bg-emerald-950/25 border-emerald-500/40'
                    : step.status === 'active'
                    ? 'bg-teal-950/40 border-teal-400/60'
                    : 'bg-slate-900/75 border-slate-800'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : step.status === 'active' ? (
                    <Loader2 className="w-4 h-4 text-teal-300 animate-spin" />
                  ) : (
                    <Wrench className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">
                      {idx + 1}. {step.title}
                    </span>
                    <span className="text-[10px] font-mono text-teal-300">{step.targetSummary}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{step.actionDetail}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">Subsystem: {step.subsystem}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Session Permission Preference */}
          {status === 'awaiting_permission' && (
            <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberForSession}
                onChange={(e) => setRememberForSession(e.target.checked)}
                data-testid="self-heal-remember-checkbox"
                className="w-4 h-4 accent-teal-400 rounded cursor-pointer"
              />
              <span>
                Always permit automatic self-healing when Critical / Extreme alarms hit during this mission session
              </span>
            </label>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {status === 'awaiting_permission' ? (
            <>
              <button
                type="button"
                onClick={onDenyPermission}
                data-testid="deny-self-healing-btn"
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>Deny — Manual Control</span>
              </button>

              <button
                type="button"
                onClick={() => onGrantPermission(rememberForSession)}
                data-testid="grant-self-healing-btn"
                className="px-5 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-mono font-bold inline-flex items-center gap-2 transition-colors shadow-lg"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Grant Permission &amp; Self-Heal</span>
              </button>
            </>
          ) : status === 'executing' ? (
            <>
              <span className="text-xs font-mono text-teal-300 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>Autonomous recovery valves &amp; ECLSS redundancy active...</span>
              </span>
              <button
                type="button"
                onClick={onAbortExecution}
                data-testid="abort-self-healing-btn"
                className="px-4 py-2 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-mono font-semibold transition-colors"
              >
                Abort Self-Healing
              </button>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold transition-colors"
              >
                Return to Mission Control
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface BannerProps {
  status: SelfHealingPermissionStatus;
  plan: SelfHealingPlan | null;
  progress: number;
  onOpenModal: () => void;
  onGrantQuick: () => void;
  onDenyQuick: () => void;
  onAbort: () => void;
  onDismissCompleted: () => void;
}

export const SelfHealingBanner: React.FC<BannerProps> = ({
  status,
  plan,
  progress,
  onOpenModal,
  onGrantQuick,
  onDenyQuick,
  onAbort,
  onDismissCompleted,
}) => {
  if (status === 'idle' || status === 'denied' || !plan) return null;

  const activeStep =
    plan.steps.find((s) => s.status === 'active') ||
    plan.steps[Math.min(plan.steps.length - 1, Math.floor(progress * plan.steps.length))];
  const completedCount = plan.steps.filter((s) => s.status === 'completed').length;

  if (status === 'awaiting_permission') {
    return (
      <div
        data-testid="self-healing-banner"
        className="mb-5 p-4 rounded-xl border border-amber-500/60 bg-gradient-to-r from-rose-950/75 via-slate-900 to-amber-950/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-mono font-bold uppercase text-amber-200 tracking-wide">
              Alarm Triggered · Self-Healing Permission Requested
            </div>
            <div className="text-xs text-slate-200 mt-0.5">
              {plan.steps.length}-stage recovery ready for <strong>{plan.habitatName}</strong> ({plan.hazardsSummary[0]}).
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenModal}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 transition-colors"
          >
            Inspect Plan
          </button>
          <button
            type="button"
            onClick={onDenyQuick}
            className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 border border-rose-500/40 text-xs font-mono text-rose-300 transition-colors"
          >
            Deny
          </button>
          <button
            type="button"
            onClick={onGrantQuick}
            className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-mono font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Grant Permission &amp; Self-Heal</span>
          </button>
        </div>
      </div>
    );
  }

  if (status === 'executing') {
    const pct = Math.min(100, Math.round(progress * 100));
    return (
      <div
        data-testid="self-healing-banner"
        className="mb-5 p-4 rounded-xl border border-teal-500/60 bg-teal-950/35 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
      >
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between gap-3 mb-1.5">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-teal-200 uppercase">
              <Loader2 className="w-4 h-4 animate-spin text-teal-300" />
              <span>
                Self-Healing Active ({Math.min(plan.steps.length, completedCount + 1)}/{plan.steps.length}):{' '}
                {activeStep?.title}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-white tabular-nums">{pct}%</span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-teal-500/30">
            <div className="h-full bg-teal-400 transition-all duration-150" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenModal}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 hover:text-white transition-colors"
          >
            Details
          </button>
          <button
            type="button"
            onClick={onAbort}
            className="px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-xs font-mono text-white transition-colors"
          >
            Abort
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="self-healing-banner"
      className="mb-5 px-4 py-3 rounded-xl border border-emerald-500/50 bg-emerald-950/30 flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex items-center gap-2.5 text-xs font-mono text-emerald-200">
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        <span>
          <strong>Habitat Restored to Nominal via Self-Healing</strong> · {plan.steps.length} recovery stages completed for {plan.habitatName}.
        </span>
      </div>
      <button
        type="button"
        onClick={onDismissCompleted}
        className="text-xs font-mono text-slate-400 hover:text-white transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
};
