/**
 * Server-Side AI Routing Service (Free-Tier Gemini -> Free Space AI API Fallback)
 * - Strictly zero paid Gemini models (paid models such as gemini-4-argon / gemini-4-carbon removed).
 * - Uses free-tier Gemini models ('gemini-4-hydrogen', 'gemini-3.1-flash-lite') when available for free.
 * - If and only if Gemini free tier is unavailable on the project (403 PERMISSION_DENIED / billing required / no key),
 *   automatically routes all AI endpoints to the built-in zero-cost Free Space AI API (server/freeAiService.ts).
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { AIRecommendation, EnvironmentalTelemetry, HabitatProfile, RiskAssessmentResult } from '../src/types/habitat.ts';
import {
  analyzeHabitatImageFreeAi,
  generateFreeAiRecommendations,
  runFreeAiChat,
} from './freeAiService.ts';

let cachedAiClient: GoogleGenAI | null = null;
let cachedApiKey: string | undefined;
let cachedGeminiNotFree: { apiKey: string; reason: string } | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedAiClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    cachedGeminiNotFree = null;
    cachedAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 12000,
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return cachedAiClient;
}

export type FreeAiModelChoice = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite' | 'free-space-ai';

function normalizeModelChoice(raw?: string): FreeAiModelChoice {
  if (raw === 'gemini-3.1-flash-lite') return 'gemini-3.1-flash-lite';
  if (raw === 'free-space-ai' || raw === 'free-space-ai-v1') return 'free-space-ai';
  return 'gemini-4-hydrogen';
}

export interface ClassifiedGeminiError {
  statusCode: number;
  isNotFreeOrUnavailable: boolean;
  reason: string;
}

export function classifyGeminiError(error: unknown): ClassifiedGeminiError {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : JSON.stringify(error ?? '');
  const lower = raw.toLowerCase();
  const statusProp =
    (error as { status?: number; code?: number } | null)?.status ??
    (error as { status?: number; code?: number } | null)?.code;

  if (
    statusProp === 403 ||
    lower.includes('permission_denied') ||
    lower.includes('free tier is not available') ||
    lower.includes('"code":403') ||
    lower.includes('billing')
  ) {
    return {
      statusCode: 403,
      isNotFreeOrUnavailable: true,
      reason: 'Gemini free tier is not available on this project — switched to Free Space AI API.',
    };
  }

  if (
    statusProp === 400 ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('"code":400')
  ) {
    return {
      statusCode: 400,
      isNotFreeOrUnavailable: true,
      reason: 'Gemini API key unavailable for free inference — switched to Free Space AI API.',
    };
  }

  if (
    statusProp === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('"code":429') ||
    lower.includes('quota')
  ) {
    return {
      statusCode: 429,
      isNotFreeOrUnavailable: false,
      reason: 'Gemini free-tier rate limit reached — routed to Free Space AI API.',
    };
  }

  if (statusProp === 404 || lower.includes('not_found') || lower.includes('"code":404')) {
    return {
      statusCode: 404,
      isNotFreeOrUnavailable: false,
      reason: 'Gemini model endpoint unavailable — routed to Free Space AI API.',
    };
  }

  return {
    statusCode: 502,
    isNotFreeOrUnavailable: false,
    reason: 'Gemini network timeout/error — routed to Free Space AI API.',
  };
}

function recordGeminiOutcomeError(error: unknown): ClassifiedGeminiError {
  const classified = classifyGeminiError(error);
  const currentKey = process.env.GEMINI_API_KEY?.trim();
  if (classified.isNotFreeOrUnavailable && currentKey) {
    if (!cachedGeminiNotFree || cachedGeminiNotFree.apiKey !== currentKey) {
      console.info(`[AI Router] ${classified.reason}`);
    }
    cachedGeminiNotFree = {
      apiKey: currentKey,
      reason: classified.reason,
    };
  } else {
    console.info(`[AI Router] ${classified.reason}`);
  }
  return classified;
}

function isGeminiBlockedAsNotFree(): string | null {
  const currentKey = process.env.GEMINI_API_KEY?.trim();
  if (!currentKey) {
    return 'No Gemini API key configured — using Free Space AI API.';
  }
  if (cachedGeminiNotFree && cachedGeminiNotFree.apiKey === currentKey) {
    return cachedGeminiNotFree.reason;
  }
  return null;
}

export function getAiProviderStatus() {
  const notFreeReason = isGeminiBlockedAsNotFree();
  return {
    geminiFreeAvailable: !notFreeReason,
    activeProvider: notFreeReason ? 'free-ai-api' : 'gemini-free-tier',
    paidModelsRemoved: true,
    reason: notFreeReason || 'Gemini free tier active (gemini-4-hydrogen / gemini-3.1-flash-lite).',
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export interface RecommendationsGenerationResult {
  recommendations: AIRecommendation[];
  source: 'gemini-free-tier' | 'free-ai-api';
  modelUsed: string;
  notice?: string;
}

/**
 * Generate safety recommendations using free-tier Gemini if free,
 * otherwise automatically route to the built-in Free Space AI API.
 */
