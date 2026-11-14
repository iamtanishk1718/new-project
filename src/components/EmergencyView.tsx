import React, { useState } from 'react';
import {
  EmergencyProtocol,
  EnvironmentalTelemetry,
  HabitatProfile,
  RiskAssessmentResult,
  SelfHealingAuditEntry,
  SelfHealingPermissionStatus,
} from '../types/habitat';
import { EMERGENCY_PROTOCOLS } from '../lib/constants';
import {
  AlertDispatchLogEntry,
  BrowserNotifPermissionState,
} from '../lib/emergencyAlerts';
import {
  ShieldAlert,
  AlertOctagon,
  CheckSquare,
  Square,
  Bell,
  BellRing,
  Mail,
  Phone,
  Volume2,
  VolumeX,
  Send,
  CheckCircle2,
  Megaphone,
  ShieldCheck,
} from 'lucide-react';

interface Props {
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  assessment: RiskAssessmentResult;
  onNavigate: (tab: any) => void;
  notificationPermission: BrowserNotifPermissionState;
  onRequestNotificationPermission: () => Promise<BrowserNotifPermissionState>;
  autoAlertOnCritical: boolean;
  setAutoAlertOnCritical: (enabled: boolean) => void;
  globalAudioEnabled: boolean;
  onToggleGlobalAudio: () => void;
  onTestAlarmAndNotification: (delaySeconds?: number) => void;
  alertEmail: string;
  setAlertEmail: (val: string) => void;
  alertPhone: string;
  setAlertPhone: (val: string) => void;
  onOpenAlertConfirmModal: () => void;
  alertLogs: AlertDispatchLogEntry[];
  selfHealingStatus?: SelfHealingPermissionStatus;
  selfHealingLogs?: SelfHealingAuditEntry[];
  onRequestSelfHeal?: () => void;
}

