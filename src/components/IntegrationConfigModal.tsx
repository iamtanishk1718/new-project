import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug,
  X,
} from 'lucide-react';
import type {
  IntegrationDefinition,
  IntegrationId,
  IntegrationLogEntry,
  IntegrationRecord,
} from '../types/integrations';
import { IntegrationLogo } from './IntegrationLogo';
import {
  connectIntegration,
  disconnectIntegration,
  reconnectIntegration,
  testIntegration,
} from '../lib/integrationsClient';

interface Props {
  isOpen: boolean;
  definition: IntegrationDefinition | null;
  record: IntegrationRecord | null;
  onClose: () => void;
  onUpdated: (record: IntegrationRecord, logs: IntegrationLogEntry[]) => void;
}

export const IntegrationConfigModal: React.FC<Props> = ({
  isOpen,
  definition,
  record,
  onClose,
  onUpdated,
}) => {
  const [publicValues, setPublicValues] = useState<Record<string, string | boolean>>({});
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<'save' | 'test' | 'reconnect' | 'disconnect' | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !definition) return;
    const initPublic: Record<string, string | boolean> = {};
    const initSecret: Record<string, string> = {};
    for (const f of definition.fields) {
      if (f.isSecret) {
        initSecret[f.key] = '';
      } else {
        const savedVal = record?.publicConfig?.[f.key];
        initPublic[f.key] = f.type === 'checkbox' ? Boolean(savedVal) : String(savedVal ?? '');
      }
    }
    setPublicValues(initPublic);
    setSecretValues(initSecret);
    setFeedback(null);
  }, [isOpen, definition, record]);

  if (!isOpen || !definition) return null;

  const statusBadge = () => {
    const status = record?.status || 'not_configured';
    switch (status) {
      case 'connected':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      case 'auth_failed':
      case 'error':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      case 'disconnected':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };


  const handleSave = async (runTest: boolean) => {
    setBusyAction(runTest ? 'test' : 'save');
    setFeedback(null);
    try {
      const res = await connectIntegration(definition.id as IntegrationId, {
        publicConfig: publicValues,
        secrets: secretValues,
        runTest,
      });
      onUpdated(res.record, res.logs);
      setSecretValues({});
      setFeedback({
        type: res.status === 'connected' ? 'success' : res.status === 'not_configured' ? 'info' : 'error',
        text: `${res.statusLabel}: ${res.message}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save configuration.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestOnly = async () => {
    setBusyAction('test');
    setFeedback(null);
    try {
      const res = await testIntegration(definition.id as IntegrationId);
      onUpdated(res.record, res.logs);
      setFeedback({
        type: res.status === 'connected' ? 'success' : res.status === 'not_configured' ? 'info' : 'error',
        text: `${res.statusLabel}: ${res.message}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Connection test failed.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReconnect = async () => {
    setBusyAction('reconnect');
    setFeedback(null);
    try {
      const res = await reconnectIntegration(definition.id as IntegrationId);
      onUpdated(res.record, res.logs);
      setFeedback({
        type: res.status === 'connected' ? 'success' : 'error',
        text: `${res.statusLabel}: ${res.message}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Reconnect failed.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnect = async (purgeSecrets: boolean) => {
    setBusyAction('disconnect');
    setFeedback(null);
    try {
      const res = await disconnectIntegration(definition.id as IntegrationId, purgeSecrets);
      onUpdated(res.record, res.logs);
      setFeedback({
        type: 'info',
        text: purgeSecrets
          ? 'Disconnected and purged stored secrets from server vault.'
          : 'Integration paused & marked Disconnected. Encrypted secrets retained on backend.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Disconnect failed.',
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`${definition.name} Configuration`}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#070b14] border border-slate-700/80 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3.5">
            <IntegrationLogo id={definition.id} className="w-11 h-11" />
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white">{definition.name}</h2>
                <span className={`px-2.5 py-0.5 text-[11px] font-mono rounded-full border ${statusBadge()}`}>
                  {record?.statusLabel || 'Not Configured'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{definition.shortDesc}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Configuration Modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Status telemetry bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-slate-500 font-mono uppercase text-[10px]">Connection Status</div>
              <div className="text-slate-100 font-semibold mt-1">{record?.statusLabel || 'Not Configured'}</div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-slate-500 font-mono uppercase text-[10px] flex items-center gap-1">
                <Clock className="w-3 h-3" /> Last Successful Sync
              </div>
              <div className="text-slate-200 font-mono mt-1">
                {record?.lastSyncAt ? new Date(record.lastSyncAt).toLocaleString() : 'Never verified'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-slate-500 font-mono uppercase text-[10px] flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> Backend Vault Secrets
              </div>
              <div className="text-slate-200 font-mono mt-1 truncate">
                {record?.hasSecrets ? record.maskedSecretSummary || 'Encrypted in vault' : 'None stored'}
              </div>
            </div>
          </div>

          {record?.lastError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-rose-300">Last Error</div>
                <div className="mt-0.5">{record.lastError}</div>
              </div>
            </div>
          )}

          {/* Setup Instructions */}
          <div className="p-3.5 rounded-xl bg-cyan-950/25 border border-cyan-500/25 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-cyan-300">
              <Info className="w-4 h-4 shrink-0" /> Setup Instructions (Free Open Channel)
            </div>
            <p className="text-slate-300 leading-relaxed">{definition.setupHint}</p>
          </div>

          {/* Configuration Fields */}
          <div className="space-y-3.5">
            {definition.fields.map((field) => {
              if (field.type === 'checkbox') {
                return (
                  <label
                    key={field.key}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(publicValues[field.key])}
                      onChange={(e) =>
                        setPublicValues((prev) => ({ ...prev, [field.key]: e.target.checked }))
                      }
                      className="rounded border-slate-600 bg-slate-950 text-cyan-400"
                    />
                    <span className="text-xs text-slate-200">{field.label}</span>
                  </label>
                );
              }

              const value = field.isSecret
                ? secretValues[field.key] ?? ''
                : String(publicValues[field.key] ?? '');

              return (
                <div key={field.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-200">
                      {field.label}
                      {field.required && <span className="text-rose-400 ml-1">*</span>}
                    </label>
                    {field.isSecret && (
                      <span className="text-[10px] font-mono text-emerald-400">
                        {record?.hasSecrets
                          ? 'Stored encrypted (leave blank to keep existing)'
                          : 'AES-256-GCM Encrypted'}
                      </span>
                    )}
                  </div>

                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={value}
                      placeholder={record?.hasSecrets && field.isSecret ? '•••••••• (encrypted in server vault)' : field.placeholder}
                      onChange={(e) =>
                        field.isSecret
                          ? setSecretValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          : setPublicValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  ) : (
                    <input
                      type={field.type === 'password' ? 'password' : field.type}
                      value={value}
                      placeholder={record?.hasSecrets && field.isSecret ? '•••••••• (encrypted in server vault)' : field.placeholder}
                      onChange={(e) =>
                        field.isSecret
                          ? setSecretValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                          : setPublicValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  )}

                  {field.helperText && (
                    <p className="text-[11px] text-slate-500">{field.helperText}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : feedback.type === 'error'
                  ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
                  : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/40 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {record && (record.status === 'connected' || record.hasSecrets) && (
              <>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleDisconnect(false)}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 disabled:opacity-50"
                >
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
                <button
                  type="button"
                  disabled={busyAction !== null}
                  onClick={() => handleDisconnect(true)}
                  className="px-3 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 text-xs font-medium flex items-center gap-1.5 border border-rose-500/30 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Purge Secrets
                </button>
              </>
            )}
            {record?.status === 'disconnected' && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={handleReconnect}
                className="px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-1.5 border border-amber-500/40 disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reconnect
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={handleTestOnly}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-cyan-500/40 disabled:opacity-50"
            >
              {busyAction === 'test' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Test Connection
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleSave(false)}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 disabled:opacity-50"
            >
              {busyAction === 'save' ? 'Saving...' : 'Save Configuration'}
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => handleSave(true)}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {busyAction === 'test' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save &amp; Verify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