export async function generateSafetyRecommendations(
  telemetry: EnvironmentalTelemetry,
  habitat: HabitatProfile,
  assessment: RiskAssessmentResult,
  modelName: string = 'gemini-4-hydrogen'
): Promise<RecommendationsGenerationResult> {
  const selectedModel = normalizeModelChoice(modelName);
  const ai = getAiClient();
  const blockedReason = isGeminiBlockedAsNotFree();

  if (selectedModel === 'free-space-ai' || !ai || blockedReason) {
    return generateFreeAiRecommendations(telemetry, habitat, assessment);
  }

  const prompt = `You are the NASA Space Habitat Life Support Decision-Support System for Project FLAME IN FIREFALL.
Analyze the following telemetry and deterministic risk evaluation for habitat "${habitat.name}" (${habitat.type}):

HABITAT CONTEXT:
- Volume: ${habitat.volumeM3} m³
- Occupancy: ${habitat.activeOccupants} / ${habitat.maxOccupancy} max
- Life-Support Architecture: ${habitat.lifeSupportType}

CURRENT TELEMETRY:
- Oxygen: ${telemetry.oxygenPercent}% (Limits: ${habitat.limits.o2MinPercent}% - ${habitat.limits.o2MaxPercent}%)
- Carbon Dioxide: ${telemetry.carbonDioxidePpm} ppm (Max: ${habitat.limits.co2MaxPpm} ppm)
- Cabin Pressure: ${telemetry.pressureKPa} kPa (Limits: ${habitat.limits.pressureMinKPa} - ${habitat.limits.pressureMaxKPa} kPa)
- Temperature: ${telemetry.internalTemperatureC}°C (Limits: ${habitat.limits.tempMinC} - ${habitat.limits.tempMaxC}°C)
- Relative Humidity: ${telemetry.relativeHumidity}%
- Airflow Velocity: ${telemetry.airflowVelocity} m/s (Min: ${habitat.limits.airflowMinMs} m/s)
- Radiation Dose Rate: ${telemetry.radiationDoseRateUSvH} µSv/h (Max: ${habitat.limits.radiationMaxUSvH} µSv/h)
- Smoke / Fire Status: Smoke=${telemetry.smokeDetected}, Fire=${telemetry.fireDetected}
- CO2 Scrubber: ${telemetry.co2ScrubberStatus}
- Oxygen Reserve: ${telemetry.oxygenReserveHours} hours
- Power Supply: ${telemetry.powerSupplyPercent}%, Battery: ${telemetry.batteryBackupPercent}%

RISK ENGINE OUTPUT:
- Overall Health Score: ${assessment.overallHealthScore}/100
- Overall Risk Score: ${assessment.overallRiskScore}/100
- Risk Classification: ${assessment.classification.toUpperCase()}
- Active Warnings: ${assessment.activeWarningsCount}
- Critical Hazards: ${assessment.criticalHazardsCount}
- Detected Compound Hazards: ${JSON.stringify(assessment.hazards.map((h) => ({ name: h.name, severity: h.severity, score: h.score, affected: h.affectedParameters })))}

TASK:
Produce 3 to 5 prioritized, actionable, scientifically responsible safety recommendations.`;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        problem: { type: Type.STRING },
        whyDangerous: { type: Type.STRING },
        correctiveActions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        expectedBenefit: { type: Type.STRING },
        priority: {
          type: Type.STRING,
          enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
        },
        urgency: {
          type: Type.STRING,
          enum: ['IMMEDIATE', 'WITHIN_1_HOUR', 'WITHIN_4_HOURS', 'ROUTINE'],
        },
        monitoredParameters: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        rationale: { type: Type.STRING },
      },
      required: [
        'problem',
        'whyDangerous',
        'correctiveActions',
        'expectedBenefit',
        'priority',
        'urgency',
        'monitoredParameters',
        'rationale',
      ],
    },
  };

  const modelsToTry: ('gemini-4-hydrogen' | 'gemini-3.1-flash-lite')[] =
    selectedModel === 'gemini-3.1-flash-lite'
      ? ['gemini-3.1-flash-lite']
      : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

  for (const candidateModel of modelsToTry) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: candidateModel,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
        candidateModel === 'gemini-3.1-flash-lite' ? 8000 : 10000,
        `Gemini free recommendations (${candidateModel})`
      );
      const parsed: AIRecommendation[] = JSON.parse(response.text ?? '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          recommendations: parsed.map((item, idx) => ({
            ...item,
            id: item.id || `rec-${Date.now()}-${idx}`,
          })),
          source: 'gemini-free-tier',
          modelUsed: candidateModel,
        };
      }
    } catch (error) {
      const classified = recordGeminiOutcomeError(error);
      if (classified.isNotFreeOrUnavailable) {
        break;
      }
    }
  }

  return generateFreeAiRecommendations(telemetry, habitat, assessment);
}

