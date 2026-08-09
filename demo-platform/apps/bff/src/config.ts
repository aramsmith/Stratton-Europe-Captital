import { z } from "zod";

const port = z.coerce.number().int().min(1).max(65535).default(3001);
const entraClientId = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
);
const entraTenantId = entraClientId;

const localConfigSchema = z.object({
  PORT: port,
  DEMO_MODE: z.literal("LOCAL"),
  PHASE5_API_BASE_URL: z.string().url()
});

const azureConfigSchema = z
  .object({
    PORT: port,
    DEMO_MODE: z.literal("AZURE"),
    PHASE5_API_BASE_URL: z.string().url(),
    DEMO_TENANT_ID: entraTenantId,
    AZURE_SQL_SERVER_FQDN: z.string().trim().min(1),
    AZURE_SQL_DATABASE_NAME: z.string().trim().min(1),
    PHASE5_DELEGATED_SCOPE: z.string().trim().min(1),
    PHASE5_APPLICATION_ID: z.string().trim().min(1),
    BFF_ENTRA_CLIENT_ID: entraClientId,
    BFF_DELEGATED_AUDIENCE: entraClientId,
    BFF_REQUIRED_DELEGATED_SCOPE: z.string().trim().min(1),
    BFF_ALLOWED_CLIENT_APPLICATION_ID: entraClientId,
    ENTRA_TOKEN_ENDPOINT: z.string().url(),
    AZURE_MANAGED_IDENTITY_CLIENT_ID: z.string().trim().min(1)
  })
  .superRefine((config, context) => {
    const entraTokenEndpoint = new URL(config.ENTRA_TOKEN_ENDPOINT);
    if (new URL(config.PHASE5_API_BASE_URL).protocol !== "https:") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AZURE_MODE_REQUIRES_HTTPS_PHASE5"
      });
    }
    if (entraTokenEndpoint.protocol !== "https:") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AZURE_MODE_REQUIRES_HTTPS_ENTRA_TOKEN_ENDPOINT"
      });
    }
    if (entraTokenEndpoint.origin !== "https://login.microsoftonline.com") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AZURE_MODE_REQUIRES_ENTRA_TOKEN_ORIGIN"
      });
    }
    if (
      entraTokenEndpoint.pathname !==
      `/${encodeURIComponent(config.DEMO_TENANT_ID)}/oauth2/v2.0/token`
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AZURE_MODE_REQUIRES_MATCHING_ENTRA_TENANT"
      });
    }
    if (config.BFF_DELEGATED_AUDIENCE !== config.BFF_ENTRA_CLIENT_ID) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "BFF_DELEGATED_AUDIENCE_MUST_EQUAL_BFF_ENTRA_CLIENT_ID"
      });
    }
  });

export const configSchema = z.discriminatedUnion("DEMO_MODE", [
  localConfigSchema,
  azureConfigSchema
]);

export type DemoConfig = z.infer<typeof configSchema>;

export function parseDemoConfig(environment: NodeJS.ProcessEnv = process.env): DemoConfig {
  if (environment.DEMO_MODE === "LOCAL") {
    return localConfigSchema.parse({
      PORT: environment.PORT,
      DEMO_MODE: environment.DEMO_MODE,
      PHASE5_API_BASE_URL: environment.PHASE5_API_BASE_URL
    });
  }

  const azureEnvironment = {
    PORT: environment.PORT,
    DEMO_MODE: environment.DEMO_MODE,
    PHASE5_API_BASE_URL: environment.PHASE5_API_BASE_URL,
    DEMO_TENANT_ID: environment.DEMO_TENANT_ID,
    AZURE_SQL_SERVER_FQDN: environment.AZURE_SQL_SERVER_FQDN,
    AZURE_SQL_DATABASE_NAME: environment.AZURE_SQL_DATABASE_NAME,
    PHASE5_DELEGATED_SCOPE: environment.PHASE5_DELEGATED_SCOPE,
    PHASE5_APPLICATION_ID: environment.PHASE5_APPLICATION_ID,
    BFF_ENTRA_CLIENT_ID: environment.BFF_ENTRA_CLIENT_ID,
    BFF_DELEGATED_AUDIENCE: environment.BFF_DELEGATED_AUDIENCE,
    BFF_REQUIRED_DELEGATED_SCOPE: environment.BFF_REQUIRED_DELEGATED_SCOPE,
    BFF_ALLOWED_CLIENT_APPLICATION_ID: environment.BFF_ALLOWED_CLIENT_APPLICATION_ID,
    ENTRA_TOKEN_ENDPOINT: environment.ENTRA_TOKEN_ENDPOINT,
    AZURE_MANAGED_IDENTITY_CLIENT_ID: environment.AZURE_MANAGED_IDENTITY_CLIENT_ID
  };
  return azureConfigSchema.parse(azureEnvironment);
}
