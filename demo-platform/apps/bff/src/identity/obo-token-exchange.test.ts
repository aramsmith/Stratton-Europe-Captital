import { describe, expect, it, vi } from "vitest";
import {
  createManagedIdentityApplicationTokenProvider,
  createOboTokenExchange,
  type FederatedAssertionCredential
} from "./obo-token-exchange.js";

function credential(): FederatedAssertionCredential {
  return {
    getToken: vi.fn().mockResolvedValue({
      token: "managed-identity-federated-token",
      expiresOnTimestamp: 1_900_000_000_000
    })
  };
}

function successfulResponse() {
  return new Response(
    JSON.stringify({
      access_token: "phase5-delegated-token",
      expires_in: 3600,
      token_type: "Bearer"
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

describe("createOboTokenExchange", () => {
  it("exchanges the delegated assertion using a managed-identity federated client assertion", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(successfulResponse());
    const managedIdentityCredential = credential();
    const exchange = createOboTokenExchange({
      tokenEndpoint: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
      phase5DelegatedScope: "api://phase5/access_as_user",
      clientId: "44444444-4444-4444-4444-444444444444",
      managedIdentityCredential,
      fetch: fetchImpl
    });

    await expect(exchange.acquirePhase5Token("incoming-user-token")).resolves.toBe(
      "phase5-delegated-token"
    );

    expect(managedIdentityCredential.getToken).toHaveBeenCalledWith(
      "api://AzureADTokenExchange/.default"
    );
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json"
    });
    expect(new URLSearchParams(init?.body)).toEqual(
      new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        requested_token_use: "on_behalf_of",
        assertion: "incoming-user-token",
        scope: "api://phase5/access_as_user",
        client_id: "44444444-4444-4444-4444-444444444444",
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: "managed-identity-federated-token"
      })
    );
  });

  it("does not retain a failed user assertion exchange", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("failure", { status: 500 }))
      .mockResolvedValueOnce(successfulResponse());
    const exchange = createOboTokenExchange({
      tokenEndpoint: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
      phase5DelegatedScope: "api://phase5/access_as_user",
      clientId: "44444444-4444-4444-4444-444444444444",
      managedIdentityCredential: credential(),
      fetch: fetchImpl
    });

    await expect(exchange.acquirePhase5Token("incoming-user-token")).rejects.toMatchObject({
      status: 503,
      code: "DEPENDENCY_UNAVAILABLE"
    });
    await expect(exchange.acquirePhase5Token("incoming-user-token")).resolves.toBe(
      "phase5-delegated-token"
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("classifies managed identity assertion failures", async () => {
    const credentialError = Object.assign(new Error("credential unavailable"), {
      cause: { code: "CredentialUnavailableError" }
    });
    const exchange = createOboTokenExchange({
      tokenEndpoint: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
      phase5DelegatedScope: "api://phase5/access_as_user",
      clientId: "44444444-4444-4444-4444-444444444444",
      managedIdentityCredential: {
        getToken: vi.fn().mockRejectedValue(credentialError)
      },
      fetch: vi.fn<typeof fetch>()
    });

    await expect(
      exchange.acquirePhase5Token("incoming-user-token")
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message:
        "MANAGED_IDENTITY_FEDERATED_ASSERTION_FAILED:Error:CredentialUnavailableError"
    });
  });

  it("rejects client-secret input without exposing secret or assertion values", async () => {
    const incomingAssertion = "incoming-user-assertion-must-not-leak";
    const clientSecret = "client-secret-must-not-leak";
    const federatedAssertion = "federated-assertion-must-not-leak";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      let thrown: unknown;
      try {
        createOboTokenExchange({
          tokenEndpoint: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
          phase5DelegatedScope: "api://phase5/access_as_user",
          clientId: "44444444-4444-4444-4444-444444444444",
          managedIdentityCredential: {
            getToken: vi.fn().mockResolvedValue({
              token: federatedAssertion,
              expiresOnTimestamp: 1_900_000_000_000
            })
          },
          clientSecret
        } as unknown as Parameters<typeof createOboTokenExchange>[0]);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({ message: "CLIENT_SECRET_NOT_SUPPORTED" });
      const output = thrown instanceof Error ? thrown.message : String(thrown);
      expect(output).not.toContain(clientSecret);
      expect(output).not.toContain(incomingAssertion);
      expect(output).not.toContain(federatedAssertion);
    } finally {
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    }
  });

  it("evicts the least recently used completed exchange when the bounded cache is full", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(successfulResponse())
      .mockResolvedValueOnce(successfulResponse())
      .mockResolvedValueOnce(successfulResponse())
      .mockResolvedValueOnce(successfulResponse());
    const exchange = createOboTokenExchange({
      tokenEndpoint: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
      phase5DelegatedScope: "api://phase5/access_as_user",
      clientId: "44444444-4444-4444-4444-444444444444",
      managedIdentityCredential: credential(),
      fetch: fetchImpl,
      cacheCapacity: 2
    });

    await exchange.acquirePhase5Token("assertion-a");
    await exchange.acquirePhase5Token("assertion-b");
    await exchange.acquirePhase5Token("assertion-a");
    await exchange.acquirePhase5Token("assertion-c");
    await exchange.acquirePhase5Token("assertion-b");

    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("sweeps expired entries before cache capacity evicts a live exchange", async () => {
    let currentTime = 0;
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "short-lived-token", expires_in: 61, token_type: "Bearer" }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(successfulResponse())
      .mockResolvedValueOnce(successfulResponse());
    const exchange = createOboTokenExchange({
      tokenEndpoint: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
      phase5DelegatedScope: "api://phase5/access_as_user",
      clientId: "44444444-4444-4444-4444-444444444444",
      managedIdentityCredential: credential(),
      fetch: fetchImpl,
      now: () => currentTime,
      cacheCapacity: 2
    });

    await exchange.acquirePhase5Token("assertion-a");
    await exchange.acquirePhase5Token("assertion-b");
    currentTime = 500;
    await exchange.acquirePhase5Token("assertion-a");
    currentTime = 1_001;
    await exchange.acquirePhase5Token("assertion-c");
    await exchange.acquirePhase5Token("assertion-b");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("shares a single in-flight exchange for the same assertion", async () => {
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveResponse = resolve;
        })
    );
    const exchange = createOboTokenExchange({
      tokenEndpoint: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
      phase5DelegatedScope: "api://phase5/access_as_user",
      clientId: "44444444-4444-4444-4444-444444444444",
      managedIdentityCredential: credential(),
      fetch: fetchImpl,
      cacheCapacity: 2
    });

    const first = exchange.acquirePhase5Token("incoming-user-token");
    const second = exchange.acquirePhase5Token("incoming-user-token");
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    resolveResponse?.(successfulResponse());

    await expect(Promise.all([first, second])).resolves.toEqual([
      "phase5-delegated-token",
      "phase5-delegated-token"
    ]);
  });

  it("does not expose either assertion when the token endpoint rejects the exchange", async () => {
    const incomingAssertion = "incoming-user-assertion-must-not-leak";
    const federatedAssertion = "federated-assertion-must-not-leak";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const exchange = createOboTokenExchange({
      tokenEndpoint: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
      phase5DelegatedScope: "api://phase5/access_as_user",
      clientId: "44444444-4444-4444-4444-444444444444",
      managedIdentityCredential: {
        getToken: vi.fn().mockResolvedValue({
          token: federatedAssertion,
          expiresOnTimestamp: 1_900_000_000_000
        })
      },
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("untrusted upstream body", { status: 500 }))
    });

    try {
      let thrown: unknown;
      try {
        await exchange.acquirePhase5Token(incomingAssertion);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toMatchObject({ message: "OBO_TOKEN_EXCHANGE_REJECTED" });
      const output = thrown instanceof Error ? thrown.message : String(thrown);
      expect(output).not.toContain(incomingAssertion);
      expect(output).not.toContain(federatedAssertion);
    } finally {
      expect(consoleError).not.toHaveBeenCalled();
      consoleError.mockRestore();
    }
  });
});

describe("createManagedIdentityApplicationTokenProvider", () => {
  it("acquires the completion token from managed identity without a client secret", async () => {
    const managedIdentityCredential = credential();
    const getApplicationToken = createManagedIdentityApplicationTokenProvider({
      phase5ApplicationId: "phase5-application-id",
      managedIdentityCredential
    });

    await expect(getApplicationToken()).resolves.toBe("managed-identity-federated-token");
    expect(managedIdentityCredential.getToken).toHaveBeenCalledWith(
      "api://phase5-application-id/.default"
    );
  });
});
