import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  GitBranch,
  History,
  Loader2,
  Play,
  Plug,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Trash2,
  Unplug,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  INTEGRATION_CATALOG,
  createDefaultAlertRoutingMatrix,
} from '../lib/integrationCatalog';
import type {
  AlertRoutingMatrix,
  AlertRoutingSeverity,
  AutomationRuleRecord,
  AutomationTriggerType,
  IntegrationCategory,
  IntegrationDefinition,
  IntegrationId,
  IntegrationLogEntry,
  IntegrationRecord,
} from '../types/integrations';
import type { EnvironmentalTelemetry, HabitatProfile, RiskAssessmentResult } from '../types/habitat';
import { IntegrationLogo } from './IntegrationLogo';
import { IntegrationConfigModal } from './IntegrationConfigModal';
import {
  disconnectIntegration,
  dispatchIntegrationEvent,
  reconnectIntegration,
  removeAutomationRule,
  saveAlertRouting,
  saveAutomationRule,
  testAutomationRule,
  testIntegration,
} from '../lib/integrationsClient';

interface Props {
  integrations: IntegrationRecord[];
  setIntegrations: React.Dispatch<React.SetStateAction<IntegrationRecord[]>>;
  routing: AlertRoutingMatrix;
  setRouting: React.Dispatch<React.SetStateAction<AlertRoutingMatrix>>;
  rules: AutomationRuleRecord[];
  setRules: React.Dispatch<React.SetStateAction<AutomationRuleRecord[]>>;
  logs: IntegrationLogEntry[];
  setLogs: React.Dispatch<React.SetStateAction<IntegrationLogEntry[]>>;
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  assessment: RiskAssessmentResult;
  onNavigateNasa?: () => void;
}

type HubSectionTab = 'directory' | 'routing' | 'automation' | 'logs';

const CATEGORY_TABS: { id: 'all' | IntegrationCategory; label: string }[] = [
  { id: 'all', label: 'All Free Channels' },
  { id: 'communication', label: 'Communication' },
  { id: 'automation', label: 'Automation' },
  { id: 'hardware_dev', label: 'Hardware & Dev' },
];

const ROUTING_CHANNELS: { id: string; label: string }[] = [
  { id: 'mission_history', label: 'Mission History' },
  ...INTEGRATION_CATALOG.filter((i) => i.supportsRouting).map((i) => ({ id: i.id, label: i.name })),
];

const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  oxygen_below: 'Oxygen Percentage Below Threshold (%)',
  pressure_abnormal: 'Cabin Pressure Out of Range (kPa)',
  sensor_disconnected: 'Life-Support Sensor / Subsystem Fault',
  critical_unacknowledged: 'Critical Alert Unacknowledged Timeout',
  co2_above: 'Carbon Dioxide Concentration Above (ppm)',
  fire_or_smoke: 'Fire or Smoke Sensor Triggered',
};

const BUILTIN_NASA_FEEDS = [
  {
    name: 'NASA DSCOVR EPIC Satellite',
    endpoint: 'epic.gsfc.nasa.gov',
    purpose: 'Authoritative UTC Time & Sun-Earth L1 Earth Observation',
  },
  {
    name: 'ISS NORAD 25544 Ephemeris',
    endpoint: 'api.wheretheiss.at',
    purpose: 'Live Orbital Position, Velocity & Eclipse State',
  },
  {
    name: 'NASA POWER Open API',
    endpoint: 'power.larc.nasa.gov',
    purpose: 'Solar Irradiance, Surface Pressure & Ambient Temp',
  },
  {
    name: 'NASA CCMC DONKI & EONET v3',
    endpoint: 'api.nasa.gov · eonet.gsfc.nasa.gov',
    purpose: 'Space Weather Bulletins & Natural Event Tracking',
  },
  {
    name: 'NASA OSDR / GeneLab',
    endpoint: 'osdr.nasa.gov',
    purpose: 'Spaceflight Biology & Cellular Stress Datasets',
  },
];

