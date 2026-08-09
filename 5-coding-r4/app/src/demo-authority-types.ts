import type { ReviewDecision, ReviewType } from "./types.js";

export type AnalysisBundleStatus =
  | "QUEUED"
  | "IN_PROGRESS"
  | "DRAFT_ONLY_READY"
  | "BLOCKED_MISSING_EVIDENCE"
  | "FAILED";

export interface AnalysisBundleRecord {
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
  readonly totalClaims: number;
  readonly citedClaims: number;
  readonly materialClaims: number;
  readonly citedMaterialClaims: number;
  readonly subjectVersion?: string;
}

export interface AnalysisBundleEvidenceRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly evidenceId: string;
  readonly evidenceVersionId: string;
  readonly ordinal: number;
}

export interface ApprovedModelRouteEvidence {
  readonly tenantId: string;
  readonly evidenceId: string;
  readonly status: "APPROVED" | "SUSPENDED" | "EXPIRED";
  readonly resourceId: string;
  readonly deploymentId: string;
  readonly region: string;
  readonly route: "LUNA" | "TERRA" | "SOL";
  readonly apiVersion: string;
  readonly evidenceVersion: string;
  readonly validFromIso: string;
  readonly validUntilIso: string;
}

export interface AnalysisBundleCompletionRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly subjectVersion: string;
  readonly status: "DRAFT_ONLY_READY";
  readonly unsupportedClaims: number;
  readonly totalClaims: number;
  readonly citedClaims: number;
  readonly materialClaims: number;
  readonly citedMaterialClaims: number;
}

export interface AnalysisBundleReviewRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly reviewId: string;
  readonly subjectVersion: string;
  readonly reviewType: ReviewType;
  readonly decision: ReviewDecision;
  readonly rationale: string;
  readonly reviewerObjectId: string;
  readonly evidenceManifestHash: string;
}
