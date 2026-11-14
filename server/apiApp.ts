import express from 'express';
import {
  generateSafetyRecommendations,
  getAiProviderStatus,
  runChatConversation,
  analyzeHabitatInspectionImage,
} from './geminiService.ts';
import {
  fetchNasaPowerData,
  fetchNasaSatelliteTime,
  fetchNasaSpaceWeatherAndEvents,
  getNasaSpaceBiologyDatasets,
} from './nasaService.ts';
import {
  type OtpChannel,
  OtpServiceError,
  issueDirectOperatorSession,
  requestOtpChallenge,
  revokeOtpSessionToken,
  verifyOtpChallenge,
  verifyOtpSessionToken,
} from './otpService.ts';
import {
  AlertServiceError,
  dispatchEmergencyAlert,
  getRecentAlertDispatches,
} from './alertService.ts';
import {
  IntegrationServiceError,
  deleteActorAutomationRule,
  disconnectActorIntegration,
  dispatchToIntegration,
  getActorHubSnapshot,
  recordClientWorkspaceLog,
  resolveAuthenticatedActor,
  saveAndConnectIntegration,
  testActorAutomationRule,
  testIntegrationConnection,
  updateActorAlertRouting,
  upsertActorAutomationRule,
} from './integrationsService.ts';

export const apiRouter = express.Router();

export const apiApp = express();
apiApp.use(express.json({ limit: '15mb' }));
apiApp.use('/api', apiRouter);

// 0. OTP Operator Authentication Endpoints
apiRouter.post('/auth/otp/request', async (req, res) => {
  try {
    const { identifier, channel, operatorName } = req.body ?? {};
    const resolvedChannel: OtpChannel = channel === 'phone' ? 'phone' : 'email';
    const result = await requestOtpChallenge(String(identifier ?? ''), resolvedChannel, operatorName);
    return res.json(result);
  } catch (error: unknown) {
    if (error instanceof OtpServiceError) {
      return res.status(error.statusCode).json({
        error: error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }
    return res.status(500).json({ error: 'Unable to dispatch OTP challenge.' });
  }
});

apiRouter.post('/auth/otp/verify', (req, res) => {
  try {
    const { identifier, channel, code, challengeToken } = req.body ?? {};
    const resolvedChannel: OtpChannel = channel === 'phone' ? 'phone' : 'email';
    const result = verifyOtpChallenge(
      String(identifier ?? ''),
      resolvedChannel,
      String(code ?? ''),
      typeof challengeToken === 'string' ? challengeToken : undefined
    );
    return res.json(result);
  } catch (error: unknown) {
    if (error instanceof OtpServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Unable to verify OTP code.' });
  }
});

apiRouter.get('/auth/session', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const user = verifyOtpSessionToken(token);
  if (!user) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true, user });
});

apiRouter.post('/auth/operator-session', (req, res) => {
  const operatorId = typeof req.body?.operatorId === 'string' ? req.body.operatorId : undefined;
  return res.json(issueDirectOperatorSession(operatorId));
});

apiRouter.post('/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  revokeOtpSessionToken(token);
  return res.json({ success: true });
});

// 0b. Emergency Alert Dispatch (Phone SMS / Webhook Relay)
apiRouter.post('/alerts/dispatch', async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!body.target || !body.habitatName || !body.telemetrySummary) {
      return res.status(400).json({ error: 'Missing alert target, habitatName, or telemetrySummary.' });
    }
    const result = await dispatchEmergencyAlert({
      target: String(body.target),
      channel: body.channel === 'phone' ? 'phone' : 'email',
      operatorName: typeof body.operatorName === 'string' ? body.operatorName : undefined,
      habitatName: String(body.habitatName),
      classification: String(body.classification || 'critical'),
      riskScore: Number(body.riskScore ?? 0),
      hazards: Array.isArray(body.hazards) ? body.hazards : [],
      telemetrySummary: body.telemetrySummary,
      triggeredAt: typeof body.triggeredAt === 'string' ? body.triggeredAt : undefined,
    });
    return res.json(result);
  } catch (error: unknown) {
    if (error instanceof AlertServiceError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Unable to dispatch emergency alert.' });
  }
});

