import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { InMemoryIdempotencyStore, SqlIdempotencyStore } from "../../../app/src/idempotency-store.js";
import {
  AzureSearchIndexProvider,
  InMemoryAnalysisProvider,
  InMemoryDocumentIntelligenceProvider,
  InMemorySearchIndexProvider
} from "../../../app/src/provider-adapters.js";
import { InMemoryQueueRouter } from "../../../app/src/queue-adapters.js";
import { QueueConsumer } from "../../../app/src/queue-consumer.js";
import { type SqlCommandResult, type SqlExecutionOptions, type SqlExecutor, type SqlPrimitive } from "../../../app/src/sql-client.js";
import { InMemoryBlobReferenceProvider } from "../../../app/src/source-connector.js";
import type {
  AnalysisProvider,
  AuditEvidenceExporter,
  QueueEnvelope,
  QueueMessage,
  QueueReceiver
} from "../../../app/src/types.js";
import { InMemoryWorkloadRepository, SqlWorkloadRepository } from "../../../app/src/workload-repository.js";
import { WorkerRuntime } from "../../../app/src/worker-runtime.js";

class RecordingEnvelope implements QueueEnvelope {
  public action: "complete" | "abandon" | "deadLetter" | undefined;
  public reason: string | undefined;

  public constructor(public readonly message: QueueMessage) {}

  public async complete(): Promise<void> {
    this.action = "complete";
  }

  public async abandon(reason: string): Promise<void> {
    this.action = "abandon";
    this.reason = reason;
  }

  public async deadLetter(reason: string): Promise<void> {
    this.action = "deadLetter";
    this.reason = reason;
  }
}

class OneShotReceiver implements QueueReceiver {
  private envelope: RecordingEnvelope | undefined;

  public constructor(envelope?: RecordingEnvelope) {
    this.envelope = envelope;
  }

  public async receiveOne(_maxWaitMs: number): Promise<QueueEnvelope | undefined> {
    const current = this.envelope;
    this.envelope = undefined;
    return current;
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }
}

class NoopExporter implements AuditEvidenceExporter {
  public async exportCaseEvidence(): Promise<void> {
    return;
  }

  public async isAvailable(): Promise<{ ready: boolean; detail: string }> {
    return { ready: true, detail: "ok" };
  }
}

class RecordingAnalysisProvider implements AnalysisProvider {
  public invocations = 0;

  public async runDraftOnlyAnalysis(input: {
    readonly analysisRunId: string;
    readonly payloadReference: string;
    readonly modelDeploymentId: string;
    readonly promptTemplateVersion: string;
  }): Promise<{
    outputReference: string;
    claims: [];
    citations: [];
  }> {
    this.invocations += 1;
    return {
      outputReference: `draft://${input.analysisRunId}`,
      claims: [],
      citations: []
    };
  }

  public async isAvailable(): Promise<{ ready: boolean; detail: string }> {
    return { ready: true, detail: "recording" };
  }
}

class MissingLatestLicenceRepository extends InMemoryWorkloadRepository {
  public licenceMissing = false;

  public override async getLatestExternalLicenceDecision(
    tenantId: string,
    caseId: string,
    sourceId: string
  ) {
    if (this.licenceMissing) {
      return undefined;
    }
    return super.getLatestExternalLicenceDecision(tenantId, caseId, sourceId);
  }
}

class CrashOnFirstMarkRepository extends InMemoryWorkloadRepository {
  private shouldCrash = true;

  public override async markWorkItemStatus(
    tenantId: string,
    caseId: string,
    workItemId: string,
    status: "QUEUED" | "IN_PROGRESS" | "PROCESSED" | "DEAD_LETTER" | "REJECTED",
    attempt: number
  ): Promise<void> {
    if (this.shouldCrash) {
      this.shouldCrash = false;
      throw new Error("CRASH_BEFORE_QUEUE_FINALIZATION");
    }
    await super.markWorkItemStatus(tenantId, caseId, workItemId, status, attempt);
  }
}

