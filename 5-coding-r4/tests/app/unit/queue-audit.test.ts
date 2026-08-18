import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyAuditChain } from "../../../app/src/audit-outbox.js";
import { InMemoryIdempotencyStore } from "../../../app/src/idempotency-store.js";
import { QueueConsumer, RetryableQueueError } from "../../../app/src/queue-consumer.js";
import { QueueOutboxDispatcher } from "../../../app/src/queue-outbox-dispatcher.js";
import type { QueueMessage, QueueProducer } from "../../../app/src/types.js";
import { InMemoryWorkloadRepository } from "../../../app/src/workload-repository.js";

test("queue consumer dead-letters unsupported operation", async () => {
  const repository = new InMemoryWorkloadRepository();
  const consumer = new QueueConsumer(repository, new InMemoryIdempotencyStore(), {}, {
    maxAttempts: 3,
    leaseDurationSeconds: 30
  });
  const result = await consumer.process({
    messageId: "m1",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_ANALYSIS",
    queueName: "q-analysis",
    payloadReference: "blob://x",
    idempotencyKey: "idem-1",
    correlationId: "corr-1"
  });
  assert.equal(result.action, "deadLetter");
});

test("queue consumer replays idempotent duplicate without re-execute", async () => {
  const repository = new InMemoryWorkloadRepository();
  let count = 0;
  const consumer = new QueueConsumer(
    repository,
    new InMemoryIdempotencyStore(),
    {
      REQUEST_ANALYSIS: async () => {
        count += 1;
      }
    },
    { maxAttempts: 3, leaseDurationSeconds: 30 }
  );
  const message = {
    messageId: "m1",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_ANALYSIS" as const,
    queueName: "q-analysis" as const,
    payloadReference: "blob://payload",
    idempotencyKey: "idem-1",
    correlationId: "corr-1"
  };
  const first = await consumer.process(message);
  const second = await consumer.process(message);
  assert.equal(first.action, "complete");
  assert.equal(second.action, "complete");
  assert.equal(count, 1);
});

test("queue consumer abandons retryable errors until max attempts", async () => {
  const repository = new InMemoryWorkloadRepository();
  let count = 0;
  const consumer = new QueueConsumer(
    repository,
    new InMemoryIdempotencyStore(),
    {
      REQUEST_INGESTION: async () => {
        count += 1;
        throw new RetryableQueueError("TEMP");
      }
    },
    { maxAttempts: 2, leaseDurationSeconds: 30 }
  );
  const first = await consumer.process({
    messageId: "m1",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_INGESTION",
    queueName: "q-ingestion",
    payloadReference: "blob://payload",
    idempotencyKey: "idem-1",
    correlationId: "corr-1",
    deliveryCount: 1
  });
  const second = await consumer.process({
    messageId: "m1",
    tenantId: "tenant-a",
    caseId: "case-a",
    operation: "REQUEST_INGESTION",
    queueName: "q-ingestion",
    payloadReference: "blob://payload",
    idempotencyKey: "idem-1",
    correlationId: "corr-1",
    deliveryCount: 2
  });
  assert.equal(first.action, "abandon");
  assert.equal(second.action, "deadLetter");
  assert.equal(count, 2);
});

test("audit hash chain is stable and verifiable", async () => {
  const repository = new InMemoryWorkloadRepository();
  await repository.appendAuditEvent({
    tenantId: "tenant-a",
    caseId: "case-a",
    sourceEventId: "evt-1",
    actorId: "actor-1",
    action: "A",
    subjectId: "subject-1",
    correlationId: "corr-1",
    outcome: "SUCCESS",
    payloadReference: "ref-1"
  });
  await repository.appendAuditEvent({
    tenantId: "tenant-a",
    caseId: "case-a",
    sourceEventId: "evt-2",
    actorId: "actor-2",
    action: "B",
    subjectId: "subject-2",
    correlationId: "corr-2",
    outcome: "DENY",
    payloadReference: "ref-2"
  });
  assert.equal(verifyAuditChain(repository.listAuditEvents("tenant-a", "case-a")), true);
});

