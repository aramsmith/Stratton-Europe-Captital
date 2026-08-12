import assert from "node:assert/strict";
import { test } from "node:test";
import { selectModelRoute } from "../../../app/src/model-routing-policy.js";

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

type ReasoningEffort = "low" | "medium" | "high";
export type ModelName = "gpt-5.6-luna" | "gpt-5.6-terra" | "gpt-5.6-sol";
export type ModelValidationStatus = "NOT_RUN" | "PASS" | "FAIL";

interface PlannedDeployment {
  readonly deploymentId: string;
  readonly residencyEvidenceId: string;
  readonly modelName: ModelName;
  readonly modelVersion: "2026-07-09";
  readonly validationStatus: "VALIDATED";
}

export interface ModelRouteDecision {
  readonly tier: ModelTier;
  readonly deploymentId: string;
  readonly modelRouteReason: string;
  readonly reasoningEffort: ReasoningEffort;
  readonly modelRoutingPolicyVersion: "stratton-model-routing-v1";
  readonly deploymentResidencyEvidenceId: string;
  readonly modelName: ModelName;
  readonly modelVersion: "2026-07-09";
  readonly modelValidationStatus: ModelValidationStatus;
}

const deployments: Readonly<Record<ModelTier, PlannedDeployment>> = {
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
};

test("selectModelRoute assigns every task class to its deterministic base tier and effort", () => {
  const cases: readonly {
    readonly taskClass: ModelTaskClass;
    readonly tier: ModelTier;
    readonly reasoningEffort: ReasoningEffort;
  }[] = [
    { taskClass: "EVIDENCE_TRIAGE", tier: "LUNA", reasoningEffort: "low" },
    { taskClass: "QUERY_REWRITE", tier: "LUNA", reasoningEffort: "low" },
    { taskClass: "FIRST_PASS_SUMMARY", tier: "LUNA", reasoningEffort: "low" },
    { taskClass: "GROUNDED_ANALYSIS", tier: "TERRA", reasoningEffort: "medium" },
    { taskClass: "CROSS_DOCUMENT_COMPARISON", tier: "TERRA", reasoningEffort: "medium" },
    { taskClass: "ESG_NORMALISATION", tier: "TERRA", reasoningEffort: "medium" },
    { taskClass: "COMPLEX_RISK_SYNTHESIS", tier: "SOL", reasoningEffort: "high" },
    { taskClass: "INVESTMENT_THESIS_CHALLENGE", tier: "SOL", reasoningEffort: "high" }
  ];

  for (const expected of cases) {
    const selected = selectModelRoute({ taskClass: expected.taskClass }, deployments);
    assert.equal(selected.tier, expected.tier, expected.taskClass);
    assert.equal(selected.reasoningEffort, expected.reasoningEffort, expected.taskClass);
    assert.equal(selected.deploymentId, deployments[expected.tier].deploymentId, expected.taskClass);
    assert.equal(selected.modelRouteReason, "BASE_ROUTE", expected.taskClass);
    assert.equal(selected.modelRoutingPolicyVersion, "stratton-model-routing-v1", expected.taskClass);
    assert.equal(selected.deploymentResidencyEvidenceId, deployments[expected.tier].residencyEvidenceId, expected.taskClass);
    assert.equal(selected.modelName, deployments[expected.tier].modelName, expected.taskClass);
    assert.equal(selected.modelVersion, "2026-07-09", expected.taskClass);
    assert.equal(selected.modelValidationStatus, "NOT_RUN", expected.taskClass);
  }
});

test("selectModelRoute applies the approved escalation examples without caller deployment selection", () => {
  assert.equal(
    selectModelRoute({ taskClass: "EVIDENCE_TRIAGE", escalationReason: "LOW_CONFIDENCE" }, deployments).tier,
    "TERRA"
  );
  assert.equal(
    selectModelRoute({ taskClass: "GROUNDED_ANALYSIS", escalationReason: "VALIDATION_FAILURE" }, deployments).tier,
    "SOL"
  );
  assert.equal(
    selectModelRoute(
      { taskClass: "EVIDENCE_TRIAGE", escalationReason: "CONFLICTING_MATERIAL_EVIDENCE" },
      deployments
    ).tier,
    "SOL"
  );
  assert.equal(
    selectModelRoute(
      { taskClass: "GROUNDED_ANALYSIS", escalationReason: "AUTHORISED_HUMAN_REQUEST" },
      deployments
    ).tier,
    "SOL"
  );
  for (const escalationReason of [
    "VALIDATION_FAILURE",
    "LOW_CONFIDENCE",
    "CONFLICTING_MATERIAL_EVIDENCE",
    "HIGH_RISK_SPECIALIST_CONCLUSION",
    "AUTHORISED_HUMAN_REQUEST"
  ] as const) {
    const selected = selectModelRoute({ taskClass: "GROUNDED_ANALYSIS", escalationReason }, deployments);
    assert.equal(
      selected.modelRouteReason,
      `ESCALATION_${escalationReason}`,
      escalationReason
    );
    assert.equal(selected.modelRoutingPolicyVersion, "stratton-model-routing-v1", escalationReason);
    assert.equal(selected.modelValidationStatus, "NOT_RUN", escalationReason);
  }
});
