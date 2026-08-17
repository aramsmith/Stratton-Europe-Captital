import { evaluateTransitionPolicy } from "./policy-service.js";
import type { CaseEvent, CaseStatus, TransitionContext } from "./types.js";

const transitions: Readonly<Record<CaseStatus, Partial<Record<CaseEvent, CaseStatus>>>> = {
  DRAFT: {
    REQUEST_INGESTION: "EVIDENCE_QUARANTINED"
  },
  EVIDENCE_QUARANTINED: {
    REQUEST_INGESTION: "EVIDENCE_QUARANTINED",
    PROMOTE_EVIDENCE: "EVIDENCE_ADMITTED"
  },
  EVIDENCE_ADMITTED: {
    PROMOTE_EVIDENCE: "EVIDENCE_ADMITTED",
    REQUEST_ANALYSIS: "ANALYSIS_REQUESTED"
  },
  ANALYSIS_REQUESTED: {
    STORE_ANALYSIS_DRAFT: "ANALYSIS_DRAFT_READY"
  },
  ANALYSIS_DRAFT_READY: {
    REQUEST_SPECIALIST_REVIEW: "SPECIALIST_REVIEW_PENDING"
  },
  SPECIALIST_REVIEW_PENDING: {
    MARK_DRAFT_READY: "DRAFT_RECOMMENDATION_READY"
  },
  DRAFT_RECOMMENDATION_READY: {}
};

export interface StateTransitionResult {
  readonly allowed: boolean;
  readonly nextStatus: CaseStatus;
  readonly denialReasons: readonly string[];
}

export function transitionCaseState(context: TransitionContext): StateTransitionResult {
  const policy = evaluateTransitionPolicy(context);
  if (!policy.allowed) {
    return {
      allowed: false,
      nextStatus: context.currentStatus,
      denialReasons: policy.denialReasons
    };
  }

  const next = transitions[context.currentStatus][context.event];
  if (!next) {
    return {
      allowed: false,
      nextStatus: context.currentStatus,
      denialReasons: ["INVALID_TRANSITION"]
    };
  }
  return {
    allowed: true,
    nextStatus: next,
    denialReasons: []
  };
}
