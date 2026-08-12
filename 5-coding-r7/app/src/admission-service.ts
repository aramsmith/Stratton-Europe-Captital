import { evaluateTransitionPolicy } from "./policy-service.js";
import type { TransitionPolicyEvidence } from "./types.js";

export interface EvidencePromotionRequest {
  readonly tenantId: string;
  readonly caseId: string;
  readonly evidenceId: string;
  readonly policyEvidence: TransitionPolicyEvidence;
}

export interface EvidencePromotionResult {
  readonly evidenceId: string;
  readonly status: "ADMITTED" | "QUARANTINED";
  readonly denialReasons: readonly string[];
}

export function promoteEvidenceFromQuarantine(
  request: EvidencePromotionRequest
): EvidencePromotionResult {
  const evaluation = evaluateTransitionPolicy({
    tenantId: request.tenantId,
    caseId: request.caseId,
    currentStatus: "EVIDENCE_QUARANTINED",
    event: "PROMOTE_EVIDENCE",
    evidence: request.policyEvidence
  });
  return {
    evidenceId: request.evidenceId,
    status: evaluation.allowed ? "ADMITTED" : "QUARANTINED",
    denialReasons: evaluation.denialReasons
  };
}
