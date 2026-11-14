import type {
  EnvironmentalTelemetry,
  HabitatProfile,
  ParameterThresholdSpec,
  RiskClassification,
  ThresholdParameterKey,
} from '../types/habitat.ts';
import { evaluateParameterThreshold } from './thresholds.ts';

export type TelemetryAccentTone = 'cyan' | 'amber' | 'red';

export interface TelemetryAccentClasses {
  tone: TelemetryAccentTone;
  statusLabel: 'NOMINAL' | 'NEAR LIMIT' | 'CRITICAL';
  /** Proximity factor: 0 = center/safe, ~0.72–1.0 = approaching limit, >1.0 = breaching */
  proximityRatio: number;
  /** Primary numeric readout text color */
  valueText: string;
  /** Header / status icon color */
  iconText: string;
  /** Badge or inline status label text color */
  statusText: string;
  /** Card border + subtle tinted background */
  cardSurface: string;
  /** Envelope progress bar / dot indicator fill */
  barFill: string;
  /** Envelope safe-band overlay styling */
  envelopeBand: string;
  /** Native range input accent utility */
  sliderAccent: string;
  /** Numeric input border & text utility */
  inputSurface: string;
}

const TONE_CLASS_MAP: Record<
  TelemetryAccentTone,
  Omit<TelemetryAccentClasses, 'tone' | 'statusLabel' | 'proximityRatio'>
> = {
  cyan: {
    valueText: 'text-cyan-300 text-glow-cyan',
    iconText: 'text-cyan-400',
    statusText: 'text-cyan-400',
    cardSurface: 'border-slate-800/90 hover:border-cyan-500/45 ds-card-cyan',
    barFill: 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.55)]',
    envelopeBand: 'bg-cyan-500/20 border-x border-cyan-400/50',
    sliderAccent: 'accent-cyan-400',
    inputSurface: 'border-slate-800 text-cyan-300 focus:border-cyan-400',
  },
  amber: {
    valueText: 'text-amber-300 text-glow-amber',
    iconText: 'text-amber-400',
    statusText: 'text-amber-400',
    cardSurface: 'border-amber-500/60 bg-amber-950/20 hover:border-amber-400/80 ds-card-amber',
    barFill: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]',
    envelopeBand: 'bg-amber-500/20 border-x border-amber-400/65',
    sliderAccent: 'accent-amber-400',
    inputSurface: 'border-amber-500/60 text-amber-300 focus:border-amber-400',
  },
  red: {
    valueText: 'text-red-400 text-glow-red',
    iconText: 'text-red-500',
    statusText: 'text-red-400',
    cardSurface: 'border-red-700/85 bg-red-950/35 hover:border-red-500 ds-card-red',
    barFill: 'bg-red-600 shadow-[0_0_14px_rgba(220,38,38,0.8)]',
    envelopeBand: 'bg-red-900/30 border-x border-red-600/70',
    sliderAccent: 'accent-red-600',
    inputSurface: 'border-red-700/80 text-red-400 focus:border-red-500',
  },
};

function buildAccentResult(
  tone: TelemetryAccentTone,
  proximityRatio: number
): TelemetryAccentClasses {
  const statusLabel: TelemetryAccentClasses['statusLabel'] =
    tone === 'red' ? 'CRITICAL' : tone === 'amber' ? 'NEAR LIMIT' : 'NOMINAL';
  return {
    tone,
    statusLabel,
    proximityRatio: Number(proximityRatio.toFixed(3)),
    ...TONE_CLASS_MAP[tone],
  };
}

/**
 * Computes how close a telemetry value is to the active habitat's lower or upper
 * normal/caution bounds and returns a deterministic 3-stage accent:
 * - 'cyan': comfortably inside nominal bounds
 * - 'amber': approaching lower/upper normal threshold limit OR inside caution tier
 * - 'red' (deep red): breaching into high_risk / critical / extreme_emergency
 */
