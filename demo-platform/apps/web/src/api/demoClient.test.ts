import { createProjectDanubeState } from "@stratton/scenario-data";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoClient } from "./demoClient.js";

describe("DemoClient", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const signal = new AbortController().signal;

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gets the typed Project Danube scenario", async () => {
    const scenario = createProjectDanubeState();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(scenario), { status: 200 }));

    const client = new DemoClient("/api");
    const result = await client.getScenario(signal);

    expect(result).toEqual(scenario);
    expect(fetchMock).toHaveBeenCalledWith("/api/scenario", { signal });
  });

  it("resets the scenario through the typed endpoint", async () => {
    const scenario = createProjectDanubeState();
    fetchMock.mockResolvedValue(new Response(JSON.stringify(scenario), { status: 200 }));

    const client = new DemoClient("/api");
    const result = await client.resetScenario();

    expect(result).toEqual(scenario);
    expect(fetchMock).toHaveBeenCalledWith("/api/scenario/reset", { method: "POST" });
  });

  it("admits evidence through the typed endpoint", async () => {
    const scenario = createProjectDanubeState();
    scenario.evidence = scenario.evidence.map((evidence) =>
      evidence.evidenceId === "evidence-board-pack"
        ? { ...evidence, admissionStatus: "ADMITTED" }
        : evidence
    );
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ scenario }), { status: 200 }));

    const client = new DemoClient("/api");
    const result = await client.admitEvidence({
      caseId: "project-danube",
      evidenceId: "evidence-board-pack"
    });

    expect(result).toEqual(scenario);
    expect(fetchMock).toHaveBeenCalledWith("/api/evidence/evidence-board-pack/admit", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ caseId: "project-danube" })
    });
  });

  it("submits a routed analysis request and returns the typed response", async () => {
    const scenario = createProjectDanubeState();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          analysisRunId: "run-terra-1",
          route: "TERRA",
          scenario,
          findings: [],
          analysisMetadata: {
            analysisRunId: "run-terra-1",
            route: "TERRA",
            taskClass: "CROSS_DOCUMENT_COMPARISON",
            analystQuestion: "Challenge management EBITDA quality",
            questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
            admittedEvidenceIds: [
              "evidence-board-pack",
              "evidence-erp-rebates",
              "evidence-qoe-report"
            ],
            evidenceSetHash:
              "f37e6f335867fbe2428d1dac7f33e32d480c1e4b9ed6761b6ddb51a0fbfb8df8",
            analysisRequestFingerprint:
              "dfec8894ed091695f8830d2894f588a468add85a89a6d7ad2ed0dd2fa6db0b7d",
            promptTemplateVersion:
              "stratton-workbench-v2:dfec8894ed091695f8830d2894f588a468add85a89a6d7ad2ed0dd2fa6db0b7d",
            authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
          }
        }),
        { status: 200 }
      )
    );

    const client = new DemoClient("/api");
    const result = await client.runAnalysis({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality"
    });

    expect(result).toEqual({
      analysisRunId: "run-terra-1",
      route: "TERRA",
      scenario,
      findings: [],
      correlationId: "unknown",
      analysisMetadata: {
        analysisRunId: "run-terra-1",
        route: "TERRA",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        analystQuestion: "Challenge management EBITDA quality",
        questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
        admittedEvidenceIds: [
          "evidence-board-pack",
          "evidence-erp-rebates",
          "evidence-qoe-report"
        ],
        evidenceSetHash:
          "f37e6f335867fbe2428d1dac7f33e32d480c1e4b9ed6761b6ddb51a0fbfb8df8",
        analysisRequestFingerprint:
          "dfec8894ed091695f8830d2894f588a468add85a89a6d7ad2ed0dd2fa6db0b7d",
        promptTemplateVersion:
          "stratton-workbench-v2:dfec8894ed091695f8830d2894f588a468add85a89a6d7ad2ed0dd2fa6db0b7d",
        authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
      }
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/analysis-runs", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        caseId: "project-danube",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality"
      })
    });
  });

  it("records a human finding disposition through the typed endpoint", async () => {
    const scenario = createProjectDanubeState();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ scenario }), { status: 200 }));

    const client = new DemoClient("/api");
    const result = await client.recordFindingDisposition({
      caseId: "project-danube",
      findingId: "finding-ebitda-quality",
      action: "EDIT",
      editedSummary: "Human adjusted EBITDA challenge kept for committee review."
    });

    expect(result).toEqual(scenario);
    expect(fetchMock).toHaveBeenCalledWith("/api/findings/finding-ebitda-quality/disposition", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-principal-type": "HUMAN"
      },
      body: JSON.stringify({
        caseId: "project-danube",
        action: "EDIT",
        editedSummary: "Human adjusted EBITDA challenge kept for committee review."
      })
    });
  });

  it("submits a specialist review through the typed endpoint", async () => {
    const scenario = createProjectDanubeState();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ scenario }), { status: 200 }));

    const client = new DemoClient("/api");
    const result = await client.submitReview({
      caseId: "project-danube",
      findingId: "finding-permit-transfer",
      reviewType: "LEGAL",
      decision: "APPROVED",
      rationale: "Permit transfer completion steps are documented."
    });

    expect(result).toEqual(scenario);
    expect(fetchMock).toHaveBeenCalledWith("/api/findings/finding-permit-transfer/reviews", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-principal-type": "HUMAN"
      },
      body: JSON.stringify({
        caseId: "project-danube",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "Permit transfer completion steps are documented."
      })
    });
  });

  it("prepares the committee-pack draft through the typed endpoint", async () => {
    const scenario = createProjectDanubeState();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ scenario }), { status: 200 }));

    const client = new DemoClient("/api");
    const result = await client.prepareRecommendation({
      caseId: "project-danube"
    });

    expect(result).toEqual(scenario);
    expect(fetchMock).toHaveBeenCalledWith("/api/recommendation/prepare", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-demo-principal-type": "HUMAN"
      },
      body: JSON.stringify({
        caseId: "project-danube"
      })
    });
  });

  it("returns the typed DemoApiError envelope for failed requests", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "POLICY_DENIED",
          message: "Policy denied this operation.",
          correlationId: "corr-403"
        }),
        { status: 403 }
      )
    );

    const client = new DemoClient("/api");

    await expect(client.getScenario()).rejects.toEqual({
      code: "POLICY_DENIED",
      message: "Policy denied this operation.",
      correlationId: "corr-403"
    });
  });

  it("falls back to a typed error when the body is malformed", async () => {
    fetchMock.mockResolvedValue(
      new Response("<html>policy denied</html>", {
        status: 403,
        headers: { "x-correlation-id": "corr-malformed" }
      })
    );

    const client = new DemoClient("/api");

    await expect(client.getScenario()).rejects.toEqual({
      code: "POLICY_DENIED",
      message: "Policy denied this operation.",
      correlationId: "corr-malformed"
    });
  });

  it("falls back to a typed error when the body is empty", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 503 }));

    const client = new DemoClient("/api");

    await expect(client.getScenario()).rejects.toEqual({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Required dependency is unavailable.",
      correlationId: "unknown"
    });
  });
});
