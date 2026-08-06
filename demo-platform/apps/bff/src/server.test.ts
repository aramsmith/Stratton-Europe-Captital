import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { InMemoryScenarioRepository } from "./scenario/in-memory-scenario-repository.js";
import { ScenarioService } from "./scenario/scenario-service.js";
import { createDemoServer } from "./server.js";

function testDependencies() {
  return {
    scenarioService: new ScenarioService(
      new InMemoryScenarioRepository(createProjectDanubeState())
    )
  };
}

describe("createDemoServer", () => {
  it("returns the current Project Danube state", async () => {
    const response = await request(createDemoServer(testDependencies())).get("/api/scenario");

    expect(response.status).toBe(200);
    expect(response.body.caseId).toBe("project-danube");
    expect(response.headers["x-correlation-id"]).toBeTruthy();
  });

  it("preserves an incoming correlation id", async () => {
    const response = await request(createDemoServer(testDependencies()))
      .get("/api/scenario")
      .set("x-correlation-id", "corr-123");

    expect(response.status).toBe(200);
    expect(response.headers["x-correlation-id"]).toBe("corr-123");
  });

  it("returns invalid contract for malformed json with a generated correlation id", async () => {
    const response = await request(createDemoServer(testDependencies()))
      .post("/api/scenario/reset")
      .set("content-type", "application/json")
      .send('{"broken"');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "INVALID_CONTRACT",
      message: "Request does not satisfy the approved contract.",
      correlationId: response.headers["x-correlation-id"]
    });
    expect(response.headers["x-correlation-id"]).toBeTruthy();
  });

  it("returns an invalid contract envelope for unmatched routes", async () => {
    const response = await request(createDemoServer(testDependencies()))
      .get("/api/not-a-real-route")
      .set("x-correlation-id", "corr-404");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: "INVALID_CONTRACT",
      message: "Requested path does not match an approved route.",
      correlationId: "corr-404"
    });
    expect(response.headers["x-correlation-id"]).toBe("corr-404");
  });

  it("resets the scenario to the deterministic intake state", async () => {
    const repository = new InMemoryScenarioRepository(createProjectDanubeState());
    const mutatedState = createProjectDanubeState();
    mutatedState.evidence = mutatedState.evidence.map((evidence) =>
      evidence.evidenceId === "evidence-qoe-report"
        ? { ...evidence, admissionStatus: "ADMITTED" }
        : evidence
    );
    await repository.save({
      ...mutatedState,
      stage: "REVIEW",
      findings: [
        {
          findingId: "finding-1",
          title: "Material issue",
          summary: "Needs review",
          materiality: "HIGH",
          status: "DRAFT",
          citations: [
            {
              citationId: "citation-1",
              evidenceId: "evidence-qoe-report",
              locator: "page-1",
              accessible: true
            }
          ]
        }
      ]
    });

    const response = await request(
      createDemoServer({
        scenarioService: new ScenarioService(repository)
      })
    ).post("/api/scenario/reset");

    expect(response.status).toBe(200);
    expect(response.body.stage).toBe("INTAKE");
    expect(response.body.findings).toEqual([]);
  });

  it("maps unknown failures to a stable fail-closed envelope", async () => {
    const response = await request(
      createDemoServer({
        scenarioService: {
          get: async () => {
            throw new Error("boom");
          },
          reset: async () => createProjectDanubeState()
        }
      })
    )
      .get("/api/scenario")
      .set("x-correlation-id", "corr-500");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "Required dependency is unavailable.",
      correlationId: "corr-500"
    });
    expect(response.headers["x-correlation-id"]).toBe("corr-500");
  });
});

describe("parseDemoConfig", () => {
  it("requires SQL configuration in AZURE mode", async () => {
    const { parseDemoConfig } = await import("./config.js");

    expect(() =>
      parseDemoConfig({
        PORT: "3001",
        DEMO_MODE: "AZURE",
        PHASE5_API_BASE_URL: "https://phase5.example.test"
      })
    ).toThrowError(/AZURE_MODE_REQUIRES_SQL_CONFIGURATION/);
  });
});

describe("createPhase5Client", () => {
  it("forwards the human bearer token, traceparent, and idempotency key", async () => {
    const { createPhase5Client } = await import("./phase5/phase5-client.js");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));

    const client = createPhase5Client({
      baseUrl: "https://phase5.example.test",
      accessToken: "human-token",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00aa0ba902b7-01",
      fetch: fetchMock
    });

    await client.admitEvidence({
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      idempotencyKey: "idem-1"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://phase5.example.test/v1/evidence/evidence-board-pack/admission",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer human-token",
          traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00aa0ba902b7-01",
          "idempotency-key": "idem-1"
        }),
        body: JSON.stringify({ caseId: "project-danube" })
      })
    );
  });

  it("preserves a policy denial from Phase 5", async () => {
    const { createPhase5Client } = await import("./phase5/phase5-client.js");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "POLICY_DENIED",
          message: "Phase 5 policy denied the operation.",
          correlationId: "phase5-corr-1"
        }),
        {
          status: 403,
          headers: { "content-type": "application/json" }
        }
      )
    );

    const client = createPhase5Client({
      baseUrl: "https://phase5.example.test",
      accessToken: "human-token",
      fetch: fetchMock
    });

    await expect(
      client.prepareDraft({
        caseId: "project-danube",
        analysisRunId: "run-1",
        subjectVersion: "v1",
        idempotencyKey: "idem-2"
      })
    ).rejects.toMatchObject({
      code: "POLICY_DENIED",
      message: "Phase 5 policy denied the operation.",
      correlationId: "phase5-corr-1"
    });
  });

  it("fails closed when Phase 5 returns an invalid success payload", async () => {
    const { createPhase5Client } = await import("./phase5/phase5-client.js");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ analysisRunId: 42, status: "DONE" }), {
        status: 202,
        headers: { "content-type": "application/json" }
      })
    );

    const client = createPhase5Client({
      baseUrl: "https://phase5.example.test",
      accessToken: "human-token",
      fetch: fetchMock
    });

    await expect(
      client.requestAnalysis({
        caseId: "project-danube",
        evidenceId: "evidence-board-pack",
        modelDeploymentId: "terra",
        promptTemplateVersion: "v1",
        idempotencyKey: "idem-3"
      })
    ).rejects.toMatchObject({
      code: "INVALID_CONTRACT"
    });
  });
});