export function getThresholdParamAccent(
  value: number,
  spec: ParameterThresholdSpec
): TelemetryAccentClasses {
  const evalResult = evaluateParameterThreshold(value, spec);
  const { normal } = spec.tiers;
  const { mode } = spec;

  let proximityRatio = 0;
  if (mode === 'bidirectional') {
    const mid = (normal.lower + normal.upper) / 2;
    const half = Math.max(0.0001, (normal.upper - normal.lower) / 2);
    proximityRatio = Math.abs(value - mid) / half;
  } else if (mode === 'upper_only') {
    const span = Math.max(0.0001, normal.upper - normal.lower);
    proximityRatio = Math.max(0, (value - normal.lower) / span);
  } else {
    // lower_only
    const span = Math.max(0.0001, normal.upper - normal.lower);
    proximityRatio = Math.max(0, (normal.upper - value) / span);
  }

  const tier: RiskClassification = evalResult.tier;
  if (tier === 'high_risk' || tier === 'critical' || tier === 'extreme_emergency') {
    return buildAccentResult('red', Math.max(1.05, proximityRatio));
  }

  if (tier === 'caution') {
    return buildAccentResult('amber', Math.max(1.0, proximityRatio));
  }

  // Inside 'normal': shift from cyan -> amber as metric approaches upper or lower limit
  const approachThreshold =
    mode === 'bidirectional' ? 0.72 : mode === 'upper_only' ? 0.80 : 0.90;

  if (proximityRatio >= approachThreshold) {
    return buildAccentResult('amber', proximityRatio);
  }

  return buildAccentResult('cyan', proximityRatio);
}

/**
 * Evaluates a bidirectional metric where limits are given simply as min/max bounds.
 */
export function getRangeAccent(
  value: number,
  opts: {
    min?: number;
    max?: number;
    warnMin?: number;
    warnMax?: number;
    critMin?: number;
    critMax?: number;
  }
): TelemetryAccentClasses {
  const { min, max, warnMin, warnMax, critMin, critMax } = opts;

  if (
    (critMin !== undefined && value <= critMin) ||
    (critMax !== undefined && value >= critMax)
  ) {
    return buildAccentResult('red', 1.2);
  }
  if (
    (warnMin !== undefined && value <= warnMin) ||
    (warnMax !== undefined && value >= warnMax)
  ) {
    return buildAccentResult('amber', 0.9);
  }
  if (min !== undefined && max !== undefined) {
    const mid = (min + max) / 2;
    const half = Math.max(0.0001, (max - min) / 2);
    const ratio = Math.abs(value - mid) / half;
    if (ratio >= 1.0) return buildAccentResult('red', ratio);
    if (ratio >= 0.72) return buildAccentResult('amber', ratio);
    return buildAccentResult('cyan', ratio);
  }

  return buildAccentResult('cyan', 0);
}

export type TelemetryDisplayMetricKey =
  | ThresholdParameterKey
  | 'fireSmoke'
  | 'combustibleGasPpm'
  | 'powerSupplyPercent'
  | 'batteryBackupPercent'
  | 'oxygenReserveHours'
  | 'co2ScrubberStatus'
  | 'waterAvailabilityPercent'
  | 'waterRecyclingEfficiency'
  | 'coolingSystemStatus'
  | 'heatingSystemStatus'
  | 'overallRiskScore'
  | 'overallHealthScore';

/**
 * Unified helper resolving dynamic Cyan -> Amber -> Deep Red styling
 * for any environmental telemetry metric in the UI.
 */
