import { createHash, randomUUID } from "node:crypto";
import type {
  AnalysisFinding,
  AnalysisRunMetadata,
  AnalysisRunRequest,
  AnalysisRunResponse,
  AnalysisTaskClass,
  AuthorityGateRole,
  FindingDispositionAction,
  FindingDispositionRequest,
  FindingTextVersion,
  ModelRoute,
  ScenarioState
} from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { AuthoritativeBundleWorkflowClient } from "../phase5/governed-workflow-client.js";
import type { Phase5Client } from "../phase5/phase5-client.js";
import type { ScenarioRepository } from "../scenario/scenario-repository.js";
import { routeTask } from "./model-router.js";

const requiredCoreEvidenceIds = [
  "evidence-board-pack",
  "evidence-erp-rebates",
  "evidence-qoe-report"
] as const;

const modelDeploymentByRoute: Readonly<Record<ModelRoute, string>> = {
  LUNA: "luna-evidence-triage",
  TERRA: "terra-grounded-analysis",
  SOL: "sol-thesis-challenge"
};
const routeEvidenceIdByRoute: Readonly<Record<ModelRoute, string>> = {
  LUNA: "SEC-EVID-LUNA-ROUTE-v1",
  TERRA: "SEC-EVID-TERRA-ROUTE-v1",
  SOL: "SEC-EVID-SOL-ROUTE-v1"
};
const promptTemplateVersionPrefix = "stratton-workbench-v2";
const humanAnalystAuthorityGateRole: AuthorityGateRole = "HUMAN_ANALYST_REVIEW_GATE";
const rerunConflictMessage =
  "Analysis rerun is blocked because governed findings already contain text history or human dispositions. Create a versioned cycle before rerunning.";

interface AnalysisServiceDependencies {
  readonly repository: ScenarioRepository;
  readonly phase5Client?: Phase5Client;
  readonly authoritativeWorkflow?: AuthoritativeBundleWorkflowClient;
  readonly getTenantId?: () => string;
  readonly createId?: () => string;
  readonly now?: () => string;
}

interface RunAnalysisInput extends Omit<AnalysisRunRequest, "caseId"> {
  readonly caseId: string;
  readonly correlationId: string;
}

interface RecordDispositionInput extends Omit<FindingDispositionRequest, "caseId"> {
  readonly caseId: string;
  readonly findingId: string;
  readonly principalType: "HUMAN" | "SERVICE";
  readonly correlationId: string;
}

export class AnalysisService {
  private readonly createId: () => string;
  private readonly now: () => string;
  private readonly getTenantId: () => string;

  public constructor(private readonly dependencies: AnalysisServiceDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.getTenantId = dependencies.getTenantId ?? (() => "local-stratton-demo");
  }

