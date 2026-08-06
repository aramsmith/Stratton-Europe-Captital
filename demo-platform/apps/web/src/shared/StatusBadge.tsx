import { Badge, type BadgeProps } from "@fluentui/react-components";

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
  STATE_CONFLICT: "danger",
  SUCCESS: "success",
  TERRA: "informative",
  VERIFIED: "success"
};

export function StatusBadge({ label, status }: StatusBadgeProps) {
  return (
    <Badge appearance="tint" color={badgeColorByStatus[status] ?? "informative"}>
      {label}
    </Badge>
  );
}
