import { createHash } from "node:crypto";
import { DemoHttpError } from "../errors.js";
import { getTrustedRequestContext } from "../identity/request-context.js";
import type {
  AnalysisBundleStatus,
  DemoAuthorityClient,
  SubmitBundleReviewInput
} from "./demo-authority-client.js";

interface LocalCompletionPrincipal {
  readonly principalType: "HUMAN" | "APPLICATION";
  readonly tenantId: string;
  readonly applicationId?: string;
}

interface CreateLocalDemoAuthorityClientOptions {
  readonly mode: "LOCAL" | "AZURE";
  readonly getCompletionPrincipal?: () => LocalCompletionPrincipal;
}

export function createLocalDemoAuthorityClient(
  options: CreateLocalDemoAuthorityClientOptions
): DemoAuthorityClient {
  if (options.mode !== "LOCAL") {
    throw new DemoHttpError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "LOCAL_DEMO_AUTHORITY_REQUIRES_LOCAL_MODE"
    );
  }

  const bundles = new Map<string, AnalysisBundleStatus>();
  const admissions = new Set<string>();
  const reviews = new Map<string, SubmitBundleReviewInput[]>();
  const getCompletionPrincipal =
    options.getCompletionPrincipal ??
    (() => ({
      principalType: "APPLICATION" as const,
      tenantId: getTrustedRequestContext().identity.tenantId,
      applicationId: "local-demo-bff"
    }));

  const requireHuman = (tenantId: string) => {
    const context = getTrustedRequestContext();
    if (context.identity.principalType !== "HUMAN" || !context.delegatedUserToken) {
      throw new DemoHttpError(401, "UNAUTHENTICATED", "DELEGATED_TOKEN_REQUIRED");
    }
    if (context.identity.tenantId !== tenantId) {
      throw new DemoHttpError(403, "POLICY_DENIED", "DELEGATED_TOKEN_TENANT_MISMATCH");
    }
    return context;
  };
  const requireApplication = (tenantId: string) => {
    const principal = getCompletionPrincipal();
    if (
      principal.principalType !== "APPLICATION" ||
      !principal.applicationId?.trim()
    ) {
      throw new DemoHttpError(
        403,
        "POLICY_DENIED",
        "APPLICATION_COMPLETION_REQUIRED"
      );
    }
    if (principal.tenantId !== tenantId) {
      throw new DemoHttpError(
        403,
        "POLICY_DENIED",
        "APPLICATION_COMPLETION_TENANT_MISMATCH"
      );
    }
  };

  return {
    async admitEvidence(input) {
      requireHuman(input.tenantId);
      admissions.add(admissionKey(input.tenantId, input.caseId, input.evidenceId));
    },
    async createAnalysisBundle(input) {
      requireHuman(input.tenantId);
      const existing = bundles.get(input.analysisBundleId);
      if (existing) {
        assertBundleMatchesInput(existing, input);
        return existing;
      }
      const evidence = [...new Set(input.evidenceIds)]
        .sort((left, right) => left.localeCompare(right))
        .map((evidenceId, index) => {
          if (!admissions.has(admissionKey(input.tenantId, input.caseId, evidenceId))) {
            throw new DemoHttpError(
              422,
              "EVIDENCE_INCOMPLETE",
              "LOCAL_EVIDENCE_NOT_ADMITTED"
            );
          }
          return {
            evidenceId,
            evidenceVersionId: `${evidenceId}-v1`,
            ordinal: index + 1
          };
        });
      const bundle: AnalysisBundleStatus = {
        tenantId: input.tenantId,
        caseId: input.caseId,
        analysisBundleId: input.analysisBundleId,
        evidenceManifestHash: createEvidenceManifestHash(
          input.tenantId,
          input.caseId,
          evidence
        ),
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
          unsupportedClaims: 0
        }
      };
      bundles.set(bundle.analysisBundleId, bundle);
      return bundle;
    },
    async completeAnalysisBundle(input) {
      requireApplication(input.tenantId);
      const existing = bundles.get(input.analysisBundleId);
      if (
        !existing ||
        existing.tenantId !== input.tenantId ||
        existing.caseId !== input.caseId ||
        input.status !== "DRAFT_ONLY_READY"
      ) {
        throw new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_BUNDLE_COMPLETION_INVALID");
      }
      const completed: AnalysisBundleStatus = {
        ...existing,
        status: input.status,
        unsupportedClaims: input.unsupportedClaims,
        subjectVersion: input.subjectVersion,
        citationCounts: {
          ...existing.citationCounts,
          unsupportedClaims: input.unsupportedClaims
        }
      };
      bundles.set(completed.analysisBundleId, completed);
      return completed;
    },
    async getAnalysisBundle(bundleId) {
      const bundle = bundles.get(bundleId);
      if (!bundle) {
        throw new DemoHttpError(404, "INVALID_CONTRACT", "ANALYSIS_BUNDLE_NOT_FOUND");
      }
      requireHuman(bundle.tenantId);
      return bundle;
    },
    async submitBundleReview(input) {
      requireHuman(input.tenantId);
      assertReadyBundle(
        bundles.get(input.analysisBundleId),
        input.tenantId,
        input.caseId,
        input.subjectVersion,
        input.evidenceManifestHash
      );
      const bundleReviews = reviews.get(input.analysisBundleId) ?? [];
      const existing = bundleReviews.find((review) => review.reviewId === input.reviewId);
      if (existing && JSON.stringify(existing) !== JSON.stringify(input)) {
        throw new DemoHttpError(409, "STATE_CONFLICT", "REVIEW_RETRY_CONFLICT");
      }
      if (!existing) {
        reviews.set(input.analysisBundleId, [...bundleReviews, input]);
      }
    },
    async prepareBundleDraft(input) {
      requireHuman(input.tenantId);
      const bundle = bundles.get(input.analysisBundleId);
      assertReadyBundle(
        bundle,
        input.tenantId,
        input.caseId,
        input.subjectVersion
      );
      const bundleReviews = reviews.get(input.analysisBundleId) ?? [];
      for (const reviewType of ["DEAL", "LEGAL", "COMPLIANCE"] as const) {
        const current = [...bundleReviews]
          .reverse()
          .find((review) => review.reviewType === reviewType);
        if (
          !current ||
          current.decision !== "APPROVED" ||
          current.subjectVersion !== bundle?.subjectVersion ||
          current.evidenceManifestHash !== bundle.evidenceManifestHash
        ) {
          throw new DemoHttpError(
            403,
            "POLICY_DENIED",
            `${reviewType}_REVIEW_REQUIRED`
          );
        }
      }
    },
    async getModelRouteEvidence() {
      throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "LOCAL_ROUTE_EVIDENCE_NOT_REQUIRED");
    }
  };
}

