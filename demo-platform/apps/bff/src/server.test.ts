import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { AnalysisService } from "./analysis/analysis-service.js";
import { EvidenceService } from "./evidence/evidence-service.js";
import type { Phase5Client } from "./phase5/phase5-client.js";
import { ReviewService } from "./reviews/review-service.js";
import { InMemoryScenarioRepository } from "./scenario/in-memory-scenario-repository.js";
import { ScenarioService } from "./scenario/scenario-service.js";
import { createDemoServer } from "./server.js";

function testDependencies() {
  const repository = new InMemoryScenarioRepository(createProjectDanubeState());
  const phase5Client = createPhase5ClientDouble();

  return {
    scenarioService: new ScenarioService(repository),
    evidenceService: new EvidenceService({ repository, phase5Client }),
    analysisService: new AnalysisService({ repository, phase5Client }),
    reviewService: new ReviewService({ repository, phase5Client })
  };
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

function createAdmittedState() {
  const state = createProjectDanubeState();
  state.evidence = state.evidence.map((evidence) => ({
    ...evidence,
    admissionStatus: "ADMITTED",
    provenanceStatus: "VERIFIED"
  }));
  return state;
}

function createDecisionRoomState(includeLegalApproval = false) {
  const state = createAdmittedState();
  state.stage = "REVIEW";
  state.latestAnalysisRun = {
    analysisRunId: "run-terra-1",
    route: "TERRA",
    taskClass: "CROSS_DOCUMENT_COMPARISON",
    analystQuestion: "Challenge management EBITDA quality",
    questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
    admittedEvidenceIds: [
      "evidence-board-pack",
      "evidence-environmental-permit",
      "evidence-erp-rebates",
      "evidence-qoe-report"
    ],
    evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
    analysisRequestFingerprint:
      "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
    promptTemplateVersion:
      "stratton-workbench-v2:9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
    authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
  };
  state.findings = [
    {
      findingId: "finding-ebitda-quality",
      title: "Adjusted EBITDA quality",
      summary: "Human adjusted EBITDA challenge kept for committee review.",
      originalAiSummary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.",
      materiality: "HIGH",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-board-pack-42",
          evidenceId: "evidence-board-pack",
          locator: "page 42",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-ebitda-quality-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        },
        {
          versionId: "finding-ebitda-quality-v2",
          actorType: "HUMAN",
          action: "ACCEPTED",
          summary: "Human adjusted EBITDA challenge kept for committee review.",
          occurredAtIso: "2026-08-06T10:10:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    },
    {
      findingId: "finding-customer-concentration",
      title: "Customer concentration",
      summary: "Customer rebate concentration remains above the approved downside threshold.",
      originalAiSummary:
        "Customer rebate concentration remains above the approved downside threshold.",
      materiality: "MEDIUM",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-erp-812-886",
          evidenceId: "evidence-erp-rebates",
          locator: "rows 812-886",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-customer-concentration-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Customer rebate concentration remains above the approved downside threshold.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    },
    {
      findingId: "finding-permit-transfer",
      title: "Permit transfer readiness",
      summary: "Permit transfer requires controlled completion steps before close.",
      originalAiSummary: "Permit transfer requires controlled completion steps before close.",
      materiality: "HIGH",
      status: "ACCEPTED",
      route: "TERRA",
      citations: [
        {
          citationId: "citation-permit-2049",
          evidenceId: "evidence-environmental-permit",
          locator: "Permit reference: CZ-EP-2049",
          accessible: true
        }
      ],
      textHistory: [
        {
          versionId: "finding-permit-transfer-v1",
          actorType: "AI",
          action: "GENERATED",
          summary: "Permit transfer requires controlled completion steps before close.",
          occurredAtIso: "2026-08-06T10:05:00.000Z"
        },
        {
          versionId: "finding-permit-transfer-v2",
          actorType: "HUMAN",
          action: "ACCEPTED",
          summary: "Permit transfer requires controlled completion steps before close.",
          occurredAtIso: "2026-08-06T10:10:00.000Z"
        }
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint:
        "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    }
  ];
  state.reviews = [
    {
      reviewId: "review-deal",
      reviewType: "DEAL",
      decision: "APPROVED",
      findingId: "finding-ebitda-quality",
      subjectVersion: "finding-ebitda-quality-v2"
    },
    {
      reviewId: "review-compliance",
      reviewType: "COMPLIANCE",
      decision: "APPROVED",
      findingId: "finding-customer-concentration",
      subjectVersion: "finding-customer-concentration-v1"
    }
  ];

  if (includeLegalApproval) {
    state.reviews.push({
      reviewId: "review-legal",
      reviewType: "LEGAL",
      decision: "APPROVED",
      findingId: "finding-permit-transfer",
      subjectVersion: "finding-permit-transfer-v2"
    });
  }

  return state;
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
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({
          repository,
          phase5Client: createPhase5ClientDouble()
        }),
        analysisService: new AnalysisService({
          repository,
          phase5Client: createPhase5ClientDouble()
        })
      })
    ).post("/api/scenario/reset");

    expect(response.status).toBe(200);
    expect(response.body.stage).toBe("INTAKE");
    expect(response.body.findings).toEqual([]);
  });

  it("admits evidence through the workbench endpoint", async () => {
    const response = await request(createDemoServer(testDependencies()))
      .post("/api/evidence/evidence-board-pack/admit")
      .send({ caseId: "project-danube" });

    expect(response.status).toBe(200);
    expect(response.body.scenario.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidenceId: "evidence-board-pack",
          admissionStatus: "ADMITTED",
          provenanceStatus: "VERIFIED"
        })
      ])
    );
  });

  it("rejects non-human finding dispositions", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const phase5Client = createPhase5ClientDouble();
    const analysisService = new AnalysisService({ repository, phase5Client });
    await analysisService.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-preload"
    });

    const response = await request(
      createDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({ repository, phase5Client }),
        analysisService
      })
    )
      .post("/api/findings/finding-ebitda-quality/disposition")
      .set("x-demo-principal-type", "SERVICE")
      .send({
        caseId: "project-danube",
        action: "EDIT",
        editedSummary: "Human adjusted EBITDA challenge kept for committee review."
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: "POLICY_DENIED",
      message: "A human analyst must accept, edit, challenge, or reject the finding.",
      correlationId: response.headers["x-correlation-id"]
    });
  });

  it("records a human specialist review through the review endpoint", async () => {
    const repository = new InMemoryScenarioRepository(createDecisionRoomState());
    const phase5Client = createPhase5ClientDouble();
    const reviewService = new ReviewService({ repository, phase5Client });

    const response = await request(
      createDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({ repository, phase5Client }),
        analysisService: new AnalysisService({ repository, phase5Client }),
        reviewService
      })
    )
      .post("/api/findings/finding-permit-transfer/reviews")
      .set("x-demo-principal-type", "HUMAN")
      .send({
        caseId: "project-danube",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "Permit transfer completion steps are documented."
      });

    expect(response.status).toBe(200);
    expect(response.body.scenario.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reviewType: "LEGAL",
          decision: "APPROVED",
          findingId: "finding-permit-transfer"
        })
      ])
    );
    expect(phase5Client.submitReview).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "project-danube",
        analysisRunId: "run-terra-1",
        reviewType: "LEGAL",
        decision: "APPROVED"
      })
    );
  });

  it("blocks committee-pack preparation until every required approval is recorded", async () => {
    const repository = new InMemoryScenarioRepository(createDecisionRoomState());
    const phase5Client = createPhase5ClientDouble();
    const reviewService = new ReviewService({ repository, phase5Client });

    const response = await request(
      createDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({ repository, phase5Client }),
        analysisService: new AnalysisService({ repository, phase5Client }),
        reviewService
      })
    )
      .post("/api/recommendation/prepare")
      .set("x-demo-principal-type", "HUMAN")
      .send({ caseId: "project-danube" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: "POLICY_DENIED",
      message: "LEGAL_REVIEW_REQUIRED",
      correlationId: response.headers["x-correlation-id"]
    });
  });

  it("prepares the committee-pack draft when Deal, Legal, and Compliance approve the reviewed findings", async () => {
    const repository = new InMemoryScenarioRepository(createDecisionRoomState(true));
    const phase5Client = createPhase5ClientDouble();
    const reviewService = new ReviewService({ repository, phase5Client });

    const response = await request(
      createDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({ repository, phase5Client }),
        analysisService: new AnalysisService({ repository, phase5Client }),
        reviewService
      })
    )
      .post("/api/recommendation/prepare")
      .set("x-demo-principal-type", "HUMAN")
      .send({ caseId: "project-danube" });

    expect(response.status).toBe(200);
    expect(response.body.scenario.stage).toBe("COMMITTEE_PREPARATION");
    expect(phase5Client.prepareDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: "project-danube",
        analysisRunId: "run-terra-1"
      })
    );
  });

  it("maps unknown failures to a stable fail-closed envelope", async () => {
    const response = await request(
      createDemoServer({
        scenarioService: {
          get: async () => {
            throw new Error("boom");
          },
          reset: async () => createProjectDanubeState()
        },
        evidenceService: {
          admit: async () => createProjectDanubeState()
        },
        analysisService: {
          run: async () => {
            throw new Error("boom");
          },
          recordDisposition: async () => createProjectDanubeState()
        },
        reviewService: {
          submitReview: async () => createProjectDanubeState(),
          prepareRecommendation: async () => createProjectDanubeState()
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
        evidenceIds: [
          "evidence-board-pack",
          "evidence-erp-rebates",
          "evidence-qoe-report"
        ],
        analystQuestion: "Challenge management EBITDA quality",
        modelDeploymentId: "terra",
        promptTemplateVersion: "v1",
        analysisRequestFingerprint:
          "dfec8894ed091695f8830d2894f588a468add85a89a6d7ad2ed0dd2fa6db0b7d",
        idempotencyKey: "idem-3"
      })
    ).rejects.toMatchObject({
      code: "INVALID_CONTRACT"
    });
  });
});
