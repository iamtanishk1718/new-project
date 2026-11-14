import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TELEMETRY, HABITAT_PROFILES } from './constants';
import { calculateRiskAssessment } from './riskEngine';
import {
  cloneThresholdsConfig,
  evaluateParameterThreshold,
  exportThresholdsJson,
  parseSingleHabitatThresholdsJson,
  validateParameterThresholdSpec,
} from './thresholds';

test('ISS nominal telemetry evaluates to Normal across all 7 configured parameters', () => {
  const result = calculateRiskAssessment(DEFAULT_TELEMETRY, HABITAT_PROFILES.iss);
  assert.equal(result.classification, 'normal');
  assert.equal(result.criticalHazardsCount, 0);
  assert.equal(result.activeWarningsCount, 0);
  assert.equal(result.hazards.length, 0);
  assert.equal(result.parameterEvaluations.oxygenPercent.tier, 'normal');
  assert.equal(result.parameterEvaluations.carbonDioxidePpm.tier, 'normal');
  assert.equal(result.parameterEvaluations.pressureKPa.tier, 'normal');
  assert.equal(result.parameterEvaluations.internalTemperatureC.tier, 'normal');
});

test('5-tier O2 thresholds classify Normal -> Caution -> High Risk -> Critical -> Extreme Emergency accurately', () => {
  const o2Spec = HABITAT_PROFILES.iss.thresholds.oxygenPercent;
  assert.equal(evaluateParameterThreshold(21.0, o2Spec).tier, 'normal');
  assert.equal(evaluateParameterThreshold(19.0, o2Spec).tier, 'caution');
  assert.equal(evaluateParameterThreshold(18.0, o2Spec).tier, 'high_risk');
  assert.equal(evaluateParameterThreshold(16.8, o2Spec).tier, 'critical');
  assert.equal(evaluateParameterThreshold(14.0, o2Spec).tier, 'extreme_emergency');
  // Upper side (hyperoxic fire risk)
  assert.equal(evaluateParameterThreshold(24.0, o2Spec).tier, 'caution');
  assert.equal(evaluateParameterThreshold(25.5, o2Spec).tier, 'high_risk');
  assert.equal(evaluateParameterThreshold(27.5, o2Spec).tier, 'critical');
  assert.equal(evaluateParameterThreshold(31.0, o2Spec).tier, 'extreme_emergency');
});

test('Switching from ISS to Mars Habitat dynamically applies Mars atmospheric thresholds', () => {
  // 101.3 kPa & 21% O2 is Normal on ISS, but outside Mars Habitat nominal envelope (68-74 kPa, 24-28% O2)
  const marsEval = calculateRiskAssessment(DEFAULT_TELEMETRY, HABITAT_PROFILES.mars);
  assert.equal(marsEval.parameterEvaluations.oxygenPercent.tier, 'high_risk');
  assert.equal(marsEval.parameterEvaluations.pressureKPa.tier, 'extreme_emergency');
  assert.ok(marsEval.overallRiskScore > 40);
  assert.ok(marsEval.hazards.length >= 2);
});

test('Modifying configured threshold bounds dynamically updates risk score, classification, and alerts', () => {
  const baseResult = calculateRiskAssessment(DEFAULT_TELEMETRY, HABITAT_PROFILES.iss);
  assert.equal(baseResult.classification, 'normal');

  // Tighten ISS CO2 thresholds so DEFAULT_TELEMETRY (1850 ppm) becomes Critical
  const customThresholds = cloneThresholdsConfig(HABITAT_PROFILES.iss.thresholds);
  customThresholds.carbonDioxidePpm.tiers.normal = { lower: 0, upper: 800 };
  customThresholds.carbonDioxidePpm.tiers.caution = { lower: 0, upper: 1100 };
  customThresholds.carbonDioxidePpm.tiers.high_risk = { lower: 0, upper: 1500 };
  customThresholds.carbonDioxidePpm.tiers.critical = { lower: 0, upper: 2200 };
  customThresholds.carbonDioxidePpm.tiers.extreme_emergency = { lower: 0, upper: 3000 };

  const customHabitat = {
    ...HABITAT_PROFILES.iss,
    thresholds: customThresholds,
  };

  const tightenedResult = calculateRiskAssessment(DEFAULT_TELEMETRY, customHabitat);
  assert.equal(tightenedResult.parameterEvaluations.carbonDioxidePpm.tier, 'critical');
  assert.equal(tightenedResult.classification, 'critical');
  assert.ok(tightenedResult.overallRiskScore > baseResult.overallRiskScore);
  assert.ok(
    tightenedResult.hazards.some((h) => h.id === 'threshold-carbonDioxidePpm' && h.severity === 'critical')
  );
});

test('validateParameterThresholdSpec catches inverted lower/upper bounds and non-monotonic tiers', () => {
  const broken = cloneThresholdsConfig(HABITAT_PROFILES.iss.thresholds).oxygenPercent;
  broken.tiers.caution = { lower: 20.5, upper: 24.5 }; // tighter than normal.lower (19.5) -> invalid
  const errors = validateParameterThresholdSpec(broken);
  assert.ok(errors.length > 0);

  const validErrors = validateParameterThresholdSpec(HABITAT_PROFILES.iss.thresholds.oxygenPercent);
  assert.equal(validErrors.length, 0);
});

test('JSON export and single-habitat import roundtrip preserves edited thresholds', () => {
  const json = exportThresholdsJson(HABITAT_PROFILES);
  const parsed = JSON.parse(json);
  assert.equal(parsed.version, '1.0');
  assert.ok(parsed.habitats.mars.thresholds.pressureKPa.tiers.normal.lower === 68);

  const roundtrip = parseSingleHabitatThresholdsJson(
    JSON.stringify(parsed.habitats.mars.thresholds),
    HABITAT_PROFILES.mars.thresholds
  );
  assert.equal(roundtrip.error, undefined);
  assert.equal(roundtrip.thresholds?.pressureKPa.tiers.normal.lower, 68);
});
