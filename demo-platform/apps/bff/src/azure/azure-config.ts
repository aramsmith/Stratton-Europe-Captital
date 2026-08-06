import type { ModelRoute } from "@stratton/contracts";
import { z } from "zod";
import type { ApprovedDeployment } from "./openai-analysis-adapter.js";

const azureDemoConfigSchema = z
  .object({
    DEMO_TENANT_ID: z.string().trim().min(1),
    AZURE_MANAGED_IDENTITY_CLIENT_ID: z.string().trim().min(1).optional(),
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: z.string().url(),
    AZURE_SEARCH_ENDPOINT: z.string().url(),
    AZURE_SEARCH_INDEX_NAME: z.string().trim().min(1),
    AZURE_BLOB_ACCOUNT_URL: z.string().url(),
    AZURE_BLOB_CONTAINER_NAME: z.string().trim().min(1),
    AZURE_SERVICE_BUS_NAMESPACE: z.string().trim().min(1),
    AZURE_SERVICE_BUS_QUEUE_NAME: z.string().trim().min(1),
    AZURE_OPENAI_LUNA_ENDPOINT: z.string().url(),
    AZURE_OPENAI_LUNA_RESOURCE_ID: z.string().trim().min(1),
    AZURE_OPENAI_LUNA_REGION: z.string().trim().min(1),
    AZURE_OPENAI_LUNA_DEPLOYMENT_ID: z.string().trim().min(1),
    AZURE_OPENAI_LUNA_API_VERSION: z.string().trim().min(1),
    AZURE_OPENAI_LUNA_EVIDENCE_ID: z.string().trim().min(1),
    AZURE_OPENAI_TERRA_ENDPOINT: z.string().url(),
    AZURE_OPENAI_TERRA_RESOURCE_ID: z.string().trim().min(1),
    AZURE_OPENAI_TERRA_REGION: z.string().trim().min(1),
    AZURE_OPENAI_TERRA_DEPLOYMENT_ID: z.string().trim().min(1),
    AZURE_OPENAI_TERRA_API_VERSION: z.string().trim().min(1),
    AZURE_OPENAI_TERRA_EVIDENCE_ID: z.string().trim().min(1),
    AZURE_OPENAI_SOL_ENDPOINT: z.string().url(),
    AZURE_OPENAI_SOL_RESOURCE_ID: z.string().trim().min(1),
    AZURE_OPENAI_SOL_REGION: z.string().trim().min(1),
    AZURE_OPENAI_SOL_DEPLOYMENT_ID: z.string().trim().min(1),
    AZURE_OPENAI_SOL_API_VERSION: z.string().trim().min(1),
    AZURE_OPENAI_SOL_EVIDENCE_ID: z.string().trim().min(1)
  })
  .strict()
  .superRefine((config, context) => {
    validateRouteBinding("LUNA", {
      endpoint: config.AZURE_OPENAI_LUNA_ENDPOINT,
      resourceId: config.AZURE_OPENAI_LUNA_RESOURCE_ID,
      region: config.AZURE_OPENAI_LUNA_REGION,
      evidenceId: config.AZURE_OPENAI_LUNA_EVIDENCE_ID
    }, context);
    validateRouteBinding("TERRA", {
      endpoint: config.AZURE_OPENAI_TERRA_ENDPOINT,
      resourceId: config.AZURE_OPENAI_TERRA_RESOURCE_ID,
      region: config.AZURE_OPENAI_TERRA_REGION,
      evidenceId: config.AZURE_OPENAI_TERRA_EVIDENCE_ID
    }, context);
    validateRouteBinding("SOL", {
      endpoint: config.AZURE_OPENAI_SOL_ENDPOINT,
      resourceId: config.AZURE_OPENAI_SOL_RESOURCE_ID,
      region: config.AZURE_OPENAI_SOL_REGION,
      evidenceId: config.AZURE_OPENAI_SOL_EVIDENCE_ID
    }, context);
  });

export type AzureDemoConfig = z.infer<typeof azureDemoConfigSchema>;

