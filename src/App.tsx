/**
 * PROJECT: FLAME IN FIREFALL
 * AI-Powered Space Habitat Environmental Monitoring and Risk Prediction System
 * NASA Space Apps Challenge
 */

import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import {
  DataMode,
  EnvironmentalTelemetry,
  FlameTestConfig,
  HabitatProfile,
  HabitatType,
  RiskAssessmentResult,
  RiskClassification,
  TelemetryHistoryPoint,
  AIRecommendation,
  SelfHealingAuditEntry,
  SelfHealingPermissionStatus,
  SelfHealingPlan,
} from './types/habitat';
import { HABITAT_PROFILES, DEFAULT_TELEMETRY } from './lib/constants';
import { calculateRiskAssessment } from './lib/riskEngine';
import { analyzeFlameConditions, DEFAULT_FLAME_TEST_CONFIG } from './lib/flamePhysics';
import { buildSelfHealingPlan, interpolateTelemetryForHealing } from './lib/selfHealing';
import {
  cloneThresholdsConfig,
  parseSingleHabitatThresholdsJson,
  syncLimitsFromThresholds,
} from './lib/thresholds';
import { HazardAlarmController } from './lib/hazardAudio';
import {
  AlertDispatchLogEntry,
  BrowserNotifPermissionState,
  buildEmergencyAlertContent,
  dispatchServerEmergencyAlert,
  fireBrowserEmergencyNotification,
  getBrowserNotificationPermission,
  isEmergencyTriggerClassification,
  requestBrowserNotificationPermission,
} from './lib/emergencyAlerts';
import {
  dispatchIntegrationEvent,
  fetchIntegrationHubState,
  logClientWorkspaceEvent,
  saveAutomationRule,
} from './lib/integrationsClient';
import {
  INTEGRATION_CATALOG,
  createDefaultAlertRoutingMatrix,
  createDefaultAutomationRules,
} from './lib/integrationCatalog';
import type {
  AlertRoutingMatrix,
  AlertRoutingSeverity,
  AutomationRuleRecord,
  IntegrationId,
  IntegrationLogEntry,
  IntegrationRecord,
} from './types/integrations';

import { useNasaSatelliteTime } from './lib/nasaClock';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  fetchThresholdConfigsFromFirestore,
  loginWithGoogle,
  logoutUser,
  testFirestoreConnection,
} from './lib/firebase';

import { Navigation, ActiveTab } from './components/Navigation';
import { StarfieldBackground } from './components/StarfieldBackground';
import { EmergencyAlertModal } from './components/EmergencyAlertModal';
import { SelfHealingBanner, SelfHealingModal } from './components/SelfHealingModal';
import { DashboardView } from './components/DashboardView';

const TeamInfoView = lazy(() => import('./components/TeamInfoView').then((m) => ({ default: m.TeamInfoView })));
const ResourcesView = lazy(() => import('./components/ResourcesView').then((m) => ({ default: m.ResourcesView })));
const IntegrationsView = lazy(() => import('./components/IntegrationsView').then((m) => ({ default: m.IntegrationsView })));
const EnvironmentView = lazy(() => import('./components/EnvironmentView').then((m) => ({ default: m.EnvironmentView })));
const RiskAssessmentView = lazy(() => import('./components/RiskAssessmentView').then((m) => ({ default: m.RiskAssessmentView })));
const RecommendationsView = lazy(() => import('./components/RecommendationsView').then((m) => ({ default: m.RecommendationsView })));
const PredictiveView = lazy(() => import('./components/PredictiveView').then((m) => ({ default: m.PredictiveView })));
const SimulationView = lazy(() => import('./components/SimulationView').then((m) => ({ default: m.SimulationView })));
const FlameLabView = lazy(() => import('./components/FlameLabView').then((m) => ({ default: m.FlameLabView })));
const EmergencyView = lazy(() => import('./components/EmergencyView').then((m) => ({ default: m.EmergencyView })));
const NasaIntegrationView = lazy(() => import('./components/NasaIntegrationView').then((m) => ({ default: m.NasaIntegrationView })));
const HistoricalView = lazy(() => import('./components/HistoricalView').then((m) => ({ default: m.HistoricalView })));
const AiAssistantView = lazy(() => import('./components/AiAssistantView').then((m) => ({ default: m.AiAssistantView })));

