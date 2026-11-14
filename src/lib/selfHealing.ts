import {
  EnvironmentalTelemetry,
  HabitatProfile,
  RiskAssessmentResult,
  SelfHealingPlan,
  SelfHealingStep,
  TierBounds,
} from '../types/habitat';

function midPoint(bounds: TierBounds): number {
  return (bounds.lower + bounds.upper) / 2;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function buildSelfHealingPlan(
  telemetry: EnvironmentalTelemetry,
  habitat: HabitatProfile,
  assessment: RiskAssessmentResult
): SelfHealingPlan {
  const th = habitat.thresholds;
  const targetO2 = Number(midPoint(th.oxygenPercent.tiers.normal).toFixed(1));
  const targetCo2 = Math.round(
    clamp(1400, th.carbonDioxidePpm.tiers.normal.lower + 200, th.carbonDioxidePpm.tiers.normal.upper * 0.75)
  );
  const targetPressure = Number(midPoint(th.pressureKPa.tiers.normal).toFixed(1));
  const targetTemp = Number(midPoint(th.internalTemperatureC.tiers.normal).toFixed(1));
  const targetHumidity = Math.round(midPoint(th.relativeHumidity.tiers.normal));
  const targetAirflow = Number(
    clamp(0.15, th.airflowVelocity.tiers.normal.lower + 0.03, th.airflowVelocity.tiers.normal.upper - 0.02).toFixed(2)
  );
  const targetRadiation = Number(
    Math.min(telemetry.radiationDoseRateUSvH, th.radiationDoseRateUSvH.tiers.normal.upper * 0.75).toFixed(1)
  );

  const steps: SelfHealingStep[] = [];
  const targetTelemetry: Partial<EnvironmentalTelemetry> = {};

  const fireOrSmoke =
    telemetry.fireDetected || telemetry.smokeDetected || telemetry.combustibleGasPpm > 5;
  if (fireOrSmoke) {
    steps.push({
      id: 'heal_fire',
      title: 'Isolate Ignition & Deploy Fine-Mist Fire Suppression',
      subsystem: 'Avionics PDU & Fire Suppression Bus',
      actionDetail:
        'Depower faulted bay rack, pause local recirculation draft, pulse CO₂/water-mist quench, and purge trace pyrolysis gases.',
      targetSummary: 'Fire/Smoke OFF · Combustible Gas < 1.5 ppm',
      status: 'pending',
    });
    targetTelemetry.fireDetected = false;
    targetTelemetry.smokeDetected = false;
    targetTelemetry.combustibleGasPpm = 0.8;
    targetTelemetry.heatGenerationRateKW = 1.6;
  }

  const pressureBreach =
    telemetry.pressureKPa < th.pressureKPa.tiers.normal.lower ||
    telemetry.pressureKPa > th.pressureKPa.tiers.normal.upper;
  if (pressureBreach) {
    steps.push({
      id: 'heal_pressure',
      title: 'Seal Hull Micro-Leaks & Re-Pressurize Cabin Envelope',
      subsystem: 'Self-Healing Polymer Bladder & N₂/O₂ PCA',
      actionDetail:
        'Activate smart hull elastomer sealants and open Pressure Control Assembly (PCA) N₂/O₂ make-up valves.',
      targetSummary: `Cabin Pressure → ${targetPressure} kPa`,
      status: 'pending',
    });
    targetTelemetry.pressureKPa = targetPressure;
  }

  const atmosBreach =
    telemetry.oxygenPercent < th.oxygenPercent.tiers.normal.lower ||
    telemetry.oxygenPercent > th.oxygenPercent.tiers.normal.upper ||
    telemetry.carbonDioxidePpm > th.carbonDioxidePpm.tiers.normal.upper ||
    telemetry.co2ScrubberStatus !== 'nominal' ||
    telemetry.oxygenGenStatus !== 'active';
  if (atmosBreach) {
    steps.push({
      id: 'heal_eclss',
      title: 'Switch to Redundant CDRA Bed & Balance O₂ / CO₂',
      subsystem: 'ECLSS CDRA + OGS Electrolysis',
      actionDetail:
        'Re-route cabin air through standby zeolite CO₂ scrubber bed, reset OGS electrolysis cells, and balance O₂ partial pressure.',
      targetSummary: `O₂ → ${targetO2}% · CO₂ → ${targetCo2} ppm`,
      status: 'pending',
    });
    targetTelemetry.oxygenPercent = targetO2;
    targetTelemetry.carbonDioxidePpm = targetCo2;
    targetTelemetry.co2ScrubberStatus = 'nominal';
    targetTelemetry.oxygenGenStatus = 'active';
    targetTelemetry.oxygenReserveHours = Math.max(72, telemetry.oxygenReserveHours);
  }

  const thermalOrVentBreach =
    telemetry.internalTemperatureC < th.internalTemperatureC.tiers.normal.lower ||
    telemetry.internalTemperatureC > th.internalTemperatureC.tiers.normal.upper ||
    telemetry.relativeHumidity < th.relativeHumidity.tiers.normal.lower ||
    telemetry.relativeHumidity > th.relativeHumidity.tiers.normal.upper ||
    telemetry.airflowVelocity < th.airflowVelocity.tiers.normal.lower ||
    telemetry.coolingSystemStatus !== 'nominal' ||
    telemetry.heatingSystemStatus !== 'nominal';
  if (thermalOrVentBreach) {
    steps.push({
      id: 'heal_thermal',
      title: 'Engage Backup ATCS Coolant Pump & IMV Diffuser',
      subsystem: 'ATCS Thermal Loop & IMV Ventilation',
      actionDetail:
        'Engage secondary ammonia/water heat exchanger pump, restore IMV duct fan RPM, and stabilize cabin temp & humidity.',
      targetSummary: `Temp → ${targetTemp}°C · Flow → ${targetAirflow} m/s · RH → ${targetHumidity}%`,
      status: 'pending',
    });
    targetTelemetry.internalTemperatureC = targetTemp;
    targetTelemetry.relativeHumidity = targetHumidity;
    targetTelemetry.airflowVelocity = targetAirflow;
    targetTelemetry.ventilationRatePercent = Math.max(92, telemetry.ventilationRatePercent);
    targetTelemetry.coolingSystemStatus = 'nominal';
    targetTelemetry.heatingSystemStatus = 'nominal';
  }

  const radOrPowerBreach =
    telemetry.radiationDoseRateUSvH > th.radiationDoseRateUSvH.tiers.normal.upper ||
    telemetry.powerSupplyPercent < 75 ||
    telemetry.emergencyPowerActive ||
    telemetry.waterAvailabilityPercent < 70 ||
    telemetry.waterRecyclingEfficiency < 90;
  if (radOrPowerBreach) {
    steps.push({
      id: 'heal_rad_power',
      title: 'Deploy Water-Wall Storm Shielding & Rebalance EPS Bus',
      subsystem: 'Water Wall Shielding, WRS & EPS Bus',
      actionDetail:
        'Flood perimeter water-wall radiation bladders, shed non-critical faulted loads, and re-tie primary solar/battery power bus.',
      targetSummary: `Rad ≤ ${targetRadiation} µSv/h · Bus ≥ 92% · WRS 95%`,
      status: 'pending',
    });
    targetTelemetry.radiationDoseRateUSvH = targetRadiation;
    targetTelemetry.shieldingEffectivenessPercent = Math.max(92, telemetry.shieldingEffectivenessPercent);
    targetTelemetry.powerSupplyPercent = Math.max(94, telemetry.powerSupplyPercent);
    targetTelemetry.batteryBackupPercent = Math.max(88, telemetry.batteryBackupPercent);
    targetTelemetry.emergencyPowerActive = false;
    targetTelemetry.waterAvailabilityPercent = Math.max(85, telemetry.waterAvailabilityPercent);
    targetTelemetry.waterRecyclingEfficiency = Math.max(95, telemetry.waterRecyclingEfficiency);
  }

  // Fallback comprehensive diagnostic calibration if triggered manually with minor warning
  if (steps.length === 0) {
    steps.push({
      id: 'heal_calibrate',
      title: 'Run Autonomous Sensor & ECLSS Envelope Trim',
      subsystem: 'Central ECLSS Controller',
      actionDetail:
        'Synchronize O₂, CO₂, cabin pressure, airflow, and thermal loops to habitat nominal midpoint.',
      targetSummary: `O₂ ${targetO2}% · ${targetPressure} kPa · ${targetTemp}°C`,
      status: 'pending',
    });
    targetTelemetry.oxygenPercent = targetO2;
    targetTelemetry.carbonDioxidePpm = targetCo2;
    targetTelemetry.pressureKPa = targetPressure;
    targetTelemetry.internalTemperatureC = targetTemp;
    targetTelemetry.relativeHumidity = targetHumidity;
    targetTelemetry.airflowVelocity = targetAirflow;
  }

  const hazardsSummary =
    assessment.hazards.length > 0
      ? assessment.hazards.slice(0, 4).map((h) => h.name)
      : [`${assessment.classification.replace('_', ' ').toUpperCase()} environmental deviation`];

  return {
    id: `heal_${Date.now()}`,
    triggeredAt: new Date().toISOString(),
    habitatName: habitat.name,
    classification: assessment.classification,
    riskScore: assessment.overallRiskScore,
    hazardsSummary,
    estimatedDurationSec: Math.max(4, steps.length * 2),
    steps,
    targetTelemetry,
  };
}

function lerpNum(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t, 0, 1);
}

