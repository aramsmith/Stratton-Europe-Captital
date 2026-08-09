import { createHash, randomUUID } from "node:crypto";
import type {
  AnalysisFinding,
  EvidenceDomain,
  ReviewSubmissionRequest,
  ReviewType,
  ScenarioState
} from "@stratton/contracts";
import { getEligibleReviewTypesForDomains } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import { getSecurityGateReadinessBlocker } from "../governance/security-gates.js";
import type { DemoAuthorityClient } from "../phase5/demo-authority-client.js";
import type { Phase5Client } from "../phase5/phase5-client.js";
import type { ScenarioRepository, ScenarioSnapshot } from "../scenario/scenario-repository.js";
import { createFindingProjectionVersion } from "./finding-projection-version.js";

interface ReviewServiceCommonDependencies {
  readonly repository: ScenarioRepository;
  readonly getTenantId?: () => string;
  readonly createId?: () => string;
  readonly now?: () => string;
}

type ReviewServiceDependencies = ReviewServiceCommonDependencies &
  (
    | {
        readonly demoAuthorityClient: DemoAuthorityClient;
        readonly compatibilityMode?: never;
        readonly phase5Client?: never;
      }
    | {
        readonly compatibilityMode: "LEGACY_TEST_ONLY";
        readonly phase5Client: Phase5Client;
        readonly demoAuthorityClient?: never;
      }
  );

interface SubmitReviewInput extends Omit<ReviewSubmissionRequest, "caseId"> {
  readonly caseId: string;
  readonly findingId: string;
  readonly principalType: "HUMAN" | "SERVICE";
  readonly correlationId: string;
}

interface PrepareRecommendationInput {
  readonly caseId: string;
  readonly principalType: "HUMAN" | "SERVICE";
  readonly correlationId: string;
}

interface RejectWithAuditInput {
  readonly snapshot: ScenarioSnapshot;
  readonly state: ScenarioState;
  readonly correlationId: string;
  readonly type: string;
  readonly detail: string;
  readonly error: DemoHttpError;
  readonly outcome?: "DENY" | "FAILURE";
  readonly securityGateId?: string;
}

interface SuccessfulOperation {
  readonly payloadHash: string | null;
}

export class ReviewService {
  private readonly createId: () => string;
  private readonly now: () => string;
  private readonly getTenantId: () => string;
  private readonly demoAuthorityClient?: DemoAuthorityClient;
  private readonly phase5Client?: Phase5Client;
  private pendingMutation: Promise<void> = Promise.resolve();

