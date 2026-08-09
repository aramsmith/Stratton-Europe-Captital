import { createHash } from "node:crypto";
import type {
  AnalysisBundleCompletionRecord,
  AnalysisBundleEvidenceRecord,
  AnalysisBundleRecord,
  AnalysisBundleReviewRecord,
  AnalysisBundleStatus,
  ApprovedModelRouteEvidence,
  AuthenticatedPrincipal,
  CitationAssessment,
  ReviewDecision,
  ReviewType,
  WorkloadRepository
} from "./types.js";

export type DemoAuthorityErrorCode =
  | "INVALID_CONTRACT"
  | "POLICY_DENIED"
  | "STATE_CONFLICT"
  | "EVIDENCE_INCOMPLETE";

export class DemoAuthorityError extends Error {
  public constructor(
    public readonly code: DemoAuthorityErrorCode,
    public readonly statusCode: 400 | 403 | 409 | 422
  ) {
    super(code);
  }
}

export interface DemoAuthorityServiceConfig {
  readonly repository: WorkloadRepository;
  readonly completionClientId: string;
}

export interface CreateDemoAnalysisBundleInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly evidenceManifestHash: string;
  readonly modelRoute: "LUNA" | "TERRA" | "SOL";
  readonly modelDeploymentId: string;
  readonly routeEvidenceId: string;
  readonly promptTemplateVersion: string;
  readonly requestFingerprint: string;
  readonly evidenceIds: readonly string[];
}

export interface CompleteDemoAnalysisBundleInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly subjectVersion: string;
  readonly status: Exclude<AnalysisBundleStatus, "QUEUED" | "IN_PROGRESS">;
  readonly unsupportedClaims: number;
}

export interface SubmitDemoBundleReviewInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly reviewId: string;
  readonly subjectVersion: string;
  readonly reviewType: ReviewType;
  readonly decision: ReviewDecision;
  readonly rationale: string;
  readonly evidenceManifestHash: string;
}

export interface PrepareDemoBundleDraftInput {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly subjectVersion: string;
}

export interface DemoCitationCounts {
  readonly totalClaims: number;
  readonly citedClaims: number;
  readonly unsupportedClaims: number;
}

export interface DemoBundleEvidence {
  readonly evidenceId: string;
  readonly evidenceVersionId: string;
  readonly ordinal: number;
}

export interface DemoAuthorityBundleResponse {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly evidenceManifestHash: string;
  readonly modelRoute: "LUNA" | "TERRA" | "SOL";
  readonly modelDeploymentId: string;
  readonly routeEvidenceId: string;
  readonly promptTemplateVersion: string;
  readonly requestFingerprint: string;
  readonly status: AnalysisBundleStatus;
  readonly outputKind: "DRAFT_ONLY";
  readonly unsupportedClaims: number;
  readonly subjectVersion?: string;
  readonly evidence: readonly DemoBundleEvidence[];
  readonly citationCounts: DemoCitationCounts;
}

function fail(code: DemoAuthorityErrorCode, statusCode: 400 | 403 | 409 | 422): never {
  throw new DemoAuthorityError(code, statusCode);
}

function requireHumanRole(principal: AuthenticatedPrincipal, role: string): void {
  if (!principal.isHuman || !principal.roles.includes(role)) {
    fail("POLICY_DENIED", 403);
  }
}

function requireFields(record: Record<string, unknown>, fields: readonly string[]): void {
  for (const field of fields) {
    if (typeof record[field] !== "string" || (record[field] as string).trim().length === 0) {
      fail("INVALID_CONTRACT", 400);
    }
  }
}

function citationCounts(assessment: CitationAssessment): DemoCitationCounts {
  return {
    totalClaims: assessment.totalClaimCount,
    citedClaims: assessment.citedClaimCount,
    unsupportedClaims: assessment.unsupportedClaimCount
  };
}

function isRouteEvidenceCurrent(routeEvidence: ApprovedModelRouteEvidence): boolean {
  const now = Date.now();
  return (
    routeEvidence.status === "APPROVED" &&
    Date.parse(routeEvidence.validFromIso) <= now &&
    Date.parse(routeEvidence.validUntilIso) > now
  );
}

