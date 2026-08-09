import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { AnalysisService } from "./analysis/analysis-service.js";
import { parseAzureDemoConfig } from "./azure/azure-config.js";
import { EvidenceService } from "./evidence/evidence-service.js";
import { GovernanceService } from "./governance/governance-service.js";
import { createLocalIdentityResolver } from "./identity/identity-resolver.js";
import type { Phase5Client } from "./phase5/phase5-client.js";
import { ReviewService } from "./reviews/review-service.js";
import { InMemoryScenarioRepository } from "./scenario/in-memory-scenario-repository.js";
import { ScenarioService } from "./scenario/scenario-service.js";
import { createDemoServer, createLocalDemoServer } from "./server.js";

function testDependencies() {
  const repository = new InMemoryScenarioRepository(createProjectDanubeState());
  const phase5Client = createPhase5ClientDouble();

  return {
    scenarioService: new ScenarioService(repository),
    evidenceService: new EvidenceService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    }),
    analysisService: new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    }),
    reviewService: new ReviewService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    }),
    governanceService: new GovernanceService({ repository })
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

function trustedRequestContext() {
  return {
    identity: {
      actorId: "human-object-id",
      tenantId: "tenant-stratton-demo",
      principalType: "HUMAN" as const,
      roles: [
        "Stratton.Demo.ProjectDanube.Access",
        "Stratton.Demo.EvidenceToDecision",
        "Stratton.Demo.Analyst"
      ] as const
    },
    correlationId: "corr-phase5",
    traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00aa0ba902b7-01"
  };
}

function validAzureConfigEnvironment(): NodeJS.ProcessEnv {
  return {
    DEMO_TENANT_ID: "tenant-stratton-demo",
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "https://docint.cognitiveservices.azure.com",
    AZURE_SEARCH_ENDPOINT: "https://search.search.windows.net",
    AZURE_SEARCH_INDEX_NAME: "governed-evidence",
    AZURE_BLOB_ACCOUNT_URL: "https://storage.blob.core.windows.net",
    AZURE_BLOB_CONTAINER_NAME: "admitted-evidence",
    AZURE_SERVICE_BUS_NAMESPACE: "stratton.servicebus.windows.net",
    AZURE_SERVICE_BUS_QUEUE_NAME: "analysis-work",
    AZURE_OPENAI_LUNA_ENDPOINT: "https://stratton-luna.openai.azure.com",
    AZURE_OPENAI_LUNA_RESOURCE_ID:
      "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-luna",
    AZURE_OPENAI_LUNA_REGION: "swedencentral",
    AZURE_OPENAI_LUNA_DEPLOYMENT_ID: "luna-evidence-triage",
    AZURE_OPENAI_LUNA_API_VERSION: "2025-01-01-preview",
    AZURE_OPENAI_LUNA_EVIDENCE_ID: "SEC-EVID-LUNA-ROUTE-v1",
    AZURE_OPENAI_TERRA_ENDPOINT: "https://stratton-terra.openai.azure.com",
    AZURE_OPENAI_TERRA_RESOURCE_ID:
      "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-terra",
    AZURE_OPENAI_TERRA_REGION: "westeurope",
    AZURE_OPENAI_TERRA_DEPLOYMENT_ID: "terra-grounded-analysis",
    AZURE_OPENAI_TERRA_API_VERSION: "2025-01-01-preview",
    AZURE_OPENAI_TERRA_EVIDENCE_ID: "SEC-EVID-TERRA-ROUTE-v1",
    AZURE_OPENAI_SOL_ENDPOINT: "https://stratton-sol.openai.azure.com",
    AZURE_OPENAI_SOL_RESOURCE_ID:
      "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-sol",
    AZURE_OPENAI_SOL_REGION: "francecentral",
    AZURE_OPENAI_SOL_DEPLOYMENT_ID: "sol-thesis-challenge",
    AZURE_OPENAI_SOL_API_VERSION: "2025-01-01-preview",
    AZURE_OPENAI_SOL_EVIDENCE_ID: "SEC-EVID-SOL-ROUTE-v1"
  };
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
      subjectVersion: "finding-ebitda-quality-v2",
      projectionVersion: "finding-ebitda-quality-v2"
    },
    {
      reviewId: "review-compliance",
      reviewType: "COMPLIANCE",
      decision: "APPROVED",
      findingId: "finding-permit-transfer",
      subjectVersion: "finding-permit-transfer-v2",
      projectionVersion: "finding-permit-transfer-v2"
    }
  ];

  if (includeLegalApproval) {
    state.reviews.push({
      reviewId: "review-legal",
      reviewType: "LEGAL",
      decision: "APPROVED",
      findingId: "finding-permit-transfer",
      subjectVersion: "finding-permit-transfer-v2",
      projectionVersion: "finding-permit-transfer-v2"
    });
    const analysisRequestFingerprint =
      state.latestAnalysisRun?.analysisRequestFingerprint;
    if (!analysisRequestFingerprint) {
      throw new Error("analysis fingerprint required");
    }
    state.governanceEvents.push(
      ...Array.from({ length: 12 }, (_, index) => {
        const ordinal = String(index + 1).padStart(3, "0");
        return {
          eventId: `gate-pass-${ordinal}`,
          type: "SECURITY_GATE_EVIDENCE_RECORDED",
          outcome: "SUCCESS" as const,
          occurredAtIso: `2026-08-06T11:${String(index).padStart(2, "0")}:00.000Z`,
          correlationId: "corr-gate-suite",
          detail: `DETERMINISTIC_GATE_PASS:CC002-R2-SEC-GATE-${ordinal}`,
          metadata: {
            securityGateId: `CC002-R2-SEC-GATE-${ordinal}`,
            securityGateEvidenceId: `STRATTON-DEMO-SEC-GATE-${ordinal}-v1`,
            analysisRequestFingerprint
          }
        };
      })
    );
  }

  return state;
}

