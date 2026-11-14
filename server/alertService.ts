import crypto from 'crypto';
import { maskIdentifier, normalizeIdentifier, type OtpChannel, validateIdentifier } from './otpService.ts';

export interface EmergencyAlertDispatchRequest {
  target: string;
  channel: OtpChannel;
  operatorName?: string;
  habitatName: string;
  classification: string;
  riskScore: number;
  hazards: Array<{ name: string; severity: string; score: number }>;
  telemetrySummary: {
    oxygenPercent: number;
    carbonDioxidePpm: number;
    pressureKPa: number;
    internalTemperatureC: number;
    fireDetected?: boolean;
    smokeDetected?: boolean;
  };
  triggeredAt?: string;
}

export interface EmergencyAlertDispatchResult {
  alertId: string;
  channel: OtpChannel;
  maskedTarget: string;
  deliveryMode: 'webhook' | 'telemetry-dispatch';
  status: 'delivered' | 'dispatched-preview';
  timestamp: string;
  subject: string;
  messagePreview: string;
}

export class AlertServiceError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AlertServiceError';
    this.statusCode = statusCode;
  }
}

const dispatchHistory: EmergencyAlertDispatchResult[] = [];

export function formatEmergencyAlertText(req: EmergencyAlertDispatchRequest): {
  subject: string;
  body: string;
} {
  const tierLabel = req.classification.replace('_', ' ').toUpperCase();
  const timestamp = req.triggeredAt || new Date().toISOString();
  const subject = `[${tierLabel}] Space Habitat Alert — ${req.habitatName} (Risk ${Math.round(req.riskScore)}/100)`;

  const topHazards =
    Array.isArray(req.hazards) && req.hazards.length > 0
      ? req.hazards
          .slice(0, 4)
          .map((h, i) => {
            if (typeof h === 'string') return `${i + 1}. ${h}`;
            const name = h?.name || 'Environmental Anomaly';
            const severity = (h?.severity || 'critical').toUpperCase();
            const score = Number.isFinite(Number(h?.score)) ? Number(h.score) : 0;
            return `${i + 1}. ${name} (${severity} · ${score}/100)`;
          })
          .join('\n')
      : '1. Multiple threshold anomalies detected';

  const summary = (req.telemetrySummary || {}) as Record<string, any>;
  const o2 = Number(summary.oxygenPercent ?? summary.o2 ?? 0);
  const co2 = Number(summary.carbonDioxidePpm ?? summary.co2 ?? 0);
  const pressure = Number(summary.pressureKPa ?? summary.pressure ?? 0);
  const temp = Number(summary.internalTemperatureC ?? summary.temp ?? 0);

  const body = [
    `TEAM TEJASVI · EMERGENCY HABITAT ALERT`,
    `Level: ${tierLabel} (${Math.round(req.riskScore || 0)}/100 Risk)`,
    `Habitat: ${req.habitatName}`,
    `Operator: ${req.operatorName || 'Flight Crew Operator'}`,
    `Timestamp: ${timestamp}`,
    ``,
    `Telemetry Snapshot:`,
    `- O2: ${Number.isFinite(o2) ? o2.toFixed(1) : '0.0'}%`,
    `- CO2: ${Number.isFinite(co2) ? Math.round(co2) : 0} ppm`,
    `- Pressure: ${Number.isFinite(pressure) ? pressure.toFixed(1) : '0.0'} kPa`,
    `- Temp: ${Number.isFinite(temp) ? temp.toFixed(1) : '0.0'} °C`,
    `- Fire/Smoke: ${
      summary.fireDetected
        ? 'ACTIVE FIRE'
        : summary.smokeDetected
        ? 'SMOKE DETECTED'
        : 'CLEAR'
    }`,
    ``,
    `Active Hazards:`,
    topHazards,
    ``,
    `Immediate crew inspection and NASA emergency protocol execution recommended.`,
  ].join('\n');

  return { subject, body };
}

export async function dispatchEmergencyAlert(
  req: EmergencyAlertDispatchRequest
): Promise<EmergencyAlertDispatchResult> {
  const channel: OtpChannel = req.channel === 'phone' ? 'phone' : 'email';
  const validationError = validateIdentifier(req.target, channel);
  if (validationError) {
    throw new AlertServiceError(validationError, 400);
  }

  const normalizedTarget = normalizeIdentifier(req.target, channel);
  const maskedTarget = maskIdentifier(normalizedTarget, channel);
  const timestamp = req.triggeredAt || new Date().toISOString();
  const alertId = `alrt_${crypto.randomBytes(6).toString('hex')}`;
  const { subject, body } = formatEmergencyAlertText({
    ...req,
    triggeredAt: timestamp,
  });

  let deliveryMode: EmergencyAlertDispatchResult['deliveryMode'] = 'telemetry-dispatch';
  let status: EmergencyAlertDispatchResult['status'] = 'dispatched-preview';

  // Free custom webhook relay (works for email, Telegram, Discord, or custom relays)
  const webhookUrl = process.env.EMERGENCY_ALERT_WEBHOOK_URL || process.env.OTP_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'habitat_emergency_alert',
          team: 'Tejasvi',
          alertId,
          channel,
          target: normalizedTarget,
          subject,
          body,
          habitatName: req.habitatName,
          classification: req.classification,
          riskScore: req.riskScore,
          hazards: req.hazards,
          telemetrySummary: req.telemetrySummary,
          timestamp,
        }),
      });
      if (resp.ok) {
        deliveryMode = 'webhook';
        status = 'delivered';
      }
    } catch {
      deliveryMode = 'telemetry-dispatch';
    }
  }

  const record: EmergencyAlertDispatchResult = {
    alertId,
    channel,
    maskedTarget,
    deliveryMode,
    status,
    timestamp,
    subject,
    messagePreview: body,
  };

  dispatchHistory.unshift(record);
  if (dispatchHistory.length > 30) {
    dispatchHistory.pop();
  }

  return record;
}

export function getRecentAlertDispatches(): EmergencyAlertDispatchResult[] {
  return [...dispatchHistory];
}

export function resetAlertDispatchHistoryForTests(): void {
  dispatchHistory.length = 0;
}