async function requireRouteEvidence(
  repository: WorkloadRepository,
  routeEvidenceId: string,
  route: "LUNA" | "TERRA" | "SOL",
  deploymentId: string
): Promise<ApprovedModelRouteEvidence> {
  const routeEvidence = await repository.getApprovedModelRouteEvidence(routeEvidenceId);
  if (
    !routeEvidence ||
    !isRouteEvidenceCurrent(routeEvidence) ||
    routeEvidence.route !== route ||
    routeEvidence.deploymentId !== deploymentId
  ) {
    fail("POLICY_DENIED", 403);
  }
  return routeEvidence;
}

async function requireCaseAccess(
  repository: WorkloadRepository,
  principal: AuthenticatedPrincipal,
  tenantId: string,
  caseId: string
): Promise<void> {
  if (tenantId !== principal.tenantId) {
    fail("POLICY_DENIED", 403);
  }
  const caseRecord = await repository.getCase(tenantId, caseId);
  if (!caseRecord) {
    fail("STATE_CONFLICT", 409);
  }
  if (!(await repository.assertCaseAccess(tenantId, caseId, principal.subjectId, caseRecord.purpose))) {
    fail("POLICY_DENIED", 403);
  }
}

function evidenceManifestHash(
  tenantId: string,
  caseId: string,
  evidence: readonly AnalysisBundleEvidenceRecord[]
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenantId,
        caseId,
        evidence: evidence.map(({ evidenceId, evidenceVersionId, ordinal }) => ({
          evidenceId,
          evidenceVersionId,
          ordinal
        }))
      })
    )
    .digest("hex");
}

async function requireCompleteCitations(
  repository: WorkloadRepository,
  tenantId: string,
  caseId: string,
  analysisBundleId: string
): Promise<CitationAssessment> {
  const assessment = await repository.getCitationAssessment(tenantId, caseId, analysisBundleId);
  if (
    assessment.totalClaimCount === 0 ||
    assessment.materialClaimCount === 0 ||
    !assessment.allMaterialClaimsCited
  ) {
    fail("EVIDENCE_INCOMPLETE", 422);
  }
  return assessment;
}