function createGovernanceRouteState() {
  const recommendationSubjectVersion =
    "48beb87818dc2e8d44de2100bd83d4250399861f9c83c11bf9d563e3f23ab50a";
  const state = createDecisionRoomState(true);
  state.stage = "COMMITTEE_PREPARATION";
  state.findings = state.findings.map((finding) =>
    finding.findingId === "finding-ebitda-quality"
      ? {
          ...finding,
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
        }
      : finding
  );
  state.governanceEvents.push(
    {
      eventId: "event-route-selected",
      type: "MODEL_ROUTE_SELECTED",
      outcome: "ALLOW",
      occurredAtIso: "2026-08-06T10:05:00.000Z",
      correlationId: "corr-analysis-1",
      detail: "TERRA",
      metadata: {
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
        evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        route: "TERRA",
        phase5RunId: "run-terra-1",
        authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
        findingIds: [
          "finding-ebitda-quality",
          "finding-customer-concentration",
          "finding-permit-transfer"
        ]
      }
    },
    {
      eventId: "event-analysis-governed",
      type: "ANALYSIS_REQUEST_GOVERNED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:05:02.000Z",
      correlationId: "corr-analysis-1",
      detail: "CROSS_DOCUMENT_COMPARISON:run-terra-1",
      metadata: {
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        questionHash: "95d4ab5821abf3ec7fa4b35f667fa5e3b71db280c5f7ab455ecb6c10f379b4e4",
        evidenceSetHash: "7a0cbdb7f6cff1ce34618a74be93fd6928840fa2712f822e7ef76a08b85c4f99",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        route: "TERRA",
        phase5RunId: "run-terra-1",
        authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE",
        findingIds: [
          "finding-ebitda-quality",
          "finding-customer-concentration",
          "finding-permit-transfer"
        ]
      }
    },
    {
      eventId: "review-deal",
      type: "SPECIALIST_REVIEW_RECORDED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:20:00.000Z",
      correlationId: "corr-review-deal",
      detail: "DEAL:APPROVED:finding-ebitda-quality",
      metadata: {
        phase5RunId: "run-terra-1",
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        findingIds: ["finding-ebitda-quality"],
        operationId: "review:DEAL:finding-ebitda-quality:finding-ebitda-quality-v2",
        payloadHash: "78dd91f93e4f745f725556085c8477c0a46fae2c7f136c8f47642c10f7e34d01",
        subjectVersion: "finding-ebitda-quality-v2"
      }
    },
    {
      eventId: "review-compliance",
      type: "SPECIALIST_REVIEW_RECORDED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:21:00.000Z",
      correlationId: "corr-review-compliance",
      detail: "COMPLIANCE:APPROVED:finding-permit-transfer",
      metadata: {
        phase5RunId: "run-terra-1",
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        findingIds: ["finding-permit-transfer"],
        operationId:
          "review:COMPLIANCE:finding-permit-transfer:finding-permit-transfer-v2",
        payloadHash: "94bdfbbeb922da545c1338c4fe1fc2b1153684f13147dd0f4c91f4fb1e27dcaa",
        subjectVersion: "finding-permit-transfer-v2"
      }
    },
    {
      eventId: "review-legal",
      type: "SPECIALIST_REVIEW_RECORDED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:22:00.000Z",
      correlationId: "corr-review-legal",
      detail: "LEGAL:APPROVED:finding-permit-transfer",
      metadata: {
        phase5RunId: "run-terra-1",
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        findingIds: ["finding-permit-transfer"],
        operationId: "review:LEGAL:finding-permit-transfer:finding-permit-transfer-v2",
        payloadHash: "d391e86d1b7530cd9254d66b41e9ac37f416138238179c7a28c4e4c57441a7ef",
        subjectVersion: "finding-permit-transfer-v2"
      }
    },
    {
      eventId: "event-committee-pack",
      type: "COMMITTEE_PACK_DRAFT_PREPARED",
      outcome: "SUCCESS",
      occurredAtIso: "2026-08-06T10:25:00.000Z",
      correlationId: "corr-committee-pack",
      detail: "run-terra-1",
      metadata: {
        phase5RunId: "run-terra-1",
        analysisRequestFingerprint:
          "9ce51afba65845db4feec598b18b180d3ce4f40353f3b8d9fa1906c80d05e55b",
        findingIds: [
          "finding-ebitda-quality",
          "finding-customer-concentration",
          "finding-permit-transfer"
        ],
        operationId:
          `draft:run-terra-1:${recommendationSubjectVersion}`,
        payloadHash: "c6f8dba0a805bd7c05cb1f25ee0dfdc87ef2fa6b2b9e90b043c28052dc0ef45d",
        subjectVersion: recommendationSubjectVersion
      }
    }
  );

  return state;
}

