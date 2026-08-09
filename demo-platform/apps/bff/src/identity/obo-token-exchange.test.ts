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
