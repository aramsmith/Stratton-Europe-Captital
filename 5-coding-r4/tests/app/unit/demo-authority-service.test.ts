import assert from "node:assert/strict";
import { test } from "node:test";
import { createDemoAuthorityService } from "../../../app/src/demo-authority-service.js";
import type { AuthenticatedPrincipal, WorkItemRecord } from "../../../app/src/types.js";
import { InMemoryWorkloadRepository } from "../../../app/src/workload-repository.js";

const human: AuthenticatedPrincipal = {
  tenantId: "tenant-a",
  subjectId: "contributor-a",
  roles: ["DealContributor", "DealReviewer", "LegalApprover", "ComplianceApprover", "CaseReader"],
  identityProvider: "https://login.microsoftonline.com/tenant-a/v2.0",
  authType: "aad",
  isHuman: true
};

const completionApp: AuthenticatedPrincipal = {
  tenantId: "tenant-a",
  subjectId: "demo-bff-service",
  roles: [],
  identityProvider: "https://login.microsoftonline.com/tenant-a/v2.0",
  authType: "aad",
  isHuman: false,
  applicationId: "demo-bff"
};

async function seedReadyBundle(repository: InMemoryWorkloadRepository): Promise<void> {
  repository.seedApprovedEligibility("tenant-a", "case-1", "DEAL", "deal-ok");
  repository.seedApprovedEligibility("tenant-a", "case-1", "JURISDICTION", "jurisdiction-ok");
  await repository.createCase({
    tenantId: "tenant-a",
    caseId: "case-1",
    jurisdiction: "EU",
    purpose: "DUE_DILIGENCE",
    status: "ANALYSIS_DRAFT_READY",
    createdBy: "initiator-a",
    openedAtIso: "2026-08-09T00:00:00.000Z",
    dealEligibilityDecisionId: "deal-ok",
    jurisdictionEligibilityDecisionId: "jurisdiction-ok",
    rolloutSequence: 1
  });
  await repository.grantCaseAccess({
    tenantId: "tenant-a",
    caseId: "case-1",
    subjectId: human.subjectId,
    purpose: "DUE_DILIGENCE",
    role: "DealContributor"
  });
  await repository.upsertSource({
    tenantId: "tenant-a",
    caseId: "case-1",
    sourceId: "source-1",
    ownerId: "owner-a",
    domain: "registry",
    authoritativeStatus: "VERIFIED",
    authoritativeSystem: "system-a",
    interfaceType: "READ_ONLY_API",
    permissionEvidenceId: "permission-1",
    connectorEvidenceId: "connector-1",
    jurisdiction: "EU",
    sourceVersion: "v1",
    status: "ACTIVE"
  });
  await repository.appendExternalLicenceDecision({
    tenantId: "tenant-a",
    caseId: "case-1",
    sourceId: "source-1",
    licenceDecisionId: "licence-1",
    licenceEvidenceId: "licence-evidence-1",
    aiRetrievalAllowed: true,
    aiAnalysisAllowed: true,
    purposeId: "DUE_DILIGENCE",
    purposeApproved: true,
    privacyApproved: true,
    licenceCompatible: true,
    expiresAtIso: "2027-01-01T00:00:00.000Z",
    lawfulBasis: "contract",
    approvedBy: "legal-a"
  });
  await repository.createEvidence({
    tenantId: "tenant-a",
    caseId: "case-1",
    evidenceId: "ev-1",
    sourceId: "source-1",
    sourceVersion: "v1",
    ownerId: "owner-a",
    capturedAtIso: "2026-08-09T00:00:00.000Z",
    licenceDecisionId: "licence-1",
    purposeId: "DUE_DILIGENCE",
    classification: "CONFIDENTIAL",
    qualityStatus: "APPROVED",
    contentHash: "content-hash-1",
    payloadReference: "blob://evidence/1",
    hasSpecialCategoryData: false,
    isExternalData: true,
    admissionStatus: "ADMITTED"
  });
  await repository.createEvidenceObject({
    tenantId: "tenant-a",
    caseId: "case-1",
    evidenceVersionId: "ev-1-v1",
    evidenceId: "ev-1",
    blobUriReference: "blob://evidence/1",
    contentHash: "content-hash-1",
    mediaType: "application/pdf",
    sizeBytes: 1,
    malwareScanStatus: "CLEAN",
    retentionScheduleId: "retention-1",
    dispositionStatus: "ACTIVE"
  });
  for (const operation of ["REQUEST_EXTRACTION", "REQUEST_INDEXING"] as const) {
    const workItem: WorkItemRecord = {
      tenantId: "tenant-a",
      caseId: "case-1",
      workItemId: `${operation}-1`,
      queueName: operation === "REQUEST_EXTRACTION" ? "q-extraction" : "q-indexing",
      operation,
      workType: operation,
      messageId: `${operation}-1`,
      idempotencyKey: `${operation}-1`,
      attempt: 1,
      status: "PROCESSED",
      payloadReference: "blob://evidence/1",
      correlationId: "seed",
      queuedAtIso: "2026-08-09T00:00:00.000Z"
    };
    await repository.appendWorkItem(workItem);
  }
  await repository.replaceExtractionChunks("tenant-a", "case-1", "ev-1", "ev-1-v1", [
    {
      tenantId: "tenant-a",
      caseId: "case-1",
      evidenceId: "ev-1",
      evidenceVersionId: "ev-1-v1",
      chunkId: "chunk-1",
      text: "admitted evidence",
      classification: "CONFIDENTIAL",
      qualityStatus: "APPROVED",
      policyVersion: "release-1",
      citationLocator: "page:1",
      indexed: true
    }
  ]);
  await repository.createAnalysisRun({
    tenantId: "tenant-a",
    caseId: "case-1",
    analysisRunId: "bundle-1",
    evidenceId: "ev-1",
    evidenceVersionId: "ev-1-v1",
    modelDeploymentId: "terra-prod-eu",
    modelProviderEvidenceId: "model-evidence",
    regionalDeploymentEvidenceId: "region-evidence",
    promptGovernanceEvidenceId: "prompt-evidence",
    promptTemplateVersion: "phase5-template-v1",
    policyVersion: "release-1",
    inputManifestHash: "input-manifest",
    status: "IN_PROGRESS",
    outputKind: "DRAFT_ONLY",
    unsupportedClaims: 0
  });
  await repository.upsertClaims([
    {
      tenantId: "tenant-a",
      caseId: "case-1",
      claimId: "claim-1",
      analysisRunId: "bundle-1",
      claimTextReference: "supported material claim",
      severity: "NON_CRITICAL",
      reviewStatus: "CITED",
      isMaterial: true
    }
  ]);
  await repository.replaceCitations("tenant-a", "case-1", "bundle-1", [
    {
      tenantId: "tenant-a",
      caseId: "case-1",
      citationId: "citation-1",
      claimId: "claim-1",
      evidenceId: "ev-1",
      evidenceVersionId: "ev-1-v1",
      locator: "page:1",
      accessibleAtReview: true
    }
  ]);
}

