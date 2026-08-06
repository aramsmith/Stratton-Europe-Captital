import {
  Body1,
  Body1Strong,
  Card,
  Caption1,
  Title3,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type {
  RecommendationPreparationRequest,
  ReviewSubmissionRequest,
  ReviewType,
  ScenarioState
} from "@stratton/contracts";
import { AuditTimeline } from "./AuditTimeline.js";
import { MaterialClaimsTable } from "./MaterialClaimsTable.js";
import { RecommendationDraft } from "./RecommendationDraft.js";
import {
  ReviewChecklist,
  type ReviewChecklistItem
} from "./ReviewChecklist.js";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  routeLayout: {
    display: "grid",
    gap: tokens.spacingVerticalXL,
    alignItems: "start"
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: tokens.spacingHorizontalL
  },
  metricCard: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    ...shorthands.padding(tokens.spacingHorizontalL, tokens.spacingVerticalL)
  },
  workspaceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: tokens.spacingHorizontalL
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  }
});

interface DecisionRoomPageProps {
  readonly scenario: ScenarioState;
  readonly onSubmitReview?: ((input: ReviewSubmissionRequest & {
    findingId: string;
  }) => Promise<void> | void) | undefined;
  readonly onPrepareRecommendation?: ((input: RecommendationPreparationRequest) => Promise<void> | void) | undefined;
}

export function DecisionRoomPage({
  scenario,
  onSubmitReview,
  onPrepareRecommendation
}: DecisionRoomPageProps) {
  const styles = useStyles();
  const materialFindings = scenario.findings.filter(
    (finding) => finding.materiality === "HIGH" || finding.materiality === "CRITICAL"
  );
  const evidenceById = new Map(
    scenario.evidence.map((evidence) => [evidence.evidenceId, evidence] as const)
  );
  const reviewItems = buildReviewChecklistItems(scenario, evidenceById);
  const linkedCitationCount = materialFindings.reduce(
    (total, finding) =>
      total +
      finding.citations.filter(
        (citation) => citation.accessible && evidenceById.has(citation.evidenceId)
      ).length,
    0
  );
  const totalCitationCount = materialFindings.reduce(
    (total, finding) => total + finding.citations.length,
    0
  );
  const citationCoverageLabel =
    totalCitationCount === 0
      ? "0%"
      : `${Math.round((linkedCitationCount / totalCitationCount) * 100)}%`;
  const openConditions = buildOpenConditions(materialFindings, reviewItems);
  const openChallenges = openConditions.length;
  const isReady = openConditions.length === 0;

  return (
    <div className={styles.routeLayout}>
      <section aria-labelledby="decision-room-heading">
        <Title3 as="h2" id="decision-room-heading">
          Investment Decision Room
        </Title3>
        <Body1>
          Govern material claims, record mandatory specialist approvals, and assemble a committee
          pack draft without creating an investment approval action.
        </Body1>
      </section>

      <div className={styles.cardGrid}>
        <Card className={styles.metricCard}>
          <Body1Strong>Committee preparation</Body1Strong>
          <div className={styles.badgeRow}>
            <StatusBadge label={scenario.stage} status={scenario.stage} />
            <StatusBadge label={`${reviewItems.length} required approvals`} status="REVIEW" />
          </div>
          <Caption1>Stage the draft for human committee discussion only.</Caption1>
        </Card>
        <Card className={styles.metricCard}>
          <Body1Strong>Material findings</Body1Strong>
          <Body1>{materialFindings.length}</Body1>
          <Caption1>High and critical claims tracked for the committee pack.</Caption1>
        </Card>
        <Card className={styles.metricCard}>
          <Body1Strong>Open challenges</Body1Strong>
          <Body1>{openChallenges}</Body1>
          <Caption1>Missing approvals and unresolved conditions keep the draft blocked.</Caption1>
        </Card>
        <Card className={styles.metricCard}>
          <Body1Strong>Citation coverage</Body1Strong>
          <Body1>{citationCoverageLabel}</Body1>
          <Caption1>
            {linkedCitationCount} of {totalCitationCount} material citations resolve to admitted
            evidence.
          </Caption1>
        </Card>
      </div>

      <div className={styles.workspaceGrid}>
        <MaterialClaimsTable evidenceById={evidenceById} findings={materialFindings} />
        <ReviewChecklist caseId={scenario.caseId} items={reviewItems} onSubmitReview={onSubmitReview} />
        <RecommendationDraft
          caseId={scenario.caseId}
          currentStage={scenario.stage}
          evidenceById={evidenceById}
          isReady={isReady}
          materialFindings={materialFindings}
          onPrepareRecommendation={onPrepareRecommendation}
          openConditions={openConditions}
        />
        <AuditTimeline events={scenario.governanceEvents} />
      </div>
    </div>
  );
}

