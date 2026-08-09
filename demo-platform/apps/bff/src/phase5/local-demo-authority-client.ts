import { DemoHttpError } from "../errors.js";
import { getTrustedRequestContext } from "../identity/request-context.js";
import type {
  AnalysisBundleStatus,
  DemoAuthorityClient
} from "./demo-authority-client.js";

export function createLocalDemoAuthorityClient(): DemoAuthorityClient {
  const bundles = new Map<string, AnalysisBundleStatus>();

  const requireHuman = () => {
    const context = getTrustedRequestContext();
    if (context.identity.principalType !== "HUMAN" || !context.delegatedUserToken) {
      throw new DemoHttpError(401, "UNAUTHENTICATED", "DELEGATED_TOKEN_REQUIRED");
    }
    return context;
  };
  const requireApplication = () => {
    if (!getLocalApplicationToken().trim()) {
      throw new DemoHttpError(401, "UNAUTHENTICATED", "APPLICATION_TOKEN_REQUIRED");
    }

    function getLocalApplicationToken(): string {
      return "local-application-identity";
    }
  };

  return {
    async createAnalysisBundle(input) {
      const context = requireHuman();
      if (context.identity.tenantId !== input.tenantId) {
        throw new DemoHttpError(403, "POLICY_DENIED", "DELEGATED_TOKEN_TENANT_MISMATCH");
      }
      const existing = bundles.get(input.analysisBundleId);
      if (existing) {
        return existing;
      }
      const bundle: AnalysisBundleStatus = {
        tenantId: input.tenantId,
        caseId: input.caseId,
        analysisBundleId: input.analysisBundleId,
        evidenceManifestHash: input.evidenceManifestHash,
        modelRoute: input.modelRoute,
        modelDeploymentId: input.modelDeploymentId,
        routeEvidenceId: input.routeEvidenceId,
        promptTemplateVersion: input.promptTemplateVersion,
        requestFingerprint: input.requestFingerprint,
        status: "QUEUED",
        outputKind: "DRAFT_ONLY",
        unsupportedClaims: 0,
        evidence: input.evidenceIds.map((evidenceId, index) => ({
          evidenceId,
          evidenceVersionId: `${evidenceId}-v1`,
          ordinal: index + 1
        })),
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
      requireApplication();
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
        subjectVersion: input.subjectVersion
      };
      bundles.set(completed.analysisBundleId, completed);
      return completed;
    },
    async getAnalysisBundle(bundleId) {
      requireHuman();
      const bundle = bundles.get(bundleId);
      if (!bundle) {
        throw new DemoHttpError(404, "INVALID_CONTRACT", "ANALYSIS_BUNDLE_NOT_FOUND");
      }
      return bundle;
    },
    async submitBundleReview(input) {
      requireHuman();
      assertReadyBundle(bundles.get(input.analysisBundleId), input.subjectVersion, input.evidenceManifestHash);
    },
    async prepareBundleDraft(input) {
      requireHuman();
      assertReadyBundle(bundles.get(input.analysisBundleId), input.subjectVersion);
    },
    async getModelRouteEvidence() {
      throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "LOCAL_ROUTE_EVIDENCE_NOT_REQUIRED");
    }
  };
}

function assertReadyBundle(
  bundle: AnalysisBundleStatus | undefined,
  subjectVersion: string,
  evidenceManifestHash?: string
): void {
  if (
    !bundle ||
    bundle.status !== "DRAFT_ONLY_READY" ||
    bundle.subjectVersion !== subjectVersion ||
    (evidenceManifestHash && bundle.evidenceManifestHash !== evidenceManifestHash)
  ) {
    throw new DemoHttpError(409, "STATE_CONFLICT", "ANALYSIS_BUNDLE_SUBJECT_VERSION_STALE");
  }
}