/**
 * Conversational Space Safety Assistant: uses free-tier Gemini if free,
 * otherwise routes automatically to the Free Space AI API.
 */
export async function runChatConversation(
  messages: { role: 'user' | 'model'; text: string }[],
  habitatContext: {
    habitat: HabitatProfile;
    telemetry: EnvironmentalTelemetry;
    assessment: RiskAssessmentResult;
  },
  modelChoice: string = 'gemini-4-hydrogen',
  useSearchGrounding: boolean = false,
  useMapsGrounding: boolean = false
): Promise<{
  text: string;
  searchGroundingCitations?: any[];
  source: 'gemini-free-tier' | 'free-ai-api';
  modelUsed: string;
  notice?: string;
}> {
  const selectedModel = normalizeModelChoice(modelChoice);
  const ai = getAiClient();
  const blockedReason = isGeminiBlockedAsNotFree();

  if (selectedModel === 'free-space-ai' || !ai || blockedReason) {
    return runFreeAiChat(messages, habitatContext);
  }

  const systemInstruction = `You are FLAME IN FIREFALL, the NASA Space Apps Challenge AI Space Safety & Environmental Monitoring Specialist.
You have real-time telemetry access to the enclosed space environment:
- Habitat: ${habitatContext.habitat.name} (${habitatContext.habitat.type})
- Crew aboard: ${habitatContext.habitat.activeOccupants} / ${habitatContext.habitat.maxOccupancy}
- Health Score: ${habitatContext.assessment.overallHealthScore}/100 | Risk Score: ${habitatContext.assessment.overallRiskScore}/100 (${habitatContext.assessment.classification})
- Oxygen: ${habitatContext.telemetry.oxygenPercent}% | CO2: ${habitatContext.telemetry.carbonDioxidePpm} ppm | Pressure: ${habitatContext.telemetry.pressureKPa} kPa
- Temperature: ${habitatContext.telemetry.internalTemperatureC}°C | Airflow: ${habitatContext.telemetry.airflowVelocity} m/s | Radiation: ${habitatContext.telemetry.radiationDoseRateUSvH} µSv/h
- Active Hazards: ${habitatContext.assessment.hazards.map((h) => h.name).join(', ') || 'None detected'}

Answer the crew or flight controllers with empirical aerospace accuracy, referencing NASA standards (NASA-STD-3001, HIDH), human spaceflight physiology (alveolar oxygenation, hypoxia, hypercapnia), and specific ECLSS subsystems. Keep explanations concise, professional, and directly tied to the actual current telemetry readings.`;

  const config: any = {
    systemInstruction,
  };

  const tools: any[] = [];
  if (useSearchGrounding && selectedModel === 'gemini-4-hydrogen') {
    tools.push({ googleSearch: {} });
  }
  if (useMapsGrounding && selectedModel === 'gemini-4-hydrogen') {
    tools.push({ googleMaps: {} });
  }
  if (tools.length > 0) {
    config.tools = tools;
  }

  const contents = messages.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: selectedModel,
        contents,
        config,
      }),
      10000,
      `Gemini free chat (${selectedModel})`
    );

    if (response.text) {
      return {
        text: response.text,
        searchGroundingCitations: response.candidates?.[0]?.groundingMetadata?.groundingChunks || undefined,
        source: 'gemini-free-tier',
        modelUsed: selectedModel,
      };
    }
  } catch (primaryError) {
    const classified = recordGeminiOutcomeError(primaryError);
    if (!classified.isNotFreeOrUnavailable && selectedModel !== 'gemini-3.1-flash-lite') {
      try {
        const fallbackRes = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents,
            config: { systemInstruction },
          }),
          8000,
          'Gemini free chat fallback (gemini-3.1-flash-lite)'
        );
        if (fallbackRes.text) {
          return {
            text: fallbackRes.text,
            source: 'gemini-free-tier',
            modelUsed: 'gemini-3.1-flash-lite',
          };
        }
      } catch (secondaryError) {
        recordGeminiOutcomeError(secondaryError);
      }
    }
  }

  return runFreeAiChat(messages, habitatContext);
}

