import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_TELEMETRY, HABITAT_PROFILES } from './constants';
import { calculateRiskAssessment } from './riskEngine';
import { buildSelfHealingPlan, interpolateTelemetryForHealing } from './selfHealing';

test('buildSelfHealingPlan diagnoses multi-hazard breaches and restores habitat telemetry to normal', () => {
  const habitat = HABITAT_PROFILES.iss;
  const criticalTelemetry = {
    ...DEFAULT_TELEMETRY,
    fireDetected: true,
    smokeDetected: true,
    combustibleGasPpm: 28.0,
    oxygenPercent: 16.5,
    carbonDioxidePpm: 8800,
    pressureKPa: 76.0,
    internalTemperatureC: 35.5,
    airflowVelocity: 0.02,
    co2ScrubberStatus: 'failed' as const,
    coolingSystemStatus: 'failed' as const,
    oxygenGenStatus: 'fault' as const,
    powerSupplyPercent: 52,
    emergencyPowerActive: true,
  };

  const beforeAssessment = calculateRiskAssessment(criticalTelemetry, habitat);
  assert.ok(
    beforeAssessment.classification === 'critical' ||
      beforeAssessment.classification === 'extreme_emergency'
  );

  const plan = buildSelfHealingPlan(criticalTelemetry, habitat, beforeAssessment);
  assert.ok(plan.steps.length >= 4, 'Should generate subsystem-specific repair steps');
  assert.ok(plan.steps.some((s) => s.id === 'heal_fire'));
  assert.ok(plan.steps.some((s) => s.id === 'heal_pressure'));
  assert.ok(plan.steps.some((s) => s.id === 'heal_eclss'));

  const midTelemetry = interpolateTelemetryForHealing(criticalTelemetry, plan, 0.5);
  assert.equal(midTelemetry.fireDetected, false, 'Fire flag clears early in remediation');
  assert.ok(midTelemetry.pressureKPa > criticalTelemetry.pressureKPa);

  const healedTelemetry = interpolateTelemetryForHealing(criticalTelemetry, plan, 1.0);
  const afterAssessment = calculateRiskAssessment(healedTelemetry, habitat);
  assert.equal(afterAssessment.classification, 'normal', 'Full self-healing restores nominal classification');
  assert.equal(healedTelemetry.co2ScrubberStatus, 'nominal');
  assert.equal(healedTelemetry.coolingSystemStatus, 'nominal');
  assert.equal(healedTelemetry.oxygenGenStatus, 'active');
  assert.equal(healedTelemetry.fireDetected, false);
});
