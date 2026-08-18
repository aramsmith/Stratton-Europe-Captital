import {
  Body1Strong,
  Button,
  Caption1,
  Card,
  Field,
  Textarea,
  Title3,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type {
  RecommendationPreparationRequest,
  ReviewSubmissionRequest,
  ReviewType
} from "@stratton/contracts";
import { useState } from "react";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  card: {
    display: "grid",
    overflow: "hidden"
  },
  header: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  columnHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(190px, 0.85fr) minmax(260px, 1.4fr) minmax(168px, 0.65fr)",
    gap: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground3,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalL),
    "@media (max-width: 900px)": {
      display: "none"
    }
  },
  reviewList: {
    display: "grid",
    gap: 0
  },
  emptyState: {
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  reviewRow: {
    display: "grid",
    gridTemplateColumns: "minmax(190px, 0.85fr) minmax(260px, 1.4fr) minmax(168px, 0.65fr)",
    gap: tokens.spacingHorizontalL,
    alignItems: "center",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL),
    ":last-child": {
      borderBottomStyle: "none"
    },
    "@media (max-width: 900px)": {
      gridTemplateColumns: "minmax(0, 1fr)",
      gap: tokens.spacingVerticalM
    }
  },
  reviewIdentity: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    alignSelf: "start"
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  },
  rationaleField: {
    minWidth: 0,
    "& textarea": {
      minHeight: "88px"
    }
  },
  actionCell: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    alignSelf: "stretch",
    alignContent: "center",
    "& button": {
      width: "100%",
      minHeight: "40px"
    }
  },
  alert: {
    color: tokens.colorPaletteRedForeground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL)
  }
});

export interface ReviewChecklistItem {
  readonly reviewType: ReviewType;
  readonly findingId: string | null;
  readonly subjectVersion: string | null;
  readonly findingTitle: string;
  readonly status: "PENDING" | "APPROVED" | "REJECTED" | "BLOCKED";
}

interface ReviewChecklistProps {
  readonly caseId: RecommendationPreparationRequest["caseId"];
  readonly items: readonly ReviewChecklistItem[];
  readonly onSubmitReview?: ((input: ReviewSubmissionRequest & {
    findingId: string;
  }) => Promise<void> | void) | undefined;
}

export function ReviewChecklist({
  caseId,
  items,
  onSubmitReview
}: ReviewChecklistProps) {
  const styles = useStyles();
  const [pendingReviewKey, setPendingReviewKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rationales, setRationales] = useState<Record<ReviewType, string>>({
    DEAL: "Deal review confirms the accepted claim set is ready for committee discussion.",
    LEGAL: "Legal review confirms the accepted claim set is ready for committee discussion.",
    COMPLIANCE:
      "Compliance review confirms the accepted claim set is ready for committee discussion."
  });

  const handleApprove = async (item: ReviewChecklistItem) => {
    if (!onSubmitReview || !item.findingId || !item.subjectVersion) {
      return;
    }

    setError(null);
    const reviewKey = `${item.reviewType}:${item.findingId}`;
    setPendingReviewKey(reviewKey);

    try {
      await onSubmitReview({
        caseId,
        findingId: item.findingId,
        reviewType: item.reviewType,
        decision: "APPROVED",
        rationale: rationales[item.reviewType].trim(),
        subjectVersion: item.subjectVersion
      });
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
    } finally {
      setPendingReviewKey(null);
    }
  };

  return (
    <Card aria-label="Specialist review matrix" className={styles.card}>
      <div className={styles.header}>
        <Title3 as="h3">Required specialist reviews</Title3>
        <Caption1>
          Deal, Legal, and Compliance approvals must all be recorded before the draft may be
          prepared.
        </Caption1>
      </div>

      {items.length === 0 ? (
        <Caption1 className={styles.emptyState}>
          Specialist reviews will appear after an eligible material finding is accepted.
        </Caption1>
      ) : (
        <>
          <div aria-hidden="true" className={styles.columnHeader}>
            <span>Review and status</span>
            <span>Rationale</span>
            <span>Action</span>
          </div>

          <div className={styles.reviewList}>
            {items.map((item) => {
          const label = formatReviewType(item.reviewType);
          const isApproved = item.status === "APPROVED";
          const isBlocked = item.status === "BLOCKED";
          const reviewKey = `${item.reviewType}:${item.findingId}`;
          const isPending = pendingReviewKey === reviewKey;

          return (
            <div className={styles.reviewRow} key={reviewKey}>
              <div className={styles.reviewIdentity}>
                <Body1Strong>{label} review</Body1Strong>
                <div className={styles.badgeRow}>
                  <StatusBadge label={item.status} status={item.status} />
                </div>
                <Caption1>{item.findingTitle}</Caption1>
                <Caption1>
                  {isApproved
                    ? `${label} review approved`
                    : isBlocked
                      ? `${label} review blocked until an accepted eligible finding is available`
                      : `${label} review required`}
                </Caption1>
              </div>
              <Field className={styles.rationaleField} label={`${label} review rationale`}>
                <Textarea
                  disabled={isApproved || isBlocked || isPending}
                  onChange={(_, data) =>
                    setRationales((current) => ({
                      ...current,
                      [item.reviewType]: data.value
                    }))
                  }
                  resize="vertical"
                  value={rationales[item.reviewType]}
                />
              </Field>
              <div className={styles.actionCell}>
                {isApproved ? (
                  <Button disabled>{label} approved</Button>
                ) : isBlocked ? (
                  <Button disabled>Awaiting accepted finding</Button>
                ) : (
                  <Button
                    appearance="primary"
                    disabled={
                      isPending ||
                      !item.findingId ||
                      !item.subjectVersion ||
                      !onSubmitReview
                    }
                    onClick={() => void handleApprove(item)}
                  >
                    {isPending ? "Approving..." : `Approve ${label} review`}
                  </Button>
                )}
              </div>
            </div>
          );
            })}
          </div>
        </>
      )}

      {error ? (
        <Caption1 className={styles.alert} role="alert">
          {error}
        </Caption1>
      ) : null}
    </Card>
  );
}

function formatReviewType(reviewType: ReviewType): string {
  return `${reviewType.slice(0, 1)}${reviewType.slice(1).toLowerCase()}`;
}

function toErrorMessage(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "Unable to record the specialist review.";
}
