import { createHash } from "node:crypto";
import type {
  IdempotencyStore,
  QueueMessage,
  WorkItemRecord,
  WorkloadRepository
} from "./types.js";

export class RetryableQueueError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "RetryableQueueError";
  }
}

export type WorkerOperationHandler = (message: QueueMessage) => Promise<void>;

export interface QueueProcessingResult {
  readonly action: "complete" | "abandon" | "deadLetter";
  readonly reason: string;
}

export interface QueueConsumerConfig {
  readonly maxAttempts: number;
  readonly leaseDurationSeconds: number;
}

function messageFingerprint(message: QueueMessage): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenantId: message.tenantId,
        caseId: message.caseId,
        operation: message.operation,
        queueName: message.queueName,
        evidenceId: message.evidenceId ?? "",
        evidenceVersionId: message.evidenceVersionId ?? "",
        analysisRunId: message.analysisRunId ?? "",
        sourceId: message.sourceId ?? "",
        payloadReference: message.payloadReference
      })
    )
    .digest("hex");
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableQueueError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  if (typeof statusCode === "number" && (statusCode === 408 || statusCode === 429 || statusCode >= 500)) {
    return true;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("etimedout") ||
    message.includes("econnreset") ||
    message.includes("temporarily unavailable")
  );
}

function workItemFromMessage(message: QueueMessage, status: WorkItemRecord["status"]): WorkItemRecord {
  return {
    tenantId: message.tenantId,
    caseId: message.caseId,
    workItemId: message.messageId,
    queueName: message.queueName,
    operation: message.operation,
    workType: message.operation,
    messageId: message.messageId,
    idempotencyKey: message.idempotencyKey,
    attempt: message.deliveryCount ?? 1,
    status,
    payloadReference: message.payloadReference,
    correlationId: message.correlationId,
    queuedAtIso: new Date().toISOString(),
    ...(message.evidenceId ? { evidenceId: message.evidenceId } : {}),
    ...(message.evidenceVersionId ? { evidenceVersionId: message.evidenceVersionId } : {}),
    ...(message.analysisRunId ? { analysisRunId: message.analysisRunId } : {})
  };
}

function auditSourceEventId(message: QueueMessage, action: string): string {
  return createHash("sha256")
    .update(`${message.tenantId}:${message.caseId}:${message.messageId}:${action}`)
    .digest("hex")
    .slice(0, 32);
}

export class QueueConsumer {
  public constructor(
    private readonly repository: WorkloadRepository,
    private readonly idempotencyStore: IdempotencyStore,
    private readonly handlers: Readonly<Record<string, WorkerOperationHandler>>,
    private readonly config: QueueConsumerConfig
  ) {}

