import { describe, expect, it } from "vitest";
import { analysisRunRequestSchema, findingDispositionRequestSchema, scenarioStateSchema } from "./index.js";

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
});
