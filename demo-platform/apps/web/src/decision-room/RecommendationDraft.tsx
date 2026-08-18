import {
  Body1,
  Body1Strong,
  Button,
  Caption1,
  Card,
  Title3,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type {
  AnalysisFinding,
  CommitteeSubmissionRequest,
  EvidenceItem,
  RecommendationPreparationRequest
} from "@stratton/contracts";
import { useState } from "react";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  card: {
    display: "grid",
    gap: tokens.spacingVerticalL,
    ...shorthands.padding(tokens.spacingHorizontalL, tokens.spacingVerticalL)
  },
  header: {
    display: "grid",
    gap: tokens.spacingVerticalS
  },
  readiness: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  },
  claimList: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    margin: 0,
    paddingLeft: tokens.spacingHorizontalM
  },
  sourceList: {
    display: "grid",
    gap: tokens.spacingVerticalXXS,
    margin: 0,
    paddingLeft: tokens.spacingHorizontalM
  },
  actionRail: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    "& button": {
      width: "100%",
      minHeight: "42px"
    }
  },
  alert: {
    color: tokens.colorPaletteRedForeground1
  }
});

interface RecommendationDraftProps {
  readonly caseId: RecommendationPreparationRequest["caseId"];
  readonly currentStage: "INTAKE" | "ANALYSIS" | "REVIEW" | "COMMITTEE_PREPARATION";
  readonly evidenceById: ReadonlyMap<string, EvidenceItem>;
  readonly materialFindings: readonly AnalysisFinding[];
  readonly openConditions: readonly string[];
  readonly isReady: boolean;
  readonly isSubmitted: boolean;
  readonly onPrepareRecommendation?: ((input: RecommendationPreparationRequest) => Promise<void> | void) | undefined;
  readonly onSubmitCommitteePack?: ((input: CommitteeSubmissionRequest) => Promise<void> | void) | undefined;
}

export function RecommendationDraft({
  caseId,
  currentStage,
  evidenceById,
  materialFindings,
  openConditions,
  isReady,
  isSubmitted,
  onPrepareRecommendation,
  onSubmitCommitteePack
}: RecommendationDraftProps) {
  const styles = useStyles();
  const [error, setError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPrepared = currentStage === "COMMITTEE_PREPARATION";

  const handlePrepareRecommendation = async () => {
    if (!onPrepareRecommendation) {
      return;
    }

    setError(null);
    setIsPreparing(true);

    try {
      await onPrepareRecommendation({ caseId });
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
    } finally {
      setIsPreparing(false);
    }
  };

  const handleSubmitCommitteePack = async () => {
    if (!onSubmitCommitteePack) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await onSubmitCommitteePack({ caseId });
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className={styles.card}>
      <div className={styles.header}>
        <Title3 as="h3">Committee pack controls</Title3>
        <Body1>
          AI assembled this draft from reviewed findings. It cannot issue an investment decision.
        </Body1>
        <div className={styles.readiness}>
          <StatusBadge
            label={isReady ? "READY TO PREPARE" : `${openConditions.length} OPEN CONDITIONS`}
            status={isReady ? "READY" : "BLOCKED"}
          />
          <Caption1>Current stage: {currentStage}</Caption1>
        </div>
      </div>

      <div aria-label="Committee pack actions" className={styles.actionRail}>
        <Button
          appearance="primary"
          disabled={!isReady || isPreparing || isPrepared || !onPrepareRecommendation}
          onClick={() => void handlePrepareRecommendation()}
          size="large"
        >
          {isPreparing
            ? "Preparing..."
            : isPrepared
              ? "Committee pack prepared"
              : "Prepare committee pack"}
        </Button>
        <Button
          disabled={!isPrepared || isSubmitting || isSubmitted || !onSubmitCommitteePack}
          onClick={() => void handleSubmitCommitteePack()}
          size="large"
        >
          {isSubmitting
            ? "Submitting..."
            : isSubmitted
              ? "Committee pack submitted"
              : "Submit to committee"}
        </Button>
        <Caption1>
          Submission records delivery to the committee. It does not record an investment decision.
        </Caption1>
      </div>

      {isSubmitted ? (
        <Body1 role="status">
          Committee pack submitted successfully. The Stratton demo is complete.
        </Body1>
      ) : null}

      {openConditions.length > 0 ? (
        <div>
          <Body1Strong>Open conditions</Body1Strong>
          <ul className={styles.claimList}>
            {openConditions.map((condition) => (
              <li key={condition}>
                <Caption1>{condition}</Caption1>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {materialFindings.length === 0 ? (
        <Body1>
          Committee-pack draft blocked until at least one accepted material finding is available.
        </Body1>
      ) : (
        <ol className={styles.claimList}>
          {materialFindings.map((finding) => (
            <li key={finding.findingId}>
              <Body1Strong>{finding.title}</Body1Strong>
              <Body1>{finding.summary}</Body1>
              <ul className={styles.sourceList}>
                {finding.citations.map((citation) => {
                  const evidence = evidenceById.get(citation.evidenceId);
                  return (
                    <li key={citation.citationId}>
                      <Caption1>{evidence?.title ?? citation.evidenceId}</Caption1>
                      <Caption1>
                        {evidence?.sourceLocator ?? citation.evidenceId} · {citation.locator}
                      </Caption1>
                      {evidence?.sourcePreview ? (
                        <Caption1>{evidence.sourcePreview}</Caption1>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {error ? (
        <Caption1 className={styles.alert} role="alert">
          {error}
        </Caption1>
      ) : null}
    </Card>
  );
}

function toErrorMessage(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "Unable to complete the committee-pack action.";
}
