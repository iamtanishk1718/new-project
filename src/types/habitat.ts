/**
 * Habitat & Environmental Telemetry Types
 * Flame in Firefall - NASA Space Apps Challenge
 */

export type HabitatType =
  | 'iss'
  | 'spacecraft'
  | 'lunar'
  | 'mars'
  | 'rover'
  | 'module'
  | 'custom';

export type RiskClassification =
  | 'normal'
  | 'caution'
  | 'high_risk'
  | 'critical'
  | 'extreme_emergency';

export type DataMode = 'live' | 'simulation' | 'manual';

export type ThresholdParameterKey =
  | 'oxygenPercent'
  | 'carbonDioxidePpm'
  | 'internalTemperatureC'
  | 'pressureKPa'
  | 'relativeHumidity'
  | 'airflowVelocity'
  | 'radiationDoseRateUSvH';

export type ThresholdEvalMode = 'bidirectional' | 'upper_only' | 'lower_only';

export interface TierBounds {
  lower: number;
  upper: number;
}

export type ThresholdTiersConfig = Record<RiskClassification, TierBounds>;

export interface ParameterThresholdSpec {
  key: ThresholdParameterKey;
  label: string;
  unit: string;
  mode: ThresholdEvalMode;
  step: number;
  category: keyof CategoryRiskScores;
  tiers: ThresholdTiersConfig;
}

export type HabitatThresholdsConfig = Record<ThresholdParameterKey, ParameterThresholdSpec>;

export interface ParameterEvaluationResult {
  key: ThresholdParameterKey;
  label: string;
  value: number;
  unit: string;
  tier: RiskClassification;
  score: number; // 0 - 100
  breachDirection: 'low' | 'high' | 'none';
  activeBounds: TierBounds;
  normalBounds: TierBounds;
  message: string;
}

export interface HabitatLimits {
  o2MinPercent: number;
  o2MaxPercent: number;
  co2MaxPpm: number;
  pressureMinKPa: number;
  pressureMaxKPa: number;
  tempMinC: number;
  tempMaxC: number;
  humidityMinPercent: number;
  humidityMaxPercent: number;
  radiationMaxUSvH: number;
  airflowMinMs: number;
}

export interface HabitatProfile {
  id: string;
  name: string;
  type: HabitatType;
  volumeM3: number;
  maxOccupancy: number;
  activeOccupants: number;
  missionDurationDays: number;
  shieldingFactor: number; // 0.0 - 1.0 (1.0 = best)
  lifeSupportType: string;
  status: 'nominal' | 'degraded' | 'emergency';
  limits: HabitatLimits;
  thresholds: HabitatThresholdsConfig;
}

export interface EnvironmentalTelemetry {
  // Atmospheric
  oxygenPercent: number; // % (nominal 20.9 - 21.5)
  carbonDioxidePpm: number; // ppm (nominal < 3000)
  pressureKPa: number; // kPa (nominal 101.3)
  nitrogenPercent: number; // % (nominal 78.0)
  airflowVelocity: number; // m/s (nominal 0.08 - 0.20)
  ventilationRatePercent: number; // % (0 - 100)
  cabinAirExchangeRate: number; // changes/hr

  // Thermal
  internalTemperatureC: number; // °C (nominal 20 - 24)
  externalTemperatureC: number; // °C
  relativeHumidity: number; // % (nominal 40 - 60)
  coolingSystemStatus: 'nominal' | 'degraded' | 'failed';
  heatingSystemStatus: 'nominal' | 'degraded' | 'failed';

  // Life Support
  oxygenReserveHours: number; // hours remaining
  oxygenGenStatus: 'active' | 'standby' | 'fault';
  co2ScrubberStatus: 'nominal' | 'degraded' | 'failed';
  waterAvailabilityPercent: number; // % (0 - 100)
  waterRecyclingEfficiency: number; // % (nominal 93 - 98)
  powerSupplyPercent: number; // %
  batteryBackupPercent: number; // %
  emergencyPowerActive: boolean;

  // Fire & Combustion
  smokeDetected: boolean;
  fireDetected: boolean;
  combustibleGasPpm: number; // ppm (nominal < 10)
  heatGenerationRateKW: number; // kW

  // Human Occupancy
  activeOccupants: number;
  crewActivityLevel: 'resting' | 'normal' | 'high';
  estimatedO2ConsumptionRateLPerHr: number; // L/person/hr
  estimatedCO2ProductionRateLPerHr: number; // L/person/hr

  // Radiation
  radiationDoseRateUSvH: number; // µSv/h (nominal < 25 in LEO, >100 in deep space solar storm)
  accumulatedDoseMSv: number; // mSv mission cumulative
  shieldingEffectivenessPercent: number; // %
}

export interface CategoryRiskScores {
  atmospheric: number;
  thermal: number;
  fire: number;
  radiation: number;
  ventilation: number;
  lifeSupport: number;
  resource: number;
}

export interface DetectedHazard {
  id: string;
  name: string;
  category: keyof CategoryRiskScores;
  severity: 'caution' | 'high' | 'critical' | 'extreme';
  likelihood: number; // 0 - 100%
  score: number; // 0 - 100
  affectedParameters: string[];
  explanation: string;
  potentialConsequences: string[];
  recommendedActions: string[];
}

