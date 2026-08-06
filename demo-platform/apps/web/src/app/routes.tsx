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
  AnalysisRunRequest,
  AnalysisRunResponse,
  EvidenceAdmissionRequest,
  FindingDispositionRequest,
  ScenarioState
} from "@stratton/contracts";
import { Navigate, Route, Routes } from "react-router-dom";
import { StatusBadge } from "../shared/StatusBadge.js";
import { DealWorkbenchPage } from "../workbench/DealWorkbenchPage.js";

export interface WorkspaceDefinition {
  readonly path: "/workbench" | "/decision-room" | "/governance";
  readonly label: string;
  readonly summary: string;
}

export const workspaceDefinitions = [
  {
    path: "/workbench",
    label: "AI Deal Workbench",
    summary: "Governed evidence intake, provenance, comparison, and analyst-ready findings."
  },
  {
    path: "/decision-room",
    label: "Investment Decision Room",
    summary: "Material finding challenge, review readiness, and committee-pack preparation controls."
  },
  {
    path: "/governance",
    label: "Governance & Assurance",
    summary: "Lineage, policy, model-route, and audit evidence for the approved demo journey."
  }
] as const satisfies readonly WorkspaceDefinition[];

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
  workspaceCard: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingHorizontalL, tokens.spacingHorizontalL),
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    minHeight: "100%"
  },
  list: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    listStyleType: "none",
    margin: 0,
    padding: 0
  },
  listItem: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    ...shorthands.padding(tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: tokens.colorNeutralBackground2
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  },
  muted: {
    color: tokens.colorNeutralForeground3
  }
});

interface AppRoutesProps {
  readonly scenario: ScenarioState;
  readonly onAdmitEvidence?: ((input: EvidenceAdmissionRequest & {
    evidenceId: string;
  }) => Promise<void> | void) | undefined;
  readonly onRunAnalysis?: ((input: AnalysisRunRequest) => Promise<AnalysisRunResponse> | AnalysisRunResponse) | undefined;
  readonly onRecordDisposition?: ((input: FindingDispositionRequest & {
    findingId: string;
  }) => Promise<void> | void) | undefined;
}

export function AppRoutes({
  scenario,
  onAdmitEvidence,
  onRunAnalysis,
  onRecordDisposition
}: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/workbench" replace />} />
      <Route
        path="/workbench"
        element={
          <WorkbenchRoute
            scenario={scenario}
            onAdmitEvidence={onAdmitEvidence}
            onRecordDisposition={onRecordDisposition}
            onRunAnalysis={onRunAnalysis}
          />
        }
      />
      <Route path="/decision-room" element={<DecisionRoomRoute scenario={scenario} />} />
      <Route path="/governance" element={<GovernanceRoute scenario={scenario} />} />
      <Route path="*" element={<Navigate to="/workbench" replace />} />
    </Routes>
  );
}

function WorkbenchRoute({
  scenario,
  onAdmitEvidence,
  onRunAnalysis,
  onRecordDisposition
}: AppRoutesProps) {
  return (
    <DealWorkbenchPage
      onAdmitEvidence={onAdmitEvidence}
      onRecordDisposition={onRecordDisposition}
      onRunAnalysis={onRunAnalysis}
      scenario={scenario}
    />
  );
}

