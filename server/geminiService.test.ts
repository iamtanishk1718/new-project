import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeHabitatInspectionImage,
  classifyGeminiError,
  generateSafetyRecommendations,
  getAiProviderStatus,
  runChatConversation,
} from './geminiService.ts';
import {
  analyzeHabitatImageFreeAi,
  generateFreeAiRecommendations,
  runFreeAiChat,
} from './freeAiService.ts';
import { DEFAULT_TELEMETRY, HABITAT_PROFILES } from '../src/lib/constants.ts';
import { calculateRiskAssessment } from '../src/lib/riskEngine.ts';

test('classifyGeminiError detects 403 PERMISSION_DENIED free tier unavailability cleanly', () => {
  const err = new Error(
    'ApiError: {"error":{"code":403,"message":"The Gemini API free tier is not available for this project. To use the Gemini API, please set up billing to upgrade to the paid tier.","status":"PERMISSION_DENIED"}}'
  );
  const res = classifyGeminiError(err);
  assert.equal(res.statusCode, 403);
  assert.equal(res.isNotFreeOrUnavailable, true);
  assert.match(res.reason, /Free Space AI API/);
});

test('classifyGeminiError detects 400 API_KEY_INVALID and 429 RESOURCE_EXHAUSTED cleanly', () => {
  const invalid = classifyGeminiError(new Error('API_KEY_INVALID: API key not valid'));
  assert.equal(invalid.statusCode, 400);
  assert.equal(invalid.isNotFreeOrUnavailable, true);

  const quota = classifyGeminiError(new Error('RESOURCE_EXHAUSTED: 429 quota exceeded'));
  assert.equal(quota.statusCode, 429);
  assert.equal(quota.isNotFreeOrUnavailable, false);
});

test('generateFreeAiRecommendations returns structured NASA-STD-3001 advice for nominal and hazard states', () => {
  const iss = HABITAT_PROFILES.iss;
  const nominalAssessment = calculateRiskAssessment(DEFAULT_TELEMETRY, iss);
  const nominalRes = generateFreeAiRecommendations(DEFAULT_TELEMETRY, iss, nominalAssessment);
  assert.equal(nominalRes.source, 'free-ai-api');
  assert.equal(nominalRes.modelUsed, 'free-space-ai-v1');
  assert.ok(nominalRes.recommendations.length >= 2);
  assert.ok(nominalRes.recommendations[0].correctiveActions.length > 0);

  const hazardTelem = { ...DEFAULT_TELEMETRY, carbonDioxidePpm: 6200, oxygenPercent: 17.2 };
  const hazardAssessment = calculateRiskAssessment(hazardTelem, iss);
  const hazardRes = generateFreeAiRecommendations(hazardTelem, iss, hazardAssessment);
  assert.equal(hazardRes.source, 'free-ai-api');
  assert.ok(hazardRes.recommendations.length >= 1);
  assert.ok(hazardRes.recommendations.some((r) => r.priority === 'CRITICAL' || r.priority === 'HIGH'));
});

test('runFreeAiChat and analyzeHabitatImageFreeAi answer telemetry-grounded diagnostics cleanly', () => {
  const iss = HABITAT_PROFILES.iss;
  const hazardTelem = { ...DEFAULT_TELEMETRY, carbonDioxidePpm: 5800, pressureKPa: 94.5 };
  const assessment = calculateRiskAssessment(hazardTelem, iss);

  const chatCo2 = runFreeAiChat(
    [{ role: 'user', text: 'Analyze CO2 and hypercapnia risk' }],
    { habitat: iss, telemetry: hazardTelem, assessment }
  );
  assert.equal(chatCo2.source, 'free-ai-api');
  assert.equal(chatCo2.modelUsed, 'free-space-ai-v1');
  assert.match(chatCo2.text, /5800 ppm/);

  const visionRes = analyzeHabitatImageFreeAi(
    'AQIDBA==',
    'image/png',
    'Inspect bulkhead seal',
    hazardTelem
  );
  assert.equal(visionRes.source, 'free-ai-api');
  assert.match(visionRes.analysis, /94\.5 kPa/);
});

test('AI router selects free-ai-api cleanly when Gemini API key is absent or free-space-ai is selected', async () => {
  const prevKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const status = getAiProviderStatus();
    assert.equal(status.paidModelsRemoved, true);
    assert.equal(status.geminiFreeAvailable, false);
    assert.equal(status.activeProvider, 'free-ai-api');

    const iss = HABITAT_PROFILES.iss;
    const assessment = calculateRiskAssessment(DEFAULT_TELEMETRY, iss);

    const recResult = await generateSafetyRecommendations(DEFAULT_TELEMETRY, iss, assessment, 'gemini-4-hydrogen');
    assert.equal(recResult.source, 'free-ai-api');
    assert.equal(recResult.modelUsed, 'free-space-ai-v1');
    assert.ok(recResult.recommendations.length >= 2);

    const chatResult = await runChatConversation(
      [{ role: 'user', text: 'Why is risk score at this level?' }],
      { habitat: iss, telemetry: DEFAULT_TELEMETRY, assessment },
      'gemini-3.1-flash-lite'
    );
    assert.equal(chatResult.source, 'free-ai-api');
    assert.match(chatResult.text, /Calculated Overall Risk/);

    const visionResult = await analyzeHabitatInspectionImage('AQID', 'image/jpeg', 'Check ducting', DEFAULT_TELEMETRY);
    assert.equal(visionResult.source, 'free-ai-api');
    assert.match(visionResult.analysis, /Free Space AI Hardware Inspection Report/);
  } finally {
    if (prevKey !== undefined) {
      process.env.GEMINI_API_KEY = prevKey;
    }
  }
});
