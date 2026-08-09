import { createHash } from "node:crypto";
import type {
  Phase5Client,
  WorkflowSupportingOperations
} from "./phase5-client.js";
import type {
  AdmitEvidenceAuthorityInput,
  AnalysisBundleStatus,
  CompleteAnalysisBundleInput,
  CreateAnalysisBundleInput,
  DemoAuthorityClient
} from "./demo-authority-client.js";
import type { AnalysisTaskClass } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";

interface LegacyGovernedWorkflowClientOptions {
  readonly authority: Phase5Client;
  readonly supporting: WorkflowSupportingOperations;
}

/**
 * Compatibility-test adapter for the pre-OBO Phase5Client surface.
 * Governed LOCAL and AZURE construction must use the authoritative clients below.
 */
export function createLegacyGovernedWorkflowClientForCompatibilityTests(
  options: LegacyGovernedWorkflowClientOptions
): Phase5Client {
  return {
    async admitEvidence(input) {
      await options.authority.admitEvidence(input);
      await options.supporting.afterEvidenceAdmitted(input);
    },
    async requestAnalysis(input) {
      const accepted = await options.authority.requestAnalysis(input);
      await options.supporting.afterAnalysisAccepted({
        ...input,
        analysisRunId: accepted.analysisRunId
      });
      return accepted;
    },
    async submitReview(input) {
      await options.authority.submitReview(input);
      await options.supporting.afterReviewAccepted(input);
    },
    async prepareDraft(input) {
      await options.authority.prepareDraft(input);
      await options.supporting.afterDraftAccepted(input);
    }
  };
}

export interface AuthoritativeEvidenceAdmissionWorkflowClient {
  admit(input: AdmitEvidenceAuthorityInput): Promise<void>;
}

interface AuthoritativeEvidenceAdmissionWorkflowClientOptions {
  readonly authority: DemoAuthorityClient;
  readonly supporting: Pick<WorkflowSupportingOperations, "afterEvidenceAdmitted">;
}

export function createAuthoritativeEvidenceAdmissionWorkflowClient(
  options: AuthoritativeEvidenceAdmissionWorkflowClientOptions
): AuthoritativeEvidenceAdmissionWorkflowClient {
  if (!options.authority) {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "EVIDENCE_AUTHORITY_REQUIRED");
  }

  return {
    async admit(input) {
      await options.authority.admitEvidence(input);
      await options.supporting.afterEvidenceAdmitted({
        caseId: input.caseId,
        evidenceId: input.evidenceId,
        idempotencyKey: input.idempotencyKey,
        ...(input.correlationId ? { correlationId: input.correlationId } : {})
      });
    }
  };
}

export interface BundleSupportingAnalysis {
  requestAnalysis(
    input: CreateAnalysisBundleInput & {
      readonly analystQuestion: string;
      readonly taskClass: AnalysisTaskClass;
    }
  ): Promise<void>;
}

export interface AuthoritativeBundleWorkflowClient {
  run(
    input: CreateAnalysisBundleInput & {
      readonly analystQuestion: string;
      readonly taskClass: AnalysisTaskClass;
      readonly complete: (
        accepted: AnalysisBundleStatus
      ) => CompleteAnalysisBundleInput;
    }
  ): Promise<AnalysisBundleStatus>;
}

interface AuthoritativeBundleWorkflowClientOptions {
  readonly authority: DemoAuthorityClient;
  readonly supporting: BundleSupportingAnalysis;
}

export function createAuthoritativeBundleWorkflowClient(
  options: AuthoritativeBundleWorkflowClientOptions
): AuthoritativeBundleWorkflowClient {
  if (!options.authority) {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "ANALYSIS_AUTHORITY_REQUIRED");
  }

  return {
    async run(input) {
      const { analystQuestion: _analystQuestion, taskClass: _taskClass, complete, ...bundleInput } = input;
      const accepted = await options.authority.createAnalysisBundle(bundleInput);
      assertBundleIdentity(accepted, bundleInput);
      if (accepted.status === "DRAFT_ONLY_READY" && accepted.subjectVersion) {
        const authoritative = await options.authority.getAnalysisBundle(input.analysisBundleId);
        assertBundleIdentity(authoritative, bundleInput);
        assertDraftOnlyReady(authoritative);
        return authoritative;
      }
      if (accepted.status !== "QUEUED" && accepted.status !== "IN_PROGRESS") {
        throw new DemoHttpError(
          409,
          "STATE_CONFLICT",
          "ANALYSIS_BUNDLE_LIFECYCLE_MISMATCH"
        );
      }

      await options.supporting.requestAnalysis(input);
      const completed = await options.authority.completeAnalysisBundle(complete(accepted));
      assertBundleIdentity(completed, bundleInput);
      assertDraftOnlyReady(completed);
      const authoritative = await options.authority.getAnalysisBundle(input.analysisBundleId);
      assertBundleIdentity(authoritative, bundleInput);
      assertDraftOnlyReady(authoritative);
      return authoritative;
    }
  };
}

function assertBundleIdentity(
  bundle: AnalysisBundleStatus,
  expected: CreateAnalysisBundleInput
): void {
  const expectedEvidenceIds = [...expected.evidenceIds].sort((left, right) =>
    left.localeCompare(right)
  );
  const actualEvidenceIds = [...bundle.evidence]
    .sort((left, right) => left.ordinal - right.ordinal)
    .map((item) => item.evidenceId);
  const manifestHash = createHash("sha256")
    .update(
      JSON.stringify({
        tenantId: bundle.tenantId,
        caseId: bundle.caseId,
        evidence: [...bundle.evidence]
          .sort((left, right) => left.ordinal - right.ordinal)
          .map(({ evidenceId, evidenceVersionId, ordinal }) => ({
            evidenceId,
            evidenceVersionId,
            ordinal
          }))
      })
    )
    .digest("hex");

  if (
    bundle.tenantId !== expected.tenantId ||
    bundle.caseId !== expected.caseId ||
    bundle.analysisBundleId !== expected.analysisBundleId ||
    bundle.requestFingerprint !== expected.requestFingerprint ||
    bundle.modelRoute !== expected.modelRoute ||
    bundle.modelDeploymentId !== expected.modelDeploymentId ||
    bundle.routeEvidenceId !== expected.routeEvidenceId ||
    bundle.promptTemplateVersion !== expected.promptTemplateVersion ||
    bundle.outputKind !== "DRAFT_ONLY" ||
    bundle.evidenceManifestHash !== manifestHash ||
    JSON.stringify(actualEvidenceIds) !== JSON.stringify(expectedEvidenceIds)
  ) {
    throw new DemoHttpError(
      409,
      "STATE_CONFLICT",
      "ANALYSIS_BUNDLE_IDENTITY_MISMATCH"
    );
  }
}

function assertDraftOnlyReady(bundle: AnalysisBundleStatus): asserts bundle is AnalysisBundleStatus & {
  readonly status: "DRAFT_ONLY_READY";
  readonly subjectVersion: string;
} {
  if (bundle.status !== "DRAFT_ONLY_READY" || !bundle.subjectVersion) {
    throw new DemoHttpError(
      409,
      "STATE_CONFLICT",
      "ANALYSIS_BUNDLE_NOT_READY_FOR_LOCAL_PROJECTION"
    );
  }
}
