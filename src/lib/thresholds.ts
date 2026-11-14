import type {
  HabitatLimits,
  HabitatProfile,
  HabitatThresholdsConfig,
  HabitatType,
  ParameterEvaluationResult,
  ParameterThresholdSpec,
  RiskClassification,
  ThresholdParameterKey,
} from '../types/habitat.ts';

export const RISK_TIER_ORDER: RiskClassification[] = [
  'normal',
  'caution',
  'high_risk',
  'critical',
  'extreme_emergency',
];

export const RISK_TIER_LABELS: Record<RiskClassification, string> = {
  normal: 'Normal',
  caution: 'Caution',
  high_risk: 'High Risk',
  critical: 'Critical',
  extreme_emergency: 'Extreme Emergency',
};

export const THRESHOLD_PARAMETER_KEYS: ThresholdParameterKey[] = [
  'oxygenPercent',
  'carbonDioxidePpm',
  'internalTemperatureC',
  'pressureKPa',
  'relativeHumidity',
  'airflowVelocity',
  'radiationDoseRateUSvH',
];

export function tierSeverityRank(tier: RiskClassification): number {
  return RISK_TIER_ORDER.indexOf(tier);
}

export function maxRiskTier(a: RiskClassification, b: RiskClassification): RiskClassification {
  return tierSeverityRank(a) >= tierSeverityRank(b) ? a : b;
}

/**
 * Evaluates a live telemetry value against a parameter's 5-tier threshold envelope.
 *
 * Tier semantics:
 * - normal: value is within [normal.lower, normal.upper]
 * - caution: outside normal, within [caution.lower, caution.upper]
 * - high_risk: outside caution, within [high_risk.lower, high_risk.upper]
 * - critical: outside high_risk, within [critical.lower, critical.upper] (and not past extreme trigger)
 * - extreme_emergency: beyond extreme_emergency bounds (< extreme.lower or > extreme.upper)
 *   or beyond critical bounds when extreme equals critical
 */