async function seedCaseGraph(repository: InMemoryWorkloadRepository, status: "DRAFT" | "EVIDENCE_ADMITTED"): Promise<void> {
  repository.seedApprovedEligibility("tenant-a", "case-a", "DEAL", "deal-ok");
  repository.seedApprovedEligibility("tenant-a", "case-a", "JURISDICTION", "jur-ok");
  await repository.createCase({
    tenantId: "tenant-a",
    caseId: "case-a",
    jurisdiction: "EU",
    purpose: "DUE_DILIGENCE",
    status,
    createdBy: "owner-a",
    openedAtIso: new Date().toISOString(),
    dealEligibilityDecisionId: "deal-ok",
    jurisdictionEligibilityDecisionId: "jur-ok",
    rolloutSequence: 1
  });
  await repository.grantCaseAccess({
    tenantId: "tenant-a",
    caseId: "case-a",
    subjectId: "owner-a",
    purpose: "DUE_DILIGENCE",
    role: "DealInitiator"
  });
  await repository.upsertSource({
    tenantId: "tenant-a",
    caseId: "case-a",
    sourceId: "src-1",
    ownerId: "owner-a",
    domain: "registry",
    authoritativeStatus: "VERIFIED",
    authoritativeSystem: "system-a",
    interfaceType: "READ_ONLY_API",
    permissionEvidenceId: "perm-1",
    connectorEvidenceId: "connector-1",
    jurisdiction: "EU",
    sourceVersion: "v1",
    status: "ACTIVE"
  });
  await repository.appendExternalLicenceDecision({
    tenantId: "tenant-a",
    caseId: "case-a",
    sourceId: "src-1",
    licenceDecisionId: "lic-1",
    licenceEvidenceId: "lic-evidence-1",
    aiRetrievalAllowed: true,
    aiAnalysisAllowed: true,
    purposeId: "DUE_DILIGENCE",
    purposeApproved: true,
    privacyApproved: true,
    licenceCompatible: true,
    expiresAtIso: new Date(Date.now() + 60_000).toISOString(),
    lawfulBasis: "contract",
    approvedBy: "legal-a"
  });
}

async function seedQueuedAnalysis(repository: InMemoryWorkloadRepository): Promise<void> {
  await seedCaseGraph(repository, "EVIDENCE_ADMITTED");
  await repository.createEvidence({
    tenantId: "tenant-a",
    caseId: "case-a",
    evidenceId: "ev-authority",
    sourceId: "src-1",
    sourceVersion: "v1",
    ownerId: "owner-a",
    capturedAtIso: new Date().toISOString(),
    licenceDecisionId: "lic-1",
    purposeId: "DUE_DILIGENCE",
    classification: "CONFIDENTIAL",
    qualityStatus: "APPROVED",
    contentHash: "hash-authority",
    payloadReference: "blob://authority-payload",
    hasSpecialCategoryData: false,
    isExternalData: true,
    admissionStatus: "ADMITTED"
  });
  await repository.createAnalysisRun({
    tenantId: "tenant-a",
    caseId: "case-a",
    analysisRunId: "run-authority",
    evidenceId: "ev-authority",
    evidenceVersionId: "ev-authority-v1",
    modelDeploymentId: "model-a",
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    promptTemplateVersion: "p1",
    policyVersion: "release-1",
    inputManifestHash: "imh-authority",
    status: "QUEUED",
    outputKind: "DRAFT_ONLY",
    unsupportedClaims: 0
  });
}

function analysisEnvelope(deliveryCount: number): RecordingEnvelope {
  return new RecordingEnvelope({
    messageId: "msg-analysis-authority",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_ANALYSIS",
    queueName: "q-analysis",
    payloadReference: "blob://authority-payload",
    idempotencyKey: "idem-analysis-authority",
    correlationId: "corr-analysis-authority",
    evidenceId: "ev-authority",
    analysisRunId: "run-authority",
    deliveryCount
  });
}

