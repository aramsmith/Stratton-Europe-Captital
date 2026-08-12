import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiServer } from "../../../app/src/api-runtime.js";
import { InMemoryIdempotencyStore } from "../../../app/src/idempotency-store.js";
import { StructuredLogger } from "../../../app/src/logger.js";
import { InMemoryQueueRouter } from "../../../app/src/queue-adapters.js";
import { QueueOutboxDispatcher } from "../../../app/src/queue-outbox-dispatcher.js";
import type { IdempotencyStore, QueueMessage, QueueProducer } from "../../../app/src/types.js";
import { InMemoryWorkloadRepository } from "../../../app/src/workload-repository.js";

const modelRouteDeployments = {
  LUNA: {
    deploymentId: "luna-primary",
    residencyEvidenceId: "luna-residency-evidence",
    modelName: "gpt-5.6-luna",
    modelVersion: "2026-07-09",
    validationStatus: "VALIDATED"
  },
  TERRA: {
    deploymentId: "terra-primary",
    residencyEvidenceId: "terra-residency-evidence",
    modelName: "gpt-5.6-terra",
    modelVersion: "2026-07-09",
    validationStatus: "VALIDATED"
  },
  SOL: {
    deploymentId: "sol-primary",
    residencyEvidenceId: "sol-residency-evidence",
    modelName: "gpt-5.6-sol",
    modelVersion: "2026-07-09",
    validationStatus: "VALIDATED"
  }
} as const;

function principalHeader(tenantId: string, subjectId: string, roles: readonly string[], opts?: {
  issuer?: string;
  authType?: string;
  idtyp?: string;
  appid?: string;
}): string {
  const claims = [
    { typ: "tid", val: tenantId },
    { typ: "oid", val: subjectId },
    { typ: "iss", val: opts?.issuer ?? `https://login.microsoftonline.com/${tenantId}/v2.0` },
    ...roles.map((role) => ({ typ: "roles", val: role }))
  ];
  claims.push({ typ: "idtyp", val: opts?.idtyp ?? "user" });
  if (opts?.appid) {
    claims.push({ typ: "appid", val: opts.appid });
  }
  const payload = {
    auth_typ: opts?.authType ?? "aad",
    role_typ: "roles",
    claims
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

async function startServer(options?: {
  analysisCapabilityEnabled?: boolean;
  auditExportCapabilityEnabled?: boolean;
  repository?: InMemoryWorkloadRepository;
  queueProducer?: QueueProducer;
  idempotencyStore?: IdempotencyStore;
}) {
  const repository = options?.repository ?? new InMemoryWorkloadRepository();
  const queue = options?.queueProducer ?? new InMemoryQueueRouter();
  const idempotencyStore = options?.idempotencyStore ?? new InMemoryIdempotencyStore();
  const logger = new StructuredLogger("test");
  const { server } = createApiServer({
    repository,
    idempotencyStore,
    queueProducer: queue,
    logger,
    requestBodyLimitBytes: 32_768,
    modelProviderEvidenceId: "model-evidence",
    promptGovernanceEvidenceId: "prompt-evidence",
    modelRoutingPolicyVersion: "stratton-model-routing-v1",
    modelRouteDeployments,
    idempotencyLeaseDurationSeconds: 120,
    analysisCapabilityEnabled: options?.analysisCapabilityEnabled ?? true,
    auditExportCapabilityEnabled: options?.auditExportCapabilityEnabled ?? true
  });
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("FAILED_TO_BIND");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    server,
    repository,
    queueProducer: queue
  };
}

async function manifestHashFor(
  repository: InMemoryWorkloadRepository,
  tenantId: string,
  caseId: string,
  analysisRunId: string
): Promise<string> {
  return repository.buildEvidenceManifestHash(tenantId, caseId, analysisRunId);
}

async function post(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  identity: {
    tenantId: string;
    subjectId: string;
    roles: readonly string[];
    idempotencyKey?: string;
    issuer?: string;
    authType?: string;
    idtyp?: string;
    appid?: string;
  }
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ms-client-principal": principalHeader(identity.tenantId, identity.subjectId, identity.roles, identity),
      ...(identity.idempotencyKey ? { "idempotency-key": identity.idempotencyKey } : {})
    },
    body: JSON.stringify(body)
  });
}

