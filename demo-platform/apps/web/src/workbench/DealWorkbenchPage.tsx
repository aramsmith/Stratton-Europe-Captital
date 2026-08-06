import {
  Body1,
  Card,
  Caption1,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type {
  AnalysisRunRequest,
  AnalysisRunResponse,
  AnalysisTaskClass,
  FindingDispositionRequest,
  ScenarioState
} from "@stratton/contracts";
import { useEffect, useMemo, useState } from "react";
import { AnalysisTaskPanel } from "./AnalysisTaskPanel.js";
import { CitationPanel } from "./CitationPanel.js";
import { EvidenceTable } from "./EvidenceTable.js";
import { FindingCard } from "./FindingCard.js";

const useStyles = makeStyles({
  layout: {
    display: "grid",
    gap: tokens.spacingVerticalXL
  },
  grid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 1fr)"
  },
  card: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  findingGrid: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
  },
  comparisonGrid: {
    display: "grid",
    gap: tokens.spacingHorizontalM,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
  },
  comparisonCard: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  }
});
const rerunBlockedReason =
  "Create a versioned cycle before rerunning this governed analysis because the current findings already preserve governed text history or human dispositions.";

interface DealWorkbenchPageProps {
  readonly scenario: ScenarioState;
  readonly onAdmitEvidence?: ((input: {
    caseId: ScenarioState["caseId"];
    evidenceId: string;
  }) => Promise<void> | void) | undefined;
  readonly onRunAnalysis?: ((input: AnalysisRunRequest) => Promise<AnalysisRunResponse> | AnalysisRunResponse) | undefined;
  readonly onRecordDisposition?: ((input: FindingDispositionRequest & {
    findingId: string;
  }) => Promise<void> | void) | undefined;
}

