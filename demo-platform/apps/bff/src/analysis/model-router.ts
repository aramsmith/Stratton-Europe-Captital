import type { AnalysisTaskClass, ModelRoute } from "@stratton/contracts";

const routeByTaskClass: Readonly<Record<AnalysisTaskClass, ModelRoute>> = {
  EVIDENCE_TRIAGE: "LUNA",
  QUERY_REWRITE: "LUNA",
  FIRST_PASS_SUMMARY: "LUNA",
  GROUNDED_ANALYSIS: "TERRA",
  CROSS_DOCUMENT_COMPARISON: "TERRA",
  ESG_NORMALISATION: "TERRA",
  COMPLEX_RISK_SYNTHESIS: "SOL",
  INVESTMENT_THESIS_CHALLENGE: "SOL"
};

export function routeTask(taskClass: AnalysisTaskClass): ModelRoute {
  return routeByTaskClass[taskClass];
}
