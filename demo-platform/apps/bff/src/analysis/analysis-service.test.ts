import { describe, expect, it, vi } from "vitest";
import type { AnalysisFinding } from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import type { Phase5Client } from "../phase5/phase5-client.js";
import { InMemoryScenarioRepository } from "../scenario/in-memory-scenario-repository.js";
import { AnalysisService } from "./analysis-service.js";
import { routeTask } from "./model-router.js";

function createAdmittedState() {
  const state = createProjectDanubeState();
  state.evidence = state.evidence.map((evidence) => ({ ...evidence, admissionStatus: "ADMITTED" }));
  return state;
}

function createPhase5ClientDouble() {
  return {
    requestAnalysis: vi.fn<Phase5Client["requestAnalysis"]>().mockResolvedValue({
      analysisRunId: "run-terra-1",
      status: "QUEUED"
    }),
    admitEvidence: vi.fn<Phase5Client["admitEvidence"]>().mockResolvedValue(undefined),
    submitReview: vi.fn<Phase5Client["submitReview"]>().mockResolvedValue(undefined),
    prepareDraft: vi.fn<Phase5Client["prepareDraft"]>().mockResolvedValue(undefined)
  } satisfies Phase5Client;
}

function getFinding(findings: readonly AnalysisFinding[], findingId: string) {
  const finding = findings.find((candidate) => candidate.findingId === findingId);
  expect(finding).toBeDefined();
  return finding!;
}

describe("routeTask", () => {
  it.each([
    ["EVIDENCE_TRIAGE", "LUNA"],
    ["CROSS_DOCUMENT_COMPARISON", "TERRA"],
    ["INVESTMENT_THESIS_CHALLENGE", "SOL"]
  ] as const)("routes %s to %s", (taskClass, expected) => {
    expect(routeTask(taskClass)).toBe(expected);
  });
});

describe("AnalysisService", () => {
  it("blocks an EBITDA finding when one cited source is not admitted", async () => {
    const state = createAdmittedState();
    state.evidence = state.evidence.map((evidence) =>
      evidence.evidenceId === "evidence-erp-rebates"
        ? { ...evidence, admissionStatus: "QUARANTINED" }
        : evidence
    );

    const service = new AnalysisService({
      repository: new InMemoryScenarioRepository(state),
      phase5Client: createPhase5ClientDouble()
    });

    await expect(
      service.run({
        caseId: "project-danube",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality",
        correlationId: "corr-evidence-gap"
      })
    ).rejects.toMatchObject({ code: "EVIDENCE_INCOMPLETE" });
  });

  it("routes the grounded workbench flow to Terra and stores draft findings with governance evidence", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const phase5Client = createPhase5ClientDouble();
    const service = new AnalysisService({ repository, phase5Client });

    const result = await service.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-terra-1"
    });

    expect(result.route).toBe("TERRA");
    expect(result.analysisRunId).toBe("run-terra-1");
    expect(phase5Client.requestAnalysis).toHaveBeenCalledWith({
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      modelDeploymentId: "terra-grounded-analysis",
      promptTemplateVersion: "stratton-workbench-v1",
      idempotencyKey: expect.any(String)
    });

    const ebitdaFinding = getFinding(result.findings, "finding-ebitda-quality");
    expect(ebitdaFinding).toMatchObject({
      title: "Adjusted EBITDA quality",
      summary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.",
      materiality: "HIGH",
      status: "DRAFT",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-board-pack-42",
          evidenceId: "evidence-board-pack",
          locator: "page 42",
          accessible: true
        },
        {
          citationId: "citation-erp-812-886",
          evidenceId: "evidence-erp-rebates",
          locator: "rows 812-886",
          accessible: true
        },
        {
          citationId: "citation-qoe-18",
          evidenceId: "evidence-qoe-report",
          locator: "page 18",
          accessible: true
        }
      ]
    });
    expect(ebitdaFinding.originalAiSummary).toBe(
      "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million."
    );
    expect(ebitdaFinding.textHistory).toEqual([
      expect.objectContaining({
        actorType: "AI",
        action: "GENERATED",
        summary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million."
      })
    ]);

    const savedState = await repository.load();
    expect(savedState.stage).toBe("ANALYSIS");
    expect(savedState.findings.map((finding) => finding.findingId)).toEqual([
      "finding-ebitda-quality",
      "finding-customer-concentration",
      "finding-permit-transfer"
    ]);
    expect(savedState.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "MODEL_ROUTE_SELECTED",
          outcome: "ALLOW",
          correlationId: "corr-terra-1",
          detail: "TERRA"
        }),
        expect.objectContaining({
          type: "ANALYSIS_POLICY_CHECK",
          outcome: "ALLOW",
          correlationId: "corr-terra-1"
        }),
        expect.objectContaining({
          type: "ANALYSIS_CORRELATED",
          outcome: "SUCCESS",
          correlationId: "corr-terra-1",
          detail: "run-terra-1"
        })
      ])
    );
  });

  it("requires a human disposition and preserves immutable AI text when the finding is edited", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const service = new AnalysisService({
      repository,
      phase5Client: createPhase5ClientDouble()
    });

    await service.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-review-1"
    });

    await expect(
      service.recordDisposition({
        caseId: "project-danube",
        findingId: "finding-ebitda-quality",
        action: "EDIT",
        editedSummary: "Human adjusted EBITDA challenge kept for committee review.",
        principalType: "SERVICE",
        correlationId: "corr-review-2"
      })
    ).rejects.toMatchObject({ code: "POLICY_DENIED" });

    const nextState = await service.recordDisposition({
      caseId: "project-danube",
      findingId: "finding-ebitda-quality",
      action: "EDIT",
      editedSummary: "Human adjusted EBITDA challenge kept for committee review.",
      principalType: "HUMAN",
      correlationId: "corr-review-3"
    });

    const finding = getFinding(nextState.findings, "finding-ebitda-quality");
    expect(finding.summary).toBe("Human adjusted EBITDA challenge kept for committee review.");
    expect(finding.status).toBe("ACCEPTED");
    expect(finding.originalAiSummary).toBe(
      "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million."
    );
    expect(finding.textHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorType: "AI",
          action: "GENERATED",
          summary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million."
        }),
        expect.objectContaining({
          actorType: "HUMAN",
          action: "EDITED",
          summary: "Human adjusted EBITDA challenge kept for committee review."
        })
      ])
    );
  });
});