export function DealWorkbenchPage({
  scenario,
  onAdmitEvidence,
  onRunAnalysis,
  onRecordDisposition
}: DealWorkbenchPageProps) {
  const styles = useStyles();
  const [taskClass, setTaskClass] = useState<AnalysisTaskClass>("CROSS_DOCUMENT_COMPARISON");
  const [question, setQuestion] = useState("Challenge management EBITDA quality");
  const [isBusy, setIsBusy] = useState(false);
  const [route, setRoute] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string>();
  const [selectedCitationId, setSelectedCitationId] = useState<string>();

  useEffect(() => {
    if (scenario.findings.length === 0) {
      setSelectedFindingId(undefined);
      setSelectedCitationId(undefined);
      return;
    }

    const hasSelectedFinding = scenario.findings.some((finding) => finding.findingId === selectedFindingId);
    if (!hasSelectedFinding) {
      setSelectedFindingId(scenario.findings[0]?.findingId);
      setSelectedCitationId(scenario.findings[0]?.citations[0]?.citationId);
    }
  }, [scenario.findings, selectedFindingId]);

  const evidenceById = useMemo(
    () => new Map(scenario.evidence.map((evidence) => [evidence.evidenceId, evidence] as const)),
    [scenario.evidence]
  );
  const selectedFinding = scenario.findings.find((finding) => finding.findingId === selectedFindingId);
  const selectedCitation = selectedFinding?.citations.find(
    (citation) => citation.citationId === selectedCitationId
  );
  const selectedEvidence = selectedCitation ? evidenceById.get(selectedCitation.evidenceId) : undefined;
  const analysisRerunBlockedReason = getAnalysisRerunBlockedReason(scenario);

  const handleRunAnalysis = async () => {
    if (!onRunAnalysis) {
      return;
    }

    setIsBusy(true);
    setError(null);
    setStatusMessage("Running routed analysis...");

    try {
      const result = await onRunAnalysis({
        caseId: scenario.caseId,
        taskClass,
        question
      });
      setRoute(result.route);
      setStatusMessage(`Completed via ${result.route}`);
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
      setStatusMessage(null);
      setRoute(undefined);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAdmitEvidence = async (input: { evidenceId: string }) => {
    if (!onAdmitEvidence) {
      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      await onAdmitEvidence({ caseId: scenario.caseId, evidenceId: input.evidenceId });
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
    } finally {
      setIsBusy(false);
    }
  };

  const handleRecordDisposition = async (input: {
    findingId: string;
    action: FindingDispositionRequest["action"];
    editedSummary?: string;
  }) => {
    if (!onRecordDisposition) {
      return;
    }

    setError(null);
    setIsBusy(true);

    try {
      await onRecordDisposition({
        caseId: scenario.caseId,
        action: input.action,
        ...(input.editedSummary ? { editedSummary: input.editedSummary } : {}),
        findingId: input.findingId
      });
    } catch (caughtError) {
      setError(toErrorMessage(caughtError));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className={styles.layout}>
      <section aria-labelledby="workbench-heading">
        <h2 id="workbench-heading">AI Deal Workbench</h2>
        <Body1>
          Govern evidence admission, launch routed analysis, compare cited sources, and keep human
          finding decisions explicit for Project Danube.
        </Body1>
      </section>

      <div className={styles.grid}>
        <Card className={styles.card}>
          <h3>Evidence admission</h3>
          <Caption1>Owner, licence, provenance, and admission status stay visible for every source.</Caption1>
          <EvidenceTable
            evidence={scenario.evidence}
            isBusy={isBusy}
            onAdmitEvidence={handleAdmitEvidence}
          />
        </Card>

        <Card className={styles.card}>
          <AnalysisTaskPanel
            error={error}
            isBusy={isBusy}
            latestAnalysisRun={scenario.latestAnalysisRun}
            onQuestionChange={setQuestion}
            onRunAnalysis={handleRunAnalysis}
            onTaskClassChange={setTaskClass}
            question={question}
            rerunBlockedReason={analysisRerunBlockedReason}
            route={route}
            statusMessage={statusMessage}
            taskClass={taskClass}
          />
        </Card>
      </div>

      <Card className={styles.card}>
        <h3>Findings</h3>
        <Caption1>AI findings remain draft content until a human accepts, edits, challenges, or rejects them.</Caption1>
        {scenario.findings.length === 0 ? (
          <Body1>No findings drafted yet. Admit the cited evidence, then run analysis.</Body1>
        ) : (
          <div className={styles.findingGrid}>
            {scenario.findings.map((finding) => (
              <FindingCard
                key={finding.findingId}
                finding={finding}
                onOpenCitation={({ findingId, citationId }) => {
                  setSelectedFindingId(findingId);
                  setSelectedCitationId(citationId);
                }}
                onRecordDisposition={handleRecordDisposition}
              />
            ))}
          </div>
        )}
      </Card>

      <div className={styles.grid}>
        <Card className={styles.card}>
          <h3>Side-by-side source comparison</h3>
          {selectedFinding ? (
            <div className={styles.comparisonGrid}>
              {selectedFinding.citations.map((citation) => {
                const evidence = evidenceById.get(citation.evidenceId);
                if (!evidence) {
                  return null;
                }

                return (
                  <div className={styles.comparisonCard} key={citation.citationId}>
                    <strong>{evidence.title}</strong>
                    <Caption1>{citation.locator}</Caption1>
                    <p>{evidence.sourcePreview ?? evidence.sourceLocator}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <Caption1>Select a finding citation to compare its evidence.</Caption1>
          )}
        </Card>

        <CitationPanel citation={selectedCitation} evidence={selectedEvidence} />
      </div>
    </div>
  );
}

function toErrorMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message
    : "The workbench operation could not be completed.";
}

function getAnalysisRerunBlockedReason(scenario: ScenarioState): string | null {
  return scenario.findings.some(
    (finding) => finding.status !== "DRAFT" || finding.textHistory.length > 0
  )
    ? rerunBlockedReason
    : null;
}
