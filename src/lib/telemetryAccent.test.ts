import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TELEMETRY, HABITAT_PROFILES } from './constants';
import {
  getTelemetryMetricAccent,
  getThresholdParamAccent,
  getScoreAccent,
} from './telemetryAccent';

test('All nominal default telemetry metrics on ISS evaluate to cyan accent', () => {
  const iss = HABITAT_PROFILES.iss;
  const keys = [
    'oxygenPercent',
    'carbonDioxidePpm',
    'pressureKPa',
    'internalTemperatureC',
    'airflowVelocity',
    'radiationDoseRateUSvH',
    'relativeHumidity',
    'fireSmoke',
    'powerSupplyPercent',
    'oxygenReserveHours',
    'co2ScrubberStatus',
    'waterAvailabilityPercent',
  ] as const;

  for (const key of keys) {
    const res = getTelemetryMetricAccent(DEFAULT_TELEMETRY, iss, key);
    assert.equal(res.tone, 'cyan', `Expected ${key} at nominal baseline to be cyan`);
  }
});

test('Bidirectional parameter (O2) shifts cyan -> amber -> deep red approaching both lower and upper limits', () => {
  const o2Spec = HABITAT_PROFILES.iss.thresholds.oxygenPercent;
  // Normal: 19.5 - 23.5, Caution: 18.5 - 24.5, High risk: 17.5 - 26.0
  assert.equal(getThresholdParamAccent(21.2, o2Spec).tone, 'cyan');
  // Approaching lower limit (inside normal edge)
  assert.equal(getThresholdParamAccent(19.7, o2Spec).tone, 'amber');
  // Caution breach on lower limit
  assert.equal(getThresholdParamAccent(19.0, o2Spec).tone, 'amber');
  // Deep red breach on lower limit
  assert.equal(getThresholdParamAccent(18.0, o2Spec).tone, 'red');
  // Approaching upper limit (inside normal edge)
  assert.equal(getThresholdParamAccent(23.2, o2Spec).tone, 'amber');
  // Caution breach on upper limit
  assert.equal(getThresholdParamAccent(24.1, o2Spec).tone, 'amber');
  // Deep red breach on upper limit
  assert.equal(getThresholdParamAccent(25.8, o2Spec).tone, 'red');
});

test('Upper-only parameter (CO2) shifts cyan -> amber -> deep red as levels rise toward limits', () => {
  const co2Spec = HABITAT_PROFILES.iss.thresholds.carbonDioxidePpm;
  // Normal upper 2500, caution upper 3800
  assert.equal(getThresholdParamAccent(1850, co2Spec).tone, 'cyan');
  assert.equal(getThresholdParamAccent(2200, co2Spec).tone, 'amber');
  assert.equal(getThresholdParamAccent(3200, co2Spec).tone, 'amber');
  assert.equal(getThresholdParamAccent(4200, co2Spec).tone, 'red');
});

test('Lower-only parameter (Airflow) shifts cyan -> amber -> deep red as velocity drops', () => {
  const flowSpec = HABITAT_PROFILES.iss.thresholds.airflowVelocity;
  // Normal lower 0.08, caution lower 0.06
  assert.equal(getThresholdParamAccent(0.14, flowSpec).tone, 'cyan');
  assert.equal(getThresholdParamAccent(0.10, flowSpec).tone, 'amber');
  assert.equal(getThresholdParamAccent(0.07, flowSpec).tone, 'amber');
  assert.equal(getThresholdParamAccent(0.04, flowSpec).tone, 'red');
});

test('Switching active habitat profile shifts color evaluation to that habitat limits', () => {
  // 21% O2 & 101.3 kPa is cyan on ISS, but critical (deep red) for Lunar Artemis (28-34% O2, 55-60 kPa)
  const lunar = HABITAT_PROFILES.lunar;
  assert.equal(getTelemetryMetricAccent(DEFAULT_TELEMETRY, lunar, 'oxygenPercent').tone, 'red');
  assert.equal(getTelemetryMetricAccent(DEFAULT_TELEMETRY, lunar, 'pressureKPa').tone, 'red');
});

test('Auxiliary subsystem & hazard score accents follow cyan -> amber -> red', () => {
  const iss = HABITAT_PROFILES.iss;
  const smokeTelem = { ...DEFAULT_TELEMETRY, smokeDetected: true };
  const fireTelem = { ...DEFAULT_TELEMETRY, fireDetected: true };
  assert.equal(getTelemetryMetricAccent(smokeTelem, iss, 'fireSmoke').tone, 'amber');
  assert.equal(getTelemetryMetricAccent(fireTelem, iss, 'fireSmoke').tone, 'red');

  assert.equal(getScoreAccent(10).tone, 'cyan');
  assert.equal(getScoreAccent(35).tone, 'amber');
  assert.equal(getScoreAccent(75).tone, 'red');
  assert.equal(getScoreAccent(95, true).tone, 'cyan');
  assert.equal(getScoreAccent(65, true).tone, 'amber');
  assert.equal(getScoreAccent(30, true).tone, 'red');
});
