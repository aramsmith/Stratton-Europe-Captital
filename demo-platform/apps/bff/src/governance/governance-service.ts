import { createHash, randomUUID } from "node:crypto";
import type {
  AnalysisFinding,
  EvidenceDomain,
  GovernanceEvent,
  GovernanceView,
  ReviewType,
  ScenarioState
} from "@stratton/contracts";
import { getEligibleReviewTypesForDomains } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { ScenarioRepository } from "../scenario/scenario-repository.js";
import {
  buildSecurityGateStatuses,
  getSecurityGateReadinessBlocker,
  runDeterministicSecurityGateChecks
} from "./security-gates.js";

interface GovernanceServiceDependencies {
  readonly repository: ScenarioRepository;
  readonly createId?: () => string;
  readonly now?: () => string;
}

const previewSections = [
  "Lineage",
  "Policy decisions",
  "Model routes",
  "Security & audit"
] as const;

export class GovernanceService {
  private readonly createId: () => string;
  private readonly now: () => string;

  public constructor(private readonly dependencies: GovernanceServiceDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date().toISOString());
  }

  public async getView(caseId: string): Promise<GovernanceView> {
    const snapshot = await this.dependencies.repository.load();
    const state = snapshot.state;
    assertCaseId(state, caseId);

    const latestRecommendationSubjectVersion =
      state.analysisAuthority?.subjectVersion ?? buildRecommendationSubjectVersion(state);
    const policyDecisions = buildPolicyDecisions(state);

    return {
      lineage: buildLineage(state, latestRecommendationSubjectVersion),
      policyDecisions,
      modelRoutes: buildModelRoutes(state),
      securityGates: buildSecurityGates(state),
      auditExport: buildAuditExport(state, latestRecommendationSubjectVersion)
    };
  }

  public async recordSecurityGateEvidence(input: {
    readonly caseId: string;
    readonly correlationId: string;
  }): Promise<ScenarioState> {
    const snapshot = await this.dependencies.repository.load();
    const state = snapshot.state;
    assertCaseId(state, input.caseId);
    const latestAnalysisRun = state.latestAnalysisRun;
    if (!latestAnalysisRun) {
      throw new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_RUN_REQUIRED");
    }
    if (!getSecurityGateReadinessBlocker(state)) {
      return state;
    }

    const nextState: ScenarioState = {
      ...state,
      governanceEvents: [
        ...state.governanceEvents,
        ...(await runDeterministicSecurityGateChecks(state)).map((gate) => ({
          eventId: this.createId(),
          type: "SECURITY_GATE_EVIDENCE_RECORDED",
          outcome: "SUCCESS" as const,
          occurredAtIso: this.now(),
          correlationId: input.correlationId,
          detail: `DETERMINISTIC_GATE_PASS:${gate.gateId}`,
          metadata: {
            securityGateId: gate.gateId,
            securityGateEvidenceId: gate.evidenceId,
            analysisRequestFingerprint: latestAnalysisRun.analysisRequestFingerprint
          }
        }))
      ]
    };
    await this.dependencies.repository.save({
      ...snapshot,
      state: nextState
    });
    return nextState;
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
      const latestFindingVersion = getCurrentSubjectVersion(state, finding);
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
  return buildSecurityGateStatuses(state);
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
    const missingReviews = state.findings
      .filter(
        (finding) =>
          finding.status === "ACCEPTED" &&
          (finding.materiality === "HIGH" || finding.materiality === "CRITICAL")
      )
      .flatMap((finding) =>
        getEligibleReviewTypesForFinding(state, finding)
          .filter((reviewType) => {
            const review = getLatestReview(
              state.reviews,
              reviewType,
              finding.findingId
            );
            return !(
              review?.decision === "APPROVED" &&
              review.subjectVersion === getCurrentSubjectVersion(state, finding)
            );
          })
          .map((reviewType) => `${formatReviewType(reviewType)}:${finding.findingId}`)
      );

    if (missingReviews.length > 0) {
      missingItems.push(
        `Specialist approvals are not current for ${missingReviews.join(", ")}.`
      );
    }
  }

  const hasCurrentRecommendation = state.governanceEvents.some((event) =>
    isCurrentRecommendationEvent(event, recommendationSubjectVersion)
  );
  if (!hasCurrentRecommendation) {
    missingItems.push("Committee-pack draft evidence has not been prepared.");
  }

  const securityGateBlocker = getSecurityGateReadinessBlocker(state);
  if (securityGateBlocker) {
    missingItems.push(`Mandatory security gates are not ready: ${securityGateBlocker}.`);
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
    return event.metadata.subjectVersion === getCurrentSubjectVersion(state, finding);
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
    return event.metadata.subjectVersion !== getCurrentSubjectVersion(state, finding);
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

export function buildRecommendationSubjectVersion(state: ScenarioState): string {
  const materialFindings = state.findings
    .filter(isMaterialFinding)
    .map((finding) => ({
      findingId: finding.findingId,
      status: finding.status,
      latestVersionId: getLatestFindingVersion(finding)
    }));
  const reviews = state.findings
    .filter(
      (finding) =>
        finding.status === "ACCEPTED" &&
        (finding.materiality === "HIGH" || finding.materiality === "CRITICAL")
    )
    .flatMap((finding) =>
      getEligibleReviewTypesForFinding(state, finding).map((reviewType) => {
        const latestReview = getLatestReview(
          state.reviews,
          reviewType,
          finding.findingId
        );
        return {
          reviewType,
          decision: latestReview?.decision ?? "PENDING",
          findingId: finding.findingId,
          subjectVersion: latestReview?.subjectVersion ?? "missing"
        };
      })
    );

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
  reviewType: ReviewType,
  findingId?: string
): ScenarioState["reviews"][number] | undefined {
  for (let index = reviews.length - 1; index >= 0; index -= 1) {
    const review = reviews[index];
    if (
      review?.reviewType === reviewType &&
      (!findingId || review.findingId === findingId)
    ) {
      return review;
    }
  }

  return undefined;
}

function getEligibleReviewTypesForFinding(
  state: ScenarioState,
  finding: AnalysisFinding
): ReviewType[] {
  const evidenceById = new Map(
    state.evidence.map((evidence) => [evidence.evidenceId, evidence] as const)
  );
  const domains = [
    ...new Set(
      finding.citations
        .map((citation) => evidenceById.get(citation.evidenceId)?.domain)
        .filter((domain): domain is EvidenceDomain => !!domain)
    )
  ];
  return getEligibleReviewTypesForDomains(domains);
}

function getLatestFindingVersion(finding: AnalysisFinding): string {
  return finding.textHistory.at(-1)?.versionId ?? finding.findingId;
}

function getCurrentSubjectVersion(
  state: ScenarioState,
  finding: AnalysisFinding
): string {
  return state.analysisAuthority?.subjectVersion ?? getLatestFindingVersion(finding);
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
