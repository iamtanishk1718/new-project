import type {
  AlertRoutingMatrix,
  AutomationRuleRecord,
  IntegrationDefinition,
  IntegrationId,
} from '../types/integrations.ts';

/**
 * 100% Free & Open Integration Channels (Zero paid SaaS / SMS / Workspace plans).
 * NASA Open Data & Free Satellite feeds are built-in and active automatically.
 */
export const INTEGRATION_CATALOG: IntegrationDefinition[] = [
  // COMMUNICATION (100% Free)
  {
    id: 'telegram',
    name: 'Telegram Bot',
    category: 'communication',
    shortDesc: 'Instant encrypted crew channel alerts and warning commands via free Telegram Bot API.',
    authMode: 'api_key_token',
    setupHint: 'Create a free bot with @BotFather on Telegram, copy the Bot Token, and obtain your group or user Chat ID.',
    fields: [
      {
        key: 'botToken',
        label: 'Telegram Bot Token',
        type: 'password',
        placeholder: '123456789:AAEh...',
        helperText: 'Stored encrypted in server vault; verified against api.telegram.org/getMe.',
        required: true,
        isSecret: true,
      },
      {
        key: 'chatId',
        label: 'Target Chat / Channel ID',
        type: 'text',
        placeholder: '-1001234567890',
        helperText: 'Numeric user ID, group ID, or @channel_username.',
        required: true,
        isSecret: false,
      },
    ],
    supportsRouting: true,
    supportsAutomation: true,
  },
  {
    id: 'discord',
    name: 'Discord Webhooks',
    category: 'communication',
    shortDesc: 'Stream structured telemetry alerts and subsystem warnings into free Discord ops channels.',
    authMode: 'webhook',
    setupHint: 'In Discord Server Settings -> Integrations -> Webhooks, create a free webhook and paste its HTTPS URL.',
    fields: [
      {
        key: 'webhookUrl',
        label: 'Discord Webhook URL',
        type: 'url',
        placeholder: 'https://discord.com/api/webhooks/...',
        helperText: 'Validated against discord.com/api/webhooks and stored encrypted on backend.',
        required: true,
        isSecret: true,
      },
      {
        key: 'channelLabel',
        label: 'Channel Label (Optional)',
        type: 'text',
        placeholder: '#mission-alerts',
        required: false,
        isSecret: false,
      },
    ],
    supportsRouting: true,
    supportsAutomation: true,
  },
  {
    id: 'slack',
    name: 'Slack Incoming Webhooks',
    category: 'communication',
    shortDesc: 'Notify engineering and mission control Slack channels on telemetry breaches (Free Tier).',
    authMode: 'webhook',
    setupHint: 'Create an Incoming Webhook at api.slack.com/apps and paste the webhook URL.',
    fields: [
      {
        key: 'webhookUrl',
        label: 'Slack Incoming Webhook URL',
        type: 'url',
        placeholder: 'https://hooks.slack.com/services/T00/B00/XXXX',
        required: true,
        isSecret: true,
      },
      {
        key: 'channelName',
        label: 'Target Workspace Channel',
        type: 'text',
        placeholder: '#eclss-ops',
        required: false,
        isSecret: false,
      },
    ],
    supportsRouting: true,
    supportsAutomation: true,
  },

  // AUTOMATION (Free Tier)
  {
    id: 'trello',
    name: 'Trello',
    category: 'automation',
    shortDesc: 'Create maintenance action cards automatically on free engineering Kanban boards.',
    authMode: 'api_key_token',
    setupHint: 'Get your free Power-Up API Key and Token at trello.com/power-ups/admin and target List ID.',
    fields: [
      {
        key: 'apiKey',
        label: 'Trello API Key',
        type: 'password',
        placeholder: '32-char Trello API Key',
        required: true,
        isSecret: true,
      },
      {
        key: 'apiToken',
        label: 'Trello API Token',
        type: 'password',
        placeholder: 'ATTA...',
        required: true,
        isSecret: true,
      },
      {
        key: 'listId',
        label: 'Target Maintenance List ID',
        type: 'text',
        placeholder: '64a1f8...',
        required: true,
        isSecret: false,
      },
    ],
    supportsRouting: true,
    supportsAutomation: true,
  },

  // HARDWARE AND DEVELOPMENT (100% Free & Open Source)
  {
    id: 'home_assistant',
    name: 'Home Assistant',
    category: 'hardware_dev',
    shortDesc: 'Trigger physical beacon lights, sirens, and relay automations via open-source Home Assistant.',
    authMode: 'iot_gateway',
    setupHint: 'Provide your Home Assistant URL and a Long-Lived Access Token from your HA user profile.',
    fields: [
      {
        key: 'baseUrl',
        label: 'Home Assistant Instance URL',
        type: 'url',
        placeholder: 'https://ha.mission-lab.example',
        required: true,
        isSecret: false,
      },
      {
        key: 'longLivedToken',
        label: 'Long-Lived Access Token',
        type: 'password',
        placeholder: 'eyJhbGciOi...',
        required: true,
        isSecret: true,
      },
      {
        key: 'entityId',
        label: 'Target Notify / Script Service',
        type: 'text',
        placeholder: 'notify/persistent_notification',
        required: false,
        isSecret: false,
      },
    ],
    supportsRouting: true,
    supportsAutomation: true,
  },
  {
    id: 'esp32_iot',
    name: 'ESP32 / IoT Gateway',
    category: 'hardware_dev',
    shortDesc: 'Bridge physical habitat sensor boards, buzzers, and relays over open HTTP REST gateway.',
    authMode: 'iot_gateway',
    setupHint: 'Expose your ESP32/MQTT HTTP bridge (/health and /alert) and set a shared Device API Key.',
    fields: [
      {
        key: 'gatewayUrl',
        label: 'IoT Gateway Base URL',
        type: 'url',
        placeholder: 'https://esp32-gateway.example.com',
        required: true,
        isSecret: false,
      },
      {
        key: 'deviceKey',
        label: 'Device Gateway API Key',
        type: 'password',
        placeholder: 'esp32-secret-key',
        required: true,
        isSecret: true,
      },
      {
        key: 'deviceId',
        label: 'Hardware Node ID',
        type: 'text',
        placeholder: 'esp32-destiny-node-01',
        required: false,
        isSecret: false,
      },
    ],
    supportsRouting: true,
    supportsAutomation: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'hardware_dev',
    shortDesc: 'Open engineering anomaly issues automatically in your spacecraft telemetry repository.',
    authMode: 'api_key_token',
    setupHint: 'Generate a free fine-grained Personal Access Token (Issues: Read & Write) and enter owner/repo.',
    fields: [
      {
        key: 'personalAccessToken',
        label: 'GitHub Personal Access Token',
        type: 'password',
        placeholder: 'github_pat_... or ghp_...',
        required: true,
        isSecret: true,
      },
      {
        key: 'repository',
        label: 'Target Repository (owner/repo)',
        type: 'text',
        placeholder: 'team-tejasvi/flame-in-firefall-ops',
        required: true,
        isSecret: false,
      },
    ],
    supportsRouting: true,
    supportsAutomation: true,
  },
];