async function seedCase(repository: InMemoryWorkloadRepository): Promise<void> {
  repository.seedApprovedEligibility("tenant-a", "case-1", "DEAL", "deal-ok");
  repository.seedApprovedEligibility("tenant-a", "case-1", "JURISDICTION", "jur-ok");
  await repository.createCase({
    tenantId: "tenant-a",
    caseId: "case-1",
    jurisdiction: "EU",
    purpose: "DUE_DILIGENCE",
    status: "ANALYSIS_DRAFT_READY",
    createdBy: "initiator-a",
    openedAtIso: new Date().toISOString(),
    dealEligibilityDecisionId: "deal-ok",
    jurisdictionEligibilityDecisionId: "jur-ok",
    rolloutSequence: 1
  });
  for (const assignment of [
    { subjectId: "initiator-a", role: "DealInitiator" },
    { subjectId: "reader-a", role: "CaseReader" },
    { subjectId: "steward-a", role: "DataSteward" },
    { subjectId: "reviewer-a", role: "DealReviewer" },
    { subjectId: "legal-a", role: "LegalApprover" },
    { subjectId: "compliance-a", role: "ComplianceApprover" },
    { subjectId: "contrib-a", role: "DealContributor" },
    { subjectId: "validator-a", role: "ValidationProducer" }
  ]) {
    await repository.grantCaseAccess({
      tenantId: "tenant-a",
      caseId: "case-1",
      subjectId: assignment.subjectId,
      purpose: "DUE_DILIGENCE",
      role: assignment.role
    });
  }
  await repository.upsertSource({
    tenantId: "tenant-a",
    caseId: "case-1",
    sourceId: "src-1",
    ownerId: "owner-1",
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
    caseId: "case-1",
    sourceId: "src-1",
    licenceDecisionId: "lic-1",
    licenceEvidenceId: "lic-ev-1",
    aiRetrievalAllowed: true,
    aiAnalysisAllowed: true,
    purposeId: "DUE_DILIGENCE",
    purposeApproved: true,
    privacyApproved: true,
    licenceCompatible: true,
    expiresAtIso: new Date(Date.now() + 86_400_000).toISOString(),
    lawfulBasis: "contract",
    approvedBy: "legal-a"
  });
  await repository.createEvidence({
    tenantId: "tenant-a",
    caseId: "case-1",
    evidenceId: "ev-1",
    sourceId: "src-1",
    sourceVersion: "v1",
    ownerId: "owner-1",
    capturedAtIso: new Date().toISOString(),
    licenceDecisionId: "lic-1",
    purposeId: "DUE_DILIGENCE",
    classification: "CONFIDENTIAL",
    qualityStatus: "APPROVED",
    contentHash: "hash-1",
    payloadReference: "blob://evidence/1",
    hasSpecialCategoryData: false,
    isExternalData: true,
    admissionStatus: "ADMITTED"
  });
  await repository.createEvidenceObject({
    tenantId: "tenant-a",
    caseId: "case-1",
    evidenceVersionId: "ev-v1",
    evidenceId: "ev-1",
    blobUriReference: "blob://evidence/1",
    contentHash: "hash-1",
    mediaType: "application/pdf",
    sizeBytes: 100,
    malwareScanStatus: "CLEAN",
    retentionScheduleId: "ret-1",
    dispositionStatus: "ACTIVE"
  });
  await repository.createAnalysisRun({
    tenantId: "tenant-a",
    caseId: "case-1",
    analysisRunId: "run-1",
    evidenceId: "ev-1",
    evidenceVersionId: "ev-v1",
    modelDeploymentId: "model-a",
    modelProviderEvidenceId: "model-evidence",
    promptGovernanceEvidenceId: "prompt-evidence",
    modelTaskClass: "GROUNDED_ANALYSIS",
    modelTier: "TERRA",
    modelRouteReason: "BASE_ROUTE",
    modelReasoningEffort: "medium",
    modelRoutingPolicyVersion: "stratton-model-routing-v1",
    deploymentResidencyEvidenceId: "terra-residency-evidence",
    modelName: "gpt-5.6-terra",
    modelVersion: "2026-07-09",
    modelValidationStatus: "NOT_RUN",
    promptTemplateVersion: "p1",
    policyVersion: "release-1",
    inputManifestHash: "manifest-v1",
    status: "QUEUED",
    outputKind: "DRAFT_ONLY",
    unsupportedClaims: 0
  });
  await repository.upsertClaims([
    {
      tenantId: "tenant-a",
      caseId: "case-1",
      claimId: "claim-1",
      analysisRunId: "run-1",
      claimTextReference: "claim text",
      severity: "NON_CRITICAL",
      reviewStatus: "PENDING",
      isMaterial: true
    }
  ]);
  await repository.replaceCitations("tenant-a", "case-1", "run-1", [
    {
      tenantId: "tenant-a",
      caseId: "case-1",
      citationId: "cit-1",
      claimId: "claim-1",
      evidenceId: "ev-1",
      evidenceVersionId: "ev-v1",
      locator: "page:1",
      accessibleAtReview: true
    }
  ]);
  const manifest = await repository.buildEvidenceManifestHash("tenant-a", "case-1", "run-1");
  await repository.updateAnalysisRunStatus(
    "tenant-a",
    "case-1",
    "run-1",
    "DRAFT_ONLY_READY",
    0,
    "draft://run-1",
    undefined,
    manifest
  );
}

async function makeAnalysisEvidenceReady(repository: InMemoryWorkloadRepository): Promise<void> {
  await repository.updateCaseStatus("tenant-a", "case-1", "EVIDENCE_ADMITTED");
  await repository.replaceExtractionChunks("tenant-a", "case-1", "ev-1", "ev-v1", [
    {
      tenantId: "tenant-a",
      caseId: "case-1",
      evidenceId: "ev-1",
      evidenceVersionId: "ev-v1",
      chunkId: "ev-v1:chunk-1",
      text: "material claim text",
      classification: "CONFIDENTIAL",
      qualityStatus: "VERIFIED",
      policyVersion: "release-1",
      citationLocator: "page:1",
      indexed: false
    }
  ]);
  await repository.markExtractionChunksIndexed("tenant-a", "case-1", "ev-1", "ev-v1");
  await repository.appendWorkItem({
    tenantId: "tenant-a",
    caseId: "case-1",
    workItemId: "w-extract",
    queueName: "q-extraction",
    operation: "REQUEST_EXTRACTION",
    workType: "REQUEST_EXTRACTION",
    messageId: "w-extract",
    idempotencyKey: "i-extract",
    attempt: 1,
    status: "PROCESSED",
    payloadReference: "blob://evidence/1",
    correlationId: "corr-extract",
    queuedAtIso: new Date().toISOString(),
    evidenceId: "ev-1",
    evidenceVersionId: "ev-v1"
  });
  await repository.appendWorkItem({
    tenantId: "tenant-a",
    caseId: "case-1",
    workItemId: "w-index",
    queueName: "q-indexing",
    operation: "REQUEST_INDEXING",
    workType: "REQUEST_INDEXING",
    messageId: "w-index",
    idempotencyKey: "i-index",
    attempt: 1,
    status: "PROCESSED",
    payloadReference: "blob://evidence/1",
    correlationId: "corr-index",
    queuedAtIso: new Date().toISOString(),
    evidenceId: "ev-1",
    evidenceVersionId: "ev-v1"
  });
}

