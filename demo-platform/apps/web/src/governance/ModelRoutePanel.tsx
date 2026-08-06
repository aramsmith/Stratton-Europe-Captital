import { Body1, Body1Strong, Caption1, Card, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import type { GovernanceView } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

interface ModelRoutePanelProps {
  readonly modelRoutes: GovernanceView["modelRoutes"];
}

const useStyles = makeStyles({
  layout: {
    display: "grid",
    gap: tokens.spacingVerticalM
  },
  item: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS
  }
});

export function ModelRoutePanel({ modelRoutes }: ModelRoutePanelProps) {
  const styles = useStyles();

  if (modelRoutes.length === 0) {
    return <Body1>No governed task route has been recorded yet.</Body1>;
  }

  return (
    <div className={styles.layout}>
      {modelRoutes.map((route) => (
        <Card className={styles.item} key={route.routeId}>
          <Body1Strong>{route.taskClass}</Body1Strong>
          <div className={styles.badgeRow}>
            <StatusBadge label={route.modelRoute} status={route.modelRoute} />
            <StatusBadge label={route.authorityGateRole} status="REVIEW" />
          </div>
          <Caption1>Task route: {route.analysisRunId}</Caption1>
          <Caption1>Primary route evidence: {route.primaryEvidenceIds.join(", ")}</Caption1>
          <Caption1>
            Recovery evidence:{" "}
            {route.recoveryEvidenceIds.length > 0 ? route.recoveryEvidenceIds.join(", ") : "No recovery evidence recorded"}
          </Caption1>
          <Caption1>Route evidence events: {route.routeEventIds.join(", ")}</Caption1>
          <Caption1>Prompt template version: {route.promptTemplateVersion}</Caption1>
          <Caption1>Question hash: {route.questionHash}</Caption1>
          <Caption1>Evidence set hash: {route.evidenceSetHash}</Caption1>
        </Card>
      ))}
    </div>
  );
}
