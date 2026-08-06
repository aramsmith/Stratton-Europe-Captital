import { DefaultAzureCredential } from "@azure/identity";
import {
  ServiceBusClient,
  type ServiceBusReceivedMessage,
  type ServiceBusReceiver,
  type ServiceBusSender
} from "@azure/service-bus";
import type {
  ApprovedQueueName,
  QueueEnvelope,
  QueueMessage,
  QueueProducer,
  QueueReceiver
} from "./types.js";

const approvedQueueNames: readonly ApprovedQueueName[] = [
  "q-ingestion",
  "q-extraction",
  "q-analysis",
  "q-indexing",
  "q-audit-export"
] as const;

function asRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`INVALID_QUEUE_MESSAGE:${key}`);
  }
  return value.trim();
}

function parseQueueName(value: string): ApprovedQueueName {
  if (approvedQueueNames.includes(value as ApprovedQueueName)) {
    return value as ApprovedQueueName;
  }
  throw new Error("INVALID_QUEUE_MESSAGE:queueName");
}

function parseOperation(value: string): QueueMessage["operation"] {
  if (
    value === "REQUEST_INGESTION" ||
    value === "REQUEST_EXTRACTION" ||
    value === "REQUEST_ANALYSIS" ||
    value === "REQUEST_INDEXING" ||
    value === "EXPORT_AUDIT_EVIDENCE"
  ) {
    return value;
  }
  throw new Error("INVALID_QUEUE_MESSAGE:operation");
}

function parseQueueMessage(value: unknown): QueueMessage {
  if (!asRecord(value)) {
    throw new Error("INVALID_QUEUE_MESSAGE");
  }
  const queueName = parseQueueName(requiredString(value.queueName, "queueName"));
  return {
    messageId: requiredString(value.messageId, "messageId"),
    tenantId: requiredString(value.tenantId, "tenantId"),
    caseId: requiredString(value.caseId, "caseId"),
    queueName,
    operation: parseOperation(requiredString(value.operation, "operation")),
    payloadReference: requiredString(value.payloadReference, "payloadReference"),
    idempotencyKey: requiredString(value.idempotencyKey, "idempotencyKey"),
    correlationId: requiredString(value.correlationId, "correlationId"),
    ...(typeof value.analysisRunId === "string" ? { analysisRunId: value.analysisRunId } : {}),
    ...(typeof value.sourceId === "string" ? { sourceId: value.sourceId } : {}),
    ...(typeof value.evidenceId === "string" ? { evidenceId: value.evidenceId } : {}),
    ...(typeof value.evidenceVersionId === "string"
      ? { evidenceVersionId: value.evidenceVersionId }
      : {})
  };
}

class AzureServiceBusEnvelope implements QueueEnvelope {
  public readonly message: QueueMessage;

  public constructor(
    private readonly raw: ServiceBusReceivedMessage,
    private readonly receiver: ServiceBusReceiver
  ) {
    this.message = parseQueueMessage(raw.body);
    if (typeof raw.deliveryCount === "number" && raw.deliveryCount > 0) {
      this.message = { ...this.message, deliveryCount: raw.deliveryCount };
    }
  }

  public async complete(): Promise<void> {
    await this.receiver.completeMessage(this.raw);
  }

  public async abandon(reason: string): Promise<void> {
    await this.receiver.abandonMessage(this.raw, { reason });
  }

  public async deadLetter(reason: string): Promise<void> {
    await this.receiver.deadLetterMessage(this.raw, {
      deadLetterReason: reason,
      deadLetterErrorDescription: reason
    });
  }
}

export class AzureQueueRoutingProducer implements QueueProducer {
  public constructor(private readonly senders: Readonly<Partial<Record<ApprovedQueueName, ServiceBusSender>>>) {}

  public async send(message: QueueMessage): Promise<void> {
    const sender = this.senders[message.queueName];
    if (!sender) {
      throw new Error("QUEUE_SENDER_NOT_CONFIGURED");
    }
    await sender.sendMessages({
      body: message,
      messageId: message.messageId
    });
  }

  public async isAvailable(): Promise<boolean> {
    try {
      for (const sender of Object.values(this.senders)) {
        if (!sender) {
          continue;
        }
        await sender.createMessageBatch();
      }
      return true;
    } catch {
      return false;
    }
  }
}

