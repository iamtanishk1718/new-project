/**
 * Free Space Safety AI API Service (Zero-cost, zero-billing local + open inference)
 * Activated automatically if and only if the Gemini API free tier is unavailable on the project.
 */

import type {
  AIRecommendation,
  EnvironmentalTelemetry,
  HabitatProfile,
  RiskAssessmentResult,
} from '../src/types/habitat.ts';
import { getTelemetryMetricAccent } from '../src/lib/telemetryAccent.ts';

export interface FreeAiChatResponse {
  text: string;
  source: 'free-ai-api';
  modelUsed: 'free-space-ai-v1';
  notice: string;
}

export interface FreeAiRecommendationsResponse {
  recommendations: AIRecommendation[];
  source: 'free-ai-api';
  modelUsed: 'free-space-ai-v1';
  notice: string;
}

const FREE_AI_NOTICE =
  'Free Space AI API active (Gemini free tier unavailable on current project; zero paid APIs used).';

/**
 * Generates prioritized, telemetry-grounded safety recommendations using NASA-STD-3001
 * and NASA HIDH engineering models with zero paid external API calls.
 */
export function generateFreeAiRecommendations(
  telemetry: EnvironmentalTelemetry,
  habitat: HabitatProfile,
  assessment: RiskAssessmentResult
): FreeAiRecommendationsResponse {
  const recommendations: AIRecommendation[] = [];

  // 1. Direct active compound hazards
  assessment.hazards.forEach((h, idx) => {
    recommendations.push({
      id: `free-ai-hazard-${idx}-${h.id}`,
      problem: h.name,
      whyDangerous: h.potentialConsequences.join('; '),
      correctiveActions: h.recommendedActions,
      expectedBenefit: `Mitigates ${h.category} risk (currently ${h.score}/100) and restores ${habitat.name} toward nominal flight bounds.`,
      priority:
        h.severity === 'extreme' || h.severity === 'critical'
          ? 'CRITICAL'
          : h.severity === 'high'
          ? 'HIGH'
          : 'MEDIUM',
      urgency:
        h.severity === 'extreme'
          ? 'IMMEDIATE'
          : h.severity === 'critical'
          ? 'IMMEDIATE'
          : 'WITHIN_1_HOUR',
      monitoredParameters: h.affectedParameters,
      rationale: 'NASA-STD-3001 Vol. 2 Human Integration Design Handbook (Free Space AI API)',
    });
  });

  // 2. Proactive recommendations for parameters approaching habitat limits (amber/red proximity)
  const trackedKeys = [
    'oxygenPercent',
    'carbonDioxidePpm',
    'pressureKPa',
    'internalTemperatureC',
    'airflowVelocity',
    'radiationDoseRateUSvH',
    'relativeHumidity',
  ] as const;

  const approachingParams = trackedKeys.filter((key) => {
    const accent = getTelemetryMetricAccent(telemetry, habitat, key);
    const evalItem = assessment.parameterEvaluations[key];
    return accent.tone !== 'cyan' && evalItem?.tier === 'normal';
  });

  if (approachingParams.length > 0) {
    recommendations.push({
      id: `free-ai-approach-${Date.now()}`,
      problem: `Early Boundary Drift Detected (${approachingParams.join(', ')})`,
      whyDangerous:
        'Metrics are currently inside normal limits but approaching upper or lower threshold boundaries, narrowing ECLSS recovery margin.',
      correctiveActions: approachingParams.map((key) => {
        const spec = habitat.thresholds[key];
        const val = telemetry[key];
        return `Trim ${spec.label} (currently ${val} ${spec.unit}) back toward center of ${spec.tiers.normal.lower}–${spec.tiers.normal.upper} ${spec.unit} band.`;
      }),
      expectedBenefit: 'Prevents Caution-tier escalation and stabilizes automated life-support control loops.',
      priority: 'MEDIUM',
      urgency: 'WITHIN_1_HOUR',
      monitoredParameters: [...approachingParams],
      rationale: 'Proactive Envelope Margin Protection Protocol (NASA ECLSS)',
    });
  }

  // 3. Auxiliary subsystem checks (power, water, O2 reserve, combustible gas)
  if (
    telemetry.powerSupplyPercent < 75 ||
    telemetry.batteryBackupPercent < 75 ||
    telemetry.waterAvailabilityPercent < 75 ||
    telemetry.oxygenReserveHours < 72
  ) {
    recommendations.push({
      id: 'free-ai-resources',
      problem: 'Habitat Reserve & Resource Bus Margin Check',
      whyDangerous:
        'Reduced electrical bus, battery, potable water, or O2 reserve capacity reduces fault tolerance during contingencies.',
      correctiveActions: [
        `Power Bus ${telemetry.powerSupplyPercent.toFixed(0)}% / Battery ${telemetry.batteryBackupPercent.toFixed(0)}%: Shed non-essential payload heaters if bus < 70%.`,
        `O2 Reserve ${telemetry.oxygenReserveHours} hrs (OGS: ${telemetry.oxygenGenStatus}): Confirm Sabatier/electrolysis feedwater balance.`,
        `Water Availability ${telemetry.waterAvailabilityPercent.toFixed(1)}% (Recycling ${telemetry.waterRecyclingEfficiency}%): Verify WRS catalytic reactor pressure.`,
      ],
      expectedBenefit: 'Extends autonomous crew endurance and protects critical ECLSS loads.',
      priority: telemetry.powerSupplyPercent < 50 || telemetry.oxygenReserveHours < 24 ? 'HIGH' : 'MEDIUM',
      urgency: telemetry.powerSupplyPercent < 50 ? 'IMMEDIATE' : 'WITHIN_4_HOURS',
      monitoredParameters: ['powerSupplyPercent', 'batteryBackupPercent', 'oxygenReserveHours', 'waterAvailabilityPercent'],
      rationale: 'NASA Constellation / Artemis Consumables Reserve Standard',
    });
  }

  // 4. Baseline preventive checklist if everything is nominal
  if (recommendations.length === 0) {
    recommendations.push(
      {
        id: 'free-ai-baseline-eclss',
        problem: `Routine ECLSS Preventive Verification — ${habitat.name}`,
        whyDangerous:
          'Closed-loop atmospheric buffers gradually drift under metabolic load and trace contaminant buildup if preventive checks lapse.',
        correctiveActions: [
          `Confirm O2 concentration (${telemetry.oxygenPercent.toFixed(1)}%) remains centered within ${habitat.limits.o2MinPercent}–${habitat.limits.o2MaxPercent}%.`,
          `Verify CDRA bed switching keeps CO2 (${telemetry.carbonDioxidePpm} ppm) well below ${habitat.limits.co2MaxPpm} ppm.`,
          `Maintain IMV inter-module ventilation airflow (${telemetry.airflowVelocity.toFixed(2)} m/s) above ${habitat.limits.airflowMinMs} m/s to prevent microgravity gas pocketing.`,
        ],
        expectedBenefit: 'Preserves long-duration atmospheric margin and sustains Health Score > 85/100.',
        priority: 'LOW',
        urgency: 'ROUTINE',
        monitoredParameters: ['oxygenPercent', 'carbonDioxidePpm', 'airflowVelocity'],
        rationale: 'NASA-STD-3001 Vol. 2 Atmosphere & Ventilation Standards',
      },
      {
        id: 'free-ai-baseline-fire-rad',
        problem: 'Microgravity Fire & Radiation Margin Readiness',
        whyDangerous:
          'Low-buoyancy spherical diffusion flames and solar proton transients require pre-verified suppression and storm-shelter protocols.',
        correctiveActions: [
          `Verify fine water-mist / CO2 portable extinguishers near avionics racks (Combustible gas: ${telemetry.combustibleGasPpm.toFixed(1)} ppm).`,
          `Audit ionizing dose rate (${telemetry.radiationDoseRateUSvH.toFixed(1)} µSv/h; cumulative ${telemetry.accumulatedDoseMSv.toFixed(1)} mSv) against shielding readiness (${telemetry.shieldingEffectivenessPercent}%).`,
        ],
        expectedBenefit: 'Maintains rapid fire-suppression and radiation shielding response capability.',
        priority: 'LOW',
        urgency: 'ROUTINE',
        monitoredParameters: ['combustibleGasPpm', 'radiationDoseRateUSvH', 'pressureKPa'],
        rationale: 'NASA HIDH Fire Prevention & Space Radiation Guidelines',
      },
      {
        id: 'free-ai-baseline-thermal',
        problem: 'Thermal Control & Humidity Balance Audit',
        whyDangerous:
          'Condensation in cool avionics corners or thermal excursions can induce corrosion and microbial growth.',
        correctiveActions: [
          `Confirm cabin temperature (${telemetry.internalTemperatureC.toFixed(1)}°C) remains centered in ${habitat.limits.tempMinC}–${habitat.limits.tempMaxC}°C comfort range.`,
          `Verify relative humidity (${telemetry.relativeHumidity.toFixed(0)}%) stays within ${habitat.limits.humidityMinPercent}–${habitat.limits.humidityMaxPercent}% via condensing heat exchanger.`,
        ],
        expectedBenefit: 'Protects crew comfort and avionics condensation margins across orbital day/night cycles.',
        priority: 'LOW',
        urgency: 'ROUTINE',
        monitoredParameters: ['internalTemperatureC', 'relativeHumidity', 'coolingSystemStatus'],
        rationale: 'NASA ISS Active Thermal Control System (ATCS) Guidelines',
      }
    );
  }

  return {
    recommendations,
    source: 'free-ai-api',
    modelUsed: 'free-space-ai-v1',
    notice: FREE_AI_NOTICE,
  };
}