test("authority lifecycle creates a deterministic bundle and only completes it for the configured BFF", async () => {
  const repository = new InMemoryWorkloadRepository({
    approvedModelRouteEvidence: [
      {
        evidenceId: "route-evidence-1",
        status: "APPROVED",
        resourceId: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/aoai",
        deploymentId: "terra-prod-eu",
        region: "westeurope",
        route: "TERRA",
        apiVersion: "2026-01-01",
        evidenceVersion: "route-evidence-1:v1",
        validFromIso: "2026-08-01T00:00:00.000Z",
        validUntilIso: "2026-12-31T23:59:59.000Z"
      }
    ]
  });
  await seedReadyBundle(repository);
  const service = createDemoAuthorityService({ repository, completionClientId: "demo-bff" });

  const created = await service.createBundle(human, {
    tenantId: "tenant-a",
    caseId: "case-1",
    analysisBundleId: "bundle-1",
    evidenceManifestHash: "untrusted-client-value",
    modelRoute: "TERRA",
    modelDeploymentId: "terra-prod-eu",
    routeEvidenceId: "route-evidence-1",
    promptTemplateVersion: "phase5-template-v1",
    requestFingerprint: "request-1",
    evidenceIds: ["ev-1", "ev-1"]
  });

  assert.deepEqual(created.evidence, [{ evidenceId: "ev-1", evidenceVersionId: "ev-1-v1", ordinal: 1 }]);
  assert.equal(created.status, "QUEUED");
  assert.match(created.evidenceManifestHash, /^[a-f0-9]{64}$/);

  const subjectVersion = await repository.buildEvidenceManifestHash("tenant-a", "case-1", "bundle-1");
  await assert.rejects(
    service.completeBundle({ ...completionApp, applicationId: "other-app" }, {
      tenantId: "tenant-a",
      caseId: "case-1",
      analysisBundleId: "bundle-1",
      subjectVersion,
      status: "DRAFT_ONLY_READY",
      unsupportedClaims: 0
    }),
    /POLICY_DENIED/
  );
  const completed = await service.completeBundle(completionApp, {
    tenantId: "tenant-a",
    caseId: "case-1",
    analysisBundleId: "bundle-1",
    subjectVersion,
    status: "DRAFT_ONLY_READY",
    unsupportedClaims: 0
  });
  assert.deepEqual(
    {
      analysisBundleId: completed.analysisBundleId,
      status: completed.status,
      outputKind: completed.outputKind,
      subjectVersion: completed.subjectVersion
    },
    {
      analysisBundleId: "bundle-1",
      status: "DRAFT_ONLY_READY",
      outputKind: "DRAFT_ONLY",
      subjectVersion
    }
  );

  for (const reviewType of ["DEAL", "LEGAL", "COMPLIANCE"] as const) {
    await service.submitReview(human, {
      tenantId: "tenant-a",
      caseId: "case-1",
      analysisBundleId: "bundle-1",
      reviewId: `review-${reviewType.toLowerCase()}`,
      subjectVersion,
      reviewType,
      decision: "APPROVED",
      rationale: "Evidence and citations are sufficient.",
      evidenceManifestHash: created.evidenceManifestHash
    });
  }
  assert.deepEqual(
    await service.prepareDraft(human, {
      tenantId: "tenant-a",
      caseId: "case-1",
      analysisBundleId: "bundle-1",
      subjectVersion
    }),
    {
      caseId: "case-1",
      analysisBundleId: "bundle-1",
      status: "DRAFT_RECOMMENDATION_READY",
      outputKind: "DRAFT_ONLY",
      citationCounts: { totalClaims: 1, citedClaims: 1, unsupportedClaims: 0 }
    }
  );
});
