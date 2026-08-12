export type ModelTier = "LUNA" | "TERRA" | "SOL";

export type ModelTaskClass =
  | "EVIDENCE_TRIAGE"
  | "QUERY_REWRITE"
  | "FIRST_PASS_SUMMARY"
  | "GROUNDED_ANALYSIS"
  | "CROSS_DOCUMENT_COMPARISON"
  | "ESG_NORMALISATION"
  | "COMPLEX_RISK_SYNTHESIS"
  | "INVESTMENT_THESIS_CHALLENGE";

export type ModelEscalationReason =
  | "VALIDATION_FAILURE"
  | "LOW_CONFIDENCE"
  | "CONFLICTING_MATERIAL_EVIDENCE"
  | "HIGH_RISK_SPECIALIST_CONCLUSION"
  | "AUTHORISED_HUMAN_REQUEST";

export interface ModelRouteInput {
  readonly taskClass: ModelTaskClass;
  readonly escalationReason?: ModelEscalationReason;
}

export interface ModelRouteDeployment {
  readonly deploymentId: string;
  readonly residencyEvidenceId: string;
  readonly modelName: "gpt-5.6-luna" | "gpt-5.6-terra" | "gpt-5.6-sol";
  readonly modelVersion: "2026-07-09";
  readonly validationStatus: "VALIDATED";
}

export interface ModelRouteDeployments {
  readonly LUNA: ModelRouteDeployment;
  readonly TERRA: ModelRouteDeployment;
  readonly SOL: ModelRouteDeployment;
}

export interface ModelRouteDecision {
  readonly tier: ModelTier;
  readonly deploymentId: string;
  readonly modelRouteReason: string;
  readonly reasoningEffort: "low" | "medium" | "high";
  readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";
  readonly deploymentResidencyEvidenceId: string;
  readonly modelName: "gpt-5.6-luna" | "gpt-5.6-terra" | "gpt-5.6-sol";
  readonly modelVersion: "2026-07-09";
  readonly modelValidationStatus: "NOT_RUN" | "PASS" | "FAIL";
}

export function assertNever(value: never): never {
  throw new Error(`UNREACHABLE_MODEL_ROUTE:${String(value)}`);
}

function baseTier(taskClass: ModelTaskClass): ModelTier {
  switch (taskClass) {
    case "EVIDENCE_TRIAGE":
    case "QUERY_REWRITE":
    case "FIRST_PASS_SUMMARY":
      return "LUNA";
    case "GROUNDED_ANALYSIS":
    case "CROSS_DOCUMENT_COMPARISON":
    case "ESG_NORMALISATION":
      return "TERRA";
    case "COMPLEX_RISK_SYNTHESIS":
    case "INVESTMENT_THESIS_CHALLENGE":
      return "SOL";
  }
  return assertNever(taskClass);
}

function promoteOneTier(tier: ModelTier): ModelTier {
  switch (tier) {
    case "LUNA":
      return "TERRA";
    case "TERRA":
      return "SOL";
    case "SOL":
      return "SOL";
  }
  return assertNever(tier);
}

function escalatedTier(tier: ModelTier, reason: ModelEscalationReason): ModelTier {
  switch (reason) {
    case "VALIDATION_FAILURE":
    case "LOW_CONFIDENCE":
      return promoteOneTier(tier);
    case "CONFLICTING_MATERIAL_EVIDENCE":
    case "HIGH_RISK_SPECIALIST_CONCLUSION":
    case "AUTHORISED_HUMAN_REQUEST":
      return "SOL";
  }
  return assertNever(reason);
}

function reasoningEffort(tier: ModelTier): "low" | "medium" | "high" {
  switch (tier) {
    case "LUNA":
      return "low";
    case "TERRA":
      return "medium";
    case "SOL":
      return "high";
  }
  return assertNever(tier);
}

export function selectModelRoute(
  input: ModelRouteInput,
  deployments: ModelRouteDeployments
): ModelRouteDecision {
  const initialTier = baseTier(input.taskClass);
  const tier =
    input.escalationReason === undefined
      ? initialTier
      : escalatedTier(initialTier, input.escalationReason);
  const deployment = deployments[tier];
  return {
    tier,
    deploymentId: deployment.deploymentId,
    modelRouteReason:
      input.escalationReason === undefined
        ? "BASE_ROUTE"
        : `ESCALATION_${input.escalationReason}`,
    reasoningEffort: reasoningEffort(tier),
    modelRoutingPolicyVersion: "stratton-model-routing-v1",
    deploymentResidencyEvidenceId: deployment.residencyEvidenceId,
    modelName: deployment.modelName,
    modelVersion: deployment.modelVersion,
    modelValidationStatus: "NOT_RUN"
  };
}
