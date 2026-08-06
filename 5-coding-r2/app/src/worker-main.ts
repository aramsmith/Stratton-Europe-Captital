import { readFileSync } from "node:fs";
import { loadConfig } from "./config.js";
import { FileIdempotencyStore, InMemoryIdempotencyStore, SqlIdempotencyStore } from "./idempotency-store.js";
import {
  AzureDocumentIntelligenceProvider,
  BlockedAnalysisProvider,
  BlockedAuditEvidenceExporter,
  InMemoryAnalysisProvider,
  InMemoryAuditEvidenceExporter,
  InMemoryDocumentIntelligenceProvider,
  InMemorySearchIndexProvider
} from "./provider-adapters.js";
import { AzureServiceBusFactory, InMemoryQueueRouter } from "./queue-adapters.js";
import { AzureSqlExecutor } from "./sql-client.js";
import { AzureBlobReferenceProvider, InMemoryBlobReferenceProvider } from "./source-connector.js";
import type { ApprovedQueueName, QueueMessage, QueueProducer } from "./types.js";
import { InMemoryWorkloadRepository, SqlWorkloadRepository } from "./workload-repository.js";
import { WorkerRuntime } from "./worker-runtime.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  }
  return value.trim();
}

function parseQueueName(value: string): ApprovedQueueName {
  if (
    value === "q-ingestion" ||
    value === "q-extraction" ||
    value === "q-analysis" ||
    value === "q-indexing" ||
    value === "q-audit-export"
  ) {
    return value;
  }
  throw new Error("INVALID_WORKER_QUEUE_NAME");
}

function parseCsvRequired(name: string): readonly string[] {
  const raw = required(name);
  const values = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (values.length === 0) {
    throw new Error(`INVALID_${name}`);
  }
  return values;
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

function loadMessages(filePath: string): QueueMessage[] {
  const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(value)) {
    throw new Error("INVALID_WORKER_TEST_QUEUE_FILE");
  }
  return value.map((entry) => {
    const payload = entry as Partial<QueueMessage>;
    if (
      !payload.messageId ||
      !payload.tenantId ||
      !payload.caseId ||
      !payload.queueName ||
      !payload.operation ||
      !payload.payloadReference ||
      !payload.idempotencyKey ||
      !payload.correlationId
    ) {
      throw new Error("INVALID_WORKER_TEST_QUEUE_MESSAGE");
    }
    return payload as QueueMessage;
  });
}

