import { randomUUID } from "node:crypto";
import type {
  AnalysisFinding,
  AnalysisRunRequest,
  AnalysisRunResponse,
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
    assertEvidenceAdmitted(state, requiredCoreEvidenceIds);

    const route = routeTask(input.taskClass);
    const phase5Result = await this.dependencies.phase5Client.requestAnalysis({
      caseId: input.caseId,
      evidenceId: "evidence-board-pack",
      modelDeploymentId: modelDeploymentByRoute[route],
      promptTemplateVersion: "stratton-workbench-v1",
      idempotencyKey: this.createId()
    });

    const findings = createScenarioFindings(route, this.now(), this.createId);
    assertFindingCitationsAdmitted(state, findings);

    const nextState: ScenarioState = {
      ...state,
      stage: "ANALYSIS",
      findings,
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
        })
      ]
    };

    await this.dependencies.repository.save(nextState);

    return {
      analysisRunId: phase5Result.analysisRunId,
      route,
      scenario: nextState,
      findings: nextState.findings,
      correlationId: input.correlationId
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

function createScenarioFindings(
  route: ModelRoute,
  occurredAtIso: string,
  createId: () => string
): AnalysisFinding[] {
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

  return [
    {
      findingId: "finding-ebitda-quality",
      title: "Adjusted EBITDA quality",
      summary: ebitdaSummary,
      originalAiSummary: ebitdaSummary,
      materiality: "HIGH",
      status: "DRAFT",
      route,
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
    },
    {
      findingId: "finding-customer-concentration",
      title: "Customer concentration",
      summary: customerSummary,
      originalAiSummary: customerSummary,
      materiality: "MEDIUM",
      status: "DRAFT",
      route,
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
    },
    {
      findingId: "finding-permit-transfer",
      title: "Permit transfer readiness",
      summary: permitSummary,
      originalAiSummary: permitSummary,
      materiality: "HIGH",
      status: "DRAFT",
      route,
      textHistory: buildHistory(permitSummary),
      citations: [
        {
          citationId: "citation-permit-2049",
          evidenceId: "evidence-environmental-permit",
          locator: "Permit reference: CZ-EP-2049",
          accessible: true
        }
      ]
    }
  ];
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
