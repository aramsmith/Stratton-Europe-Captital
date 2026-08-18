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
  EvidenceDomain,
  CommitteeSubmissionRequest,
  RecommendationPreparationRequest,
  ReviewSubmissionRequest,
  ReviewType,
  ScenarioState
} from "@stratton/contracts";
import {
  getEligibleReviewTypesForDomains,
  mandatorySecurityGateBindings
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
    gap: "24px",
    alignItems: "start"
  },
  pageHeader: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    borderBottom: "1px solid #d3d0c7",
    ...shorthands.padding(0, 0, tokens.spacingVerticalL)
  },
  pageTitle: {
    margin: 0,
    color: "#0b223b",
    fontFamily: '"Source Serif 4", Georgia, serif',
    fontSize: "24px",
    fontWeight: 650,
    letterSpacing: "-0.015em"
  },
  pageCopy: {
    maxWidth: "76ch",
    color: tokens.colorNeutralForeground2
  },
  cardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: tokens.spacingHorizontalL
  },
  metricCard: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    border: "1px solid #d3d0c7",
    boxShadow: tokens.shadow2,
    ...shorthands.padding(tokens.spacingHorizontalL, tokens.spacingVerticalL)
  },
  decisionWorkspace: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.65fr) minmax(320px, 0.75fr)",
    gap: "24px",
    alignItems: "start",
    "@media (max-width: 1120px)": {
      gridTemplateColumns: "minmax(0, 1fr)"
    }
  },
  actionColumn: {
    position: "sticky",
    top: "24px",
    "@media (max-width: 1120px)": {
      position: "static"
    }
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
  readonly onSubmitCommitteePack?: ((input: CommitteeSubmissionRequest) => Promise<void> | void) | undefined;
}

export function DecisionRoomPage({
  scenario,
  onSubmitReview,
  onPrepareRecommendation,
  onSubmitCommitteePack
}: DecisionRoomPageProps) {
  const styles = useStyles();
  const materialFindings = scenario.findings.filter(
    (finding) => finding.materiality === "HIGH" || finding.materiality === "CRITICAL"
  );
  const acceptedMaterialFindings = materialFindings.filter((finding) => finding.status === "ACCEPTED");
  const evidenceById = new Map(
    scenario.evidence.map((evidence) => [evidence.evidenceId, evidence] as const)
  );
  const reviewItems = buildReviewChecklistItems(scenario, evidenceById);
  const linkedCitationCount = acceptedMaterialFindings.reduce(
    (total, finding) =>
      total +
      finding.citations.filter(
        (citation) => citation.accessible && evidenceById.has(citation.evidenceId)
      ).length,
    0
  );
  const totalCitationCount = acceptedMaterialFindings.reduce(
    (total, finding) => total + finding.citations.length,
    0
  );
  const citationCoverageLabel =
    totalCitationCount === 0
      ? "0%"
      : `${Math.round((linkedCitationCount / totalCitationCount) * 100)}%`;
  const openConditions = buildOpenConditions(
    scenario,
    materialFindings,
    reviewItems
  );
  const openChallenges = openConditions.length;
  const isReady = openConditions.length === 0;
  const isCommitteePackSubmitted = scenario.governanceEvents.some(
    (event) => event.type === "COMMITTEE_PACK_SUBMITTED" && event.outcome === "SUCCESS"
  );

  return (
    <div className={styles.routeLayout}>
      <section aria-labelledby="decision-room-heading" className={styles.pageHeader}>
        <Title3 as="h2" className={styles.pageTitle} id="decision-room-heading">
          Investment Decision Room
        </Title3>
        <Body1 className={styles.pageCopy}>
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
          <Body1Strong>Accepted material findings</Body1Strong>
          <Body1>{acceptedMaterialFindings.length}</Body1>
          <Caption1>Accepted high and critical claims ready for the committee pack draft.</Caption1>
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

      <MaterialClaimsTable evidenceById={evidenceById} findings={acceptedMaterialFindings} />

      <div aria-label="Decision workflow columns" className={styles.decisionWorkspace}>
        <ReviewChecklist caseId={scenario.caseId} items={reviewItems} onSubmitReview={onSubmitReview} />
        <div className={styles.actionColumn}>
          <RecommendationDraft
            caseId={scenario.caseId}
            currentStage={scenario.stage}
            evidenceById={evidenceById}
            isReady={isReady}
            isSubmitted={isCommitteePackSubmitted}
            materialFindings={acceptedMaterialFindings}
            onPrepareRecommendation={onPrepareRecommendation}
            onSubmitCommitteePack={onSubmitCommitteePack}
            openConditions={openConditions}
          />
        </div>
      </div>

      <AuditTimeline events={scenario.governanceEvents} />
    </div>
  );
}