export function interpolateTelemetryForHealing(
  startSnapshot: EnvironmentalTelemetry,
  plan: SelfHealingPlan,
  progress01: number
): EnvironmentalTelemetry {
  const t = clamp(progress01, 0, 1);
  const tgt = plan.targetTelemetry;
  const next: EnvironmentalTelemetry = { ...startSnapshot };

  if (tgt.oxygenPercent !== undefined) {
    next.oxygenPercent = Number(lerpNum(startSnapshot.oxygenPercent, tgt.oxygenPercent, t).toFixed(1));
  }
  if (tgt.carbonDioxidePpm !== undefined) {
    next.carbonDioxidePpm = Math.round(lerpNum(startSnapshot.carbonDioxidePpm, tgt.carbonDioxidePpm, t));
  }
  if (tgt.pressureKPa !== undefined) {
    next.pressureKPa = Number(lerpNum(startSnapshot.pressureKPa, tgt.pressureKPa, t).toFixed(1));
  }
  if (tgt.internalTemperatureC !== undefined) {
    next.internalTemperatureC = Number(lerpNum(startSnapshot.internalTemperatureC, tgt.internalTemperatureC, t).toFixed(1));
  }
  if (tgt.relativeHumidity !== undefined) {
    next.relativeHumidity = Math.round(lerpNum(startSnapshot.relativeHumidity, tgt.relativeHumidity, t));
  }
  if (tgt.airflowVelocity !== undefined) {
    next.airflowVelocity = Number(lerpNum(startSnapshot.airflowVelocity, tgt.airflowVelocity, t).toFixed(2));
  }
  if (tgt.ventilationRatePercent !== undefined) {
    next.ventilationRatePercent = Math.round(lerpNum(startSnapshot.ventilationRatePercent, tgt.ventilationRatePercent, t));
  }
  if (tgt.radiationDoseRateUSvH !== undefined) {
    next.radiationDoseRateUSvH = Number(lerpNum(startSnapshot.radiationDoseRateUSvH, tgt.radiationDoseRateUSvH, t).toFixed(1));
  }
  if (tgt.shieldingEffectivenessPercent !== undefined) {
    next.shieldingEffectivenessPercent = Math.round(
      lerpNum(startSnapshot.shieldingEffectivenessPercent, tgt.shieldingEffectivenessPercent, t)
    );
  }
  if (tgt.powerSupplyPercent !== undefined) {
    next.powerSupplyPercent = Math.round(lerpNum(startSnapshot.powerSupplyPercent, tgt.powerSupplyPercent, t));
  }
  if (tgt.batteryBackupPercent !== undefined) {
    next.batteryBackupPercent = Math.round(lerpNum(startSnapshot.batteryBackupPercent, tgt.batteryBackupPercent, t));
  }
  if (tgt.waterAvailabilityPercent !== undefined) {
    next.waterAvailabilityPercent = Number(lerpNum(startSnapshot.waterAvailabilityPercent, tgt.waterAvailabilityPercent, t).toFixed(1));
  }
  if (tgt.waterRecyclingEfficiency !== undefined) {
    next.waterRecyclingEfficiency = Number(lerpNum(startSnapshot.waterRecyclingEfficiency, tgt.waterRecyclingEfficiency, t).toFixed(1));
  }
  if (tgt.oxygenReserveHours !== undefined) {
    next.oxygenReserveHours = Math.round(lerpNum(startSnapshot.oxygenReserveHours, tgt.oxygenReserveHours, t));
  }
  if (tgt.combustibleGasPpm !== undefined) {
    next.combustibleGasPpm = Number(lerpNum(startSnapshot.combustibleGasPpm, tgt.combustibleGasPpm, t).toFixed(1));
  }
  if (tgt.heatGenerationRateKW !== undefined) {
    next.heatGenerationRateKW = Number(lerpNum(startSnapshot.heatGenerationRateKW, tgt.heatGenerationRateKW, t).toFixed(1));
  }

  // Discrete hardware & alarm flags clear smoothly as subsystems recover
  if (t >= 0.35) {
    if (tgt.fireDetected === false) next.fireDetected = false;
    if (tgt.emergencyPowerActive === false) next.emergencyPowerActive = false;
  }
  if (t >= 0.65) {
    if (tgt.smokeDetected === false) next.smokeDetected = false;
    if (tgt.co2ScrubberStatus) next.co2ScrubberStatus = tgt.co2ScrubberStatus;
    if (tgt.oxygenGenStatus) next.oxygenGenStatus = tgt.oxygenGenStatus;
  }
  if (t >= 0.85) {
    if (tgt.coolingSystemStatus) next.coolingSystemStatus = tgt.coolingSystemStatus;
    if (tgt.heatingSystemStatus) next.heatingSystemStatus = tgt.heatingSystemStatus;
  }

  return next;
}
