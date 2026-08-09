import type {
  Phase5Client,
  WorkflowSupportingOperations
} from "./phase5-client.js";
import type {
  AnalysisBundleStatus,
  CompleteAnalysisBundleInput,
  CreateAnalysisBundleInput,
  DemoAuthorityClient
} from "./demo-authority-client.js";
import type { AnalysisTaskClass } from "@stratton/contracts";
import { DemoHttpError } from "../errors.js";

interface GovernedWorkflowClientOptions {
  readonly authority: Phase5Client;
  readonly supporting: WorkflowSupportingOperations;
}

export function createGovernedWorkflowClient(
  options: GovernedWorkflowClientOptions
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
  return {
    async run(input) {
      const { analystQuestion: _analystQuestion, taskClass: _taskClass, complete, ...bundleInput } = input;
      const accepted = await options.authority.createAnalysisBundle(bundleInput);
      if (accepted.status === "DRAFT_ONLY_READY" && accepted.subjectVersion) {
        return accepted;
      }

      await options.supporting.requestAnalysis(input);
      await options.authority.completeAnalysisBundle(complete(accepted));
      const authoritative = await options.authority.getAnalysisBundle(input.analysisBundleId);
      assertDraftOnlyReady(authoritative);
      return authoritative;
    }
  };
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
