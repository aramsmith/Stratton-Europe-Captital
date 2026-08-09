import { describe, expect, it, vi } from "vitest";
import type { AzureDemoConfig } from "./azure-config.js";
import { resolveAuthoritativeRoutes } from "./route-authority.js";

const resourceId =
  "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-terra";

function config(): AzureDemoConfig {
  const route = (name: string, region: string, deploymentId: string) => ({
    endpoint: `https://stratton-${name.toLowerCase()}.openai.azure.com`,
    resourceId: resourceId.replace("stratton-terra", `stratton-${name.toLowerCase()}`),
    region,
    deploymentId,
    apiVersion: "2025-01-01-preview",
    evidenceId: `SEC-EVID-${name}-ROUTE-v1`
  });
  const luna = route("LUNA", "swedencentral", "luna-evidence-triage");
  const terra = route("TERRA", "westeurope", "terra-grounded-analysis");
  const sol = route("SOL", "francecentral", "sol-thesis-challenge");
  return {
    DEMO_TENANT_ID: "tenant-stratton-demo",
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: "https://docint.cognitiveservices.azure.com",
    AZURE_SEARCH_ENDPOINT: "https://search.search.windows.net",
    AZURE_SEARCH_INDEX_NAME: "governed-evidence",
    AZURE_BLOB_ACCOUNT_URL: "https://storage.blob.core.windows.net",
    AZURE_BLOB_CONTAINER_NAME: "admitted-evidence",
    AZURE_SERVICE_BUS_NAMESPACE: "stratton.servicebus.windows.net",
    AZURE_SERVICE_BUS_QUEUE_NAME: "analysis-work",
    AZURE_OPENAI_LUNA_ENDPOINT: luna.endpoint,
    AZURE_OPENAI_LUNA_RESOURCE_ID: luna.resourceId,
    AZURE_OPENAI_LUNA_REGION: luna.region,
    AZURE_OPENAI_LUNA_DEPLOYMENT_ID: luna.deploymentId,
    AZURE_OPENAI_LUNA_API_VERSION: luna.apiVersion,
    AZURE_OPENAI_LUNA_EVIDENCE_ID: luna.evidenceId,
    AZURE_OPENAI_TERRA_ENDPOINT: terra.endpoint,
    AZURE_OPENAI_TERRA_RESOURCE_ID: terra.resourceId,
    AZURE_OPENAI_TERRA_REGION: terra.region,
    AZURE_OPENAI_TERRA_DEPLOYMENT_ID: terra.deploymentId,
    AZURE_OPENAI_TERRA_API_VERSION: terra.apiVersion,
    AZURE_OPENAI_TERRA_EVIDENCE_ID: terra.evidenceId,
    AZURE_OPENAI_SOL_ENDPOINT: sol.endpoint,
    AZURE_OPENAI_SOL_RESOURCE_ID: sol.resourceId,
    AZURE_OPENAI_SOL_REGION: sol.region,
    AZURE_OPENAI_SOL_DEPLOYMENT_ID: sol.deploymentId,
    AZURE_OPENAI_SOL_API_VERSION: sol.apiVersion,
    AZURE_OPENAI_SOL_EVIDENCE_ID: sol.evidenceId
  };
}

function dependencies(overrides: {
  readonly arm?: Partial<Awaited<ReturnType<ReturnType<typeof createDependencies>["arm"]["getAccountDeployment"]>>>;
  readonly evidence?: Partial<Awaited<ReturnType<ReturnType<typeof createDependencies>["authority"]["getModelRouteEvidence"]>>>;
  readonly armError?: Error;
  readonly evidenceError?: Error;
} = {}) {
  return createDependencies(overrides);
}

