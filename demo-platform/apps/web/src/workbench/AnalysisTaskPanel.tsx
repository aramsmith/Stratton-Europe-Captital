import {
  Button,
  Caption1,
  Field,
  Textarea,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type { AnalysisRunMetadata, AnalysisTaskClass } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

const taskClassOptions: ReadonlyArray<{ value: AnalysisTaskClass; label: string }> = [
  { value: "CROSS_DOCUMENT_COMPARISON", label: "Cross-document comparison" },
  { value: "GROUNDED_ANALYSIS", label: "Grounded analysis" },
  { value: "INVESTMENT_THESIS_CHALLENGE", label: "Investment-thesis challenge" }
];

const useStyles = makeStyles({
  panel: {
    display: "grid",
    gap: tokens.spacingVerticalM
  },
  controls: {
    display: "grid",
    gap: tokens.spacingVerticalM
  },
  select: {
    minHeight: "32px",
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding(tokens.spacingVerticalXS, tokens.spacingHorizontalS)
  },
  statusRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  },
  error: {
    color: tokens.colorPaletteRedForeground1
  }
});

interface AnalysisTaskPanelProps {
  readonly taskClass: AnalysisTaskClass;
  readonly question: string;
  readonly latestAnalysisRun?: AnalysisRunMetadata | undefined;
  readonly rerunBlockedReason?: string | null | undefined;
  readonly route?: string | undefined;
  readonly statusMessage?: string | null | undefined;
  readonly error?: string | null | undefined;
  readonly isBusy?: boolean;
  readonly onTaskClassChange: (taskClass: AnalysisTaskClass) => void;
  readonly onQuestionChange: (question: string) => void;
  readonly onRunAnalysis?: (() => Promise<void> | void) | undefined;
}

export function AnalysisTaskPanel({
  taskClass,
  question,
  latestAnalysisRun,
  rerunBlockedReason,
  route,
  statusMessage,
  error,
  isBusy = false,
  onTaskClassChange,
  onQuestionChange,
  onRunAnalysis
}: AnalysisTaskPanelProps) {
  const styles = useStyles();

  return (
    <section aria-labelledby="analysis-task-heading" className={styles.panel}>
      <div>
        <h3 id="analysis-task-heading">Analytical task</h3>
        <Caption1>Deterministic Luna, Terra, and Sol routing with no silent fallback.</Caption1>
      </div>

      <div className={styles.controls}>
        <Field label="Task class">
          <select
            aria-label="Task class"
            className={styles.select}
            disabled={isBusy}
            onChange={(event) => onTaskClassChange(event.currentTarget.value as AnalysisTaskClass)}
            value={taskClass}
          >
            {taskClassOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Analyst question">
          <Textarea
            disabled={isBusy}
            onChange={(_event, data) => onQuestionChange(data.value)}
            resize="vertical"
            value={question}
          />
        </Field>

        <Button
          appearance="primary"
          disabled={isBusy || question.trim().length === 0 || !onRunAnalysis || Boolean(rerunBlockedReason)}
          onClick={() => void onRunAnalysis?.()}
        >
          {isBusy ? "Running..." : "Run analysis"}
        </Button>

        {rerunBlockedReason ? <Caption1>{rerunBlockedReason}</Caption1> : null}

        {statusMessage ? (
          <div className={styles.statusRow}>
            <strong>{statusMessage}</strong>
            {route ? <StatusBadge label={route} status={route} /> : null}
          </div>
        ) : null}

        {latestAnalysisRun ? (
          <div>
            <strong>Latest governed Phase 5 request</strong>
            <Caption1>Authority gate: {formatAuthorityGateRole(latestAnalysisRun.authorityGateRole)}</Caption1>
            <Caption1>Phase 5 run: {latestAnalysisRun.analysisRunId}</Caption1>
            <Caption1>Task class: {latestAnalysisRun.taskClass}</Caption1>
            <Caption1>Analyst question: {latestAnalysisRun.analystQuestion}</Caption1>
            <Caption1>
              Admitted evidence set: {latestAnalysisRun.admittedEvidenceIds.join(", ")}
            </Caption1>
          </div>
        ) : null}

        {error ? (
          <Caption1 className={styles.error} role="alert">
            {error}
          </Caption1>
        ) : null}
      </div>
    </section>
  );
}

function formatAuthorityGateRole(role: AnalysisRunMetadata["authorityGateRole"]): string {
  return role === "HUMAN_ANALYST_REVIEW_GATE" ? "Human analyst review gate" : role;
}
