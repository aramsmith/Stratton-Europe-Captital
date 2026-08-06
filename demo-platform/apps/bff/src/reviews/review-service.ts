import { createHash, randomUUID } from "node:crypto";
import type {
  AnalysisFinding,
  ReviewSubmissionRequest,
  ReviewType,
  ScenarioState
} from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";
import type { Phase5Client } from "../phase5/phase5-client.js";
import type { ScenarioRepository, ScenarioSnapshot } from "../scenario/scenario-repository.js";

const requiredReviewTypes = ["DEAL", "LEGAL", "COMPLIANCE"] as const satisfies readonly ReviewType[];

interface ReviewServiceDependencies {
  readonly repository: ScenarioRepository;
  readonly phase5Client: Phase5Client;
  readonly createId?: () => string;
  readonly now?: () => string;
}

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
  private pendingMutation: Promise<void> = Promise.resolve();

  public constructor(private readonly dependencies: ReviewServiceDependencies) {
    this.createId = dependencies.createId ?? randomUUID;
    this.now = dependencies.now ?? (() => new Date().toISOString());
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

      const subjectVersion = getLatestFindingVersion(finding);
      if (input.subjectVersion !== subjectVersion) {
        throw new DemoHttpError(409, "STATE_CONFLICT", "FINDING_VERSION_STALE");
      }

      const operationId = buildReviewOperationId(input);
      const payloadHash = buildReviewPayloadHash(input, analysisRunId);
      if (
        isSatisfiedRetry(
        findSuccessfulOperation(state.governanceEvents, "SPECIALIST_REVIEW_RECORDED", operationId),
        payloadHash,
        "REVIEW_RETRY_CONFLICT"
        )
      ) {
        return state;
      }

      const latestReview = getLatestReview(state.reviews, input.reviewType);
      if (
        latestReview?.findingId === input.findingId &&
        latestReview.subjectVersion === subjectVersion
      ) {
        if (latestReview.decision === input.decision) {
          return state;
        }

        throw new DemoHttpError(409, "STATE_CONFLICT", "REVIEW_RETRY_CONFLICT");
      }

      await this.dependencies.phase5Client.submitReview({
        caseId: input.caseId,
        analysisRunId,
        reviewType: input.reviewType,
        decision: input.decision,
        rationale: input.rationale.trim(),
        subjectVersion,
        idempotencyKey: operationId
      });

      const reviewId = this.createId();
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
            subjectVersion
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

      const subjectVersion = buildRecommendationSubjectVersion(state);
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

      await this.dependencies.phase5Client.prepareDraft({
        caseId: input.caseId,
        analysisRunId,
        subjectVersion,
        idempotencyKey: operationId
      });

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

function getRecommendationBlocker(state: ScenarioState): string | null {
  for (const reviewType of requiredReviewTypes) {
    const latestReview = getLatestReview(state.reviews, reviewType);
    const reviewedFinding = latestReview
      ? state.findings.find((finding) => finding.findingId === latestReview.findingId)
      : undefined;
    const isCurrentApproval =
      latestReview?.decision === "APPROVED" &&
      reviewedFinding?.status === "ACCEPTED" &&
      latestReview.subjectVersion === getLatestFindingVersion(reviewedFinding);

    if (!isCurrentApproval) {
      return `${reviewType}_REVIEW_REQUIRED`;
    }
  }

  const hasUnresolvedMaterialFinding = state.findings.some(
    (finding) =>
      (finding.materiality === "HIGH" || finding.materiality === "CRITICAL") &&
      finding.status !== "ACCEPTED"
  );
  if (hasUnresolvedMaterialFinding) {
    return "MATERIAL_FINDING_UNRESOLVED";
  }

  return null;
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

function buildReviewOperationId(input: SubmitReviewInput): string {
  return `review:${input.reviewType}:${input.findingId}:${input.subjectVersion}`;
}

function buildPrepareOperationId(analysisRunId: string, subjectVersion: string): string {
  return `draft:${analysisRunId}:${subjectVersion}`;
}

function buildReviewPayloadHash(input: SubmitReviewInput, analysisRunId: string): string {
  return hashPayload({
    caseId: input.caseId,
    analysisRunId,
    reviewType: input.reviewType,
    decision: input.decision,
    rationale: input.rationale.trim(),
    findingId: input.findingId,
    subjectVersion: input.subjectVersion
  });
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
  const reviews = requiredReviewTypes.map((reviewType) => {
    const latestReview = getLatestReview(state.reviews, reviewType);
    return {
      reviewType,
      decision: latestReview?.decision ?? "PENDING",
      findingId: latestReview?.findingId ?? "unassigned",
      subjectVersion: latestReview?.subjectVersion ?? "missing"
    };
  });

  return hashPayload({
    analysisRequestFingerprint: state.latestAnalysisRun?.analysisRequestFingerprint ?? "unknown",
    materialFindings,
    reviews
  });
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
