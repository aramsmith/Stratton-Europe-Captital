import { Body1, Body1Strong, Caption1, Card, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import type { GovernanceView } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

interface LineageGraphProps {
  readonly lineage: GovernanceView["lineage"];
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
  chain: {
    display: "grid",
    gap: tokens.spacingVerticalXS
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS
  }
});

export function LineageGraph({ lineage }: LineageGraphProps) {
  const styles = useStyles();

  if (lineage.length === 0) {
    return (
      <Body1>
        No material lineage is available yet. Governed route evidence must exist before the console
        can expose source-to-recommendation chains.
      </Body1>
    );
  }

  return (
    <div className={styles.layout}>
      {lineage.map((node) => (
        <Card className={styles.item} key={node.id}>
          <Body1Strong>{node.title}</Body1Strong>
          <div className={styles.chain}>
            <Caption1>Source → evidence → finding → review → recommendation</Caption1>
            <Caption1>Sources: {node.sourceLocators.join(", ")}</Caption1>
            <Caption1>Evidence: {node.evidenceIds.join(", ")}</Caption1>
            <Caption1>Finding ID: {node.id}</Caption1>
            <Caption1>
              Reviews: {node.reviewTypes.length > 0 ? node.reviewTypes.join(", ") : "Awaiting current review"}
            </Caption1>
            {node.historicalReviewTypes.length > 0 ? (
              <Caption1>
                Historical reviews: {formatHistoricalReviews(node)}
              </Caption1>
            ) : null}
            <Caption1>
              Current policy evidence:{" "}
              {node.policyDecisionIds.length > 0
                ? node.policyDecisionIds.join(", ")
                : "Awaiting current policy evidence"}
            </Caption1>
            {node.historicalPolicyDecisionIds.length > 0 ? (
              <Caption1>
                Historical policy evidence: {node.historicalPolicyDecisionIds.join(", ")}
              </Caption1>
            ) : null}
            <Caption1>
              Recommendation: {node.recommendationIds.length > 0 ? node.recommendationIds.join(", ") : "Not prepared"}
            </Caption1>
            {node.historicalRecommendationIds.length > 0 ? (
              <Caption1>
                Historical recommendations: {node.historicalRecommendationIds.join(", ")}
              </Caption1>
            ) : null}
          </div>
          <div className={styles.badgeRow}>
            <StatusBadge
              label={formatAssuranceLabel(node.assuranceStatus)}
              status={node.assuranceStatus}
            />
            <StatusBadge label={node.modelRoute} status={node.modelRoute} />
            <StatusBadge
              label={`${node.policyDecisionIds.length} current policy decision${node.policyDecisionIds.length === 1 ? "" : "s"}`}
              status={node.policyDecisionIds.length === 0 ? "PENDING" : "ANALYSIS"}
            />
          </div>
        </Card>
      ))}
    </div>
  );
}

function formatAssuranceLabel(
  assuranceStatus: GovernanceView["lineage"][number]["assuranceStatus"]
): string {
  switch (assuranceStatus) {
    case "CURRENT":
      return "Current assurance";
    case "STALE":
      return "Historical only";
    case "PENDING":
      return "Awaiting current assurance";
  }
}

function formatHistoricalReviews(node: GovernanceView["lineage"][number]): string {
  return node.historicalReviewTypes
    .map((reviewType, index) => {
      const reviewVersionId = node.historicalReviewVersionIds[index];
      return reviewVersionId ? `${reviewType} (${reviewVersionId})` : reviewType;
    })
    .join(", ");
}
