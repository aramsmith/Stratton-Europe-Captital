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
const promptTemplateVersionPrefix = "stratton-workbench-v2";
const humanAnalystAuthorityGateRole: AuthorityGateRole = "HUMAN_ANALYST_REVIEW_GATE";
const rerunConflictMessage =
  "Analysis rerun is blocked because governed findings already contain text history or human dispositions. Create a versioned cycle before rerunning.";

interface AnalysisServiceDependencies {
  readonly repository: ScenarioRepository;
  readonly phase5Client: Phase5Client;
  readonly createId?: () => string;
  readonly now?: () => string;
}

interface RunAnalysisInput extends AnalysisRunRequest {
  readonly correlationId: string;
}

interface RecordDispositionInput extends FindingDispositionRequest {
  readonly findingId: string;
  readonly principalType: "HUMAN" | "SERVICE";
  readonly correlationId: string;
}

export class AnalysisService {
  private readonly createId: () => string;
  private readonly now: () => string;

  public constructor(private readonly dependencies: AnalysisServiceDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  public async run(input: RunAnalysisInput): Promise<AnalysisRunResponse> {
    const state = await this.dependencies.repository.load();
    assertCaseId(state, input.caseId);
    assertAnalysisRerunAllowed(state);
    assertEvidenceAdmitted(state, requiredCoreEvidenceIds);

    const route = routeTask(input.taskClass);
    const admittedEvidenceIds = listAdmittedEvidenceIds(state);
    const analysisMetadataWithoutRunId = createAnalysisRunMetadata({
      caseId: input.caseId,
      taskClass: input.taskClass,
      route,
      analystQuestion: input.question,
      admittedEvidenceIds
    });
    const phase5Result = await this.dependencies.phase5Client.requestAnalysis({
      caseId: input.caseId,
      evidenceIds: analysisMetadataWithoutRunId.admittedEvidenceIds,
      analystQuestion: analysisMetadataWithoutRunId.analystQuestion,
      modelDeploymentId: modelDeploymentByRoute[route],
      promptTemplateVersion: analysisMetadataWithoutRunId.promptTemplateVersion,
      analysisRequestFingerprint: analysisMetadataWithoutRunId.analysisRequestFingerprint,
      idempotencyKey: buildAnalysisIdempotencyKey(
        analysisMetadataWithoutRunId.analysisRequestFingerprint
      )
    });
    const analysisMetadata: AnalysisRunMetadata = {
      ...analysisMetadataWithoutRunId,
      analysisRunId: phase5Result.analysisRunId
    };

    const findings = runLocalGovernedScenarioAnalysisAdapter({
      analysisMetadata,
      includePermitTransferFinding: analysisMetadata.admittedEvidenceIds.includes(
        "evidence-environmental-permit"
      ),
      occurredAtIso: this.now(),
      createId: this.createId
    });
    assertFindingCitationsAdmitted(state, findings);

    const nextState: ScenarioState = {
      ...state,
      stage: "ANALYSIS",
      findings,
      latestAnalysisRun: analysisMetadata,
      governanceEvents: [
        ...state.governanceEvents,
        createGovernanceEvent(this.createId, this.now, {
          type: "MODEL_ROUTE_SELECTED",
          outcome: "ALLOW",
          correlationId: input.correlationId,
          detail: route
        }),
        createGovernanceEvent(this.createId, this.now, {
          type: "ANALYSIS_POLICY_CHECK",
          outcome: "ALLOW",
          correlationId: input.correlationId,
          detail: "admitted-citations-only"
        }),
        createGovernanceEvent(this.createId, this.now, {
          type: "ANALYSIS_CORRELATED",
          outcome: "SUCCESS",
          correlationId: input.correlationId,
          detail: phase5Result.analysisRunId
        }),
        createGovernanceEvent(this.createId, this.now, {
          type: "ANALYSIS_REQUEST_GOVERNED",
          outcome: "SUCCESS",
          correlationId: input.correlationId,
          detail: `${input.taskClass}:${phase5Result.analysisRunId}`,
          metadata: {
            analysisRequestFingerprint: analysisMetadata.analysisRequestFingerprint,
            questionHash: analysisMetadata.questionHash,
            evidenceSetHash: analysisMetadata.evidenceSetHash,
            taskClass: analysisMetadata.taskClass,
            route: analysisMetadata.route,
            phase5RunId: analysisMetadata.analysisRunId,
            authorityGateRole: analysisMetadata.authorityGateRole,
            findingIds: findings.map((finding) => finding.findingId)
          }
        })
      ]
    };

    await this.dependencies.repository.save(nextState);

    return {
      analysisRunId: phase5Result.analysisRunId,
      route,
      scenario: nextState,
      findings: nextState.findings,
      correlationId: input.correlationId,
      analysisMetadata
    };
  }

  public async recordDisposition(input: RecordDispositionInput): Promise<ScenarioState> {
    if (input.principalType !== "HUMAN") {
      throw new DemoHttpError(
        403,
        "POLICY_DENIED",
        "A human analyst must accept, edit, challenge, or reject the finding."
      );
    }

    const state = await this.dependencies.repository.load();
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

    await this.dependencies.repository.save(nextState);
    return nextState;
  }
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
    "Customer rebate concentration remains above the approved downside threshold.";
  const permitSummary = "Permit transfer requires controlled completion steps before close.";

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
          citationId: "citation-erp-812-886",
          evidenceId: "evidence-erp-rebates",
          locator: "rows 812-886",
          accessible: true
        },
        {
          citationId: "citation-board-pack-42",
          evidenceId: "evidence-board-pack",
          locator: "page 42",
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
            locator: "Permit reference: CZ-EP-2049",
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
    throw new DemoHttpError(400, "INVALID_CONTRACT", "Requested case does not match Project Danube.");
  }
}

function assertEvidenceAdmitted(
  state: ScenarioState,
  requiredEvidenceIds: readonly string[]
): void {
  const evidenceById = new Map(state.evidence.map((evidence) => [evidence.evidenceId, evidence] as const));
  const hasMissingEvidence = requiredEvidenceIds.some(
    (evidenceId) => evidenceById.get(evidenceId)?.admissionStatus !== "ADMITTED"
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
        citation.accessible !== true || evidenceById.get(citation.evidenceId)?.admissionStatus !== "ADMITTED"
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

function hashValue(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