  public async run(input: RunAnalysisInput): Promise<AnalysisRunResponse> {
    const route = routeTask(input.taskClass);
    let analysisArtifacts:
      | {
          readonly metadata: AnalysisRunMetadata;
          readonly findings: readonly AnalysisFinding[];
          readonly response: { analysisRunId: string; status: "QUEUED" };
          readonly analysisAuthority?: NonNullable<ScenarioState["analysisAuthority"]>;
        }
      | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const snapshot = await this.dependencies.repository.load();
      const state = snapshot.state;
      assertCaseId(state, input.caseId);

      if (state.analysisAuthority && state.latestAnalysisRun) {
        const requestedMetadata = createAnalysisRunMetadata({
          caseId: input.caseId,
          taskClass: input.taskClass,
          route,
          analystQuestion: input.question,
          admittedEvidenceIds: listAdmittedEvidenceIds(state)
        });
        if (
          state.latestAnalysisRun.analysisRequestFingerprint ===
          requestedMetadata.analysisRequestFingerprint
        ) {
          return {
            analysisRunId: state.latestAnalysisRun.analysisRunId,
            route,
            scenario: state,
            findings: state.findings,
            correlationId: input.correlationId,
            analysisMetadata: state.latestAnalysisRun
          };
        }
      }

      if (!analysisArtifacts) {
        assertAnalysisRerunAllowed(state);
        assertEvidenceAdmitted(state, requiredCoreEvidenceIds);

        const admittedEvidenceIds = listAdmittedEvidenceIds(state);
        const analysisMetadataWithoutRunId = createAnalysisRunMetadata({
          caseId: input.caseId,
          taskClass: input.taskClass,
          route,
          analystQuestion: input.question,
          admittedEvidenceIds
        });
        if (this.dependencies.authoritativeWorkflow) {
          const analysisBundleId =
            `bundle-${analysisMetadataWithoutRunId.analysisRequestFingerprint}`;
          let findings: readonly AnalysisFinding[] | undefined;
          const authoritativeBundle = await this.dependencies.authoritativeWorkflow.run({
            tenantId: this.getTenantId(),
            caseId: input.caseId,
            analysisBundleId,
            evidenceManifestHash: createEvidenceManifestHash(
              analysisMetadataWithoutRunId.admittedEvidenceIds
            ),
            modelRoute: route,
            modelDeploymentId: modelDeploymentByRoute[route],
            routeEvidenceId: routeEvidenceIdByRoute[route],
            promptTemplateVersion: analysisMetadataWithoutRunId.promptTemplateVersion,
            requestFingerprint: analysisMetadataWithoutRunId.analysisRequestFingerprint,
            evidenceIds: analysisMetadataWithoutRunId.admittedEvidenceIds,
            analystQuestion: analysisMetadataWithoutRunId.analystQuestion,
            taskClass: input.taskClass,
            complete: (acceptedBundle) => {
              const metadata: AnalysisRunMetadata = {
                ...analysisMetadataWithoutRunId,
                analysisRunId: acceptedBundle.analysisBundleId
              };
              findings = runLocalGovernedScenarioAnalysisAdapter({
                analysisMetadata: metadata,
                includePermitTransferFinding: metadata.admittedEvidenceIds.includes(
                  "evidence-environmental-permit"
                ),
                occurredAtIso: this.now(),
                createId: this.createId
              });
              return {
                tenantId: acceptedBundle.tenantId,
                caseId: acceptedBundle.caseId,
                analysisBundleId: acceptedBundle.analysisBundleId,
                subjectVersion: createOutputManifestHash(findings),
                status: "DRAFT_ONLY_READY",
                unsupportedClaims: 0
              };
            }
          });
          if (!findings) {
            throw new DemoHttpError(
              503,
              "DEPENDENCY_UNAVAILABLE",
              "AUTHORITATIVE_BUNDLE_OUTPUT_UNAVAILABLE"
            );
          }
          if (!authoritativeBundle.subjectVersion) {
            throw new DemoHttpError(
              409,
              "STATE_CONFLICT",
              "ANALYSIS_BUNDLE_SUBJECT_VERSION_REQUIRED"
            );
          }
          const projectedFindings = findings;
          const metadata: AnalysisRunMetadata = {
            ...analysisMetadataWithoutRunId,
            analysisRunId: authoritativeBundle.analysisBundleId
          };
          analysisArtifacts = {
            metadata,
            findings: projectedFindings,
            response: {
              analysisRunId: authoritativeBundle.analysisBundleId,
              status: "QUEUED"
            },
            analysisAuthority: {
              analysisBundleId: authoritativeBundle.analysisBundleId,
              evidenceManifestHash: authoritativeBundle.evidenceManifestHash,
              subjectVersion: authoritativeBundle.subjectVersion,
              status: "DRAFT_ONLY_READY"
            }
          };
        } else {
          if (!this.dependencies.phase5Client) {
            throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "ANALYSIS_AUTHORITY_REQUIRED");
          }
          const response = await this.dependencies.phase5Client.requestAnalysis({
            caseId: input.caseId,
            evidenceIds: analysisMetadataWithoutRunId.admittedEvidenceIds,
            analystQuestion: analysisMetadataWithoutRunId.analystQuestion,
            route,
            taskClass: input.taskClass,
            modelDeploymentId: modelDeploymentByRoute[route],
            promptTemplateVersion: analysisMetadataWithoutRunId.promptTemplateVersion,
            analysisRequestFingerprint: analysisMetadataWithoutRunId.analysisRequestFingerprint,
            idempotencyKey: buildAnalysisIdempotencyKey(
              analysisMetadataWithoutRunId.analysisRequestFingerprint
            ),
            correlationId: input.correlationId
          });
          const metadata: AnalysisRunMetadata = {
            ...analysisMetadataWithoutRunId,
            analysisRunId: response.analysisRunId
          };
          const findings = runLocalGovernedScenarioAnalysisAdapter({
            analysisMetadata: metadata,
            includePermitTransferFinding: metadata.admittedEvidenceIds.includes(
              "evidence-environmental-permit"
            ),
            occurredAtIso: this.now(),
            createId: this.createId
          });

          analysisArtifacts = {
            metadata,
            findings,
            response
          };
        }
      } else if (
        state.latestAnalysisRun?.analysisRequestFingerprint ===
        analysisArtifacts?.metadata.analysisRequestFingerprint
      ) {
        return {
          analysisRunId: analysisArtifacts.response.analysisRunId,
          route,
          scenario: state,
          findings: state.findings,
          correlationId: input.correlationId,
          analysisMetadata: analysisArtifacts.metadata
        };
      }