export function createDemoAuthorityService(config: DemoAuthorityServiceConfig) {
  const { repository } = config;

  async function response(record: AnalysisBundleRecord): Promise<DemoAuthorityBundleResponse> {
    const [evidence, assessment] = await Promise.all([
      repository.listAnalysisBundleEvidence(record.tenantId, record.caseId, record.analysisBundleId),
      repository.getCitationAssessment(record.tenantId, record.caseId, record.analysisBundleId)
    ]);
    return {
      ...record,
      evidence: evidence.map(({ evidenceId, evidenceVersionId, ordinal }) => ({
        evidenceId,
        evidenceVersionId,
        ordinal
      })),
      citationCounts: citationCounts(assessment)
    };
  }

  return {
    async createBundle(
      principal: AuthenticatedPrincipal,
      input: CreateDemoAnalysisBundleInput
    ): Promise<DemoAuthorityBundleResponse> {
      requireHumanRole(principal, "DealContributor");
      requireFields(input as unknown as Record<string, unknown>, [
        "tenantId",
        "caseId",
        "analysisBundleId",
        "evidenceManifestHash",
        "modelDeploymentId",
        "routeEvidenceId",
        "promptTemplateVersion",
        "requestFingerprint"
      ]);
      if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0) {
        fail("INVALID_CONTRACT", 400);
      }
      await requireCaseAccess(repository, principal, input.tenantId, input.caseId);
      await requireRouteEvidence(repository, input.routeEvidenceId, input.modelRoute, input.modelDeploymentId);

      const evidenceIds = [...new Set(input.evidenceIds.map((evidenceId) => evidenceId.trim()))].sort((a, b) =>
        a.localeCompare(b)
      );
      if (evidenceIds.some((evidenceId) => evidenceId.length === 0)) {
        fail("INVALID_CONTRACT", 400);
      }
      const evidence: AnalysisBundleEvidenceRecord[] = [];
      for (const [index, evidenceId] of evidenceIds.entries()) {
        const envelope = await repository.getEvidence(input.tenantId, input.caseId, evidenceId);
        if (!envelope || envelope.admissionStatus !== "ADMITTED" || envelope.qualityStatus !== "APPROVED") {
          fail("EVIDENCE_INCOMPLETE", 422);
        }
        const [object, source] = await Promise.all([
          repository.getLatestEvidenceObject(input.tenantId, input.caseId, evidenceId),
          repository.getSource(input.tenantId, input.caseId, envelope.sourceId)
        ]);
        const licence = source
          ? await repository.getLatestExternalLicenceDecision(input.tenantId, input.caseId, source.sourceId)
          : undefined;
        const processed = await Promise.all([
          repository.hasProcessedWorkItem(
            input.tenantId,
            input.caseId,
            "REQUEST_EXTRACTION",
            envelope.payloadReference
          ),
          repository.hasProcessedWorkItem(
            input.tenantId,
            input.caseId,
            "REQUEST_INDEXING",
            envelope.payloadReference
          )
        ]);
        if (
          !object ||
          object.contentHash !== envelope.contentHash ||
          object.malwareScanStatus !== "CLEAN" ||
          object.dispositionStatus === "DISPOSED" ||
          !source ||
          source.status !== "ACTIVE" ||
          !licence ||
          Date.parse(licence.expiresAtIso) <= Date.now() ||
          !licence.aiRetrievalAllowed ||
          !licence.aiAnalysisAllowed ||
          !licence.purposeApproved ||
          !licence.privacyApproved ||
          !licence.licenceCompatible ||
          licence.purposeId !== envelope.purposeId ||
          !processed.every(Boolean) ||
          !(await repository.isEvidenceVersionReadyForAnalysis(
            input.tenantId,
            input.caseId,
            evidenceId,
            object.evidenceVersionId
          ))
        ) {
          fail("EVIDENCE_INCOMPLETE", 422);
        }
        evidence.push({
          tenantId: input.tenantId,
          caseId: input.caseId,
          analysisBundleId: input.analysisBundleId,
          evidenceId,
          evidenceVersionId: object.evidenceVersionId,
          ordinal: index + 1
        });
      }

      const record: AnalysisBundleRecord = {
        tenantId: input.tenantId,
        caseId: input.caseId,
        analysisBundleId: input.analysisBundleId,
        evidenceManifestHash: evidenceManifestHash(input.tenantId, input.caseId, evidence),
        modelRoute: input.modelRoute,
        modelDeploymentId: input.modelDeploymentId,
        routeEvidenceId: input.routeEvidenceId,
        promptTemplateVersion: input.promptTemplateVersion,
        requestFingerprint: input.requestFingerprint,
        status: "QUEUED",
        outputKind: "DRAFT_ONLY",
        unsupportedClaims: 0
      };
      try {
        await repository.createAnalysisBundle(record);
        for (const item of evidence) {
          await repository.appendAnalysisBundleEvidence(item);
        }
      } catch {
        fail("STATE_CONFLICT", 409);
      }
      return response(record);
    },

    async getBundle(
      principal: AuthenticatedPrincipal,
      analysisBundleId: string
    ): Promise<DemoAuthorityBundleResponse> {
      requireHumanRole(principal, "CaseReader");
      const record = await findBundle(repository, principal.tenantId, analysisBundleId);
      await requireCaseAccess(repository, principal, record.tenantId, record.caseId);
      return response(record);
    },

    async completeBundle(
      principal: AuthenticatedPrincipal,
      input: CompleteDemoAnalysisBundleInput
    ): Promise<DemoAuthorityBundleResponse> {
      if (principal.isHuman || !principal.applicationId || principal.applicationId !== config.completionClientId) {
        fail("POLICY_DENIED", 403);
      }
      requireFields(input as unknown as Record<string, unknown>, [
        "tenantId",
        "caseId",
        "analysisBundleId",
        "subjectVersion",
        "status"
      ]);
      if (
        input.tenantId !== principal.tenantId ||
        input.status !== "DRAFT_ONLY_READY" ||
        !Number.isInteger(input.unsupportedClaims) ||
        input.unsupportedClaims < 0
      ) {
        fail("STATE_CONFLICT", 409);
      }
      const record = await repository.getAnalysisBundle(input.tenantId, input.caseId, input.analysisBundleId);
      if (!record) {
        fail("STATE_CONFLICT", 409);
      }
      await requireRouteEvidence(repository, record.routeEvidenceId, record.modelRoute, record.modelDeploymentId);
      if (record.subjectVersion) {
        if (
          record.subjectVersion === input.subjectVersion &&
          record.status === "DRAFT_ONLY_READY" &&
          record.unsupportedClaims === input.unsupportedClaims
        ) {
          return response(record);
        }
        fail("STATE_CONFLICT", 409);
      }
      if (record.status !== "QUEUED") {
        fail("STATE_CONFLICT", 409);
      }
      const assessment = await requireCompleteCitations(
        repository,
        input.tenantId,
        input.caseId,
        input.analysisBundleId
      );
      const expectedSubjectVersion = await repository.buildEvidenceManifestHash(
        input.tenantId,
        input.caseId,
        input.analysisBundleId
      );
      if (
        input.subjectVersion !== expectedSubjectVersion ||
        input.unsupportedClaims !== assessment.unsupportedClaimCount ||
        assessment.unsupportedClaimCount !== 0
      ) {
        fail("EVIDENCE_INCOMPLETE", 422);
      }
      const completion: AnalysisBundleCompletionRecord = {
        tenantId: input.tenantId,
        caseId: input.caseId,
        analysisBundleId: input.analysisBundleId,
        subjectVersion: input.subjectVersion,
        status: "DRAFT_ONLY_READY",
        unsupportedClaims: input.unsupportedClaims
      };
      try {
        await repository.completeAnalysisBundle(completion);
      } catch {
        fail("STATE_CONFLICT", 409);
      }
      return response({ ...record, ...completion, outputKind: "DRAFT_ONLY" });
    },

    async submitReview(
      principal: AuthenticatedPrincipal,
      input: SubmitDemoBundleReviewInput
    ): Promise<{ readonly analysisBundleId: string; readonly reviewType: ReviewType; readonly decision: ReviewDecision }> {
      if (!principal.isHuman) {
        fail("POLICY_DENIED", 403);
      }
      requireFields(input as unknown as Record<string, unknown>, [
        "tenantId",
        "caseId",
        "analysisBundleId",
        "reviewId",
        "subjectVersion",
        "rationale",
        "evidenceManifestHash"
      ]);
      const requiredRoleByReview: Readonly<Record<ReviewType, string>> = {
        DEAL: "DealReviewer",
        LEGAL: "LegalApprover",
        COMPLIANCE: "ComplianceApprover"
      };
      if (!["DEAL", "LEGAL", "COMPLIANCE"].includes(input.reviewType)) {
        fail("INVALID_CONTRACT", 400);
      }
      if (input.decision !== "APPROVED" && input.decision !== "REJECTED") {
        fail("INVALID_CONTRACT", 400);
      }
      requireHumanRole(principal, requiredRoleByReview[input.reviewType]);
      await requireCaseAccess(repository, principal, input.tenantId, input.caseId);
      const bundle = await repository.getAnalysisBundle(input.tenantId, input.caseId, input.analysisBundleId);
      if (
        !bundle ||
        bundle.status !== "DRAFT_ONLY_READY" ||
        bundle.subjectVersion !== input.subjectVersion ||
        bundle.evidenceManifestHash !== input.evidenceManifestHash
      ) {
        fail("STATE_CONFLICT", 409);
      }
      await requireCompleteCitations(repository, input.tenantId, input.caseId, input.analysisBundleId);
      const review: AnalysisBundleReviewRecord = {
        tenantId: input.tenantId,
        caseId: input.caseId,
        analysisBundleId: input.analysisBundleId,
        reviewId: input.reviewId,
        subjectVersion: input.subjectVersion,
        reviewType: input.reviewType,
        decision: input.decision,
        rationale: input.rationale,
        reviewerObjectId: principal.subjectId,
        evidenceManifestHash: input.evidenceManifestHash
      };
      const reviews = await repository.listAnalysisBundleReviews(input.tenantId, input.caseId, input.analysisBundleId);
      const existing = reviews.find((item) => item.reviewId === review.reviewId);
      if (existing && JSON.stringify(existing) !== JSON.stringify(review)) {
        fail("STATE_CONFLICT", 409);
      }
      await repository.appendAnalysisBundleReview(review);
      return {
        analysisBundleId: input.analysisBundleId,
        reviewType: input.reviewType,
        decision: input.decision
      };
    },

    async prepareDraft(
      principal: AuthenticatedPrincipal,
      input: PrepareDemoBundleDraftInput
    ): Promise<{
      readonly caseId: string;
      readonly analysisBundleId: string;
      readonly status: "DRAFT_RECOMMENDATION_READY";
      readonly outputKind: "DRAFT_ONLY";
      readonly citationCounts: DemoCitationCounts;
    }> {
      requireHumanRole(principal, "DealReviewer");
      requireFields(input as unknown as Record<string, unknown>, [
        "tenantId",
        "caseId",
        "analysisBundleId",
        "subjectVersion"
      ]);
      await requireCaseAccess(repository, principal, input.tenantId, input.caseId);
      const bundle = await repository.getAnalysisBundle(input.tenantId, input.caseId, input.analysisBundleId);
      if (!bundle || bundle.status !== "DRAFT_ONLY_READY" || bundle.subjectVersion !== input.subjectVersion) {
        fail("STATE_CONFLICT", 409);
      }
      const reviews = await repository.listAnalysisBundleReviews(input.tenantId, input.caseId, input.analysisBundleId);
      for (const reviewType of ["DEAL", "LEGAL", "COMPLIANCE"] as const) {
        const current = [...reviews].reverse().find((review) => review.reviewType === reviewType);
        if (
          !current ||
          current.decision !== "APPROVED" ||
          current.subjectVersion !== bundle.subjectVersion ||
          current.evidenceManifestHash !== bundle.evidenceManifestHash
        ) {
          fail("POLICY_DENIED", 403);
        }
      }
      const assessment = await requireCompleteCitations(
        repository,
        input.tenantId,
        input.caseId,
        input.analysisBundleId
      );
      return {
        caseId: input.caseId,
        analysisBundleId: input.analysisBundleId,
        status: "DRAFT_RECOMMENDATION_READY",
        outputKind: "DRAFT_ONLY",
        citationCounts: citationCounts(assessment)
      };
    },

    async getRouteEvidence(
      principal: AuthenticatedPrincipal,
      evidenceId: string
    ): Promise<ApprovedModelRouteEvidence> {
      if (
        !(principal.isHuman && principal.roles.includes("CaseReader")) &&
        principal.applicationId !== config.completionClientId
      ) {
        fail("POLICY_DENIED", 403);
      }
      const routeEvidence = await repository.getApprovedModelRouteEvidence(evidenceId);
      if (!routeEvidence || !isRouteEvidenceCurrent(routeEvidence)) {
        fail("POLICY_DENIED", 403);
      }
      return routeEvidence;
    }
  };
}

async function findBundle(
  repository: WorkloadRepository,
  tenantId: string,
  analysisBundleId: string
): Promise<AnalysisBundleRecord> {
  const run = await repository.getAnalysisRunById(tenantId, analysisBundleId);
  const caseId = run?.caseId;
  if (!caseId) {
    fail("STATE_CONFLICT", 409);
  }
  const bundle = await repository.getAnalysisBundle(tenantId, caseId, analysisBundleId);
  if (!bundle) {
    fail("STATE_CONFLICT", 409);
  }
  return bundle;
}
