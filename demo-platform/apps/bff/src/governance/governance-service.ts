import { createHash } from "node:crypto";
import type {
  AnalysisFinding,
  GovernanceEvent,
  GovernanceView,
  ReviewType,
  ScenarioState
} from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { ScenarioRepository } from "../scenario/scenario-repository.js";

interface GovernanceServiceDependencies {
  readonly repository: ScenarioRepository;
}

interface SecurityGateDefinition {
  readonly gateId: string;
  readonly name: string;
  readonly failClosedOutcome: string;
}

const previewSections = [
  "Lineage",
  "Policy decisions",
  "Model routes",
  "Security & audit"
] as const;

const requiredReviewTypes = ["DEAL", "LEGAL", "COMPLIANCE"] as const satisfies readonly ReviewType[];

const securityGateDefinitions: readonly SecurityGateDefinition[] = [
  {
    gateId: "CC002-R2-SEC-GATE-001",
    name: "Direct prompt injection",
    failClosedOutcome: "Block promotion and deny affected output"
  },
  {
    gateId: "CC002-R2-SEC-GATE-002",
    name: "Indirect prompt injection",
    failClosedOutcome: "Block promotion and quarantine evidence"
  },
  {
    gateId: "CC002-R2-SEC-GATE-003",
    name: "Instruction/evidence boundary escape",
    failClosedOutcome: "Block promotion and stop output"
  },
  {
    gateId: "CC002-R2-SEC-GATE-004",
    name: "Citation spoofing",
    failClosedOutcome: "Block promotion and material narrative"
  },
  {
    gateId: "CC002-R2-SEC-GATE-005",
    name: "Poisoned retrieval index",
    failClosedOutcome: "Quarantine index, stop retrieval and block promotion"
  },
  {
    gateId: "CC002-R2-SEC-GATE-006",
    name: "Cross-case retrieval",
    failClosedOutcome: "Deny query, alert and block promotion"
  },
  {
    gateId: "CC002-R2-SEC-GATE-007",
    name: "Caller filter override",
    failClosedOutcome: "Deny query and block promotion"
  },
  {
    gateId: "CC002-R2-SEC-GATE-008",
    name: "Revoked/expired evidence",
    failClosedOutcome: "Deny admission and block promotion"
  },
  {
    gateId: "CC002-R2-SEC-GATE-009",
    name: "Unavailable deployment",
    failClosedOutcome: "Queue or controlled failure and block promotion"
  },
  {
    gateId: "CC002-R2-SEC-GATE-010",
    name: "Deployment/model/version mismatch",
    failClosedOutcome: "Deny, alert and block promotion"
  },
  {
    gateId: "CC002-R2-SEC-GATE-011",
    name: "Attempted silent fallback",
    failClosedOutcome: "Deny substitution, alert and block promotion"
  },
  {
    gateId: "CC002-R2-SEC-GATE-012",
    name: "Attempted autonomous authority",
    failClosedOutcome: "Deny state transition, stop for human and block promotion"
  }
] as const;

export class GovernanceService {
  public constructor(private readonly dependencies: GovernanceServiceDependencies) {}

  public async getView(caseId: string): Promise<GovernanceView> {
    const snapshot = await this.dependencies.repository.load();
    const state = snapshot.state;
    assertCaseId(state, caseId);

    const latestRecommendationSubjectVersion = buildRecommendationSubjectVersion(state);
    const policyDecisions = buildPolicyDecisions(state);

    return {
      lineage: buildLineage(state, latestRecommendationSubjectVersion),
      policyDecisions,
      modelRoutes: buildModelRoutes(state),
      securityGates: buildSecurityGates(state),
      auditExport: buildAuditExport(state, latestRecommendationSubjectVersion)
    };
  }
}

