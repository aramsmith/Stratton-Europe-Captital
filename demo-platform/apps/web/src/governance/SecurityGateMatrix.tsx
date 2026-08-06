import { Body1, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import type { GovernanceView } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

interface SecurityGateMatrixProps {
  readonly securityGates: GovernanceView["securityGates"];
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

export function SecurityGateMatrix({ securityGates }: SecurityGateMatrixProps) {
  const styles = useStyles();

  if (securityGates.length === 0) {
    return <Body1>No security gates are available.</Body1>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.cell} scope="col">
            Gate ID
          </th>
          <th className={styles.cell} scope="col">
            Scenario
          </th>
          <th className={styles.cell} scope="col">
            Outcome
          </th>
          <th className={styles.cell} scope="col">
            Support
          </th>
          <th className={styles.cell} scope="col">
            Fail-closed outcome
          </th>
        </tr>
      </thead>
      <tbody>
        {securityGates.map((gate) => (
          <tr key={gate.gateId}>
            <td className={styles.cell}>{gate.gateId}</td>
            <td className={styles.cell}>{gate.name}</td>
            <td className={styles.cell}>
              <StatusBadge label={gate.outcome} status={gate.outcome} />
            </td>
            <td className={styles.cell}>{gate.evidenceId ?? "No supporting scenario evidence"}</td>
            <td className={styles.cell}>{gate.failClosedOutcome}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