function analysisRuntime(
  repository: InMemoryWorkloadRepository,
  idempotencyStore: InMemoryIdempotencyStore,
  provider: RecordingAnalysisProvider,
  envelope: RecordingEnvelope
): WorkerRuntime {
  return new WorkerRuntime({
    queueName: "q-analysis",
    receiver: new OneShotReceiver(envelope),
    producer: new InMemoryQueueRouter(),
    repository,
    idempotencyStore,
    blobProvider: new InMemoryBlobReferenceProvider(),
    documentProvider: new InMemoryDocumentIntelligenceProvider(),
    searchProvider: new InMemorySearchIndexProvider(),
    analysisProvider: provider,
    auditExporter: new NoopExporter(),
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    maxCycles: 1,
    receiveWaitMs: 1,
    maxAttempts: 3,
    idempotencyLeaseDurationSeconds: 60
  });
}

test("ingestion blocked decision persists even when message dead-letters", async () => {
  const repository = new InMemoryWorkloadRepository();
  await seedCaseGraph(repository, "DRAFT");
  await repository.createEvidence({
    tenantId: "tenant-a",
    caseId: "case-a",
    evidenceId: "ev-1",
    sourceId: "src-1",
    sourceVersion: "v1",
    ownerId: "owner-a",
    capturedAtIso: new Date().toISOString(),
    licenceDecisionId: "lic-1",
    purposeId: "DUE_DILIGENCE",
    classification: "CONFIDENTIAL",
    qualityStatus: "APPROVED",
    contentHash: "expected-hash",
    payloadReference: "blob://payload",
    hasSpecialCategoryData: false,
    isExternalData: true,
    admissionStatus: "QUARANTINED"
  });
  const blob = new InMemoryBlobReferenceProvider();
  blob.seed("blob://payload", {
    mediaType: "application/pdf",
    sizeBytes: 100,
    contentHash: "different-hash",
    malwareScanStatus: "CLEAN",
    retentionScheduleId: "RET-001",
    dispositionStatus: "ACTIVE"
  });
  const envelope = new RecordingEnvelope({
    messageId: "msg-1",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_INGESTION",
    queueName: "q-ingestion",
    payloadReference: "blob://payload",
    idempotencyKey: "idem-1",
    correlationId: "corr-1",
    evidenceId: "ev-1"
  });
  const runtime = new WorkerRuntime({
    queueName: "q-ingestion",
    receiver: new OneShotReceiver(envelope),
    producer: new InMemoryQueueRouter(),
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    blobProvider: blob,
    documentProvider: new InMemoryDocumentIntelligenceProvider(),
    searchProvider: new InMemorySearchIndexProvider(),
    analysisProvider: new InMemoryAnalysisProvider(),
    auditExporter: new NoopExporter(),
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    maxCycles: 1,
    receiveWaitMs: 1,
    maxAttempts: 1,
    idempotencyLeaseDurationSeconds: 60
  });

  await runtime.run();

  const latestObject = await repository.getLatestEvidenceObject("tenant-a", "case-a", "ev-1");
  assert.ok(latestObject);
  assert.equal(latestObject?.contentHash, "different-hash");
  assert.equal(envelope.action, "deadLetter");
  assert.equal(repository.listAuditEvents("tenant-a", "case-a").some((event) => event.action === "INGESTION_BLOCKED"), true);
});