function DecisionRoomRoute({ scenario }: AppRoutesProps) {
  const styles = useStyles();
  const materialFindings = scenario.findings.filter(
    (finding) => finding.materiality === "HIGH" || finding.materiality === "CRITICAL"
  );

  return (
    <div className={styles.routeLayout}>
      <section aria-labelledby="decision-room-heading">
        <Title3 as="h2" id="decision-room-heading">
          Investment Decision Room
        </Title3>
        <Body1>
          Human reviewers challenge material claims, track mandatory reviews, and prepare the
          committee pack without delegating the investment decision to AI.
        </Body1>
      </section>

      <div className={styles.cardGrid}>
        <Card className={styles.workspaceCard}>
          <Title3 as="h3">Review readiness</Title3>
          <div className={styles.badgeRow}>
            <StatusBadge label={scenario.stage} status={scenario.stage} />
            <StatusBadge label={`${scenario.reviews.length} review requirements`} status="REVIEW" />
          </div>
          <Caption1 className={styles.muted}>
            AI cannot issue an investment decision. Committee preparation remains blocked until human
            reviewers resolve mandatory conditions.
          </Caption1>
          <ul className={styles.list}>
            {materialFindings.length === 0 ? (
              <li className={styles.listItem}>
                <Body1Strong>No material findings are ready for committee challenge</Body1Strong>
                <Caption1>
                  Demo 1 must produce reviewed material claims before committee-pack preparation.
                </Caption1>
              </li>
            ) : (
              materialFindings.map((finding) => (
                <li key={finding.findingId} className={styles.listItem}>
                  <Body1Strong>{finding.title}</Body1Strong>
                  <div className={styles.badgeRow}>
                    <StatusBadge label={finding.materiality} status={finding.materiality} />
                    <StatusBadge label={finding.status} status={finding.status} />
                    <StatusBadge
                      label={`${finding.citations.length} citations`}
                      status={finding.citations.length > 0 ? "APPROVED" : "REJECTED"}
                    />
                  </div>
                  <Caption1>{finding.summary}</Caption1>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className={styles.workspaceCard}>
          <Title3 as="h3">Required specialist reviews</Title3>
          <Caption1 className={styles.muted}>
            Legal and Compliance reviews remain visible and append-only for the case timeline.
          </Caption1>
          <ul className={styles.list}>
            {scenario.reviews.length === 0 ? (
              <li className={styles.listItem}>
                <Body1Strong>No specialist reviews have been created yet</Body1Strong>
                <Caption1>
                  The baseline case remains pre-review until approved evidence and findings exist.
                </Caption1>
              </li>
            ) : (
              scenario.reviews.map((review) => (
                <li key={review.reviewId} className={styles.listItem}>
                  <Body1Strong>{review.reviewType} review</Body1Strong>
                  <div className={styles.badgeRow}>
                    <StatusBadge label={review.decision} status={review.decision} />
                    <Caption1>Finding: {review.findingId}</Caption1>
                  </div>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function GovernanceRoute({ scenario }: AppRoutesProps) {
  const styles = useStyles();

  return (
    <div className={styles.routeLayout}>
      <section aria-labelledby="governance-heading">
        <Title3 as="h2" id="governance-heading">
          Governance & Assurance
        </Title3>
        <Body1>
          Show case lineage, audit events, and governed model-route evidence without implying an
          Internal Audit verdict.
        </Body1>
      </section>

      <div className={styles.cardGrid}>
        <Card className={styles.workspaceCard}>
          <Title3 as="h3">Governance timeline</Title3>
          <ul className={styles.list}>
            {scenario.governanceEvents.map((event) => (
              <li key={event.eventId} className={styles.listItem}>
                <Body1Strong>{event.type}</Body1Strong>
                <div className={styles.badgeRow}>
                  <StatusBadge label={event.outcome} status={event.outcome} />
                  <Caption1>{new Date(event.occurredAtIso).toLocaleString()}</Caption1>
                </div>
                <Caption1>Correlation: {event.correlationId}</Caption1>
                {event.detail ? <Caption1>{event.detail}</Caption1> : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card className={styles.workspaceCard}>
          <Title3 as="h3">Assurance view</Title3>
          <Caption1 className={styles.muted}>
            Route evidence, policy decisions, and recovery posture become visible here as the demo
            advances beyond intake.
          </Caption1>
          <ul className={styles.list}>
            <li className={styles.listItem}>
              <Body1Strong>Evidence lineage</Body1Strong>
              <Caption1>
                {scenario.evidence.length} source records are tracked for Project Danube.
              </Caption1>
            </li>
            <li className={styles.listItem}>
              <Body1Strong>Model routing</Body1Strong>
              <Caption1>Awaiting routed analytical tasks in the approved baseline scenario.</Caption1>
            </li>
            <li className={styles.listItem}>
              <Body1Strong>Internal Audit export preview</Body1Strong>
              <Caption1>
                This workspace prepares evidence for audit review but does not issue or imply an audit
                verdict.
              </Caption1>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
