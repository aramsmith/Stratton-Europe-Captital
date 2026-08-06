import { describe, expect, it } from "vitest";
import {
  analysisRunRequestSchema,
  findingDispositionRequestSchema,
  governanceViewSchema,
  scenarioStateSchema
} from "./index.js";

const buildScenarioState = (admissionStatus: "ADMITTED" | "QUARANTINED" | "REJECTED") => ({
  caseId: "project-danube",
  stage: "ANALYSIS",
  evidence: [
    {
      evidenceId: "evidence-ebitda",
      title: "EBITDA bridge",
      domain: "FINANCIAL",
      admissionStatus,
      owner: "deal-team",
      licenceStatus: "APPROVED",
      sourceLocator: "board-pack/page-12"
    }
  ],
  findings: [
    {
      findingId: "finding-ebitda",
      title: "EBITDA quality",
      summary: "Adjustment range requires challenge",
      materiality: "HIGH",
      status: "DRAFT",
      citations: [
        {
          citationId: "citation-ebitda",
          evidenceId: "evidence-ebitda",
          locator: "page-12",
          accessible: true
        }
      ]
    }
  ],
  reviews: [],
  governanceEvents: []
});

describe("scenarioStateSchema", () => {
  it("rejects a material finding without citations", () => {
    const result = scenarioStateSchema.safeParse({
      caseId: "project-danube",
      stage: "ANALYSIS",
      evidence: [],
      findings: [
        {
          findingId: "finding-ebitda",
          title: "EBITDA quality",
          summary: "Adjustment range requires challenge",
          materiality: "HIGH",
          status: "DRAFT",
          citations: []
        }
      ],
      reviews: [],
      governanceEvents: []
    });

    expect(result.success).toBe(false);
  });

  it("rejects a material finding that cites quarantined evidence", () => {
    const result = scenarioStateSchema.safeParse(buildScenarioState("QUARANTINED"));

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
      "MATERIAL_FINDING_CITATION_MUST_REFERENCE_ADMITTED_EVIDENCE"
    );
  });

  it("rejects a material finding that cites rejected evidence", () => {
    const result = scenarioStateSchema.safeParse(buildScenarioState("REJECTED"));

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues.map((issue) => issue.message)).toContain(
      "MATERIAL_FINDING_CITATION_MUST_REFERENCE_ADMITTED_EVIDENCE"
    );
  });

  it("accepts a material finding that cites admitted evidence", () => {
    const result = scenarioStateSchema.safeParse(buildScenarioState("ADMITTED"));

    expect(result.success).toBe(true);
  });

  it("accepts governed analysis metadata linked to findings and audit events", () => {
    const result = scenarioStateSchema.safeParse({
      ...buildScenarioState("ADMITTED"),
      latestAnalysisRun: {
        analysisRunId: "run-terra-1",
        route: "TERRA",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        analystQuestion: "Challenge management EBITDA quality",
        questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
        admittedEvidenceIds: ["evidence-ebitda"],
        evidenceSetHash: "fc6bd6c830235f7fcebf7b05d9d5de273ef272927bb833d36f0ce71085126fba",
        analysisRequestFingerprint:
          "2f1a64f1d28bf2faccfff98bbd8fe4f53d32fce5f95bc639ff5fe4d4f814c68c",
        promptTemplateVersion:
          "stratton-workbench-v2:2f1a64f1d28bf2faccfff98bbd8fe4f53d32fce5f95bc639ff5fe4d4f814c68c",
        authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
      },
      findings: [
        {
          findingId: "finding-ebitda",
          title: "EBITDA quality",
          summary: "Adjustment range requires challenge",
          materiality: "HIGH",
          status: "DRAFT",
          analysisRunId: "run-terra-1",
          analysisRequestFingerprint:
            "2f1a64f1d28bf2faccfff98bbd8fe4f53d32fce5f95bc639ff5fe4d4f814c68c",
          authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
          citations: [
            {
              citationId: "citation-ebitda",
              evidenceId: "evidence-ebitda",
              locator: "page-12",
              accessible: true
            }
          ]
        }
      ],
      governanceEvents: [
        {
          eventId: "event-analysis-governed",
          type: "ANALYSIS_REQUEST_GOVERNED",
          outcome: "SUCCESS",
          occurredAtIso: "2026-08-06T10:05:00.000Z",
          correlationId: "corr-analysis-1",
          metadata: {
            analysisRequestFingerprint:
              "2f1a64f1d28bf2faccfff98bbd8fe4f53d32fce5f95bc639ff5fe4d4f814c68c",
            questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
            evidenceSetHash:
              "fc6bd6c830235f7fcebf7b05d9d5de273ef272927bb833d36f0ce71085126fba",
            taskClass: "CROSS_DOCUMENT_COMPARISON",
            route: "TERRA",
            phase5RunId: "run-terra-1",
            authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
            findingIds: ["finding-ebitda"]
          }
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("accepts a routed analysis request for Project Danube", () => {
    const result = analysisRunRequestSchema.safeParse({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality"
    });

    expect(result.success).toBe(true);
  });

  it("requires an edited summary when a human edits a finding", () => {
    const result = findingDispositionRequestSchema.safeParse({
      caseId: "project-danube",
      action: "EDIT"
    });

    expect(result.success).toBe(false);
  });

  it("accepts a governance console projection with lineage, policy decisions, routes, and gates", () => {
    const result = governanceViewSchema.safeParse({
      lineage: [
        {
          id: "finding-ebitda-quality",
          title: "Adjusted EBITDA quality",
          sourceLocators: ["fy25-board-pack.txt", "erp-rebate-export.csv", "qoe-report.txt"],
          evidenceIds: ["evidence-board-pack", "evidence-erp-rebates", "evidence-qoe-report"],
          modelRoute: "TERRA",
          reviewTypes: ["DEAL"],
          reviewVersionIds: ["finding-ebitda-quality-v2"],
          policyDecisionIds: ["event-policy-check", "event-analysis-governed"],
          recommendationIds: ["event-committee-pack"],
          assuranceStatus: "CURRENT",
          historicalReviewTypes: [],
          historicalReviewVersionIds: [],
          historicalPolicyDecisionIds: [],
          historicalRecommendationIds: []
        }
      ],
      policyDecisions: [
        {
          decisionId: "event-analysis-governed",
          policyType: "ANALYSIS_REQUEST_GOVERNED",
          result: "SUCCESS",
          reasonCodes: ["CROSS_DOCUMENT_COMPARISON", "TERRA"],
          version: "finding-ebitda-quality-v2",
          correlationId: "corr-analysis-1",
          relatedFindingIds: ["finding-ebitda-quality"],
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        }
      ],
      modelRoutes: [
        {
          routeId: "run-terra-1",
          taskClass: "CROSS_DOCUMENT_COMPARISON",
          modelRoute: "TERRA",
          analysisRunId: "run-terra-1",
          authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
          primaryEvidenceIds: [
            "evidence-board-pack",
            "evidence-environmental-permit",
            "evidence-erp-rebates",
            "evidence-qoe-report"
          ],
          recoveryEvidenceIds: [],
          correlationId: "corr-analysis-1",
          analysisRequestFingerprint:
            "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
          questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
          evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
          promptTemplateVersion:
            "stratton-workbench-v2:9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
          routeEventIds: ["event-route-selected", "event-analysis-governed"]
        }
      ],
      securityGates: [
        {
          gateId: "CC002-R2-SEC-GATE-001",
          name: "Direct prompt injection",
          outcome: "NOT_RUN",
          failClosedOutcome: "Block promotion and deny affected output"
        }
      ],
      auditExport: {
        status: "READY",
        missingItems: [],
        previewSections: ["Lineage", "Policy decisions", "Model routes", "Security & audit"]
      }
    });

    expect(result.success).toBe(true);
  });
});