/**
 * Answers space safety, physiological, and telemetry questions using the local
 * Free Space AI API reasoning engine without requiring paid API keys.
 */
export function runFreeAiChat(
  messages: { role: 'user' | 'model'; text: string }[],
  habitatContext: {
    habitat: HabitatProfile;
    telemetry: EnvironmentalTelemetry;
    assessment: RiskAssessmentResult;
  }
): FreeAiChatResponse {
  const { habitat, telemetry, assessment } = habitatContext;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.text ?? '';
  const q = lastUserMsg.toLowerCase();

  const evalList = Object.values(assessment.parameterEvaluations).sort((a, b) => b.score - a.score);
  const topParam = evalList[0];
  const pO2Kpa = (telemetry.pressureKPa * (telemetry.oxygenPercent / 100)).toFixed(1);
  const header = `[${habitat.name} | Risk ${assessment.overallRiskScore}/100 (${assessment.classification.toUpperCase()}) | Health ${assessment.overallHealthScore}/100]`;

  let body: string;

  if (q.includes('dangerous') || q.includes('most') || q.includes('worst')) {
    const hazardLine =
      assessment.hazards.length > 0
        ? `Primary Active Hazard: ${assessment.hazards[0].name} (Severity: ${assessment.hazards[0].severity.toUpperCase()}, Score: ${assessment.hazards[0].score}/100).`
        : 'No active compound emergencies; evaluating highest proximity parameter.';
    const topLine = topParam
      ? `Highest-stress telemetry parameter: ${topParam.label} at ${topParam.value} ${topParam.unit} (Tier: ${topParam.tier.toUpperCase()}, Normal band: ${topParam.normalBounds.lower}–${topParam.normalBounds.upper} ${topParam.unit}).`
      : '';
    body = `${hazardLine}\n${topLine}\nRecommended First Action: ${assessment.hazards[0]?.recommendedActions[0] || 'Continue nominal ECLSS monitoring and verify sensor calibration.'}`;
  } else if (q.includes('why') && q.includes('risk')) {
    const activeCats = Object.entries(assessment.categoryScores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}/100`)
      .join(', ');
    body = `Calculated Overall Risk is ${assessment.overallRiskScore}/100 (${assessment.classification.toUpperCase()}) with ${assessment.activeWarningsCount} active warnings and ${assessment.criticalHazardsCount} critical hazards.\nTop contributing risk domains: ${activeCats}.\n${
      assessment.hazards.length > 0
        ? `Triggered Compound Hazards: ${assessment.hazards.map((h) => `${h.name} (${h.score}/100)`).join('; ')}.`
        : 'All 7 monitored threshold parameters sit within nominal safety bounds, keeping baseline risk minimal.'
    }`;
  } else if (q.includes('co2') || q.includes('hypercapnia') || q.includes('scrubber')) {
    body = `Carbon Dioxide is currently ${telemetry.carbonDioxidePpm} ppm (Normal upper: ${habitat.thresholds.carbonDioxidePpm.tiers.normal.upper} ppm; Max limit: ${habitat.limits.co2MaxPpm} ppm; CDRA scrubber: ${telemetry.co2ScrubberStatus.toUpperCase()}).\nHypercapnia Risk: ${assessment.bioscienceImpacts.hypercapniaRisk.toUpperCase()}.\nPhysiological Impact: Above ~3,800 ppm, elevated arterial PaCO2 induces respiratory acidosis compensation, cerebral vasodilation (headache), and impaired executive decision-making. Above 8,000 ppm, CO2 narcosis and severe dyspnea rapidly develop.`;
  } else if (q.includes('pressure') || q.includes('oxygen') || q.includes('hypoxia') || q.includes('o2')) {
    body = `Cabin Pressure is ${telemetry.pressureKPa.toFixed(1)} kPa with ${telemetry.oxygenPercent.toFixed(1)}% O2 (ambient oxygen partial pressure pO2 = ${pO2Kpa} kPa vs ~21.3 kPa sea-level normoxic).\nHypoxia Risk: ${assessment.bioscienceImpacts.hypoxiaRisk.toUpperCase()}.\nPhysiological Coupling: Alveolar gas equation PAO2 = FiO2·(P_atm - P_H2O) - PaCO2/R shows that decompression drops PAO2 even if O2% stays constant; conversely, O2% > ${habitat.limits.o2MaxPercent}% sharply increases material flammability in low-gravity spacecraft hardware.`;
  } else if (q.includes('eclss') || q.includes('valve') || q.includes('inspect') || q.includes('fix')) {
    body = `Prioritized ECLSS Inspection Checklist for ${habitat.name}:\n1. CDRA CO2 Scrubber (${telemetry.co2ScrubberStatus}): Inspect desiccant/zeolite bed selector valves and ΔP sensors.\n2. OGS Oxygen Generation (${telemetry.oxygenGenStatus}, ${telemetry.oxygenReserveHours} hrs reserve): Verify electrolysis stack current & H2 dome pressure.\n3. IMV Ventilation Fans (${telemetry.airflowVelocity.toFixed(2)} m/s, ${telemetry.ventilationRatePercent}% vent rate): Clear HEPA intake screens to prevent localized CO2 pockets.\n4. Thermal Coolant Loop (${telemetry.coolingSystemStatus}) & WRS Water Recovery (${telemetry.waterRecyclingEfficiency}% efficiency).`;
  } else if (q.includes('compare') || q.includes('baseline') || q.includes('nominal')) {
    const lines = evalList.map(
      (ev) =>
        `• ${ev.label}: ${ev.value} ${ev.unit} [Normal: ${ev.normalBounds.lower}–${ev.normalBounds.upper} ${ev.unit}] -> ${ev.tier.toUpperCase()}`
    );
    body = `Live Telemetry vs ${habitat.name} Baseline:\n${lines.join('\n')}`;
  } else if (q.includes('fire') || q.includes('smoke') || q.includes('flame')) {
    body = `Fire & Combustion Telemetry: Smoke=${telemetry.smokeDetected ? 'DETECTED' : 'CLEAR'}, Fire=${telemetry.fireDetected ? 'ACTIVE' : 'CLEAR'}, Combustible Gas=${telemetry.combustibleGasPpm.toFixed(1)} ppm, O2=${telemetry.oxygenPercent.toFixed(1)}%, Airflow=${telemetry.airflowVelocity.toFixed(2)} m/s.\nIn microgravity, absence of buoyant convection produces near-spherical blue diffusion flames that linger in stagnant wakes; if ignited, cut rack power and isolate IMV ventilation immediately.`;
  } else if (q.includes('radiation') || q.includes('solar') || q.includes('dose')) {
    body = `Radiation Telemetry: Dose Rate ${telemetry.radiationDoseRateUSvH.toFixed(1)} µSv/h (Limit: ${habitat.limits.radiationMaxUSvH} µSv/h), Cumulative Mission Dose ${telemetry.accumulatedDoseMSv.toFixed(1)} mSv, Hull Shielding ${telemetry.shieldingEffectivenessPercent}%.\nCellular Tier: ${assessment.bioscienceImpacts.radiationRiskDoseTier.toUpperCase()}. Active Pathways: ${assessment.bioscienceImpacts.cellularPathwayAffected.join('; ')}.`;
  } else {
    body = `Live Telemetry Summary: O2 ${telemetry.oxygenPercent.toFixed(1)}%, CO2 ${telemetry.carbonDioxidePpm} ppm, Pressure ${telemetry.pressureKPa.toFixed(1)} kPa (pO2 ${pO2Kpa} kPa), Temp ${telemetry.internalTemperatureC.toFixed(1)}°C, Humidity ${telemetry.relativeHumidity.toFixed(0)}%, Airflow ${telemetry.airflowVelocity.toFixed(2)} m/s, Radiation ${telemetry.radiationDoseRateUSvH.toFixed(1)} µSv/h.\nActive Hazards: ${assessment.hazards.map((h) => h.name).join(', ') || 'None detected (All systems nominal)'}.\nAsk about risk score breakdown, CO2 hypercapnia, pressure/O2 hypoxia, fire safety, radiation, or ECLSS inspections for targeted diagnostics.`;
  }

  return {
    text: `${header}\n${body}`,
    source: 'free-ai-api',
    modelUsed: 'free-space-ai-v1',
    notice: FREE_AI_NOTICE,
  };
}

/**
 * Provides a structured, telemetry-correlated hardware & ECLSS inspection guide
 * when image analysis is requested while Gemini free tier is unavailable.
 */
export function analyzeHabitatImageFreeAi(
  base64Data: string,
  mimeType: string,
  prompt: string,
  telemetryContext?: Partial<EnvironmentalTelemetry>
): { analysis: string; source: 'free-ai-api'; modelUsed: 'free-space-ai-v1'; notice: string } {
  const approxKb = Math.max(1, Math.round((base64Data.length * 3) / 4 / 1024));
  const pKpa = telemetryContext?.pressureKPa;
  const tempC = telemetryContext?.internalTemperatureC;
  const smoke = telemetryContext?.smokeDetected;

  const telemetryFlags: string[] = [];
  if (typeof pKpa === 'number' && pKpa < 97) {
    telemetryFlags.push(`Cabin pressure (${pKpa.toFixed(1)} kPa) indicates potential seal/hatch leak — prioritize O-ring extrusion & acoustic leak inspection.`);
  }
  if (typeof tempC === 'number' && tempC > 26.5) {
    telemetryFlags.push(`Elevated cabin temp (${tempC.toFixed(1)}°C) — inspect coolant loop fittings and avionics heat sinks for discoloration.`);
  }
  if (smoke) {
    telemetryFlags.push('Smoke detector active — check wire harnesses for charred Kapton insulation or pyrolysis residue.');
  }
  if (telemetryFlags.length === 0) {
    telemetryFlags.push('Ambient pressure, thermal, and smoke sensors show no correlated emergency signature.');
  }

  const analysis = [
    `[Free Space AI Hardware Inspection Report]`,
    `Payload Received: ${mimeType} (~${approxKb} KB) | Request: "${prompt}"`,
    ``,
    `1. Telemetry-Correlated Anomaly Screening:`,
    ...telemetryFlags.map((f) => `   - ${f}`),
    ``,
    `2. Structural & ECLSS Visual Inspection Checklist (NASA Spaceflight Procedures):`,
    `   - Hatch & Pressure Seals: Check elastomeric O-rings for debris, nicking, or compression set.`,
    `   - Ducting & IMV Fans: Verify unobstructed HEPA screen intake and zero condensation pooling.`,
    `   - Avionics & Power Harnesses: Inspect connectors for scorch marks, arcing pitting, or loosened Strain Reliefs.`,
    `   - Coolant Loops: Check quick-disconnect couplings for glycol/water crystal residue.`,
    ``,
    `Note: Automated pixel-level cloud vision is offline because Gemini free tier is disabled on this project; this report correlates your inspection request with live ECLSS telemetry using the zero-cost Free Space AI API.`,
  ].join('\n');

  return {
    analysis,
    source: 'free-ai-api',
    modelUsed: 'free-space-ai-v1',
    notice: FREE_AI_NOTICE,
  };
}