test("queue outbox dispatcher drains pending scopes autonomously", async () => {
  class CollectingQueueProducer implements QueueProducer {
    public readonly sent: QueueMessage[] = [];
    public async send(message: QueueMessage): Promise<void> {
      this.sent.push(message);
    }
    public async isAvailable(): Promise<boolean> {
      return true;
    }
  }

  const repository = new InMemoryWorkloadRepository();
  const producer = new CollectingQueueProducer();
  const dispatcher = new QueueOutboxDispatcher(repository, producer);

  await repository.enqueueQueueOutboxMessage({
    tenantId: "tenant-a",
    caseId: "case-1",
    queueName: "q-ingestion",
    messageId: "msg-1",
    operation: "REQUEST_INGESTION",
    payloadReference: "blob://evidence/1",
    idempotencyKey: "idem-1",
    correlationId: "corr-1"
  });

  await repository.enqueueQueueOutboxMessage({
    tenantId: "tenant-b",
    caseId: "case-2",
    queueName: "q-ingestion",
    messageId: "msg-2",
    operation: "REQUEST_INGESTION",
    payloadReference: "blob://evidence/2",
    idempotencyKey: "idem-2",
    correlationId: "corr-2"
  });

  await dispatcher.dispatchPendingAcrossScopes(100, 50);

  assert.equal(producer.sent.length, 2);
  const queueOutbox = (repository as unknown as {
    queueOutbox: Map<string, { status: string }>;
  }).queueOutbox;
  for (const row of queueOutbox.values()) {
    assert.equal(row.status, "DELIVERED");
  }
});

test("queue outbox accepts an idempotent replay with a new correlation id", async () => {
  const repository = new InMemoryWorkloadRepository();
  const original = {
    tenantId: "tenant-a",
    caseId: "case-a",
    queueName: "q-extraction" as const,
    messageId: "msg-stable",
    operation: "REQUEST_EXTRACTION" as const,
    payloadReference: "blob://evidence/1",
    idempotencyKey: "idem-stable",
    correlationId: "corr-original",
    evidenceId: "evidence-1",
    evidenceVersionId: "evidence-1-v1"
  };

  await repository.enqueueQueueOutboxMessage(original);
  await repository.enqueueQueueOutboxMessage({
    ...original,
    correlationId: "corr-replay"
  });

  await assert.rejects(
    repository.enqueueQueueOutboxMessage({
      ...original,
      correlationId: "corr-replay",
      payloadReference: "blob://evidence/different"
    }),
    /QUEUE_OUTBOX_MESSAGE_CONFLICT/
  );
});

test("queue outbox dispatcher applies the long delay to non-retryable errors containing a digit 5", async () => {
  class RejectingQueueProducer implements QueueProducer {
    public async send(): Promise<void> {
      throw new Error("record 5 is invalid");
    }
    public async isAvailable(): Promise<boolean> {
      return true;
    }
  }

  const repository = new InMemoryWorkloadRepository();
  const dispatcher = new QueueOutboxDispatcher(repository, new RejectingQueueProducer());
  await repository.enqueueQueueOutboxMessage({
    tenantId: "tenant-a",
    caseId: "case-1",
    queueName: "q-ingestion",
    messageId: "msg-non-retryable",
    operation: "REQUEST_INGESTION",
    payloadReference: "blob://evidence/1",
    idempotencyKey: "idem-non-retryable",
    correlationId: "corr-non-retryable"
  });

  const startedAt = Date.now();
  await dispatcher.dispatchPendingAcrossScopes(1, 1);
  const queueOutbox = (repository as unknown as {
    queueOutbox: Map<string, { nextAttemptAtIso: string }>;
  }).queueOutbox;
  const row = queueOutbox.values().next().value;
  assert.ok(row);
  const delayMs = Date.parse(row.nextAttemptAtIso) - startedAt;
  assert.ok(delayMs >= 55_000 && delayMs <= 65_000, `expected about 60s, received ${delayMs}ms`);
});

test("queue outbox dispatcher applies the short delay to HTTP 5xx errors", async () => {
  class RejectingQueueProducer implements QueueProducer {
    public async send(): Promise<void> {
      throw Object.assign(new Error("service unavailable"), { statusCode: 503 });
    }
    public async isAvailable(): Promise<boolean> {
      return true;
    }
  }

  const repository = new InMemoryWorkloadRepository();
  const dispatcher = new QueueOutboxDispatcher(repository, new RejectingQueueProducer());
  await repository.enqueueQueueOutboxMessage({
    tenantId: "tenant-a",
    caseId: "case-1",
    queueName: "q-ingestion",
    messageId: "msg-retryable",
    operation: "REQUEST_INGESTION",
    payloadReference: "blob://evidence/1",
    idempotencyKey: "idem-retryable",
    correlationId: "corr-retryable"
  });

  const startedAt = Date.now();
  await dispatcher.dispatchPendingAcrossScopes(1, 1);
  const queueOutbox = (repository as unknown as {
    queueOutbox: Map<string, { nextAttemptAtIso: string }>;
  }).queueOutbox;
  const row = queueOutbox.values().next().value;
  assert.ok(row);
  const delayMs = Date.parse(row.nextAttemptAtIso) - startedAt;
  assert.ok(delayMs >= 4_000 && delayMs <= 10_000, `expected about 5s, received ${delayMs}ms`);
});
