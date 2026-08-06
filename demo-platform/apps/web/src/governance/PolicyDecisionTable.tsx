import { Body1, Caption1, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import type { GovernanceView } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

interface PolicyDecisionTableProps {
  readonly policyDecisions: GovernanceView["policyDecisions"];
}

const useStyles = makeStyles({
  table: {
    width: "100%",
    borderCollapse: "collapse"
  },
  cell: {
    verticalAlign: "top",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: tokens.colorNeutralStroke2,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalS)
  }
});

export function PolicyDecisionTable({ policyDecisions }: PolicyDecisionTableProps) {
  const styles = useStyles();

  if (policyDecisions.length === 0) {
    return <Body1>No policy decisions have been recorded for Project Danube yet.</Body1>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.cell} scope="col">
            Policy decision
          </th>
          <th className={styles.cell} scope="col">
            Result
          </th>
          <th className={styles.cell} scope="col">
            Reason codes
          </th>
          <th className={styles.cell} scope="col">
            Version
          </th>
          <th className={styles.cell} scope="col">
            Correlation ID
          </th>
        </tr>
      </thead>
      <tbody>
        {policyDecisions.map((decision) => (
          <tr key={decision.decisionId}>
            <td className={styles.cell}>
              <Body1>{decision.policyType}</Body1>
              <Caption1>{decision.decisionId}</Caption1>
            </td>
            <td className={styles.cell}>
              <StatusBadge label={decision.result} status={decision.result} />
            </td>
            <td className={styles.cell}>{decision.reasonCodes.join(", ")}</td>
            <td className={styles.cell}>{decision.version}</td>
            <td className={styles.cell}>{decision.correlationId}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
