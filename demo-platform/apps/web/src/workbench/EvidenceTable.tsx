import { Button, Caption1, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import type { EvidenceItem } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  table: {
    width: "100%",
    borderCollapse: "collapse",
    "@media (max-width: 620px)": {
      display: "block"
    }
  },
  tableHead: {
    "@media (max-width: 620px)": {
      display: "none"
    }
  },
  tableBody: {
    "@media (max-width: 620px)": {
      display: "grid",
      gap: tokens.spacingVerticalM
    }
  },
  row: {
    "@media (max-width: 620px)": {
      display: "grid",
      border: `1px solid ${tokens.colorNeutralStroke2}`,
      ...shorthands.borderRadius(tokens.borderRadiusMedium),
      ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS)
    }
  },
  headerCell: {
    textAlign: "left",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
  },
  cell: {
    verticalAlign: "top",
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS),
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    "@media (max-width: 620px)": {
      display: "grid",
      gridTemplateColumns: "88px minmax(0, 1fr)",
      gap: tokens.spacingHorizontalS,
      alignItems: "start",
      "::before": {
        content: "attr(data-label)",
        color: tokens.colorNeutralForeground3,
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase"
      },
      ":last-child": {
        borderBottomStyle: "none"
      }
    }
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
      <thead className={styles.tableHead}>
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
      <tbody className={styles.tableBody}>
        {evidence.map((item) => (
          <tr className={styles.row} key={item.evidenceId}>
            <td className={styles.cell} data-label="Evidence">
              <div className={styles.meta}>
                <strong>{item.title}</strong>
                <Caption1>{item.sourceLocator}</Caption1>
              </div>
            </td>
            <td className={styles.cell} data-label="Owner">{item.owner}</td>
            <td className={styles.cell} data-label="Licence">
              <StatusBadge label={item.licenceStatus} status={item.licenceStatus} />
            </td>
            <td className={styles.cell} data-label="Provenance">
              <div className={styles.badgeRow}>
                <StatusBadge label={item.provenanceStatus} status={item.provenanceStatus} />
                <StatusBadge label={item.domain} status={item.domain} />
              </div>
            </td>
            <td className={styles.cell} data-label="Admission">
              <div className={styles.badgeRow}>
                <StatusBadge label={item.admissionStatus} status={item.admissionStatus} />
                <Button
                  appearance="secondary"
                  disabled={isBusy || item.admissionStatus === "ADMITTED" || !onAdmitEvidence}
                  onClick={() => void onAdmitEvidence?.({ evidenceId: item.evidenceId })}
                >
                  Admit evidence
                </Button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
