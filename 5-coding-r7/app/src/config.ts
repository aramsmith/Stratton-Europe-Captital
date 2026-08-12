import type {
  ModelRouteDeployment,
  ModelRouteDeployments
} from "./model-routing-policy.js";

export interface AppConfig {
  readonly appEnv: "dev" | "tst" | "prd";
  readonly rolloutAdmissionMax: number;
  readonly logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR";
  readonly modelProviderEvidenceId: string;
  readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";
  readonly modelRouteDeployments: ModelRouteDeployments;
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

function parseRoutingPolicyVersion(
  value: string
): "stratton-model-routing-v1" {
  if (value !== "stratton-model-routing-v1") {
    throw new Error("INVALID_MODEL_ROUTING_POLICY_VERSION");
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const requiredKeys = [...expected].sort();
  return (
    actual.length === requiredKeys.length &&
    actual.every((key, index) => key === requiredKeys[index])
  );
}

function requiredDeploymentString(
  value: Record<string, unknown>,
  tier: "LUNA" | "TERRA" | "SOL",
  field: "deploymentId" | "residencyEvidenceId"
): string {
  const entry = value[field];
  if (typeof entry !== "string" || entry.trim().length === 0) {
    throw new Error(`INVALID_MODEL_ROUTE_DEPLOYMENT_${tier}_${field.toUpperCase()}`);
  }
  return entry.trim();
}

function parseDeployment(
  value: unknown,
  tier: "LUNA" | "TERRA" | "SOL",
  expectedModelName: "gpt-5.6-luna" | "gpt-5.6-terra" | "gpt-5.6-sol"
): ModelRouteDeployment {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "deploymentId",
      "residencyEvidenceId",
      "modelName",
      "modelVersion",
      "validationStatus"
    ])
  ) {
    throw new Error(`INVALID_MODEL_ROUTE_DEPLOYMENT_${tier}_FIELDS`);
  }
  if (value.modelName !== expectedModelName) {
    throw new Error(`INVALID_MODEL_ROUTE_DEPLOYMENT_${tier}_MODEL_NAME`);
  }
  if (value.modelVersion !== "2026-07-09") {
    throw new Error(`INVALID_MODEL_ROUTE_DEPLOYMENT_${tier}_MODEL_VERSION`);
  }
  if (value.validationStatus !== "VALIDATED") {
    throw new Error(`INVALID_MODEL_ROUTE_DEPLOYMENT_${tier}_VALIDATION_STATUS`);
  }
  return {
    deploymentId: requiredDeploymentString(value, tier, "deploymentId"),
    residencyEvidenceId: requiredDeploymentString(value, tier, "residencyEvidenceId"),
    modelName: expectedModelName,
    modelVersion: value.modelVersion,
    validationStatus: value.validationStatus
  };
}

function parseModelRouteDeployments(value: string): ModelRouteDeployments {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("INVALID_MODEL_ROUTE_DEPLOYMENTS_JSON");
  }
  if (!isRecord(parsed) || !hasExactKeys(parsed, ["LUNA", "TERRA", "SOL"])) {
    throw new Error("INVALID_MODEL_ROUTE_DEPLOYMENTS_TIERS");
  }
  return {
    LUNA: parseDeployment(parsed.LUNA, "LUNA", "gpt-5.6-luna"),
    TERRA: parseDeployment(parsed.TERRA, "TERRA", "gpt-5.6-terra"),
    SOL: parseDeployment(parsed.SOL, "SOL", "gpt-5.6-sol")
  };
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
    modelRoutingPolicyVersion: parseRoutingPolicyVersion(
      required(env, "MODEL_ROUTING_POLICY_VERSION")
    ),
    modelRouteDeployments: parseModelRouteDeployments(
      required(env, "MODEL_ROUTE_DEPLOYMENTS_JSON")
    ),
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
