import {
  Body1Strong,
  Caption1,
  Card,
  Title3,
  makeStyles,
  shorthands,
  tokens
} from "@fluentui/react-components";
import type { GovernanceEvent } from "@stratton/contracts";
import { StatusBadge } from "../shared/StatusBadge.js";

const useStyles = makeStyles({
  card: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    ...shorthands.padding(tokens.spacingHorizontalL, tokens.spacingVerticalL)
  },
  list: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    listStyleType: "none",
    margin: 0,
    padding: 0
  },
  item: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground2,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusLarge)
  },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: tokens.spacingHorizontalS,
    alignItems: "center"
  }
});

interface AuditTimelineProps {
  readonly events: readonly GovernanceEvent[];
}

export function AuditTimeline({ events }: AuditTimelineProps) {
  const styles = useStyles();
  const orderedEvents = [...events].reverse();

  return (
    <Card className={styles.card}>
      <Title3 as="h3">Audit timeline</Title3>
      <ul className={styles.list}>
        {orderedEvents.map((event) => (
          <li className={styles.item} key={event.eventId}>
            <Body1Strong>{event.type}</Body1Strong>
            <div className={styles.badgeRow}>
              <StatusBadge label={event.outcome} status={event.outcome} />
              <Caption1>{new Date(event.occurredAtIso).toLocaleString()}</Caption1>
            </div>
            <Caption1>Correlation: {event.correlationId}</Caption1>
            {event.detail ? <Caption1>{event.detail}</Caption1> : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
