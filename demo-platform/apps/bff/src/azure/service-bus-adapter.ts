import { ServiceBusClient } from "@azure/service-bus";
import {
  createRedactedLogger,
  type RedactedLogger
} from "../telemetry/redacted-logger.js";
import { createManagedIdentityCredential } from "./managed-identity.js";

interface ServiceBusSenderLike {
  sendMessages(message: {
    body: unknown;
    messageId: string;
    correlationId: string;
    sessionId: string;
    subject?: string;
    applicationProperties?: Record<string, unknown>;
  }): Promise<void>;
}

interface CreateServiceBusAdapterOptions {
  readonly namespace: string;
  readonly queueName: string;
  readonly managedIdentityClientId?: string;
  readonly sender?: ServiceBusSenderLike;
  readonly logger?: RedactedLogger;
}

export function createServiceBusAdapter(options: CreateServiceBusAdapterOptions) {
  const logger = options.logger ?? createRedactedLogger().child({ adapter: "service-bus" });
  const sender =
    options.sender ??
    createManagedIdentitySender({
      namespace: options.namespace,
      queueName: options.queueName,
      ...(options.managedIdentityClientId
        ? { managedIdentityClientId: options.managedIdentityClientId }
        : {})
    });

  return {
    async publish(input: {
      tenantId: string;
      caseId: string;
      messageId: string;
      correlationId: string;
      subject?: string;
      payload: unknown;
    }): Promise<void> {
      const sessionId = `${input.tenantId}:${input.caseId}`;
      const payloadSummary = summarizePayload(input.payload);

      logger.info("azure.servicebus.publish", {
        tenantId: input.tenantId,
        caseId: input.caseId,
        messageId: input.messageId,
        correlationId: input.correlationId,
        sessionId,
        subject: input.subject,
        ...payloadSummary
      });

      await sender.sendMessages({
        body: input.payload,
        messageId: input.messageId,
        correlationId: input.correlationId,
        sessionId,
        ...(input.subject ? { subject: input.subject } : {}),
        applicationProperties: {
          tenantId: input.tenantId,
          caseId: input.caseId
        }
      });
    }
  };
}

function summarizePayload(payload: unknown): {
  payloadKind: "array" | "binary" | "boolean" | "null" | "number" | "object" | "string" | "undefined";
  payloadBytes: number;
  payloadPropertyCount?: number;
  payloadItemCount?: number;
} {
  if (payload === null) {
    return {
      payloadKind: "null",
      payloadBytes: 0
    };
  }

  if (payload === undefined) {
    return {
      payloadKind: "undefined",
      payloadBytes: 0
    };
  }

  if (Buffer.isBuffer(payload)) {
    return {
      payloadKind: "binary",
      payloadBytes: payload.byteLength
    };
  }

  if (Array.isArray(payload)) {
    return {
      payloadKind: "array",
      payloadBytes: estimatePayloadBytes(payload),
      payloadItemCount: payload.length
    };
  }

  if (typeof payload === "object") {
    return {
      payloadKind: "object",
      payloadBytes: estimatePayloadBytes(payload),
      payloadPropertyCount: Object.keys(payload).length
    };
  }

  if (typeof payload === "string") {
    return {
      payloadKind: "string",
      payloadBytes: Buffer.byteLength(payload, "utf8")
    };
  }

  if (typeof payload === "number") {
    return {
      payloadKind: "number",
      payloadBytes: Buffer.byteLength(String(payload), "utf8")
    };
  }

  return {
    payloadKind: "boolean",
    payloadBytes: Buffer.byteLength(String(payload), "utf8")
  };
}

function estimatePayloadBytes(payload: unknown): number {
  try {
    const encoded = JSON.stringify(payload);
    return encoded ? Buffer.byteLength(encoded, "utf8") : 0;
  } catch {
    return 0;
  }
}

function createManagedIdentitySender(options: {
  namespace: string;
  queueName: string;
  managedIdentityClientId?: string;
}): ServiceBusSenderLike {
  const client = new ServiceBusClient(
    options.namespace,
    createManagedIdentityCredential(options.managedIdentityClientId)
  );

  return client.createSender(options.queueName);
}