export function getTelemetryMetricAccent(
  telemetry: EnvironmentalTelemetry,
  habitat: HabitatProfile,
  metricKey: TelemetryDisplayMetricKey
): TelemetryAccentClasses {
  switch (metricKey) {
    case 'oxygenPercent':
    case 'carbonDioxidePpm':
    case 'internalTemperatureC':
    case 'pressureKPa':
    case 'relativeHumidity':
    case 'airflowVelocity':
    case 'radiationDoseRateUSvH':
      return getThresholdParamAccent(telemetry[metricKey], habitat.thresholds[metricKey]);

    case 'combustibleGasPpm':
      return getRangeAccent(telemetry.combustibleGasPpm, {
        warnMax: 3.5,
        critMax: 12.0,
      });

    case 'fireSmoke':
      if (telemetry.fireDetected || telemetry.combustibleGasPpm >= 12.0) {
        return buildAccentResult('red', 1.3);
      }
      if (telemetry.smokeDetected || telemetry.combustibleGasPpm >= 3.5) {
        return buildAccentResult('amber', 0.9);
      }
      return buildAccentResult('cyan', Math.min(0.65, telemetry.combustibleGasPpm / 5.0));

    case 'powerSupplyPercent': {
      const minPower = Math.min(telemetry.powerSupplyPercent, telemetry.batteryBackupPercent);
      if (telemetry.powerSupplyPercent < 45 || telemetry.batteryBackupPercent < 30) {
        return buildAccentResult('red', 1.2);
      }
      if (minPower < 75 || telemetry.emergencyPowerActive) {
        return buildAccentResult('amber', 0.88);
      }
      return buildAccentResult('cyan', Math.max(0, (100 - minPower) / 100));
    }

    case 'batteryBackupPercent':
      return getRangeAccent(telemetry.batteryBackupPercent, {
        warnMin: 65,
        critMin: 35,
      });

    case 'oxygenReserveHours':
      if (telemetry.oxygenReserveHours < 24 || telemetry.oxygenGenStatus === 'fault') {
        return buildAccentResult('red', 1.2);
      }
      if (telemetry.oxygenReserveHours < 72 || telemetry.oxygenGenStatus === 'standby') {
        return buildAccentResult('amber', 0.85);
      }
      return buildAccentResult('cyan', 0.15);

    case 'co2ScrubberStatus':
      if (telemetry.co2ScrubberStatus === 'failed') return buildAccentResult('red', 1.2);
      if (telemetry.co2ScrubberStatus === 'degraded') return buildAccentResult('amber', 0.85);
      return buildAccentResult('cyan', 0.1);

    case 'waterAvailabilityPercent':
      if (telemetry.waterAvailabilityPercent < 50 || telemetry.waterRecyclingEfficiency < 80) {
        return buildAccentResult('red', 1.2);
      }
      if (telemetry.waterAvailabilityPercent < 75 || telemetry.waterRecyclingEfficiency < 90) {
        return buildAccentResult('amber', 0.85);
      }
      return buildAccentResult('cyan', Math.max(0, (100 - telemetry.waterAvailabilityPercent) / 50));

    case 'waterRecyclingEfficiency':
      return getRangeAccent(telemetry.waterRecyclingEfficiency, {
        warnMin: 90,
        critMin: 80,
      });

    case 'coolingSystemStatus':
      if (telemetry.coolingSystemStatus === 'failed') return buildAccentResult('red', 1.2);
      if (telemetry.coolingSystemStatus === 'degraded') return buildAccentResult('amber', 0.85);
      return buildAccentResult('cyan', 0.1);

    case 'heatingSystemStatus':
      if (telemetry.heatingSystemStatus === 'failed') return buildAccentResult('red', 1.2);
      if (telemetry.heatingSystemStatus === 'degraded') return buildAccentResult('amber', 0.85);
      return buildAccentResult('cyan', 0.1);

    default:
      return buildAccentResult('cyan', 0);
  }
}

export function getScoreAccent(score: number, invertHealth = false): TelemetryAccentClasses {
  const risk = invertHealth ? 100 - score : score;
  if (risk >= 55) return buildAccentResult('red', risk / 100);
  if (risk >= 25) return buildAccentResult('amber', risk / 100);
  return buildAccentResult('cyan', risk / 100);
}