test("ingestion replay after crash before queue finalization does not duplicate version/decision/audit", async () => {
  const repository = new CrashOnFirstMarkRepository();
  await seedCaseGraph(repository, "DRAFT");
  await repository.createEvidence({
    tenantId: "tenant-a",
    caseId: "case-a",
    evidenceId: "ev-crash",
    sourceId: "src-1",
    sourceVersion: "v1",
    ownerId: "owner-a",
    capturedAtIso: new Date().toISOString(),
    licenceDecisionId: "lic-1",
    purposeId: "DUE_DILIGENCE",
    classification: "CONFIDENTIAL",
    qualityStatus: "APPROVED",
    contentHash: "expected-hash",
    payloadReference: "blob://payload-crash",
    hasSpecialCategoryData: false,
    isExternalData: true,
    admissionStatus: "QUARANTINED"
  });
  const blob = new InMemoryBlobReferenceProvider();
  blob.seed("blob://payload-crash", {
    mediaType: "application/pdf",
    sizeBytes: 100,
    contentHash: "different-hash",
    malwareScanStatus: "CLEAN",
    retentionScheduleId: "RET-001",
    dispositionStatus: "ACTIVE"
  });
  const idempotencyStore = new InMemoryIdempotencyStore();
  const firstEnvelope = new RecordingEnvelope({
    messageId: "msg-crash-ingestion",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_INGESTION",
    queueName: "q-ingestion",
    payloadReference: "blob://payload-crash",
    idempotencyKey: "idem-crash-ingestion",
    correlationId: "corr-crash-ingestion",
    evidenceId: "ev-crash",
    deliveryCount: 1
  });
  const firstRuntime = new WorkerRuntime({
    queueName: "q-ingestion",
    receiver: new OneShotReceiver(firstEnvelope),
    producer: new InMemoryQueueRouter(),
    repository,
    idempotencyStore,
    blobProvider: blob,
    documentProvider: new InMemoryDocumentIntelligenceProvider(),
    searchProvider: new InMemorySearchIndexProvider(),
    analysisProvider: new InMemoryAnalysisProvider(),
    auditExporter: new NoopExporter(),
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    maxCycles: 1,
    receiveWaitMs: 1,
    maxAttempts: 3,
    idempotencyLeaseDurationSeconds: 0
  });
  await assert.rejects(() => firstRuntime.run(), /CRASH_BEFORE_QUEUE_FINALIZATION/);

  const secondEnvelope = new RecordingEnvelope({
    messageId: "msg-crash-ingestion",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_INGESTION",
    queueName: "q-ingestion",
    payloadReference: "blob://payload-crash",
    idempotencyKey: "idem-crash-ingestion",
    correlationId: "corr-crash-ingestion",
    evidenceId: "ev-crash",
    deliveryCount: 2
  });
  const secondRuntime = new WorkerRuntime({
    queueName: "q-ingestion",
    receiver: new OneShotReceiver(secondEnvelope),
    producer: new InMemoryQueueRouter(),
    repository,
    idempotencyStore,
    blobProvider: blob,
    documentProvider: new InMemoryDocumentIntelligenceProvider(),
    searchProvider: new InMemorySearchIndexProvider(),
    analysisProvider: new InMemoryAnalysisProvider(),
    auditExporter: new NoopExporter(),
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    maxCycles: 1,
    receiveWaitMs: 1,
    maxAttempts: 3,
    idempotencyLeaseDurationSeconds: 0
  });
  await secondRuntime.run();

  const stableVersionId = createHash("sha256")
    .update("tenant-a:case-a:msg-crash-ingestion:ev-crash:blob://payload-crash:INGESTION_EVIDENCE_VERSION")
    .digest("hex")
    .slice(0, 32);
  const evidenceObjects = (repository as unknown as { evidenceObjects: Map<string, Array<{ evidenceVersionId: string }>> })
    .evidenceObjects;
  const admissions = (repository as unknown as { admissions: Map<string, Array<{ admissionDecisionId: string }>> }).admissions;
  const evidenceValues = evidenceObjects.get("tenant-a:case-a:ev-crash") ?? [];
  const admissionValues = admissions.get("tenant-a:case-a:ev-crash") ?? [];
  assert.equal(evidenceValues.length, 1);
  assert.equal(evidenceValues[0]?.evidenceVersionId, stableVersionId);
  assert.equal(admissionValues.length, 1);
  assert.equal(
    repository.listAuditEvents("tenant-a", "case-a").filter((event) => event.action === "INGESTION_BLOCKED").length,
    1
  );
  assert.equal(secondEnvelope.action, "deadLetter");
});

