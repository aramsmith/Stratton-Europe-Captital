import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  AnalysisBundleCompletionRecord,
  AnalysisBundleEvidenceRecord,
  AnalysisBundleRecord,
  AnalysisBundleReviewRecord,
  ApprovedModelRouteEvidence
} from "../../../app/src/demo-authority-types.js";
import { InMemoryWorkloadRepository } from "../../../app/src/workload-repository.js";

const bundle: AnalysisBundleRecord = {
  tenantId: "tenant-a",
  caseId: "project-danube",
  analysisBundleId: "bundle-1",
  evidenceManifestHash: "sha256:manifest-1",
  modelRoute: "TERRA",
  modelDeploymentId: "terra-prod-eu",
  routeEvidenceId: "route-evidence-1",
  promptTemplateVersion: "phase5-template-v1",
  requestFingerprint: "fingerprint-1",
  status: "QUEUED",
  outputKind: "DRAFT_ONLY",
  unsupportedClaims: 0
};

const firstEvidence: AnalysisBundleEvidenceRecord = {
  tenantId: "tenant-a",
  caseId: "project-danube",
  analysisBundleId: "bundle-1",
  evidenceId: "evidence-a",
  evidenceVersionId: "evidence-a-v1",
  ordinal: 1
};

const secondEvidence: AnalysisBundleEvidenceRecord = {
  tenantId: "tenant-a",
  caseId: "project-danube",
  analysisBundleId: "bundle-1",
  evidenceId: "evidence-b",
  evidenceVersionId: "evidence-b-v3",
  ordinal: 2
};

const completion: AnalysisBundleCompletionRecord = {
  tenantId: "tenant-a",
  caseId: "project-danube",
  analysisBundleId: "bundle-1",
  subjectVersion: "bundle-1:v1",
  status: "DRAFT_ONLY_READY",
  unsupportedClaims: 2
};

test("analysis bundle repository stores an immutable ordered evidence manifest", async () => {
  const repository = new InMemoryWorkloadRepository();
  await repository.createAnalysisBundle(bundle);
  await repository.appendAnalysisBundleEvidence(firstEvidence);
  await repository.appendAnalysisBundleEvidence(secondEvidence);

  assert.deepEqual(
    await repository.listAnalysisBundleEvidence("tenant-a", "project-danube", "bundle-1"),
    [firstEvidence, secondEvidence]
  );

  await assert.rejects(
    repository.appendAnalysisBundleEvidence({ ...secondEvidence, evidenceVersionId: "different-version" }),
    /ANALYSIS_BUNDLE_EVIDENCE_CONFLICT/
  );
});

test("analysis bundle repository rejects conflicting completion replay", async () => {
  const repository = new InMemoryWorkloadRepository();
  await repository.createAnalysisBundle(bundle);
  await repository.completeAnalysisBundle(completion);
  await repository.completeAnalysisBundle(completion);

  await assert.rejects(
    repository.completeAnalysisBundle({ ...completion, subjectVersion: "different" }),
    /ANALYSIS_BUNDLE_COMPLETION_CONFLICT/
  );
  assert.deepEqual(await repository.getAnalysisBundle("tenant-a", "project-danube", "bundle-1"), {
    ...bundle,
    status: "DRAFT_ONLY_READY",
    unsupportedClaims: 2,
    subjectVersion: "bundle-1:v1"
  });
});

test("analysis bundle repository appends bundle reviews idempotently", async () => {
  const repository = new InMemoryWorkloadRepository();
  await repository.createAnalysisBundle(bundle);
  const review: AnalysisBundleReviewRecord = {
    tenantId: "tenant-a",
    caseId: "project-danube",
    analysisBundleId: "bundle-1",
    reviewId: "review-1",
    subjectVersion: "bundle-1:v1",
    reviewType: "LEGAL",
    decision: "APPROVED",
    rationale: "Route authority and citations are sufficient.",
    reviewerObjectId: "reviewer-1",
    evidenceManifestHash: "sha256:manifest-1"
  };

  await repository.appendAnalysisBundleReview(review);
  await repository.appendAnalysisBundleReview(review);

  assert.deepEqual(await repository.listAnalysisBundleReviews("tenant-a", "project-danube", "bundle-1"), [review]);
  await assert.rejects(
    repository.appendAnalysisBundleReview({ ...review, decision: "REJECTED" }),
    /ANALYSIS_BUNDLE_REVIEW_CONFLICT/
  );
});

test("analysis bundle repository returns approved model route evidence", async () => {
  const routeEvidence: ApprovedModelRouteEvidence = {
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
  };
  const repository = new InMemoryWorkloadRepository({ approvedModelRouteEvidence: [routeEvidence] });

  assert.deepEqual(await repository.getApprovedModelRouteEvidence("route-evidence-1"), routeEvidence);
});
