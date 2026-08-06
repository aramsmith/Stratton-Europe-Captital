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
    AZURE_OPENAI_LUNA_DEPLOYMENT_ID: z.string().trim().min(1),
    AZURE_OPENAI_LUNA_API_VERSION: z.string().trim().min(1),
    AZURE_OPENAI_LUNA_EVIDENCE_ID: z.string().trim().min(1),
    AZURE_OPENAI_TERRA_ENDPOINT: z.string().url(),
    AZURE_OPENAI_TERRA_DEPLOYMENT_ID: z.string().trim().min(1),
    AZURE_OPENAI_TERRA_API_VERSION: z.string().trim().min(1),
    AZURE_OPENAI_TERRA_EVIDENCE_ID: z.string().trim().min(1),
    AZURE_OPENAI_SOL_ENDPOINT: z.string().url(),
    AZURE_OPENAI_SOL_DEPLOYMENT_ID: z.string().trim().min(1),
    AZURE_OPENAI_SOL_API_VERSION: z.string().trim().min(1),
    AZURE_OPENAI_SOL_EVIDENCE_ID: z.string().trim().min(1)
  })
  .strict();

export type AzureDemoConfig = z.infer<typeof azureDemoConfigSchema>;

export function parseAzureDemoConfig(
  environment: NodeJS.ProcessEnv = process.env
): AzureDemoConfig {
  return azureDemoConfigSchema.parse(environment);
}

export function buildApprovedDeployments(
  config: AzureDemoConfig
): Readonly<Record<ModelRoute, ApprovedDeployment>> {
  return {
    LUNA: {
      endpoint: config.AZURE_OPENAI_LUNA_ENDPOINT,
      deploymentId: config.AZURE_OPENAI_LUNA_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_LUNA_API_VERSION,
      evidenceId: config.AZURE_OPENAI_LUNA_EVIDENCE_ID,
      geography: "EU_DATA_ZONE"
    },
    TERRA: {
      endpoint: config.AZURE_OPENAI_TERRA_ENDPOINT,
      deploymentId: config.AZURE_OPENAI_TERRA_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_TERRA_API_VERSION,
      evidenceId: config.AZURE_OPENAI_TERRA_EVIDENCE_ID,
      geography: "EU_DATA_ZONE"
    },
    SOL: {
      endpoint: config.AZURE_OPENAI_SOL_ENDPOINT,
      deploymentId: config.AZURE_OPENAI_SOL_DEPLOYMENT_ID,
      apiVersion: config.AZURE_OPENAI_SOL_API_VERSION,
      evidenceId: config.AZURE_OPENAI_SOL_EVIDENCE_ID,
      geography: "EU_DATA_ZONE"
    }
  };
}
