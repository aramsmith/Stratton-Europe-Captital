import {
  Body1,
  Body1Strong,
  Caption1,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title3,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type { AnalysisFinding, EvidenceItem } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  card: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingHorizontalL, tokens.spacingVerticalL)
  },
  table: {
    width: "100%",
    tableLayout: "fixed",
    "@media (max-width: 760px)": {
      display: "block"
    }
  },
  tableHeader: {
    "@media (max-width: 760px)": {
      display: "none"
    }
  },
  tableBody: {
    "@media (max-width: 760px)": {
      display: "grid",
      gap: tokens.spacingVerticalM
    }
  },
  tableRow: {
    "@media (max-width: 760px)": {
      display: "grid",
      gap: tokens.spacingVerticalS,
      border: "1px solid #d3d0c7",
      borderRadius: "8px",
      backgroundColor: "#f7f6f2",
      ...shorthands.padding(tokens.spacingVerticalM)
    }
  },
  tableCell: {
    minWidth: 0,
    verticalAlign: "top",
    overflowWrap: "anywhere",
    "@media (max-width: 760px)": {
      display: "grid",
      gridTemplateColumns: "minmax(88px, 0.32fr) minmax(0, 1fr)",
      gap: tokens.spacingHorizontalM,
      borderBottom: "1px solid #d3d0c7",
      ...shorthands.padding(tokens.spacingVerticalS, 0),
      "::before": {
        content: "attr(data-label)",
        color: "#495463",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase"
      },
      ":last-child": {
        borderBottom: 0
      }
    }
  },
  claimCell: {
    display: "grid",
    minWidth: 0,
    gap: tokens.spacingVerticalXS,
    overflowWrap: "anywhere"
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  },
  sourceList: {
    display: "grid",
    gap: tokens.spacingVerticalXXS,
    margin: 0,
    paddingLeft: tokens.spacingHorizontalM,
    overflowWrap: "anywhere"
  },
  ownerList: {
    display: "grid",
    minWidth: 0,
    gap: tokens.spacingVerticalXXS
  },
  runBadge: {
    minWidth: 0,
    maxWidth: "100%",
    "& > *": {
      maxWidth: "100%",
      overflowWrap: "anywhere",
      wordBreak: "break-word"
    }
  }
});

interface MaterialClaimsTableProps {
  readonly findings: readonly AnalysisFinding[];
  readonly evidenceById: ReadonlyMap<string, EvidenceItem>;
}

export function MaterialClaimsTable({
  findings,
  evidenceById
}: MaterialClaimsTableProps) {
  const styles = useStyles();

  return (
    <Card className={styles.card}>
      <Title3 as="h3">Material claims</Title3>
      {findings.length === 0 ? (
        <Body1>No accepted material claims are available for committee preparation yet.</Body1>
      ) : (
        <Table aria-label="Material claims table" className={styles.table}>
          <TableHeader className={styles.tableHeader}>
            <TableRow>
              <TableHeaderCell>Claim</TableHeaderCell>
              <TableHeaderCell>Evidence</TableHeaderCell>
              <TableHeaderCell>Owner</TableHeaderCell>
              <TableHeaderCell>Disposition</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody className={styles.tableBody}>
            {findings.map((finding) => {
              const owners = Array.from(
                new Set(
                  finding.citations
                    .map((citation) => evidenceById.get(citation.evidenceId)?.owner)
                    .filter((owner): owner is string => typeof owner === "string")
                )
              );

              return (
                <TableRow className={styles.tableRow} id={`claim-${finding.findingId}`} key={finding.findingId}>
                  <TableCell className={styles.tableCell} data-label="Claim">
                    <div className={styles.claimCell}>
                      <Body1Strong>{finding.title}</Body1Strong>
                      <Body1>{finding.summary}</Body1>
                      <div className={styles.badgeRow}>
                        <StatusBadge label={finding.materiality} status={finding.materiality} />
                        {finding.analysisRunId ? (
                          <span className={styles.runBadge}>
                            <StatusBadge label={finding.analysisRunId} status="TERRA" />
                          </span>
                        ) : null}
                      </div>
                      <Caption1>
                        Latest text action: {finding.textHistory.at(-1)?.action ?? "GENERATED"}
                      </Caption1>
                    </div>
                  </TableCell>
                  <TableCell className={styles.tableCell} data-label="Evidence">
                    <div className={styles.claimCell}>
                      <Body1Strong>{finding.citations.length} linked sources</Body1Strong>
                      <ul className={styles.sourceList}>
                        {finding.citations.map((citation) => {
                          const evidence = evidenceById.get(citation.evidenceId);
                          return (
                            <li key={citation.citationId}>
                              <Caption1>{evidence?.title ?? citation.evidenceId}</Caption1>
                              <Caption1>
                                {evidence?.sourceLocator ?? citation.evidenceId} · {citation.locator}
                              </Caption1>
                              {evidence?.sourcePreview ? (
                                <Caption1>{evidence.sourcePreview}</Caption1>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </TableCell>
                  <TableCell className={styles.tableCell} data-label="Owner">
                    <div className={styles.ownerList}>
                      {owners.map((owner) => (
                        <Caption1 key={owner}>{owner}</Caption1>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className={styles.tableCell} data-label="Disposition">
                    <StatusBadge label={finding.status} status={finding.status} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
