import { describe, expect, it, vi } from "vitest";
import {
  createArmCognitiveAccountClient,
  type ArmCognitiveAccountClient
} from "./arm-cognitive-account-client.js";

const resourceId =
  "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-terra";
const deploymentId = "terra-grounded-analysis";

function createClient(
  fetchImpl: typeof fetch = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: resourceId,
          name: "stratton-terra",
          type: "Microsoft.CognitiveServices/accounts",
          kind: "OpenAI",
          location: "westeurope",
          properties: { endpoint: "https://stratton-terra.openai.azure.com" }
        }),
        { status: 200 }
      )
    )
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: `${resourceId}/deployments/${deploymentId}`,
          name: deploymentId,
          type: "Microsoft.CognitiveServices/accounts/deployments",
          properties: { model: { format: "OpenAI", name: "gpt-4o", version: "2024-11-20" } }
        }),
        { status: 200 }
      )
    )
): ArmCognitiveAccountClient {
  return createArmCognitiveAccountClient({
    getAccessToken: async () => "arm-access-token",
    fetch: fetchImpl
  });
}

describe("createArmCognitiveAccountClient", () => {
  it("reads the exact account and its declared deployment from ARM", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: resourceId,
            name: "stratton-terra",
            type: "Microsoft.CognitiveServices/accounts",
            kind: "OpenAI",
            location: "westeurope",
            properties: { endpoint: "https://stratton-terra.openai.azure.com" }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: `${resourceId}/deployments/${deploymentId}`,
            name: deploymentId,
            type: "Microsoft.CognitiveServices/accounts/deployments",
            properties: { model: { format: "OpenAI", name: "gpt-4o", version: "2024-11-20" } }
          }),
          { status: 200 }
        )
      );
    const client = createClient(fetchImpl);

    await expect(
      client.getAccountDeployment({
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
        headers: expect.objectContaining({ authorization: "Bearer arm-access-token" })
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      `https://management.azure.com${resourceId}/deployments/${deploymentId}?api-version=2024-10-01`,
      expect.objectContaining({ method: "GET" })
    );
  });

  it("fails closed when ARM does not return the exact configured account", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: resourceId.replace("stratton-terra", "other-account"),
          name: "other-account",
          type: "Microsoft.CognitiveServices/accounts",
          kind: "OpenAI",
          location: "westeurope",
          properties: { endpoint: "https://stratton-terra.openai.azure.com" }
        }),
        { status: 200 }
      )
    );

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
  });
});
