import { createHash } from "node:crypto";
import { createManagedIdentityCredential } from "../azure/managed-identity.js";
import { DemoHttpError } from "../errors.js";

const azureAdTokenExchangeScope = "api://AzureADTokenExchange/.default";
const clientAssertionType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
const onBehalfOfGrantType = "urn:ietf:params:oauth:grant-type:jwt-bearer";
const cacheSafetyWindowMilliseconds = 60_000;
const defaultCacheCapacity = 100;

export interface FederatedAssertionCredential {
  getToken(scope: string): Promise<{ readonly token: string; readonly expiresOnTimestamp: number } | null>;
}

export interface OboTokenExchange {
  acquirePhase5Token(userAssertion: string): Promise<string>;
}

export interface CreateOboTokenExchangeOptions {
  readonly tokenEndpoint: string;
  readonly phase5DelegatedScope: string;
  readonly managedIdentityClientId?: string;
  readonly managedIdentityCredential?: FederatedAssertionCredential;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
  readonly cacheCapacity?: number;
}

export interface CreateManagedIdentityApplicationTokenProviderOptions {
  readonly phase5ApplicationId: string;
  readonly managedIdentityClientId?: string;
  readonly managedIdentityCredential?: FederatedAssertionCredential;
}

interface CachedExchange {
  token?: string;
  expiresAt?: number;
  exchange?: Promise<string>;
}

export function createManagedIdentityApplicationTokenProvider(
  options: CreateManagedIdentityApplicationTokenProviderOptions
): () => Promise<string> {
  const applicationId = requireValue(options.phase5ApplicationId, "PHASE5_APPLICATION_ID");
  const credential =
    options.managedIdentityCredential ??
    createManagedIdentityCredential(options.managedIdentityClientId);

  return async () => {
    const token = await credential.getToken(`api://${applicationId}/.default`);
    if (!token?.token) {
      throw new DemoHttpError(
        503,
        "DEPENDENCY_UNAVAILABLE",
        "PHASE5_APPLICATION_TOKEN_UNAVAILABLE"
      );
    }
    return token.token;
  };
}

export function createOboTokenExchange(options: CreateOboTokenExchangeOptions): OboTokenExchange {
  rejectClientSecretOption(options);
  requireHttpsUrl(options.tokenEndpoint, "ENTRA_TOKEN_ENDPOINT");
  const phase5DelegatedScope = requireValue(options.phase5DelegatedScope, "PHASE5_DELEGATED_SCOPE");
  const fetchImpl = options.fetch ?? fetch;
  const credential =
    options.managedIdentityCredential ??
    createManagedIdentityCredential(options.managedIdentityClientId);
  const cache = new Map<string, CachedExchange>();
  const now = options.now ?? Date.now;
  const cacheCapacity = requireCacheCapacity(options.cacheCapacity ?? defaultCacheCapacity);

  return {
    async acquirePhase5Token(userAssertion) {
      const assertion = requireValue(userAssertion, "USER_ASSERTION");
      const assertionHash = createHash("sha256").update(assertion).digest("hex");
      sweepExpiredEntries(cache, now());
      const cached = cache.get(assertionHash);
      if (cached?.token && cached.expiresAt && cached.expiresAt > now()) {
        touchCacheEntry(cache, assertionHash, cached, cacheCapacity);
        return cached.token;
      }
      if (cached?.exchange) {
        touchCacheEntry(cache, assertionHash, cached, cacheCapacity);
        return cached.exchange;
      }

      const entry: CachedExchange = {};
      const exchange = exchangeToken(
        fetchImpl,
        credential,
        options.tokenEndpoint,
        phase5DelegatedScope,
        assertion,
        now
      ).then((result) => {
        if (cache.get(assertionHash) !== entry) {
          return result.token;
        }
        if (result.expiresAt <= now()) {
          cache.delete(assertionHash);
          return result.token;
        }
        touchCacheEntry(
          cache,
          assertionHash,
          { token: result.token, expiresAt: result.expiresAt },
          cacheCapacity
        );
        return result.token;
      }).catch((error: unknown) => {
        if (cache.get(assertionHash) === entry) {
          cache.delete(assertionHash);
        }
        throw error;
      });
      entry.exchange = exchange;
      touchCacheEntry(cache, assertionHash, entry, cacheCapacity);
      return exchange;
    }
  };
}

