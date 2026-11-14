import React from 'react';
import {
  EnvironmentalTelemetry,
  FlameAnalysisResult,
  FlameTestConfig,
  HabitatProfile,
  HabitatType,
  RiskAssessmentResult,
  RiskClassification,
} from '../types/habitat';
import { LiveNasaClockState } from '../lib/nasaClock';
import {
  getScoreAccent,
  getTelemetryMetricAccent,
  TelemetryAccentClasses,
} from '../lib/telemetryAccent';
import { ThreeHabitatCanvas } from './ThreeHabitatCanvas';
import { HabitatSelectorBar } from './HabitatSelectorBar';
import { TeamLogo } from './TeamLogo';
import {
  Wind,
  Gauge,
  Thermometer,
  Droplets,
  Zap,
  Shield,
  AlertTriangle,
  Users,
  Flame,
  Radio,
  Clock,
  ArrowRight,
  HeartPulse,
  Dna,
  ShieldCheck,
  Satellite,
  RefreshCw,
} from 'lucide-react';

interface Props {
  telemetry: EnvironmentalTelemetry;
  habitat: HabitatProfile;
  habitatProfiles: Record<HabitatType, HabitatProfile>;
  onSelectHabitat: (type: HabitatType) => void;
  assessment: RiskAssessmentResult;
  onNavigate: (tab: any) => void;
  lastUpdated: string;
  globalAudioEnabled?: boolean;
  onToggleGlobalAudio?: () => void;
  onTriggerGlobalTestAlarm?: () => void;
  flameConfig?: FlameTestConfig;
  flameAnalysis?: FlameAnalysisResult;
  onUpdateFlameConfig?: (patch: Partial<FlameTestConfig>) => void;
  selfHealingActive?: boolean;
  selfHealingStatusLabel?: string;
  onRequestSelfHeal?: () => void;
  satelliteTime?: LiveNasaClockState;
}

interface EnvelopeBarProps {
  value: number;
  domainMin: number;
  domainMax: number;
  safeMin: number;
  safeMax: number;
  accent: TelemetryAccentClasses;
}

