import { createHash } from "node:crypto";
import type { PolicyEvaluation, TransitionContext } from "./types.js";

export const ROLLOUT_ADMISSION_MAX = 20;

function deny(...reasons: string[]): PolicyEvaluation {
  return {
    allowed: false,
    denialReasons: [...new Set(reasons)]
  };
}

function allow(): PolicyEvaluation {
  return {
    allowed: true,
    denialReasons: []
  };
}

export function evaluateTransitionPolicy(context: TransitionContext): PolicyEvaluation {
  const evidence = context.evidence;
  const reasons: string[] = [];

  if (!evidence.approvedDeal || !evidence.approvedJurisdiction) {
    reasons.push("ELIGIBILITY_NOT_APPROVED");
  }

  if (context.event !== "STORE_ANALYSIS_DRAFT" && !evidence.isHuman) {
    reasons.push("HUMAN_ACTOR_REQUIRED");
  }

  if (evidence.specialCategoryDataPresent) {
    reasons.push("SPECIAL_CATEGORY_DATA_NOT_ALLOWED");
  }

  switch (context.event) {
    case "CREATE_CASE":
      break;
    case "REQUEST_INGESTION":
      if (!evidence.sourceActive) {
        reasons.push("SOURCE_NOT_ACTIVE");
      }
      if (!evidence.permissionScopeAllowed) {
        reasons.push("PERMISSION_SCOPE_DENIED");
      }
      if (!evidence.purposeOfUseAllowed) {
        reasons.push("PURPOSE_OF_USE_DENIED");
      }
      if (!evidence.aiRetrievalAllowed) {
        reasons.push("AI_RETRIEVAL_NOT_ALLOWED");
      }
      break;
    case "PROMOTE_EVIDENCE":
      if (!evidence.sourceActive) {
        reasons.push("SOURCE_NOT_ACTIVE");
      }
      if (!evidence.externalDataLicencePresent) {
        reasons.push("EXTERNAL_LICENCE_MISSING");
      }
      if (!evidence.externalDataLicenceCompatible) {
        reasons.push("EXTERNAL_LICENCE_INCOMPATIBLE");
      }
      if (!evidence.permissionScopeAllowed) {
        reasons.push("PERMISSION_SCOPE_DENIED");
      }
      if (!evidence.purposeOfUseAllowed) {
        reasons.push("PURPOSE_OF_USE_DENIED");
      }
      if (!evidence.privacyLawfulBasisPresent) {
        reasons.push("PRIVACY_LAWFUL_BASIS_MISSING");
      }
      break;
    case "REQUEST_ANALYSIS":
      if (!evidence.sourceActive) {
        reasons.push("SOURCE_NOT_ACTIVE");
      }
      if (!evidence.evidenceAdmitted) {
        reasons.push("EVIDENCE_NOT_ADMITTED");
      }
      if (!evidence.aiAnalysisAllowed) {
        reasons.push("AI_ANALYSIS_NOT_ALLOWED");
      }
      if (!evidence.confidenceCoverageSufficient) {
        reasons.push("CONFIDENCE_COVERAGE_INSUFFICIENT");
      }
      if (!evidence.modelProviderEvidencePresent) {
        reasons.push("MODEL_PROVIDER_EVIDENCE_MISSING");
      }
      if (!evidence.modelRegionEvidencePresent) {
        reasons.push("MODEL_REGION_EVIDENCE_MISSING");
      }
      if (!evidence.promptGovernanceEvidencePresent) {
        reasons.push("PROMPT_GOVERNANCE_EVIDENCE_MISSING");
      }
      break;
    case "STORE_ANALYSIS_DRAFT":
      if (evidence.criticalUnsupportedClaimCount > 0) {
        reasons.push("CRITICAL_UNSUPPORTED_CLAIM_PRESENT");
      }
      if (!evidence.allMaterialClaimsCited) {
        reasons.push("MATERIAL_CITATION_GAP");
      }
      break;
    case "REQUEST_SPECIALIST_REVIEW":
      if (!evidence.allMaterialClaimsCited) {
        reasons.push("MATERIAL_CITATION_GAP");
      }
      break;
    case "MARK_DRAFT_READY":
      if (!evidence.humanSpecialistReviewComplete) {
        reasons.push("SPECIALIST_REVIEW_INCOMPLETE");
      }
      if (!evidence.allMaterialClaimsCited) {
        reasons.push("MATERIAL_CITATION_GAP");
      }
      break;
    default:
      reasons.push("INVALID_EVENT");
  }

  return reasons.length === 0 ? allow() : deny(...reasons);
}

export function evaluateRolloutAdmission(currentCaseCount: number): PolicyEvaluation {
  if (currentCaseCount >= ROLLOUT_ADMISSION_MAX) {
    return deny("ROLLOUT_LIMIT_REACHED");
  }
  return allow();
}

export function policyInputHash(input: TransitionContext): string {
  const value = JSON.stringify({
    tenantId: input.tenantId,
    caseId: input.caseId,
    currentStatus: input.currentStatus,
    event: input.event,
    evidence: input.evidence
  });
  return createHash("sha256").update(value).digest("hex");
}
