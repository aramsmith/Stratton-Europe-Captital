export interface AppConfig {
  readonly appEnv: "dev" | "tst" | "prd";
  readonly rolloutAdmissionMax: number;
  readonly logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  readonly modelProviderEvidenceId: string;
  readonly regionalDeploymentEvidenceId: string;
  readonly demoAuthorityCompletionClientId?: string;
  readonly sqlServerFqdn?: string;
  readonly sqlDatabaseName?: string;
  readonly serviceBusFqdn?: string;
  readonly workQueueName?: string;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  }
  return value.trim();
}

function parseEnv(value: string): AppConfig["appEnv"] {
  if (value === "dev" || value === "tst" || value === "prd") {
    return value;
  }
  throw new Error("INVALID_APP_ENV");
}

function parseLogLevel(value: string): AppConfig["logLevel"] {
  if (value === "DEBUG" || value === "INFO" || value === "WARN" || value === "ERROR") {
    return value;
  }
  throw new Error("INVALID_LOG_LEVEL");
}

function parseRollout(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new Error("INVALID_ROLLOUT_ADMISSION_MAX");
  }
  return parsed;
}

function assertSecretFreeReferences(env: NodeJS.ProcessEnv): void {
  const forbidden = [
    "AZURE_SQL_PASSWORD",
    "AZURE_SQL_CONNECTION_STRING",
    "AZURE_SERVICEBUS_CONNECTION_STRING",
    "AZURE_CLIENT_SECRET"
  ];
  for (const key of forbidden) {
    const value = env[key];
    if (!value) {
      continue;
    }
    throw new Error(`SECRET_VALUE_NOT_ALLOWED:${key}`);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  assertSecretFreeReferences(env);
  return {
    appEnv: parseEnv(required(env, "APP_ENV")),
    rolloutAdmissionMax: parseRollout(required(env, "ROLLOUT_ADMISSION_MAX")),
    logLevel: parseLogLevel(required(env, "LOG_LEVEL")),
    modelProviderEvidenceId: required(env, "MODEL_PROVIDER_EVIDENCE_ID"),
    regionalDeploymentEvidenceId: required(env, "REGIONAL_DEPLOYMENT_EVIDENCE_ID"),
    ...(env.DEMO_AUTHORITY_COMPLETION_CLIENT_ID?.trim()
      ? { demoAuthorityCompletionClientId: env.DEMO_AUTHORITY_COMPLETION_CLIENT_ID.trim() }
      : {}),
    ...(env.AZURE_SQL_SERVER_FQDN?.trim()
      ? { sqlServerFqdn: env.AZURE_SQL_SERVER_FQDN.trim() }
      : {}),
    ...(env.AZURE_SQL_DATABASE_NAME?.trim()
      ? { sqlDatabaseName: env.AZURE_SQL_DATABASE_NAME.trim() }
      : {}),
    ...(env.AZURE_SERVICEBUS_FQDN?.trim()
      ? { serviceBusFqdn: env.AZURE_SERVICEBUS_FQDN.trim() }
      : {}),
    ...(env.AZURE_WORK_QUEUE_NAME?.trim()
      ? { workQueueName: env.AZURE_WORK_QUEUE_NAME.trim() }
      : {})
  };
}
