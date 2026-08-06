import type {
  Phase5Client,
  WorkflowSupportingOperations
} from "./phase5-client.js";

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