/**
 * Image / Vision Inspection: uses free-tier multimodal gemini-4-hydrogen if free,
 * otherwise routes automatically to Free Space AI hardware inspection fallback (zero paid models).
 */
export async function analyzeHabitatInspectionImage(
  base64Data: string,
  mimeType: string,
  prompt: string,
  telemetryContext?: Partial<EnvironmentalTelemetry>
): Promise<{
  analysis: string;
  source: 'gemini-free-tier' | 'free-ai-api';
  modelUsed: string;
  notice?: string;
}> {
  const ai = getAiClient();
  const blockedReason = isGeminiBlockedAsNotFree();

  if (!ai || blockedReason) {
    return analyzeHabitatImageFreeAi(base64Data, mimeType, prompt, telemetryContext);
  }

  const systemInstruction = `You are an aerospace habitat structural & ECLSS diagnostic specialist.
Examine this photograph / sensor scan uploaded by the space habitat crew.
Evaluate for:
1. Physical anomalies (delamination, micro-meteoroid impact pitting, seal extrusion, scorch marks, condensation pooling)
2. Life support / ducting / valve status
3. Fire / pyrolysis precursors
4. Immediate risk rating (Low, Medium, High, Critical)
5. Recommended inspection checklist and repair protocol per NASA Spaceflight Procedures.`;

  const imagePart = {
    inlineData: {
      mimeType,
      data: base64Data,
    },
  };

  const textPart = {
    text: `${prompt}\n\nCurrent Habitat Context: ${JSON.stringify(telemetryContext || {})}`,
  };

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts: [imagePart, textPart] },
        config: {
          systemInstruction,
        },
      }),
      15000,
      'Gemini free vision inspection (gemini-4-hydrogen)'
    );

    if (response.text) {
      return {
        analysis: response.text,
        source: 'gemini-free-tier',
        modelUsed: 'gemini-4-hydrogen',
      };
    }
  } catch (error) {
    recordGeminiOutcomeError(error);
  }

  return analyzeHabitatImageFreeAi(base64Data, mimeType, prompt, telemetryContext);
}
