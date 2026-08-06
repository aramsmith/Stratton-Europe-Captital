import { evaluateTransitionPolicy } from "./policy-service.js";
import type { TransitionPolicyEvidence } from "./types.js";

export interface DraftOnlyAnalysisBoundaryInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisRunId: string;
  readonly evidence: TransitionPolicyEvidence;
  readonly autonomousToolsRequested: boolean;
  readonly sourceWriteBackRequested: boolean;
  readonly foundationModelTrainingRequested: boolean;
  readonly finalAdviceRequested: boolean;
}

export function assertDraftOnlyAnalysisBoundary(input: DraftOnlyAnalysisBoundaryInput): void {
  if (input.finalAdviceRequested) {
    throw new Error("FINAL_ADVICE_PROHIBITED");
  }
  if (input.autonomousToolsRequested) {
    throw new Error("AUTONOMOUS_ACTION_PROHIBITED");
  }
  if (input.sourceWriteBackRequested) {
    throw new Error("SOURCE_WRITE_BACK_PROHIBITED");
  }
  if (input.foundationModelTrainingRequested) {
    throw new Error("FOUNDATION_MODEL_TRAINING_PROHIBITED");
  }
  const evaluation = evaluateTransitionPolicy({
    tenantId: input.tenantId,
    caseId: input.caseId,
    currentStatus: "EVIDENCE_ADMITTED",
    event: "REQUEST_ANALYSIS",
    evidence: input.evidence
  });
  if (!evaluation.allowed) {
    throw new Error(`ANALYSIS_POLICY_DENIED:${evaluation.denialReasons.join(",")}`);
  }
}
