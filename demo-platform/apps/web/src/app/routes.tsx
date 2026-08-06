import type {
  AnalysisRunRequest,
  AnalysisRunResponse,
  EvidenceAdmissionRequest,
  FindingDispositionRequest,
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
    path: "/decision-room",
    label: "Investment Decision Room",
    summary: "Material finding challenge, review readiness, and committee-pack preparation controls."
  },
  {
    path: "/governance",
    label: "Governance & Assurance Console",
    summary: "Lineage, policy, route evidence, security gates, and audit-export readiness for the approved demo journey."
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
  readonly onRunSecurityGateSuite?: ((input: SecurityGateRunRequest) => Promise<void> | void) | undefined;
}

export function AppRoutes({
  scenario,
  onAdmitEvidence,
  onRunAnalysis,
  onRecordDisposition,
  onSubmitReview,
  onPrepareRecommendation,
  onRunSecurityGateSuite
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
      <Route
        path="/governance"
        element={
          <GovernanceRoute
            scenario={scenario}
            onRunSecurityGateSuite={onRunSecurityGateSuite}
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

function GovernanceRoute({ scenario, onRunSecurityGateSuite }: AppRoutesProps) {
  return (
    <GovernanceConsolePage
      scenario={scenario}
      onRunSecurityGateSuite={onRunSecurityGateSuite}
    />
  );
}