export interface RiskAssessmentResult {
  overallHealthScore: number; // 0 - 100 (100 is pristine)
  overallRiskScore: number; // 0 - 100 (0 is safe, 100 is catastrophe)
  classification: RiskClassification;
  activeWarningsCount: number;
  criticalHazardsCount: number;
  categoryScores: CategoryRiskScores;
  parameterEvaluations: Record<ThresholdParameterKey, ParameterEvaluationResult>;
  hazards: DetectedHazard[];
  bioscienceImpacts: {
    hypoxiaRisk: 'none' | 'mild' | 'moderate' | 'severe' | 'lethal';
    hypercapniaRisk: 'none' | 'mild' | 'moderate' | 'severe' | 'lethal';
    radiationRiskDoseTier: 'safe' | 'career_elevated' | 'acute_sick' | 'critical';
    cellularPathwayAffected: string[];
  };
}

export interface AIRecommendation {
  id: string;
  problem: string;
  whyDangerous: string;
  correctiveActions: string[];
  expectedBenefit: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  urgency: 'IMMEDIATE' | 'WITHIN_1_HOUR' | 'WITHIN_4_HOURS' | 'ROUTINE';
  monitoredParameters: string[];
  rationale: string;
}

export interface SimulationScenario {
  id: string;
  title: string;
  description: string;
  severity: 'moderate' | 'high' | 'severe' | 'critical' | 'extreme';
  expectedDurationMinutes: number;
  initialModifiers: Partial<EnvironmentalTelemetry>;
  driftRatesPerMinute: Partial<EnvironmentalTelemetry>;
  targetSubsystem: string;
  nasaRefCode?: string;
}

export interface TelemetryHistoryPoint {
  timestamp: string;
  elapsedSeconds: number;
  oxygenPercent: number;
  carbonDioxidePpm: number;
  pressureKPa: number;
  internalTemperatureC: number;
  radiationDoseRateUSvH: number;
  riskScore: number;
  healthScore: number;
}

export interface EmergencyProtocol {
  id: string;
  hazardType: string;
  title: string;
  standardReference: string; // e.g. NASA-STD-3001 Vol 2
  steps: {
    id: string;
    stepNumber: number;
    action: string;
    responsibleCrew: string;
    subsystemAffected: string;
    isCritical: boolean;
  }[];
}

export type FlameDiluentGas = 'nitrogen' | 'co2_suppress' | 'helium' | 'argon';
export type FlameFuelType = 'cellulose' | 'pmma' | 'kapton' | 'heptane' | 'li_ion';
export type FlameConfinementMode = 'open_rack' | 'narrow_duct' | 'quartz_vessel';
export type FlameImagingMode = 'optical' | 'chemilum' | 'infrared';

export interface FlameTestConfig {
  ignited: boolean;
  gravityG: number; // 0.0 (microgravity) to 2.0 (hypergravity)
  oxygenPercent: number; // 10 to 40 %
  pressureKPa: number; // 30 to 120 kPa
  airflowMs: number; // 0.00 to 0.80 m/s forced flow
  diluentGas: FlameDiluentGas;
  fuelType: FlameFuelType;
  humidityPercent: number; // 5 to 95 % RH
  ambientTempC: number; // 10 to 45 °C
  confinement: FlameConfinementMode;
  imagingMode: FlameImagingMode;
  syncWithHabitat: boolean;
}

export interface FlameAnalysisResult {
  isSustained: boolean;
  extinctionReason: string | null;
  regimeLabel: string;
  peakTempC: number;
  peakTempK: number;
  flameHeightMm: number;
  flameWidthMm: number;
  aspectRatio: number;
  tiltAngleDeg: number;
  spreadRateMmS: number;
  massLossRateMgS: number;
  heatReleaseWatts: number;
  sootVolumePpm: number;
  coYieldRatio: number;
  damkohlerNumber: number;
  richardsonNumber: number;
  sootLuminosity: number; // 0-1 yellow soot emission
  blueFraction: number; // 0-1 CH*/OH* blue reaction intensity
  coolFlameActive: boolean;
  flammabilityMarginPercent: number;
  riskAdvisory: string;
  recommendedSuppressant: string;
}

export type SelfHealingPermissionStatus =
  | 'idle'
  | 'awaiting_permission'
  | 'executing'
  | 'completed'
  | 'denied';

export interface SelfHealingStep {
  id: string;
  title: string;
  subsystem: string;
  actionDetail: string;
  targetSummary: string;
  status: 'pending' | 'active' | 'completed';
}

export interface SelfHealingPlan {
  id: string;
  triggeredAt: string;
  habitatName: string;
  classification: RiskClassification;
  riskScore: number;
  hazardsSummary: string[];
  estimatedDurationSec: number;
  steps: SelfHealingStep[];
  targetTelemetry: Partial<EnvironmentalTelemetry>;
}

export interface SelfHealingAuditEntry {
  id: string;
  timestamp: string;
  action: 'requested' | 'approved' | 'auto_approved' | 'denied' | 'completed';
  classification: RiskClassification;
  riskScore: number;
  summary: string;
}

