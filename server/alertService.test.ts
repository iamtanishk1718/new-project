import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AlertServiceError,
  dispatchEmergencyAlert,
  formatEmergencyAlertText,
  getRecentAlertDispatches,
  resetAlertDispatchHistoryForTests,
} from './alertService.ts';

test('formatEmergencyAlertText builds structured subject and telemetry summary', () => {
  const formatted = formatEmergencyAlertText({
    target: '+919876543210',
    channel: 'phone',
    operatorName: 'Tanishk Sharma',
    habitatName: 'ISS Destiny Lab',
    classification: 'extreme_emergency',
    riskScore: 92,
    hazards: [
      { name: 'Avionics Thermal Runaway', severity: 'extreme', score: 96 },
    ],
    telemetrySummary: {
      oxygenPercent: 18.2,
      carbonDioxidePpm: 6200,
      pressureKPa: 74.5,
      internalTemperatureC: 39.4,
      fireDetected: true,
    },
    triggeredAt: '2026-11-14T00:00:00.000Z',
  });

  assert.match(formatted.subject, /EXTREME EMERGENCY/);
  assert.match(formatted.subject, /ISS Destiny Lab/);
  assert.match(formatted.subject, /92\/100/);
  assert.match(formatted.body, /Tanishk Sharma/);
  assert.match(formatted.body, /ACTIVE FIRE/);
  assert.match(formatted.body, /Avionics Thermal Runaway/);
});

test('dispatchEmergencyAlert validates phone and email targets cleanly', async () => {
  resetAlertDispatchHistoryForTests();

  await assert.rejects(
    () =>
      dispatchEmergencyAlert({
        target: 'bad-phone',
        channel: 'phone',
        habitatName: 'ISS Destiny Lab',
        classification: 'critical',
        riskScore: 76,
        hazards: [],
        telemetrySummary: {
          oxygenPercent: 19.0,
          carbonDioxidePpm: 5200,
          pressureKPa: 82.0,
          internalTemperatureC: 28.0,
        },
      }),
    (err: unknown) => err instanceof AlertServiceError && err.statusCode === 400
  );

  const phoneResult = await dispatchEmergencyAlert({
    target: '+91 98765-43210',
    channel: 'phone',
    operatorName: 'Tanishk Sharma',
    habitatName: 'ISS Destiny Lab',
    classification: 'critical',
    riskScore: 78,
    hazards: [{ name: 'Cabin Depressurization', severity: 'critical', score: 85 }],
    telemetrySummary: {
      oxygenPercent: 18.8,
      carbonDioxidePpm: 4800,
      pressureKPa: 79.4,
      internalTemperatureC: 25.1,
    },
  });

  assert.equal(phoneResult.channel, 'phone');
  assert.equal(phoneResult.status, 'dispatched-preview');
  assert.match(phoneResult.maskedTarget, /\*+3210$/);
  assert.equal(getRecentAlertDispatches().length, 1);
});
