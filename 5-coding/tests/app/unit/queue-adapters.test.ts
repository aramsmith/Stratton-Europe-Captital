import assert from "node:assert/strict";
import { test } from "node:test";
import { AzureServiceBusQueueReceiver } from "../../../app/src/queue-adapters.js";

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
