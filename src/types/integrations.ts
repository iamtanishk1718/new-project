export type IntegrationCategory =
  | 'communication'
  | 'automation'
  | 'hardware_dev';

export type IntegrationId =
  | 'telegram'
  | 'discord'
  | 'slack'
  | 'trello'
  | 'home_assistant'
  | 'esp32_iot'
  | 'github';

export type IntegrationConnectionStatus =
  | 'not_configured'
  | 'connected'
  | 'disconnected'
  | 'auth_failed'
  | 'error';

export type AlertRoutingSeverity = 'normal' | 'warning' | 'critical';

export interface IntegrationFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'email' | 'tel' | 'textarea' | 'checkbox';
  placeholder?: string;
  helperText?: string;
  required?: boolean;
  isSecret: boolean;
}

export interface IntegrationDefinition {
  id: IntegrationId;
  name: string;
  category: IntegrationCategory;
  shortDesc: string;
  authMode: 'webhook' | 'api_key_token' | 'iot_gateway';
  setupHint: string;
  fields: IntegrationFieldDefinition[];
  supportsRouting: boolean;
  supportsAutomation: boolean;
}

export interface IntegrationRecord {
  integrationId: IntegrationId;
  enabled: boolean;
  status: IntegrationConnectionStatus;
  statusLabel: 'Connected Successfully' | 'Not Configured' | 'Disconnected' | 'Authentication Failed' | 'Connection Error';
  publicConfig: Record<string, string | boolean>;
  hasSecrets: boolean;
  maskedSecretSummary: string;
  lastSyncAt?: string;
  lastError?: string;
  updatedAt: string;
}

export type AlertRoutingMatrix = Record<AlertRoutingSeverity, Record<string, boolean>>;

export type AutomationTriggerType =
  | 'oxygen_below'
  | 'pressure_abnormal'
  | 'sensor_disconnected'
  | 'critical_unacknowledged'
  | 'co2_above'
  | 'fire_or_smoke';

export interface AutomationActionTarget {
  integrationId: IntegrationId | 'mission_history' | 'maintenance_team';
  actionType: string;
  label: string;
}

export interface AutomationRuleRecord {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  condition: {
    triggerType: AutomationTriggerType;
    thresholdValue?: number;
    secondaryUpperValue?: number;
    unacknowledgedMinutes?: number;
  };
  actions: AutomationActionTarget[];
  cooldownSeconds: number;
  lastTriggeredAt?: string;
  executionCount: number;
  updatedAt: string;
}

export interface IntegrationLogEntry {
  id: string;
  integrationId: string;
  applicationName: string;
  eventType:
    | 'test_connection'
    | 'alert_routing'
    | 'automation_rule'
    | 'config_update'
    | 'manual_dispatch';
  timestamp: string;
  status:
    | 'delivered'
    | 'connected'
    | 'auth_failed'
    | 'not_configured'
    | 'deduplicated'
    | 'failed';
  severity: 'normal' | 'warning' | 'critical' | 'system';
  detail: string;
}
