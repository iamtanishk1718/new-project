/**
 * Flame in Firefall - Deterministic Multi-Parameter Risk Assessment Engine
 * Dynamically evaluates telemetry against the active habitat's 5-tier risk thresholds.
 * Compliant with NASA-STD-3001, NASA Spaceflight Safety Guidelines, and HIDH.
 */

import {
  CategoryRiskScores,
  DetectedHazard,
  EnvironmentalTelemetry,
  HabitatProfile,
  HabitatThresholdsConfig,
  ParameterEvaluationResult,
  RiskAssessmentResult,
  RiskClassification,
  ThresholdParameterKey,
} from '../types/habitat';
import { computeHumanPhysiology } from './bioscience';
import { HABITAT_PROFILES } from './constants';
import {
  evaluateParameterThreshold,
  maxRiskTier,
  RISK_TIER_LABELS,
  THRESHOLD_PARAMETER_KEYS,
} from './thresholds';

function tierToHazardSeverity(
  tier: RiskClassification
): DetectedHazard['severity'] {
  switch (tier) {
    case 'extreme_emergency':
      return 'extreme';
    case 'critical':
      return 'critical';
    case 'high_risk':
      return 'high';
    default:
      return 'caution';
  }
}

export function calculateRiskAssessment(
  telemetry: EnvironmentalTelemetry,
  habitat: HabitatProfile
): RiskAssessmentResult {
  const thresholds: HabitatThresholdsConfig =
    habitat.thresholds ?? HABITAT_PROFILES[habitat.type]?.thresholds ?? HABITAT_PROFILES.iss.thresholds;
  const limits = habitat.limits;
  const hazards: DetectedHazard[] = [];

  // ==========================================
  // 1. EVALUATE CONFIGURABLE 5-TIER THRESHOLDS
  // ==========================================
  const rawValues: Record<ThresholdParameterKey, number> = {
    oxygenPercent: telemetry.oxygenPercent,
    carbonDioxidePpm: telemetry.carbonDioxidePpm,
    internalTemperatureC: telemetry.internalTemperatureC,
    pressureKPa: telemetry.pressureKPa,
    relativeHumidity: telemetry.relativeHumidity,
    airflowVelocity: telemetry.airflowVelocity,
    radiationDoseRateUSvH: telemetry.radiationDoseRateUSvH,
  };

  const parameterEvaluations = {} as Record<ThresholdParameterKey, ParameterEvaluationResult>;
  let worstParameterTier: RiskClassification = 'normal';

  for (const key of THRESHOLD_PARAMETER_KEYS) {
    const spec = thresholds[key];
    const evalResult = evaluateParameterThreshold(rawValues[key], spec);
    parameterEvaluations[key] = evalResult;
    worstParameterTier = maxRiskTier(worstParameterTier, evalResult.tier);
  }

  const o2Eval = parameterEvaluations.oxygenPercent;
  const co2Eval = parameterEvaluations.carbonDioxidePpm;
  const pressureEval = parameterEvaluations.pressureKPa;
  const tempEval = parameterEvaluations.internalTemperatureC;
  const humidityEval = parameterEvaluations.relativeHumidity;
  const airflowEval = parameterEvaluations.airflowVelocity;
  const radiationEval = parameterEvaluations.radiationDoseRateUSvH;

  // ==========================================
  // 2. INDIVIDUAL CATEGORY SCORES (0 - 100)
  // ==========================================

  // --- ATMOSPHERIC RISK ---
  const atmosphericScore = Math.min(
    100,
    Math.round(
      Math.max(o2Eval.score, co2Eval.score, pressureEval.score) * 0.72 +
        (o2Eval.score + co2Eval.score + pressureEval.score) * 0.14
    )
  );

  // --- THERMAL RISK ---
  let thermalScore = tempEval.score * 0.8 + humidityEval.score * 0.25;
  if (telemetry.coolingSystemStatus === 'failed') thermalScore += 30;
  else if (telemetry.coolingSystemStatus === 'degraded') thermalScore += 14;
  if (telemetry.heatingSystemStatus === 'failed') thermalScore += 22;
  else if (telemetry.heatingSystemStatus === 'degraded') thermalScore += 10;
  thermalScore = Math.min(100, Math.round(thermalScore));

  // --- FIRE RISK ---
  let fireScore = 0;
  if (telemetry.fireDetected) fireScore += 85;
  if (telemetry.smokeDetected) fireScore += 50;
  if (telemetry.combustibleGasPpm > 5) {
    fireScore += Math.min(45, (telemetry.combustibleGasPpm - 5) * 4);
  }
  if (telemetry.oxygenPercent > thresholds.oxygenPercent.tiers.caution.upper) {
    // Hyperoxic combustion acceleration above habitat caution ceiling
    fireScore += (telemetry.oxygenPercent - thresholds.oxygenPercent.tiers.caution.upper) * 6;
  }
  fireScore = Math.min(100, Math.round(fireScore));

  // --- RADIATION RISK ---
  let radiationScore = radiationEval.score;
  if (telemetry.shieldingEffectivenessPercent < 60) {
    radiationScore += (60 - telemetry.shieldingEffectivenessPercent) * 0.55;
  }
  radiationScore = Math.min(100, Math.round(radiationScore));

  // --- VENTILATION RISK ---
  let ventilationScore = airflowEval.score * 0.85;
  if (telemetry.ventilationRatePercent < 70) {
    ventilationScore += (70 - telemetry.ventilationRatePercent) * 0.7;
  }
  ventilationScore = Math.min(100, Math.round(ventilationScore));

  // --- LIFE SUPPORT RISK ---
  let lifeSupportScore = 0;
  if (telemetry.co2ScrubberStatus === 'failed') lifeSupportScore += 45;
  else if (telemetry.co2ScrubberStatus === 'degraded') lifeSupportScore += 20;

  if (telemetry.oxygenGenStatus === 'fault') lifeSupportScore += 40;
  else if (telemetry.oxygenGenStatus === 'standby') lifeSupportScore += 10;

  if (telemetry.oxygenReserveHours < 48) {
    lifeSupportScore += Math.min(40, (48 - telemetry.oxygenReserveHours) * 1.2);
  }
  lifeSupportScore = Math.min(100, Math.round(lifeSupportScore));

  // --- RESOURCE & POWER RISK ---
  let resourceScore = 0;
  if (telemetry.powerSupplyPercent < 50) {
    resourceScore += (50 - telemetry.powerSupplyPercent) * 1.1;
  }
  if (telemetry.batteryBackupPercent < 50) {
    resourceScore += (50 - telemetry.batteryBackupPercent) * 0.9;
  }
  if (telemetry.waterAvailabilityPercent < 60) {
    resourceScore += (60 - telemetry.waterAvailabilityPercent) * 0.8;
  }
  if (telemetry.emergencyPowerActive) resourceScore += 25;
  resourceScore = Math.min(100, Math.round(resourceScore));

  const categoryScores: CategoryRiskScores = {
    atmospheric: atmosphericScore,
    thermal: thermalScore,
    fire: fireScore,
    radiation: radiationScore,
    ventilation: ventilationScore,
    lifeSupport: lifeSupportScore,
    resource: resourceScore,
  };

  // ==========================================
  // 3. SINGLE-PARAMETER THRESHOLD BREACH HAZARDS
  // ==========================================
  for (const key of THRESHOLD_PARAMETER_KEYS) {
    const ev = parameterEvaluations[key];
    if (ev.tier === 'normal') continue;

    const spec = thresholds[key];
    const tierName = RISK_TIER_LABELS[ev.tier];
    hazards.push({
      id: `threshold-${key}`,
      name: `${spec.label} ${tierName} Threshold Breach`,
      category: spec.category,
      severity: tierToHazardSeverity(ev.tier),
      likelihood: ev.tier === 'extreme_emergency' ? 99 : ev.tier === 'critical' ? 94 : ev.tier === 'high_risk' ? 84 : 72,
      score: ev.score,
      affectedParameters: [`${spec.label} (${ev.value} ${spec.unit})`],
      explanation: `${ev.message} Configured ${habitat.name} ${tierName} envelope: [${ev.activeBounds.lower} – ${ev.activeBounds.upper} ${spec.unit}].`,
      potentialConsequences: [
        `Exceeds ${habitat.type.toUpperCase()} habitat ${tierName.toLowerCase()} operating margin`,
        'Progressive strain on ECLSS closed-loop compensation and crew physiology',
      ],
      recommendedActions: [
        `Inspect ${spec.category} subsystem controls and stabilize ${spec.label} within ${ev.normalBounds.lower}–${ev.normalBounds.upper} ${spec.unit}`,
        'Verify sensor calibration and engage redundant life-support loop if drift continues',
      ],
    });
  }

  // ==========================================
  // 4. MULTI-PARAMETER CORRELATION & COMPOUND HAZARDS
  // ==========================================

  // Scenario 1: Low O2 + Elevated CO2 + Crew Demand
  if (
    o2Eval.tier !== 'normal' &&
    o2Eval.breachDirection === 'low' &&
    co2Eval.tier !== 'normal' &&
    telemetry.activeOccupants >= 3
  ) {
    const worstAtm = maxRiskTier(o2Eval.tier, co2Eval.tier);
    hazards.push({
      id: 'hazard-atmospheric-degradation',
      name: 'Atmospheric Degradation & Life-Support Demand Spike',
      category: 'atmospheric',
      severity: tierToHazardSeverity(worstAtm),
      likelihood: 95,
      score: Math.max(80, Math.round((o2Eval.score + co2Eval.score) / 2 + 12)),
      affectedParameters: ['Oxygen concentration (O2 %)', 'Carbon dioxide (CO2 ppm)', 'Crew Occupancy'],
      explanation: `Oxygen (${telemetry.oxygenPercent}%) and CO2 (${telemetry.carbonDioxidePpm} ppm) have simultaneously breached ${habitat.name} thresholds under load of ${telemetry.activeOccupants} crew members.`,
      potentialConsequences: [
        'Onset of cognitive slowing, headache, and peripheral vasodilation',
        'Accelerated exhaustion of secondary O2 and LiOH scrubber consumables',
        'Hypoxic depression of executive decision making',
      ],
      recommendedActions: [
        'Command OGS (Oxygen Generation System) to boost mode',
        'Verify primary and secondary CDRA scrubber desiccant valve cycling',
        'Enforce rest protocols to reduce crew metabolic consumption',
      ],
    });
  }

  // Scenario 2: High Temp + Smoke / Fire + Airflow
  if (
    (telemetry.smokeDetected || telemetry.fireDetected) &&
    (telemetry.internalTemperatureC > thresholds.internalTemperatureC.tiers.normal.upper || telemetry.fireDetected)
  ) {
    hazards.push({
      id: 'hazard-fire-pyrolysis',
      name: 'Avionics Thermal Runaway & Combustion Emergency',
      category: 'fire',
      severity: telemetry.fireDetected ? 'extreme' : 'critical',
      likelihood: 98,
      score: telemetry.fireDetected ? 96 : 85,
      affectedParameters: ['Fire/Smoke sensors', 'Internal temperature', 'Airflow velocity', 'Combustible gases'],
      explanation: `Active combustion or dense pyrolysis detected with elevated cabin temperature (${telemetry.internalTemperatureC}°C) and volatile gases (${telemetry.combustibleGasPpm} ppm). Airflow risks spreading toxic smoke across modules.`,
      potentialConsequences: [
        'Lethal atmospheric toxicity within 180 seconds if smoke spreads',
        'Thermal damage to pressurized bulkhead hull and wiring harnesses',
        'Optical blackout and sensor blinding inside cabin',
      ],
      recommendedActions: [
        'All crew immediately don PBA (Portable Breathing Apparatus)',
        'Isolate inter-module ventilation (IMV) dampers immediately to starve convection',
        'Cut power bus to overheating electronics bay and inject fire suppressant via port',
      ],
    });
  }

  // Scenario 3: Low Pressure + Abnormal O2/Airflow (Cabin Depressurization)
  if (
    pressureEval.tier !== 'normal' &&
    pressureEval.breachDirection === 'low' &&
    (o2Eval.tier !== 'normal' || telemetry.airflowVelocity > 0.3)
  ) {
    hazards.push({
      id: 'hazard-depressurization',
      name: 'Rapid Cabin Depressurization / Hull Breach',
      category: 'atmospheric',
      severity:
        pressureEval.tier === 'extreme_emergency'
          ? 'extreme'
          : pressureEval.tier === 'critical'
          ? 'critical'
          : 'high',
      likelihood: 90,
      score: Math.max(78, pressureEval.score + 8),
      affectedParameters: ['Atmospheric pressure (kPa)', 'Oxygen concentration', 'Airflow velocity'],
      explanation: `Cabin pressure dropped to ${telemetry.pressureKPa} kPa (below ${habitat.type.toUpperCase()} normal lower bound ${limits.pressureMinKPa} kPa) with convective pressure differential airflow.`,
      potentialConsequences: [
        'Time of Useful Consciousness (TUC) degrades sharply during unchecked depressurization',
        'Boiling of water lines and barotrauma risks to crew ears and lungs',
        'Total module evacuation required if breach is not located within minutes',
      ],
      recommendedActions: [
        'Initiate NASA ISS Flight Rule B13-102 emergency hatch isolation',
        'Deploy ultrasonic acoustic hull leak sniffers along structural seams',
        'Ready launch and entry suits (LEAS) and verify safe-haven vehicle docking integrity',
      ],
    });
  }

  // Scenario 4: High CO2 + Scrubber Failure
  if (
    co2Eval.tier !== 'normal' &&
    (telemetry.co2ScrubberStatus === 'failed' || telemetry.co2ScrubberStatus === 'degraded')
  ) {
    hazards.push({
      id: 'hazard-co2-scrubber-exhaustion',
      name: 'CDRA Scrubber Failure & Toxic Hypercapnia',
      category: 'lifeSupport',
      severity: telemetry.co2ScrubberStatus === 'failed' ? 'critical' : 'high',
      likelihood: 92,
      score: Math.max(74, co2Eval.score + 10),
      affectedParameters: ['CO2 Scrubber status', 'CO2 concentration in ppm', 'Ventilation rate'],
      explanation: `Carbon dioxide removal assembly is ${telemetry.co2ScrubberStatus} while CO2 reached ${telemetry.carbonDioxidePpm} ppm (normal max: ${thresholds.carbonDioxidePpm.tiers.normal.upper} ppm).`,
      potentialConsequences: [
        'Acute respiratory acidosis, disorientation, and vision blur',
        'Progressive loss of fine motor skills preventing EVA or docking operations',
        'Irreversible narcosis if cabin levels escalate unchecked',
      ],
      recommendedActions: [
        'Deploy auxiliary consumable Lithium Hydroxide (LiOH) absorbent canisters',
        'Switch secondary amine bed heater loop to cycle desiccant regeneration',
        'Ensure cabin ventilation fans remain at 100% to avert local dead-zone CO2 pockets',
      ],
    });
  }

  // Scenario 5: High Radiation + Low Shielding
  if (
    radiationEval.tier !== 'normal' &&
    telemetry.shieldingEffectivenessPercent < 75
  ) {
    hazards.push({
      id: 'hazard-solar-radiation',
      name: 'High-Energy Solar Particle Event & Radiative Overdose',
      category: 'radiation',
      severity: tierToHazardSeverity(radiationEval.tier),
      likelihood: 88,
      score: Math.max(70, radiationEval.score + 6),
      affectedParameters: ['Radiation dose rate (µSv/h)', 'Shielding effectiveness (%)', 'Accumulated dose'],
      explanation: `Current ionizing flux (${telemetry.radiationDoseRateUSvH} µSv/h) exceeds ${habitat.type.toUpperCase()} threshold (${thresholds.radiationDoseRateUSvH.tiers.normal.upper} µSv/h) with degraded structural shielding (${telemetry.shieldingEffectivenessPercent}%).`,
      potentialConsequences: [
        'DNA double-strand breaks triggering acute cellular p53 apoptotic signaling',
        'Hematopoietic and gastrointestinal radiation syndrome if sustained',
        'Exceedance of NASA career astronaut 600 mSv radiation limits',
      ],
      recommendedActions: [
        'Direct all crew members into the habitat central storm shelter / water wall haven',
        'Reposition habitat payload and water bladder barriers to solar wind vector',
        'Begin biodosimeter blood marker tracking and administer prophylactic radioprotectants',
      ],
    });
  }

  // Scenario 6: High Temp + Cooling Failure
  if (
    tempEval.tier !== 'normal' &&
    tempEval.breachDirection === 'high' &&
    telemetry.coolingSystemStatus !== 'nominal'
  ) {
    hazards.push({
      id: 'hazard-thermal-control-failure',
      name: 'Active Thermal Control (ATCS) Loop Failure & Heat Stagnation',
      category: 'thermal',
      severity: tierToHazardSeverity(tempEval.tier),
      likelihood: 85,
      score: Math.max(70, tempEval.score + 8),
      affectedParameters: ['Internal habitat temperature', 'Cooling system loop', 'Heat generation rate'],
      explanation: `Internal cabin temperature (${telemetry.internalTemperatureC}°C) exceeded safe bound (${thresholds.internalTemperatureC.tiers.normal.upper}°C) with cooling system in ${telemetry.coolingSystemStatus} state.`,
      potentialConsequences: [
        'Crew heat exhaustion, dehydration, and cognitive fatigue',
        'Avionics computer thermal throttling or automatic emergency shutdown',
        'Increased condensation on cold bulkhead spots causing electrical shorts and mold',
      ],
      recommendedActions: [
        'Shed non-essential electrical loads to lower metabolic + avionics heat flux',
        'Cross-tie thermal loop to secondary heat exchanger or external radiator bypass',
        'Increase coolant pump RPM and verify external radiator orientation away from direct sunlight',
      ],
    });
  }

  // Scenario 7: Stagnant Airflow / Microgravity Pocket Risk
  if (airflowEval.tier !== 'normal' && telemetry.activeOccupants > 1) {
    hazards.push({
      id: 'hazard-stagnant-airflow',
      name: 'Microgravity Stagnant Air Pocket & Local Asphyxiation Risk',
      category: 'ventilation',
      severity: tierToHazardSeverity(airflowEval.tier),
      likelihood: 89,
      score: Math.max(62, airflowEval.score),
      affectedParameters: ['Airflow velocity (m/s)', 'Ventilation efficiency (%)'],
      explanation: `Airflow velocity dropped to ${telemetry.airflowVelocity} m/s (minimum normal bound ${thresholds.airflowVelocity.tiers.normal.lower} m/s). Without natural buoyancy in microgravity, exhaled CO2 forms a stationary pocket around crew.`,
      potentialConsequences: [
        'Localized asphyxiation and sudden hypoxia even when module bulk sensors report nominal',
        'Sleep station suffocating buildup during crew rest cycles',
        'Thermal stratification and sensor false-reading zones',
      ],
      recommendedActions: [
        'Engage auxiliary localized cabin diffuser fans immediately',
        'Inspect ventilation intake debris screens for lint and particulate blockage',
        'Instruct crew to avoid stationary work in dead-end module corners',
      ],
    });
  }

  // Scenario 8: Power Supply & Reserve Depletion
  if (
    telemetry.powerSupplyPercent < 45 ||
    (telemetry.emergencyPowerActive && telemetry.batteryBackupPercent < 50)
  ) {
    hazards.push({
      id: 'hazard-power-grid-collapse',
      name: 'Electrical Power Grid Strain & Life Support Shedding',
      category: 'resource',
      severity: telemetry.batteryBackupPercent < 30 ? 'critical' : 'high',
      likelihood: 90,
      score: 75,
      affectedParameters: ['Power supply availability (%)', 'Battery backup reserve (%)', 'Emergency power status'],
      explanation: `Power bus availability dropped to ${telemetry.powerSupplyPercent}% with battery reserve at ${telemetry.batteryBackupPercent}%. Habitat is operating on limited autonomy margin.`,
      potentialConsequences: [
        'Cascading automatic shedding of OGS, CDRA scrubbers, and thermal coolant pumps',
        'Critical communication link loss with NASA Mission Control (Huntsville/Houston)',
        'Loss of active attitude control and solar tracking alignment',
      ],
      recommendedActions: [
        'Initiate Emergency Power Shedding Rule E-14 (power down science payload racks)',
        'Verify solar array alpha/beta gimbal drive tracking against orbital ephemeris',
        'Conserve battery reserves for ECLSS core life support and communications',
      ],
    });
  }

  // ==========================================
  // 5. WEIGHTED OVERALL RISK & HEALTH CALCULATION
  // ==========================================
  const weights = {
    fire: 0.25,
    atmospheric: 0.22,
    lifeSupport: 0.18,
    ventilation: 0.12,
    thermal: 0.10,
    radiation: 0.08,
    resource: 0.05,
  };

  const weightedRisk =
    categoryScores.fire * weights.fire +
    categoryScores.atmospheric * weights.atmospheric +
    categoryScores.lifeSupport * weights.lifeSupport +
    categoryScores.ventilation * weights.ventilation +
    categoryScores.thermal * weights.thermal +
    categoryScores.radiation * weights.radiation +
    categoryScores.resource * weights.resource;

  const maxHazardScore = hazards.length > 0 ? Math.max(...hazards.map((h) => h.score)) : 0;
  const overallRiskScore = Math.min(
    100,
    Math.round(weightedRisk * 0.50 + maxHazardScore * 0.50)
  );

  const overallHealthScore = Math.max(0, 100 - overallRiskScore);

  // Classification integrates dynamic parameter tiers, hazards, and aggregate score
  let classification: RiskClassification = worstParameterTier;
  if (overallRiskScore >= 85 || categoryScores.fire >= 80 || hazards.some((h) => h.severity === 'extreme')) {
    classification = maxRiskTier(classification, 'extreme_emergency');
  } else if (overallRiskScore >= 65 || hazards.some((h) => h.severity === 'critical')) {
    classification = maxRiskTier(classification, 'critical');
  } else if (overallRiskScore >= 40 || hazards.some((h) => h.severity === 'high')) {
    classification = maxRiskTier(classification, 'high_risk');
  } else if (overallRiskScore >= 20 || hazards.some((h) => h.severity === 'caution')) {
    classification = maxRiskTier(classification, 'caution');
  }

  const activeWarningsCount = hazards.filter(
    (h) => h.severity === 'caution' || h.severity === 'high'
  ).length;
  const criticalHazardsCount = hazards.filter(
    (h) => h.severity === 'critical' || h.severity === 'extreme'
  ).length;

  const bioscience = computeHumanPhysiology(
    telemetry.oxygenPercent,
    telemetry.carbonDioxidePpm,
    telemetry.pressureKPa,
    telemetry.activeOccupants,
    telemetry.crewActivityLevel,
    telemetry.radiationDoseRateUSvH,
    telemetry.accumulatedDoseMSv
  );

  return {
    overallHealthScore,
    overallRiskScore,
    classification,
    activeWarningsCount,
    criticalHazardsCount,
    categoryScores,
    parameterEvaluations,
    hazards,
    bioscienceImpacts: {
      hypoxiaRisk:
        bioscience.hypoxiaState === 'critical_anoxia'
          ? 'lethal'
          : bioscience.hypoxiaState === 'severe_hypoxia'
          ? 'severe'
          : bioscience.hypoxiaState === 'moderate_hypoxia'
          ? 'moderate'
          : bioscience.hypoxiaState === 'mild_hypoxia'
          ? 'mild'
          : 'none',
      hypercapniaRisk:
        bioscience.hypercapniaState === 'lethal_narcosis'
          ? 'lethal'
          : bioscience.hypercapniaState === 'severe_hypercapnia'
          ? 'severe'
          : bioscience.hypercapniaState === 'acidosis_risk'
          ? 'moderate'
          : bioscience.hypercapniaState === 'mild_headache'
          ? 'mild'
          : 'none',
      radiationRiskDoseTier:
        telemetry.radiationDoseRateUSvH > thresholds.radiationDoseRateUSvH.tiers.critical.upper
          ? 'critical'
          : telemetry.radiationDoseRateUSvH > thresholds.radiationDoseRateUSvH.tiers.high_risk.upper
          ? 'acute_sick'
          : telemetry.radiationDoseRateUSvH > thresholds.radiationDoseRateUSvH.tiers.normal.upper
          ? 'career_elevated'
          : 'safe',
      cellularPathwayAffected: [
        bioscience.radiationCellularResponse.activePathwayDescription,
        bioscience.hypoxiaState !== 'nominal'
          ? 'HIF-1alpha hypoxia-inducible pathway activated (VEGF and EPO gene transcription)'
          : 'Basal oxygen sensing nominal',
        bioscience.hypercapniaState !== 'nominal'
          ? 'Renal bicarbonate retention and carbonic anhydrase compensatory buffering'
          : 'Acid-base homeostasis nominal',
      ],
    },
  };
}