  public constructor(private readonly dependencies: ReviewServiceDependencies) {
    if (dependencies.compatibilityMode === "LEGACY_TEST_ONLY") {
      if (!dependencies.phase5Client) {
        throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "ANALYSIS_AUTHORITY_REQUIRED");
      }
      this.phase5Client = dependencies.phase5Client;
    } else {
      if (!dependencies.demoAuthorityClient) {
        throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "ANALYSIS_AUTHORITY_REQUIRED");
      }
      this.demoAuthorityClient = dependencies.demoAuthorityClient;
    }
    this.createId = dependencies.createId ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.getTenantId = dependencies.getTenantId ?? (() => "local-stratton-demo");
  }

  public async submitReview(input: SubmitReviewInput): Promise<ScenarioState> {
    return this.withMutationLock(async () => {
      const snapshot = await this.dependencies.repository.load();
      const state = snapshot.state;
      assertCaseId(state, input.caseId);

      if (input.principalType !== "HUMAN") {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "SPECIALIST_REVIEW_DENIED",
          detail: "HUMAN_REVIEW_REQUIRED",
          error: new DemoHttpError(
            403,
            "POLICY_DENIED",
            "A human reviewer must approve or reject the specialist review."
          ),
          securityGateId: "CC002-R2-SEC-GATE-012"
        });
      }

      const finding = state.findings.find((candidate) => candidate.findingId === input.findingId);
      if (!finding) {
        throw new DemoHttpError(404, "INVALID_CONTRACT", "Finding does not exist in Project Danube.");
      }

      if (finding.status !== "ACCEPTED") {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "SPECIALIST_REVIEW_DENIED",
          detail: "ACCEPTED_FINDING_REQUIRED",
          error: new DemoHttpError(403, "POLICY_DENIED", "ACCEPTED_FINDING_REQUIRED")
        });
      }

      const eligibleReviewTypes = getEligibleReviewTypesForFinding(state, finding);
      if (!eligibleReviewTypes.includes(input.reviewType)) {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "SPECIALIST_REVIEW_DENIED",
          detail: "REVIEW_TYPE_NOT_ELIGIBLE_FOR_FINDING",
          error: new DemoHttpError(
            403,
            "POLICY_DENIED",
            "REVIEW_TYPE_NOT_ELIGIBLE_FOR_FINDING"
          )
        });
      }

      const analysisRunId = finding.analysisRunId ?? state.latestAnalysisRun?.analysisRunId;
      if (!analysisRunId) {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "SPECIALIST_REVIEW_DENIED",
          detail: "ANALYSIS_RUN_REQUIRED",
          outcome: "FAILURE",
          error: new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_RUN_REQUIRED")
        });
      }

      const analysisAuthority = this.demoAuthorityClient
        ? requireAnalysisAuthority(state)
        : undefined;
      const subjectVersion = analysisAuthority?.subjectVersion ?? getLatestFindingVersion(finding);
      if (input.subjectVersion !== subjectVersion) {
        throw new DemoHttpError(409, "STATE_CONFLICT", "FINDING_VERSION_STALE");
      }
      const projectionVersion = analysisAuthority
        ? createFindingProjectionVersion(finding, subjectVersion)
        : subjectVersion;

      const operationId = buildReviewOperationId(input, projectionVersion);
      const payloadHash = buildReviewPayloadHash(
        input,
        analysisRunId,
        projectionVersion
      );
      if (
        isSatisfiedRetry(
        findSuccessfulOperation(state.governanceEvents, "SPECIALIST_REVIEW_RECORDED", operationId),
        payloadHash,
        "REVIEW_RETRY_CONFLICT"
        )
      ) {
        return state;
      }

      const latestReview = getLatestReview(
        state.reviews,
        input.reviewType,
        input.findingId
      );
      if (
        latestReview?.findingId === input.findingId &&
        latestReview.subjectVersion === subjectVersion &&
        latestReview.projectionVersion === projectionVersion
      ) {
        if (latestReview.decision === input.decision) {
          return state;
        }

        throw new DemoHttpError(409, "STATE_CONFLICT", "REVIEW_RETRY_CONFLICT");
      }

      const reviewId = analysisAuthority
        ? createDeterministicReviewId(
            this.getTenantId(),
            analysisAuthority.analysisBundleId,
            operationId,
            payloadHash
          )
        : this.createId();
      if (this.demoAuthorityClient && analysisAuthority) {
        await this.demoAuthorityClient.submitBundleReview({
          tenantId: this.getTenantId(),
          caseId: input.caseId,
          analysisBundleId: analysisAuthority.analysisBundleId,
          reviewId,
          subjectVersion,
          reviewType: input.reviewType,
          decision: input.decision,
          rationale: input.rationale.trim(),
          evidenceManifestHash: analysisAuthority.evidenceManifestHash
        });
      } else {
        if (!this.phase5Client) {
          throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "ANALYSIS_AUTHORITY_REQUIRED");
        }
        await this.phase5Client.submitReview({
          caseId: input.caseId,
          analysisRunId,
          reviewType: input.reviewType,
          decision: input.decision,
          rationale: input.rationale.trim(),
          subjectVersion,
          idempotencyKey: operationId,
          correlationId: input.correlationId
        });
      }

      const analysisRequestFingerprint =
        finding.analysisRequestFingerprint ?? state.latestAnalysisRun?.analysisRequestFingerprint;
      const nextState: ScenarioState = {
        ...state,
        stage: "REVIEW",
        reviews: [
          ...state.reviews,
          {
            reviewId,
            reviewType: input.reviewType,
            decision: input.decision,
            findingId: input.findingId,
            subjectVersion,
            projectionVersion
          }
        ],
        governanceEvents: [
          ...state.governanceEvents,
          createGovernanceEvent(reviewId, this.now(), {
            type: "SPECIALIST_REVIEW_RECORDED",
            outcome: "SUCCESS",
            correlationId: input.correlationId,
            detail: `${input.reviewType}:${input.decision}:${input.findingId}`,
            metadata: {
              ...(analysisRequestFingerprint
                ? {
                    analysisRequestFingerprint
                  }
                : {}),
              phase5RunId: analysisRunId,
              findingIds: [input.findingId],
              operationId,
              payloadHash,
              subjectVersion
            }
          })
        ]
      };

      await this.dependencies.repository.save({
        ...snapshot,
        state: nextState
      });
      return nextState;
    });
  }

  public async prepareRecommendation(
    input: PrepareRecommendationInput
  ): Promise<ScenarioState> {
    return this.withMutationLock(async () => {
      const snapshot = await this.dependencies.repository.load();
      const state = snapshot.state;
      assertCaseId(state, input.caseId);

      if (input.principalType !== "HUMAN") {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "COMMITTEE_PACK_PREPARATION_DENIED",
          detail: "HUMAN_REVIEW_REQUIRED",
          error: new DemoHttpError(
            403,
            "POLICY_DENIED",
            "A human reviewer must request committee-pack preparation."
          ),
          securityGateId: "CC002-R2-SEC-GATE-012"
        });
      }

      const analysisRunId = state.latestAnalysisRun?.analysisRunId;
      if (!analysisRunId) {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "COMMITTEE_PACK_PREPARATION_DENIED",
          detail: "ANALYSIS_RUN_REQUIRED",
          outcome: "FAILURE",
          error: new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_RUN_REQUIRED")
        });
      }

      const recommendationBlocker = getRecommendationBlocker(state);
      if (recommendationBlocker) {
        return this.rejectWithAudit({
          snapshot,
          state,
          correlationId: input.correlationId,
          type: "COMMITTEE_PACK_PREPARATION_DENIED",
          detail: recommendationBlocker,
          error: new DemoHttpError(403, "POLICY_DENIED", recommendationBlocker)
        });
      }

      const analysisAuthority = this.demoAuthorityClient
        ? requireAnalysisAuthority(state)
        : undefined;
      const subjectVersion =
        analysisAuthority?.subjectVersion ?? buildRecommendationSubjectVersion(state);
      const operationId = buildPrepareOperationId(analysisRunId, subjectVersion);
      const payloadHash = buildPreparePayloadHash(input.caseId, analysisRunId, subjectVersion);
      if (
        isSatisfiedRetry(
        findSuccessfulOperation(state.governanceEvents, "COMMITTEE_PACK_DRAFT_PREPARED", operationId),
        payloadHash,
        "PREPARE_RETRY_CONFLICT"
        )
      ) {
        return state;
      }

      if (
        state.stage === "COMMITTEE_PREPARATION" &&
        state.governanceEvents.some(
          (event) => event.type === "COMMITTEE_PACK_DRAFT_PREPARED" && event.outcome === "SUCCESS"
        )
      ) {
        return state;
      }

      if (this.demoAuthorityClient && analysisAuthority) {
        await this.demoAuthorityClient.prepareBundleDraft({
          tenantId: this.getTenantId(),
          caseId: input.caseId,
          analysisBundleId: analysisAuthority.analysisBundleId,
          subjectVersion
        });
      } else {
        if (!this.phase5Client) {
          throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "ANALYSIS_AUTHORITY_REQUIRED");
        }
        await this.phase5Client.prepareDraft({
          caseId: input.caseId,
          analysisRunId,
          subjectVersion,
          idempotencyKey: operationId,
          correlationId: input.correlationId
        });
      }

      const nextState: ScenarioState = {
        ...state,
        stage: "COMMITTEE_PREPARATION",
        governanceEvents: [
          ...state.governanceEvents,
          createGovernanceEvent(this.createId(), this.now(), {
            type: "COMMITTEE_PACK_DRAFT_PREPARED",
            outcome: "SUCCESS",
            correlationId: input.correlationId,
            detail: analysisRunId,
            metadata: {
              phase5RunId: analysisRunId,
              ...(state.latestAnalysisRun?.analysisRequestFingerprint
                ? {
                    analysisRequestFingerprint: state.latestAnalysisRun.analysisRequestFingerprint
                  }
                : {}),
              findingIds: state.findings.map((finding) => finding.findingId),
              operationId,
              payloadHash,
              subjectVersion
            }
          })
        ]
      };

      await this.dependencies.repository.save({
        ...snapshot,
        state: nextState
      });
      return nextState;
    });
  }

  private async rejectWithAudit(input: RejectWithAuditInput): Promise<never> {
    const governanceEvents: ScenarioState["governanceEvents"] = [
      ...input.state.governanceEvents,
      createGovernanceEvent(this.createId(), this.now(), {
        type: input.type,
        outcome: input.outcome ?? "DENY",
        correlationId: input.correlationId,
        detail: input.detail,
        ...(input.state.latestAnalysisRun
          ? {
              metadata: {
                phase5RunId: input.state.latestAnalysisRun.analysisRunId,
                analysisRequestFingerprint: input.state.latestAnalysisRun.analysisRequestFingerprint,
                findingIds: input.state.findings.map((finding) => finding.findingId)
              }
            }
          : {})
      })
    ];

    if (input.securityGateId) {
      governanceEvents.push(
        createGovernanceEvent(this.createId(), this.now(), {
          type: "SECURITY_GATE_EVIDENCE_RECORDED",
          outcome: "FAILURE",
          correlationId: input.correlationId,
          detail: input.detail,
          metadata: {
            securityGateId: input.securityGateId,
            ...(input.state.latestAnalysisRun
              ? {
                  phase5RunId: input.state.latestAnalysisRun.analysisRunId,
                  analysisRequestFingerprint: input.state.latestAnalysisRun.analysisRequestFingerprint,
                  findingIds: input.state.findings.map((finding) => finding.findingId)
                }
              : {})
          }
        })
      );
    }

    await this.dependencies.repository.save({
      ...input.snapshot,
      state: {
        ...input.state,
        governanceEvents
      }
    });
    throw input.error;
  }

  private async withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const previousMutation = this.pendingMutation;
    let release: () => void = () => undefined;
    this.pendingMutation = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previousMutation;

    try {
      return await operation();
    } finally {
      release();
    }
  }
}

