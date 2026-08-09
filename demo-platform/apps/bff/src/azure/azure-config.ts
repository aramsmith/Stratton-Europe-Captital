import { z } from "zod";

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
  .strict();

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