describe("createDemoServer", () => {
  it("returns the current Project Danube state", async () => {
    const response = await request(createLocalDemoServer(testDependencies())).get("/api/scenario");

    expect(response.status).toBe(200);
    expect(response.body.caseId).toBe("project-danube");
    expect(response.headers["x-correlation-id"]).toBeTruthy();
  });

  it("returns the governance console projection for the current Project Danube state", async () => {
    const repository = new InMemoryScenarioRepository(createGovernanceRouteState());
    const phase5Client = createPhase5ClientDouble();
    const response = await request(
      createLocalDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        analysisService: new AnalysisService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        reviewService: new ReviewService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        governanceService: new GovernanceService({ repository })
      })
    ).get("/api/governance");

    expect(response.status).toBe(200);
    expect(response.body.lineage).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "finding-ebitda-quality",
          evidenceIds: ["evidence-board-pack", "evidence-erp-rebates", "evidence-qoe-report"],
          modelRoute: "TERRA"
        })
      ])
    );
    expect(response.body.securityGates).toHaveLength(12);
    expect(response.headers["x-correlation-id"]).toBeTruthy();
  });

  it("preserves an incoming correlation id", async () => {
    const response = await request(createLocalDemoServer(testDependencies()))
      .get("/api/scenario")
      .set("x-correlation-id", "corr-123");

    expect(response.status).toBe(200);
    expect(response.headers["x-correlation-id"]).toBe("corr-123");
  });

  it("returns invalid contract for malformed json with a generated correlation id", async () => {
    const response = await request(createLocalDemoServer(testDependencies()))
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

  it("maps an invalid reset payload to the INVALID_CONTRACT envelope", async () => {
    const response = await request(createLocalDemoServer(testDependencies()))
      .post("/api/scenario/reset")
      .send({ fixture: "UNKNOWN_FIXTURE" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "INVALID_CONTRACT",
      message: "Request does not satisfy the approved contract.",
      correlationId: response.headers["x-correlation-id"]
    });
  });

  it("returns an invalid contract envelope for unmatched routes", async () => {
    const response = await request(createLocalDemoServer(testDependencies()))
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
    const mutationSnapshot = await repository.load();
    await repository.save({
      ...mutationSnapshot,
      state: {
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
      }
    });

    const response = await request(
      createLocalDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client: createPhase5ClientDouble()
        }),
        analysisService: new AnalysisService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client: createPhase5ClientDouble()
        })
      })
    ).post("/api/scenario/reset");

    expect(response.status).toBe(200);
    expect(response.body.stage).toBe("INTAKE");
    expect(response.body.findings).toEqual([]);
  });

  it("admits evidence through the workbench endpoint", async () => {
    const response = await request(createLocalDemoServer(testDependencies()))
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

  it("rejects client-controlled authority headers", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const phase5Client = createPhase5ClientDouble();
    const analysisService = new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });
    await analysisService.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-preload"
    });

    const response = await request(
      createLocalDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
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

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      code: "INVALID_CONTRACT",
      message: "CLIENT_AUTHORITY_HEADERS_NOT_ALLOWED",
      correlationId: response.headers["x-correlation-id"]
    });
  });

  it("fails closed when the trusted identity lacks the required application role", async () => {
    const response = await request(
      createDemoServer(testDependencies(), {
        identityResolver: createLocalIdentityResolver({
          actorId: "local-limited-human",
          tenantId: "local-stratton-demo",
          principalType: "HUMAN",
          roles: [
            "Stratton.Demo.ProjectDanube.Access",
            "Stratton.Demo.EvidenceToDecision"
          ]
        }),
        authorizationPolicy: {
          expectedTenantId: "local-stratton-demo",
          caseId: "project-danube",
          caseAccessRole: "Stratton.Demo.ProjectDanube.Access",
          purposeRole: "Stratton.Demo.EvidenceToDecision"
        }
      })
    )
      .post("/api/findings/finding-ebitda-quality/disposition")
      .send({
        caseId: "project-danube",
        action: "ACCEPT"
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      code: "POLICY_DENIED",
      message: "APPLICATION_ROLE_REQUIRED:Stratton.Demo.Analyst"
    });
  });

  it("records a human specialist review through the review endpoint", async () => {
    const repository = new InMemoryScenarioRepository(createDecisionRoomState());
    const phase5Client = createPhase5ClientDouble();
    const reviewService = new ReviewService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });

    const response = await request(
      createLocalDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        analysisService: new AnalysisService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        reviewService
      })
    )
      .post("/api/findings/finding-permit-transfer/reviews")
      .send({
        caseId: "project-danube",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "Permit transfer completion steps are documented.",
        subjectVersion: "finding-permit-transfer-v2"
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
        decision: "APPROVED",
        subjectVersion: "finding-permit-transfer-v2"
      })
    );
  });

  it("rejects stale review requests before forwarding them to Phase 5", async () => {
    const repository = new InMemoryScenarioRepository(createDecisionRoomState());
    const phase5Client = createPhase5ClientDouble();
    const reviewService = new ReviewService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });

    const response = await request(
      createLocalDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        analysisService: new AnalysisService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        reviewService
      })
    )
      .post("/api/findings/finding-permit-transfer/reviews")
      .send({
        caseId: "project-danube",
        reviewType: "LEGAL",
        decision: "APPROVED",
        rationale: "Permit transfer completion steps are documented.",
        subjectVersion: "finding-permit-transfer-v1"
      });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      code: "STATE_CONFLICT",
      message: "FINDING_VERSION_STALE",
      correlationId: response.headers["x-correlation-id"]
    });
    expect(phase5Client.submitReview).not.toHaveBeenCalled();
  });

  it("blocks committee-pack preparation until every required approval is recorded", async () => {
    const repository = new InMemoryScenarioRepository(createDecisionRoomState());
    const phase5Client = createPhase5ClientDouble();
    const reviewService = new ReviewService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });

    const response = await request(
      createLocalDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        analysisService: new AnalysisService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        reviewService
      })
    )
      .post("/api/recommendation/prepare")
      .send({ caseId: "project-danube" });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      code: "POLICY_DENIED",
      message: "LEGAL_REVIEW_REQUIRED:finding-permit-transfer",
      correlationId: response.headers["x-correlation-id"]
    });
  });

  it("prepares the committee-pack draft when Deal, Legal, and Compliance approve the reviewed findings", async () => {
    const repository = new InMemoryScenarioRepository(createDecisionRoomState(true));
    const phase5Client = createPhase5ClientDouble();
    const reviewService = new ReviewService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });

    const response = await request(
      createLocalDemoServer({
        scenarioService: new ScenarioService(repository),
        evidenceService: new EvidenceService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        analysisService: new AnalysisService({
          repository,
          compatibilityMode: "LEGACY_TEST_ONLY",
          phase5Client
        }),
        reviewService
      })
    )
      .post("/api/recommendation/prepare")
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
      createLocalDemoServer({
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
        PHASE5_API_BASE_URL: "https://phase5.example.test",
        DEMO_TENANT_ID: "tenant-stratton-demo",
        TRUSTED_WEB_PROXY_PRINCIPAL_ID: "web-proxy-object-id",
        PHASE5_DELEGATED_SCOPE: "api://phase5/access_as_user",
        PHASE5_APPLICATION_ID: "phase5-application-id",
        BFF_DELEGATED_AUDIENCE: "api://stratton-demo-bff",
        BFF_REQUIRED_DELEGATED_SCOPE: "access_as_user",
        ENTRA_TOKEN_ENDPOINT:
          "https://login.microsoftonline.com/tenant-stratton-demo/oauth2/v2.0/token",
        AZURE_MANAGED_IDENTITY_CLIENT_ID: "bff-managed-identity"
      })
    ).toThrowError(/AZURE_SQL_SERVER_FQDN/);
  });
});