function createDependencies(overrides: {
  readonly arm?: Record<string, unknown>;
  readonly evidence?: Record<string, unknown>;
  readonly armError?: Error;
  readonly evidenceError?: Error;
} = {}) {
  const arm = {
    getAccountDeployment: vi.fn(async (input: {
      resourceId: string;
      endpoint: string;
      deploymentId: string;
    }) => {
      if (overrides.armError) {
        throw overrides.armError;
      }
      return {
        resourceId: input.resourceId,
        accountName: input.resourceId.split("/").at(-1)!,
        location: input.resourceId.includes("luna")
          ? "swedencentral"
          : input.resourceId.includes("terra")
            ? "westeurope"
            : "francecentral",
        endpoint: input.endpoint,
        deploymentId: input.deploymentId,
        ...overrides.arm
      };
    })
  };
  const authority = {
    getModelRouteEvidence: vi.fn(async (evidenceId: string) => {
      if (overrides.evidenceError) {
        throw overrides.evidenceError;
      }
      const routeMatch = evidenceId.match(/SEC-EVID-(LUNA|TERRA|SOL)-ROUTE-v1/u);
      if (!routeMatch?.[1]) {
        throw new Error("Expected an approved route evidence identifier.");
      }
      const route = routeMatch[1];
      const deploymentId =
        route === "LUNA"
          ? "luna-evidence-triage"
          : route === "TERRA"
            ? "terra-grounded-analysis"
            : "sol-thesis-challenge";
      return {
        evidenceId,
        status: "APPROVED" as const,
        resourceId: resourceId.replace("stratton-terra", `stratton-${route.toLowerCase()}`),
        deploymentId,
        region:
          route === "LUNA" ? "swedencentral" : route === "TERRA" ? "westeurope" : "francecentral",
        route: route as "LUNA" | "TERRA" | "SOL",
        apiVersion: "2025-01-01-preview",
        evidenceVersion: "route-evidence-v1",
        validFromIso: "2026-01-01T00:00:00.000Z",
        validUntilIso: "2027-01-01T00:00:00.000Z",
        ...overrides.evidence
      };
    })
  };
  return { arm, authority };
}

describe("resolveAuthoritativeRoutes", () => {
  it("returns only immutable bindings where ARM and approved Phase 5 evidence exactly agree", async () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
      child: vi.fn()
    };
    const result = await resolveAuthoritativeRoutes({
      config: config(),
      ...dependencies(),
      now: () => new Date("2026-08-09T00:00:00.000Z"),
      logger
    });

    expect(result.TERRA).toEqual({
      route: "TERRA",
      resourceId,
      accountName: "stratton-terra",
      location: "westeurope",
      endpoint: "https://stratton-terra.openai.azure.com",
      deploymentId: "terra-grounded-analysis",
      apiVersion: "2025-01-01-preview",
      evidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      evidenceVersion: "route-evidence-v1"
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.TERRA)).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(3);
    expect(Object.keys(logger.info.mock.calls[0]?.[1] ?? {}).sort()).toEqual([
      "deploymentIdHash",
      "evidenceId",
      "evidenceVersion",
      "location",
      "outcome",
      "resourceIdHash",
      "route"
    ]);
  });

  it.each([
    ["ARM region differs from Phase 5 evidence", { evidence: { region: "northeurope" } }],
    ["ARM endpoint differs from the declared endpoint", { arm: { endpoint: "https://other.openai.azure.com" } }],
    ["Phase 5 evidence is expired", { evidence: { validUntilIso: "2026-08-08T23:59:59.000Z" } }],
    ["Phase 5 evidence is suspended", { evidence: { status: "SUSPENDED" } }],
    ["Phase 5 route or deployment differs", { evidence: { route: "SOL", deploymentId: "wrong-deployment" } }],
    ["Phase 5 account differs", { evidence: { resourceId: resourceId.replace("stratton-terra", "other-account") } }]
  ])("fails closed when %s", async (_reason, overrides) => {
    await expect(
      resolveAuthoritativeRoutes({
        config: config(),
        ...dependencies(overrides),
        now: () => new Date("2026-08-09T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "AUTHORITATIVE_ROUTE_VALIDATION_FAILED"
    });
  });

  it.each([
    ["ARM is unavailable", { armError: new Error("ARM unavailable") }],
    ["Phase 5 is unavailable", { evidenceError: new Error("Phase 5 unavailable") }]
  ])("fails closed when %s", async (_reason, overrides) => {
    await expect(
      resolveAuthoritativeRoutes({
        config: config(),
        ...dependencies(overrides),
        now: () => new Date("2026-08-09T00:00:00.000Z")
      })
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "AUTHORITATIVE_ROUTE_VALIDATION_FAILED"
    });
  });
});
