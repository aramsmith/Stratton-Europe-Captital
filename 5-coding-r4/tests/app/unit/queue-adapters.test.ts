import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AzureServiceBusFactory,
  AzureServiceBusQueueReceiver
} from "../../../app/src/queue-adapters.js";

test("malformed service-bus message is dead-lettered safely", async () => {
  let deadLettered = false;
  const receiver = {
    async receiveMessages(): Promise<unknown[]> {
      return [{ body: { invalid: true }, deliveryCount: 1 }];
    },
    async deadLetterMessage(): Promise<void> {
      deadLettered = true;
    },
    async peekMessages(): Promise<unknown[]> {
      return [];
    }
  } as never;

  const queueReceiver = new AzureServiceBusQueueReceiver(receiver);
  const envelope = await queueReceiver.receiveOne(1);
  assert.equal(envelope, undefined);
  assert.equal(deadLettered, true);
});

test("service-bus routing uses the configured managed identity client ID", async () => {
  const expectedClientId = "faafcf17-92b4-4f31-8914-028fd726be54";
  let actualClientId: string | undefined;

  const bus = await AzureServiceBusFactory.connectRouting(
    "stratton.servicebus.windows.net",
    [],
    expectedClientId,
    (managedIdentityClientId) => {
      actualClientId = managedIdentityClientId;
      return {
        async getToken() {
          return {
            token: "test-token",
            expiresOnTimestamp: Date.now() + 60_000
          };
        }
      };
    }
  );

  assert.equal(actualClientId, expectedClientId);
  await bus.close();
});