export const EmergencyView: React.FC<Props> = ({
  telemetry,
  habitat,
  assessment,
  onNavigate,
  notificationPermission,
  onRequestNotificationPermission,
  autoAlertOnCritical,
  setAutoAlertOnCritical,
  globalAudioEnabled,
  onToggleGlobalAudio,
  onTestAlarmAndNotification,
  alertEmail,
  setAlertEmail,
  alertPhone,
  setAlertPhone,
  onOpenAlertConfirmModal,
  alertLogs,
  selfHealingStatus = 'idle',
  selfHealingLogs = [],
  onRequestSelfHeal,
}) => {
  const [selectedProtocol, setSelectedProtocol] = useState<EmergencyProtocol>(EMERGENCY_PROTOCOLS[0]);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [authStatusMsg, setAuthStatusMsg] = useState<string | null>(null);
  const [delayedTestArmed, setDelayedTestArmed] = useState(false);

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleEnableNotif = async () => {
    const perm = await onRequestNotificationPermission();
    if (perm === 'granted') {
      setAuthStatusMsg('Browser notifications enabled. Critical and Extreme Emergency alerts will notify you even when this tab is in the background.');
    } else if (perm === 'denied') {
      setAuthStatusMsg('Browser notifications are blocked in browser site settings. Allow notifications for this site to receive background alerts.');
    }
  };

  const handleDelayedBackgroundTest = () => {
    setDelayedTestArmed(true);
    setAuthStatusMsg('Background alert test scheduled in 3 seconds. Switch tabs or minimize now to verify background notification.');
    onTestAlarmAndNotification(3);
    window.setTimeout(() => setDelayedTestArmed(false), 3200);
  };

  const isEmergencyActive =
    assessment.classification === 'critical' ||
    assessment.classification === 'extreme_emergency' ||
    assessment.overallRiskScore >= 50 ||
    telemetry.fireDetected ||
    telemetry.pressureKPa < 85;

  return (
    <div className="space-y-6">
      {/* Prominent Emergency Status Header */}
      <div
        className={`p-6 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isEmergencyActive
            ? 'bg-rose-950/80 border-rose-600 text-rose-100 shadow-2xl'
            : 'bg-slate-900/90 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-xl ${
              isEmergencyActive ? 'bg-rose-600/30 text-rose-300' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {isEmergencyActive ? (
              <AlertOctagon className="w-8 h-8" />
            ) : (
              <ShieldAlert className="w-8 h-8" />
            )}
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-widest opacity-80">
              NASA Human Spaceflight Emergency Response System
            </div>
            <h1 className="text-xl font-bold font-mono tracking-tight mt-0.5">
              {isEmergencyActive
                ? `CRITICAL EMERGENCY DETECTED: ${assessment.classification.toUpperCase()}`
                : 'FLIGHT EMERGENCY PROCEDURES: STANDBY'}
            </h1>
            <p className="text-xs opacity-90 mt-1 max-w-xl font-sans">
              Habitat: {habitat.name} · Pressure Shell: {telemetry.pressureKPa.toFixed(1)} kPa · Active Hazards: {assessment.hazards.length}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onRequestSelfHeal && (
            <button
              type="button"
              onClick={onRequestSelfHeal}
              data-testid="emergency-self-heal-btn"
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-xs font-mono font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {selfHealingStatus === 'executing'
                  ? 'Self-Healing Active...'
                  : 'Run Self-Healing (Ask Permission)'}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onOpenAlertConfirmModal}
            data-testid="emergency-send-alert-btn"
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Alert to Email / Phone</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('assistant')}
            className="px-4 py-2 bg-slate-900 border border-slate-700 hover:border-cyan-400 text-white rounded-lg text-xs font-mono font-semibold transition-colors whitespace-nowrap"
          >
            Open Flight Safety Chat
          </button>
        </div>
      </div>

      {/* Emergency Alarm & Multi-Channel Notification Dispatch Hub */}
      <div
        className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-5"
        data-testid="emergency-notification-hub"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                Automated Alarm, Browser Notification & Email / Phone Alert Trigger
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Automatically sounds the global emergency klaxon and fires Browser OS Notifications whenever risk reaches Critical or Extreme Emergency—even when this tab is in the background—and dispatches instant alerts to your configured Email or Phone Number.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleGlobalAudio}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border inline-flex items-center gap-1.5 transition-colors ${
                globalAudioEnabled
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400'
              }`}
            >
              {globalAudioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{globalAudioEnabled ? 'Alarm Sound: ARMED' : 'Alarm Sound: MUTED'}</span>
            </button>

            <button
              type="button"
              onClick={() => setAutoAlertOnCritical(!autoAlertOnCritical)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                autoAlertOnCritical
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-950 border-slate-700 text-slate-400'
              }`}
            >
              {autoAlertOnCritical ? 'Auto-Trigger: ON (Critical/Extreme)' : 'Auto-Trigger: OFF'}
            </button>
          </div>
        </div>

        {authStatusMsg && (
          <div className="p-3 rounded-lg bg-slate-950 border border-cyan-500/40 text-xs text-cyan-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{authStatusMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Card 1: Browser Notification API */}
          <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-800 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Browser Background Notifications</span>
                </div>
                <span
                  data-testid="browser-notif-status"
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                    notificationPermission === 'granted'
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                      : notificationPermission === 'denied'
                      ? 'bg-rose-950/70 border-rose-500/50 text-rose-300'
                      : 'bg-amber-950/70 border-amber-500/50 text-amber-300'
                  }`}
                >
                  {notificationPermission}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Uses the native Browser Notification API so Critical & Extreme Emergency alerts appear on your desktop or phone even when another tab or app is active.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {notificationPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleEnableNotif}
                  data-testid="enable-browser-notif-btn"
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition-colors"
                >
                  Enable Notifications
                </button>
              )}
              <button
                type="button"
                onClick={() => onTestAlarmAndNotification(0)}
                data-testid="test-alarm-notif-btn"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 inline-flex items-center gap-1.5 transition-colors"
              >
                <Megaphone className="w-3.5 h-3.5 text-amber-300" />
                <span>Test Alarm & Notification</span>
              </button>
              <button
                type="button"
                onClick={handleDelayedBackgroundTest}
                disabled={delayedTestArmed}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 disabled:opacity-50 transition-colors"
              >
                {delayedTestArmed ? 'Firing in 3s...' : '3s Background Test'}
              </button>
            </div>
          </div>

          {/* Card 2: Email Alert Target */}
          <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-800 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>Email Alert Target</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">
                  Alert Relay Ready
                </span>
              </div>
              <input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="commander@tejasvi.space"
                aria-label="Alert Email Address"
                data-testid="alert-email-input"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenAlertConfirmModal}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-white transition-colors"
              >
                Review & Send Email Alert
              </button>
            </div>
          </div>

          {/* Card 3: Phone / Webhook Relay Target */}
          <div className="p-4 rounded-xl bg-slate-950/85 border border-slate-800 flex flex-col justify-between gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <Phone className="w-4 h-4 text-amber-400" />
                  <span>Phone / Webhook Alert Target</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400">Free Relay</span>
              </div>
              <input
                type="tel"
                value={alertPhone}
                onChange={(e) => setAlertPhone(e.target.value)}
                placeholder="+91 98765 43210"
                aria-label="Alert Mobile Phone Number"
                data-testid="alert-phone-input"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <button
              type="button"
              onClick={onOpenAlertConfirmModal}
              className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Confirm & Dispatch Relay Alert</span>
            </button>
          </div>
        </div>

        {/* Recent Dispatch Audit Log */}
        {alertLogs.length > 0 && (
          <div className="pt-3 border-t border-slate-800">
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2">
              Recent Emergency Notification & Alert Dispatches
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto" data-testid="alert-dispatch-log">
              {alertLogs.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="uppercase px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300">
                      {entry.channel}
                    </span>
                    <span className="text-white">{entry.target}</span>
                    <span className="text-slate-400">— {entry.detail}</span>
                  </div>
                  <span
                    className={
                      entry.status === 'failed'
                        ? 'text-rose-400'
                        : entry.status === 'delivered'
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                    }
                  >
                    {entry.status.toUpperCase()} · {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Self-Healing Audit Log */}
        {selfHealingLogs.length > 0 && (
          <div className="pt-3 border-t border-slate-800">
            <div className="text-[11px] font-mono uppercase tracking-wider text-teal-300 mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Autonomous Self-Healing Permission &amp; Recovery Audit</span>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto" data-testid="self-healing-audit-log">
              {selfHealingLogs.slice(0, 8).map((entry) => (
                <div
                  key={entry.id}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-teal-900/50 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono"
                >
                  <div className="flex items-center gap-2">
                    <span className="uppercase px-1.5 py-0.5 rounded bg-teal-950 border border-teal-700/60 text-teal-300">
                      {entry.action.replace('_', ' ')}
                    </span>
                    <span className="text-white">{entry.summary}</span>
                  </div>
                  <span className="text-slate-400 tabular-nums">
                    {entry.classification.toUpperCase()} ({entry.riskScore}/100) ·{' '}
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Protocol Selector Tabs */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono mb-3">
          NASA Standard Emergency Response Protocols
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {EMERGENCY_PROTOCOLS.map((proto) => {
            const isSelected = selectedProtocol.id === proto.id;
            return (
              <button
                key={proto.id}
                onClick={() => setSelectedProtocol(proto)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-rose-500/15 border-rose-500/60 text-white shadow-lg'
                    : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="text-[10px] font-mono text-slate-500 uppercase">
                  {proto.hazardType.toUpperCase()} INCIDENT
                </div>
                <div className="text-xs font-bold text-white mt-1 leading-snug">
                  {proto.title}
                </div>
                <div className="text-[10px] font-mono text-cyan-400 mt-2 truncate">
                  Ref: {proto.standardReference}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Protocol Execution Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <span className="text-[10px] font-mono uppercase text-slate-500">
              Active Procedure Directive
            </span>
            <h3 className="text-base font-bold text-white font-mono mt-0.5">
              {selectedProtocol.title}
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Governing Specification: {selectedProtocol.standardReference}
            </span>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Checklist Progress:{' '}
            <strong className="text-cyan-400 tabular-nums">
              {selectedProtocol.steps.filter((s) => completedSteps[s.id]).length} /{' '}
              {selectedProtocol.steps.length} Completed
            </strong>
          </div>
        </div>

        {/* Step-by-Step Procedure Checklist */}
        <div className="mt-5 space-y-3">
          {selectedProtocol.steps.map((step) => {
            const isDone = !!completedSteps[step.id];
            return (
              <div
                key={step.id}
                onClick={() => toggleStep(step.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  isDone
                    ? 'bg-emerald-950/20 border-emerald-900/60 text-slate-400'
                    : step.isCritical
                    ? 'bg-slate-950 border-rose-900/50 text-slate-200 hover:border-rose-700/80'
                    : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckSquare className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <Square className={`w-5 h-5 ${step.isCritical ? 'text-rose-400' : 'text-slate-500'}`} />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      STEP {step.stepNumber.toString().padStart(2, '0')}:
                    </span>
                    {step.isCritical && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                        CRITICAL ACTION
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-500 ml-auto">
                      Assigned: {step.responsibleCrew}
                    </span>
                  </div>
                  <div className={`text-xs leading-relaxed font-sans ${isDone ? 'line-through opacity-70' : ''}`}>
                    {step.action}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1.5">
                    Subsystem Impact: {step.subsystemAffected}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
