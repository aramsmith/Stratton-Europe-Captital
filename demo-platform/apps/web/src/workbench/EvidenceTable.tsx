import {
  Button,
  Caption1,
  Checkbox,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type { EvidenceItem } from "@stratton/contracts";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  container: {
    display: "grid",
    gap: tokens.spacingVerticalM
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    alignItems: "center"
  },
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
  readonly onAdmitEvidence?: (input: { evidenceIds: readonly string[] }) => Promise<void> | void;
  readonly isBusy?: boolean;
}

export function EvidenceTable({
  evidence,
  onAdmitEvidence,
  isBusy = false
}: EvidenceTableProps) {
  const styles = useStyles();
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        evidence
          .filter((item) => item.admissionStatus !== "ADMITTED")
          .map((item) => item.evidenceId)
      )
  );
  const eligibleEvidence = useMemo(
    () => evidence.filter((item) => item.admissionStatus !== "ADMITTED"),
    [evidence]
  );
  const selectedEligibleEvidence = eligibleEvidence.filter((item) =>
    selectedEvidenceIds.has(item.evidenceId)
  );
  const allEligibleSelected =
    eligibleEvidence.length > 0 && selectedEligibleEvidence.length === eligibleEvidence.length;
  const someEligibleSelected =
    selectedEligibleEvidence.length > 0 && !allEligibleSelected;

  useEffect(() => {
    const eligibleIds = new Set(eligibleEvidence.map((item) => item.evidenceId));
    setSelectedEvidenceIds((current) => {
      const retained = new Set([...current].filter((evidenceId) => eligibleIds.has(evidenceId)));
      return retained.size === 0 && current.size === 0 && eligibleIds.size > 0
        ? eligibleIds
        : retained;
    });
  }, [eligibleEvidence]);

  const toggleAllEvidence = (checked: boolean | "mixed") => {
    setSelectedEvidenceIds(
      checked === true ? new Set(eligibleEvidence.map((item) => item.evidenceId)) : new Set()
    );
  };

  const toggleEvidence = (evidenceId: string, checked: boolean | "mixed") => {
    setSelectedEvidenceIds((current) => {
      const next = new Set(current);
      if (checked === true) {
        next.add(evidenceId);
      } else {
        next.delete(evidenceId);
      }
      return next;
    });
  };

  const admitSelectedEvidence = async () => {
    await onAdmitEvidence?.({
      evidenceIds: selectedEligibleEvidence.map((item) => item.evidenceId)
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <Checkbox
          aria-label="Select all evidence"
          checked={someEligibleSelected ? "mixed" : allEligibleSelected}
          disabled={isBusy || eligibleEvidence.length === 0}
          label="Select all available evidence"
          onChange={(_, data) => toggleAllEvidence(data.checked)}
        />
        <Button
          appearance="primary"
          disabled={isBusy || selectedEligibleEvidence.length === 0 || !onAdmitEvidence}
          onClick={() => void admitSelectedEvidence()}
        >
          {isBusy
            ? "Admitting evidence..."
            : `Admit selected evidence (${selectedEligibleEvidence.length})`}
        </Button>
      </div>

      <table className={styles.table}>
        <thead className={styles.tableHead}>
          <tr>
            <th className={styles.headerCell} scope="col">
              Select
            </th>
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
              <td className={styles.cell} data-label="Select">
                <Checkbox
                  aria-label={`Select ${item.title}`}
                  checked={
                    item.admissionStatus === "ADMITTED" || selectedEvidenceIds.has(item.evidenceId)
                  }
                  disabled={isBusy || item.admissionStatus === "ADMITTED"}
                  onChange={(_, data) => toggleEvidence(item.evidenceId, data.checked)}
                />
              </td>
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
                <StatusBadge label={item.admissionStatus} status={item.admissionStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
