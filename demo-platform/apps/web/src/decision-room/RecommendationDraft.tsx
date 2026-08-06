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
  EvidenceItem,
  RecommendationPreparationRequest
} from "@stratton/contracts";
import { useState } from "react";

const useStyles = makeStyles({
  card: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingHorizontalL, tokens.spacingVerticalL)
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
  actionRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS
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
  readonly onPrepareRecommendation?: ((input: RecommendationPreparationRequest) => Promise<void> | void) | undefined;
}

export function RecommendationDraft({
  caseId,
  currentStage,
  evidenceById,
  materialFindings,
  openConditions,
  isReady,
  onPrepareRecommendation
}: RecommendationDraftProps) {
  const styles = useStyles();
  const [error, setError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);

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

  return (
    <Card className={styles.card}>
      <Title3 as="h3">Conditional recommendation draft</Title3>
      <Body1>
        AI assembled this draft from reviewed findings. It cannot issue an investment decision.
      </Body1>
      <Caption1>
        The draft remains conditional until the specialist checklist is approved and the human
        committee decides outside this workflow.
      </Caption1>

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
        <Body1>No accepted material findings are ready to assemble into a committee-pack draft.</Body1>
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

      <div className={styles.actionRow}>
        <Button
          appearance="primary"
          disabled={!isReady || isPreparing || !onPrepareRecommendation}
          onClick={() => void handlePrepareRecommendation()}
        >
          {isPreparing ? "Preparing..." : "Prepare committee pack"}
        </Button>
        <Button disabled>Submit to committee</Button>
      </div>

      <Caption1>
        Current scenario stage: {currentStage}. Committee submission is a human-only step outside
        this demo platform.
      </Caption1>

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
    : "Unable to prepare the committee-pack draft.";
}
