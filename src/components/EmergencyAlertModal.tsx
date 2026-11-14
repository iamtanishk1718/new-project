import React, { useEffect, useState } from 'react';
import { EmergencyAlertContent } from '../lib/emergencyAlerts';
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Phone,
  Send,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  alertContent: EmergencyAlertContent;
  defaultEmail: string;
  defaultPhone: string;
  isAlarmMuted: boolean;
  onToggleAlarmMute: () => void;
  onConfirmDispatch: (options: {
    sendEmail: boolean;
    emailTarget: string;
    sendPhone: boolean;
    phoneTarget: string;
  }) => Promise<{ emailOutcome?: string; phoneOutcome?: string }>;
}

export const EmergencyAlertModal: React.FC<Props> = ({
  isOpen,
  onClose,
  alertContent,
  defaultEmail,
  defaultPhone,
  isAlarmMuted,
  onToggleAlarmMute,
  onConfirmDispatch,
}) => {
  const [sendEmail, setSendEmail] = useState(Boolean(defaultEmail));
  const [emailTarget, setEmailTarget] = useState(defaultEmail);
  const [sendPhone, setSendPhone] = useState(Boolean(defaultPhone));
  const [phoneTarget, setPhoneTarget] = useState(defaultPhone);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<{
    emailOutcome?: string;
    phoneOutcome?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmailTarget(defaultEmail);
      setPhoneTarget(defaultPhone);
      setSendEmail(Boolean(defaultEmail));
      setSendPhone(Boolean(defaultPhone));
      setError(null);
      setResultSummary(null);
    }
  }, [isOpen, defaultEmail, defaultPhone]);

  if (!isOpen) return null;

  const isExtreme = alertContent.classification === 'extreme_emergency';

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sendEmail && !sendPhone) {
      setError('Select at least one recipient channel (Gmail/Email or Phone Number) to send.');
      return;
    }
    if (sendEmail && !emailTarget.trim()) {
      setError('Enter a valid Gmail or email address.');
      return;
    }
    if (sendPhone && !phoneTarget.trim()) {
      setError('Enter a valid mobile number for SMS alert dispatch.');
      return;
    }

    setIsSending(true);
    try {
      const outcome = await onConfirmDispatch({
        sendEmail,
        emailTarget: emailTarget.trim(),
        sendPhone,
        phoneTarget: phoneTarget.trim(),
      });
      setResultSummary(outcome);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Alert dispatch failed.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-alert-modal-title"
      data-testid="emergency-alert-modal"
    >
      <div
        className={`w-full max-w-xl rounded-xl border bg-[#07090f] text-slate-100 shadow-2xl overflow-hidden ${
          isExtreme ? 'border-rose-500/80' : 'border-red-500/70'
        }`}
      >
        {/* Header */}
        <div
          className={`px-5 py-4 border-b flex items-center justify-between gap-3 ${
            isExtreme
              ? 'bg-rose-950/75 border-rose-700/60'
              : 'bg-red-950/70 border-red-700/50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-300">
                Confirm Emergency Alert Dispatch
              </div>
              <h2 id="emergency-alert-modal-title" className="text-sm font-bold text-white">
                {alertContent.notificationTitle}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleAlarmMute}
              title={isAlarmMuted ? 'Unmute Alarm Sound' : 'Silence Alarm Sound'}
              className="px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 hover:border-white/30 text-xs font-mono text-slate-200 inline-flex items-center gap-1.5"
            >
              {isAlarmMuted ? (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-rose-300" />
                  <span>Silence</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel and close emergency alert dialog"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleConfirm} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <p className="text-xs text-slate-300 leading-relaxed">
            Review the alert recipients and message below before sending. Confirming will dispatch emergency habitat notifications via the free telemetry alert relay or configured open webhooks.
          </p>

          {error && (
            <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-100 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resultSummary && (
            <div className="p-3.5 rounded-lg bg-emerald-950/75 border border-emerald-500/50 text-xs text-emerald-100 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-emerald-300">
                <CheckCircle2 className="w-4 h-4" />
                <span>Emergency Alert Dispatch Completed</span>
              </div>
              {resultSummary.emailOutcome && <div>Email Relay: {resultSummary.emailOutcome}</div>}
              {resultSummary.phoneOutcome && <div>Phone Relay: {resultSummary.phoneOutcome}</div>}
            </div>
          )}

          {/* Recipient Channels */}
          <div className="space-y-3">
            {/* Email Target */}
            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(e) => setSendEmail(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-950 text-cyan-400"
                  />
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <span>Send Alert to Email</span>
                </label>

                <span className="text-[11px] font-mono text-emerald-400">Free Relay Ready</span>
              </div>
              <input
                type="email"
                value={emailTarget}
                onChange={(e) => setEmailTarget(e.target.value)}
                disabled={!sendEmail}
                placeholder="commander@tejasvi.space"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
              />
            </div>

            {/* Phone Number Target */}
            <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-white cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendPhone}
                  onChange={(e) => setSendPhone(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-950 text-cyan-400"
                />
                <Phone className="w-4 h-4 text-amber-400" />
                <span>Send Alert to Phone / Webhook Relay</span>
              </label>
              <input
                type="tel"
                value={phoneTarget}
                onChange={(e) => setPhoneTarget(e.target.value)}
                disabled={!sendPhone}
                placeholder="+91 98765 43210"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Message Preview */}
          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="text-[11px] font-mono text-slate-400">
              Subject: <span className="text-white">{alertContent.emailSubject}</span>
            </div>
            <pre className="text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto pt-1 border-t border-slate-800/80">
              {alertContent.emailBody}
            </pre>
          </div>

          {/* Explicit Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              data-testid="confirm-send-emergency-alert"
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSending ? 'Sending Alert...' : 'Confirm & Send Alert'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