function buildLineage(
  state: ScenarioState,
  recommendationSubjectVersion: string
): GovernanceView["lineage"] {
  const evidenceById = new Map(state.evidence.map((evidence) => [evidence.evidenceId, evidence] as const));

  return state.findings
    .filter(isMaterialFinding)
    .flatMap((finding) => {
      const latestFindingVersion = getLatestFindingVersion(finding);
      const sourceLocators = getLineageSourceLocators(finding, evidenceById);
      const evidenceIds = getLineageEvidenceIds(finding);
      const modelRoute = finding.route ?? state.latestAnalysisRun?.route;
      if (!modelRoute || evidenceIds.length === 0 || sourceLocators.length === 0) {
        return [];
      }

      const currentReviews = state.reviews.filter(
        (review) =>
          review.findingId === finding.findingId && review.subjectVersion === latestFindingVersion
      );
      const historicalReviews = state.reviews.filter(
        (review) =>
          review.findingId === finding.findingId && review.subjectVersion !== latestFindingVersion
      );
      const policyDecisionIds = uniqueValues(
        state.governanceEvents
          .filter((event) => isCurrentPolicyDecisionLink(event, finding, state))
          .map((event) => event.eventId)
      );
      const historicalPolicyDecisionIds = uniqueValues(
        state.governanceEvents
          .filter((event) => isHistoricalPolicyDecisionLink(event, finding, state))
          .map((event) => event.eventId)
      );
      const recommendationIds = uniqueValues(
        state.governanceEvents
          .filter((event) =>
            isCurrentRecommendationLink(event, finding.findingId, recommendationSubjectVersion)
          )
          .map((event) => event.eventId)
      );
      const historicalRecommendationIds = uniqueValues(
        state.governanceEvents
          .filter((event) =>
            isHistoricalRecommendationLink(event, finding.findingId, recommendationSubjectVersion)
          )
          .map((event) => event.eventId)
      );

      return [
        {
          id: finding.findingId,
          title: finding.title,
          sourceLocators,
          evidenceIds,
          modelRoute,
          reviewTypes: uniqueValues(currentReviews.map((review) => review.reviewType)),
          reviewVersionIds: uniqueValues(currentReviews.map((review) => review.subjectVersion)),
          policyDecisionIds,
          recommendationIds,
          assuranceStatus: buildAssuranceStatus(
            currentReviews.length,
            recommendationIds.length,
            historicalReviews.length,
            historicalRecommendationIds.length
          ),
          historicalReviewTypes: uniqueValues(historicalReviews.map((review) => review.reviewType)),
          historicalReviewVersionIds: uniqueValues(
            historicalReviews.map((review) => review.subjectVersion)
          ),
          historicalPolicyDecisionIds,
          historicalRecommendationIds
        }
      ];
    });
}

function buildPolicyDecisions(
  state: ScenarioState
): GovernanceView["policyDecisions"] {
  return state.governanceEvents
    .filter((event) => event.type !== "SCENARIO_RESET")
    .map((event) => ({
      decisionId: event.eventId,
      policyType: event.type,
      result: event.outcome,
      reasonCodes: buildReasonCodes(event),
      version: resolveDecisionVersion(event, state),
      correlationId: event.correlationId,
      relatedFindingIds: resolveRelatedFindingIds(event),
      occurredAtIso: event.occurredAtIso
    }));
}

function buildModelRoutes(
  state: ScenarioState
): GovernanceView["modelRoutes"] {
  const latestAnalysis = state.latestAnalysisRun;
  if (!latestAnalysis) {
    return [];
  }

  const routeEvents = state.governanceEvents.filter(
    (event) =>
      isMatchingAnalysisEvent(event, latestAnalysis.analysisRequestFingerprint, latestAnalysis.analysisRunId) &&
      (event.type === "MODEL_ROUTE_SELECTED" ||
        event.type === "ANALYSIS_POLICY_CHECK" ||
        event.type === "ANALYSIS_REQUEST_GOVERNED")
  );

  return [
    {
      routeId: latestAnalysis.analysisRunId,
      taskClass: latestAnalysis.taskClass,
      modelRoute: latestAnalysis.route,
      analysisRunId: latestAnalysis.analysisRunId,
      authorityGateRole: latestAnalysis.authorityGateRole,
      primaryEvidenceIds: [...latestAnalysis.admittedEvidenceIds],
      recoveryEvidenceIds: uniqueValues(
        state.governanceEvents
          .filter(
            (event) =>
              isMatchingAnalysisEvent(
                event,
                latestAnalysis.analysisRequestFingerprint,
                latestAnalysis.analysisRunId
              ) &&
              (event.type.includes("RECOVERY") || event.type.includes("FALLBACK"))
          )
          .flatMap((event) => event.metadata?.findingIds ?? [])
      ),
      correlationId: routeEvents.at(-1)?.correlationId ?? "unknown",
      analysisRequestFingerprint: latestAnalysis.analysisRequestFingerprint,
      questionHash: latestAnalysis.questionHash,
      evidenceSetHash: latestAnalysis.evidenceSetHash,
      promptTemplateVersion: latestAnalysis.promptTemplateVersion,
      routeEventIds: routeEvents.map((event) => event.eventId)
    }
  ];
}

function buildSecurityGates(
  state: ScenarioState
): GovernanceView["securityGates"] {
  const latestGateEvents = new Map<string, GovernanceEvent>();

  for (const event of state.governanceEvents) {
    if (event.type === "SECURITY_GATE_EVIDENCE_RECORDED" && event.metadata?.securityGateId) {
      latestGateEvents.set(event.metadata.securityGateId, event);
    }
  }

  return securityGateDefinitions.map((definition) => {
    const gateEvent = latestGateEvents.get(definition.gateId);
    if (!gateEvent) {
      return {
        ...definition,
        outcome: "NOT_RUN"
      };
    }

    return {
      ...definition,
      outcome: mapGateOutcome(gateEvent),
      ...(gateEvent.metadata?.securityGateEvidenceId
        ? {
            evidenceId: gateEvent.metadata.securityGateEvidenceId
          }
        : {})
    };
  });
}

