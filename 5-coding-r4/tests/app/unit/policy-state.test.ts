import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateTransitionPolicy, evaluateRolloutAdmission } from "../../../app/src/policy-service.js";
import { transitionCaseState } from "../../../app/src/state-machine.js";
import type { TransitionPolicyEvidence } from "../../../app/src/types.js";

function baseEvidence(): TransitionPolicyEvidence {
  return {
    actorRole: "DealContributor",
    isHuman: true,
    approvedDeal: true,
    approvedJurisdiction: true,
    sourceActive: true,
    permissionScopeAllowed: true,
    purposeOfUseAllowed: true,
    privacyLawfulBasisPresent: true,
    externalDataLicencePresent: true,
    externalDataLicenceCompatible: true,
    aiRetrievalAllowed: true,
    aiAnalysisAllowed: true,
    specialCategoryDataPresent: false,
    confidenceCoverageSufficient: true,
    allMaterialClaimsCited: true,
    criticalUnsupportedClaimCount: 0,
    evidenceAdmitted: true,
    modelProviderEvidencePresent: true,
    modelRegionEvidencePresent: true,
    promptGovernanceEvidencePresent: true,
    humanSpecialistReviewComplete: true
  };
}

test("policy denies missing evidence instead of success defaults", () => {
  const denied = evaluateTransitionPolicy({
    tenantId: "tenant",
    caseId: "case",
    currentStatus: "EVIDENCE_QUARANTINED",
    event: "PROMOTE_EVIDENCE",
    evidence: {
      ...baseEvidence(),
      externalDataLicencePresent: false
    }
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.denialReasons.includes("EXTERNAL_LICENCE_MISSING"), true);
});

test("policy denies special category data in release 1", () => {
  const denied = evaluateTransitionPolicy({
    tenantId: "tenant",
    caseId: "case",
    currentStatus: "DRAFT",
    event: "REQUEST_INGESTION",
    evidence: { ...baseEvidence(), specialCategoryDataPresent: true }
  });
  assert.equal(denied.allowed, false);
  assert.equal(denied.denialReasons.includes("SPECIAL_CATEGORY_DATA_NOT_ALLOWED"), true);
});

test("state machine excludes final approval states", () => {
  const state = transitionCaseState({
    tenantId: "tenant",
    caseId: "case",
    currentStatus: "SPECIALIST_REVIEW_PENDING",
    event: "MARK_DRAFT_READY",
    evidence: baseEvidence()
  });
  assert.equal(state.allowed, true);
  assert.equal(state.nextStatus, "DRAFT_RECOMMENDATION_READY");
});

test("state machine permits additional evidence admission", () => {
  const state = transitionCaseState({
    tenantId: "tenant",
    caseId: "case",
    currentStatus: "EVIDENCE_ADMITTED",
    event: "PROMOTE_EVIDENCE",
    evidence: baseEvidence()
  });
  assert.equal(state.allowed, true);
  assert.equal(state.nextStatus, "EVIDENCE_ADMITTED");
});

test("state machine blocks unsupported transitions", () => {
  const state = transitionCaseState({
    tenantId: "tenant",
    caseId: "case",
    currentStatus: "DRAFT_RECOMMENDATION_READY",
    event: "REQUEST_ANALYSIS",
    evidence: baseEvidence()
  });
  assert.equal(state.allowed, false);
  assert.equal(state.denialReasons.includes("INVALID_TRANSITION"), true);
});

test("rollout admission hard limit is 20", () => {
  assert.equal(evaluateRolloutAdmission(19).allowed, true);
  assert.equal(evaluateRolloutAdmission(20).allowed, false);
});