test("createCase enforces idempotency fingerprint", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    repository.seedApprovedEligibility("tenant-a", "case-2", "DEAL", "deal-ok");
    repository.seedApprovedEligibility("tenant-a", "case-2", "JURISDICTION", "jur-ok");
    const first = await post(
      baseUrl,
      "/v1/cases",
      {
        tenantId: "tenant-a",
        caseId: "case-2",
        purpose: "DUE_DILIGENCE",
        jurisdiction: "EU",
        dealEligibilityDecisionId: "deal-ok",
        jurisdictionEligibilityDecisionId: "jur-ok",
        rolloutSequence: 1
      },
      { tenantId: "tenant-a", subjectId: "initiator-a", roles: ["DealInitiator"], idempotencyKey: "idem-1" }
    );
    assert.equal(first.status, 201);
    const conflict = await post(
      baseUrl,
      "/v1/cases",
      {
        tenantId: "tenant-a",
        caseId: "case-2",
        purpose: "OTHER_PURPOSE",
        jurisdiction: "EU",
        dealEligibilityDecisionId: "deal-ok",
        jurisdictionEligibilityDecisionId: "jur-ok",
        rolloutSequence: 1
      },
      { tenantId: "tenant-a", subjectId: "initiator-a", roles: ["DealInitiator"], idempotencyKey: "idem-1" }
    );
    assert.equal(conflict.status, 409);
  } finally {
    server.close();
  }
});

test("strict enum validation rejects unknown review values", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    const response = await post(
      baseUrl,
      "/v1/cases/case-1/reviews",
      {
        caseId: "case-1",
        analysisRunId: "run-1",
        subjectVersion: "manifest-v1",
        reviewType: "DEAL",
        decision: "ALLOW",
        rationale: "invalid enum"
      },
      { tenantId: "tenant-a", subjectId: "reviewer-a", roles: ["DealReviewer"], idempotencyKey: "review-1" }
    );
    assert.equal(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.equal(body.code, "INVALID_CONTRACT");
  } finally {
    server.close();
  }
});

test("strict enum validation rejects unknown source interface type", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    const response = await post(
      baseUrl,
      "/v1/cases/case-1/sources",
      {
        sourceId: "src-2",
        ownerId: "owner-2",
        domain: "registry",
        authoritativeStatus: "VERIFIED",
        authoritativeSystem: "system-b",
        interfaceType: "STREAMING",
        permissionEvidenceId: "perm-2",
        connectorEvidenceId: "connector-2",
        jurisdiction: "EU",
        sourceVersion: "v1"
      },
      { tenantId: "tenant-a", subjectId: "initiator-a", roles: ["SourceOwner"], idempotencyKey: "src-2" }
    );
    assert.equal(response.status, 400);
    const body = (await response.json()) as { code: string };
    assert.equal(body.code, "INVALID_CONTRACT");
  } finally {
    server.close();
  }
});

test("COMPLIANCE review requires ComplianceApprover", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    const response = await post(
      baseUrl,
      "/v1/cases/case-1/reviews",
      {
        caseId: "case-1",
        analysisRunId: "run-1",
        subjectVersion: "manifest-v1",
        reviewType: "COMPLIANCE",
        decision: "APPROVED",
        rationale: "nope"
      },
      { tenantId: "tenant-a", subjectId: "reviewer-a", roles: ["DealReviewer"], idempotencyKey: "review-2" }
    );
    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

test("review flow accepts three approvals for same immutable version and draft prepares", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    const version = await manifestHashFor(repository, "tenant-a", "case-1", "run-1");
    const deal = await post(
      baseUrl,
      "/v1/cases/case-1/reviews",
      {
        caseId: "case-1",
        analysisRunId: "run-1",
        subjectVersion: version,
        reviewType: "DEAL",
        decision: "APPROVED",
        rationale: "deal approved"
      },
      { tenantId: "tenant-a", subjectId: "reviewer-a", roles: ["DealReviewer"], idempotencyKey: "review-deal" }
    );
    assert.equal(deal.status, 201);
    const legal = await post(
      baseUrl,
      "/v1/cases/case-1/reviews",
      {
        caseId: "case-1",
        analysisRunId: "run-1",
        subjectVersion: version,
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "legal approved"
      },
      { tenantId: "tenant-a", subjectId: "legal-a", roles: ["LegalApprover"], idempotencyKey: "review-legal" }
    );
    assert.equal(legal.status, 201);
    const compliance = await post(
      baseUrl,
      "/v1/cases/case-1/reviews",
      {
        caseId: "case-1",
        analysisRunId: "run-1",
        subjectVersion: version,
        reviewType: "COMPLIANCE",
        decision: "APPROVED",
        rationale: "compliance approved"
      },
      { tenantId: "tenant-a", subjectId: "compliance-a", roles: ["ComplianceApprover"], idempotencyKey: "review-compliance" }
    );
    assert.equal(compliance.status, 201);
    const state = await repository.getCase("tenant-a", "case-1");
    assert.equal(state?.status, "SPECIALIST_REVIEW_PENDING");
    const draft = await post(
      baseUrl,
      "/v1/cases/case-1/draft-recommendations",
      {
        caseId: "case-1",
        analysisRunId: "run-1",
        subjectVersion: version
      },
      { tenantId: "tenant-a", subjectId: "reviewer-a", roles: ["DealReviewer"], idempotencyKey: "draft-1" }
    );
    assert.equal(draft.status, 200);
  } finally {
    server.close();
  }
});