function rejectClientSecretOption(options: CreateOboTokenExchangeOptions): void {
  if (Object.keys(options).some((key) => /^client(?:_|-)?secret$/i.test(key))) {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "CLIENT_SECRET_NOT_SUPPORTED");
  }
}

function requireCacheCapacity(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "OBO_TOKEN_CACHE_CAPACITY_INVALID");
  }
  return value;
}

function sweepExpiredEntries(cache: Map<string, CachedExchange>, currentTime: number): void {
  for (const [assertionHash, entry] of cache) {
    if (entry.token && (!entry.expiresAt || entry.expiresAt <= currentTime)) {
      cache.delete(assertionHash);
    }
  }
}

function touchCacheEntry(
  cache: Map<string, CachedExchange>,
  assertionHash: string,
  entry: CachedExchange,
  cacheCapacity: number
): void {
  cache.delete(assertionHash);
  cache.set(assertionHash, entry);
  while (cache.size > cacheCapacity) {
    const leastRecentlyUsed = cache.keys().next().value;
    if (leastRecentlyUsed === undefined) {
      return;
    }
    cache.delete(leastRecentlyUsed);
  }
}

async function exchangeToken(
  fetchImpl: typeof fetch,
  credential: FederatedAssertionCredential,
  tokenEndpoint: string,
  phase5DelegatedScope: string,
  userAssertion: string,
  now: () => number
): Promise<{ readonly token: string; readonly expiresAt: number }> {
  const federatedToken = await credential.getToken(azureAdTokenExchangeScope);
  if (!federatedToken?.token) {
    throw new DemoHttpError(
      503,
      "DEPENDENCY_UNAVAILABLE",
      "MANAGED_IDENTITY_FEDERATED_ASSERTION_UNAVAILABLE"
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(tokenEndpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json"
      },
      body: new URLSearchParams({
        grant_type: onBehalfOfGrantType,
        requested_token_use: "on_behalf_of",
        assertion: userAssertion,
        scope: phase5DelegatedScope,
        client_assertion_type: clientAssertionType,
        client_assertion: federatedToken.token
      })
    });
  } catch {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "OBO_TOKEN_EXCHANGE_UNAVAILABLE");
  }

  if (!response.ok) {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "OBO_TOKEN_EXCHANGE_REJECTED");
  }

  const payload = await parseTokenResponse(response);
  return {
    token: payload.accessToken,
    expiresAt: now() + Math.max(0, payload.expiresIn * 1_000 - cacheSafetyWindowMilliseconds)
  };
}

async function parseTokenResponse(response: Response): Promise<{
  readonly accessToken: string;
  readonly expiresIn: number;
}> {
  try {
    const payload = await response.json() as { access_token?: unknown; expires_in?: unknown };
    if (
      typeof payload.access_token !== "string" ||
      payload.access_token.trim().length === 0 ||
      typeof payload.expires_in !== "number" ||
      !Number.isFinite(payload.expires_in) ||
      payload.expires_in <= 0
    ) {
      throw new Error("invalid token response");
    }
    return { accessToken: payload.access_token, expiresIn: payload.expires_in };
  } catch {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", "OBO_TOKEN_RESPONSE_INVALID");
  }
}

function requireHttpsUrl(value: string, name: string): void {
  try {
    if (new URL(value).protocol !== "https:") {
      throw new Error("non-https");
    }
  } catch {
    throw new DemoHttpError(503, "DEPENDENCY_UNAVAILABLE", `CONFIGURATION_REQUIRED:${name}`);
  }
}

function requireValue(value: string, name: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new DemoHttpError(401, "UNAUTHENTICATED", `${name}_REQUIRED`);
  }
  return trimmed;
}
