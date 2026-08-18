import type {
  AnalysisRunRequest,
  AnalysisRunResponse,
  CommitteeSubmissionRequest,
  EvidenceAdmissionRequest,
  FindingDispositionRequest,
  GovernanceView,
  RecommendationPreparationRequest,
  ReviewSubmissionRequest,
  SecurityGateRunRequest,
  ScenarioState
} from "@stratton/contracts";
import { Navigate, Route, Routes } from "react-router-dom";
import { DecisionRoomPage } from "../decision-room/DecisionRoomPage.js";
import { GovernanceConsolePage } from "../governance/GovernanceConsolePage.js";
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
    path: "/governance",
    label: "Governance & Assurance Console",
    summary: "Lineage, policy, route evidence, security gates, and audit-export readiness for the approved demo journey."
  },
  {
    path: "/decision-room",
    label: "Investment Decision Room",
    summary: "Material finding challenge, review readiness, and committee-pack preparation controls."
  }
] as const satisfies readonly WorkspaceDefinition[];

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
  readonly onSubmitCommitteePack?: ((input: CommitteeSubmissionRequest) => Promise<void> | void) | undefined;
  readonly onRunSecurityGateSuite?: ((input: SecurityGateRunRequest) => Promise<void> | void) | undefined;
  readonly onStartNewCycle?: (() => Promise<void> | void) | undefined;
  readonly loadGovernanceView?: ((signal?: AbortSignal) => Promise<GovernanceView>) | undefined;
}

export function AppRoutes({
  scenario,
  onAdmitEvidence,
  onRunAnalysis,
  onRecordDisposition,
  onSubmitReview,
  onPrepareRecommendation,
  onSubmitCommitteePack,
  onRunSecurityGateSuite,
  onStartNewCycle,
  loadGovernanceView
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
            onStartNewCycle={onStartNewCycle}
          />
        }
      />
      <Route
        path="/governance"
        element={
          <GovernanceRoute
            scenario={scenario}
            loadGovernanceView={loadGovernanceView}
            onRunSecurityGateSuite={onRunSecurityGateSuite}
          />
        }
      />
      <Route
        path="/decision-room"
        element={
          <DecisionRoomRoute
            scenario={scenario}
            onPrepareRecommendation={onPrepareRecommendation}
            onSubmitCommitteePack={onSubmitCommitteePack}
            onSubmitReview={onSubmitReview}
          />
        }
      />
      <Route path="*" element={<Navigate to="/workbench" replace />} />
    </Routes>
  );
}

function WorkbenchRoute({
  scenario,
  onAdmitEvidence,
  onRunAnalysis,
  onRecordDisposition,
  onStartNewCycle
}: AppRoutesProps) {
  return (
    <DealWorkbenchPage
      onAdmitEvidence={onAdmitEvidence}
      onRecordDisposition={onRecordDisposition}
      onRunAnalysis={onRunAnalysis}
      onStartNewCycle={onStartNewCycle}
      scenario={scenario}
    />
  );
}

function DecisionRoomRoute({
  scenario,
  onPrepareRecommendation,
  onSubmitCommitteePack,
  onSubmitReview
}: AppRoutesProps) {
  return (
    <DecisionRoomPage
      scenario={scenario}
      onPrepareRecommendation={onPrepareRecommendation}
      onSubmitCommitteePack={onSubmitCommitteePack}
      onSubmitReview={onSubmitReview}
    />
  );
}

function GovernanceRoute({
  scenario,
  loadGovernanceView,
  onRunSecurityGateSuite
}: AppRoutesProps) {
  return (
    <GovernanceConsolePage
      loadGovernanceView={loadGovernanceView}
      scenario={scenario}
      onRunSecurityGateSuite={onRunSecurityGateSuite}
    />
  );
}
