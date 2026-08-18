import type { QueueMessage, QueueProducer, WorkloadRepository } from "./types.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonical(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalQueueMessage(message: QueueMessage): string {
  return canonical(message);
}

export function canonicalQueueMessageIdentity(message: QueueMessage): string {
  return canonical(
    Object.fromEntries(
      Object.entries(message).filter(
        ([key]) => key !== "correlationId" && key !== "deliveryCount"
      )
    )
  );
}

function parseQueueMessage(body: string): QueueMessage {
  return JSON.parse(body) as QueueMessage;
}

function retryableDispatchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  if (
    typeof statusCode === "number" &&
    (statusCode === 408 || statusCode === 429 || (statusCode >= 500 && statusCode < 600))
  ) {
    return true;
  }
  const text = error.message.toLowerCase();
  return (
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("etimedout") ||
    text.includes("econnreset") ||
    text.includes("temporarily unavailable") ||
    /\b(?:408|429|5\d{2})\b/.test(text)
  );
}

export class QueueOutboxDispatcher {
  public constructor(
    private readonly repository: WorkloadRepository,
    private readonly queueProducer: QueueProducer
  ) {}

  public async dispatchPending(maxItems: number, tenantId?: string, caseId?: string): Promise<void> {
    const pending = await this.repository.listPendingQueueOutboxMessages(maxItems, tenantId, caseId);
    for (const row of pending) {
      const message = parseQueueMessage(row.canonicalBody);
      try {
        await this.queueProducer.send(message);
        await this.repository.markQueueOutboxMessageDelivered(
          row.tenantId,
          row.caseId,
          row.queueName,
          row.messageId
        );
      } catch (error) {
        const nextAttemptAtIso = new Date(
          Date.now() + (retryableDispatchError(error) ? 5_000 : 60_000)
        ).toISOString();
        await this.repository.markQueueOutboxMessageFailed(
          row.tenantId,
          row.caseId,
          row.queueName,
          row.messageId,
          nextAttemptAtIso,
          error instanceof Error ? error.message.slice(0, 128) : "QUEUE_SEND_FAILED"
        );
      }
    }
  }

  public async dispatchPendingAcrossScopes(maxScopes: number, maxItemsPerScope: number): Promise<void> {
    const scopes = await this.repository.listPendingQueueOutboxScopes(maxScopes);
    for (const scope of scopes) {
      await this.dispatchPending(maxItemsPerScope, scope.tenantId, scope.caseId);
    }
  }
}