test("human-only review decisions reject workload principals", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    const response = await post(
      baseUrl,
      "/v1/cases/case-1/reviews",
      {
        caseId: "case-1",
        analysisRunId: "run-1",
        subjectVersion: "manifest-v1",
        reviewType: "DEAL",
        decision: "APPROVED",
        rationale: "service principal should not review"
      },
      {
        tenantId: "tenant-a",
        subjectId: "sp-a",
        roles: ["DealReviewer"],
        idempotencyKey: "review-sp",
        idtyp: "app",
        appid: "app-id"
      }
    );
    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

test("admitEvidence is DataSteward-only and legal role is denied", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    const denied = await post(
      baseUrl,
      "/v1/evidence/ev-1/admission",
      { caseId: "case-1" },
      { tenantId: "tenant-a", subjectId: "legal-a", roles: ["LegalApprover"], idempotencyKey: "admit-1" }
    );
    assert.equal(denied.status, 403);
  } finally {
    server.close();
  }
});

test("ingestion denies special-category data before persist when source is active", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    await repository.updateCaseStatus("tenant-a", "case-1", "DRAFT");
    const denied = await post(
      baseUrl,
      "/v1/cases/case-1/ingestions",
      {
        caseId: "case-1",
        evidenceId: "ev-2",
        sourceId: "src-1",
        sourceVersion: "v1",
        classification: "CONFIDENTIAL",
        qualityStatus: "APPROVED",
        contentHash: "hash-2",
        payloadReference: "blob://evidence/2",
        hasSpecialCategoryData: true
      },
      { tenantId: "tenant-a", subjectId: "contrib-a", roles: ["DealContributor"], idempotencyKey: "ingest-1" }
    );
    assert.equal(denied.status, 403);
    const persisted = await repository.getEvidence("tenant-a", "case-1", "ev-2");
    assert.equal(persisted, undefined);
  } finally {
    server.close();
  }
});

test("expired external licence denies analysis", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    await repository.updateCaseStatus("tenant-a", "case-1", "EVIDENCE_ADMITTED");
    await repository.appendExternalLicenceDecision({
      tenantId: "tenant-a",
      caseId: "case-1",
      sourceId: "src-1",
      licenceDecisionId: "lic-expired",
      licenceEvidenceId: "lic-ev-expired",
      aiRetrievalAllowed: true,
      aiAnalysisAllowed: true,
      purposeId: "DUE_DILIGENCE",
      purposeApproved: true,
      privacyApproved: true,
      licenceCompatible: true,
      expiresAtIso: new Date(Date.now() - 1_000).toISOString(),
      lawfulBasis: "contract",
      approvedBy: "legal-a"
    });
    const response = await post(
      baseUrl,
      "/v1/cases/case-1/analysis-runs",
      {
        caseId: "case-1",
        evidenceId: "ev-1",
        taskClass: "GROUNDED_ANALYSIS",
        promptTemplateVersion: "p1"
      },
      { tenantId: "tenant-a", subjectId: "contrib-a", roles: ["DealContributor"], idempotencyKey: "analysis-expired" }
    );
    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

test("getAnalysisStatus resolves case by run and enforces access", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    const allowed = await fetch(`${baseUrl}/v1/analysis-runs/run-1`, {
      headers: { "x-ms-client-principal": principalHeader("tenant-a", "reader-a", ["CaseReader"]) }
    });
    assert.equal(allowed.status, 200);
    const denied = await fetch(`${baseUrl}/v1/analysis-runs/run-1`, {
      headers: { "x-ms-client-principal": principalHeader("tenant-a", "other-reader", ["CaseReader"]) }
    });
    assert.equal(denied.status, 403);
    const otherTenant = await fetch(`${baseUrl}/v1/analysis-runs/run-1`, {
      headers: { "x-ms-client-principal": principalHeader("tenant-b", "reader-b", ["CaseReader"]) }
    });
    assert.equal(otherTenant.status, 409);
  } finally {
    server.close();
  }
});

test("analysis request requires extraction and indexing completion", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    await repository.updateCaseStatus("tenant-a", "case-1", "EVIDENCE_ADMITTED");
    const blocked = await post(
      baseUrl,
      "/v1/cases/case-1/analysis-runs",
      {
        caseId: "case-1",
        evidenceId: "ev-1",
        taskClass: "GROUNDED_ANALYSIS",
        promptTemplateVersion: "p1"
      },
      { tenantId: "tenant-a", subjectId: "contrib-a", roles: ["DealContributor"], idempotencyKey: "analysis-1" }
    );
    assert.equal(blocked.status, 422);
    await makeAnalysisEvidenceReady(repository);
    const accepted = await post(
      baseUrl,
      "/v1/cases/case-1/analysis-runs",
      {
        caseId: "case-1",
        evidenceId: "ev-1",
        taskClass: "GROUNDED_ANALYSIS",
        promptTemplateVersion: "p1"
      },
      { tenantId: "tenant-a", subjectId: "contrib-a", roles: ["DealContributor"], idempotencyKey: "analysis-2" }
    );
    assert.equal(accepted.status, 202);
  } finally {
    server.close();
  }
});