async function run(): Promise<void> {
  const config = loadConfig();
  const mode = (process.env.WORKER_MODE ?? "production").toLowerCase();
  const allowTestAdapters = process.env.ALLOW_TEST_ADAPTERS === "true";
  const queueName = parseQueueName(required("WORKER_QUEUE_NAME"));
  const promptGovernanceEvidenceId = required("PROMPT_GOVERNANCE_EVIDENCE_ID");

  if (mode !== "production" && !allowTestAdapters) {
    throw new Error("TEST_ADAPTER_MODE_DISABLED");
  }

  if (mode === "production") {
    if (queueName === "q-analysis") {
      throw new Error("BLOCKED_ANALYSIS_CONTRACT_UNAPPROVED");
    }
    if (queueName === "q-indexing") {
      throw new Error("BLOCKED_VECTORIZATION_CONTRACT_UNAPPROVED");
    }
    if (queueName === "q-audit-export") {
      throw new Error("BLOCKED_AUDIT_EXPORT_CONTRACT_UNAPPROVED");
    }
    if (!config.sqlServerFqdn || !config.sqlDatabaseName || !config.serviceBusFqdn) {
      throw new Error("MISSING_AZURE_PRODUCTION_CONFIG");
    }
    const sql = await AzureSqlExecutor.connect(
      config.sqlServerFqdn,
      config.sqlDatabaseName,
      process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID
    );
    const repository = new SqlWorkloadRepository(sql);
    const idempotencyStore = new SqlIdempotencyStore(sql);
    const bus = await AzureServiceBusFactory.connectReceiver(config.serviceBusFqdn, queueName);
    const receiver = bus.receiver;
    let producer: QueueProducer = new InMemoryQueueRouter();
    let closeProducer = async (): Promise<void> => undefined;
    if (queueName === "q-extraction") {
      const sender = await AzureServiceBusFactory.connectSender(config.serviceBusFqdn, ["q-indexing"]);
      producer = sender.producer;
      closeProducer = sender.close;
    }
    const blobProvider =
      queueName === "q-ingestion"
        ? new AzureBlobReferenceProvider(
            required("AZURE_STORAGE_ACCOUNT_NAME"),
            parseCsvRequired("AZURE_ALLOWED_BLOB_CONTAINERS")
          )
        : new InMemoryBlobReferenceProvider();
    const documentProvider =
      queueName === "q-extraction"
        ? new AzureDocumentIntelligenceProvider(required("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"))
        : new InMemoryDocumentIntelligenceProvider();
    const searchProvider = new InMemorySearchIndexProvider();
    const analysisProvider = new BlockedAnalysisProvider(
      "authority-owned prompt/interface contract not approved for DU-12"
    );
    const auditExporter = new BlockedAuditEvidenceExporter(
      "authority-owned immutable audit export interface contract not approved for DU-12"
    );
    const repositoryReady = await repository.isAvailable();
    const idempotencyReady = await idempotencyStore.isAvailable();
    const receiverReady = await receiver.isAvailable();
    const blobReady = await blobProvider.isAvailable();
    const documentReady = await documentProvider.isAvailable();
    const producerReady = await producer.isAvailable();
    const queueSpecificReady =
      queueName === "q-ingestion"
        ? blobReady.ready
        : queueName === "q-extraction"
          ? documentReady.ready && producerReady
          : true;
    if (!repositoryReady || !idempotencyReady || !receiverReady || !queueSpecificReady) {
      await closeProducer();
      await bus.close();
      await sql.close();
      throw new Error("PRODUCTION_DEPENDENCY_UNAVAILABLE");
    }
    const runtime = new WorkerRuntime({
      queueName,
      receiver,
      producer,
      repository,
      idempotencyStore,
      blobProvider,
      documentProvider,
      searchProvider,
      analysisProvider,
      auditExporter,
      modelProviderEvidenceId: config.modelProviderEvidenceId,
      regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId,
      promptGovernanceEvidenceId,
      maxCycles: parsePositive("WORKER_MAX_CYCLES", 500),
      receiveWaitMs: parsePositive("WORKER_RECEIVE_WAIT_MS", 5_000),
      maxAttempts: parsePositive("WORKER_MAX_ATTEMPTS", 3),
      idempotencyLeaseDurationSeconds: parsePositive("IDEMPOTENCY_LEASE_DURATION_SECONDS", 120)
    });
    await runtime.run();
    await closeProducer();
    await bus.close();
    await sql.close();
    return;
  }

  const messages = loadMessages(required("WORKER_TEST_QUEUE_FILE"));
  const queue = new InMemoryQueueRouter();
  for (const message of messages) {
    await queue.send(message);
  }
  const repository = new InMemoryWorkloadRepository();
  const idempotencyStore = process.env.WORKER_TEST_IDEMPOTENCY_FILE?.trim()
    ? new FileIdempotencyStore(process.env.WORKER_TEST_IDEMPOTENCY_FILE.trim())
    : new InMemoryIdempotencyStore();
  const blobProvider = new InMemoryBlobReferenceProvider();
  for (const message of messages) {
    blobProvider.seed(message.payloadReference);
  }
  const runtime = new WorkerRuntime({
    queueName,
    receiver: queue.forQueue(queueName),
    producer: queue,
    repository,
    idempotencyStore,
    blobProvider,
    documentProvider: new InMemoryDocumentIntelligenceProvider(),
    searchProvider: new InMemorySearchIndexProvider(),
    analysisProvider: new InMemoryAnalysisProvider(),
    auditExporter: new InMemoryAuditEvidenceExporter(),
    modelProviderEvidenceId: config.modelProviderEvidenceId,
    regionalDeploymentEvidenceId: config.regionalDeploymentEvidenceId,
    promptGovernanceEvidenceId,
    maxCycles: parsePositive("WORKER_MAX_CYCLES", 100),
    receiveWaitMs: parsePositive("WORKER_RECEIVE_WAIT_MS", 10),
    maxAttempts: parsePositive("WORKER_MAX_ATTEMPTS", 3),
    idempotencyLeaseDurationSeconds: parsePositive("IDEMPOTENCY_LEASE_DURATION_SECONDS", 120)
  });
  await runtime.run();
}

void run();