test("analysis blocked state persists after handler failure result", async () => {
  const repository = new InMemoryWorkloadRepository();
  await seedCaseGraph(repository, "EVIDENCE_ADMITTED");
  await repository.createEvidence({
    tenantId: "tenant-a",
    caseId: "case-a",
    evidenceId: "ev-1",
    sourceId: "src-1",
    sourceVersion: "v1",
    ownerId: "owner-a",
    capturedAtIso: new Date().toISOString(),
    licenceDecisionId: "lic-1",
    purposeId: "DUE_DILIGENCE",
    classification: "CONFIDENTIAL",
    qualityStatus: "APPROVED",
    contentHash: "hash-1",
    payloadReference: "blob://payload",
    hasSpecialCategoryData: false,
    isExternalData: true,
    admissionStatus: "QUARANTINED"
  });
  await repository.createAnalysisRun({
    tenantId: "tenant-a",
    caseId: "case-a",
    analysisRunId: "run-1",
    evidenceId: "ev-1",
    evidenceVersionId: "ev-v1",
    modelDeploymentId: "model-a",
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    promptTemplateVersion: "p1",
    policyVersion: "release-1",
    inputManifestHash: "imh",
    status: "QUEUED",
    outputKind: "DRAFT_ONLY",
    unsupportedClaims: 0
  });

  const envelope = new RecordingEnvelope({
    messageId: "msg-analysis",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_ANALYSIS",
    queueName: "q-analysis",
    payloadReference: "blob://payload",
    idempotencyKey: "idem-analysis",
    correlationId: "corr-analysis",
    evidenceId: "ev-1",
    analysisRunId: "run-1"
  });

  const runtime = new WorkerRuntime({
    queueName: "q-analysis",
    receiver: new OneShotReceiver(envelope),
    producer: new InMemoryQueueRouter(),
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    blobProvider: new InMemoryBlobReferenceProvider(),
    documentProvider: new InMemoryDocumentIntelligenceProvider(),
    searchProvider: new InMemorySearchIndexProvider(),
    analysisProvider: new InMemoryAnalysisProvider(),
    auditExporter: new NoopExporter(),
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    maxCycles: 1,
    receiveWaitMs: 1,
    maxAttempts: 1,
    idempotencyLeaseDurationSeconds: 60
  });

  await runtime.run();

  const run = await repository.getAnalysisRun("tenant-a", "case-a", "run-1");
  assert.equal(run?.status, "BLOCKED_MISSING_EVIDENCE");
  assert.equal(envelope.action, "deadLetter");
  assert.equal(repository.listAuditEvents("tenant-a", "case-a").some((event) => event.action === "ANALYSIS_BLOCKED"), true);
});