  public async process(message: QueueMessage): Promise<QueueProcessingResult> {
    const handler = this.handlers[message.operation];
    if (!handler) {
      await this.repository.appendWorkItem(workItemFromMessage(message, "DEAD_LETTER"));
      await this.repository.appendAuditEvent({
        tenantId: message.tenantId,
        caseId: message.caseId,
        sourceEventId: auditSourceEventId(message, "WORK_ITEM_DEAD_LETTER_UNSUPPORTED"),
        actorId: "worker",
        action: "WORK_ITEM_DEAD_LETTER",
        subjectId: message.messageId,
        correlationId: message.correlationId,
        outcome: "FAILURE",
        payloadReference: message.payloadReference
      });
      return { action: "deadLetter", reason: "UNSUPPORTED_OPERATION" };
    }

    const scopedKey = `queue:${message.tenantId}:${message.caseId}:${message.operation}:${message.idempotencyKey}`;
    const fingerprint = messageFingerprint(message);
    const begin = await this.idempotencyStore.begin({
      scopedKey,
      tenantId: message.tenantId,
      caseId: message.caseId,
      subjectId: "worker",
      operationId: message.operation,
      fingerprint,
      correlationId: message.correlationId,
      leaseDurationSeconds: this.config.leaseDurationSeconds
    });
    if (begin.type === "REPLAY") {
      return { action: "complete", reason: "IDEMPOTENCY_REPLAY" };
    }
    if (begin.type === "CONFLICT") {
      await this.repository.appendWorkItem(workItemFromMessage(message, "DEAD_LETTER"));
      return { action: "deadLetter", reason: "IDEMPOTENCY_CONFLICT" };
    }
    if (begin.type === "IN_PROGRESS") {
      return { action: "abandon", reason: "IDEMPOTENCY_IN_PROGRESS" };
    }
    const claimId = begin.claimId;

    const attempt = message.deliveryCount ?? 1;
    await this.repository.appendWorkItem(workItemFromMessage(message, "IN_PROGRESS"));
    try {
      await handler(message);
      await this.repository.withCaseTransaction(message.tenantId, message.caseId, async (repository) => {
        const scopedIdempotency =
          typeof repository.bindIdempotencyStore === "function"
            ? repository.bindIdempotencyStore(this.idempotencyStore)
            : this.idempotencyStore;
        await repository.markWorkItemStatus(
          message.tenantId,
          message.caseId,
          message.messageId,
          "PROCESSED",
          attempt
        );
        await scopedIdempotency.complete(
          {
            scopedKey,
            tenantId: message.tenantId,
            caseId: message.caseId,
            subjectId: "worker",
            operationId: message.operation,
            fingerprint,
            claimId
          },
          200,
          '{"status":"processed"}'
        );
        await repository.appendAuditEvent({
          tenantId: message.tenantId,
          caseId: message.caseId,
          sourceEventId: auditSourceEventId(message, "WORK_ITEM_PROCESSED"),
          actorId: "worker",
          action: "WORK_ITEM_PROCESSED",
          subjectId: message.messageId,
          correlationId: message.correlationId,
          outcome: "SUCCESS",
          payloadReference: message.payloadReference
        });
      });
      return { action: "complete", reason: "WORK_ITEM_PROCESSED" };
    } catch (error) {
      const retryable = isRetryableError(error);
      const exhausted = attempt >= this.config.maxAttempts;
      if (retryable && !exhausted) {
        await this.repository.withCaseTransaction(message.tenantId, message.caseId, async (repository) => {
          const scopedIdempotency =
            typeof repository.bindIdempotencyStore === "function"
              ? repository.bindIdempotencyStore(this.idempotencyStore)
              : this.idempotencyStore;
          await repository.markWorkItemStatus(
            message.tenantId,
            message.caseId,
            message.messageId,
            "QUEUED",
            attempt
          );
          await scopedIdempotency.fail({
            scopedKey,
            tenantId: message.tenantId,
            caseId: message.caseId,
            subjectId: "worker",
            operationId: message.operation,
            fingerprint,
            claimId
          });
        });
        return { action: "abandon", reason: "RETRYABLE_FAILURE" };
      }
      await this.repository.withCaseTransaction(message.tenantId, message.caseId, async (repository) => {
        const scopedIdempotency =
          typeof repository.bindIdempotencyStore === "function"
            ? repository.bindIdempotencyStore(this.idempotencyStore)
            : this.idempotencyStore;
        await repository.markWorkItemStatus(
          message.tenantId,
          message.caseId,
          message.messageId,
          "DEAD_LETTER",
          attempt
        );
        await repository.appendAuditEvent({
          tenantId: message.tenantId,
          caseId: message.caseId,
          sourceEventId: auditSourceEventId(message, "WORK_ITEM_DEAD_LETTER"),
          actorId: "worker",
          action: "WORK_ITEM_DEAD_LETTER",
          subjectId: message.messageId,
          correlationId: message.correlationId,
          outcome: "FAILURE",
          payloadReference: message.payloadReference
        });
        await scopedIdempotency.fail({
          scopedKey,
          tenantId: message.tenantId,
          caseId: message.caseId,
          subjectId: "worker",
          operationId: message.operation,
          fingerprint,
          claimId
        });
      });
      return { action: "deadLetter", reason: "WORK_ITEM_FAILED" };
    }
  }
}