function buildReviewChecklistItems(
  scenario: ScenarioState,
  evidenceById: ReadonlyMap<string, ScenarioState["evidence"][number]>
): ReviewChecklistItem[] {
  return scenario.findings
    .filter(
      (finding) =>
        finding.materiality === "HIGH" || finding.materiality === "CRITICAL"
    )
    .flatMap((finding) => {
      const domains = [
        ...new Set(
          finding.citations
            .map((citation) => evidenceById.get(citation.evidenceId)?.domain)
            .filter((domain): domain is EvidenceDomain => !!domain)
        )
      ];
      return getEligibleReviewTypesForDomains(domains).map((reviewType) => {
        const existingReview = getLatestReview(
          scenario,
          reviewType,
          finding.findingId
        );
        const hasCurrentApprovedReview =
          !!existingReview && isCurrentReview(scenario, finding, existingReview);
        const hasCurrentRejectedReview =
          existingReview?.decision === "REJECTED" &&
          finding.status === "ACCEPTED" &&
          isCurrentReviewProjection(scenario, finding, existingReview);
        const status =
          finding.status !== "ACCEPTED"
            ? "BLOCKED"
            : hasCurrentApprovedReview
              ? "APPROVED"
              : hasCurrentRejectedReview
                ? "REJECTED"
                : "PENDING";

        return {
          reviewType,
          findingId: finding.findingId,
          subjectVersion: getReviewSubjectVersion(scenario, finding),
          findingTitle: finding.title,
          status
        };
      });
    });
}

function getLatestReview(
  scenario: ScenarioState,
  reviewType: ReviewType,
  findingId: string
): ScenarioState["reviews"][number] | undefined {
  for (let index = scenario.reviews.length - 1; index >= 0; index -= 1) {
    const review = scenario.reviews[index];
    if (
      review?.reviewType === reviewType &&
      review.findingId === findingId
    ) {
      return review;
    }
  }

  return undefined;
}

function buildOpenConditions(
  scenario: ScenarioState,
  materialFindings: readonly ScenarioState["findings"][number][],
  reviewItems: readonly ReviewChecklistItem[]
): string[] {
  const conditions = reviewItems
    .filter((item) => item.status !== "APPROVED")
    .map((item) =>
      item.status === "BLOCKED"
        ? `${formatReviewType(item.reviewType)} review requires an accepted eligible finding`
        : `${formatReviewType(item.reviewType)} review required`
    );

  return [
    ...conditions,
    ...(hasCurrentSecurityGatePassEvidence(scenario)
      ? []
      : ["Mandatory security gates require current PASS evidence"]),
    ...materialFindings
      .filter((finding) => finding.status !== "ACCEPTED")
      .map((finding) => `${finding.title} must be accepted`)
  ];
}

function hasCurrentSecurityGatePassEvidence(scenario: ScenarioState): boolean {
  const fingerprint = scenario.latestAnalysisRun?.analysisRequestFingerprint;
  if (!fingerprint) {
    return false;
  }
  const latestByGate = new Map<
    string,
    ScenarioState["governanceEvents"][number]
  >();
  for (const event of scenario.governanceEvents) {
    if (
      event.type === "SECURITY_GATE_EVIDENCE_RECORDED" &&
      event.metadata?.securityGateId
    ) {
      latestByGate.set(event.metadata.securityGateId, event);
    }
  }
  return mandatorySecurityGateBindings.every((binding) => {
    const event = latestByGate.get(binding.gateId);
    return (
      event?.outcome === "SUCCESS" &&
      event.metadata?.securityGateEvidenceId === binding.evidenceId &&
      event.metadata.analysisRequestFingerprint === fingerprint
    );
  });
}

function formatReviewType(reviewType: ReviewType): string {
  return `${reviewType.slice(0, 1)}${reviewType.slice(1).toLowerCase()}`;
}

function isCurrentReview(
  scenario: ScenarioState,
  finding: ScenarioState["findings"][number],
  review: ScenarioState["reviews"][number]
): boolean {
  return (
    review.decision === "APPROVED" &&
    finding.status === "ACCEPTED" &&
    isCurrentReviewProjection(scenario, finding, review)
  );
}

function isCurrentReviewProjection(
  scenario: ScenarioState,
  finding: ScenarioState["findings"][number],
  review: ScenarioState["reviews"][number]
): boolean {
  if (review.subjectVersion !== getReviewSubjectVersion(scenario, finding)) {
    return false;
  }

  if (!scenario.analysisAuthority) {
    return true;
  }

  return (
    !!finding.projectionVersion &&
    !!review.projectionVersion &&
    review.projectionVersion === finding.projectionVersion
  );
}

function getReviewSubjectVersion(
  scenario: ScenarioState,
  finding: ScenarioState["findings"][number]
): string {
  return scenario.analysisAuthority?.subjectVersion ?? getLatestFindingVersion(finding);
}

function getLatestFindingVersion(finding: ScenarioState["findings"][number]): string {
  return finding.textHistory.at(-1)?.versionId ?? finding.findingId;
}