function admissionKey(tenantId: string, caseId: string, evidenceId: string): string {
  return `${tenantId}:${caseId}:${evidenceId}`;
}

function createEvidenceManifestHash(
  tenantId: string,
  caseId: string,
  evidence: AnalysisBundleStatus["evidence"]
): string {
  return createHash("sha256")
    .update(JSON.stringify({ tenantId, caseId, evidence }))
    .digest("hex");
}

function assertBundleMatchesInput(
  bundle: AnalysisBundleStatus,
  input: Parameters<DemoAuthorityClient["createAnalysisBundle"]>[0]
): void {
  const evidenceIds = [...bundle.evidence]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((item) => item.evidenceId);
  const expectedEvidenceIds = [...input.evidenceIds].sort((left, right) =>
    left.localeCompare(right)
  );
  if (
    bundle.tenantId !== input.tenantId ||
    bundle.caseId !== input.caseId ||
    bundle.requestFingerprint !== input.requestFingerprint ||
    bundle.modelRoute !== input.modelRoute ||
    bundle.modelDeploymentId !== input.modelDeploymentId ||
    bundle.routeEvidenceId !== input.routeEvidenceId ||
    bundle.promptTemplateVersion !== input.promptTemplateVersion ||
    JSON.stringify(evidenceIds) !== JSON.stringify(expectedEvidenceIds)
  ) {
    throw new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_BUNDLE_IDENTITY_MISMATCH");
  }
}

function assertReadyBundle(
  bundle: AnalysisBundleStatus | undefined,
  tenantId: string,
  caseId: string,
  subjectVersion: string,
  evidenceManifestHash?: string
): asserts bundle is AnalysisBundleStatus & {
  readonly status: "DRAFT_ONLY_READY";
  readonly subjectVersion: string;
} {
  if (
    !bundle ||
    bundle.tenantId !== tenantId ||
    bundle.caseId !== caseId ||
    bundle.status !== "DRAFT_ONLY_READY" ||
    bundle.subjectVersion !== subjectVersion ||
    (evidenceManifestHash && bundle.evidenceManifestHash !== evidenceManifestHash)
  ) {
    throw new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_BUNDLE_SUBJECT_VERSION_STALE");
  }
}