test("analysis requests persist the application-selected deterministic route", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    await makeAnalysisEvidenceReady(repository);
    const response = await post(
      baseUrl,
      "/v1/cases/case-1/analysis-runs",
      {
        caseId: "case-1",
        evidenceId: "ev-1",
        taskClass: "EVIDENCE_TRIAGE",
        promptTemplateVersion: "p1"
      },
      { tenantId: "tenant-a", subjectId: "contrib-a", roles: ["DealContributor"], idempotencyKey: "route-owned" }
    );
    assert.equal(response.status, 202);
    const body = (await response.json()) as { analysisRunId: string };
    const run = await repository.getAnalysisRun("tenant-a", "case-1", body.analysisRunId);
    assert.ok(run);
    assert.equal(run.modelDeploymentId, "luna-primary");
    assert.equal(run.modelTaskClass, "EVIDENCE_TRIAGE");
    assert.equal(run.modelTier, "LUNA");
    assert.equal(run.modelRouteReason, "BASE_ROUTE");
    assert.equal(run.modelReasoningEffort, "low");
    assert.equal(run.modelRoutingPolicyVersion, "stratton-model-routing-v1");
    assert.equal(run.deploymentResidencyEvidenceId, "luna-residency-evidence");
    assert.equal(run.modelName, "gpt-5.6-luna");
    assert.equal(run.modelVersion, "2026-07-09");
    assert.equal(run.modelValidationStatus, "NOT_RUN");
    assert.equal(run.modelLatencyMilliseconds, undefined);
    assert.equal(run.modelInputTokens, undefined);
    assert.equal(run.modelOutputTokens, undefined);
    assert.equal(run.modelObservedCostUsd, undefined);
  } finally {
    server.close();
  }
});

test("analysis requests reject every caller-selected deployment or model field as INVALID_CONTRACT", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    await makeAnalysisEvidenceReady(repository);
    for (const selector of [
      "modelDeploymentId",
      "deploymentId",
      "modelId",
      "modelName",
      "model"
    ] as const) {
      const response = await post(
        baseUrl,
        "/v1/cases/case-1/analysis-runs",
        {
          caseId: "case-1",
          evidenceId: "ev-1",
          taskClass: "EVIDENCE_TRIAGE",
          promptTemplateVersion: "p1",
          [selector]: "caller-selected"
        },
        {
          tenantId: "tenant-a",
          subjectId: "contrib-a",
          roles: ["DealContributor"],
          idempotencyKey: `route-selector-${selector}`
        }
      );
      assert.equal(response.status, 400, selector);
      assert.equal((await response.json() as { code: string }).code, "INVALID_CONTRACT", selector);
    }
  } finally {
    server.close();
  }
});

test("DealContributor has no escalation authority", async () => {
  for (const escalationReason of [
    "VALIDATION_FAILURE",
    "LOW_CONFIDENCE",
    "CONFLICTING_MATERIAL_EVIDENCE",
    "HIGH_RISK_SPECIALIST_CONCLUSION",
    "AUTHORISED_HUMAN_REQUEST"
  ] as const) {
    const { baseUrl, server, repository } = await startServer();
    try {
      await seedCase(repository);
      await makeAnalysisEvidenceReady(repository);
      const response = await post(
        baseUrl,
        "/v1/cases/case-1/analysis-runs",
        {
          caseId: "case-1",
          evidenceId: "ev-1",
          taskClass: "EVIDENCE_TRIAGE",
          escalationReason,
          promptTemplateVersion: "p1"
        },
        {
          tenantId: "tenant-a",
          subjectId: "contrib-a",
          roles: ["DealContributor"],
          idempotencyKey: `contributor-${escalationReason}`
        }
      );
      assert.equal(response.status, 403, escalationReason);
      assert.equal(
        (await response.json() as { code: string }).code,
        "ESCALATION_AUTHORITY_REQUIRED",
        escalationReason
      );
    } finally {
      server.close();
    }
  }
});