function buildAuditExport(
  state: ScenarioState,
  recommendationSubjectVersion: string
): GovernanceView["auditExport"] {
  const missingItems: string[] = [];

  if (!state.latestAnalysisRun) {
    missingItems.push("Governed analysis route evidence has not been recorded.");
  }

  if (state.latestAnalysisRun) {
    const missingReviews = requiredReviewTypes.filter((reviewType) => {
      const review = getLatestReview(state.reviews, reviewType);
      const reviewedFinding = review
        ? state.findings.find((finding) => finding.findingId === review.findingId)
        : undefined;

      return !(
        review?.decision === "APPROVED" &&
        reviewedFinding?.status === "ACCEPTED" &&
        review.subjectVersion === getLatestFindingVersion(reviewedFinding)
      );
    });

    if (missingReviews.length > 0) {
      missingItems.push(
        `Specialist approvals are not current for ${missingReviews
          .map(formatReviewType)
          .join(", ")}.`
      );
    }
  }

  const hasCurrentRecommendation = state.governanceEvents.some((event) =>
    isCurrentRecommendationEvent(event, recommendationSubjectVersion)
  );
  if (!hasCurrentRecommendation) {
    missingItems.push("Committee-pack draft evidence has not been prepared.");
  }

  return {
    status: missingItems.length === 0 ? "READY" : "BLOCKED",
    missingItems,
    previewSections: [...previewSections]
  };
}

function isCurrentRecommendationEvent(
  event: GovernanceEvent,
  recommendationSubjectVersion: string
): boolean {
  return (
    event.type === "COMMITTEE_PACK_DRAFT_PREPARED" &&
    event.outcome === "SUCCESS" &&
    event.metadata?.subjectVersion === recommendationSubjectVersion
  );
}

function isCurrentRecommendationLink(
  event: GovernanceEvent,
  findingId: string,
  recommendationSubjectVersion: string
): boolean {
  return (
    isCurrentRecommendationEvent(event, recommendationSubjectVersion) &&
    resolveRelatedFindingIds(event).includes(findingId)
  );
}

function isHistoricalRecommendationLink(
  event: GovernanceEvent,
  findingId: string,
  recommendationSubjectVersion: string
): boolean {
  return (
    event.type === "COMMITTEE_PACK_DRAFT_PREPARED" &&
    event.outcome === "SUCCESS" &&
    event.metadata?.subjectVersion !== undefined &&
    event.metadata.subjectVersion !== recommendationSubjectVersion &&
    resolveRelatedFindingIds(event).includes(findingId)
  );
}

function buildReasonCodes(event: GovernanceEvent): string[] {
  const rawCodes = [
    ...(event.detail ? event.detail.split(":").map((segment) => segment.trim()) : []),
    event.metadata?.route,
    event.metadata?.taskClass
  ];

  return uniqueValues(rawCodes.filter((value): value is string => !!value && value.length > 0));
}

function resolveDecisionVersion(event: GovernanceEvent, state: ScenarioState): string {
  if (event.metadata?.subjectVersion) {
    return event.metadata.subjectVersion;
  }

  if (
    event.metadata?.analysisRequestFingerprint &&
    event.metadata.analysisRequestFingerprint === state.latestAnalysisRun?.analysisRequestFingerprint
  ) {
    return state.latestAnalysisRun.promptTemplateVersion;
  }

  if (event.metadata?.phase5RunId) {
    return event.metadata.phase5RunId;
  }

  return "Not available";
}

function resolveRelatedFindingIds(event: GovernanceEvent): string[] {
  if (event.metadata?.findingIds && event.metadata.findingIds.length > 0) {
    return uniqueValues(event.metadata.findingIds);
  }

  const detailSegments = event.detail?.split(":").map((segment) => segment.trim()) ?? [];
  return detailSegments.filter((segment) => segment.startsWith("finding-"));
}

function isCurrentPolicyDecisionLink(
  event: GovernanceEvent,
  finding: AnalysisFinding,
  state: ScenarioState
): boolean {
  if (event.type === "SCENARIO_RESET" || event.type === "COMMITTEE_PACK_DRAFT_PREPARED") {
    return false;
  }

  if (!resolveRelatedFindingIds(event).includes(finding.findingId)) {
    return false;
  }

  if (event.metadata?.subjectVersion) {
    return event.metadata.subjectVersion === getLatestFindingVersion(finding);
  }

  return isBoundToLatestAnalysis(event, state.latestAnalysisRun);
}

