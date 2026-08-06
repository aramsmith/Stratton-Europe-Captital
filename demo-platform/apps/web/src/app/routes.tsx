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
  RecommendationPreparationRequest,
  ReviewSubmissionRequest,
  ScenarioState
} from "@stratton/contracts";
import { Navigate, Route, Routes } from "react-router-dom";
import { DecisionRoomPage } from "../decision-room/DecisionRoomPage.js";
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
    label: "Governance & Authority Gate",
    summary: "Lineage, policy, authority-gate, and audit evidence for the approved demo journey."
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
  readonly onSubmitReview?: ((input: ReviewSubmissionRequest & {
    findingId: string;
  }) => Promise<void> | void) | undefined;
  readonly onPrepareRecommendation?: ((input: RecommendationPreparationRequest) => Promise<void> | void) | undefined;
}

export function AppRoutes({
  scenario,
  onAdmitEvidence,
  onRunAnalysis,
  onRecordDisposition,
  onSubmitReview,
  onPrepareRecommendation
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
      <Route
        path="/decision-room"
        element={
          <DecisionRoomRoute
            scenario={scenario}
            onPrepareRecommendation={onPrepareRecommendation}
            onSubmitReview={onSubmitReview}
          />
        }
      />
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

function DecisionRoomRoute({
  scenario,
  onPrepareRecommendation,
  onSubmitReview
}: AppRoutesProps) {
  return (
    <DecisionRoomPage
      scenario={scenario}
      onPrepareRecommendation={onPrepareRecommendation}
      onSubmitReview={onSubmitReview}
    />
  );
}

function GovernanceRoute({ scenario }: AppRoutesProps) {
  const styles = useStyles();

  return (
    <div className={styles.routeLayout}>
      <section aria-labelledby="governance-heading">
        <Title3 as="h2" id="governance-heading">
          Governance & Authority Gate
        </Title3>
        <Body1>
          Show case lineage, audit events, and governed model-route evidence without implying an
          Internal Audit verdict. The authority gate records how human analysts constrain every
          routed Phase 5 request.
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
          <Title3 as="h3">Authority gate view</Title3>
          <Caption1 className={styles.muted}>
            Route evidence, policy decisions, authority-gate role, and recovery posture become
            visible here as the demo advances beyond intake.
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