test("ValidationProducer may use validation-derived escalation reasons only", async () => {
  for (const expected of [
    {
      escalationReason: "VALIDATION_FAILURE",
      taskClass: "GROUNDED_ANALYSIS",
      deploymentId: "sol-primary",
      tier: "SOL",
      reasoningEffort: "high"
    },
    {
      escalationReason: "LOW_CONFIDENCE",
      taskClass: "EVIDENCE_TRIAGE",
      deploymentId: "terra-primary",
      tier: "TERRA",
      reasoningEffort: "medium"
    },
    {
      escalationReason: "CONFLICTING_MATERIAL_EVIDENCE",
      taskClass: "EVIDENCE_TRIAGE",
      deploymentId: "sol-primary",
      tier: "SOL",
      reasoningEffort: "high"
    },
    {
      escalationReason: "HIGH_RISK_SPECIALIST_CONCLUSION",
      taskClass: "EVIDENCE_TRIAGE",
      deploymentId: "sol-primary",
      tier: "SOL",
      reasoningEffort: "high"
    }
  ] as const) {
    const { baseUrl, server, repository } = await startServer();
    try {
      await seedCase(repository);
      await makeAnalysisEvidenceReady(repository);
      const response = await post(
        baseUrl,
        "/v1/cases/case-1/analysis-runs",
        {
          caseId: "case-1",
          evidenceId: "ev-1",
          taskClass: expected.taskClass,
          escalationReason: expected.escalationReason,
          promptTemplateVersion: "p1"
        },
        {
          tenantId: "tenant-a",
          subjectId: "validator-a",
          roles: ["ValidationProducer"],
          idempotencyKey: `validation-${expected.escalationReason}`
        }
      );
      assert.equal(response.status, 202, expected.escalationReason);
      const body = (await response.json()) as { analysisRunId: string };
      const run = await repository.getAnalysisRun("tenant-a", "case-1", body.analysisRunId);
      assert.ok(run);
      assert.equal(run.modelDeploymentId, expected.deploymentId, expected.escalationReason);
      assert.equal(run.modelTier, expected.tier, expected.escalationReason);
      assert.equal(run.modelReasoningEffort, expected.reasoningEffort, expected.escalationReason);
      assert.equal(
        run.modelRouteReason,
        `ESCALATION_${expected.escalationReason}`,
        expected.escalationReason
      );
    } finally {
      server.close();
    }
  }

  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    await makeAnalysisEvidenceReady(repository);
    const denied = await post(
      baseUrl,
      "/v1/cases/case-1/analysis-runs",
      {
        caseId: "case-1",
        evidenceId: "ev-1",
        taskClass: "GROUNDED_ANALYSIS",
        escalationReason: "AUTHORISED_HUMAN_REQUEST",
        promptTemplateVersion: "p1"
      },
      {
        tenantId: "tenant-a",
        subjectId: "validator-a",
        roles: ["ValidationProducer"],
        idempotencyKey: "validation-human-request"
      }
    );
    assert.equal(denied.status, 403);
    assert.equal((await denied.json() as { code: string }).code, "ESCALATION_AUTHORITY_REQUIRED");
  } finally {
    server.close();
  }
});

test("human reviewers may request only authorised human escalation and persist selected evidence", async () => {
  for (const reviewer of [
    { subjectId: "reviewer-a", role: "DealReviewer" },
    { subjectId: "legal-a", role: "LegalApprover" },
    { subjectId: "compliance-a", role: "ComplianceApprover" }
  ] as const) {
    const { baseUrl, server, repository } = await startServer();
    try {
      await seedCase(repository);
      await makeAnalysisEvidenceReady(repository);
      const response = await post(
        baseUrl,
        "/v1/cases/case-1/analysis-runs",
        {
          caseId: "case-1",
          evidenceId: "ev-1",
          taskClass: "GROUNDED_ANALYSIS",
          escalationReason: "AUTHORISED_HUMAN_REQUEST",
          promptTemplateVersion: "p1"
        },
        {
          tenantId: "tenant-a",
          subjectId: reviewer.subjectId,
          roles: [reviewer.role],
          idempotencyKey: `human-${reviewer.role}`
        }
      );
      assert.equal(response.status, 202, reviewer.role);
      const body = (await response.json()) as { analysisRunId: string };
      const run = await repository.getAnalysisRun("tenant-a", "case-1", body.analysisRunId);
      assert.ok(run);
      assert.equal(run.modelDeploymentId, "sol-primary", reviewer.role);
      assert.equal(run.modelTier, "SOL", reviewer.role);
      assert.equal(run.modelReasoningEffort, "high", reviewer.role);
      assert.equal(run.modelRouteReason, "ESCALATION_AUTHORISED_HUMAN_REQUEST", reviewer.role);
    } finally {
      server.close();
    }
  }
});

test("human reviewers reject every validation-derived escalation reason", async () => {
  const reviewers = [
    { subjectId: "reviewer-a", role: "DealReviewer" },
    { subjectId: "legal-a", role: "LegalApprover" },
    { subjectId: "compliance-a", role: "ComplianceApprover" }
  ] as const;
  const validationReasons = [
    "VALIDATION_FAILURE",
    "LOW_CONFIDENCE",
    "CONFLICTING_MATERIAL_EVIDENCE",
    "HIGH_RISK_SPECIALIST_CONCLUSION"
  ] as const;

  for (const reviewer of reviewers) {
    for (const escalationReason of validationReasons) {
      const { baseUrl, server, repository } = await startServer();
      try {
        await seedCase(repository);
        await makeAnalysisEvidenceReady(repository);
        const response = await post(
          baseUrl,
          "/v1/cases/case-1/analysis-runs",
          {
            caseId: "case-1",
            evidenceId: "ev-1",
            taskClass: "EVIDENCE_TRIAGE",
            escalationReason,
            promptTemplateVersion: "p1"
          },
          {
            tenantId: "tenant-a",
            subjectId: reviewer.subjectId,
            roles: [reviewer.role],
            idempotencyKey: `reviewer-${reviewer.role}-${escalationReason}`
          }
        );
        assert.equal(response.status, 403, `${reviewer.role}:${escalationReason}`);
        assert.equal(
          (await response.json() as { code: string }).code,
          "ESCALATION_AUTHORITY_REQUIRED",
          `${reviewer.role}:${escalationReason}`
        );
      } finally {
        server.close();
      }
    }
  }
});

test("issuer host validation rejects substring spoofing and malformed auth", async () => {
  const { baseUrl, server } = await startServer();
  try {
    const spoof = await post(
      baseUrl,
      "/v1/cases",
      {},
      {
        tenantId: "tenant-a",
        subjectId: "initiator-a",
        roles: ["DealInitiator"],
        idempotencyKey: "idem-10",
        issuer: "https://evil.example/login.microsoftonline.com/tenant-a/v2.0"
      }
    );
    assert.equal(spoof.status, 401);
    const malformed = await post(
      baseUrl,
      "/v1/cases",
      {},
      {
        tenantId: "tenant-a",
        subjectId: "initiator-a",
        roles: ["DealInitiator"],
        idempotencyKey: "idem-11",
        authType: "federated"
      }
    );
    assert.equal(malformed.status, 401);
    const body = (await malformed.json()) as { message: string };
    assert.equal(body.message.includes("federated"), false);
    const wrongTenantPath = await post(
      baseUrl,
      "/v1/cases",
      {},
      {
        tenantId: "tenant-a",
        subjectId: "initiator-a",
        roles: ["DealInitiator"],
        idempotencyKey: "idem-12",
        issuer: "https://login.microsoftonline.com/tenant-b/v2.0"
      }
    );
    assert.equal(wrongTenantPath.status, 401);
  } finally {
    server.close();
  }
});