export function evaluateParameterThreshold(
  value: number,
  spec: ParameterThresholdSpec
): ParameterEvaluationResult {
  const { tiers, mode, label, unit, key } = spec;
  const { normal, caution, high_risk, critical, extreme_emergency } = tiers;

  const checkLow = mode === 'bidirectional' || mode === 'lower_only';
  const checkHigh = mode === 'bidirectional' || mode === 'upper_only';

  const isLowBreach = (bound: number) => checkLow && value < bound;
  const isHighBreach = (bound: number) => checkHigh && value > bound;
  const isOutside = (b: { lower: number; upper: number }) =>
    isLowBreach(b.lower) || isHighBreach(b.upper);

  let tier: RiskClassification = 'normal';
  let score = 0;
  let breachDirection: 'low' | 'high' | 'none' = 'none';
  let activeBounds = normal;

  if (isLowBreach(normal.lower)) breachDirection = 'low';
  else if (isHighBreach(normal.upper)) breachDirection = 'high';

  const extremeLowTrigger = Math.min(critical.lower, extreme_emergency.lower);
  const extremeHighTrigger = Math.max(critical.upper, extreme_emergency.upper);

  const pastExtreme =
    (checkLow && value < extreme_emergency.lower) ||
    (checkHigh && value > extreme_emergency.upper);

  if (!isOutside(normal)) {
    tier = 'normal';
    activeBounds = normal;
    if (mode === 'bidirectional') {
      const mid = (normal.lower + normal.upper) / 2;
      const half = Math.max(0.0001, (normal.upper - normal.lower) / 2);
      const ratio = Math.min(1, Math.abs(value - mid) / half);
      score = Math.round(ratio * 8);
    } else if (mode === 'upper_only') {
      const span = Math.max(0.0001, normal.upper - normal.lower);
      const ratio = Math.max(0, Math.min(1, (value - normal.lower) / span));
      score = Math.round(ratio * 8);
    } else {
      const span = Math.max(0.0001, normal.upper - normal.lower);
      const ratio = Math.max(0, Math.min(1, (normal.upper - value) / span));
      score = Math.round(ratio * 8);
    }
  } else if (pastExtreme || isLowBreach(extremeLowTrigger) || isHighBreach(extremeHighTrigger)) {
    tier = 'extreme_emergency';
    activeBounds = extreme_emergency;
    const overshoot =
      breachDirection === 'low'
        ? Math.max(0, extreme_emergency.lower - value) / Math.max(1, Math.abs(normal.lower - extreme_emergency.lower))
        : Math.max(0, value - extreme_emergency.upper) / Math.max(1, Math.abs(extreme_emergency.upper - normal.upper));
    score = Math.min(100, Math.round(88 + Math.min(1, overshoot) * 12));
  } else if (!isOutside(caution)) {
    tier = 'caution';
    activeBounds = caution;
    const progress =
      breachDirection === 'low'
        ? (normal.lower - value) / Math.max(0.0001, normal.lower - caution.lower)
        : (value - normal.upper) / Math.max(0.0001, caution.upper - normal.upper);
    score = Math.round(22 + Math.max(0, Math.min(1, progress)) * 16);
  } else if (!isOutside(high_risk)) {
    tier = 'high_risk';
    activeBounds = high_risk;
    const progress =
      breachDirection === 'low'
        ? (caution.lower - value) / Math.max(0.0001, caution.lower - high_risk.lower)
        : (value - caution.upper) / Math.max(0.0001, high_risk.upper - caution.upper);
    score = Math.round(42 + Math.max(0, Math.min(1, progress)) * 20);
  } else {
    tier = 'critical';
    activeBounds = critical;
    const progress =
      breachDirection === 'low'
        ? (high_risk.lower - value) / Math.max(0.0001, high_risk.lower - extreme_emergency.lower)
        : (value - high_risk.upper) / Math.max(0.0001, extreme_emergency.upper - high_risk.upper);
    score = Math.round(66 + Math.max(0, Math.min(1, progress)) * 18);
  }

  const formattedVal = Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, '');
  let message = `${label} (${formattedVal} ${unit}) is within nominal safe band (${normal.lower}–${normal.upper} ${unit}).`;
  if (tier !== 'normal') {
    const tierName = RISK_TIER_LABELS[tier];
    if (breachDirection === 'low') {
      message = `${label} dropped to ${formattedVal} ${unit}, triggering ${tierName} (normal lower bound: ${normal.lower} ${unit}).`;
    } else {
      message = `${label} reached ${formattedVal} ${unit}, triggering ${tierName} (normal upper bound: ${normal.upper} ${unit}).`;
    }
  }

  return {
    key,
    label,
    value,
    unit,
    tier,
    score,
    breachDirection,
    activeBounds,
    normalBounds: normal,
    message,
  };
}

/**
 * Validates that bounds inside a ParameterThresholdSpec are finite and properly nested.
 */
export function validateParameterThresholdSpec(spec: ParameterThresholdSpec): string[] {
  const errors: string[] = [];
  const { tiers, label, mode } = spec;

  for (const tierKey of RISK_TIER_ORDER) {
    const b = tiers[tierKey];
    if (!Number.isFinite(b.lower) || !Number.isFinite(b.upper)) {
      errors.push(`${label} (${RISK_TIER_LABELS[tierKey]}): Bounds must be valid numbers.`);
      return errors;
    }
    if (b.lower > b.upper) {
      errors.push(
        `${label} (${RISK_TIER_LABELS[tierKey]}): Lower bound (${b.lower}) cannot exceed upper bound (${b.upper}).`
      );
    }
  }

  if (mode !== 'upper_only') {
    const seqLow: [RiskClassification, number][] = [
      ['normal', tiers.normal.lower],
      ['caution', tiers.caution.lower],
      ['high_risk', tiers.high_risk.lower],
      ['critical', tiers.critical.lower],
      ['extreme_emergency', tiers.extreme_emergency.lower],
    ];
    for (let i = 0; i < seqLow.length - 1; i++) {
      const [innerName, innerVal] = seqLow[i];
      const [outerName, outerVal] = seqLow[i + 1];
      if (outerVal > innerVal) {
        errors.push(
          `${label}: ${RISK_TIER_LABELS[outerName]} lower bound (${outerVal}) should be <= ${RISK_TIER_LABELS[innerName]} lower bound (${innerVal}).`
        );
      }
    }
  }

  if (mode !== 'lower_only') {
    const seqHigh: [RiskClassification, number][] = [
      ['normal', tiers.normal.upper],
      ['caution', tiers.caution.upper],
      ['high_risk', tiers.high_risk.upper],
      ['critical', tiers.critical.upper],
      ['extreme_emergency', tiers.extreme_emergency.upper],
    ];
    for (let i = 0; i < seqHigh.length - 1; i++) {
      const [innerName, innerVal] = seqHigh[i];
      const [outerName, outerVal] = seqHigh[i + 1];
      if (outerVal < innerVal) {
        errors.push(
          `${label}: ${RISK_TIER_LABELS[outerName]} upper bound (${outerVal}) should be >= ${RISK_TIER_LABELS[innerName]} upper bound (${innerVal}).`
        );
      }
    }
  }

  return errors;
}

