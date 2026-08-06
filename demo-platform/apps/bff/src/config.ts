import { z } from "zod";

export const configSchema = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DEMO_MODE: z.enum(["LOCAL", "AZURE"]),
    PHASE5_API_BASE_URL: z.string().url(),
    PHASE5_TOKEN_SCOPE: z.string().trim().min(1).optional(),
    DEMO_TENANT_ID: z.string().trim().min(1).optional(),
    TRUSTED_WEB_PROXY_PRINCIPAL_ID: z.string().trim().min(1).optional(),
    AZURE_SQL_SERVER_FQDN: z.string().min(1).optional(),
    AZURE_SQL_DATABASE_NAME: z.string().min(1).optional()
  })
  .superRefine((config, context) => {
    if (
      config.DEMO_MODE === "AZURE" &&
      (!config.AZURE_SQL_SERVER_FQDN || !config.AZURE_SQL_DATABASE_NAME)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AZURE_MODE_REQUIRES_SQL_CONFIGURATION"
      });
    }
    if (
      config.DEMO_MODE === "AZURE" &&
      (!config.PHASE5_TOKEN_SCOPE ||
        !config.DEMO_TENANT_ID ||
        !config.TRUSTED_WEB_PROXY_PRINCIPAL_ID)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AZURE_MODE_REQUIRES_IDENTITY_CONFIGURATION"
      });
    }
    if (
      config.DEMO_MODE === "AZURE" &&
      new URL(config.PHASE5_API_BASE_URL).protocol !== "https:"
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AZURE_MODE_REQUIRES_HTTPS_PHASE5"
      });
    }
  });

export type DemoConfig = z.infer<typeof configSchema>;

export function parseDemoConfig(environment: NodeJS.ProcessEnv = process.env): DemoConfig {
  return configSchema.parse(environment);
}
