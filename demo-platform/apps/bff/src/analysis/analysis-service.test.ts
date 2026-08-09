import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AnalysisFinding } from "@stratton/contracts";
import { createProjectDanubeState } from "@stratton/scenario-data";
import { DemoHttpError } from "../errors.js";
import type { DemoAuthorityClient } from "../phase5/demo-authority-client.js";
import type { Phase5Client } from "../phase5/phase5-client.js";
import {
  createAuthoritativeBundleWorkflowClient,
  type AuthoritativeBundleWorkflowClient
} from "../phase5/governed-workflow-client.js";
import { InMemoryScenarioRepository } from "../scenario/in-memory-scenario-repository.js";
import { AnalysisService } from "./analysis-service.js";
import { routeTask } from "./model-router.js";

function createAdmittedState() {
  const state = createProjectDanubeState();
  state.evidence = state.evidence.map((evidence) => ({
    ...evidence,
    admissionStatus: "ADMITTED",
    provenanceStatus: "VERIFIED"
  }));
  return state;
}

function createCoreAdmittedState() {
  const state = createProjectDanubeState();
  state.evidence = state.evidence.map((evidence) =>
    evidence.evidenceId === "evidence-environmental-permit"
      ? evidence
      : {
          ...evidence,
          admissionStatus: "ADMITTED",
          provenanceStatus: "VERIFIED"
        }
  );
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

function createAuthoritativeBundleWorkflowDouble(): AuthoritativeBundleWorkflowClient {
  return {
    run: vi.fn(async (input) => {
      const evidence = input.evidenceIds.map((evidenceId, index) => ({
        evidenceId,
        evidenceVersionId: `${evidenceId}-v1`,
        ordinal: index + 1
      }));
      const evidenceManifestHash = createHash("sha256")
        .update(JSON.stringify({ tenantId: input.tenantId, caseId: input.caseId, evidence }))
        .digest("hex");
      const completion = input.complete({
        tenantId: input.tenantId,
        caseId: input.caseId,
        analysisBundleId: input.analysisBundleId,
        evidenceManifestHash,
        modelRoute: input.modelRoute,
        modelDeploymentId: input.modelDeploymentId,
        routeEvidenceId: input.routeEvidenceId,
        promptTemplateVersion: input.promptTemplateVersion,
        requestFingerprint: input.requestFingerprint,
        status: "QUEUED",
        outputKind: "DRAFT_ONLY",
        unsupportedClaims: 0,
        evidence,
        citationCounts: {
          totalClaims: 3,
          citedClaims: 3,
          materialClaims: 2,
          citedMaterialClaims: 2,
          unsupportedClaims: 0
        }
      });
      return {
        tenantId: input.tenantId,
        caseId: input.caseId,
        analysisBundleId: input.analysisBundleId,
        evidenceManifestHash,
        modelRoute: input.modelRoute,
        modelDeploymentId: input.modelDeploymentId,
        routeEvidenceId: input.routeEvidenceId,
        promptTemplateVersion: input.promptTemplateVersion,
        requestFingerprint: input.requestFingerprint,
        status: "DRAFT_ONLY_READY",
        outputKind: "DRAFT_ONLY",
        unsupportedClaims: completion.citationCounts.unsupportedClaims,
        subjectVersion: completion.outputManifestHash,
        evidence,
        citationCounts: {
          totalClaims: 3,
          citedClaims: 3,
          materialClaims: 2,
          citedMaterialClaims: 2,
          unsupportedClaims: 0
        }
      };
    })
  };
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
  it("projects findings only after a ready authoritative bundle supplies its subject version", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const authoritativeWorkflow = createAuthoritativeBundleWorkflowDouble();
    const service = new AnalysisService({
      repository,
      authoritativeWorkflow
    });

    const result = await service.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-authoritative-bundle"
    });
    expect(authoritativeWorkflow.run).toHaveBeenCalledTimes(1);
    expect(authoritativeWorkflow.run).toHaveBeenCalledTimes(1);
    expect(result.scenario.analysisAuthority).toEqual(
      expect.objectContaining({
        analysisBundleId: expect.stringMatching(/^bundle-/),
        subjectVersion: expect.stringMatching(/^[a-f0-9]{64}$/),
        status: "DRAFT_ONLY_READY"
      })
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          findingId: "finding-ebitda-quality",
          projectionVersion: expect.stringMatching(/^[a-f0-9]{64}$/)
        })
      ])
    );
  });

  it("changes the authoritative local projection version after a human edit", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const service = new AnalysisService({
      repository,
      authoritativeWorkflow: createAuthoritativeBundleWorkflowDouble()
    });

    const analysis = await service.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-authoritative-edit"
    });
    const before = getFinding(analysis.findings, "finding-ebitda-quality") as AnalysisFinding & {
      projectionVersion?: string;
    };

    const edited = await service.recordDisposition({
      caseId: "project-danube",
      findingId: "finding-ebitda-quality",
      action: "EDIT",
      editedSummary: "Human adjusted EBITDA challenge kept for committee review.",
      principalType: "HUMAN",
      correlationId: "corr-authoritative-edit"
    });
    const after = getFinding(edited.findings, "finding-ebitda-quality") as AnalysisFinding & {
      projectionVersion?: string;
    };

    expect(edited.analysisAuthority?.subjectVersion).toBe(
      analysis.scenario.analysisAuthority?.subjectVersion
    );
    expect(before.projectionVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(after.projectionVersion).toMatch(/^[a-f0-9]{64}$/);
    expect(after.projectionVersion).not.toBe(before.projectionVersion);
  });

  it("returns the existing authoritative bundle projection for a repeated fingerprint", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const authoritativeWorkflow = createAuthoritativeBundleWorkflowDouble();
    const service = new AnalysisService({
      repository,
      authoritativeWorkflow
    });
    const input = {
      caseId: "project-danube" as const,
      taskClass: "CROSS_DOCUMENT_COMPARISON" as const,
      question: "Challenge management EBITDA quality",
      correlationId: "corr-repeat-authoritative-bundle"
    };

    const first = await service.run(input);
    const second = await service.run(input);

    expect(authoritativeWorkflow.run).toHaveBeenCalledTimes(2);
    expect(second).toEqual({
      ...first,
      correlationId: "corr-repeat-authoritative-bundle"
    });
  });

  it("rehydrates a missing local projection from a matching ready authoritative bundle", async () => {
    const sourceRepository = new InMemoryScenarioRepository(createAdmittedState());
    const sourceWorkflow = createAuthoritativeBundleWorkflowDouble();
    const sourceService = new AnalysisService({
      repository: sourceRepository,
      authoritativeWorkflow: sourceWorkflow
    });
    const input = {
      caseId: "project-danube" as const,
      taskClass: "CROSS_DOCUMENT_COMPARISON" as const,
      question: "Challenge management EBITDA quality",
      correlationId: "corr-ready-replay"
    };
    const source = await sourceService.run(input);
    const readyBundle = {
      ...(await vi.mocked(sourceWorkflow.run).mock.results[0]!.value),
      tenantId: "local-stratton-demo",
      caseId: "project-danube",
      analysisBundleId: source.analysisRunId,
      evidenceManifestHash: source.scenario.analysisAuthority!.evidenceManifestHash,
      modelRoute: "TERRA" as const,
      modelDeploymentId: "terra-grounded-analysis",
      routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      promptTemplateVersion: source.analysisMetadata.promptTemplateVersion,
      requestFingerprint: source.analysisMetadata.analysisRequestFingerprint,
      status: "DRAFT_ONLY_READY" as const,
      outputKind: "DRAFT_ONLY" as const,
      unsupportedClaims: 0,
      subjectVersion: source.scenario.analysisAuthority!.subjectVersion,
      evidence: source.analysisMetadata.admittedEvidenceIds.map((evidenceId, index) => ({
        evidenceId,
        evidenceVersionId: `${evidenceId}-v1`,
        ordinal: index + 1
      })),
      citationCounts: {
        totalClaims: source.findings.length,
        citedClaims: source.findings.length,
        materialClaims: source.findings.filter(
          (finding) => finding.materiality === "HIGH" || finding.materiality === "CRITICAL"
        ).length,
        citedMaterialClaims: source.findings.filter(
          (finding) => finding.materiality === "HIGH" || finding.materiality === "CRITICAL"
        ).length,
        unsupportedClaims: 0
      }
    };
    const replayWorkflow: AuthoritativeBundleWorkflowClient = {
      run: vi.fn(async () => readyBundle)
    };
    const replayRepository = new InMemoryScenarioRepository(createAdmittedState());
    const replayService = new AnalysisService({
      repository: replayRepository,
      authoritativeWorkflow: replayWorkflow
    });

    const replayed = await replayService.run(input);

    expect(replayed.findings).toHaveLength(source.findings.length);
    expect(replayed.scenario.analysisAuthority).toEqual(source.scenario.analysisAuthority);
  });

  it("revalidates authoritative status before returning a cached local projection", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const authoritativeWorkflow = createAuthoritativeBundleWorkflowDouble();
    const service = new AnalysisService({
      repository,
      authoritativeWorkflow
    });
    const input = {
      caseId: "project-danube" as const,
      taskClass: "CROSS_DOCUMENT_COMPARISON" as const,
      question: "Challenge management EBITDA quality",
      correlationId: "corr-authority-revalidation"
    };
    await service.run(input);
    vi.mocked(authoritativeWorkflow.run).mockRejectedValueOnce(
      new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_BUNDLE_NOT_READY_FOR_LOCAL_PROJECTION")
    );

    await expect(service.run(input)).rejects.toMatchObject({
      message: "ANALYSIS_BUNDLE_NOT_READY_FOR_LOCAL_PROJECTION"
    });
    expect(authoritativeWorkflow.run).toHaveBeenCalledTimes(2);
  });

  it("tenant-scopes deterministic bundle identity for the same request fingerprint", async () => {
    const firstWorkflow = createAuthoritativeBundleWorkflowDouble();
    const secondWorkflow = createAuthoritativeBundleWorkflowDouble();
    const firstService = new AnalysisService({
      repository: new InMemoryScenarioRepository(createAdmittedState()),
      authoritativeWorkflow: firstWorkflow,
      getTenantId: () => "tenant-one"
    } as ConstructorParameters<typeof AnalysisService>[0]);
    const secondService = new AnalysisService({
      repository: new InMemoryScenarioRepository(createAdmittedState()),
      authoritativeWorkflow: secondWorkflow,
      getTenantId: () => "tenant-two"
    } as ConstructorParameters<typeof AnalysisService>[0]);
    const input = {
      caseId: "project-danube" as const,
      taskClass: "CROSS_DOCUMENT_COMPARISON" as const,
      question: "Challenge management EBITDA quality",
      correlationId: "corr-tenant-bundle"
    };

    await firstService.run(input);
    await secondService.run(input);

    expect(vi.mocked(firstWorkflow.run).mock.calls[0]?.[0].analysisBundleId).not.toBe(
      vi.mocked(secondWorkflow.run).mock.calls[0]?.[0].analysisBundleId
    );
  });

  it("validates citations and derives unsupported claims before authority completion", async () => {
    const authority = {
      admitEvidence: vi.fn(),
      createAnalysisBundle: vi.fn(async (input) => {
        const evidence = input.evidenceIds.map((evidenceId, index) => ({
          evidenceId,
          evidenceVersionId: `${evidenceId}-v1`,
          ordinal: index + 1
        }));
        return {
          ...input,
          evidenceManifestHash: createHash("sha256")
            .update(
              JSON.stringify({
                tenantId: input.tenantId,
                caseId: input.caseId,
                evidence
              })
            )
            .digest("hex"),
          status: "QUEUED" as const,
          outputKind: "DRAFT_ONLY" as const,
          unsupportedClaims: 0,
          evidence,
          citationCounts: {
            totalClaims: 0,
            citedClaims: 0,
            materialClaims: 0,
            citedMaterialClaims: 0,
            unsupportedClaims: 0
          }
        };
      }),
      completeAnalysisBundle: vi.fn(),
      getAnalysisBundle: vi.fn(),
      submitBundleReview: vi.fn(),
      prepareBundleDraft: vi.fn(),
      getModelRouteEvidence: vi.fn()
    };
    const { createAuthoritativeBundleWorkflowClient } = await import(
      "../phase5/governed-workflow-client.js"
    );
    const service = new AnalysisService({
      repository: new InMemoryScenarioRepository(createAdmittedState()),
      authoritativeWorkflow: createAuthoritativeBundleWorkflowClient({
        authority,
        supporting: { requestAnalysis: vi.fn(async () => undefined) }
      }),
      createFindings: (input: Parameters<NonNullable<ConstructorParameters<typeof AnalysisService>[0]["createFindings"]>>[0]) => [
        {
          findingId: "finding-invalid-citation",
          title: "Invalid citation",
          summary: "This claim cites evidence outside the authoritative manifest.",
          materiality: "HIGH",
          status: "DRAFT",
          route: input.analysisMetadata.route,
          citations: [
            {
              citationId: "citation-invalid",
              evidenceId: "evidence-not-in-bundle",
              locator: "page 1",
              accessible: true
            }
          ],
          originalAiSummary: "This claim cites evidence outside the authoritative manifest.",
          textHistory: [],
          analysisRunId: input.analysisMetadata.analysisRunId,
          analysisRequestFingerprint: input.analysisMetadata.analysisRequestFingerprint,
          authorityGateRole: input.analysisMetadata.authorityGateRole
        }
      ]
    } as ConstructorParameters<typeof AnalysisService>[0]);

    await expect(
      service.run({
        caseId: "project-danube",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality",
        correlationId: "corr-citation-assessment"
      })
    ).rejects.toMatchObject({ code: "EVIDENCE_INCOMPLETE" });
    expect(authority.completeAnalysisBundle).not.toHaveBeenCalled();
  });

  it("fails closed when constructed without an authoritative workflow", () => {
    expect(
      () =>
        new AnalysisService({
          repository: new InMemoryScenarioRepository(createAdmittedState())
        } as never)
    ).toThrow("ANALYSIS_AUTHORITY_REQUIRED");
  });

  it("does not project local success when authoritative completion fails", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const service = new AnalysisService({
      repository,
      authoritativeWorkflow: {
        run: vi.fn(async () => {
          throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "COMPLETION_FAILED");
        })
      }
    });

    await expect(
      service.run({
        caseId: "project-danube",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality",
        correlationId: "corr-completion-failure"
      })
    ).rejects.toMatchObject({ message: "COMPLETION_FAILED" });
    expect((await repository.load()).state.findings).toEqual([]);
  });

  it("does not expose findings without an authoritative subject version", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const service = new AnalysisService({
      repository,
      authoritativeWorkflow: {
        run: vi.fn(async (input) => {
          const evidence = input.evidenceIds.map((evidenceId, index) => ({
            evidenceId,
            evidenceVersionId: `${evidenceId}-v1`,
            ordinal: index + 1
          }));
          const evidenceManifestHash = createHash("sha256")
            .update(JSON.stringify({ tenantId: input.tenantId, caseId: input.caseId, evidence }))
            .digest("hex");
          input.complete({
            tenantId: input.tenantId,
            caseId: input.caseId,
            analysisBundleId: input.analysisBundleId,
            evidenceManifestHash,
            modelRoute: input.modelRoute,
            modelDeploymentId: input.modelDeploymentId,
            routeEvidenceId: input.routeEvidenceId,
            promptTemplateVersion: input.promptTemplateVersion,
            requestFingerprint: input.requestFingerprint,
            status: "QUEUED",
            outputKind: "DRAFT_ONLY",
            unsupportedClaims: 0,
            evidence,
            citationCounts: {
              totalClaims: 0,
              citedClaims: 0,
              materialClaims: 0,
              citedMaterialClaims: 0,
              unsupportedClaims: 0
            }
          });
          return {
            tenantId: input.tenantId,
            caseId: input.caseId,
            analysisBundleId: input.analysisBundleId,
            evidenceManifestHash,
            modelRoute: input.modelRoute,
            modelDeploymentId: input.modelDeploymentId,
            routeEvidenceId: input.routeEvidenceId,
            promptTemplateVersion: input.promptTemplateVersion,
            requestFingerprint: input.requestFingerprint,
            status: "DRAFT_ONLY_READY" as const,
            outputKind: "DRAFT_ONLY" as const,
            unsupportedClaims: 0,
            evidence,
            citationCounts: {
              totalClaims: 0,
              citedClaims: 0,
              materialClaims: 0,
              citedMaterialClaims: 0,
              unsupportedClaims: 0
            }
          };
        })
      }
    });

    await expect(
      service.run({
        caseId: "project-danube",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality",
        correlationId: "corr-subject-version-missing"
      })
    ).rejects.toMatchObject({ message: "ANALYSIS_BUNDLE_SUBJECT_VERSION_REQUIRED" });
    expect((await repository.load()).state.findings).toEqual([]);
  });

  it("blocks an EBITDA finding when one cited source is not admitted", async () => {
    const state = createAdmittedState();
    state.evidence = state.evidence.map((evidence) =>
      evidence.evidenceId === "evidence-erp-rebates"
        ? { ...evidence, admissionStatus: "QUARANTINED" }
        : evidence
    );

    const service = new AnalysisService({
      repository: new InMemoryScenarioRepository(state),
      compatibilityMode: "LEGACY_TEST_ONLY",
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
    const service = new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });

    const result = await service.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-terra-1"
    });

    expect(result.route).toBe("TERRA");
    expect(result.analysisRunId).toBe("run-terra-1");
    expect(result.analysisMetadata).toMatchObject({
      analysisRunId: "run-terra-1",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      route: "TERRA",
      analystQuestion: "Challenge management EBITDA quality",
      admittedEvidenceIds: [
        "evidence-board-pack",
        "evidence-environmental-permit",
        "evidence-erp-rebates",
        "evidence-qoe-report"
      ],
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
    });
    expect(result.analysisMetadata.analysisRequestFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(result.analysisMetadata.questionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.analysisMetadata.evidenceSetHash).toMatch(/^[a-f0-9]{64}$/);
    expect(phase5Client.requestAnalysis).toHaveBeenCalledWith({
      caseId: "project-danube",
      evidenceIds: [
        "evidence-board-pack",
        "evidence-environmental-permit",
        "evidence-erp-rebates",
        "evidence-qoe-report"
      ],
      analystQuestion: "Challenge management EBITDA quality",
      route: "TERRA",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      modelDeploymentId: "terra-grounded-analysis",
      promptTemplateVersion: `stratton-workbench-v2:${result.analysisMetadata.analysisRequestFingerprint}`,
      analysisRequestFingerprint: result.analysisMetadata.analysisRequestFingerprint,
      idempotencyKey: `analysis:${result.analysisMetadata.analysisRequestFingerprint}`,
      correlationId: "corr-terra-1"
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
      ],
      analysisRunId: "run-terra-1",
      analysisRequestFingerprint: result.analysisMetadata.analysisRequestFingerprint,
      authorityGateRole: "HUMAN_ANALYST_REVIEW_GATE"
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

    const savedState = (await repository.load()).state;
    expect(savedState.stage).toBe("ANALYSIS");
    expect(savedState.findings.map((finding) => finding.findingId)).toEqual([
      "finding-ebitda-quality",
      "finding-customer-concentration",
      "finding-permit-transfer"
    ]);
    expect(
      savedState.findings.find(
        (finding) => finding.findingId === "finding-customer-concentration"
      )
    ).toMatchObject({
      summary:
        "Top-three customer rebate exposure is 18%, above the approved 12% downside threshold.",
      citations: [
        expect.objectContaining({
          evidenceId: "evidence-board-pack",
          locator: "page 43"
        })
      ]
    });
    expect(
      savedState.findings.find((finding) => finding.findingId === "finding-permit-transfer")
    ).toMatchObject({
      summary:
        "Permit CZ-EP-2049 requires Form T-17 filing and regulator written acknowledgement before closing.",
      citations: [
        expect.objectContaining({
          evidenceId: "evidence-environmental-permit",
          locator: "Transfer condition, steps 1-2"
        })
      ]
    });
    expect(savedState.governanceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "MODEL_ROUTE_SELECTED",
          outcome: "ALLOW",
          correlationId: "corr-terra-1",
          detail: "TERRA",
          metadata: {
            analysisRequestFingerprint: result.analysisMetadata.analysisRequestFingerprint,
            questionHash: result.analysisMetadata.questionHash,
            evidenceSetHash: result.analysisMetadata.evidenceSetHash,
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
        }),
        expect.objectContaining({
          type: "ANALYSIS_POLICY_CHECK",
          outcome: "ALLOW",
          correlationId: "corr-terra-1",
          metadata: {
            analysisRequestFingerprint: result.analysisMetadata.analysisRequestFingerprint,
            questionHash: result.analysisMetadata.questionHash,
            evidenceSetHash: result.analysisMetadata.evidenceSetHash,
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
        }),
        expect.objectContaining({
          type: "ANALYSIS_CORRELATED",
          outcome: "SUCCESS",
          correlationId: "corr-terra-1",
          detail: "run-terra-1"
        }),
        expect.objectContaining({
          type: "ANALYSIS_REQUEST_GOVERNED",
          outcome: "SUCCESS",
          correlationId: "corr-terra-1",
          metadata: {
            analysisRequestFingerprint: result.analysisMetadata.analysisRequestFingerprint,
            questionHash: result.analysisMetadata.questionHash,
            evidenceSetHash: result.analysisMetadata.evidenceSetHash,
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
        })
      ])
    );
  });

  it("does not require permit evidence for the EBITDA flow and suppresses the permit finding until admitted", async () => {
    const repository = new InMemoryScenarioRepository(createCoreAdmittedState());
    const phase5Client = createPhase5ClientDouble();
    const service = new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });

    const result = await service.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-core-only"
    });

    expect(result.findings.map((finding) => finding.findingId)).toEqual([
      "finding-ebitda-quality",
      "finding-customer-concentration"
    ]);
    expect(result.analysisMetadata.admittedEvidenceIds).toEqual([
      "evidence-board-pack",
      "evidence-erp-rebates",
      "evidence-qoe-report"
    ]);
  });

  it("rejects reruns when governed findings already carry text history and no versioned cycle exists", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const service = new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client: createPhase5ClientDouble()
    });

    await service.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-first-run"
    });

    await expect(
      service.run({
        caseId: "project-danube",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality",
        correlationId: "corr-rerun"
      })
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: expect.stringContaining("versioned cycle")
    });
  });

  it("blocks an authoritative rerun before bundle creation, Azure work, or completion", async () => {
    let readyBundle: Awaited<ReturnType<DemoAuthorityClient["getAnalysisBundle"]>> | undefined;
    const createAnalysisBundle = vi.fn<DemoAuthorityClient["createAnalysisBundle"]>(async (input) => {
      const evidence = input.evidenceIds.map((evidenceId, index) => ({
        evidenceId,
        evidenceVersionId: `${evidenceId}-v1`,
        ordinal: index + 1
      }));
      return {
        ...input,
        evidenceManifestHash: createHash("sha256")
          .update(JSON.stringify({ tenantId: input.tenantId, caseId: input.caseId, evidence }))
          .digest("hex"),
        status: "QUEUED",
        outputKind: "DRAFT_ONLY",
        unsupportedClaims: 0,
        evidence,
        citationCounts: {
          totalClaims: 0,
          citedClaims: 0,
          materialClaims: 0,
          citedMaterialClaims: 0,
          unsupportedClaims: 0
        }
      };
    });
    const completeAnalysisBundle = vi.fn<DemoAuthorityClient["completeAnalysisBundle"]>(
      async (input) => {
        const accepted = await createAnalysisBundle.mock.results.at(-1)?.value;
        if (!accepted) {
          throw new Error("accepted bundle missing");
        }
        readyBundle = {
          ...accepted,
          status: "DRAFT_ONLY_READY",
          subjectVersion: input.outputManifestHash,
          unsupportedClaims: input.citationCounts.unsupportedClaims,
          citationCounts: input.citationCounts
        };
        return readyBundle;
      }
    );
    const getAnalysisBundle = vi.fn<DemoAuthorityClient["getAnalysisBundle"]>(async () => {
      if (!readyBundle) {
        throw new Error("ready bundle missing");
      }
      return readyBundle;
    });
    const authority = {
      admitEvidence: vi.fn(),
      createAnalysisBundle,
      completeAnalysisBundle,
      getAnalysisBundle,
      submitBundleReview: vi.fn(),
      prepareBundleDraft: vi.fn(),
      getModelRouteEvidence: vi.fn()
    } satisfies DemoAuthorityClient;
    const requestAnalysis = vi.fn(async () => undefined);
    const service = new AnalysisService({
      repository: new InMemoryScenarioRepository(createAdmittedState()),
      authoritativeWorkflow: createAuthoritativeBundleWorkflowClient({
        authority,
        supporting: { requestAnalysis }
      })
    });
    const input = {
      caseId: "project-danube" as const,
      taskClass: "CROSS_DOCUMENT_COMPARISON" as const,
      question: "Challenge management EBITDA quality",
      correlationId: "corr-authoritative-rerun"
    };

    await service.run(input);
    await service.recordDisposition({
      caseId: "project-danube",
      findingId: "finding-ebitda-quality",
      action: "EDIT",
      editedSummary: "Human-edited governed finding.",
      principalType: "HUMAN",
      correlationId: "corr-authoritative-edit"
    });
    createAnalysisBundle.mockClear();
    completeAnalysisBundle.mockClear();
    getAnalysisBundle.mockClear();
    requestAnalysis.mockClear();

    await expect(service.run(input)).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: expect.stringContaining("versioned cycle")
    });
    expect(createAnalysisBundle).not.toHaveBeenCalled();
    expect(requestAnalysis).not.toHaveBeenCalled();
    expect(completeAnalysisBundle).not.toHaveBeenCalled();
    expect(getAnalysisBundle).not.toHaveBeenCalled();
  });

  it("changes the governed analysis fingerprint when the question or admitted evidence set changes", async () => {
    const firstResult = await new AnalysisService({
      repository: new InMemoryScenarioRepository(createCoreAdmittedState()),
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client: createPhase5ClientDouble()
    }).run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-fingerprint-1"
    });

    const secondResult = await new AnalysisService({
      repository: new InMemoryScenarioRepository(createCoreAdmittedState()),
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client: createPhase5ClientDouble()
    }).run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Pressure-test the EBITDA normalization bridge",
      correlationId: "corr-fingerprint-2"
    });

    const thirdResult = await new AnalysisService({
      repository: new InMemoryScenarioRepository(createAdmittedState()),
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client: createPhase5ClientDouble()
    }).run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-fingerprint-3"
    });

    expect(firstResult.analysisMetadata.analysisRequestFingerprint).not.toBe(
      secondResult.analysisMetadata.analysisRequestFingerprint
    );
    expect(firstResult.analysisMetadata.analysisRequestFingerprint).not.toBe(
      thirdResult.analysisMetadata.analysisRequestFingerprint
    );
    expect(firstResult.analysisMetadata.questionHash).not.toBe(secondResult.analysisMetadata.questionHash);
    expect(firstResult.analysisMetadata.evidenceSetHash).not.toBe(
      thirdResult.analysisMetadata.evidenceSetHash
    );
  });

  it("retries a stale save without repeating the governed analysis request", async () => {
    const initialState = createAdmittedState();
    let loadCount = 0;
    let savedState = createAdmittedState();
    const repository = {
      load: vi.fn(async () => {
        loadCount += 1;
        return {
          state: structuredClone(loadCount === 1 ? initialState : savedState),
          concurrencyToken: { kind: "ROW_VERSION" as const, value: loadCount - 1 }
        };
      }),
      save: vi
        .fn()
        .mockRejectedValueOnce(new DemoHttpError(409, "STATE_CONFLICT", "SCENARIO_PROJECTION_VERSION_STALE"))
        .mockImplementationOnce(async (snapshot) => {
          savedState = structuredClone(snapshot.state);
        }),
      reset: vi.fn(async () => undefined)
    };
    const phase5Client = createPhase5ClientDouble();
    const service = new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });

    const result = await service.run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Challenge management EBITDA quality",
      correlationId: "corr-terra-retry"
    });

    expect(phase5Client.requestAnalysis).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(result.analysisRunId).toBe("run-terra-1");
    expect(result.scenario.stage).toBe("ANALYSIS");
  });

  it("fails closed on stale-save retry when a different governed analysis has already won", async () => {
    const concurrentPhase5Client = createPhase5ClientDouble();
    concurrentPhase5Client.requestAnalysis.mockResolvedValueOnce({
      analysisRunId: "run-terra-2",
      status: "QUEUED"
    });
    const concurrentResult = await new AnalysisService({
      repository: new InMemoryScenarioRepository(createAdmittedState()),
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client: concurrentPhase5Client
    }).run({
      caseId: "project-danube",
      taskClass: "CROSS_DOCUMENT_COMPARISON",
      question: "Pressure-test the EBITDA normalization bridge",
      correlationId: "corr-concurrent-winner"
    });

    const initialState = createAdmittedState();
    let loadCount = 0;
    let savedState = structuredClone(concurrentResult.scenario);
    const repository = {
      load: vi.fn(async () => {
        loadCount += 1;
        return {
          state: structuredClone(loadCount === 1 ? initialState : savedState),
          concurrencyToken: { kind: "ROW_VERSION" as const, value: loadCount - 1 }
        };
      }),
      save: vi
        .fn()
        .mockImplementationOnce(async () => {
          throw new DemoHttpError(409, "STATE_CONFLICT", "SCENARIO_PROJECTION_VERSION_STALE");
        })
        .mockImplementationOnce(async (snapshot) => {
          savedState = structuredClone(snapshot.state);
        }),
      reset: vi.fn(async () => undefined)
    };
    const phase5Client = createPhase5ClientDouble();
    const service = new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
      phase5Client
    });

    await expect(
      service.run({
        caseId: "project-danube",
        taskClass: "CROSS_DOCUMENT_COMPARISON",
        question: "Challenge management EBITDA quality",
        correlationId: "corr-terra-stale-other"
      })
    ).rejects.toMatchObject({
      code: "STATE_CONFLICT",
      message: expect.stringContaining("versioned cycle")
    });

    expect(phase5Client.requestAnalysis).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(savedState).toEqual(concurrentResult.scenario);
  });

  it("requires a human disposition and preserves immutable AI text when the finding is edited", async () => {
    const repository = new InMemoryScenarioRepository(createAdmittedState());
    const service = new AnalysisService({
      repository,
      compatibilityMode: "LEGACY_TEST_ONLY",
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
