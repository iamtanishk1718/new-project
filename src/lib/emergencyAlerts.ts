import {
  EnvironmentalTelemetry,
  HabitatProfile,
  RiskAssessmentResult,
  RiskClassification,
} from '../types/habitat';

export type BrowserNotifPermissionState = NotificationPermission | 'unsupported';

export interface AlertDispatchLogEntry {
  id: string;
  timestamp: string;
  channel: 'browser' | 'gmail' | 'phone' | 'email';
  target: string;
  status: 'delivered' | 'dispatched-preview' | 'failed';
  deliveryMode: string;
  subject: string;
  detail: string;
}

export interface EmergencyAlertContent {
  classification: RiskClassification;
  tierLabel: string;
  riskScore: number;
  notificationTitle: string;
  notificationBody: string;
  emailSubject: string;
  emailBody: string;
  triggeredAt: string;
}

export function isEmergencyTriggerClassification(classification: RiskClassification): boolean {
  return classification === 'critical' || classification === 'extreme_emergency';
}

export function isNotificationApiSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): BrowserNotifPermissionState {
  if (!isNotificationApiSupported()) return 'unsupported';
  try {
    return window.Notification.permission;
  } catch {
    return 'unsupported';
  }
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotifPermissionState> {
  if (!isNotificationApiSupported()) return 'unsupported';
  try {
    if (window.Notification.permission === 'granted') return 'granted';
    return await window.Notification.requestPermission();
  } catch {
    return getBrowserNotificationPermission();
  }
}

export function buildEmergencyAlertContent(params: {
  habitat: HabitatProfile;
  assessment: RiskAssessmentResult;
  telemetry: EnvironmentalTelemetry;
  operatorName?: string;
  triggeredAt?: string;
}): EmergencyAlertContent {
  const { habitat, assessment, telemetry, operatorName } = params;
  const triggeredAt = params.triggeredAt || new Date().toISOString();
  const tierLabel =
    assessment.classification === 'extreme_emergency'
      ? 'EXTREME EMERGENCY'
      : assessment.classification === 'critical'
      ? 'CRITICAL HAZARD'
      : assessment.classification.replace('_', ' ').toUpperCase();

  const primaryHazard = assessment.hazards[0]?.name || 'Multiple habitat safety limits breached';
  const fireFlag = telemetry.fireDetected
    ? 'ACTIVE FIRE'
    : telemetry.smokeDetected
    ? 'SMOKE DETECTED'
    : 'Clear';

  const notificationTitle = `${tierLabel}: ${habitat.name} (${assessment.overallRiskScore}/100)`;
  const notificationBody = `${primaryHazard}. O2 ${telemetry.oxygenPercent.toFixed(
    1
  )}% · CO2 ${Math.round(telemetry.carbonDioxidePpm)} ppm · P ${telemetry.pressureKPa.toFixed(
    1
  )} kPa · Temp ${telemetry.internalTemperatureC.toFixed(1)}°C`;

  const emailSubject = `[${tierLabel}] Space Habitat Alert — ${habitat.name} (Risk ${assessment.overallRiskScore}/100)`;

  const hazardsList =
    assessment.hazards.length > 0
      ? assessment.hazards
          .slice(0, 5)
          .map((h, i) => `${i + 1}. ${h.name} [${h.severity.toUpperCase()} · Score ${h.score}/100]`)
          .join('\n')
      : '1. Life-support parameters exceeded critical safety limits';

  const emailBody = [
    `TEAM TEJASVI · EMERGENCY HABITAT ALERT`,
    `==================================================`,
    `Severity: ${tierLabel} (Overall Risk Score: ${assessment.overallRiskScore}/100)`,
    `Habitat: ${habitat.name} (${habitat.type.toUpperCase()})`,
    `Operator: ${operatorName || 'Flight Crew Operator'}`,
    `Timestamp: ${triggeredAt}`,
    ``,
    `LIVE ENVIRONMENTAL TELEMETRY:`,
    `- Oxygen (O2): ${telemetry.oxygenPercent.toFixed(1)}%`,
    `- Carbon Dioxide (CO2): ${Math.round(telemetry.carbonDioxidePpm)} ppm`,
    `- Cabin Pressure: ${telemetry.pressureKPa.toFixed(1)} kPa`,
    `- Internal Temperature: ${telemetry.internalTemperatureC.toFixed(1)} °C`,
    `- Radiation Dose Rate: ${telemetry.radiationDoseRateUSvH.toFixed(1)} µSv/h`,
    `- Fire / Smoke Sensors: ${fireFlag}`,
    ``,
    `DETECTED HAZARDS:`,
    hazardsList,
    ``,
    `ACTION REQUIRED: Open Team Tejasvi Flight Control Emergency Console and execute NASA emergency isolation & life-support procedures immediately.`,
  ].join('\n');

  return {
    classification: assessment.classification,
    tierLabel,
    riskScore: assessment.overallRiskScore,
    notificationTitle,
    notificationBody,
    emailSubject,
    emailBody,
    triggeredAt,
  };
}

export function fireBrowserEmergencyNotification(params: {
  title: string;
  body: string;
  tag: string;
  onClick?: () => void;
}): boolean {
  if (!isNotificationApiSupported() || window.Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notification = new window.Notification(params.title, {
      body: params.body,
      tag: params.tag,
      icon: '/assets/aistudio/ss_7087d4c4.jpg',
      badge: '/assets/aistudio/ss_7087d4c4.jpg',
      requireInteraction: true,
    });

    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // Ignore window focus restrictions
      }
      params.onClick?.();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export async function dispatchServerEmergencyAlert(params: {
  target: string;
  channel: 'email' | 'phone';
  operatorName?: string;
  habitat: HabitatProfile;
  assessment: RiskAssessmentResult;
  telemetry: EnvironmentalTelemetry;
  triggeredAt: string;
}): Promise<{
  alertId: string;
  channel: 'email' | 'phone';
  maskedTarget: string;
  deliveryMode: 'webhook' | 'telemetry-dispatch';
  status: 'delivered' | 'dispatched-preview';
  timestamp: string;
  subject: string;
}> {
  const resp = await fetch('/api/alerts/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: params.target,
      channel: params.channel,
      operatorName: params.operatorName,
      habitatName: params.habitat.name,
      classification: params.assessment.classification,
      riskScore: params.assessment.overallRiskScore,
      hazards: params.assessment.hazards.map((h) => ({
        name: h.name,
        severity: h.severity,
        score: h.score,
      })),
      telemetrySummary: {
        oxygenPercent: params.telemetry.oxygenPercent,
        carbonDioxidePpm: params.telemetry.carbonDioxidePpm,
        pressureKPa: params.telemetry.pressureKPa,
        internalTemperatureC: params.telemetry.internalTemperatureC,
        fireDetected: params.telemetry.fireDetected,
        smokeDetected: params.telemetry.smokeDetected,
      },
      triggeredAt: params.triggeredAt,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error || 'Emergency alert dispatch failed.');
  }
  return data;
}