export const IntegrationsView: React.FC<Props> = ({
  integrations,
  setIntegrations,
  routing,
  setRouting,
  rules,
  setRules,
  logs,
  setLogs,
  telemetry,
  habitat,
  assessment,
  onNavigateNasa,
}) => {
  const [section, setSection] = useState<HubSectionTab>('directory');
  const [categoryFilter, setCategoryFilter] = useState<'all' | IntegrationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDef, setSelectedDef] = useState<IntegrationDefinition | null>(null);
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const [savingRouting, setSavingRouting] = useState(false);

  const [editingRule, setEditingRule] = useState<AutomationRuleRecord | null>(null);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);

  const [logAppFilter, setLogAppFilter] = useState<string>('all');
  const [logStatusFilter, setLogStatusFilter] = useState<string>('all');
  const [logDateFilter, setLogDateFilter] = useState<string>('');

  const recordMap = useMemo(() => {
    const map: Record<string, IntegrationRecord> = {};
    for (const r of integrations) map[r.integrationId] = r;
    return map;
  }, [integrations]);

  const stats = useMemo(() => {
    const total = INTEGRATION_CATALOG.length;
    let connected = 0;
    let disconnected = 0;
    let failed = 0;
    for (const def of INTEGRATION_CATALOG) {
      const rec = recordMap[def.id];
      const st = rec?.status || 'not_configured';
      if (st === 'connected') connected += 1;
      else if (st === 'auth_failed' || st === 'error') failed += 1;
      else disconnected += 1;
    }
    return { total, connected, disconnected, failed };
  }, [recordMap]);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return INTEGRATION_CATALOG.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (q) {
        return (
          item.name.toLowerCase().includes(q) ||
          item.shortDesc.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [categoryFilter, searchQuery]);

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      if (logAppFilter !== 'all' && entry.integrationId !== logAppFilter) return false;
      if (logStatusFilter !== 'all' && entry.status !== logStatusFilter) return false;
      if (logDateFilter) {
        const entryDay = entry.timestamp.slice(0, 10);
        if (entryDay !== logDateFilter) return false;
      }
      return true;
    });
  }, [logs, logAppFilter, logStatusFilter, logDateFilter]);

  const upsertSingleRecord = (updated: IntegrationRecord, nextLogs: IntegrationLogEntry[]) => {
    setIntegrations((prev) => {
      const exists = prev.some((r) => r.integrationId === updated.integrationId);
      if (exists) {
        return prev.map((r) => (r.integrationId === updated.integrationId ? updated : r));
      }
      return [...prev, updated];
    });
    setLogs(nextLogs);
  };

  const handleQuickTest = async (def: IntegrationDefinition) => {
    setBusyCardId(def.id);
    setBanner(null);
    try {
      const res = await testIntegration(def.id);
      upsertSingleRecord(res.record, res.logs);
      setBanner({
        type: res.status === 'connected' ? 'success' : res.status === 'not_configured' ? 'info' : 'error',
        text: `${def.name} — ${res.statusLabel}: ${res.message}`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to test ${def.name}.`,
      });
    } finally {
      setBusyCardId(null);
    }
  };

  const handleQuickDisconnect = async (def: IntegrationDefinition) => {
    setBusyCardId(def.id);
    setBanner(null);
    try {
      const res = await disconnectIntegration(def.id, false);
      upsertSingleRecord(res.record, res.logs);
      setBanner({ type: 'info', text: `${def.name} disconnected.` });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to disconnect ${def.name}.`,
      });
    } finally {
      setBusyCardId(null);
    }
  };

  const handleQuickReconnect = async (def: IntegrationDefinition) => {
    setBusyCardId(def.id);
    setBanner(null);
    try {
      const res = await reconnectIntegration(def.id);
      upsertSingleRecord(res.record, res.logs);
      setBanner({
        type: res.status === 'connected' ? 'success' : 'error',
        text: `${def.name} — ${res.statusLabel}: ${res.message}`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : `Failed to reconnect ${def.name}.`,
      });
    } finally {
      setBusyCardId(null);
    }
  };

  const handleQuickDispatchSample = async (def: IntegrationDefinition) => {
    setBusyCardId(def.id);
    setBanner(null);
    try {
      const res = await dispatchIntegrationEvent(def.id, {
        eventType: 'manual_dispatch',
        severity: 'warning',
        title: `Mission Alert Dispatch · ${habitat.name}`,
        message: `Risk Score ${assessment.overallRiskScore}/100 | O2 ${telemetry.oxygenPercent.toFixed(1)}% | CO2 ${telemetry.carbonDioxidePpm} ppm | Pressure ${telemetry.pressureKPa.toFixed(1)} kPa.`,
      });
      setLogs(res.logs);
      setBanner({
        type: res.delivered ? 'success' : 'error',
        text: res.delivered
          ? `${def.name}: Dispatch delivered successfully.`
          : `${def.name}: Dispatch was not delivered — verify integration configuration.`,
      });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : `Dispatch to ${def.name} failed.`,
      });
    } finally {
      setBusyCardId(null);
    }
  };

  const handleToggleRoutingCell = (severity: AlertRoutingSeverity, channelId: string) => {
    setRouting((prev) => ({
      ...prev,
      [severity]: {
        ...(prev[severity] || {}),
        [channelId]: !prev[severity]?.[channelId],
      },
    }));
  };

  const handleSaveRouting = async () => {
    setSavingRouting(true);
    setBanner(null);
    try {
      const res = await saveAlertRouting(routing);
      setRouting(res.routing);
      setLogs(res.logs);
      setBanner({ type: 'success', text: 'Smart Alert Routing preferences saved.' });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save alert routing.',
      });
    } finally {
      setSavingRouting(false);
    }
  };

  const handleResetRoutingDefaults = () => {
    setRouting(createDefaultAlertRoutingMatrix());
    setBanner({ type: 'info', text: 'Restored default Smart Alert Routing rules. Click Save Routing to persist.' });
  };

  const handleOpenNewRule = () => {
    setEditingRule({
      id: `rule_${Date.now()}`,
      name: '',
      description: '',
      enabled: true,
      condition: {
        triggerType: 'oxygen_below',
        thresholdValue: 19.5,
      },
      actions: [
        {
          integrationId: 'telegram',
          actionType: 'send_alert',
          label: 'Notify Telegram Bot',
        },
      ],
      cooldownSeconds: 120,
      executionCount: 0,
      updatedAt: new Date().toISOString(),
    });
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !editingRule.name.trim()) return;
    setBusyRuleId(editingRule.id);
    try {
      const res = await saveAutomationRule(editingRule);
      setRules(res.rules);
      setLogs(res.logs);
      setIsRuleModalOpen(false);
      setEditingRule(null);
      setBanner({ type: 'success', text: `Automation rule "${editingRule.name}" saved.` });
    } catch (err) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save automation rule.',
      });
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleToggleRuleEnabled = async (rule: AutomationRuleRecord) => {
    setBusyRuleId(rule.id);
    try {
      const res = await saveAutomationRule({ ...rule, enabled: !rule.enabled });
      setRules(res.rules);
      setLogs(res.logs);
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to toggle rule.' });
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    setBusyRuleId(ruleId);
    try {
      const res = await removeAutomationRule(ruleId);
      setRules(res.rules);
      setLogs(res.logs);
      setBanner({ type: 'info', text: 'Automation rule removed.' });
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete rule.' });
    } finally {
      setBusyRuleId(null);
    }
  };

  const handleTestRule = async (rule: AutomationRuleRecord) => {
    setBusyRuleId(rule.id);
    setBanner(null);
    try {
      const res = await testAutomationRule(rule.id);
      setRules(res.rules);
      setLogs(res.logs);
      setBanner({
        type: 'info',
        text: `Tested "${rule.name}": ${res.actionSummaries.join(' | ')}`,
      });
    } catch (err) {
      setBanner({ type: 'error', text: err instanceof Error ? err.message : 'Automation test failed.' });
    } finally {
      setBusyRuleId(null);
    }
  };

  const getStatusTextClass = (status: IntegrationRecord['status']) => {
    switch (status) {
      case 'connected':
        return 'text-emerald-400';
      case 'auth_failed':
      case 'error':
        return 'text-rose-400';
      case 'disconnected':
        return 'text-amber-300';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusGlyph = (status: IntegrationRecord['status']) => {
    switch (status) {
      case 'connected':
        return '●';
      case 'auth_failed':
      case 'error':
        return '✖';
      case 'disconnected':
        return '▲';
      default:
        return '○';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Zero-Cost Security Posture */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Plug className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-white tracking-wide">
              Free Open Integrations &amp; Telemetry Hub
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              100% free open-source channels, hardware relays, and built-in NASA Open API feeds — zero paid SaaS subscriptions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl panel-surface-subtle text-xs font-mono text-emerald-300">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>AES-256-GCM Secret Vault · Zero Paid APIs</span>
        </div>
      </div>

      {/* Built-in 100% Free NASA Open Data & Satellite Feeds Panel */}
      <section className="panel-surface rounded-xl p-4 space-y-3" data-testid="builtin-nasa-feeds-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              Built-in Free NASA Open Resources &amp; Satellite Streams (Always Active)
            </h2>
          </div>
          {onNavigateNasa && (
            <button
              type="button"
              onClick={onNavigateNasa}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Inspect Live NASA Telemetry →
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {BUILTIN_NASA_FEEDS.map((feed) => (
            <div
              key={feed.name}
              className="p-3 rounded-lg bg-[#050811] border border-slate-800/90 space-y-1"
            >
              <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
                <span className="text-emerald-400 font-semibold">● FREE ACTIVE</span>
              </div>
              <div className="text-xs font-semibold text-white truncate">{feed.name}</div>
              <div className="text-[10px] font-mono text-cyan-400/90 truncate">{feed.endpoint}</div>
              <div className="text-[11px] text-slate-400 leading-snug">{feed.purpose}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl panel-surface">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Free Open Channels
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-white" data-testid="kpi-total-integrations">
              {stats.total}
            </span>
            <span className="text-[11px] font-mono text-cyan-400">3 Categories</span>
          </div>
        </div>

        <div className="p-4 rounded-xl panel-surface border-emerald-500/25">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Connected
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400" data-testid="kpi-connected">
              {stats.connected}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl panel-surface border-amber-500/25">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Standby / Unlinked
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-300" data-testid="kpi-disconnected">
              {stats.disconnected}
            </span>
            <Unplug className="w-4 h-4 text-amber-400" />
          </div>
        </div>

        <div className="p-4 rounded-xl panel-surface border-rose-500/25">
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Failed
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-400" data-testid="kpi-failed">
              {stats.failed}
            </span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        {(
          [
            { id: 'directory', label: 'Free Open Channels', icon: Plug },
            { id: 'routing', label: 'Alert Routing', icon: GitBranch },
            { id: 'automation', label: 'Automation Rules', icon: Zap },
            { id: 'logs', label: `Activity Logs (${logs.length})`, icon: Activity },
          ] as { id: HubSectionTab; label: string; icon: React.FC<any> }[]
        ).map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSection(tab.id)}
              data-testid={`hub-tab-${tab.id}`}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#080c16] text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Transient Feedback Banner */}
      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            banner.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : banner.type === 'error'
              ? 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-100'
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-slate-400 hover:text-white text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* SECTION 1: INTEGRATION DIRECTORY */}
      {section === 'directory' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {CATEGORY_TABS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    categoryFilter === cat.id
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-[#090d18] text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search free open channels..."
                data-testid="integration-search-input"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#080c16] border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredCatalog.map((def, idx) => {
              const rec = recordMap[def.id];
              const status = rec?.status || 'not_configured';
              const isBusy = busyCardId === def.id;

              return (
                <motion.div
                  key={def.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }}
                  data-testid={`integration-card-${def.id}`}
                  className="p-4 rounded-xl panel-surface hover:border-slate-700 flex flex-col justify-between gap-4 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <IntegrationLogo id={def.id} className="w-10 h-10" />
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate">{def.name}</h3>
                          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                            {def.category.replace('_', ' & ')} · Free Tier
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-semibold shrink-0 ${getStatusTextClass(
                          status
                        )}`}
                      >
                        {getStatusGlyph(status)} {rec?.statusLabel || 'Not Configured'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{def.shortDesc}</p>

                    {rec?.lastSyncAt && (
                      <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Last Sync: {new Date(rec.lastSyncAt).toLocaleString()}
                      </div>
                    )}

                    {rec?.lastError && (
                      <div className="text-[11px] text-rose-300 bg-rose-950/35 border border-rose-500/25 rounded-lg px-2.5 py-1.5 line-clamp-2">
                        {rec.lastError}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDef(def)}
                        data-testid={`configure-btn-${def.id}`}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-semibold border border-cyan-500/30 flex items-center gap-1.5 transition-colors"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        {status === 'not_configured' ? 'Connect' : 'Configure'}
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleQuickTest(def)}
                        data-testid={`test-btn-${def.id}`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        Test
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {status === 'connected' && (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQuickDispatchSample(def)}
                            title="Send test payload"
                            className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQuickDisconnect(def)}
                            title="Disconnect"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700"
                          >
                            <Unplug className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {status === 'disconnected' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleQuickReconnect(def)}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-medium border border-amber-500/30 flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Reconnect
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: SMART ALERT ROUTING */}
      {section === 'routing' && (
        <div className="p-5 rounded-xl panel-surface space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-cyan-400" />
                Smart Alert Routing
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure which free open channels and logging targets fire automatically for Normal, Warning, and Critical alert severities.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetRoutingDefaults}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
              </button>
              <button
                type="button"
                disabled={savingRouting}
                onClick={handleSaveRouting}
                data-testid="save-routing-btn"
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingRouting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Routing Rules
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#050811] border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">Notification / Logging Channel</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center text-emerald-300">Normal</th>
                  <th className="py-3 px-4 text-center text-amber-300">Warning</th>
                  <th className="py-3 px-4 text-center text-rose-300">Critical</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {ROUTING_CHANNELS.map((ch) => {
                  const rec = recordMap[ch.id];
                  const isConnected = ch.id === 'mission_history' || rec?.status === 'connected';
                  return (
                    <tr key={ch.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium text-white flex items-center gap-2.5">
                        {ch.id !== 'mission_history' ? (
                          <IntegrationLogo id={ch.id as IntegrationId} className="w-7 h-7" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                            <History className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span>{ch.label}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className={isConnected ? 'text-emerald-400' : 'text-slate-500'}>
                          {ch.id === 'mission_history' ? '● Always Active' : rec?.statusLabel || 'Not Configured'}
                        </span>
                      </td>
                      {(['normal', 'warning', 'critical'] as AlertRoutingSeverity[]).map((sev) => {
                        const checked = Boolean(routing[sev]?.[ch.id]);
                        return (
                          <td key={sev} className="py-3 px-4 text-center">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={checked}
                              aria-label={`${ch.label} ${sev} routing`}
                              data-testid={`routing-toggle-${sev}-${ch.id}`}
                              onClick={() => handleToggleRoutingCell(sev, ch.id)}
                              className={`inline-flex h-5 w-9 items-center rounded-full transition-colors p-0.5 ${
                                checked
                                  ? sev === 'critical'
                                    ? 'bg-rose-500'
                                    : sev === 'warning'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                  : 'bg-slate-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  checked ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 3: AUTOMATION RULES */}
      {section === 'automation' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 rounded-xl panel-surface">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Automation Rules
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                IF-THEN mission control workflows triggered automatically by telemetry breaches or unacknowledged alerts.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewRule}
              data-testid="new-automation-rule-btn"
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Create Automation Rule
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rules.map((rule) => {
              const isBusy = busyRuleId === rule.id;
              return (
                <div
                  key={rule.id}
                  data-testid={`automation-rule-${rule.id}`}
                  className="p-5 rounded-xl panel-surface flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-white">{rule.name}</h3>
                        <div className="text-[11px] font-mono text-cyan-400 mt-0.5">
                          Trigger: {TRIGGER_LABELS[rule.condition.triggerType]}
                          {rule.condition.thresholdValue !== undefined
                            ? ` (${rule.condition.thresholdValue}${
                                rule.condition.secondaryUpperValue
                                  ? `–${rule.condition.secondaryUpperValue}`
                                  : ''
                              })`
                            : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleToggleRuleEnabled(rule)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-mono border ${
                          rule.enabled
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        {rule.enabled ? '● ENABLED' : '○ DISABLED'}
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{rule.description}</p>

                    <div className="flex flex-wrap gap-1.5">
                      {rule.actions.map((act, i) => (
                        <span
                          key={`${act.integrationId}-${i}`}
                          className="px-2.5 py-1 rounded-md bg-[#050811] border border-slate-800 text-[11px] text-slate-200 font-mono"
                        >
                          THEN {act.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="font-mono text-slate-500">
                      Executions: <span className="text-slate-200 tabular-nums">{rule.executionCount || 0}</span>
                      {rule.lastTriggeredAt
                        ? ` · Last: ${new Date(rule.lastTriggeredAt).toLocaleString()}`
                        : ' · Never triggered'}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleTestRule(rule)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-1"
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Test Rule
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRule(rule);
                          setIsRuleModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                        title="Edit Rule"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-300 border border-slate-700"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: ACTIVITY LOGS */}
      {section === 'logs' && (
        <div className="p-5 rounded-xl panel-surface space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400" />
                Integration Activity &amp; Audit Logs
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sanitized dispatch history across Telegram, Discord, Slack, Trello, Home Assistant, ESP32 IoT, and GitHub.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <select
                  value={logAppFilter}
                  onChange={(e) => setLogAppFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#050811] border border-slate-800 text-xs text-slate-200"
                >
                  <option value="all">All Channels</option>
                  {INTEGRATION_CATALOG.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                  <option value="mission_history">Mission History</option>
                </select>
              </div>

              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#050811] border border-slate-800 text-xs text-slate-200"
              >
                <option value="all">All Statuses</option>
                <option value="delivered">Delivered</option>
                <option value="connected">Connected</option>
                <option value="auth_failed">Auth Failed</option>
                <option value="not_configured">Not Configured</option>
                <option value="failed">Failed</option>
              </select>

              <input
                type="date"
                value={logDateFilter}
                onChange={(e) => setLogDateFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-[#050811] border border-slate-800 text-xs text-slate-200"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#050811] border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                <tr>
                  <th className="py-3 px-4">Application</th>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Error / Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No integration activity records match the active filters. Test or configure an integration to view live audit entries.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-semibold text-white">{entry.applicationName}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-300">
                        {entry.eventType.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-400 whitespace-nowrap tabular-nums">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`text-[11px] font-mono font-semibold ${
                            entry.status === 'delivered' || entry.status === 'connected'
                              ? 'text-emerald-400'
                              : entry.status === 'deduplicated' || entry.status === 'not_configured'
                              ? 'text-amber-300'
                              : 'text-rose-400'
                          }`}
                        >
                          {entry.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono uppercase text-[11px] text-slate-300">
                        {entry.severity}
                      </td>
                      <td className="py-2.5 px-4 text-slate-300 max-w-md">{entry.detail}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      <IntegrationConfigModal
        isOpen={Boolean(selectedDef)}
        definition={selectedDef}
        record={selectedDef ? recordMap[selectedDef.id] || null : null}
        onClose={() => setSelectedDef(null)}
        onUpdated={upsertSingleRecord}
      />

      {/* Automation Rule Editor Modal */}
      {isRuleModalOpen && editingRule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Automation Rule"
        >
          <form
            onSubmit={handleSaveRule}
            className="w-full max-w-lg rounded-xl bg-[#070b14] border border-slate-700 p-5 space-y-4 shadow-2xl"
          >
            <h3 className="text-base font-bold text-white">Configure Automation Rule</h3>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Rule Name</label>
              <input
                type="text"
                required
                value={editingRule.name}
                onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                placeholder="e.g., Hypoxic Oxygen Emergency Escalation"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Condition Trigger (IF)</label>
              <select
                value={editingRule.condition.triggerType}
                onChange={(e) =>
                  setEditingRule({
                    ...editingRule,
                    condition: {
                      ...editingRule.condition,
                      triggerType: e.target.value as AutomationTriggerType,
                    },
                  })
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                {(Object.keys(TRIGGER_LABELS) as AutomationTriggerType[]).map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            {(editingRule.condition.triggerType === 'oxygen_below' ||
              editingRule.condition.triggerType === 'pressure_abnormal' ||
              editingRule.condition.triggerType === 'co2_above') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-300">Primary Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingRule.condition.thresholdValue ?? ''}
                    onChange={(e) =>
                      setEditingRule({
                        ...editingRule,
                        condition: {
                          ...editingRule.condition,
                          thresholdValue: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                  />
                </div>
                {editingRule.condition.triggerType === 'pressure_abnormal' && (
                  <div className="space-y-1">
                    <label className="text-xs text-slate-300">Upper Bound (kPa)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingRule.condition.secondaryUpperValue ?? ''}
                      onChange={(e) =>
                        setEditingRule({
                          ...editingRule,
                          condition: {
                            ...editingRule.condition,
                            secondaryUpperValue: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Target Action Integration (THEN)</label>
              <select
                value={editingRule.actions[0]?.integrationId || 'telegram'}
                onChange={(e) => {
                  const chosen = e.target.value as IntegrationId;
                  const appName = INTEGRATION_CATALOG.find((i) => i.id === chosen)?.name || chosen;
                  setEditingRule({
                    ...editingRule,
                    actions: [
                      {
                        integrationId: chosen,
                        actionType: 'send_alert',
                        label: `Trigger ${appName}`,
                      },
                    ],
                  });
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              >
                {INTEGRATION_CATALOG.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Workflow Description</label>
              <textarea
                rows={2}
                value={editingRule.description}
                onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                placeholder="Describe automated incident response action..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRuleModalOpen(false);
                  setEditingRule(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busyRuleId !== null}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold"
              >
                Save Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
