import {
  Button,
  Caption1,
  Field,
  Textarea,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type { AnalysisFinding, FindingDispositionAction } from "@stratton/contracts";
import { useEffect, useState } from "react";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  card: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS
  },
  citations: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    listStyleType: "none",
    margin: 0,
    padding: 0
  },
  original: {
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    ...shorthands.borderRadius(tokens.borderRadiusMedium)
  }
});

interface FindingCardProps {
  readonly finding: AnalysisFinding;
  readonly onOpenCitation: (input: { findingId: string; citationId: string }) => void;
  readonly onRecordDisposition?: (input: {
    findingId: string;
    action: FindingDispositionAction;
    editedSummary?: string;
  }) => Promise<void> | void;
}

export function FindingCard({
  finding,
  onOpenCitation,
  onRecordDisposition
}: FindingCardProps) {
  const styles = useStyles();
  const [isEditing, setIsEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState(finding.summary);

  useEffect(() => {
    setEditedSummary(finding.summary);
    setIsEditing(false);
  }, [finding.summary]);

  return (
    <article aria-label={finding.title} className={styles.card}>
      <div>
        <h3>{finding.title}</h3>
        <div className={styles.badgeRow}>
          <StatusBadge label={finding.materiality} status={finding.materiality} />
          <StatusBadge label={finding.status} status={finding.status} />
          {finding.route ? <StatusBadge label={finding.route} status={finding.route} /> : null}
        </div>
      </div>

      <p>{finding.summary}</p>

      {finding.originalAiSummary && finding.originalAiSummary !== finding.summary ? (
        <div className={styles.original}>
          <strong>Original AI text</strong>
          <p>{finding.originalAiSummary}</p>
        </div>
      ) : null}

      <ul className={styles.citations}>
        {finding.citations.map((citation) => (
          <li key={citation.citationId}>
            <Button
              appearance="subtle"
              onClick={() =>
                onOpenCitation({ findingId: finding.findingId, citationId: citation.citationId })
              }
            >
              Open citation {citation.citationId}
            </Button>
            <Caption1>{citation.locator}</Caption1>
          </li>
        ))}
      </ul>

      {isEditing ? (
        <div>
          <Field label="Edited finding summary">
            <Textarea
              onChange={(_event, data) => setEditedSummary(data.value)}
              resize="vertical"
              value={editedSummary}
            />
          </Field>
          <div className={styles.actions}>
            <Button
              appearance="primary"
              onClick={() =>
                void onRecordDisposition?.({
                  findingId: finding.findingId,
                  action: "EDIT",
                  editedSummary
                })
              }
            >
              Save edited finding
            </Button>
            <Button appearance="secondary" onClick={() => setIsEditing(false)}>
              Cancel edit
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <Button
            appearance="primary"
            disabled={!onRecordDisposition}
            onClick={() =>
              void onRecordDisposition?.({ findingId: finding.findingId, action: "ACCEPT" })
            }
          >
            Accept {finding.title}
          </Button>
          <Button appearance="secondary" disabled={!onRecordDisposition} onClick={() => setIsEditing(true)}>
            Edit {finding.title}
          </Button>
          <Button
            appearance="secondary"
            disabled={!onRecordDisposition}
            onClick={() =>
              void onRecordDisposition?.({ findingId: finding.findingId, action: "CHALLENGE" })
            }
          >
            Challenge {finding.title}
          </Button>
          <Button
            appearance="secondary"
            disabled={!onRecordDisposition}
            onClick={() =>
              void onRecordDisposition?.({ findingId: finding.findingId, action: "REJECT" })
            }
          >
            Reject {finding.title}
          </Button>
        </div>
      )}
    </article>
  );
}