describe("parseAzureDemoConfig", () => {
  it("requires exact Azure adapter bindings in AZURE mode", async () => {
    const { parseAzureDemoConfig } = await import("./azure/azure-config.js");
    const environment = validAzureConfigEnvironment();
    delete environment.AZURE_OPENAI_SOL_EVIDENCE_ID;

    expect(() => parseAzureDemoConfig(environment)).toThrowError(
      /AZURE_OPENAI_SOL_EVIDENCE_ID/
    );
  });

  it("ignores unrelated process environment keys while validating approved Azure bindings", async () => {
    const { parseAzureDemoConfig } = await import("./azure/azure-config.js");

    expect(
      parseAzureDemoConfig({
        ...validAzureConfigEnvironment(),
        PATH: "C:\\Windows\\System32",
        npm_lifecycle_event: "test",
        GITHUB_ACTIONS: "false"
      })
    ).toMatchObject({
      DEMO_TENANT_ID: "tenant-stratton-demo",
      AZURE_SEARCH_INDEX_NAME: "governed-evidence",
      AZURE_OPENAI_SOL_EVIDENCE_ID: "SEC-EVID-SOL-ROUTE-v1"
    });
  });
});

describe("createWorkflowClient", () => {
  it("keeps LOCAL mode on the local workflow stub", async () => {
    const { createWorkflowClient } = await import("./server.js");
    const { createRedactedLogger } = await import("./telemetry/redacted-logger.js");
    const localAuthority = {} as never;
    const supportingFactory = vi.fn();

    const client = createWorkflowClient(
      {
        PORT: 3001,
        DEMO_MODE: "LOCAL",
        PHASE5_API_BASE_URL: "https://phase5.example.test"
      },
      createRedactedLogger({ sink: () => undefined }),
      {
        createLocalDemoAuthorityClient: () => localAuthority,
        createAzureSupportingAnalysis: supportingFactory
      }
    );

    expect(client.authority).toBe(localAuthority);
    expect(supportingFactory).not.toHaveBeenCalled();
  });

  it("wires AZURE mode through HTTP Phase 5 authority before Azure supporting operations", async () => {
    const { createWorkflowClient } = await import("./server.js");
    const { createRedactedLogger } = await import("./telemetry/redacted-logger.js");
    const localAuthorityFactory = vi.fn(() => ({} as never));
    const authorityClient = {} as never;
    const supportingAnalysis = {
      afterEvidenceAdmitted: vi.fn(),
      requestAnalysis: vi.fn()
    };
    const adapters = {
      documentIntelligence: { analyseLayout: vi.fn() },
      search: { retrieve: vi.fn() },
      openAi: { analyse: vi.fn() },
      blob: { readEvidence: vi.fn(), writeSyntheticEvidence: vi.fn() },
      serviceBus: { publish: vi.fn() }
    };
    const createAzureSupportingAnalysis = vi.fn(() => supportingAnalysis);
    const createDemoAuthorityClient = vi.fn(() => authorityClient);

    const client = createWorkflowClient(
      {
        PORT: 3001,
        DEMO_MODE: "AZURE",
        PHASE5_API_BASE_URL: "https://phase5.example.test",
        DEMO_TENANT_ID: "tenant-stratton-demo",
        TRUSTED_WEB_PROXY_PRINCIPAL_ID: "web-proxy-object-id",
        AZURE_SQL_SERVER_FQDN: "sql.example.test",
        AZURE_SQL_DATABASE_NAME: "stratton",
        PHASE5_DELEGATED_SCOPE: "api://phase5/access_as_user",
        PHASE5_APPLICATION_ID: "phase5-application-id",
        BFF_DELEGATED_AUDIENCE: "api://stratton-demo-bff",
        BFF_REQUIRED_DELEGATED_SCOPE: "access_as_user",
        ENTRA_TOKEN_ENDPOINT:
          "https://login.microsoftonline.com/tenant-stratton-demo/oauth2/v2.0/token",
        AZURE_MANAGED_IDENTITY_CLIENT_ID: "bff-managed-identity"
      },
      createRedactedLogger({ sink: () => undefined }),
      {
        createLocalDemoAuthorityClient: localAuthorityFactory,
        parseAzureConfig: () =>
          parseAzureDemoConfig(validAzureConfigEnvironment()),
        createAzureAdapters: () => adapters,
        createAzureSupportingAnalysis,
        createDemoAuthorityClient
      }
    );

    expect(client.authority).toBe(authorityClient);
    expect(localAuthorityFactory).not.toHaveBeenCalled();
    expect(createAzureSupportingAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-stratton-demo",
        caseId: "project-danube",
        ...adapters
      })
    );
    expect(createDemoAuthorityClient).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "https://phase5.example.test",
        oboTokenExchange: expect.any(Object),
        getDelegatedUserToken: expect.any(Function),
        getRequestContext: expect.any(Function)
      })
    );
    expect(client.analysis).toEqual(expect.objectContaining({ run: expect.any(Function) }));
    expect(client.evidence).toEqual(expect.objectContaining({ admit: expect.any(Function) }));
  });
});