test("analysis execution rechecks current source and licence authority before provider invocation", async (t) => {
  const cases = [
    {
      name: "source becomes suspended",
      expectedReason: "ANALYSIS_AUTHORITY_SOURCE_NOT_ACTIVE",
      drift: async (repository: MissingLatestLicenceRepository) => {
        const source = await repository.getSource("tenant-a", "case-a", "src-1");
        assert.ok(source);
        await repository.upsertSource({ ...source, status: "SUSPENDED" });
      }
    },
    {
      name: "latest licence is missing",
      expectedReason: "ANALYSIS_AUTHORITY_LICENCE_MISSING",
      drift: async (repository: MissingLatestLicenceRepository) => {
        repository.licenceMissing = true;
      }
    },
    {
      name: "latest licence is expired",
      expectedReason: "ANALYSIS_AUTHORITY_LICENCE_EXPIRED",
      drift: async (repository: MissingLatestLicenceRepository) => {
        await repository.appendExternalLicenceDecision({
          tenantId: "tenant-a",
          caseId: "case-a",
          sourceId: "src-1",
          licenceDecisionId: "lic-expired",
          licenceEvidenceId: "lic-evidence-expired",
          aiRetrievalAllowed: true,
          aiAnalysisAllowed: true,
          purposeId: "DUE_DILIGENCE",
          purposeApproved: true,
          privacyApproved: true,
          licenceCompatible: true,
          expiresAtIso: "2000-01-01T00:00:00.000Z",
          lawfulBasis: "contract",
          approvedBy: "legal-a"
        });
      }
    },
    {
      name: "latest licence disallows AI analysis",
      expectedReason: "ANALYSIS_AUTHORITY_AI_ANALYSIS_NOT_ALLOWED",
      drift: async (repository: MissingLatestLicenceRepository) => {
        await repository.appendExternalLicenceDecision({
          tenantId: "tenant-a",
          caseId: "case-a",
          sourceId: "src-1",
          licenceDecisionId: "lic-analysis-denied",
          licenceEvidenceId: "lic-evidence-analysis-denied",
          aiRetrievalAllowed: true,
          aiAnalysisAllowed: false,
          purposeId: "DUE_DILIGENCE",
          purposeApproved: true,
          privacyApproved: true,
          licenceCompatible: true,
          expiresAtIso: "2999-01-01T00:00:00.000Z",
          lawfulBasis: "contract",
          approvedBy: "legal-a"
        });
      }
    }
  ] as const;

  for (const scenario of cases) {
    await t.test(scenario.name, async () => {
      const repository = new MissingLatestLicenceRepository();
      await seedQueuedAnalysis(repository);
      await scenario.drift(repository);
      const idempotencyStore = new InMemoryIdempotencyStore();
      const provider = new RecordingAnalysisProvider();

      const firstEnvelope = analysisEnvelope(1);
      await analysisRuntime(repository, idempotencyStore, provider, firstEnvelope).run();
      const secondEnvelope = analysisEnvelope(2);
      await analysisRuntime(repository, idempotencyStore, provider, secondEnvelope).run();

      const run = await repository.getAnalysisRun("tenant-a", "case-a", "run-authority");
      const caseRecord = await repository.getCase("tenant-a", "case-a");
      const authorityAudits = repository
        .listAuditEvents("tenant-a", "case-a")
        .filter(
          (event) =>
            event.action === "ANALYSIS_BLOCKED" &&
            event.payloadReference === `[REDACTED]:${scenario.expectedReason}`
        );
      assert.equal(provider.invocations, 0);
      assert.equal(run?.status, "BLOCKED_MISSING_EVIDENCE");
      assert.equal(run?.blockedReason, scenario.expectedReason);
      assert.equal(caseRecord?.status, "EVIDENCE_ADMITTED");
      assert.equal(firstEnvelope.action, "deadLetter");
      assert.equal(firstEnvelope.reason, "WORK_ITEM_FAILED");
      assert.equal(secondEnvelope.action, "deadLetter");
      assert.equal(secondEnvelope.reason, "WORK_ITEM_FAILED");
      assert.equal(authorityAudits.length, 1);
      assert.equal(
        repository
          .listAuditEvents("tenant-a", "case-a")
          .some((event) => event.action === "ANALYSIS_DRAFT_STORED"),
        false
      );
    });
  }
});