      assertAnalysisRerunAllowed(state);
      assertEvidenceAdmitted(state, requiredCoreEvidenceIds);
      if (!analysisArtifacts) {
        throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "ANALYSIS_ARTIFACTS_UNAVAILABLE");
      }
      assertFindingCitationsAdmitted(state, analysisArtifacts.findings);
      const governedAnalysisEventMetadata = createGovernedAnalysisEventMetadata(
        analysisArtifacts.metadata,
        analysisArtifacts.findings
      );

      const nextState: ScenarioState = {
        ...state,
        stage: "ANALYSIS",
        findings: [...analysisArtifacts.findings],
        latestAnalysisRun: analysisArtifacts.metadata,
        ...(analysisArtifacts.analysisAuthority
          ? { analysisAuthority: analysisArtifacts.analysisAuthority }
          : {}),
        governanceEvents: [
          ...state.governanceEvents,
          createGovernanceEvent(this.createId, this.now, {
            type: "MODEL_ROUTE_SELECTED",
            outcome: "ALLOW",
            correlationId: input.correlationId,
            detail: route,
            metadata: governedAnalysisEventMetadata
          }),
          createGovernanceEvent(this.createId, this.now, {
            type: "ANALYSIS_POLICY_CHECK",
            outcome: "ALLOW",
            correlationId: input.correlationId,
            detail: "admitted-citations-only",
            metadata: governedAnalysisEventMetadata
          }),
          createGovernanceEvent(this.createId, this.now, {
            type: "ANALYSIS_CORRELATED",
            outcome: "SUCCESS",
            correlationId: input.correlationId,
            detail: analysisArtifacts.response.analysisRunId,
            metadata: governedAnalysisEventMetadata
          }),
          createGovernanceEvent(this.createId, this.now, {
            type: "ANALYSIS_REQUEST_GOVERNED",
            outcome: "SUCCESS",
            correlationId: input.correlationId,
            detail: `${input.taskClass}:${analysisArtifacts.response.analysisRunId}`,
            metadata: governedAnalysisEventMetadata
          })
        ]
      };

      try {
        await this.dependencies.repository.save({
          ...snapshot,
          state: nextState
        });

        return {
          analysisRunId: analysisArtifacts.response.analysisRunId,
          route,
          scenario: nextState,
          findings: nextState.findings,
          correlationId: input.correlationId,
          analysisMetadata: analysisArtifacts.metadata
        };
      } catch (error) {
        if (attempt === 0 && isStateConflict(error)) {
          continue;
        }

        throw error;
      }
    }

    throw new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_RETRY_EXHAUSTED");
  }

  public async recordDisposition(input: RecordDispositionInput): Promise<ScenarioState> {
    if (input.principalType !== "HUMAN") {
      throw new DemoHttpError(
        403,
        "POLICY_DENIED",
        "A human analyst must accept, edit, challenge, or reject the finding."
      );
    }

    const snapshot = await this.dependencies.repository.load();
    const state = snapshot.state;
    assertCaseId(state, input.caseId);

    const finding = state.findings.find((candidate) => candidate.findingId === input.findingId);
    if (!finding) {
      throw new DemoHttpError(404, "INVALID_CONTRACT", "Finding does not exist in Project Danube.");
    }

    const nextFinding = applyDispositionToFinding(
      finding,
      input.action,
      input.editedSummary,
      this.now(),
      this.createId
    );

    const nextState: ScenarioState = {
      ...state,
      stage: "REVIEW",
      findings: state.findings.map((candidate) =>
        candidate.findingId === input.findingId ? nextFinding : candidate
      ),
      governanceEvents: [
        ...state.governanceEvents,
        createGovernanceEvent(this.createId, this.now, {
          type: "FINDING_DISPOSITION_RECORDED",
          outcome: "SUCCESS",
          correlationId: input.correlationId,
          detail: `${input.findingId}:${input.action}`
        })
      ]
    };

    await this.dependencies.repository.save({
      ...snapshot,
      state: nextState
    });
    return nextState;
  }
}

