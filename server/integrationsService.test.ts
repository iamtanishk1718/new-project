import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getActorHubSnapshot,
  resolveAuthenticatedActor,
  saveAndConnectIntegration,
  testIntegrationConnection,
  disconnectActorIntegration,
  updateActorAlertRouting,
  upsertActorAutomationRule,
  deleteActorAutomationRule,
  testActorAutomationRule,
  IntegrationServiceError,
} from './integrationsService.ts';
import {
  checkAndMarkDuplicate,
  checkRateLimit,
  getDecryptedIntegrationSecrets,
  resetVaultAndLimitersForTests,
  sanitizeLogDetail,
  validateExternalWebhookUrl,
} from './secretVault.ts';
import { issueDirectOperatorSession, requestOtpChallenge, verifyOtpChallenge } from './otpService.ts';
import { INTEGRATION_CATALOG, createDefaultAlertRoutingMatrix } from '../src/lib/integrationCatalog.ts';

test('Integration catalog contains strictly the 7 free open integrations and zero paid channels', () => {
  assert.equal(INTEGRATION_CATALOG.length, 7);
  const ids = new Set(INTEGRATION_CATALOG.map((i) => i.id));
  for (const expected of [
    'telegram',
    'discord',
    'slack',
    'trello',
    'home_assistant',
    'esp32_iot',
    'github',
  ]) {
    assert.ok(ids.has(expected as any), `Missing free integration ${expected}`);
  }

  for (const paidOrRemoved of ['twilio', 'zapier', 'whatsapp', 'google_chat', 'gmail', 'fcm']) {
    assert.ok(!ids.has(paidOrRemoved as any), `Paid/removed integration ${paidOrRemoved} must not exist`);
  }
});

test('Auth guard rejects missing or bogus bearer tokens and accepts direct operator & OTP tokens', async () => {
  await assert.rejects(() => resolveAuthenticatedActor(undefined), IntegrationServiceError);
  await assert.rejects(() => resolveAuthenticatedActor('Bearer invalid.token.here'), IntegrationServiceError);

  const direct = issueDirectOperatorSession('cmd_preview');
  const directActor = await resolveAuthenticatedActor(`Bearer ${direct.token}`);
  assert.equal(directActor.authSource, 'otp');
  assert.equal(directActor.actorId, 'otp_op_cmd_preview');

  const challenge = await requestOtpChallenge('hub-test@tejasvi.org', 'email', 'Test Commander');
  const verified = verifyOtpChallenge(
    'hub-test@tejasvi.org',
    'email',
    challenge.dispatchPreviewCode!,
    challenge.challengeToken
  );
  const actor = await resolveAuthenticatedActor(`Bearer ${verified.token}`);
  assert.equal(actor.authSource, 'otp');
  assert.ok(actor.actorId.startsWith('otp_'));
});

test('SSRF and webhook URL validator blocks cloud metadata & invalid webhook hosts', () => {
  assert.ok(validateExternalWebhookUrl('http://169.254.169.254/latest/meta-data'));
  assert.ok(validateExternalWebhookUrl('https://localhost:3000/hook'));
  assert.ok(
    validateExternalWebhookUrl('https://evil.example.com/webhooks/123', {
      requiredHostSuffixes: ['discord.com'],
      requiredPathPrefix: '/api/webhooks/',
    })
  );
  assert.equal(
    validateExternalWebhookUrl('https://discord.com/api/webhooks/123456/abcdef', {
      requiredHostSuffixes: ['discord.com', 'discordapp.com'],
      requiredPathPrefix: '/api/webhooks/',
    }),
    null
  );
  assert.equal(
    validateExternalWebhookUrl('http://192.168.4.1', { allowHttpForLocalIot: true }),
    null
  );
});