export function assertRecommendationReady(state: ScenarioState): void {
  const recommendationBlocker = getRecommendationBlocker(state);
  if (recommendationBlocker) {
    throw new DemoHttpError(403, "POLICY_DENIED", recommendationBlocker);
  }
}

function requireAnalysisAuthority(
  state: ScenarioState
): NonNullable<ScenarioState["analysisAuthority"]> {
  if (!state.analysisAuthority) {
    throw new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_AUTHORITY_REQUIRED");
  }
  return state.analysisAuthority;
}

function getRecommendationBlocker(state: ScenarioState): string | null {
  const hasUnresolvedMaterialFinding = state.findings.some(
    (finding) =>
      (finding.materiality === "HIGH" || finding.materiality === "CRITICAL") &&
      finding.status !== "ACCEPTED"
  );
  if (hasUnresolvedMaterialFinding) {
    return "MATERIAL_FINDING_UNRESOLVED";
  }

  for (const finding of state.findings.filter(
    (candidate) =>
      candidate.status === "ACCEPTED" &&
      (candidate.materiality === "HIGH" || candidate.materiality === "CRITICAL")
  )) {
    for (const reviewType of getEligibleReviewTypesForFinding(state, finding)) {
      const latestReview = getLatestReview(
        state.reviews,
        reviewType,
        finding.findingId
      );
      const requiredSubjectVersion =
        state.analysisAuthority?.subjectVersion ?? getLatestFindingVersion(finding);
      const requiredProjectionVersion = state.analysisAuthority
        ? createFindingProjectionVersion(finding, requiredSubjectVersion)
        : requiredSubjectVersion;
      const isCurrentApproval =
        latestReview?.decision === "APPROVED" &&
        latestReview.subjectVersion === requiredSubjectVersion &&
        latestReview.projectionVersion === requiredProjectionVersion;

      if (!isCurrentApproval) {
        return `${reviewType}_REVIEW_REQUIRED:${finding.findingId}`;
      }
    }
  }

  return getSecurityGateReadinessBlocker(state);
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

function getLatestFindingVersion(finding: AnalysisFinding): string {
  return finding.textHistory.at(-1)?.versionId ?? finding.findingId;
}

function buildReviewOperationId(
  input: SubmitReviewInput,
  projectionVersion: string
): string {
  const base = `review:${input.reviewType}:${input.findingId}:${input.subjectVersion}`;
  return projectionVersion === input.subjectVersion
    ? base
    : `${base}:${projectionVersion}`;
}

function buildPrepareOperationId(analysisRunId: string, subjectVersion: string): string {
  return `draft:${analysisRunId}:${subjectVersion}`;
}

function buildReviewPayloadHash(
  input: SubmitReviewInput,
  analysisRunId: string,
  projectionVersion: string
): string {
  return hashPayload({
    caseId: input.caseId,
    analysisRunId,
    reviewType: input.reviewType,
    decision: input.decision,
    rationale: input.rationale.trim(),
    findingId: input.findingId,
    subjectVersion: input.subjectVersion,
    projectionVersion
  });
}

function createDeterministicReviewId(
  tenantId: string,
  analysisBundleId: string,
  operationId: string,
  payloadHash: string
): string {
  return `review-${hashPayload({
    tenantId,
    analysisBundleId,
    operationId,
    payloadHash
  })}`;
}

function buildPreparePayloadHash(
  caseId: string,
  analysisRunId: string,
  subjectVersion: string
): string {
  return hashPayload({
    caseId,
    analysisRunId,
    subjectVersion
  });
}

function buildRecommendationSubjectVersion(state: ScenarioState): string {
  const materialFindings = state.findings
    .filter((finding) => finding.materiality === "HIGH" || finding.materiality === "CRITICAL")
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

  return hashPayload({
    analysisRequestFingerprint: state.latestAnalysisRun?.analysisRequestFingerprint ?? "unknown",
    materialFindings,
    reviews
  });
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

function assertCaseId(state: ScenarioState, caseId: string): void {
  if (state.caseId !== caseId) {
    throw new DemoHttpError(403, "POLICY_DENIED", "Requested case is outside the Project Danube scope.");
  }
}

function findSuccessfulOperation(
  events: readonly ScenarioState["governanceEvents"][number][],
  type: string,
  operationId: string
): SuccessfulOperation | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (
      event?.type === type &&
      event.outcome === "SUCCESS" &&
      event.metadata?.operationId === operationId
    ) {
      return {
        payloadHash: event.metadata.payloadHash ?? null
      };
    }
  }

  return null;
}

function isSatisfiedRetry(
  operation: SuccessfulOperation | null,
  payloadHash: string,
  message: string
): boolean {
  if (!operation) {
    return false;
  }

  if (operation.payloadHash !== null && operation.payloadHash !== payloadHash) {
    throw new DemoHttpError(409, "STATE_CONFLICT", message);
  }

  return true;
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function createGovernanceEvent(
  eventId: string,
  occurredAtIso: string,
  event: Omit<ScenarioState["governanceEvents"][number], "eventId" | "occurredAtIso">
): ScenarioState["governanceEvents"][number] {
  return {
    eventId,
    occurredAtIso,
    ...event
  };
}