test("extraction completion enqueues indexing deterministically", async () => {
  const repository = new InMemoryWorkloadRepository();
  await seedCaseGraph(repository, "EVIDENCE_ADMITTED");
  await repository.createEvidence({
    tenantId: "tenant-a",
    caseId: "case-a",
    evidenceId: "ev-1",
    sourceId: "src-1",
    sourceVersion: "v1",
    ownerId: "owner-a",
    capturedAtIso: new Date().toISOString(),
    licenceDecisionId: "lic-1",
    purposeId: "DUE_DILIGENCE",
    classification: "CONFIDENTIAL",
    qualityStatus: "APPROVED",
    contentHash: "hash-1",
    payloadReference: "blob://payload",
    hasSpecialCategoryData: false,
    isExternalData: true,
    admissionStatus: "ADMITTED"
  });
  await repository.createEvidenceObject({
    tenantId: "tenant-a",
    caseId: "case-a",
    evidenceVersionId: "ev-v1",
    evidenceId: "ev-1",
    blobUriReference: "blob://payload",
    contentHash: "hash-1",
    mediaType: "application/pdf",
    sizeBytes: 100,
    malwareScanStatus: "CLEAN",
    retentionScheduleId: "RET-001",
    dispositionStatus: "ACTIVE"
  });

  const producer = new InMemoryQueueRouter();
  const document = new InMemoryDocumentIntelligenceProvider();
  document.seed("blob://payload", [
    {
      tenantId: "tenant-a",
      caseId: "case-a",
      analysisRunId: "unused",
      claimId: "claim-1",
      claimTextReference: "claim line",
      severity: "NON_CRITICAL",
      reviewStatus: "PENDING",
      isMaterial: true
    }
  ]);

  const runtime = new WorkerRuntime({
    queueName: "q-extraction",
    receiver: new OneShotReceiver(
      new RecordingEnvelope({
        messageId: "msg-extract",
        tenantId: "tenant-a",
        caseId: "case-a",
        operation: "REQUEST_EXTRACTION",
        queueName: "q-extraction",
        payloadReference: "blob://payload",
        idempotencyKey: "idem-extract",
        correlationId: "corr-extract",
        evidenceId: "ev-1",
        evidenceVersionId: "ev-v1"
      })
    ),
    producer,
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    blobProvider: new InMemoryBlobReferenceProvider(),
    documentProvider: document,
    searchProvider: new InMemorySearchIndexProvider(),
    analysisProvider: new InMemoryAnalysisProvider(),
    auditExporter: new NoopExporter(),
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    maxCycles: 1,
    receiveWaitMs: 1,
    maxAttempts: 1,
    idempotencyLeaseDurationSeconds: 60
  });

  await runtime.run();

  const indexedMessageEnvelope = await producer.forQueue("q-indexing").receiveOne(1);
  assert.ok(indexedMessageEnvelope);
  assert.equal(indexedMessageEnvelope?.message.operation, "REQUEST_INDEXING");
  const chunks = await repository.listExtractionChunks("tenant-a", "case-a", "ev-1", "ev-v1");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0]?.indexed, false);
});

test("indexing provider fail-closed does not mark chunks indexed or completed", async () => {
  const repository = new InMemoryWorkloadRepository();
  await seedCaseGraph(repository, "EVIDENCE_ADMITTED");
  await repository.createEvidence({
    tenantId: "tenant-a",
    caseId: "case-a",
    evidenceId: "ev-1",
    sourceId: "src-1",
    sourceVersion: "v1",
    ownerId: "owner-a",
    capturedAtIso: new Date().toISOString(),
    licenceDecisionId: "lic-1",
    purposeId: "DUE_DILIGENCE",
    classification: "CONFIDENTIAL",
    qualityStatus: "APPROVED",
    contentHash: "hash-1",
    payloadReference: "blob://payload",
    hasSpecialCategoryData: false,
    isExternalData: true,
    admissionStatus: "ADMITTED"
  });
  await repository.createEvidenceObject({
    tenantId: "tenant-a",
    caseId: "case-a",
    evidenceVersionId: "ev-v1",
    evidenceId: "ev-1",
    blobUriReference: "blob://payload",
    contentHash: "hash-1",
    mediaType: "application/pdf",
    sizeBytes: 100,
    malwareScanStatus: "CLEAN",
    retentionScheduleId: "RET-001",
    dispositionStatus: "ACTIVE"
  });
  await repository.replaceExtractionChunks("tenant-a", "case-a", "ev-1", "ev-v1", [
    {
      tenantId: "tenant-a",
      caseId: "case-a",
      evidenceId: "ev-1",
      evidenceVersionId: "ev-v1",
      chunkId: "chunk-1",
      text: "claim text",
      classification: "CONFIDENTIAL",
      qualityStatus: "APPROVED",
      policyVersion: "release-1",
      citationLocator: "page:1",
      indexed: false
    }
  ]);
  const envelope = new RecordingEnvelope({
    messageId: "msg-index",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_INDEXING",
    queueName: "q-indexing",
    payloadReference: "blob://payload",
    idempotencyKey: "idem-index",
    correlationId: "corr-index",
    evidenceId: "ev-1",
    evidenceVersionId: "ev-v1"
  });

  const runtime = new WorkerRuntime({
    queueName: "q-indexing",
    receiver: new OneShotReceiver(envelope),
    producer: new InMemoryQueueRouter(),
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    blobProvider: new InMemoryBlobReferenceProvider(),
    documentProvider: new InMemoryDocumentIntelligenceProvider(),
    searchProvider: new AzureSearchIndexProvider("https://search.example", "stratton"),
    analysisProvider: new InMemoryAnalysisProvider(),
    auditExporter: new NoopExporter(),
    modelProviderEvidenceId: "model",
    regionalDeploymentEvidenceId: "region",
    promptGovernanceEvidenceId: "prompt",
    maxCycles: 1,
    receiveWaitMs: 1,
    maxAttempts: 1,
    idempotencyLeaseDurationSeconds: 60
  });

  await runtime.run();

  const chunks = await repository.listExtractionChunks("tenant-a", "case-a", "ev-1", "ev-v1");
  assert.equal(chunks[0]?.indexed, false);
  assert.equal(
    repository.listAuditEvents("tenant-a", "case-a").some((event) => event.action === "INDEXING_COMPLETED"),
    false
  );
  assert.equal(envelope.action, "deadLetter");
});