export class AzureServiceBusQueueReceiver implements QueueReceiver {
  public constructor(private readonly receiver: ServiceBusReceiver) {}

  public async receiveOne(maxWaitMs: number): Promise<QueueEnvelope | undefined> {
    const messages = await this.receiver.receiveMessages(1, { maxWaitTimeInMs: maxWaitMs });
    const first = messages[0];
    if (!first) {
      return undefined;
    }
    try {
      return new AzureServiceBusEnvelope(first, this.receiver);
    } catch {
      await this.receiver.deadLetterMessage(first, {
        deadLetterReason: "INVALID_QUEUE_MESSAGE",
        deadLetterErrorDescription: "INVALID_QUEUE_MESSAGE"
      });
      return undefined;
    }
  }

  public async isAvailable(): Promise<boolean> {
    try {
      await this.receiver.peekMessages(1);
      return true;
    } catch {
      return false;
    }
  }
}

export class AzureServiceBusFactory {
  public static async connectRouting(
    fullyQualifiedNamespace: string,
    queueNames: readonly ApprovedQueueName[] = approvedQueueNames
  ): Promise<{
    producer: QueueProducer;
    createReceiver: (queueName: ApprovedQueueName) => QueueReceiver;
    close: () => Promise<void>;
  }> {
    const credential = new DefaultAzureCredential();
    const client = new ServiceBusClient(fullyQualifiedNamespace, credential);
    const senders: Partial<Record<ApprovedQueueName, ServiceBusSender>> = {};
    for (const queueName of queueNames) {
      senders[queueName] = client.createSender(queueName);
    }
    return {
      producer: new AzureQueueRoutingProducer(senders),
      createReceiver: (queueName: ApprovedQueueName) =>
        new AzureServiceBusQueueReceiver(client.createReceiver(queueName)),
      close: async () => client.close()
    };
  }

  public static async connectSender(
    fullyQualifiedNamespace: string,
    queueNames: readonly ApprovedQueueName[]
  ): Promise<{
    producer: QueueProducer;
    close: () => Promise<void>;
  }> {
    const credential = new DefaultAzureCredential();
    const client = new ServiceBusClient(fullyQualifiedNamespace, credential);
    const senders: Partial<Record<ApprovedQueueName, ServiceBusSender>> = {};
    for (const queueName of queueNames) {
      senders[queueName] = client.createSender(queueName);
    }
    return {
      producer: new AzureQueueRoutingProducer(senders),
      close: async () => client.close()
    };
  }

  public static async connectReceiver(
    fullyQualifiedNamespace: string,
    queueName: ApprovedQueueName
  ): Promise<{
    receiver: QueueReceiver;
    close: () => Promise<void>;
  }> {
    const credential = new DefaultAzureCredential();
    const client = new ServiceBusClient(fullyQualifiedNamespace, credential);
    return {
      receiver: new AzureServiceBusQueueReceiver(client.createReceiver(queueName)),
      close: async () => client.close()
    };
  }
}

export class InMemoryQueueRouter implements QueueProducer {
  private readonly messagesByQueue = new Map<ApprovedQueueName, QueueMessage[]>();

  public async send(message: QueueMessage): Promise<void> {
    const existing = this.messagesByQueue.get(message.queueName) ?? [];
    this.messagesByQueue.set(message.queueName, [...existing, { ...message }]);
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public forQueue(queueName: ApprovedQueueName): InMemoryQueueReceiver {
    return new InMemoryQueueReceiver(this.messagesByQueue, queueName);
  }
}

export class InMemoryQueueReceiver implements QueueReceiver {
  public constructor(
    private readonly messagesByQueue: Map<ApprovedQueueName, QueueMessage[]>,
    private readonly queueName: ApprovedQueueName
  ) {}

  public async receiveOne(_maxWaitMs: number): Promise<QueueEnvelope | undefined> {
    const existing = this.messagesByQueue.get(this.queueName) ?? [];
    const [next, ...rest] = existing;
    if (!next) {
      return undefined;
    }
    this.messagesByQueue.set(this.queueName, rest);
    return {
      message: next,
      complete: async () => undefined,
      abandon: async (_reason: string) => {
        const current = this.messagesByQueue.get(this.queueName) ?? [];
        this.messagesByQueue.set(this.queueName, [...current, next]);
      },
      deadLetter: async (_reason: string) => undefined
    };
  }

  public async isAvailable(): Promise<boolean> {
    return true;
  }
}
