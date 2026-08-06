import { createHash } from "node:crypto";
import type { AuditEvent, AuditEventInput } from "./types.js";

function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function computeAuditHash(
  previousEventHash: string | null,
  sequence: number,
  input: AuditEventInput
): string {
  const payload = canonicalStringify({
    sequence,
    previousEventHash,
    tenantId: input.tenantId,
    caseId: input.caseId,
    actorId: input.actorId,
    action: input.action,
    subjectId: input.subjectId,
    correlationId: input.correlationId,
    outcome: input.outcome,
    payloadReference: input.payloadReference
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function verifyAuditChain(events: readonly AuditEvent[]): boolean {
  for (let index = 0; index < events.length; index += 1) {
    const current = events[index];
    const previous = index > 0 ? events[index - 1] : undefined;
    if (!current) {
      return false;
    }
    const expectedPreviousHash = previous?.eventHash ?? null;
    if (current.previousEventHash !== expectedPreviousHash) {
      return false;
    }
    const expectedHash = computeAuditHash(current.previousEventHash, current.sequence, current);
    if (expectedHash !== current.eventHash) {
      return false;
    }
  }
  return true;
}