function isHistoricalPolicyDecisionLink(
  event: GovernanceEvent,
  finding: AnalysisFinding,
  state: ScenarioState
): boolean {
  if (event.type === "SCENARIO_RESET" || event.type === "COMMITTEE_PACK_DRAFT_PREPARED") {
    return false;
  }

  if (!resolveRelatedFindingIds(event).includes(finding.findingId)) {
    return false;
  }

  if (event.metadata?.subjectVersion) {
    return event.metadata.subjectVersion !== getLatestFindingVersion(finding);
  }

  return hasAnalysisBinding(event) && !isBoundToLatestAnalysis(event, state.latestAnalysisRun);
}

function getLineageSourceLocators(
  finding: AnalysisFinding,
  evidenceById: ReadonlyMap<string, ScenarioState["evidence"][number]>
): string[] {
  return uniqueValues(
    finding.citations
      .map((citation) => evidenceById.get(citation.evidenceId)?.sourceLocator)
      .filter((value): value is string => !!value)
  );
}

function getLineageEvidenceIds(finding: AnalysisFinding): string[] {
  return uniqueValues(finding.citations.map((citation) => citation.evidenceId));
}

function isMatchingAnalysisEvent(
  event: GovernanceEvent,
  analysisRequestFingerprint: string,
  analysisRunId: string
): boolean {
  return (
    event.metadata?.analysisRequestFingerprint === analysisRequestFingerprint ||
    event.metadata?.phase5RunId === analysisRunId
  );
}

function hasAnalysisBinding(event: GovernanceEvent): boolean {
  return (
    typeof event.metadata?.analysisRequestFingerprint === "string" ||
    typeof event.metadata?.phase5RunId === "string"
  );
}

function isBoundToLatestAnalysis(
  event: GovernanceEvent,
  latestAnalysisRun: ScenarioState["latestAnalysisRun"] | undefined
): boolean {
  return latestAnalysisRun
    ? isMatchingAnalysisEvent(
        event,
        latestAnalysisRun.analysisRequestFingerprint,
        latestAnalysisRun.analysisRunId
      )
    : false;
}

function buildAssuranceStatus(
  currentReviewCount: number,
  currentRecommendationCount: number,
  historicalReviewCount: number,
  historicalRecommendationCount: number
): GovernanceView["lineage"][number]["assuranceStatus"] {
  if (currentReviewCount > 0 && currentRecommendationCount > 0) {
    return "CURRENT";
  }

  if (historicalReviewCount > 0 || historicalRecommendationCount > 0) {
    return "STALE";
  }

  return "PENDING";
}

function mapGateOutcome(event: GovernanceEvent): GovernanceView["securityGates"][number]["outcome"] {
  return event.outcome === "ALLOW" || event.outcome === "SUCCESS" ? "PASS" : "FAIL";
}

function buildRecommendationSubjectVersion(state: ScenarioState): string {
  const materialFindings = state.findings
    .filter(isMaterialFinding)
    .map((finding) => ({
      findingId: finding.findingId,
      status: finding.status,
      latestVersionId: getLatestFindingVersion(finding)
    }));
  const reviews = requiredReviewTypes.map((reviewType) => {
    const latestReview = getLatestReview(state.reviews, reviewType);
    return {
      reviewType,
      decision: latestReview?.decision ?? "PENDING",
      findingId: latestReview?.findingId ?? "unassigned",
      subjectVersion: latestReview?.subjectVersion ?? "missing"
    };
  });

  return createHash("sha256")
    .update(
      JSON.stringify({
        analysisRequestFingerprint: state.latestAnalysisRun?.analysisRequestFingerprint ?? "unknown",
        materialFindings,
        reviews
      })
    )
    .digest("hex");
}

function getLatestReview(
  reviews: readonly ScenarioState["reviews"][number][],
  reviewType: ReviewType
): ScenarioState["reviews"][number] | undefined {
  for (let index = reviews.length - 1; index >= 0; index -= 1) {
    const review = reviews[index];
    if (review?.reviewType === reviewType) {
      return review;
    }
  }

  return undefined;
}

function getLatestFindingVersion(finding: AnalysisFinding): string {
  return finding.textHistory.at(-1)?.versionId ?? finding.findingId;
}

function formatReviewType(reviewType: ReviewType): string {
  return `${reviewType.slice(0, 1)}${reviewType.slice(1).toLowerCase()}`;
}

function uniqueValues<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right)) as T[];
}

function isMaterialFinding(finding: AnalysisFinding): boolean {
  return finding.materiality === "HIGH" || finding.materiality === "CRITICAL";
}

function assertCaseId(state: ScenarioState, caseId: string): void {
  if (state.caseId !== caseId) {
    throw new DemoHttpError(400, "INVALID_CONTRACT", "Requested case does not match Project Danube.");
  }
}