function isStateConflict(error: unknown): error is DemoHttpError {
  return error instanceof DemoHttpError && error.code === "STATE_CONFLICT";
}

function runLocalGovernedScenarioAnalysisAdapter(input: {
  analysisMetadata: AnalysisRunMetadata;
  includePermitTransferFinding: boolean;
  occurredAtIso: string;
  createId: () => string;
}): AnalysisFinding[] {
  const { analysisMetadata, includePermitTransferFinding, occurredAtIso, createId } = input;

  const buildHistory = (summary: string): FindingTextVersion[] => [
    {
      versionId: createId(),
      actorType: "AI",
      action: "GENERATED",
      summary,
      occurredAtIso
    }
  ];

  const ebitdaSummary = "Reported adjusted EBITDA may be overstated by EUR 4.2–5.1 million.";
  const customerSummary =
    "Top-three customer rebate exposure is 18%, above the approved 12% downside threshold.";
  const permitSummary =
    "Permit CZ-EP-2049 requires Form T-17 filing and regulator written acknowledgement before closing.";

  const buildFinding = (finding: Omit<AnalysisFinding, "analysisRunId" | "analysisRequestFingerprint" | "authorityGateRole">): AnalysisFinding => ({
    ...finding,
    analysisRunId: analysisMetadata.analysisRunId,
    analysisRequestFingerprint: analysisMetadata.analysisRequestFingerprint,
    authorityGateRole: analysisMetadata.authorityGateRole
  });

  const findings: AnalysisFinding[] = [
    buildFinding({
      findingId: "finding-ebitda-quality",
      title: "Adjusted EBITDA quality",
      summary: ebitdaSummary,
      originalAiSummary: ebitdaSummary,
      materiality: "HIGH",
      status: "DRAFT",
      route: analysisMetadata.route,
      textHistory: buildHistory(ebitdaSummary),
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
    }),
    buildFinding({
      findingId: "finding-customer-concentration",
      title: "Customer concentration",
      summary: customerSummary,
      originalAiSummary: customerSummary,
      materiality: "MEDIUM",
      status: "DRAFT",
      route: analysisMetadata.route,
      textHistory: buildHistory(customerSummary),
      citations: [
        {
          citationId: "citation-board-pack-43",
          evidenceId: "evidence-board-pack",
          locator: "page 43",
          accessible: true
        }
      ]
    })
  ];

  if (includePermitTransferFinding) {
    findings.push(
      buildFinding({
        findingId: "finding-permit-transfer",
        title: "Permit transfer readiness",
        summary: permitSummary,
        originalAiSummary: permitSummary,
        materiality: "HIGH",
        status: "DRAFT",
        route: analysisMetadata.route,
        textHistory: buildHistory(permitSummary),
        citations: [
          {
            citationId: "citation-permit-2049",
            evidenceId: "evidence-environmental-permit",
            locator: "Transfer condition, steps 1-2",
            accessible: true
          }
        ]
      })
    );
  }

  return findings;
}

