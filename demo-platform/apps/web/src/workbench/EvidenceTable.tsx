import { Button, Caption1, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import type { EvidenceItem } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  headerCell: {
    textAlign: "left",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  cell: {
    verticalAlign: "top",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  meta: {
    display: "grid",
    gap: tokens.spacingVerticalXXS
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalXS
  }
});

interface EvidenceTableProps {
  readonly evidence: readonly EvidenceItem[];
  readonly onAdmitEvidence?: (input: { evidenceId: string }) => Promise<void> | void;
  readonly isBusy?: boolean;
}

export function EvidenceTable({
  evidence,
  onAdmitEvidence,
  isBusy = false
}: EvidenceTableProps) {
  const styles = useStyles();

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.headerCell} scope="col">
            Evidence
          </th>
          <th className={styles.headerCell} scope="col">
            Owner
          </th>
          <th className={styles.headerCell} scope="col">
            Licence
          </th>
          <th className={styles.headerCell} scope="col">
            Provenance
          </th>
          <th className={styles.headerCell} scope="col">
            Admission
          </th>
        </tr>
      </thead>
      <tbody>
        {evidence.map((item) => (
          <tr key={item.evidenceId}>
            <td className={styles.cell}>
              <div className={styles.meta}>
                <strong>{item.title}</strong>
                <Caption1>{item.sourceLocator}</Caption1>
              </div>
            </td>
            <td className={styles.cell}>{item.owner}</td>
            <td className={styles.cell}>
              <StatusBadge label={item.licenceStatus} status={item.licenceStatus} />
            </td>
            <td className={styles.cell}>
              <div className={styles.badgeRow}>
                <StatusBadge label={item.provenanceStatus} status={item.provenanceStatus} />
                <StatusBadge label={item.domain} status={item.domain} />
              </div>
            </td>
            <td className={styles.cell}>
              <div className={styles.badgeRow}>
                <StatusBadge label={item.admissionStatus} status={item.admissionStatus} />
                <Button
                  appearance="secondary"
                  disabled={isBusy || item.admissionStatus === "ADMITTED" || !onAdmitEvidence}
                  onClick={() => void onAdmitEvidence?.({ evidenceId: item.evidenceId })}
                >
                  Admit {item.title}
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
