import { describe, expect, it, vi } from "vitest";
import {
  createArmCognitiveAccountClient,
  type ArmCognitiveAccountClient
} from "./arm-cognitive-account-client.js";

const resourceId =
  "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-terra";
const deploymentId = "terra-grounded-analysis";

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: resourceId,
    name: "stratton-terra",
    type: "Microsoft.CognitiveServices/accounts",
    kind: "OpenAI",
    location: "westeurope",
    properties: { endpoint: "https://stratton-terra.openai.azure.com" },
    ...overrides
  };
}

function deployment(overrides: Record<string, unknown> = {}) {
  return {
    id: `${resourceId}/deployments/${deploymentId}`,
    name: deploymentId,
    type: "Microsoft.CognitiveServices/accounts/deployments",
    properties: { model: { format: "OpenAI", name: "gpt-4o", version: "2024-11-20" } },
    ...overrides
  };
}

function createClient(
  fetchImpl: typeof fetch = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(JSON.stringify(account()), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(deployment()), { status: 200 }))
): ArmCognitiveAccountClient {
  return createArmCognitiveAccountClient({
    getAccessToken: async () => "arm-access-token",
    fetch: fetchImpl
  });
}

async function expectFailure(fetchImpl: typeof fetch): Promise<void> {
  await expect(
    createClient(fetchImpl).getAccountDeployment({
      resourceId,
      endpoint: "https://stratton-terra.openai.azure.com",
      deploymentId
    })
  ).rejects.toMatchObject({
    code: "DEPENDENCY_UNAVAILABLE",
    message: "AUTHORITATIVE_ROUTE_VALIDATION_FAILED"
  });
}

describe("createArmCognitiveAccountClient", () => {
  it("reads the exact account and its declared deployment from ARM", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(account()), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(deployment()), { status: 200 }));

    await expect(
      createClient(fetchImpl).getAccountDeployment({
        resourceId,
        endpoint: "https://stratton-terra.openai.azure.com",
        deploymentId
      })
    ).resolves.toEqual({
      resourceId,
      accountName: "stratton-terra",
      location: "westeurope",
      endpoint: "https://stratton-terra.openai.azure.com",
      deploymentId
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      `https://management.azure.com${resourceId}?api-version=2023-05-01`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ authorization: expect.stringMatching(/^Bearer /u) })
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `https://management.azure.com${resourceId}/deployments/${deploymentId}?api-version=2024-10-01`,
      expect.objectContaining({ method: "GET" })
    );
  });

  it("accepts the exact Azure AI Services account kind approved by the design", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(account({ kind: "AIServices" })), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(deployment()), { status: 200 }));

    await expect(
      createClient(fetchImpl).getAccountDeployment({
        resourceId,
        endpoint: "https://stratton-terra.openai.azure.com",
        deploymentId
      })
    ).resolves.toMatchObject({
      resourceId,
      accountName: "stratton-terra",
      deploymentId
    });
  });

  it("accepts Azure casing differences in returned account and deployment resource IDs", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(account({ id: resourceId.toUpperCase(), name: "STRATTON-TERRA" })),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            deployment({
              id: `${resourceId.toUpperCase()}/DEPLOYMENTS/${deploymentId.toUpperCase()}`,
              name: deploymentId.toUpperCase()
            })
          ),
          { status: 200 }
        )
      );

    await expect(
      createClient(fetchImpl).getAccountDeployment({
        resourceId,
        endpoint: "https://stratton-terra.openai.azure.com",
        deploymentId
      })
    ).resolves.toMatchObject({ resourceId: resourceId.toUpperCase(), deploymentId: deploymentId.toUpperCase() });
  });

  it("rejects account names that could override the ARM api-version query", async () => {
    const maliciousResourceId = resourceId.replace(
      "stratton-terra",
      "stratton-terra?api-version=malicious"
    );
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      createClient(fetchImpl).getAccountDeployment({
        resourceId: maliciousResourceId,
        endpoint: "https://stratton-terra.openai.azure.com",
        deploymentId
      })
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "AUTHORITATIVE_ROUTE_VALIDATION_FAILED"
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    ["the account kind is not OpenAI", account({ kind: "CognitiveServices" }), deployment()],
    ["the account location is missing", account({ location: " " }), deployment()],
    ["the account endpoint differs", account({ properties: { endpoint: "https://other.openai.azure.com" } }), deployment()],
    [
      "the deployment belongs to another account",
      account(),
      deployment({
        id: deployment().id.replace("stratton-terra", "other-account")
      })
    ],
    ["the deployment model metadata is missing", account(), deployment({ properties: {} })]
  ])("fails closed when %s", async (_reason, accountBody, deploymentBody) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify(accountBody), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(deploymentBody), { status: 200 }));

    await expectFailure(fetchImpl);
  });

  it.each([
    ["ARM returns a non-success status", new Response("unavailable", { status: 503 })],
    ["ARM returns a non-JSON response", new Response("not-json", { status: 200 })]
  ])("fails closed when %s", async (_reason, response) => {
    await expectFailure(vi.fn<typeof fetch>().mockResolvedValue(response));
  });
});