const NominalEnvelopeBar: React.FC<EnvelopeBarProps> = ({
  value,
  domainMin,
  domainMax,
  safeMin,
  safeMax,
  accent,
}) => {
  const span = Math.max(0.0001, domainMax - domainMin);
  const clampPct = (v: number) => Math.max(0, Math.min(100, ((v - domainMin) / span) * 100));
  const safeLeft = clampPct(safeMin);
  const safeWidth = Math.max(4, clampPct(safeMax) - safeLeft);
  const markerLeft = clampPct(value);

  return (
    <div className="relative h-1.5 w-full rounded-full bg-slate-800/90 mt-2 overflow-hidden">
      <div
        className={`absolute top-0 bottom-0 transition-colors duration-300 ${accent.envelopeBand}`}
        style={{ left: `${safeLeft}%`, width: `${safeWidth}%` }}
      />
      <div
        className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full transition-all duration-300 ${accent.barFill}`}
        style={{ left: `${markerLeft}%` }}
      />
    </div>
  );
};

export const DashboardView: React.FC<Props> = ({
  telemetry,
  habitat,
  habitatProfiles,
  onSelectHabitat,
  assessment,
  onNavigate,
  lastUpdated,
  globalAudioEnabled,
  onToggleGlobalAudio,
  onTriggerGlobalTestAlarm,
  flameConfig,
  flameAnalysis,
  onUpdateFlameConfig,
  selfHealingActive,
  selfHealingStatusLabel,
  onRequestSelfHeal,
  satelliteTime,
}) => {
  const getRiskTextColor = (score: number) => {
    if (score >= 55) return 'text-red-400';
    if (score >= 25) return 'text-amber-400';
    return 'text-cyan-300';
  };

  const getRiskBarColor = (score: number) => {
    if (score >= 55) return 'bg-red-600';
    if (score >= 25) return 'bg-amber-400';
    return 'bg-cyan-400';
  };

  const getClassificationBadge = (c: RiskClassification) => {
    switch (c) {
      case 'extreme_emergency':
        return { text: 'EXTREME EMERGENCY', color: 'bg-red-950/90 border-red-600 text-red-200' };
      case 'critical':
        return { text: 'CRITICAL HAZARD', color: 'bg-red-950/90 border-red-600 text-red-200' };
      case 'high_risk':
        return { text: 'HIGH RISK', color: 'bg-amber-950/85 border-amber-500 text-amber-200' };
      case 'caution':
        return { text: 'CAUTION', color: 'bg-amber-950/75 border-amber-500/80 text-amber-200' };
      default:
        return { text: 'NOMINAL (NORMAL)', color: 'bg-cyan-950/80 border-cyan-500/60 text-cyan-200' };
    }
  };

  const badge = getClassificationBadge(assessment.classification);
  const iss = satelliteTime?.snapshot?.iss;

  const healthAccent = getScoreAccent(assessment.overallHealthScore, true);
  const riskAccent = getScoreAccent(assessment.overallRiskScore, false);

  const o2Accent = getTelemetryMetricAccent(telemetry, habitat, 'oxygenPercent');
  const co2Accent = getTelemetryMetricAccent(telemetry, habitat, 'carbonDioxidePpm');
  const pressureAccent = getTelemetryMetricAccent(telemetry, habitat, 'pressureKPa');
  const tempAccent = getTelemetryMetricAccent(telemetry, habitat, 'internalTemperatureC');
  const airflowAccent = getTelemetryMetricAccent(telemetry, habitat, 'airflowVelocity');
  const radiationAccent = getTelemetryMetricAccent(telemetry, habitat, 'radiationDoseRateUSvH');
  const fireAccent = getTelemetryMetricAccent(telemetry, habitat, 'fireSmoke');
  const powerAccent = getTelemetryMetricAccent(telemetry, habitat, 'powerSupplyPercent');
  const reserveAccent = getTelemetryMetricAccent(telemetry, habitat, 'oxygenReserveHours');
  const scrubberAccent = getTelemetryMetricAccent(telemetry, habitat, 'co2ScrubberStatus');
  const waterAccent = getTelemetryMetricAccent(telemetry, habitat, 'waterAvailabilityPercent');
  const humidityAccent = getTelemetryMetricAccent(telemetry, habitat, 'relativeHumidity');

  return (
    <div className="space-y-6">
      {/* MISSION COMMAND HEADER WITH TEAM TEJASVI LOGO & LIVE NASA SATELLITE CLOCK */}
      <section
        className="panel-surface rounded-xl p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4"
        data-testid="mission-command-header"
      >
        <div className="flex items-center gap-4 min-w-0">
          <TeamLogo className="w-14 h-14 sm:w-16 sm:h-16" />
          <div className="min-w-0">
            <div className="text-[11px] font-mono uppercase tracking-widest text-cyan-400">
              Team Tejasvi · NASA Space Apps Challenge
            </div>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-wide text-white truncate">
              FLAME IN FIREFALL — MISSION CONTROL
            </h1>
            <div className="text-xs font-mono text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-slate-200 font-semibold">{habitat.name}</span>
              <span>·</span>
              <span>Vol {habitat.volumeM3} m³</span>
              <span>·</span>
              <span>
                Crew {habitat.activeOccupants}/{habitat.maxOccupancy}
              </span>
              <span>·</span>
              <span className="text-emerald-400">● {habitat.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Live NASA Free Satellite UTC Time & ISS Orbital Ephemeris */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div
            className="px-3.5 py-2.5 rounded-lg bg-[#050811] border border-slate-800 flex items-center justify-between gap-4"
            data-testid="dashboard-nasa-satellite-clock"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-cyan-400">
                <Satellite className="w-3.5 h-3.5" />
                <span>
                  {satelliteTime?.snapshot?.satelliteSyncActive
                    ? 'NASA Satellite UTC Sync'
                    : 'Mission UTC Clock'}
                </span>
              </div>
              <div className="text-base sm:text-lg font-bold font-mono tabular-nums text-white tracking-tight">
                {satelliteTime ? `${satelliteTime.utcDate} · ${satelliteTime.utcTime}` : lastUpdated}
              </div>
              <div className="text-[10px] font-mono text-slate-400 truncate max-w-[260px]">
                {satelliteTime?.snapshot?.source || 'DSCOVR EPIC + ISS NORAD 25544'}
              </div>
            </div>
            {satelliteTime && (
              <button
                type="button"
                onClick={() => satelliteTime.refreshSync()}
                disabled={satelliteTime.syncing}
                title="Re-sync exact date & time from NASA satellites"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${satelliteTime.syncing ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {iss && (
            <button
              type="button"
              onClick={() => onNavigate('nasa')}
              className="px-3.5 py-2.5 rounded-lg bg-[#050811] border border-slate-800 hover:border-cyan-500/50 text-left transition-colors"
            >
              <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
                ISS NORAD {iss.noradId} · {iss.visibility.toUpperCase()}
              </div>
              <div className="text-xs font-mono font-bold tabular-nums text-white mt-0.5">
                {iss.latitude.toFixed(2)}° LAT · {iss.longitude.toFixed(2)}° LON
              </div>
              <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-0.5">
                ALT {iss.altitudeKm.toFixed(1)} km · {Math.round(iss.velocityKmh).toLocaleString()} km/h
              </div>
            </button>
          )}
        </div>
      </section>

      {/* SECTION A: OVERALL HABITAT STATUS STRIP */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* Environmental Health Score */}
        <div className={`panel-surface rounded-xl p-3.5 flex flex-col justify-between transition-colors duration-300 ${healthAccent.cardSurface}`}>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Health Score</span>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${healthAccent.valueText}`}>
              {assessment.overallHealthScore}
            </span>
            <span className="text-xs font-mono text-slate-500">/ 100</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${healthAccent.barFill}`}
              style={{ width: `${assessment.overallHealthScore}%` }}
            />
          </div>
        </div>

        {/* Calculated Overall Risk */}
        <div className={`panel-surface rounded-xl p-3.5 flex flex-col justify-between transition-colors duration-300 ${riskAccent.cardSurface}`}>
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Overall Risk</span>
          <div className="flex items-baseline gap-1.5 my-1">
            <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${riskAccent.valueText}`}>
              {assessment.overallRiskScore}
            </span>
            <span className="text-xs font-mono text-slate-500">/ 100</span>
          </div>
          <span className={`text-[10px] font-mono truncate uppercase ${riskAccent.statusText}`}>
            {assessment.classification.replace('_', ' ')}
          </span>
        </div>

        {/* Active Warnings */}
        <div className="panel-surface rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Active Warnings</span>
          <div className="flex items-center gap-2 my-1">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-400">
              {assessment.activeWarningsCount}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Caution conditions</span>
        </div>

        {/* Critical Hazards */}
        <div className="panel-surface rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Critical Hazards</span>
          <div className="flex items-center gap-2 my-1">
            <Shield className="w-5 h-5 text-rose-400" />
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-400">
              {assessment.criticalHazardsCount}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Immediate action needed</span>
        </div>

        {/* Astronauts Inside */}
        <div className="panel-surface rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Crew Onboard</span>
          <div className="flex items-center gap-2 my-1">
            <Users className="w-5 h-5 text-cyan-400" />
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {habitat.activeOccupants}
            </span>
            <span className="text-xs font-mono text-slate-500">/ {habitat.maxOccupancy}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Metabolic: {telemetry.crewActivityLevel}</span>
        </div>

        {/* Habitat Operational Status */}
        <div className="panel-surface rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Habitat Class</span>
          <div className="my-1">
            <span className="text-sm font-semibold font-mono text-cyan-300 uppercase tracking-wide">
              {habitat.type.toUpperCase()}
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 truncate">{habitat.volumeM3} m³ Pressure Shell</span>
        </div>

        {/* Last Update & Telemetry Uplink */}
        <div className="panel-surface rounded-xl p-3.5 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Uplink Sync</span>
          <div className="flex items-center gap-1.5 my-1 text-xs font-mono text-emerald-400">
            <Clock className="w-3.5 h-3.5" />
            <span>FREE NASA LINK</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 truncate tabular-nums">{lastUpdated}</span>
        </div>
      </div>

      {/* EMERGENCY BANNER (If High Risk, Critical, or Extreme) */}
      {assessment.overallRiskScore >= 40 && (
        <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${badge.color}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <div>
              <div className="text-sm font-bold tracking-wide">
                EMERGENCY ALERT: {badge.text} DETECTED
              </div>
              <div className="text-xs mt-0.5 opacity-90">
                {assessment.hazards.length} compound hazard conditions detected requiring immediate crew and flight control response.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onRequestSelfHeal && (
              <button
                type="button"
                onClick={onRequestSelfHeal}
                data-testid="dashboard-self-heal-btn"
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-xs font-mono font-bold transition-colors whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Self-Heal Habitat (Ask Permission)</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('emergency')}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-950 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors whitespace-nowrap border border-white/20"
            >
              <span>Execute Emergency Protocol</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* HABITAT SWITCHER + 3D HABITAT DIGITAL TWIN HERO STAGE */}
      <div className="space-y-3">
        <HabitatSelectorBar
          activeType={habitat.type}
          habitatProfiles={habitatProfiles}
          onSelectHabitat={onSelectHabitat}
        />
        <div className="w-full h-[500px]">
          <ThreeHabitatCanvas
            telemetry={telemetry}
            habitat={habitat}
            classification={assessment.classification}
            riskScore={assessment.overallRiskScore}
            hazards={assessment.hazards}
            categoryScores={assessment.categoryScores}
            globalAudioEnabled={globalAudioEnabled}
            onToggleGlobalAudio={onToggleGlobalAudio}
            onTriggerGlobalTestAlarm={onTriggerGlobalTestAlarm}
            flameConfig={flameConfig}
            flameAnalysis={flameAnalysis}
            onUpdateFlameConfig={onUpdateFlameConfig}
            selfHealingActive={selfHealingActive}
            selfHealingStatusLabel={selfHealingStatusLabel}
            onOpenFlameLab={() => onNavigate('flame-lab')}
          />
        </div>
      </div>

      {/* SECTION B: ENVIRONMENTAL OVERVIEW TELEMETRY CARDS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono">
            Environmental Telemetry Grid
          </h2>
          <button
            onClick={() => onNavigate('environment')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
          >
            <span>Adjust Parameters / Calibration</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Oxygen */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${o2Accent.cardSurface}`} data-telemetry-tone={o2Accent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Oxygen (O₂)</span>
              <Wind className={`w-4 h-4 transition-colors duration-300 ${o2Accent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${o2Accent.valueText}`}>
                {telemetry.oxygenPercent.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400">%</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.oxygenPercent}
              domainMin={Math.min(14, habitat.limits.o2MinPercent - 5)}
              domainMax={Math.max(28, habitat.limits.o2MaxPercent + 5)}
              safeMin={habitat.limits.o2MinPercent}
              safeMax={habitat.limits.o2MaxPercent}
              accent={o2Accent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>Nom: {habitat.limits.o2MinPercent}–{habitat.limits.o2MaxPercent}%</span>
              <span className={`font-semibold ${o2Accent.statusText}`}>{o2Accent.statusLabel}</span>
            </div>
          </div>

          {/* Carbon Dioxide */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${co2Accent.cardSurface}`} data-telemetry-tone={co2Accent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Carbon Dioxide</span>
              <Gauge className={`w-4 h-4 transition-colors duration-300 ${co2Accent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${co2Accent.valueText}`}>
                {telemetry.carbonDioxidePpm}
              </span>
              <span className="text-xs font-mono text-slate-400">ppm</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.carbonDioxidePpm}
              domainMin={0}
              domainMax={Math.max(8000, habitat.limits.co2MaxPpm * 1.4)}
              safeMin={300}
              safeMax={habitat.thresholds.carbonDioxidePpm.tiers.normal.upper}
              accent={co2Accent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>Max: {habitat.limits.co2MaxPpm} ppm</span>
              <span className={`font-semibold ${co2Accent.statusText}`}>{co2Accent.statusLabel}</span>
            </div>
          </div>

          {/* Cabin Pressure */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${pressureAccent.cardSurface}`} data-telemetry-tone={pressureAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Pressure</span>
              <Gauge className={`w-4 h-4 transition-colors duration-300 ${pressureAccent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${pressureAccent.valueText}`}>
                {telemetry.pressureKPa.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400">kPa</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.pressureKPa}
              domainMin={Math.min(40, habitat.limits.pressureMinKPa - 15)}
              domainMax={Math.max(120, habitat.limits.pressureMaxKPa + 10)}
              safeMin={habitat.limits.pressureMinKPa}
              safeMax={habitat.limits.pressureMaxKPa}
              accent={pressureAccent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>{habitat.limits.pressureMinKPa}–{habitat.limits.pressureMaxKPa} kPa</span>
              <span className={`font-semibold ${pressureAccent.statusText}`}>{pressureAccent.statusLabel}</span>
            </div>
          </div>

          {/* Temperature */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${tempAccent.cardSurface}`} data-telemetry-tone={tempAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Cabin Temp</span>
              <Thermometer className={`w-4 h-4 transition-colors duration-300 ${tempAccent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${tempAccent.valueText}`}>
                {telemetry.internalTemperatureC.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400">°C</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.internalTemperatureC}
              domainMin={10}
              domainMax={40}
              safeMin={habitat.limits.tempMinC}
              safeMax={habitat.limits.tempMaxC}
              accent={tempAccent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>Ext: {telemetry.externalTemperatureC.toFixed(1)}°C</span>
              <span className={`font-semibold ${tempAccent.statusText}`}>{tempAccent.statusLabel}</span>
            </div>
          </div>

          {/* Airflow Velocity */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${airflowAccent.cardSurface}`} data-telemetry-tone={airflowAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Airflow</span>
              <Wind className={`w-4 h-4 transition-colors duration-300 ${airflowAccent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${airflowAccent.valueText}`}>
                {telemetry.airflowVelocity.toFixed(2)}
              </span>
              <span className="text-xs font-mono text-slate-400">m/s</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.airflowVelocity}
              domainMin={0}
              domainMax={0.65}
              safeMin={habitat.limits.airflowMinMs}
              safeMax={habitat.thresholds.airflowVelocity.tiers.normal.upper}
              accent={airflowAccent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>Min: {habitat.limits.airflowMinMs} m/s</span>
              <span className={`font-semibold ${airflowAccent.statusText}`}>{airflowAccent.statusLabel}</span>
            </div>
          </div>

          {/* Radiation Dose Rate */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${radiationAccent.cardSurface}`} data-telemetry-tone={radiationAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Radiation</span>
              <Radio className={`w-4 h-4 transition-colors duration-300 ${radiationAccent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${radiationAccent.valueText}`}>
                {telemetry.radiationDoseRateUSvH.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400">µSv/h</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.radiationDoseRateUSvH}
              domainMin={0}
              domainMax={Math.max(80, habitat.limits.radiationMaxUSvH * 1.8)}
              safeMin={0}
              safeMax={habitat.limits.radiationMaxUSvH}
              accent={radiationAccent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>Cumul: {telemetry.accumulatedDoseMSv.toFixed(1)} mSv</span>
              <span className={`font-semibold ${radiationAccent.statusText}`}>{radiationAccent.statusLabel}</span>
            </div>
          </div>

          {/* Combustion / Fire Detection */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${fireAccent.cardSurface}`} data-telemetry-tone={fireAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Fire / Smoke</span>
              <Flame className={`w-4 h-4 transition-colors duration-300 ${fireAccent.iconText}`} />
            </div>
            <div className="mt-2">
              <span className={`text-base font-bold font-mono uppercase transition-colors duration-300 ${fireAccent.valueText}`}>
                {telemetry.fireDetected ? 'FIRE DETECTED' : telemetry.smokeDetected ? 'SMOKE DETECTED' : '● CLEAR'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2 tabular-nums gap-1">
              <span>Gas: {telemetry.combustibleGasPpm.toFixed(1)} ppm</span>
              <span className={`font-semibold ${fireAccent.statusText}`}>{fireAccent.statusLabel}</span>
            </div>
          </div>

          {/* Power Supply */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${powerAccent.cardSurface}`} data-telemetry-tone={powerAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Power Bus</span>
              <Zap className={`w-4 h-4 transition-colors duration-300 ${powerAccent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${powerAccent.valueText}`}>
                {telemetry.powerSupplyPercent.toFixed(0)}
              </span>
              <span className="text-xs font-mono text-slate-400">%</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.powerSupplyPercent}
              domainMin={0}
              domainMax={100}
              safeMin={75}
              safeMax={100}
              accent={powerAccent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>Batt: {telemetry.batteryBackupPercent.toFixed(0)}%</span>
              <span className={`font-semibold ${powerAccent.statusText}`}>{powerAccent.statusLabel}</span>
            </div>
          </div>

          {/* Oxygen Reserve */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${reserveAccent.cardSurface}`} data-telemetry-tone={reserveAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">O₂ Reserve</span>
              <Droplets className={`w-4 h-4 transition-colors duration-300 ${reserveAccent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${reserveAccent.valueText}`}>
                {telemetry.oxygenReserveHours}
              </span>
              <span className="text-xs font-mono text-slate-400">hrs</span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2 gap-1">
              <span>OGS: {telemetry.oxygenGenStatus.toUpperCase()}</span>
              <span className={`font-semibold ${reserveAccent.statusText}`}>{reserveAccent.statusLabel}</span>
            </div>
          </div>

          {/* CO2 Scrubber */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${scrubberAccent.cardSurface}`} data-telemetry-tone={scrubberAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">CO₂ Scrubber</span>
              <Shield className={`w-4 h-4 transition-colors duration-300 ${scrubberAccent.iconText}`} />
            </div>
            <div className="mt-2">
              <span className={`text-sm font-bold font-mono uppercase transition-colors duration-300 ${scrubberAccent.valueText}`}>
                {telemetry.co2ScrubberStatus}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-2 gap-1">
              <span>CDRA Bed A/B</span>
              <span className={`font-semibold ${scrubberAccent.statusText}`}>{scrubberAccent.statusLabel}</span>
            </div>
          </div>

          {/* Water Availability */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${waterAccent.cardSurface}`} data-telemetry-tone={waterAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Water Supply</span>
              <Droplets className={`w-4 h-4 transition-colors duration-300 ${waterAccent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${waterAccent.valueText}`}>
                {telemetry.waterAvailabilityPercent.toFixed(1)}
              </span>
              <span className="text-xs font-mono text-slate-400">%</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.waterAvailabilityPercent}
              domainMin={0}
              domainMax={100}
              safeMin={75}
              safeMax={100}
              accent={waterAccent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>Recyc: {telemetry.waterRecyclingEfficiency}%</span>
              <span className={`font-semibold ${waterAccent.statusText}`}>{waterAccent.statusLabel}</span>
            </div>
          </div>

          {/* Relative Humidity */}
          <div className={`panel-surface rounded-xl p-3.5 transition-colors duration-300 ${humidityAccent.cardSurface}`} data-telemetry-tone={humidityAccent.tone}>
            <div className="flex items-center justify-between text-slate-400 text-xs">
              <span className="font-mono uppercase">Humidity</span>
              <Droplets className={`w-4 h-4 transition-colors duration-300 ${humidityAccent.iconText}`} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl font-bold font-mono tabular-nums transition-colors duration-300 ${humidityAccent.valueText}`}>
                {telemetry.relativeHumidity.toFixed(0)}
              </span>
              <span className="text-xs font-mono text-slate-400">%</span>
            </div>
            <NominalEnvelopeBar
              value={telemetry.relativeHumidity}
              domainMin={15}
              domainMax={85}
              safeMin={habitat.limits.humidityMinPercent}
              safeMax={habitat.limits.humidityMaxPercent}
              accent={humidityAccent}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 mt-1.5 tabular-nums gap-1">
              <span>Nom: {habitat.limits.humidityMinPercent}–{habitat.limits.humidityMaxPercent}%</span>
              <span className={`font-semibold ${humidityAccent.statusText}`}>{humidityAccent.statusLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C: 7 RISK DOMAINS & SPACE BIOLOGY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Overview Gauges */}
        <div className="lg:col-span-2 panel-surface rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Multi-Parameter Risk Breakdown</span>
            </h2>
            <button
              onClick={() => onNavigate('risk')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              <span>View Correlation Matrix</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(assessment.categoryScores).map(([category, score]) => (
              <div key={category} className="bg-[#050811] border border-slate-800/90 rounded-lg p-3">
                <div className="flex items-center justify-between text-xs mb-2 font-mono">
                  <span className="capitalize text-slate-300">{category} Risk</span>
                  <span className={`font-bold tabular-nums ${getRiskTextColor(score)}`}>
                    {score} / 100
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${getRiskBarColor(score)}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Spaceflight Human Bioscience & Cellular Impact */}
        <div className="panel-surface rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <HeartPulse className="w-4 h-4 text-rose-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 font-mono">
                Crew Bioscience Status
              </h2>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-[#050811] border border-slate-800 p-3 rounded-lg">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>HYPOXIA PHYSIOLOGY:</span>
                  <span
                    className={`font-bold uppercase ${
                      assessment.bioscienceImpacts.hypoxiaRisk === 'none'
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {assessment.bioscienceImpacts.hypoxiaRisk}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Alveolar oxygenation balanced. SpO2 within human spaceflight tolerance.
                </div>
              </div>

              <div className="bg-[#050811] border border-slate-800 p-3 rounded-lg">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>HYPERCAPNIA RISK:</span>
                  <span
                    className={`font-bold uppercase ${
                      assessment.bioscienceImpacts.hypercapniaRisk === 'none'
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {assessment.bioscienceImpacts.hypercapniaRisk}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  CO2 partial pressure clearance via CDRA scrubbing active.
                </div>
              </div>

              <div className="bg-[#050811] border border-slate-800 p-3 rounded-lg">
                <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                  <Dna className="w-3.5 h-3.5 text-purple-400" />
                  <span>CELLULAR PATHWAY:</span>
                </div>
                <div className="text-[11px] text-purple-300 leading-relaxed">
                  {assessment.bioscienceImpacts.cellularPathwayAffected[0]}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-mono">NASA HIDH / OSDR Free Data</span>
            <button
              onClick={() => onNavigate('nasa')}
              className="text-cyan-400 hover:text-cyan-300 font-mono flex items-center gap-1"
            >
              <span>Explore Biology Studies</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