function applyDispositionToFinding(
  finding: AnalysisFinding,
  action: FindingDispositionAction,
  editedSummary: string | undefined,
  occurredAtIso: string,
  createId: () => string
): AnalysisFinding {
  const summary =
    action === "EDIT" ? editedSummary ?? finding.summary : finding.summary;
  const originalAiSummary = finding.originalAiSummary ?? finding.summary;
  const status =
    action === "CHALLENGE"
      ? "CHALLENGED"
      : action === "REJECT"
        ? "REJECTED"
        : "ACCEPTED";

  return {
    ...finding,
    summary,
    status,
    originalAiSummary,
    textHistory: [
      ...finding.textHistory,
      {
        versionId: createId(),
        actorType: "HUMAN",
        action: toHistoryAction(action),
        summary,
        occurredAtIso
      }
    ]
  };
}

function toHistoryAction(action: FindingDispositionAction): FindingTextVersion["action"] {
  switch (action) {
    case "ACCEPT":
      return "ACCEPTED";
    case "EDIT":
      return "EDITED";
    case "CHALLENGE":
      return "CHALLENGED";
    case "REJECT":
      return "REJECTED";
  }
}

function assertCaseId(state: ScenarioState, caseId: string): void {
  if (state.caseId !== caseId) {
    throw new DemoHttpError(403, "POLICY_DENIED", "Requested case is outside the Project Danube scope.");
  }
}

function assertEvidenceAdmitted(
  state: ScenarioState,
  requiredEvidenceIds: readonly string[]
): void {
  const evidenceById = new Map(state.evidence.map((evidence) => [evidence.evidenceId, evidence] as const));
  const hasMissingEvidence = requiredEvidenceIds.some(
    (evidenceId) => {
      const evidence = evidenceById.get(evidenceId);
      return (
        evidence?.admissionStatus !== "ADMITTED" ||
        (evidence.licenceStatus !== "APPROVED" &&
          evidence.licenceStatus !== "NOT_REQUIRED")
      );
    }
  );

  if (hasMissingEvidence) {
    throw new DemoHttpError(
      422,
      "EVIDENCE_INCOMPLETE",
      "All admitted citations required for the Project Danube analysis are not available."
    );
  }
}

function assertAnalysisRerunAllowed(state: ScenarioState): void {
  if (hasGovernedFindingHistory(state) && !hasVersionedAnalysisCycle()) {
    throw new DemoHttpError(409, "STATE_CONFLICT", rerunConflictMessage);
  }
}

function assertFindingCitationsAdmitted(state: ScenarioState, findings: readonly AnalysisFinding[]): void {
  const evidenceById = new Map(state.evidence.map((evidence) => [evidence.evidenceId, evidence] as const));

  const hasMissingCitation = findings.some((finding) =>
    finding.citations.some(
      (citation) =>
        citation.accessible !== true ||
        evidenceById.get(citation.evidenceId)?.admissionStatus !== "ADMITTED" ||
        !hasValidLicence(evidenceById.get(citation.evidenceId))
    )
  );

  if (hasMissingCitation) {
    throw new DemoHttpError(
      422,
      "EVIDENCE_INCOMPLETE",
      "Every finding citation must resolve to admitted evidence before it can be shown in the workbench."
    );
  }

}