function buildInitialProfiles(): Record<HabitatType, HabitatProfile> {
  const profiles = {} as Record<HabitatType, HabitatProfile>;
  (Object.keys(HABITAT_PROFILES) as HabitatType[]).forEach((type) => {
    const base = HABITAT_PROFILES[type];
    let thresholds = cloneThresholdsConfig(base.thresholds);
    try {
      const saved = localStorage.getItem(`firefall_thresholds_${type}`);
      if (saved) {
        const parsed = parseSingleHabitatThresholdsJson(saved, thresholds);
        if (parsed.thresholds) {
          thresholds = parsed.thresholds;
        }
      }
    } catch {
      // Ignore storage access errors
    }
    profiles[type] = {
      ...base,
      thresholds,
      limits: syncLimitsFromThresholds(thresholds, base.limits),
    };
  });
  return profiles;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [envSubTab, setEnvSubTab] = useState<'telemetry' | 'thresholds'>('telemetry');
  const [habitatProfiles, setHabitatProfiles] = useState<Record<HabitatType, HabitatProfile>>(
    buildInitialProfiles
  );
  const [activeHabitatType, setActiveHabitatType] = useState<HabitatType>('iss');
  const habitat = habitatProfiles[activeHabitatType];
  const habitatProfilesRef = useRef(habitatProfiles);
  habitatProfilesRef.current = habitatProfiles;
  const activeHabitatTypeRef = useRef(activeHabitatType);
  activeHabitatTypeRef.current = activeHabitatType;

  const setHabitat: React.Dispatch<React.SetStateAction<HabitatProfile>> = useCallback((updater) => {
    const currentType = activeHabitatTypeRef.current;
    const current = habitatProfilesRef.current[currentType];
    const next = typeof updater === 'function' ? updater(current) : updater;
    setHabitatProfiles((prev) => ({
      ...prev,
      [next.type]: next,
    }));
    if (next.type !== currentType) {
      setActiveHabitatType(next.type);
    }
  }, []);

  const handleSelectHabitat = (type: HabitatType) => {
    setActiveHabitatType(type);
  };

  const handleUpdateHabitatProfile = (type: HabitatType, updated: HabitatProfile) => {
    setHabitatProfiles((prev) => ({
      ...prev,
      [type]: updated,
    }));
  };

  const [telemetry, setTelemetry] = useState<EnvironmentalTelemetry>(DEFAULT_TELEMETRY);
  const [dataMode, setDataMode] = useState<DataMode>('simulation');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);
  const [firestoreConnected, setFirestoreConnected] = useState<boolean | null>(null);
  const [themeVariant, setThemeVariant] = useState<'deep-space' | 'orbital'>(() => {
    try {
      const saved = localStorage.getItem('firefall_theme_variant');
      return saved === 'orbital' ? 'orbital' : 'deep-space';
    } catch {
      return 'deep-space';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeVariant);
    try {
      localStorage.setItem('firefall_theme_variant', themeVariant);
    } catch {
      // Ignore storage access errors
    }
  }, [themeVariant]);

  // Global Alarm, Browser Notification & Email/Phone Alert States
  const [globalAudioEnabled, setGlobalAudioEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<BrowserNotifPermissionState>(
    () => getBrowserNotificationPermission()
  );
  const [autoAlertOnCritical, setAutoAlertOnCritical] = useState(true);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertPhone, setAlertPhone] = useState('');
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertLogs, setAlertLogs] = useState<AlertDispatchLogEntry[]>([]);

  // 3D Flame Lab Multi-Condition Combustion State
  const [flameConfig, setFlameConfig] = useState<FlameTestConfig>(DEFAULT_FLAME_TEST_CONFIG);
  const handleUpdateFlameConfig = useCallback((patch: Partial<FlameTestConfig>) => {
    setFlameConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // Permission-Gated Self-Healing System State
  const [selfHealingStatus, setSelfHealingStatus] = useState<SelfHealingPermissionStatus>('idle');
  const [selfHealingPlan, setSelfHealingPlan] = useState<SelfHealingPlan | null>(null);
  const [selfHealingProgress, setSelfHealingProgress] = useState(0);
  const [isSelfHealingModalOpen, setIsSelfHealingModalOpen] = useState(false);
  const [sessionAutoHealPermitted, setSessionAutoHealPermitted] = useState(false);
  const [selfHealingLogs, setSelfHealingLogs] = useState<SelfHealingAuditEntry[]>([]);

  // Enterprise Integration Hub States
  const [hubIntegrations, setHubIntegrations] = useState<IntegrationRecord[]>(() =>
    INTEGRATION_CATALOG.map((def) => ({
      integrationId: def.id,
      enabled: false,
      status: 'not_configured',
      statusLabel: 'Not Configured',
      publicConfig: {},
      hasSecrets: false,
      maskedSecretSummary: '',
      updatedAt: new Date().toISOString(),
    }))
  );
  const [hubRouting, setHubRouting] = useState<AlertRoutingMatrix>(() => createDefaultAlertRoutingMatrix());
  const [hubRules, setHubRules] = useState<AutomationRuleRecord[]>(() => createDefaultAutomationRules());
  const [hubLogs, setHubLogs] = useState<IntegrationLogEntry[]>([]);
  const satelliteTime = useNasaSatelliteTime();

  const alarmControllerRef = useRef<HazardAlarmController | null>(null);
  const prevClassificationRef = useRef<RiskClassification>('normal');
  const prevHabitatTypeForAlarmRef = useRef<HabitatType>(activeHabitatType);
  const lastBrowserNotifAtRef = useRef<number>(0);
  const lastModalPromptTierRef = useRef<RiskClassification | null>(null);
  const lastHealPromptKeyRef = useRef<string | null>(null);
  const selfHealingStatusRef = useRef<SelfHealingPermissionStatus>('idle');
  selfHealingStatusRef.current = selfHealingStatus;
  const selfHealingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const healStartSnapshotRef = useRef<EnvironmentalTelemetry | null>(null);
  const lastRoutedTierRef = useRef<AlertRoutingSeverity | null>(null);
  const lastRuleFiredAtRef = useRef<Record<string, number>>({});
  const criticalEnteredAtRef = useRef<number | null>(null);

  // Telemetry History for Predictive Analytics & Recharts
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>(() => {
    // Seed initial 12 points representing past hour of steady monitoring
    const now = Date.now();
    return Array.from({ length: 12 }, (_, i) => {
      const t = new Date(now - (12 - i) * 60000);
      return {
        timestamp: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        elapsedSeconds: (i + 1) * 60,
        oxygenPercent: Number((20.9 + Math.sin(i * 0.4) * 0.2).toFixed(1)),
        carbonDioxidePpm: Math.round(1800 + Math.cos(i * 0.3) * 120),
        pressureKPa: Number((101.3 + Math.sin(i * 0.2) * 0.4).toFixed(1)),
        internalTemperatureC: Number((21.8 + Math.sin(i * 0.5) * 0.3).toFixed(1)),
        radiationDoseRateUSvH: Number((18.0 + Math.sin(i) * 1.5).toFixed(1)),
        riskScore: 12,
        healthScore: 88,
      };
    });
  });

  // Re-calculate deterministic risk assessment whenever telemetry or habitat thresholds change
  const assessment: RiskAssessmentResult = useMemo(() => {
    return calculateRiskAssessment(telemetry, habitat);
  }, [telemetry, habitat]);

  // Keep Flame Lab synchronized with habitat atmosphere when locked
  const effectiveFlameConfig = useMemo<FlameTestConfig>(() => {
    if (!flameConfig.syncWithHabitat) return flameConfig;
    return {
      ...flameConfig,
      oxygenPercent: Number(telemetry.oxygenPercent.toFixed(1)),
      pressureKPa: Number(telemetry.pressureKPa.toFixed(1)),
      airflowMs: Number(telemetry.airflowVelocity.toFixed(2)),
      humidityPercent: Math.round(telemetry.relativeHumidity),
      ambientTempC: Number(telemetry.internalTemperatureC.toFixed(1)),
    };
  }, [flameConfig, telemetry]);

  const flameAnalysis = useMemo(
    () => analyzeFlameConditions(effectiveFlameConfig),
    [effectiveFlameConfig]
  );

  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const assessmentRef = useRef(assessment);
  assessmentRef.current = assessment;

  // Periodic Telemetry History recording (every 6 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      const latestTelemetry = telemetryRef.current;
      const latestAssessment = assessmentRef.current;
      setLastUpdated(new Date().toLocaleTimeString());
      setHistory((prev) => {
        const lastSec = prev.length > 0 ? prev[prev.length - 1].elapsedSeconds + 6 : 6;
        const newPoint: TelemetryHistoryPoint = {
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          elapsedSeconds: lastSec,
          oxygenPercent: latestTelemetry.oxygenPercent,
          carbonDioxidePpm: latestTelemetry.carbonDioxidePpm,
          pressureKPa: latestTelemetry.pressureKPa,
          internalTemperatureC: latestTelemetry.internalTemperatureC,
          radiationDoseRateUSvH: latestTelemetry.radiationDoseRateUSvH,
          riskScore: latestAssessment.overallRiskScore,
          healthScore: latestAssessment.overallHealthScore,
        };
        // Keep last 30 points
        return [...prev.slice(-29), newPoint];
      });
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  // Validate Firestore connection on initial boot & subscribe to Firebase Auth state
  useEffect(() => {
    let active = true;
    testFirestoreConnection()
      .then((ok) => {
        if (active) setFirestoreConnected(ok);
      })
      .catch(() => {
        if (active) setFirestoreConnected(false);
      });

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!active) return;
      setFirebaseUser(user);
      if (user) {
        try {
          const cloudConfigs = await fetchThresholdConfigsFromFirestore();
          if (!active || cloudConfigs.length === 0) return;
          setHabitatProfiles((prev) => {
            const next = { ...prev };
            for (const cfg of cloudConfigs) {
              const type = cfg.habitatType as HabitatType;
              if (next[type] && cfg.thresholds) {
                const parsed = parseSingleHabitatThresholdsJson(
                  JSON.stringify(cfg.thresholds),
                  next[type].thresholds
                );
                if (parsed.thresholds) {
                  next[type] = {
                    ...next[type],
                    thresholds: parsed.thresholds,
                    limits: syncLimitsFromThresholds(parsed.thresholds, next[type].limits),
                  };
                }
              }
            }
            return next;
          });
        } catch {
          // Non-fatal if offline or no cloud configs saved yet
        }
      }
    });

    return () => {
      active = false;
      unsubAuth();
    };
  }, []);

  // Load Integration Hub state directly on mount (auto-provisions local signed operator token)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const snapshot = await fetchIntegrationHubState();
        if (cancelled) return;
        if (snapshot.integrations?.length) setHubIntegrations(snapshot.integrations);
        if (snapshot.routing) setHubRouting(snapshot.routing);
        if (snapshot.rules?.length) setHubRules(snapshot.rules);
        if (snapshot.logs?.length) setHubLogs(snapshot.logs);
      } catch {
        // Ignore transient load failures
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  // Global Audio Klaxon + Voice Warning Controller
  useEffect(() => {
    const ctrl = new HazardAlarmController();
    alarmControllerRef.current = ctrl;

    const unlockAudio = () => {
      ctrl.unlock();
    };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      ctrl.dispose();
      alarmControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctrl = alarmControllerRef.current;
    if (!ctrl) return;
    ctrl.setMuted(!globalAudioEnabled);
    ctrl.update(assessment.classification, assessment.overallRiskScore, assessment.hazards, telemetry);
  }, [globalAudioEnabled, assessment, telemetry]);

  const appendAlertLog = useCallback((entry: AlertDispatchLogEntry) => {
    setAlertLogs((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  const currentAlertContent = useMemo(
    () =>
      buildEmergencyAlertContent({
        habitat,
        assessment,
        telemetry,
        operatorName: 'Flight Commander',
      }),
    [habitat, assessment, telemetry]
  );

  const appendSelfHealingLog = useCallback(
    (entry: SelfHealingAuditEntry) => {
      setSelfHealingLogs((prev) => [entry, ...prev].slice(0, 30));
      try {
        const existingRaw = localStorage.getItem('firefall_mission_logs_v1');
        const existingLogs = existingRaw ? JSON.parse(existingRaw) : [];
        const missionEntry = {
          id: entry.id,
          habitatId: habitat.id,
          timestamp: entry.timestamp,
          author: 'Autonomous Self-Healing',
          category: entry.action === 'denied' ? 'warning' : 'normal',
          notes: `[SELF-HEAL ${entry.action.toUpperCase()}] ${entry.summary}`,
        };
        localStorage.setItem(
          'firefall_mission_logs_v1',
          JSON.stringify([missionEntry, ...(Array.isArray(existingLogs) ? existingLogs : [])].slice(0, 40))
        );
      } catch {
        // Ignore storage errors
      }
    },
    [habitat.id]
  );

  const clearSelfHealingInterval = useCallback(() => {
    if (selfHealingIntervalRef.current) {
      clearInterval(selfHealingIntervalRef.current);
      selfHealingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearSelfHealingInterval();
  }, [clearSelfHealingInterval]);

  const startSelfHealingExecution = useCallback(
    (planToRun: SelfHealingPlan, autoApproved: boolean) => {
      clearSelfHealingInterval();
      const snapshot = { ...telemetryRef.current };
      healStartSnapshotRef.current = snapshot;
      const nowIso = new Date().toISOString();

      appendSelfHealingLog({
        id: `sh_${Date.now()}_start`,
        timestamp: nowIso,
        action: autoApproved ? 'auto_approved' : 'approved',
        classification: planToRun.classification,
        riskScore: planToRun.riskScore,
        summary: `${autoApproved ? 'Session auto-approved' : 'Operator granted permission'} for ${
          planToRun.steps.length
        }-stage recovery on ${planToRun.habitatName}`,
      });

      setSelfHealingStatus('executing');
      setSelfHealingProgress(0.05);
      setSelfHealingPlan({
        ...planToRun,
        steps: planToRun.steps.map((s, idx) => ({
          ...s,
          status: idx === 0 ? 'active' : 'pending',
        })),
      });

      const totalMs = Math.max(2500, planToRun.estimatedDurationSec * 1000);
      const startedAt = Date.now();

      selfHealingIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        const progress = Math.min(1, elapsed / totalMs);
        setSelfHealingProgress(progress);

        if (healStartSnapshotRef.current) {
          const healed = interpolateTelemetryForHealing(healStartSnapshotRef.current, planToRun, progress);
          setTelemetry(healed);
        }

        const stepCount = planToRun.steps.length;
        const activeIdx = Math.min(stepCount - 1, Math.floor(progress * stepCount));
        setSelfHealingPlan((prev) =>
          prev
            ? {
                ...prev,
                steps: prev.steps.map((s, idx) => ({
                  ...s,
                  status: progress >= 1 || idx < activeIdx ? 'completed' : idx === activeIdx ? 'active' : 'pending',
                })),
              }
            : null
        );

        if (progress >= 1) {
          clearSelfHealingInterval();
          setSelfHealingStatus('completed');
          setFlameConfig((prev) => (prev.syncWithHabitat ? { ...prev, ignited: false } : prev));
          appendSelfHealingLog({
            id: `sh_${Date.now()}_done`,
            timestamp: new Date().toISOString(),
            action: 'completed',
            classification: planToRun.classification,
            riskScore: planToRun.riskScore,
            summary: `Completed ${planToRun.steps.length} self-healing stages; restored ${planToRun.habitatName} to nominal envelope`,
          });
        }
      }, 150);
    },
    [appendSelfHealingLog, clearSelfHealingInterval]
  );

  const handleRequestManualSelfHeal = useCallback(() => {
    if (selfHealingStatusRef.current === 'executing') {
      setIsSelfHealingModalOpen(true);
      return;
    }
    const plan = buildSelfHealingPlan(telemetryRef.current, habitat, assessmentRef.current);
    setSelfHealingPlan(plan);
    setSelfHealingProgress(0);
    setSelfHealingStatus('awaiting_permission');
    setIsSelfHealingModalOpen(true);
    appendSelfHealingLog({
      id: `sh_${Date.now()}_req`,
      timestamp: new Date().toISOString(),
      action: 'requested',
      classification: assessmentRef.current.classification,
      riskScore: assessmentRef.current.overallRiskScore,
      summary: `Manual self-healing diagnostic requested for ${habitat.name}`,
    });
  }, [appendSelfHealingLog, habitat]);

  const handleGrantSelfHealing = useCallback(
    (rememberForSession = false) => {
      if (rememberForSession) setSessionAutoHealPermitted(true);
      if (!selfHealingPlan) return;
      startSelfHealingExecution(selfHealingPlan, false);
    },
    [selfHealingPlan, startSelfHealingExecution]
  );

  const handleDenySelfHealing = useCallback(() => {
    setIsSelfHealingModalOpen(false);
    setSelfHealingStatus('denied');
    if (selfHealingPlan) {
      appendSelfHealingLog({
        id: `sh_${Date.now()}_deny`,
        timestamp: new Date().toISOString(),
        action: 'denied',
        classification: selfHealingPlan.classification,
        riskScore: selfHealingPlan.riskScore,
        summary: `Operator denied autonomous self-healing on ${selfHealingPlan.habitatName} (manual control retained)`,
      });
    }
  }, [appendSelfHealingLog, selfHealingPlan]);

  const handleAbortSelfHealing = useCallback(() => {
    clearSelfHealingInterval();
    setSelfHealingStatus('denied');
    setIsSelfHealingModalOpen(false);
    if (selfHealingPlan) {
      appendSelfHealingLog({
        id: `sh_${Date.now()}_abort`,
        timestamp: new Date().toISOString(),
        action: 'denied',
        classification: selfHealingPlan.classification,
        riskScore: selfHealingPlan.riskScore,
        summary: `Operator aborted active self-healing sequence on ${selfHealingPlan.habitatName}`,
      });
    }
  }, [appendSelfHealingLog, clearSelfHealingInterval, selfHealingPlan]);

  // Browser Notification API + Self-Healing Permission Trigger on Critical / Extreme Emergency
  useEffect(() => {
    const prevTier = prevClassificationRef.current;
    const currentTier = assessment.classification;
    prevClassificationRef.current = currentTier;

    const prevHabType = prevHabitatTypeForAlarmRef.current;
    const switchedHabitat = prevHabType !== habitat.type;
    prevHabitatTypeForAlarmRef.current = habitat.type;

    if (!isEmergencyTriggerClassification(currentTier)) {
      lastModalPromptTierRef.current = null;
      lastHealPromptKeyRef.current = null;
      if (selfHealingStatusRef.current === 'awaiting_permission' || selfHealingStatusRef.current === 'denied') {
        setSelfHealingStatus('idle');
        setIsSelfHealingModalOpen(false);
      }
      return;
    }

    const now = Date.now();
    const enteredEmergency = !isEmergencyTriggerClassification(prevTier);
    const escalatedToExtreme = prevTier === 'critical' && currentTier === 'extreme_emergency';
    const backgroundReminderDue =
      document.visibilityState === 'hidden' && now - lastBrowserNotifAtRef.current > 45000;

    if (enteredEmergency || escalatedToExtreme || backgroundReminderDue) {
      lastBrowserNotifAtRef.current = now;
      const delivered = fireBrowserEmergencyNotification({
        title: currentAlertContent.notificationTitle,
        body: currentAlertContent.notificationBody,
        tag: `tejasvi-emergency-${habitat.type}`,
        onClick: () => setActiveTab('emergency'),
      });
      if (delivered) {
        appendAlertLog({
          id: `notif_${now}`,
          timestamp: new Date(now).toISOString(),
          channel: 'browser',
          target: 'Desktop / Background Notification',
          status: 'delivered',
          deliveryMode: 'browser-notification-api',
          subject: currentAlertContent.notificationTitle,
          detail:
            document.visibilityState === 'hidden'
              ? 'Fired while app was in background'
              : 'Fired on risk threshold breach',
        });
      }
    }

    // Ask operator permission for Self-Healing when alarm hits
    const promptKey = `${habitat.type}:${currentTier}`;
    if (
      (enteredEmergency || escalatedToExtreme || (switchedHabitat && selfHealingStatusRef.current === 'awaiting_permission')) &&
      selfHealingStatusRef.current !== 'executing' &&
      lastHealPromptKeyRef.current !== promptKey
    ) {
      lastHealPromptKeyRef.current = promptKey;
      const plan = buildSelfHealingPlan(telemetryRef.current, habitat, assessment);
      setSelfHealingPlan(plan);
      setSelfHealingProgress(0);

      if (sessionAutoHealPermitted) {
        startSelfHealingExecution(plan, true);
      } else {
        setSelfHealingStatus('awaiting_permission');
        if (!switchedHabitat) {
          setIsSelfHealingModalOpen(true);
        }
        appendSelfHealingLog({
          id: `sh_${now}_alarm`,
          timestamp: new Date(now).toISOString(),
          action: 'requested',
          classification: currentTier,
          riskScore: assessment.overallRiskScore,
          summary: `Alarm hit (${currentTier.replace('_', ' ')}): requesting operator permission to self-heal ${habitat.name}`,
        });
      }
    } else if (
      !switchedHabitat &&
      autoAlertOnCritical &&
      lastModalPromptTierRef.current !== currentTier &&
      (enteredEmergency || escalatedToExtreme)
    ) {
      lastModalPromptTierRef.current = currentTier;
      setIsAlertModalOpen(true);
    }
  }, [
    assessment,
    currentAlertContent,
    habitat,
    autoAlertOnCritical,
    appendAlertLog,
    appendSelfHealingLog,
    sessionAutoHealPermitted,
    startSelfHealingExecution,
  ]);

  // Smart Alert Routing + Automated Workflows Evaluation Engine
  useEffect(() => {
    const now = Date.now();
    const mappedSeverity: AlertRoutingSeverity =
      assessment.classification === 'normal'
        ? 'normal'
        : assessment.classification === 'caution' || assessment.classification === 'high_risk'
        ? 'warning'
        : 'critical';

    if (mappedSeverity === 'critical') {
      if (!criticalEnteredAtRef.current) criticalEnteredAtRef.current = now;
    } else {
      criticalEnteredAtRef.current = null;
    }

    // 1. Evaluate Smart Alert Routing on transitions (excluding initial nominal boot)
    if (lastRoutedTierRef.current !== mappedSeverity) {
      const wasUninitialized = lastRoutedTierRef.current === null;
      lastRoutedTierRef.current = mappedSeverity;

      if (!(wasUninitialized && mappedSeverity === 'normal')) {
        const routeRow = hubRouting[mappedSeverity] || {};
        const enabledIds = Object.keys(routeRow).filter((k) => routeRow[k]);
        const summaryTitle = `${mappedSeverity.toUpperCase()} Habitat Alert: ${habitat.name}`;
        const summaryMsg = `Risk ${assessment.overallRiskScore}/100 (${assessment.classification.replace('_', ' ')}). O2: ${telemetry.oxygenPercent.toFixed(1)}%, CO2: ${telemetry.carbonDioxidePpm} ppm, P: ${telemetry.pressureKPa.toFixed(1)} kPa, T: ${telemetry.internalTemperatureC.toFixed(1)} C.`;

        for (const chId of enabledIds) {
          if (chId === 'mission_history') {
            try {
              const existingRaw = localStorage.getItem('firefall_mission_logs_v1');
              const existingLogs = existingRaw ? JSON.parse(existingRaw) : [];
              const nextEntry = {
                id: `log_${now}`,
                habitatId: habitat.id,
                timestamp: new Date(now).toISOString(),
                author: 'Alert Routing Engine',
                category: mappedSeverity,
                notes: `${summaryTitle} — ${summaryMsg}`,
              };
              const nextList = [nextEntry, ...(Array.isArray(existingLogs) ? existingLogs : [])].slice(0, 40);
              localStorage.setItem('firefall_mission_logs_v1', JSON.stringify(nextList));
            } catch {
              // Ignore storage quota errors
            }
            continue;
          }

          const rec = hubIntegrations.find((r) => r.integrationId === chId);
          if (!rec || rec.status !== 'connected') continue;

          dispatchIntegrationEvent(chId as IntegrationId, {
            eventType: 'alert_routing',
            severity: mappedSeverity,
            title: summaryTitle,
            message: summaryMsg,
            dedupeKey: `${habitat.type}:${mappedSeverity}`,
            telemetrySummary: {
              oxygenPercent: telemetry.oxygenPercent,
              carbonDioxidePpm: telemetry.carbonDioxidePpm,
              pressureKPa: telemetry.pressureKPa,
              riskScore: assessment.overallRiskScore,
            },
          })
            .then((res) => {
              if (res.logs?.length) setHubLogs(res.logs);
            })
            .catch(() => undefined);
        }
      }
    }

    // 2. Evaluate Enabled Automation Rules
    for (const rule of hubRules) {
      if (!rule.enabled) continue;
      let triggered = false;
      const cond = rule.condition;
      if (cond.triggerType === 'oxygen_below') {
        triggered = telemetry.oxygenPercent < (cond.thresholdValue ?? 19.5);
      } else if (cond.triggerType === 'pressure_abnormal') {
        triggered =
          telemetry.pressureKPa < (cond.thresholdValue ?? 95) ||
          telemetry.pressureKPa > (cond.secondaryUpperValue ?? 105);
      } else if (cond.triggerType === 'co2_above') {
        triggered = telemetry.carbonDioxidePpm > (cond.thresholdValue ?? 5000);
      } else if (cond.triggerType === 'fire_or_smoke') {
        triggered = Boolean(telemetry.fireDetected || telemetry.smokeDetected);
      } else if (cond.triggerType === 'sensor_disconnected') {
        triggered =
          telemetry.co2ScrubberStatus === 'failed' ||
          telemetry.oxygenGenStatus === 'fault' ||
          telemetry.coolingSystemStatus === 'failed';
      } else if (cond.triggerType === 'critical_unacknowledged') {
        const waitMs = (cond.unacknowledgedMinutes ?? 3) * 60_000;
        triggered = Boolean(
          criticalEnteredAtRef.current &&
            now - criticalEnteredAtRef.current >= waitMs &&
            assessment.classification !== 'normal'
        );
      }

      if (!triggered) continue;
      const cooldownMs = (rule.cooldownSeconds || 120) * 1000;
      const lastAt = lastRuleFiredAtRef.current[rule.id] || 0;
      if (now - lastAt < cooldownMs) continue;
      lastRuleFiredAtRef.current[rule.id] = now;

      const updatedRule: AutomationRuleRecord = {
        ...rule,
        lastTriggeredAt: new Date(now).toISOString(),
        executionCount: (rule.executionCount || 0) + 1,
        updatedAt: new Date(now).toISOString(),
      };
      setHubRules((prev) => prev.map((r) => (r.id === rule.id ? updatedRule : r)));
      saveAutomationRule(updatedRule).catch(() => undefined);

      for (const act of rule.actions) {
        if (act.integrationId === 'mission_history' || act.integrationId === 'maintenance_team') {
          logClientWorkspaceEvent({
            integrationId: act.integrationId,
            applicationName: act.integrationId === 'mission_history' ? 'Mission History' : 'Technical Maintenance',
            eventType: 'automation_rule',
            status: 'delivered',
            severity: 'critical',
            detail: `Automation "${rule.name}" executed: ${act.label}.`,
          })
            .then((r) => {
              if (r.logs?.length) setHubLogs(r.logs);
            })
            .catch(() => undefined);
          continue;
        }

        const rec = hubIntegrations.find((r) => r.integrationId === act.integrationId);
        if (!rec || rec.status !== 'connected') continue;

        dispatchIntegrationEvent(act.integrationId, {
          eventType: 'automation_rule',
          severity: 'critical',
          title: `Automation Rule Triggered: ${rule.name}`,
          message: `${rule.description} (Habitat: ${habitat.name}, Risk: ${assessment.overallRiskScore}/100).`,
          dedupeKey: `rule:${rule.id}`,
        })
          .then((res) => {
            if (res.logs?.length) setHubLogs(res.logs);
          })
          .catch(() => undefined);
      }
    }
  }, [assessment, telemetry, habitat, hubRouting, hubRules, hubIntegrations]);

  const handleRequestNotificationPermission = async (): Promise<BrowserNotifPermissionState> => {
    const perm = await requestBrowserNotificationPermission();
    setNotificationPermission(perm);
    return perm;
  };

  const handleToggleGlobalAudio = () => {
    setGlobalAudioEnabled((prev) => {
      const next = !prev;
      if (next) {
        alarmControllerRef.current?.unlock();
      }
      return next;
    });
  };

  const handleTriggerGlobalTestAlarm = () => {
    setGlobalAudioEnabled(true);
    alarmControllerRef.current?.setMuted(false);
    alarmControllerRef.current?.triggerTestSequence(
      assessment.classification,
      assessment.overallRiskScore,
      assessment.hazards,
      telemetry
    );
  };

  const handleTestAlarmAndNotification = async (delaySeconds = 0) => {
    handleTriggerGlobalTestAlarm();
    let perm = getBrowserNotificationPermission();
    if (perm === 'default') {
      perm = await handleRequestNotificationPermission();
    } else {
      setNotificationPermission(perm);
    }

    const executeTest = () => {
      const now = Date.now();
      const testTitle =
        assessment.classification === 'normal'
          ? `CRITICAL TEST ALERT: ${habitat.name}`
          : currentAlertContent.notificationTitle;
      const testBody =
        assessment.classification === 'normal'
          ? `Emergency klaxon & background notification test verified. O2 ${telemetry.oxygenPercent.toFixed(
              1
            )}% · CO2 ${telemetry.carbonDioxidePpm} ppm · P ${telemetry.pressureKPa.toFixed(1)} kPa.`
          : currentAlertContent.notificationBody;

      const sent = fireBrowserEmergencyNotification({
        title: testTitle,
        body: testBody,
        tag: `tejasvi-test-${now}`,
        onClick: () => setActiveTab('emergency'),
      });

      appendAlertLog({
        id: `test_notif_${now}`,
        timestamp: new Date(now).toISOString(),
        channel: 'browser',
        target: 'Browser Notification API',
        status: sent ? 'delivered' : 'failed',
        deliveryMode: 'browser-notification-api',
        subject: testTitle,
        detail: sent
          ? 'Test notification & audio alarm triggered'
          : `Notification permission is "${perm}" — enable browser notifications to display OS banners`,
      });
    };

    if (delaySeconds > 0) {
      window.setTimeout(executeTest, delaySeconds * 1000);
    } else {
      executeTest();
    }
  };

  const handleConfirmAlertDispatch = async (options: {
    sendEmail: boolean;
    emailTarget: string;
    sendPhone: boolean;
    phoneTarget: string;
  }): Promise<{ emailOutcome?: string; phoneOutcome?: string }> => {
    const outcomes: { emailOutcome?: string; phoneOutcome?: string } = {};
    const operatorName = 'Flight Commander';

    if (options.sendEmail && options.emailTarget) {
      setAlertEmail(options.emailTarget);
      const res = await dispatchServerEmergencyAlert({
        target: options.emailTarget,
        channel: 'email',
        operatorName,
        habitat,
        assessment,
        telemetry,
        triggeredAt: currentAlertContent.triggeredAt,
      });
      outcomes.emailOutcome =
        res.status === 'delivered'
          ? `Delivered via email relay to ${res.maskedTarget}`
          : `Dispatched to email alert relay for ${res.maskedTarget} (Alert ID ${res.alertId})`;
      appendAlertLog({
        id: res.alertId,
        timestamp: res.timestamp,
        channel: 'email',
        target: res.maskedTarget,
        status: res.status,
        deliveryMode: res.deliveryMode,
        subject: res.subject,
        detail:
          res.status === 'delivered'
            ? 'Delivered via server email webhook'
            : 'Dispatched to server email alert relay',
      });
    }

    if (options.sendPhone && options.phoneTarget) {
      setAlertPhone(options.phoneTarget);
      const res = await dispatchServerEmergencyAlert({
        target: options.phoneTarget,
        channel: 'phone',
        operatorName,
        habitat,
        assessment,
        telemetry,
        triggeredAt: currentAlertContent.triggeredAt,
      });
      outcomes.phoneOutcome =
        res.status === 'delivered'
          ? `SMS delivered via ${res.deliveryMode} to ${res.maskedTarget}`
          : `Dispatched via server alert gateway to ${res.maskedTarget} (Alert ID ${res.alertId})`;
      appendAlertLog({
        id: res.alertId,
        timestamp: res.timestamp,
        channel: 'phone',
        target: res.maskedTarget,
        status: res.status,
        deliveryMode: res.deliveryMode,
        subject: res.subject,
        detail:
          res.status === 'delivered'
            ? `Delivered via ${res.deliveryMode}`
            : 'Dispatched to server SMS gateway preview',
      });
    }

    return outcomes;
  };

  const handleResetNominal = () => {
    setTelemetry(DEFAULT_TELEMETRY);
  };

  const navigateWithThresholdShortcut = (tab: ActiveTab, subTab?: 'telemetry' | 'thresholds') => {
    if (subTab) setEnvSubTab(subTab);
    setActiveTab(tab);
  };

  return (
    <div className="relative min-h-screen bg-[var(--ds-canvas)] aerospace-grid-bg text-slate-200 flex flex-col font-sans transition-colors duration-200">
      <StarfieldBackground />

      {/* Navigation Top Bar Contract & Collapsible Module Rail */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        habitat={habitat}
        classification={assessment.classification}
        dataMode={dataMode}
        setDataMode={setDataMode}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        notificationPermission={notificationPermission}
        globalAudioEnabled={globalAudioEnabled}
        onToggleGlobalAudio={handleToggleGlobalAudio}
        onOpenAlertHub={() => setActiveTab('emergency')}
        satelliteTime={satelliteTime}
        firebaseUser={firebaseUser}
        firestoreConnected={firestoreConnected}
        themeVariant={themeVariant}
        onChangeThemeVariant={setThemeVariant}
        onFirebaseLogin={async () => {
          try {
            await loginWithGoogle();
          } catch {
            // Popup errors handled cleanly in loginWithGoogle
          }
        }}
        onFirebaseLogout={async () => {
          await logoutUser();
        }}
      />

      <EmergencyAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        alertContent={currentAlertContent}
        defaultEmail={alertEmail}
        defaultPhone={alertPhone}
        isAlarmMuted={!globalAudioEnabled}
        onToggleAlarmMute={handleToggleGlobalAudio}
        onConfirmDispatch={handleConfirmAlertDispatch}
      />

      <SelfHealingModal
        isOpen={isSelfHealingModalOpen}
        onClose={() => setIsSelfHealingModalOpen(false)}
        status={selfHealingStatus}
        plan={selfHealingPlan}
        progress={selfHealingProgress}
        sessionAutoHealPermitted={sessionAutoHealPermitted}
        onGrantPermission={handleGrantSelfHealing}
        onDenyPermission={handleDenySelfHealing}
        onAbortExecution={handleAbortSelfHealing}
      />

      {/* Main Workspace Viewport */}
      <div className="relative z-10 flex-1 lg:pl-64 transition-all duration-200">
        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          <SelfHealingBanner
            status={selfHealingStatus}
            plan={selfHealingPlan}
            progress={selfHealingProgress}
            onOpenModal={() => setIsSelfHealingModalOpen(true)}
            onGrantQuick={() => handleGrantSelfHealing(false)}
            onDenyQuick={handleDenySelfHealing}
            onAbort={handleAbortSelfHealing}
            onDismissCompleted={() => setSelfHealingStatus('idle')}
          />

          {activeTab === 'dashboard' && (
            <DashboardView
              telemetry={telemetry}
              habitat={habitat}
              habitatProfiles={habitatProfiles}
              onSelectHabitat={handleSelectHabitat}
              assessment={assessment}
              onNavigate={(tab) => navigateWithThresholdShortcut(tab)}
              lastUpdated={lastUpdated}
              globalAudioEnabled={globalAudioEnabled}
              onToggleGlobalAudio={handleToggleGlobalAudio}
              onTriggerGlobalTestAlarm={handleTriggerGlobalTestAlarm}
              flameConfig={effectiveFlameConfig}
              flameAnalysis={flameAnalysis}
              onUpdateFlameConfig={handleUpdateFlameConfig}
              selfHealingActive={selfHealingStatus === 'executing'}
              selfHealingStatusLabel={
                selfHealingStatus === 'executing'
                  ? `SELF-HEALING ACTIVE · ${Math.round(selfHealingProgress * 100)}%`
                  : undefined
              }
              onRequestSelfHeal={handleRequestManualSelfHeal}
              satelliteTime={satelliteTime}
            />
          )}

          <Suspense
            fallback={
              <div className="panel-surface rounded-xl p-8 text-center font-mono text-xs text-cyan-300">
                Loading Mission Module…
              </div>
            }
          >
            {activeTab === 'environment' && (
            <EnvironmentView
              telemetry={telemetry}
              setTelemetry={setTelemetry}
              habitat={habitat}
              setHabitat={setHabitat}
              habitatProfiles={habitatProfiles}
              onSelectHabitat={handleSelectHabitat}
              onUpdateHabitatThresholds={handleUpdateHabitatProfile}
              assessment={assessment}
              subTab={envSubTab}
              setSubTab={setEnvSubTab}
              onResetNominal={handleResetNominal}
              globalAudioEnabled={globalAudioEnabled}
              onToggleGlobalAudio={handleToggleGlobalAudio}
              onTriggerGlobalTestAlarm={handleTriggerGlobalTestAlarm}
              flameConfig={effectiveFlameConfig}
              flameAnalysis={flameAnalysis}
              onUpdateFlameConfig={handleUpdateFlameConfig}
              selfHealingActive={selfHealingStatus === 'executing'}
              selfHealingStatusLabel={
                selfHealingStatus === 'executing'
                  ? `SELF-HEALING ACTIVE · ${Math.round(selfHealingProgress * 100)}%`
                  : undefined
              }
              onOpenFlameLab={() => setActiveTab('flame-lab')}
            />
          )}

          {activeTab === 'risk' && (
            <RiskAssessmentView
              assessment={assessment}
              telemetry={telemetry}
              habitat={habitat}
              onNavigate={(tab) => navigateWithThresholdShortcut(tab, tab === 'environment' ? 'thresholds' : undefined)}
            />
          )}

          {activeTab === 'recommendations' && (
            <RecommendationsView
              recommendations={recommendations}
              setRecommendations={setRecommendations}
              telemetry={telemetry}
              habitat={habitat}
              assessment={assessment}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'predictive' && (
            <PredictiveView
              telemetry={telemetry}
              habitat={habitat}
              history={history}
            />
          )}

          {activeTab === 'simulation' && (
            <SimulationView
              telemetry={telemetry}
              setTelemetry={setTelemetry}
              habitat={habitat}
              habitatProfiles={habitatProfiles}
              onSelectHabitat={handleSelectHabitat}
              assessment={assessment}
              onResetNominal={handleResetNominal}
              onNavigate={setActiveTab}
              globalAudioEnabled={globalAudioEnabled}
              onToggleGlobalAudio={handleToggleGlobalAudio}
              onTriggerGlobalTestAlarm={handleTriggerGlobalTestAlarm}
              flameConfig={effectiveFlameConfig}
              flameAnalysis={flameAnalysis}
              onUpdateFlameConfig={handleUpdateFlameConfig}
              selfHealingActive={selfHealingStatus === 'executing'}
              selfHealingStatusLabel={
                selfHealingStatus === 'executing'
                  ? `SELF-HEALING ACTIVE · ${Math.round(selfHealingProgress * 100)}%`
                  : undefined
              }
            />
          )}

          {activeTab === 'flame-lab' && (
            <FlameLabView
              telemetry={telemetry}
              habitat={habitat}
              habitatProfiles={habitatProfiles}
              onSelectHabitat={handleSelectHabitat}
              assessment={assessment}
              flameConfig={effectiveFlameConfig}
              flameAnalysis={flameAnalysis}
              onUpdateFlameConfig={handleUpdateFlameConfig}
              globalAudioEnabled={globalAudioEnabled}
              onToggleGlobalAudio={handleToggleGlobalAudio}
              onTriggerGlobalTestAlarm={handleTriggerGlobalTestAlarm}
              selfHealingActive={selfHealingStatus === 'executing'}
              selfHealingStatusLabel={
                selfHealingStatus === 'executing'
                  ? `SELF-HEALING ACTIVE · ${Math.round(selfHealingProgress * 100)}%`
                  : undefined
              }
            />
          )}

          {activeTab === 'emergency' && (
            <EmergencyView
              telemetry={telemetry}
              habitat={habitat}
              assessment={assessment}
              onNavigate={setActiveTab}
              notificationPermission={notificationPermission}
              onRequestNotificationPermission={handleRequestNotificationPermission}
              autoAlertOnCritical={autoAlertOnCritical}
              setAutoAlertOnCritical={setAutoAlertOnCritical}
              globalAudioEnabled={globalAudioEnabled}
              onToggleGlobalAudio={handleToggleGlobalAudio}
              onTestAlarmAndNotification={handleTestAlarmAndNotification}
              alertEmail={alertEmail}
              setAlertEmail={setAlertEmail}
              alertPhone={alertPhone}
              setAlertPhone={setAlertPhone}
              onOpenAlertConfirmModal={() => setIsAlertModalOpen(true)}
              alertLogs={alertLogs}
              selfHealingStatus={selfHealingStatus}
              selfHealingLogs={selfHealingLogs}
              onRequestSelfHeal={handleRequestManualSelfHeal}
            />
          )}

          {activeTab === 'integrations' && (
            <IntegrationsView
              integrations={hubIntegrations}
              setIntegrations={setHubIntegrations}
              routing={hubRouting}
              setRouting={setHubRouting}
              rules={hubRules}
              setRules={setHubRules}
              logs={hubLogs}
              setLogs={setHubLogs}
              telemetry={telemetry}
              habitat={habitat}
              assessment={assessment}
              onNavigateNasa={() => setActiveTab('nasa')}
            />
          )}

          {activeTab === 'nasa' && (
            <NasaIntegrationView
              dataMode={dataMode}
              setDataMode={setDataMode}
              telemetry={telemetry}
              setTelemetry={setTelemetry}
              satelliteTime={satelliteTime}
            />
          )}

          {activeTab === 'historical' && (
            <HistoricalView
              history={history}
              telemetry={telemetry}
              habitat={habitat}
              assessment={assessment}
            />
          )}

          {activeTab === 'assistant' && (
            <AiAssistantView
              telemetry={telemetry}
              habitat={habitat}
              assessment={assessment}
            />
          )}

          {activeTab === 'team' && (
            <TeamInfoView
              isAuthenticated={true}
              onNavigateModule={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'resources' && <ResourcesView />}
          </Suspense>

          <footer className="mt-10 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-500">
            <span>Project Flame in Firefall · Built by Team Tejasvi · NASA Space Apps Challenge</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Team Tejasvi Info
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('resources')}
                className="text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Resources & Credits
              </button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
