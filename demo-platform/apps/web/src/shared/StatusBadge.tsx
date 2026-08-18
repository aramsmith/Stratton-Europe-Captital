import { Badge, makeStyles, type BadgeProps } from "@fluentui/react-components";

interface StatusBadgeProps {
  readonly label: string;
  readonly status: string;
}

const badgeColorByStatus: Readonly<Record<string, NonNullable<BadgeProps["color"]>>> = {
  ADMITTED: "success",
  ALLOW: "success",
  ANALYSIS: "informative",
  APPROVED: "success",
  BLOCKED: "danger",
  CHALLENGED: "warning",
  COMMITTEE_PREPARATION: "severe",
  CURRENT: "success",
  CRITICAL: "danger",
  DENY: "danger",
  DRAFT: "informative",
  EXPIRED: "danger",
  FAILURE: "danger",
  HIGH: "danger",
  INTAKE: "brand",
  LUNA: "brand",
  LOW: "subtle",
  MEDIUM: "warning",
  MISSING: "danger",
  NOT_REQUIRED: "subtle",
  PENDING: "warning",
  QUARANTINED: "warning",
  REJECTED: "danger",
  REVIEW: "important",
  SOL: "important",
  STALE: "warning",
  STATE_CONFLICT: "danger",
  SUCCESS: "success",
  TERRA: "informative",
  VERIFIED: "success"
};

const useStyles = makeStyles({
  badge: {
    minHeight: "22px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    borderRadius: "3px"
  }
});

export function StatusBadge({ label, status }: StatusBadgeProps) {
  const styles = useStyles();

  return (
    <Badge
      appearance="tint"
      className={styles.badge}
      color={badgeColorByStatus[status] ?? "informative"}
    >
      {label}
    </Badge>
  );
}
