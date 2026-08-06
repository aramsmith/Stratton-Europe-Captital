import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCitationAssessment } from "../../../app/src/claim-lineage-service.js";
import { StructuredLogger } from "../../../app/src/logger.js";

test("citation assessment treats empty output as incomplete", () => {
  const empty = evaluateCitationAssessment([]);
  assert.equal(empty.allMaterialClaimsCited, false);
  assert.equal(empty.totalClaimCount, 0);
});

test("citation assessment requires citations for material claims", () => {
  const result = evaluateCitationAssessment([
    { materiality: "CRITICAL", citations: [] },
    { materiality: "HIGH", citations: [{ citationId: "c-1" }] },
    { materiality: "LOW", citations: [] }
  ]);
  assert.equal(result.allMaterialClaimsCited, false);
  assert.equal(result.criticalUnsupportedClaimCount, 1);
  assert.equal(result.unsupportedClaimCount, 2);
  assert.equal(result.citedClaimCount, 1);
});

test("logger redacts sensitive nested fields", () => {
  const entries: unknown[] = [];
  const logger = new StructuredLogger("unit", (entry) => entries.push(entry));
  logger.log("INFO", "entry", {
    correlationId: "corr-1",
    nested: {
      Authorization: "token",
      password: "pw",
      safeField: "ok"
    }
  });
  const first = entries[0] as { context: { nested: Record<string, unknown>; correlationId?: string } };
  assert.equal(first.context.nested.Authorization, "[REDACTED]");
  assert.equal(first.context.nested.password, "[REDACTED]");
  assert.equal(first.context.nested.safeField, "ok");
  assert.equal(first.context.correlationId, "corr-1");
});
