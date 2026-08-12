import assert from "node:assert/strict";
import { test } from "node:test";
import { InMemoryIdempotencyStore } from "../../../app/src/idempotency-store.js";

test("idempotency store replays identical complete request", async () => {
  const store = new InMemoryIdempotencyStore();
  const begin = await store.begin({
    scopedKey: "k1",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr",
    leaseDurationSeconds: 30
  });
  assert.equal(begin.type, "STARTED");
  const claimId = begin.type === "STARTED" ? begin.claimId : "";
  await store.complete(
    {
      scopedKey: "k1",
      tenantId: "tenant",
      caseId: "case",
      subjectId: "user",
      operationId: "op",
      fingerprint: "fp",
      claimId
    },
    201,
    '{"ok":true}'
  );
  const replay = await store.begin({
    scopedKey: "k1",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr-2",
    leaseDurationSeconds: 30
  });
  assert.equal(replay.type, "REPLAY");
});

test("idempotency key conflict on different fingerprint", async () => {
  const store = new InMemoryIdempotencyStore();
  await store.begin({
    scopedKey: "k2",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp-1",
    correlationId: "corr",
    leaseDurationSeconds: 30
  });
  const conflict = await store.begin({
    scopedKey: "k2",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp-2",
    correlationId: "corr-2",
    leaseDurationSeconds: 30
  });
  assert.equal(conflict.type, "CONFLICT");
});

test("failed lease can be reclaimed and restarted", async () => {
  const store = new InMemoryIdempotencyStore();
  const first = await store.begin({
    scopedKey: "k3",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr",
    leaseDurationSeconds: 1
  });
  assert.equal(first.type, "STARTED");
  await store.fail({
    scopedKey: "k3",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    claimId: first.type === "STARTED" ? first.claimId : ""
  });
  const restarted = await store.begin({
    scopedKey: "k3",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr-2",
    leaseDurationSeconds: 30
  });
  assert.equal(restarted.type, "STARTED");
});

test("in-progress duplicate does not restart execution", async () => {
  const store = new InMemoryIdempotencyStore();
  await store.begin({
    scopedKey: "k4",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr",
    leaseDurationSeconds: 30
  });
  const duplicate = await store.begin({
    scopedKey: "k4",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr-2",
    leaseDurationSeconds: 30
  });
  assert.equal(duplicate.type, "IN_PROGRESS");
});

test("complete requires active lease claim", async () => {
  const store = new InMemoryIdempotencyStore();
  const first = await store.begin({
    scopedKey: "k5",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr",
    leaseDurationSeconds: 30
  });
  assert.equal(first.type, "STARTED");
  await store.fail({
    scopedKey: "k5",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    claimId: first.type === "STARTED" ? first.claimId : ""
  });
  await assert.rejects(
    store.complete(
      {
        scopedKey: "k5",
        tenantId: "tenant",
        caseId: "case",
        subjectId: "user",
        operationId: "op",
        fingerprint: "fp",
        claimId: first.type === "STARTED" ? first.claimId : ""
      },
      200,
      "{}"
    ),
    /IDEMPOTENCY_LEASE_EXPIRED/
  );
});

test("old claim token is rejected after reclaim", async () => {
  const store = new InMemoryIdempotencyStore();
  const first = await store.begin({
    scopedKey: "k6",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr",
    leaseDurationSeconds: 1
  });
  assert.equal(first.type, "STARTED");
  await store.fail({
    scopedKey: "k6",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    claimId: first.type === "STARTED" ? first.claimId : ""
  });
  const second = await store.begin({
    scopedKey: "k6",
    tenantId: "tenant",
    caseId: "case",
    subjectId: "user",
    operationId: "op",
    fingerprint: "fp",
    correlationId: "corr-2",
    leaseDurationSeconds: 30
  });
  assert.equal(second.type, "STARTED");
  await assert.rejects(
    store.complete(
      {
        scopedKey: "k6",
        tenantId: "tenant",
        caseId: "case",
        subjectId: "user",
        operationId: "op",
        fingerprint: "fp",
        claimId: first.type === "STARTED" ? first.claimId : ""
      },
      200,
      "{}"
    ),
    /IDEMPOTENCY_CONTEXT_MISMATCH|IDEMPOTENCY_LEASE_EXPIRED/
  );
});