export const INTEGRATION_BY_ID: Record<IntegrationId, IntegrationDefinition> =
  INTEGRATION_CATALOG.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {} as Record<IntegrationId, IntegrationDefinition>);

export function createDefaultAlertRoutingMatrix(): AlertRoutingMatrix {
  const allIds = INTEGRATION_CATALOG.map((i) => i.id);
  const emptyRow = (): Record<string, boolean> => {
    const row: Record<string, boolean> = { mission_history: true };
    for (const id of allIds) row[id] = false;
    return row;
  };

  const normal = emptyRow();
  normal.mission_history = true;

  const warning = emptyRow();
  warning.mission_history = true;
  warning.telegram = true;
  warning.discord = true;

  const critical = emptyRow();
  critical.mission_history = true;
  critical.telegram = true;
  critical.discord = true;
  critical.slack = true;
  critical.github = true;

  return { normal, warning, critical };
}

export function createDefaultAutomationRules(): AutomationRuleRecord[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'rule-oxygen-drop',
      name: 'Hypoxic Oxygen Threshold Breach',
      description:
        'IF oxygen percentage falls below configured threshold (19.5%) THEN create a critical incident and notify Telegram.',
      enabled: true,
      condition: {
        triggerType: 'oxygen_below',
        thresholdValue: 19.5,
      },
      actions: [
        {
          integrationId: 'mission_history',
          actionType: 'create_critical_incident',
          label: 'Create Critical Incident',
        },
        {
          integrationId: 'telegram',
          actionType: 'send_alert',
          label: 'Notify Telegram Bot',
        },
      ],
      cooldownSeconds: 120,
      executionCount: 0,
      updatedAt: now,
    },
    {
      id: 'rule-pressure-abnormal',
      name: 'Cabin Pressure Anomaly Response',
      description:
        'IF cabin pressure becomes abnormal (< 95 or > 105 kPa) THEN post to Discord Ops and create a Trello maintenance task.',
      enabled: true,
      condition: {
        triggerType: 'pressure_abnormal',
        thresholdValue: 95,
        secondaryUpperValue: 105,
      },
      actions: [
        {
          integrationId: 'discord',
          actionType: 'send_incident_report',
          label: 'Notify Discord Ops',
        },
        {
          integrationId: 'trello',
          actionType: 'create_maintenance_card',
          label: 'Create Trello Maintenance Task',
        },
      ],
      cooldownSeconds: 180,
      executionCount: 0,
      updatedAt: now,
    },
    {
      id: 'rule-sensor-disconnected',
      name: 'Subsystem / Sensor Fault Dispatch',
      description:
        'IF a life-support sensor or scrubber becomes disconnected/faulted THEN notify the technical maintenance team.',
      enabled: true,
      condition: {
        triggerType: 'sensor_disconnected',
      },
      actions: [
        {
          integrationId: 'slack',
          actionType: 'notify_maintenance',
          label: 'Notify Maintenance Team (Slack)',
        },
        {
          integrationId: 'discord',
          actionType: 'notify_maintenance',
          label: 'Notify Engineering Channel (Discord)',
        },
      ],
      cooldownSeconds: 180,
      executionCount: 0,
      updatedAt: now,
    },
    {
      id: 'rule-critical-escalation',
      name: 'Unacknowledged Critical Escalation',
      description:
        'IF a critical alert remains unacknowledged for 3 minutes THEN open a GitHub engineering incident and trigger ESP32 hardware alarm.',
      enabled: true,
      condition: {
        triggerType: 'critical_unacknowledged',
        unacknowledgedMinutes: 3,
      },
      actions: [
        {
          integrationId: 'github',
          actionType: 'open_issue',
          label: 'Open GitHub Anomaly Issue',
        },
        {
          integrationId: 'esp32_iot',
          actionType: 'trigger_hardware_alarm',
          label: 'Trigger ESP32 / IoT Beacon',
        },
      ],
      cooldownSeconds: 300,
      executionCount: 0,
      updatedAt: now,
    },
  ];
}