describe("initializeScenarioRepository", () => {
  it("seeds an empty durable repository once and preserves persisted state across restart", async () => {
    const { initializeScenarioRepository } = await import("./server.js");
    const { DemoHttpError } = await import("./errors.js");
    const persistedState = createProjectDanubeState();
    persistedState.stage = "REVIEW";
    let storedState: ReturnType<typeof createProjectDanubeState> | undefined;

    const repository = {
      load: vi.fn(async () => {
        if (!storedState) {
          throw new DemoHttpError(
            503,
            "DEPENDENCY_UNAVAILABLE",
            "SCENARIO_PROJECTION_NOT_FOUND"
          );
        }

        return {
          state: structuredClone(storedState),
          concurrencyToken: { kind: "ROW_VERSION" as const, value: 0 }
        };
      }),
      save: vi.fn(async () => undefined),
      reset: vi.fn(async () => undefined),
      initialize: vi.fn(async (state: ReturnType<typeof createProjectDanubeState>) => {
        storedState = structuredClone(state);
      })
    };

    await initializeScenarioRepository(repository);
    storedState = structuredClone(persistedState);
    await initializeScenarioRepository(repository);

    expect(repository.initialize).toHaveBeenCalledTimes(1);
    expect((await repository.load()).state).toEqual(persistedState);
  });

  it("does not reset when durable state already exists", async () => {
    const { initializeScenarioRepository } = await import("./server.js");
    const persistedState = createProjectDanubeState();
    persistedState.stage = "ANALYSIS";
    const repository = {
      load: vi.fn(async () => ({
        state: structuredClone(persistedState),
        concurrencyToken: { kind: "ROW_VERSION" as const, value: 0 }
      })),
      save: vi.fn(async () => undefined),
      reset: vi.fn(async () => undefined),
      initialize: vi.fn(async () => undefined)
    };

    await initializeScenarioRepository(repository);

    expect(repository.initialize).not.toHaveBeenCalled();
    expect((await repository.load()).state).toEqual(persistedState);
  });
});

describe("createPhase5Client", () => {
  it("forwards the human bearer token, traceparent, and idempotency key", async () => {
    const { createPhase5Client } = await import("./phase5/phase5-client.js");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));

    const client = createPhase5Client({
      baseUrl: "https://phase5.example.test",
      getAccessToken: async () => "managed-identity-token",
      getRequestContext: trustedRequestContext,
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
          authorization: "Bearer managed-identity-token",
          traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00aa0ba902b7-01",
          "idempotency-key": "idem-1",
          "x-correlation-id": "corr-phase5",
          "x-stratton-actor-id": "human-object-id",
          "x-stratton-tenant-id": "tenant-stratton-demo",
          "x-stratton-case-id": "project-danube",
          "x-stratton-purpose": "EVIDENCE_TO_DECISION",
          "x-stratton-roles": JSON.stringify([
            "Stratton.Demo.ProjectDanube.Access",
            "Stratton.Demo.EvidenceToDecision",
            "Stratton.Demo.Analyst"
          ])
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
      getAccessToken: async () => "managed-identity-token",
      getRequestContext: trustedRequestContext,
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
      getAccessToken: async () => "managed-identity-token",
      getRequestContext: trustedRequestContext,
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
