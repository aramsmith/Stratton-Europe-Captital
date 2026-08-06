import { AsyncLocalStorage } from "node:async_hooks";
import type { TrustedIdentity } from "./trusted-identity.js";

export interface TrustedRequestContext {
  readonly identity: TrustedIdentity;
  readonly correlationId: string;
  readonly traceparent?: string;
}

const requestContextStorage = new AsyncLocalStorage<TrustedRequestContext>();

export function runWithTrustedRequestContext<T>(
  context: TrustedRequestContext,
  callback: () => T
): T {
  return requestContextStorage.run(context, callback);
}

export function getTrustedRequestContext(): TrustedRequestContext {
  const context = requestContextStorage.getStore();
  if (!context) {
    throw new Error("TRUSTED_REQUEST_CONTEXT_REQUIRED");
  }
  return context;
}