apiRouter.get('/alerts/history', (_req, res) => {
  return res.json({ dispatches: getRecentAlertDispatches() });
});

// 0c. Enterprise Integration Hub Endpoints (Authenticated + Encrypted Vault)
function handleIntegrationError(res: express.Response, error: unknown) {
  if (error instanceof IntegrationServiceError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  const msg = error instanceof Error ? error.message : 'Integration request failed.';
  return res.status(500).json({ error: msg });
}

apiRouter.get('/integrations/state', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    return res.json(getActorHubSnapshot(actor.actorId));
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.post('/integrations/:id/connect', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const body = req.body ?? {};
    const googleAccessToken =
      typeof req.headers['x-google-access-token'] === 'string'
        ? req.headers['x-google-access-token']
        : undefined;
    const result = await saveAndConnectIntegration({
      actorId: actor.actorId,
      integrationId: req.params.id,
      publicConfig: body.publicConfig || {},
      secrets: body.secrets || {},
      googleAccessToken,
      runTest: body.runTest !== false,
    });
    return res.json(result);
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.post('/integrations/:id/test', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const googleAccessToken =
      typeof req.headers['x-google-access-token'] === 'string'
        ? req.headers['x-google-access-token']
        : undefined;
    const result = await testIntegrationConnection({
      actorId: actor.actorId,
      integrationId: req.params.id,
      googleAccessToken,
    });
    return res.json(result);
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.post('/integrations/:id/disconnect', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const purgeSecrets = Boolean(req.body?.purgeSecrets);
    const result = disconnectActorIntegration(actor.actorId, req.params.id, purgeSecrets);
    return res.json(result);
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.post('/integrations/:id/reconnect', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const googleAccessToken =
      typeof req.headers['x-google-access-token'] === 'string'
        ? req.headers['x-google-access-token']
        : undefined;
    const result = await testIntegrationConnection({
      actorId: actor.actorId,
      integrationId: req.params.id,
      googleAccessToken,
    });
    return res.json(result);
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.post('/integrations/:id/dispatch', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const body = req.body ?? {};
    const result = await dispatchToIntegration({
      actorId: actor.actorId,
      integrationId: req.params.id,
      eventType: body.eventType || 'manual_dispatch',
      severity: body.severity || 'warning',
      title: String(body.title || 'Flame in Firefall Alert'),
      message: String(body.message || 'Telemetry threshold alert triggered.'),
      dedupeKey: typeof body.dedupeKey === 'string' ? body.dedupeKey : undefined,
      telemetrySummary: body.telemetrySummary,
    });
    return res.json(result);
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.put('/integrations/routing', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const routes = req.body?.routing;
    if (!routes || typeof routes !== 'object') {
      return res.status(400).json({ error: 'Invalid alert routing payload.' });
    }
    return res.json(updateActorAlertRouting(actor.actorId, routes));
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.put('/integrations/rules', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const rule = req.body?.rule;
    if (!rule || !rule.name) {
      return res.status(400).json({ error: 'Invalid automation rule payload.' });
    }
    return res.json(upsertActorAutomationRule(actor.actorId, rule));
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.delete('/integrations/rules/:ruleId', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    return res.json(deleteActorAutomationRule(actor.actorId, req.params.ruleId));
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.post('/integrations/rules/:ruleId/test', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const result = await testActorAutomationRule(actor.actorId, req.params.ruleId);
    return res.json(result);
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

apiRouter.post('/integrations/logs', async (req, res) => {
  try {
    const actor = await resolveAuthenticatedActor(req.headers.authorization);
    const entry = req.body?.entry;
    if (!entry || !entry.integrationId || !entry.applicationName) {
      return res.status(400).json({ error: 'Invalid activity log entry.' });
    }
    return res.json(recordClientWorkspaceLog(actor.actorId, entry));
  } catch (error) {
    return handleIntegrationError(res, error);
  }
});

// 1. Generate AI Environmental Safety Recommendations (Free-Tier Gemini -> Free Space AI API)
const handleRecommendationsRoute = async (req: express.Request, res: express.Response) => {
  try {
    const { telemetry, habitat, assessment, modelChoice } = req.body ?? {};
    if (!telemetry || !habitat || !assessment) {
      return res.status(400).json({ error: 'Missing telemetry, habitat, or assessment data' });
    }
    const result = await generateSafetyRecommendations(telemetry, habitat, assessment, modelChoice);
    return res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to generate recommendations';
    return res.status(500).json({ error: msg });
  }
};
apiRouter.post('/gemini/recommendations', handleRecommendationsRoute);
apiRouter.post('/ai/recommendations', handleRecommendationsRoute);

// 2. Multi-turn AI Assistant Chat (Free-Tier Gemini -> Free Space AI API)
const handleChatRoute = async (req: express.Request, res: express.Response) => {
  try {
    const { messages, habitatContext, modelChoice, useSearchGrounding, useMapsGrounding } = req.body ?? {};
    if (!messages || !habitatContext) {
      return res.status(400).json({ error: 'Missing messages or habitatContext' });
    }
    const result = await runChatConversation(
      messages,
      habitatContext,
      modelChoice || 'gemini-4-hydrogen',
      !!useSearchGrounding,
      !!useMapsGrounding
    );
    return res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Chat generation failed';
    return res.status(500).json({ error: msg });
  }
};
apiRouter.post('/gemini/chat', handleChatRoute);
apiRouter.post('/ai/chat', handleChatRoute);

// 3. Vision & Hardware Inspection Analysis (Free-Tier Gemini 4 Hydrogen -> Free Space AI API)
const handleVisionRoute = async (req: express.Request, res: express.Response) => {
  try {
    const { base64Data, mimeType, prompt, telemetryContext } = req.body ?? {};
    if (!base64Data || !mimeType) {
      return res.status(400).json({ error: 'Missing image data or mimeType' });
    }
    const result = await analyzeHabitatInspectionImage(
      base64Data,
      mimeType,
      prompt || 'Inspect this habitat component for structural anomalies, thermal damage, or gas leaks.',
      telemetryContext
    );
    return res.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Vision inspection analysis failed';
    return res.status(500).json({ error: msg });
  }
};
apiRouter.post('/gemini/vision-analysis', handleVisionRoute);
apiRouter.post('/ai/vision-analysis', handleVisionRoute);

// 4. AI Provider Availability Status (Reports whether Gemini Free Tier or Free Space AI API is active)
apiRouter.get('/ai/status', (_req, res) => {
  return res.json(getAiProviderStatus());
});

// 4. NASA POWER Live Telemetry
apiRouter.get('/nasa/telemetry', async (req, res) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 28.5728;
    const lon = req.query.lon ? parseFloat(req.query.lon as string) : -80.649;
    const data = await fetchNasaPowerData(lat, lon);
    return res.json(data);
  } catch (error: any) {
    console.error('API /nasa/telemetry error:', error);
    return res.status(500).json({ error: error.message || 'NASA data retrieval failed' });
  }
});

// 5. NASA Space Biology Studies
apiRouter.get('/nasa/biology', (_req, res) => {
  try {
    const studies = getNasaSpaceBiologyDatasets();
    return res.json({ studies });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 6. NASA Free Satellite Exact UTC Date & Time + ISS / DSCOVR Telemetry
apiRouter.get('/nasa/satellite-time', async (_req, res) => {
  try {
    const snapshot = await fetchNasaSatelliteTime();
    return res.json(snapshot);
  } catch (error: any) {
    console.error('API /nasa/satellite-time error:', error);
    return res.status(500).json({ error: error.message || 'NASA satellite time sync failed' });
  }
});

// 7. NASA DONKI Space Weather & EONET Earth Events (Free Open APIs)
apiRouter.get('/nasa/space-weather', async (_req, res) => {
  try {
    const bundle = await fetchNasaSpaceWeatherAndEvents();
    return res.json(bundle);
  } catch (error: any) {
    console.error('API /nasa/space-weather error:', error);
    return res.status(500).json({ error: error.message || 'NASA space weather retrieval failed' });
  }
});