function buildReviewChecklistItems(
  scenario: ScenarioState,
  evidenceById: ReadonlyMap<string, ScenarioState["evidence"][number]>
): ReviewChecklistItem[] {
  return (["DEAL", "LEGAL", "COMPLIANCE"] as const satisfies readonly ReviewType[]).map(
    (reviewType) => {
      const existingReview = getLatestReview(scenario, reviewType);
      const reviewedFinding = existingReview
        ? scenario.findings.find((candidate) => candidate.findingId === existingReview.findingId)
        : undefined;
      const finding =
        reviewedFinding ?? pickFindingForReviewType(reviewType, scenario, evidenceById);
      const status =
        existingReview && reviewedFinding && isCurrentReview(reviewedFinding, existingReview)
          ? existingReview.decision
          : existingReview?.decision === "REJECTED"
            ? "REJECTED"
            : "PENDING";

      return {
        reviewType,
        findingId: finding?.findingId ?? null,
        findingTitle: finding?.title ?? "Awaiting accepted material claim",
        status
      };
    }
  );
}

function getLatestReview(
  scenario: ScenarioState,
  reviewType: ReviewType
): ScenarioState["reviews"][number] | undefined {
  for (let index = scenario.reviews.length - 1; index >= 0; index -= 1) {
    const review = scenario.reviews[index];
    if (review?.reviewType === reviewType) {
      return review;
    }
  }

  return undefined;
}

function pickFindingForReviewType(
  reviewType: ReviewType,
  scenario: ScenarioState,
  evidenceById: ReadonlyMap<string, ScenarioState["evidence"][number]>
): ScenarioState["findings"][number] | undefined {
  const preferredDomains: Readonly<Record<ReviewType, readonly string[]>> = {
    DEAL: ["FINANCIAL", "COMMERCIAL", "OPERATIONAL"],
    LEGAL: ["LEGAL"],
    COMPLIANCE: ["ESG", "LEGAL", "OPERATIONAL", "FINANCIAL", "COMMERCIAL"]
  };
  const acceptedFindings = scenario.findings.filter((finding) => finding.status === "ACCEPTED");

  return (
    acceptedFindings.find((finding) =>
      finding.citations.some((citation) =>
        preferredDomains[reviewType].includes(
          evidenceById.get(citation.evidenceId)?.domain ?? "FINANCIAL"
        )
      )
    ) ??
    acceptedFindings[0] ??
    scenario.findings[0]
  );
}

function buildOpenConditions(
  materialFindings: readonly ScenarioState["findings"][number][],
  reviewItems: readonly ReviewChecklistItem[]
): string[] {
  const conditions = reviewItems
    .filter((item) => item.status !== "APPROVED")
    .map((item) => `${formatReviewType(item.reviewType)} review required`);

  return [
    ...conditions,
    ...materialFindings
      .filter((finding) => finding.status !== "ACCEPTED")
      .map((finding) => `${finding.title} must be accepted`)
  ];
}

function formatReviewType(reviewType: ReviewType): string {
  return `${reviewType.slice(0, 1)}${reviewType.slice(1).toLowerCase()}`;
}

function isCurrentReview(
  finding: ScenarioState["findings"][number],
  review: ScenarioState["reviews"][number]
): boolean {
  return (
    review.decision === "APPROVED" &&
    finding.status === "ACCEPTED" &&
    review.subjectVersion === (finding.textHistory.at(-1)?.versionId ?? finding.findingId)
  );
}