const azureDemoConfigKeys = [
  "DEMO_TENANT_ID",
  "AZURE_MANAGED_IDENTITY_CLIENT_ID",
  "AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT",
  "AZURE_SEARCH_ENDPOINT",
  "AZURE_SEARCH_INDEX_NAME",
  "AZURE_BLOB_ACCOUNT_URL",
  "AZURE_BLOB_CONTAINER_NAME",
  "AZURE_SERVICE_BUS_NAMESPACE",
  "AZURE_SERVICE_BUS_QUEUE_NAME",
  "AZURE_OPENAI_LUNA_ENDPOINT",
  "AZURE_OPENAI_LUNA_RESOURCE_ID",
  "AZURE_OPENAI_LUNA_REGION",
  "AZURE_OPENAI_LUNA_DEPLOYMENT_ID",
  "AZURE_OPENAI_LUNA_API_VERSION",
  "AZURE_OPENAI_LUNA_EVIDENCE_ID",
  "AZURE_OPENAI_TERRA_ENDPOINT",
  "AZURE_OPENAI_TERRA_RESOURCE_ID",
  "AZURE_OPENAI_TERRA_REGION",
  "AZURE_OPENAI_TERRA_DEPLOYMENT_ID",
  "AZURE_OPENAI_TERRA_API_VERSION",
  "AZURE_OPENAI_TERRA_EVIDENCE_ID",
  "AZURE_OPENAI_SOL_ENDPOINT",
  "AZURE_OPENAI_SOL_RESOURCE_ID",
  "AZURE_OPENAI_SOL_REGION",
  "AZURE_OPENAI_SOL_DEPLOYMENT_ID",
  "AZURE_OPENAI_SOL_API_VERSION",
  "AZURE_OPENAI_SOL_EVIDENCE_ID"
] as const satisfies readonly (keyof AzureDemoConfig)[];

export function parseAzureDemoConfig(
  environment: NodeJS.ProcessEnv = process.env
): AzureDemoConfig {
  const approvedEnvironment = Object.fromEntries(
    azureDemoConfigKeys.flatMap((key) => {
      const value = environment[key];
      return value === undefined ? [] : [[key, value]];
    })
  );

  return azureDemoConfigSchema.parse(approvedEnvironment);
}

export function buildApprovedDeployments(
  config: AzureDemoConfig
): Readonly<Record<ModelRoute, ApprovedDeployment>> {
  return {
    LUNA: {
      endpoint: config.AZURE_OPENAI_LUNA_ENDPOINT,
      resourceId: config.AZURE_OPENAI_LUNA_RESOURCE_ID,
      region: config.AZURE_OPENAI_LUNA_REGION,
      deploymentId: config.AZURE_OPENAI_LUNA_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_LUNA_API_VERSION,
      evidenceId: config.AZURE_OPENAI_LUNA_EVIDENCE_ID,
      geography: "EU_DATA_ZONE"
    },
    TERRA: {
      endpoint: config.AZURE_OPENAI_TERRA_ENDPOINT,
      resourceId: config.AZURE_OPENAI_TERRA_RESOURCE_ID,
      region: config.AZURE_OPENAI_TERRA_REGION,
      deploymentId: config.AZURE_OPENAI_TERRA_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_TERRA_API_VERSION,
      evidenceId: config.AZURE_OPENAI_TERRA_EVIDENCE_ID,
      geography: "EU_DATA_ZONE"
    },
    SOL: {
      endpoint: config.AZURE_OPENAI_SOL_ENDPOINT,
      resourceId: config.AZURE_OPENAI_SOL_RESOURCE_ID,
      region: config.AZURE_OPENAI_SOL_REGION,
      deploymentId: config.AZURE_OPENAI_SOL_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_SOL_API_VERSION,
      evidenceId: config.AZURE_OPENAI_SOL_EVIDENCE_ID,
      geography: "EU_DATA_ZONE"
    }
  };
}

const permittedEuRegions = new Set([
  "francecentral",
  "germanywestcentral",
  "italynorth",
  "northeurope",
  "polandcentral",
  "spaincentral",
  "swedencentral",
  "westeurope"
]);

function validateRouteBinding(
  route: ModelRoute,
  binding: {
    readonly endpoint: string;
    readonly resourceId: string;
    readonly region: string;
    readonly evidenceId: string;
  },
  context: z.RefinementCtx
): void {
  const endpointAccount = getEndpointAccount(binding.endpoint);
  const resourceAccount = getResourceAccount(binding.resourceId);
  if (!endpointAccount || !resourceAccount || endpointAccount !== resourceAccount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${route}_ENDPOINT_RESOURCE_MISMATCH`
    });
  }
  if (!permittedEuRegions.has(binding.region.toLowerCase())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${route}_REGION_NOT_PERMITTED`
    });
  }
  if (binding.evidenceId !== `SEC-EVID-${route}-ROUTE-v1`) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${route}_EVIDENCE_ROUTE_MISMATCH`
    });
  }
}

function getEndpointAccount(endpoint: string): string | null {
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  const match = /^([a-z0-9-]+)\.openai\.azure\.com$/iu.exec(url.hostname);
  return match?.[1]?.toLowerCase() ?? null;
}

function getResourceAccount(resourceId: string): string | null {
  const match =
    /^\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.CognitiveServices\/accounts\/([^/]+)$/iu.exec(
      resourceId
    );
  return match?.[1]?.toLowerCase() ?? null;
}
