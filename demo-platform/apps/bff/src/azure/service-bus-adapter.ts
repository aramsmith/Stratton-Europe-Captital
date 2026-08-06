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

      logger.info("azure.servicebus.publish", {
        tenantId: input.tenantId,
        caseId: input.caseId,
        messageId: input.messageId,
        correlationId: input.correlationId,
        subject: input.subject,
        payload: input.payload
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
