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
          findings: []
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
      correlationId: "unknown"
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