function hasValidLicence(
  evidence: ScenarioState["evidence"][number] | undefined
): boolean {
  return (
    evidence?.licenceStatus === "APPROVED" ||
    evidence?.licenceStatus === "NOT_REQUIRED"
  );
}

function hasGovernedFindingHistory(state: ScenarioState): boolean {
  return state.findings.some((finding) => finding.status !== "DRAFT" || finding.textHistory.length > 0);
}

function hasVersionedAnalysisCycle(): boolean {
  return false;
}

function listAdmittedEvidenceIds(state: ScenarioState): string[] {
  return state.evidence
    .filter((evidence) => evidence.admissionStatus === "ADMITTED")
    .map((evidence) => evidence.evidenceId)
    .sort((left, right) => left.localeCompare(right));
}

function createAnalysisRunMetadata(input: {
  caseId: string;
  taskClass: AnalysisTaskClass;
  route: ModelRoute;
  analystQuestion: string;
  admittedEvidenceIds: readonly string[];
}): Omit<AnalysisRunMetadata, "analysisRunId"> {
  const analystQuestion = input.analystQuestion.trim();
  const questionHash = hashValue(analystQuestion);
  const evidenceSetHash = hashValue(JSON.stringify([...input.admittedEvidenceIds]));
  const analysisRequestFingerprint = hashValue(
    JSON.stringify({
      caseId: input.caseId,
      taskClass: input.taskClass,
      route: input.route,
      analystQuestion,
      admittedEvidenceIds: [...input.admittedEvidenceIds]
    })
  );

  return {
    route: input.route,
    taskClass: input.taskClass,
    analystQuestion,
    questionHash,
    admittedEvidenceIds: [...input.admittedEvidenceIds],
    evidenceSetHash,
    analysisRequestFingerprint,
    promptTemplateVersion: `${promptTemplateVersionPrefix}:${analysisRequestFingerprint}`,
    authorityGateRole: humanAnalystAuthorityGateRole
  };
}

function buildAnalysisIdempotencyKey(analysisRequestFingerprint: string): string {
  return `analysis:${analysisRequestFingerprint}`;
}

function createGovernedAnalysisEventMetadata(
  analysisMetadata: AnalysisRunMetadata,
  findings: readonly AnalysisFinding[]
): NonNullable<ScenarioState["governanceEvents"][number]["metadata"]> {
  return {
    analysisRequestFingerprint: analysisMetadata.analysisRequestFingerprint,
    questionHash: analysisMetadata.questionHash,
    evidenceSetHash: analysisMetadata.evidenceSetHash,
    taskClass: analysisMetadata.taskClass,
    route: analysisMetadata.route,
    phase5RunId: analysisMetadata.analysisRunId,
    authorityGateRole: analysisMetadata.authorityGateRole,
    findingIds: findings.map((finding) => finding.findingId)
  };
}

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createEvidenceManifestHash(evidenceIds: readonly string[]): string {
  return hashValue(JSON.stringify([...evidenceIds]));
}

function createOutputManifestHash(findings: readonly AnalysisFinding[]): string {
  return hashValue(
    JSON.stringify(
      findings.map((finding) => ({
        findingId: finding.findingId,
        summary: finding.summary,
        citations: finding.citations.map((citation) => ({
          evidenceId: citation.evidenceId,
          locator: citation.locator
        }))
      }))
    )
  );
}

function createGovernanceEvent(
  createId: () => string,
  now: () => string,
  event: Omit<ScenarioState["governanceEvents"][number], "eventId" | "occurredAtIso">
): ScenarioState["governanceEvents"][number] {
  return {
    eventId: createId(),
    occurredAtIso: now(),
    ...event
  };
}
