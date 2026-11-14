import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVoiceWarningMessage, getAudioProfileForRisk } from './hazardAudio';
import { DEFAULT_TELEMETRY } from './constants';
import { DetectedHazard } from '../types/habitat';

const sampleHazard: DetectedHazard = {
  id: 'h-fire',
  name: 'PDU Avionics Electrical Fire',
  category: 'fire',
  severity: 'extreme',
  likelihood: 98,
  score: 95,
  affectedParameters: ['fireDetected', 'internalTemperatureC'],
  explanation: 'Combustion in avionics bay.',
  potentialConsequences: ['Toxic smoke'],
  recommendedActions: ['Cut power bus'],
};

test('getAudioProfileForRisk scales volume, interval, and flash rate monotonically with danger', () => {
  const normal = getAudioProfileForRisk('normal', 2);
  const caution = getAudioProfileForRisk('caution', 25);
  const high = getAudioProfileForRisk('high_risk', 50);
  const critical = getAudioProfileForRisk('critical', 75);
  const extreme = getAudioProfileForRisk('extreme_emergency', 95);

  assert.equal(normal.volume, 0);
  assert.equal(normal.flashRateHz, 0);

  assert.ok(caution.volume > normal.volume);
  assert.ok(high.volume > caution.volume);
  assert.ok(critical.volume > high.volume);
  assert.ok(extreme.volume > critical.volume);

  assert.ok(extreme.intervalMs < critical.intervalMs);
  assert.ok(critical.intervalMs < high.intervalMs);
  assert.ok(high.intervalMs < caution.intervalMs);

  assert.ok(extreme.flashRateHz > critical.flashRateHz);
  assert.ok(critical.flashRateHz > high.flashRateHz);
  assert.ok(high.flashRateHz > caution.flashRateHz);
});

test('buildVoiceWarningMessage produces hazard-specific callouts for fire and critical breaches', () => {
  const nominalMsg = buildVoiceWarningMessage('normal', [], DEFAULT_TELEMETRY);
  assert.match(nominalMsg, /nominal/i);

  const fireMsg = buildVoiceWarningMessage('extreme_emergency', [sampleHazard], {
    ...DEFAULT_TELEMETRY,
    fireDetected: true,
    internalTemperatureC: 44.2,
  });
  assert.match(fireMsg, /fire detected/i);
  assert.match(fireMsg, /44 degrees/i);

  const critMsg = buildVoiceWarningMessage(
    'critical',
    [{ ...sampleHazard, name: 'CO2 Scrubber Failure', severity: 'critical' }],
    DEFAULT_TELEMETRY
  );
  assert.match(critMsg, /Critical warning/i);
  assert.match(critMsg, /CO2 Scrubber Failure/i);
});
