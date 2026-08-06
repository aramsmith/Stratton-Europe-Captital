import { Body1, Body1Strong, Caption1, Card, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import type { GovernanceView } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

interface AuditExportPanelProps {
  readonly auditExport: GovernanceView["auditExport"];
}

const useStyles = makeStyles({
  card: {
    display: "grid",
    gap: tokens.spacingVerticalS,
    ...shorthands.padding(tokens.spacingVerticalL, tokens.spacingHorizontalL)
  },
  list: {
    margin: 0,
    paddingLeft: tokens.spacingHorizontalL
  }
});

export function AuditExportPanel({ auditExport }: AuditExportPanelProps) {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <Body1Strong>Audit export preview</Body1Strong>
      <Body1>Internal Audit verdict: Not issued</Body1>
      <StatusBadge label={auditExport.status} status={auditExport.status} />
      <Caption1>Preview sections: {auditExport.previewSections.join(", ")}</Caption1>
      {auditExport.missingItems.length === 0 ? (
        <Caption1>The preview is ready. No verdict action is available in this console.</Caption1>
      ) : (
        <>
          <Caption1>The preview remains blocked until the following evidence gaps close:</Caption1>
          <ul className={styles.list}>
            {auditExport.missingItems.map((item) => (
              <li key={item}>
                <Caption1>{item}</Caption1>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
