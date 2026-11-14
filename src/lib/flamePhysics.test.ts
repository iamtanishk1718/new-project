import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeFlameConditions,
  DEFAULT_FLAME_TEST_CONFIG,
  generateFlameSensitivityCurve,
} from './flamePhysics';

test('microgravity flame is near-spherical with high blue chemiluminescence compared to 1g buoyant flame', () => {
  const zeroG = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    ignited: true,
    gravityG: 0.0,
    airflowMs: 0.04,
    oxygenPercent: 21,
    pressureKPa: 101.3,
  });
  const earthG = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    ignited: true,
    gravityG: 1.0,
    airflowMs: 0.04,
    oxygenPercent: 21,
    pressureKPa: 101.3,
  });

  assert.equal(zeroG.isSustained, true);
  assert.equal(earthG.isSustained, true);
  assert.ok(zeroG.aspectRatio < 1.35, `Expected compact 0g aspect ratio, got ${zeroG.aspectRatio}`);
  assert.ok(earthG.aspectRatio > zeroG.aspectRatio * 1.8, '1g flame should be significantly taller');
  assert.ok(zeroG.blueFraction > earthG.blueFraction, '0g flame should have stronger blue reaction fraction');
  assert.ok(earthG.sootVolumePpm > zeroG.sootVolumePpm, '1g buoyant flame should produce more soot');
});

test('forced airflow tilts microgravity flame and causes blow-off extinction at excessive flow in low O2', () => {
  const gentleFlow = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    gravityG: 0.0,
    airflowMs: 0.25,
    oxygenPercent: 21,
  });
  assert.equal(gentleFlow.isSustained, true);
  assert.ok(gentleFlow.tiltAngleDeg > 20, `Expected flame tilt under forced airflow, got ${gentleFlow.tiltAngleDeg}`);

  const blowOff = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    gravityG: 0.0,
    airflowMs: 0.80,
    oxygenPercent: 18.0,
    pressureKPa: 85.0,
    fuelType: 'cellulose',
  });
  assert.equal(blowOff.isSustained, false);
  assert.ok(blowOff.extinctionReason && blowOff.extinctionReason.includes('Blow-Off'));
});

test('CO2 diluent suppresses combustion at 19.5% O2 where standard nitrogen sustains', () => {
  const air = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    oxygenPercent: 19.5,
    diluentGas: 'nitrogen',
  });
  const co2Mix = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    oxygenPercent: 19.5,
    diluentGas: 'co2_suppress',
  });

  assert.equal(air.isSustained, true);
  assert.equal(co2Mix.isSustained, false);
  assert.ok(co2Mix.extinctionReason?.includes('CO₂'));
});

test('hyperoxic oxygen and low-pressure limits behave monotonically', () => {
  const hyperoxic = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    oxygenPercent: 32,
    pressureKPa: 101.3,
  });
  const nominal = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    oxygenPercent: 21,
    pressureKPa: 101.3,
  });
  const vacuumQuench = analyzeFlameConditions({
    ...DEFAULT_FLAME_TEST_CONFIG,
    oxygenPercent: 21,
    pressureKPa: 25,
  });

  assert.ok(hyperoxic.spreadRateMmS > nominal.spreadRateMmS * 1.8);
  assert.ok(hyperoxic.peakTempC > nominal.peakTempC);
  assert.equal(vacuumQuench.isSustained, false);
  assert.ok(vacuumQuench.extinctionReason?.includes('Low-Pressure'));

  const curve = generateFlameSensitivityCurve(DEFAULT_FLAME_TEST_CONFIG, 'gravity');
  assert.equal(curve.length, 8);
});