class FakeSqlExecutor implements SqlExecutor {
  public committedStatements: string[] = [];
  public transactionStarts = 0;
  private stagedStatements: string[] | undefined;

  public async queryOne<TRecord extends Record<string, unknown>>(): Promise<TRecord | undefined> {
    return undefined;
  }

  public async queryMany<TRecord extends Record<string, unknown>>(): Promise<readonly TRecord[]> {
    return [];
  }

  public async execute(
    statement: string,
    _parameters: Readonly<Record<string, SqlPrimitive>>,
    _options?: SqlExecutionOptions
  ): Promise<SqlCommandResult> {
    if (this.stagedStatements) {
      this.stagedStatements.push(statement);
    } else {
      this.committedStatements.push(statement);
    }
    return { rowsAffected: 1 };
  }

  public async runInTransaction<TValue>(
    context: { tenantId: string; caseId?: string; allowTenantScopedLookup?: boolean },
    callback: (executor: SqlExecutor) => Promise<TValue>
  ): Promise<TValue> {
    void context;
    if (this.stagedStatements) {
      return callback(this);
    }
    this.transactionStarts += 1;
    this.stagedStatements = [];
    try {
      const value = await callback(this);
      this.committedStatements.push(...this.stagedStatements);
      return value;
    } finally {
      this.stagedStatements = undefined;
    }
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async close(): Promise<void> {
    return;
  }
}

test("queue completion finalization and idempotency share one transaction scope", async () => {
  const executor = new FakeSqlExecutor();
  const repository = new SqlWorkloadRepository(executor);
  const idempotency = new SqlIdempotencyStore(executor);
  await assert.rejects(
    repository.withCaseTransaction("tenant-a", "case-a", async (scopedRepository) => {
      const scopedIdempotency = scopedRepository.bindIdempotencyStore?.(idempotency) ?? idempotency;
      await scopedRepository.markWorkItemStatus("tenant-a", "case-a", "work-1", "PROCESSED", 1);
      await scopedIdempotency.complete(
        {
          scopedKey: "scope-1",
          tenantId: "tenant-a",
          caseId: "case-a",
          subjectId: "worker",
          operationId: "REQUEST_ANALYSIS",
          fingerprint: "fp",
          claimId: "claim-1"
        },
        200,
        "{}"
      );
      throw new Error("ROLLBACK");
    }),
    /ROLLBACK/
  );
  assert.equal(executor.transactionStarts, 1);
  assert.equal(executor.committedStatements.length, 0);
});

test("queue consumer retries transient error and dead-letters exhausted attempts", async () => {
  const repository = new InMemoryWorkloadRepository();
  const consumer = new QueueConsumer(
    repository,
    new InMemoryIdempotencyStore(),
    {
      REQUEST_INDEXING: async () => {
        const error = new Error("timed out");
        throw error;
      }
    },
    { maxAttempts: 1, leaseDurationSeconds: 30 }
  );
  const result = await consumer.process({
    messageId: "m",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_INDEXING",
    queueName: "q-indexing",
    payloadReference: "blob://payload",
    idempotencyKey: "idem",
    correlationId: "corr",
    deliveryCount: 1
  });
  assert.equal(result.action, "deadLetter");
});
