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
    minWidth: "100%"
  },
  claimCell: {
    display: "grid",
    gap: tokens.spacingVerticalXS
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
    paddingLeft: tokens.spacingHorizontalM
  },
  ownerList: {
    display: "grid",
    gap: tokens.spacingVerticalXXS
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
        <Body1>No material claims are available for committee preparation yet.</Body1>
      ) : (
        <Table aria-label="Material claims table" className={styles.table}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Claim</TableHeaderCell>
              <TableHeaderCell>Evidence</TableHeaderCell>
              <TableHeaderCell>Owner</TableHeaderCell>
              <TableHeaderCell>Disposition</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {findings.map((finding) => {
              const owners = Array.from(
                new Set(
                  finding.citations
                    .map((citation) => evidenceById.get(citation.evidenceId)?.owner)
                    .filter((owner): owner is string => typeof owner === "string")
                )
              );

              return (
                <TableRow id={`claim-${finding.findingId}`} key={finding.findingId}>
                  <TableCell>
                    <div className={styles.claimCell}>
                      <Body1Strong>{finding.title}</Body1Strong>
                      <Body1>{finding.summary}</Body1>
                      <div className={styles.badgeRow}>
                        <StatusBadge label={finding.materiality} status={finding.materiality} />
                        {finding.analysisRunId ? (
                          <StatusBadge label={finding.analysisRunId} status="TERRA" />
                        ) : null}
                      </div>
                      <Caption1>
                        Latest text action: {finding.textHistory.at(-1)?.action ?? "GENERATED"}
                      </Caption1>
                    </div>
                  </TableCell>
                  <TableCell>
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
                  <TableCell>
                    <div className={styles.ownerList}>
                      {owners.map((owner) => (
                        <Caption1 key={owner}>{owner}</Caption1>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
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