/**
 * Keeps legacy HabitatLimits fields synchronized with the editable 5-tier thresholds.
 */
export function syncLimitsFromThresholds(
  thresholds: HabitatThresholdsConfig,
  base: HabitatLimits
): HabitatLimits {
  return {
    ...base,
    o2MinPercent: thresholds.oxygenPercent.tiers.normal.lower,
    o2MaxPercent: thresholds.oxygenPercent.tiers.normal.upper,
    co2MaxPpm: thresholds.carbonDioxidePpm.tiers.caution.upper,
    pressureMinKPa: thresholds.pressureKPa.tiers.normal.lower,
    pressureMaxKPa: thresholds.pressureKPa.tiers.normal.upper,
    tempMinC: thresholds.internalTemperatureC.tiers.normal.lower,
    tempMaxC: thresholds.internalTemperatureC.tiers.normal.upper,
    humidityMinPercent: thresholds.relativeHumidity.tiers.normal.lower,
    humidityMaxPercent: thresholds.relativeHumidity.tiers.normal.upper,
    radiationMaxUSvH: thresholds.radiationDoseRateUSvH.tiers.normal.upper,
    airflowMinMs: thresholds.airflowVelocity.tiers.normal.lower,
  };
}

export function cloneThresholdsConfig(config: HabitatThresholdsConfig): HabitatThresholdsConfig {
  const copy = {} as HabitatThresholdsConfig;
  for (const key of THRESHOLD_PARAMETER_KEYS) {
    const spec = config[key];
    copy[key] = {
      ...spec,
      tiers: {
        normal: { ...spec.tiers.normal },
        caution: { ...spec.tiers.caution },
        high_risk: { ...spec.tiers.high_risk },
        critical: { ...spec.tiers.critical },
        extreme_emergency: { ...spec.tiers.extreme_emergency },
      },
    };
  }
  return copy;
}

export interface ThresholdExportBundle {
  version: string;
  exportedAt: string;
  habitats: Record<
    HabitatType,
    {
      name: string;
      thresholds: HabitatThresholdsConfig;
    }
  >;
}

export function exportThresholdsJson(profiles: Record<HabitatType, HabitatProfile>): string {
  const habitats = {} as ThresholdExportBundle['habitats'];
  (Object.keys(profiles) as HabitatType[]).forEach((type) => {
    habitats[type] = {
      name: profiles[type].name,
      thresholds: cloneThresholdsConfig(profiles[type].thresholds),
    };
  });

  const bundle: ThresholdExportBundle = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    habitats,
  };
  return JSON.stringify(bundle, null, 2);
}

export function parseSingleHabitatThresholdsJson(
  rawJson: string,
  template: HabitatThresholdsConfig
): { thresholds?: HabitatThresholdsConfig; error?: string } {
  try {
    const parsed = JSON.parse(rawJson);
    const candidate = parsed?.thresholds ?? parsed;
    if (!candidate || typeof candidate !== 'object') {
      return { error: 'JSON must contain a valid thresholds object.' };
    }
    const next = cloneThresholdsConfig(template);
    for (const key of THRESHOLD_PARAMETER_KEYS) {
      if (!candidate[key]?.tiers) continue;
      for (const tier of RISK_TIER_ORDER) {
        const b = candidate[key].tiers[tier];
        if (b && typeof b.lower === 'number' && typeof b.upper === 'number') {
          next[key].tiers[tier] = { lower: b.lower, upper: b.upper };
        }
      }
    }
    return { thresholds: next };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Invalid JSON syntax.' };
  }
}
