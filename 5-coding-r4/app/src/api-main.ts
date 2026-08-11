import { createApiServer } from "./api-runtime.js";
import { loadConfig } from "./config.js";
import { FileIdempotencyStore, InMemoryIdempotencyStore, SqlIdempotencyStore } from "./idempotency-store.js";
import { StructuredLogger } from "./logger.js";
import { AzureServiceBusFactory, InMemoryQueueRouter } from "./queue-adapters.js";
import { AzureSqlExecutor } from "./sql-client.js";
import { InMemoryWorkloadRepository, SqlWorkloadRepository } from "./workload-repository.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  }
  return value.trim();
}

function parsePort(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("INVALID_API_PORT");
  }
  return parsed;
}

function parsePositive(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`INVALID_${name}`);
  }
  return parsed;
}

async function run(): Promise<void> {
  const config = loadConfig();
  const logger = new StructuredLogger("stratton-api");
  const port = parsePort(required("API_PORT"));
  const mode = (process.env.API_RUNTIME_MODE ?? "production").toLowerCase();
  const allowTestAdapters = process.env.ALLOW_TEST_ADAPTERS === "true";
  const promptGovernanceEvidenceId = required("PROMPT_GOVERNANCE_EVIDENCE_ID");
  const analysisCapabilityEnabled =
    (process.env.ANALYSIS_CAPABILITY_ENABLED ?? (mode === "production" ? "false" : "true")) ===
    "true";
  const auditExportCapabilityEnabled =
    (process.env.AUDIT_EXPORT_CAPABILITY_ENABLED ?? (mode === "production" ? "false" : "true")) ===
    "true";

  if (mode !== "production" && !allowTestAdapters) {
    throw new Error("TEST_ADAPTER_MODE_DISABLED");
  }

  if (mode === "production") {
    if (analysisCapabilityEnabled || auditExportCapabilityEnabled) {
      throw new Error("BLOCKED_CAPABILITY_OVERRIDE");
    }
    if (!config.sqlServerFqdn || !config.sqlDatabaseName || !config.serviceBusFqdn) {
      throw new Error("MISSING_AZURE_PRODUCTION_CONFIG");
    }
    const sql = await AzureSqlExecutor.connect(
      config.sqlServerFqdn,
      config.sqlDatabaseName,
      process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID
    );
    const bus = await AzureServiceBusFactory.connectRouting(config.serviceBusFqdn, [
      "q-ingestion",
      "q-extraction",
      "q-indexing"
    ], process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID);
    const repository = new SqlWorkloadRepository(sql);
    const idempotencyStore = new SqlIdempotencyStore(sql);
    if (
      !(await repository.isAvailable()) ||
      !(await idempotencyStore.isAvailable()) ||
      !(await bus.producer.isAvailable())
    ) {
      await bus.close();
      await sql.close();
      throw new Error("PRODUCTION_DEPENDENCY_UNAVAILABLE");
    }
    const { server } = createApiServer({
      repository,
      idempotencyStore,
      queueProducer: bus.producer,
      logger,
      requestBodyLimitBytes: parsePositive("API_REQUEST_BODY_LIMIT_BYTES", 65_536),
      modelProviderEvidenceId: config.modelProviderEvidenceId,
      regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId,
      promptGovernanceEvidenceId,
      idempotencyLeaseDurationSeconds: parsePositive("IDEMPOTENCY_LEASE_DURATION_SECONDS", 120),
      analysisCapabilityEnabled,
      auditExportCapabilityEnabled,
      ...(config.demoAuthorityCompletionClientId
        ? { completionClientId: config.demoAuthorityCompletionClientId }
        : {})
    });

    await new Promise<void>((resolve) => server.listen(port, () => resolve()));
    logger.log("INFO", "api-started", { correlationId: "startup", mode, port });
    const shutdown = async (): Promise<void> => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await bus.close();
      await sql.close();
      process.exit(0);
    };
    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
    return;
  }

  const repository = new InMemoryWorkloadRepository();
  const queue = new InMemoryQueueRouter();
  const idempotencyStore = process.env.API_TEST_IDEMPOTENCY_FILE?.trim()
    ? new FileIdempotencyStore(process.env.API_TEST_IDEMPOTENCY_FILE.trim())
    : new InMemoryIdempotencyStore();
  const { server } = createApiServer({
    repository,
    idempotencyStore,
    queueProducer: queue,
    logger,
    requestBodyLimitBytes: parsePositive("API_REQUEST_BODY_LIMIT_BYTES", 65_536),
    modelProviderEvidenceId: config.modelProviderEvidenceId,
    regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId,
    promptGovernanceEvidenceId,
    idempotencyLeaseDurationSeconds: parsePositive("IDEMPOTENCY_LEASE_DURATION_SECONDS", 120),
    analysisCapabilityEnabled,
    auditExportCapabilityEnabled,
    ...(config.demoAuthorityCompletionClientId
      ? { completionClientId: config.demoAuthorityCompletionClientId }
      : {})
  });
  await new Promise<void>((resolve) => server.listen(port, () => resolve()));
  logger.log("INFO", "api-started", { correlationId: "startup", mode, port });
  const shutdown = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

void run();