test("arbitrary trusted role headers are ignored", async () => {
  const { baseUrl, server } = await startServer();
  try {
    const response = await fetch(`${baseUrl}/v1/cases`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ms-client-principal": principalHeader("tenant-a", "initiator-a", []),
        "idempotency-key": "idem-trusted-role",
        "x-trusted-role": "DealInitiator"
      },
      body: JSON.stringify({
        tenantId: "tenant-a",
        caseId: "case-x",
        purpose: "DUE_DILIGENCE",
        jurisdiction: "EU",
        dealEligibilityDecisionId: "deal-ok",
        jurisdictionEligibilityDecisionId: "jur-ok",
        rolloutSequence: 1
      })
    });
    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

test("workload runtime denies recordVerdict", async () => {
  const { baseUrl, server } = await startServer();
  try {
    const response = await post(
      baseUrl,
      "/assurance/v1/verdicts",
      { validationManifestId: "vm-1" },
      { tenantId: "tenant-a", subjectId: "validator-a", roles: ["InternalAuditValidator"], idempotencyKey: "v1" }
    );
    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

test("requestAnalysis and exportValidationEvidence fail closed when capability is blocked", async () => {
  const { baseUrl, server, repository } = await startServer({
    analysisCapabilityEnabled: false,
    auditExportCapabilityEnabled: false
  });
  try {
    await seedCase(repository);
    await repository.updateCaseStatus("tenant-a", "case-1", "EVIDENCE_ADMITTED");
    const analysis = await post(
      baseUrl,
      "/v1/cases/case-1/analysis-runs",
      {
        caseId: "case-1",
        evidenceId: "ev-1",
        taskClass: "GROUNDED_ANALYSIS",
        promptTemplateVersion: "p1"
      },
      { tenantId: "tenant-a", subjectId: "contrib-a", roles: ["DealContributor"], idempotencyKey: "analysis-blocked" }
    );
    assert.equal(analysis.status, 503);
    const exportResponse = await post(
      baseUrl,
      "/v1/validation-exports",
      {
        caseId: "case-1",
        benchmarkId: "b1",
        inputManifestHash: "imh-1",
        testSuiteId: "suite-1",
        resultSummary: "summary",
        producerEvidenceId: "prod-1"
      },
      { tenantId: "tenant-a", subjectId: "validator-a", roles: ["ValidationProducer"], idempotencyKey: "export-blocked" }
    );
    assert.equal(exportResponse.status, 503);
  } finally {
    server.close();
  }
});

test("missing idtyp claim fails closed on human-only route", async () => {
  const { baseUrl, server, repository } = await startServer();
  try {
    await seedCase(repository);
    const header = Buffer.from(
      JSON.stringify({
        auth_typ: "aad",
        role_typ: "roles",
        claims: [
          { typ: "tid", val: "tenant-a" },
          { typ: "oid", val: "steward-a" },
          { typ: "iss", val: "https://login.microsoftonline.com/tenant-a/v2.0" },
          { typ: "roles", val: "DataSteward" }
        ]
      }),
      "utf8"
    ).toString("base64");
    const response = await fetch(`${baseUrl}/v1/evidence/ev-1/admission`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ms-client-principal": header,
        "idempotency-key": "admit-no-idtyp"
      },
      body: JSON.stringify({ caseId: "case-1" })
    });
    assert.equal(response.status, 403);
  } finally {
    server.close();
  }
});

test("queue-send failure still commits durable state and replays without duplication", async () => {
  class FlakyQueueProducer implements QueueProducer {
    public attempts = 0;
    public readonly sent: QueueMessage[] = [];
    public async send(message: QueueMessage): Promise<void> {
      this.attempts += 1;
      if (this.attempts === 1) {
        throw new Error("QUEUE_SEND_TEMPORARY");
      }
      this.sent.push({ ...message });
    }
    public async isAvailable(): Promise<boolean> {
      return true;
    }
  }

  const repository = new InMemoryWorkloadRepository();
  await seedCase(repository);
  await repository.updateCaseStatus("tenant-a", "case-1", "DRAFT");
  const queueProducer = new FlakyQueueProducer();
  const { baseUrl, server } = await startServer({ repository, queueProducer });
  try {
    const payload = {
      caseId: "case-1",
      evidenceId: "ev-2",
      sourceId: "src-1",
      sourceVersion: "v1",
      classification: "CONFIDENTIAL",
      qualityStatus: "APPROVED",
      contentHash: "hash-2",
      payloadReference: "blob://evidence/2",
      hasSpecialCategoryData: false
    };
    const first = await post(baseUrl, "/v1/cases/case-1/ingestions", payload, {
      tenantId: "tenant-a",
      subjectId: "contrib-a",
      roles: ["DealContributor"],
      idempotencyKey: "ingest-retry-1"
    });
    assert.equal(first.status, 202);

    const second = await post(baseUrl, "/v1/cases/case-1/ingestions", payload, {
      tenantId: "tenant-a",
      subjectId: "contrib-a",
      roles: ["DealContributor"],
      idempotencyKey: "ingest-retry-1"
    });
    assert.equal(second.status, 202);
    assert.equal(queueProducer.sent.length, 0);
    const evidence = await repository.getEvidence("tenant-a", "case-1", "ev-2");
    assert.ok(evidence);
    const workItemCount = (repository as unknown as { workItems: Map<string, unknown> }).workItems?.size ?? 0;
    assert.equal(workItemCount, 1);
    const outbox = (repository as unknown as { queueOutbox: Map<string, { attempts: number }> }).queueOutbox;
    assert.equal(outbox?.size ?? 0, 1);
    const only = outbox ? [...outbox.values()][0] : undefined;
    assert.equal(only?.attempts, 1);
  } finally {
    server.close();
  }
});

test("failed idempotency completion rolls back and retry emits only one message", async () => {
  class PassthroughQueueProducer implements QueueProducer {
    public readonly sent: QueueMessage[] = [];
    public async send(message: QueueMessage): Promise<void> {
      this.sent.push({ ...message });
    }
    public async isAvailable(): Promise<boolean> {
      return true;
    }
  }

  class FlakyCompleteStore extends InMemoryIdempotencyStore {
    private failedOnce = false;
    public async complete(
      input: Parameters<IdempotencyStore["complete"]>[0],
      responseCode: number,
      responseBody: string
    ): Promise<void> {
      if (!this.failedOnce) {
        this.failedOnce = true;
        throw new Error("IDEMPOTENCY_COMPLETE_TEMP_FAIL");
      }
      await super.complete(input, responseCode, responseBody);
    }
  }

  const repository = new InMemoryWorkloadRepository();
  await seedCase(repository);
  await repository.updateCaseStatus("tenant-a", "case-1", "DRAFT");
  const queueProducer = new PassthroughQueueProducer();
  const idempotencyStore = new FlakyCompleteStore();
  const { baseUrl, server } = await startServer({ repository, queueProducer, idempotencyStore });
  try {
    const payload = {
      caseId: "case-1",
      evidenceId: "ev-3",
      sourceId: "src-1",
      sourceVersion: "v1",
      classification: "CONFIDENTIAL",
      qualityStatus: "APPROVED",
      contentHash: "hash-3",
      payloadReference: "blob://evidence/3",
      hasSpecialCategoryData: false
    };
    const first = await post(baseUrl, "/v1/cases/case-1/ingestions", payload, {
      tenantId: "tenant-a",
      subjectId: "contrib-a",
      roles: ["DealContributor"],
      idempotencyKey: "ingest-retry-2"
    });
    assert.equal(first.status, 503);
    const second = await post(baseUrl, "/v1/cases/case-1/ingestions", payload, {
      tenantId: "tenant-a",
      subjectId: "contrib-a",
      roles: ["DealContributor"],
      idempotencyKey: "ingest-retry-2"
    });
    assert.equal(second.status, 202);
    assert.equal(queueProducer.sent.length, 1);
    const workItemCount = (repository as unknown as { workItems: Map<string, unknown> }).workItems?.size ?? 0;
    assert.equal(workItemCount, 1);
  } finally {
    server.close();
  }
});

test("durable outbox dispatch recovers pending message without client retry", async () => {
  class ToggleQueueProducer implements QueueProducer {
    public fail = true;
    public readonly sent: QueueMessage[] = [];
    public async send(message: QueueMessage): Promise<void> {
      if (this.fail) {
        throw new Error("timeout");
      }
      this.sent.push({ ...message });
    }
    public async isAvailable(): Promise<boolean> {
      return true;
    }
  }

  const repository = new InMemoryWorkloadRepository();
  await seedCase(repository);
  await repository.updateCaseStatus("tenant-a", "case-1", "DRAFT");
  const queueProducer = new ToggleQueueProducer();
  const { baseUrl, server } = await startServer({ repository, queueProducer });
  try {
    const response = await post(
      baseUrl,
      "/v1/cases/case-1/ingestions",
      {
        caseId: "case-1",
        evidenceId: "ev-4",
        sourceId: "src-1",
        sourceVersion: "v1",
        classification: "CONFIDENTIAL",
        qualityStatus: "APPROVED",
        contentHash: "hash-4",
        payloadReference: "blob://evidence/4",
        hasSpecialCategoryData: false
      },
      {
        tenantId: "tenant-a",
        subjectId: "contrib-a",
        roles: ["DealContributor"],
        idempotencyKey: "ingest-retry-4"
      }
    );
    assert.equal(response.status, 202);
    assert.equal(queueProducer.sent.length, 0);
    queueProducer.fail = false;
    const dispatcher = new QueueOutboxDispatcher(repository, queueProducer);
    const outbox = (repository as unknown as {
      queueOutbox: Map<string, { queueName: "q-ingestion"; messageId: string; status: string }>;
    }).queueOutbox;
    const outboxRow = outbox ? [...outbox.values()][0] : undefined;
    assert.ok(outboxRow);
    await repository.markQueueOutboxMessageFailed(
      "tenant-a",
      "case-1",
      outboxRow.queueName,
      outboxRow.messageId,
      new Date(Date.now() - 1_000).toISOString(),
      "timeout"
    );
    await dispatcher.dispatchPending(10, "tenant-a", "case-1");
    assert.equal(queueProducer.sent.length, 1);
    assert.equal([...outbox.values()][0]?.status, "DELIVERED");
  } finally {
    server.close();
  }
});