test('Secret encryption & non-exposure in hub snapshot + Not Configured / Auth Failed handling', async () => {
  resetVaultAndLimitersForTests();
  const actorId = 'test_actor_vault';

  // Empty integration test reports Not Configured cleanly (never fakes success)
  const unconf = await testIntegrationConnection({
    actorId,
    integrationId: 'telegram',
  });
  assert.equal(unconf.status, 'not_configured');
  assert.equal(unconf.statusLabel, 'Not Configured');

  // Save invalid Discord webhook token -> verify fails with auth_failed
  const discordRes = await saveAndConnectIntegration({
    actorId,
    integrationId: 'discord',
    publicConfig: { channelLabel: '#alerts' },
    secrets: { webhookUrl: 'https://discord.com/api/webhooks/000000000000000000/invalid-test-token' },
    runTest: true,
  });
  assert.ok(discordRes.status === 'auth_failed' || discordRes.status === 'error');
  assert.ok(
    discordRes.statusLabel === 'Authentication Failed' || discordRes.statusLabel === 'Connection Error'
  );

  // Snapshot MUST mask secrets and never include plaintext webhookUrl
  const snap = getActorHubSnapshot(actorId);
  const discordRec = snap.integrations.find((r) => r.integrationId === 'discord')!;
  assert.equal(discordRec.hasSecrets, true);
  assert.ok(!JSON.stringify(snap).includes('invalid-test-token'));

  // Server-side decryption recovers exact secret
  const decrypted = getDecryptedIntegrationSecrets(actorId, 'discord');
  assert.equal(decrypted.webhookUrl, 'https://discord.com/api/webhooks/000000000000000000/invalid-test-token');

  // Disconnect & purge wipes secrets
  const disc = disconnectActorIntegration(actorId, 'discord', true);
  assert.equal(disc.record.status, 'not_configured');
  assert.equal(disc.record.hasSecrets, false);
  assert.deepEqual(getDecryptedIntegrationSecrets(actorId, 'discord'), {});
});

test('Rate limiter, deduplication guard, and log redaction enforce security controls', () => {
  resetVaultAndLimitersForTests();

  assert.equal(checkAndMarkDuplicate('actor:telegram:critical', 60_000), false);
  assert.equal(checkAndMarkDuplicate('actor:telegram:critical', 60_000), true);

  for (let i = 0; i < 3; i++) {
    assert.equal(checkRateLimit('rl-test', 3, 60_000), true);
  }
  assert.equal(checkRateLimit('rl-test', 3, 60_000), false);

  const sanitized = sanitizeLogDetail('Failed with Bearer secret_token_123 and github_pat_123456789');
  assert.ok(!sanitized.includes('secret_token_123'));
  assert.ok(!sanitized.includes('github_pat_123456789'));
});

test('Alert routing and automation rules CRUD + test execution persist cleanly', async () => {
  resetVaultAndLimitersForTests();
  const actorId = 'test_actor_rules';

  const matrix = createDefaultAlertRoutingMatrix();
  matrix.normal.discord = true;
  const routeRes = updateActorAlertRouting(actorId, matrix);
  assert.equal(routeRes.routing.normal.discord, true);

  upsertActorAutomationRule(actorId, {
    id: 'rule-custom-co2',
    name: 'CO2 High Rule',
    description: 'Warn on elevated CO2',
    enabled: true,
    condition: { triggerType: 'co2_above', thresholdValue: 4500 },
    actions: [{ integrationId: 'mission_history', actionType: 'log', label: 'Record Event' }],
    cooldownSeconds: 60,
    executionCount: 0,
    updatedAt: new Date().toISOString(),
  });

  const execRes = await testActorAutomationRule(actorId, 'rule-custom-co2');
  assert.equal(execRes.rule.executionCount, 1);
  assert.ok(execRes.actionSummaries[0].includes('Recorded'));

  const delRes = deleteActorAutomationRule(actorId, 'rule-custom-co2');
  assert.ok(!delRes.rules.some((r) => r.id === 'rule-custom-co2'));
});
