import { describe, expect, it } from "vitest";
import { parseAzureDemoConfig } from "./azure-config.js";

function validEnvironment(): NodeJS.ProcessEnv {
  return {
    DEMO_TENANT_ID: "00000000-0000-0000-0000-000000000123",
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "https://docint.cognitiveservices.azure.com",
    AZURE_SEARCH_ENDPOINT: "https://search.search.windows.net",
    AZURE_SEARCH_INDEX_NAME: "governed-evidence",
    AZURE_BLOB_ACCOUNT_URL: "https://storage.blob.core.windows.net",
    AZURE_BLOB_CONTAINER_NAME: "admitted-evidence",
    AZURE_SERVICE_BUS_NAMESPACE: "stratton.servicebus.windows.net",
    AZURE_SERVICE_BUS_QUEUE_NAME: "analysis-work",
    AZURE_OPENAI_LUNA_ENDPOINT: "https://stratton-luna.openai.azure.com",
    AZURE_OPENAI_LUNA_RESOURCE_ID:
      "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-luna",
    AZURE_OPENAI_LUNA_REGION: "swedencentral",
    AZURE_OPENAI_LUNA_DEPLOYMENT_ID: "luna-evidence-triage",
    AZURE_OPENAI_LUNA_API_VERSION: "2025-01-01-preview",
    AZURE_OPENAI_LUNA_EVIDENCE_ID: "SEC-EVID-LUNA-ROUTE-v1",
    AZURE_OPENAI_LUNA_ROUTE_EVIDENCE_VERSION: "route-evidence-luna-v1",
    AZURE_OPENAI_TERRA_ENDPOINT: "https://stratton-terra.openai.azure.com",
    AZURE_OPENAI_TERRA_RESOURCE_ID:
      "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-terra",
    AZURE_OPENAI_TERRA_REGION: "westeurope",
    AZURE_OPENAI_TERRA_DEPLOYMENT_ID: "terra-grounded-analysis",
    AZURE_OPENAI_TERRA_API_VERSION: "2025-01-01-preview",
    AZURE_OPENAI_TERRA_EVIDENCE_ID: "SEC-EVID-TERRA-ROUTE-v1",
    AZURE_OPENAI_TERRA_ROUTE_EVIDENCE_VERSION: "route-evidence-terra-v1",
    AZURE_OPENAI_SOL_ENDPOINT: "https://stratton-sol.openai.azure.com",
    AZURE_OPENAI_SOL_RESOURCE_ID:
      "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-sol",
    AZURE_OPENAI_SOL_REGION: "francecentral",
    AZURE_OPENAI_SOL_DEPLOYMENT_ID: "sol-thesis-challenge",
    AZURE_OPENAI_SOL_API_VERSION: "2025-01-01-preview",
    AZURE_OPENAI_SOL_EVIDENCE_ID: "SEC-EVID-SOL-ROUTE-v1",
    AZURE_OPENAI_SOL_ROUTE_EVIDENCE_VERSION: "route-evidence-sol-v1"
  };
}

describe("Azure OpenAI route bindings", () => {
  it("accepts HTTPS Azure OpenAI endpoints bound to matching resource IDs and EU regions", () => {
    expect(parseAzureDemoConfig(validEnvironment())).toMatchObject({
      AZURE_OPENAI_LUNA_ENDPOINT: "https://stratton-luna.openai.azure.com",
      AZURE_OPENAI_LUNA_RESOURCE_ID: expect.stringContaining("/accounts/stratton-luna"),
      AZURE_OPENAI_LUNA_REGION: "swedencentral",
      AZURE_OPENAI_LUNA_EVIDENCE_ID: "SEC-EVID-LUNA-ROUTE-v1",
      AZURE_OPENAI_LUNA_ROUTE_EVIDENCE_VERSION: "route-evidence-luna-v1"
    });
  });

  it("rejects a non-GUID Microsoft Entra tenant ID", () => {
    expect(() =>
      parseAzureDemoConfig({
        ...validEnvironment(),
        DEMO_TENANT_ID: "tenant-stratton-demo"
      })
    ).toThrow(/DEMO_TENANT_ID/u);
  });

  it("accepts endpoint and resource ID declarations without treating them as binding authority", () => {
    expect(() =>
      parseAzureDemoConfig({
        ...validEnvironment(),
        AZURE_OPENAI_TERRA_ENDPOINT: "https://different-account.openai.azure.com"
      })
    ).not.toThrow();
  });

  it("accepts syntactically valid route declarations without treating them as authority", () => {
    expect(() =>
      parseAzureDemoConfig({
        ...validEnvironment(),
        AZURE_OPENAI_SOL_REGION: "eastus",
        AZURE_OPENAI_LUNA_EVIDENCE_ID: "unverified-evidence"
      })
    ).not.toThrow();
  });
});
