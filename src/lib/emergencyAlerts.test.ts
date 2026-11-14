import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEmergencyAlertContent,
  isEmergencyTriggerClassification,
} from './emergencyAlerts';
import { HABITAT_PROFILES, DEFAULT_TELEMETRY } from './constants';
import { calculateRiskAssessment } from './riskEngine';

test('isEmergencyTriggerClassification only triggers on critical or extreme_emergency', () => {
  assert.equal(isEmergencyTriggerClassification('normal'), false);
  assert.equal(isEmergencyTriggerClassification('caution'), false);
  assert.equal(isEmergencyTriggerClassification('high_risk'), false);
  assert.equal(isEmergencyTriggerClassification('critical'), true);
  assert.equal(isEmergencyTriggerClassification('extreme_emergency'), true);
});

test('buildEmergencyAlertContent formats notification and email payloads from critical assessment', () => {
  const habitat = HABITAT_PROFILES.iss;
  const emergencyTelemetry = {
    ...DEFAULT_TELEMETRY,
    fireDetected: true,
    smokeDetected: true,
    internalTemperatureC: 36.2,
    pressureKPa: 78.4,
  };
  const assessment = calculateRiskAssessment(emergencyTelemetry, habitat);
  const content = buildEmergencyAlertContent({
    habitat,
    assessment,
    telemetry: emergencyTelemetry,
    operatorName: 'Tanishk Sharma',
    triggeredAt: '2026-11-14T00:10:00.000Z',
  });

  assert.equal(isEmergencyTriggerClassification(content.classification), true);
  assert.match(content.notificationTitle, /EXTREME EMERGENCY|CRITICAL HAZARD/);
  assert.match(content.notificationBody, /78\.4 kPa/);
  assert.match(content.emailSubject, /Space Habitat Alert/);
  assert.match(content.emailBody, /ACTIVE FIRE/);
  assert.match(content.emailBody, /Tanishk Sharma/);
});
