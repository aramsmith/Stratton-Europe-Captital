import { describe, expect, it } from "vitest";
import { parseDemoConfig } from "./config.js";

function azureEnvironment(): NodeJS.ProcessEnv {
  const tenantId = "00000000-0000-0000-0000-000000000123";
  return {
    PORT: "3001",
    DEMO_MODE: "AZURE",
    PHASE5_API_BASE_URL: "https://authority.stratton.example",
    DEMO_TENANT_ID: tenantId,
    AZURE_SQL_SERVER_FQDN: "stratton.database.windows.net",
    AZURE_SQL_DATABASE_NAME: "stratton",
    PHASE5_DELEGATED_SCOPE: "api://phase5/access_as_user",
    PHASE5_APPLICATION_ID: "phase5-application-id",
    BFF_ENTRA_CLIENT_ID: "44444444-4444-4444-4444-444444444444",
    BFF_DELEGATED_AUDIENCE: "44444444-4444-4444-4444-444444444444",
    BFF_REQUIRED_DELEGATED_SCOPE: "access_as_user",
    BFF_ALLOWED_CLIENT_APPLICATION_ID: "33333333-3333-3333-3333-333333333333",
    ENTRA_TOKEN_ENDPOINT: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    AZURE_MANAGED_IDENTITY_CLIENT_ID: "bff-managed-identity"
  };
}

describe("parseDemoConfig", () => {
  it("requires the delegated OBO settings in AZURE mode", () => {
    expect(parseDemoConfig(azureEnvironment())).toMatchObject({
      PHASE5_DELEGATED_SCOPE: "api://phase5/access_as_user",
      PHASE5_APPLICATION_ID: "phase5-application-id",
      BFF_ENTRA_CLIENT_ID: "44444444-4444-4444-4444-444444444444",
      BFF_DELEGATED_AUDIENCE: "44444444-4444-4444-4444-444444444444",
      BFF_REQUIRED_DELEGATED_SCOPE: "access_as_user",
      BFF_ALLOWED_CLIENT_APPLICATION_ID: "33333333-3333-3333-3333-333333333333",
      ENTRA_TOKEN_ENDPOINT:
        "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000123/oauth2/v2.0/token",
      AZURE_MANAGED_IDENTITY_CLIENT_ID: "bff-managed-identity"
    });
  });

  it("rejects an AZURE authority configuration that omits delegated OBO settings", () => {
    const environment = azureEnvironment();
    delete environment.PHASE5_DELEGATED_SCOPE;

    expect(() => parseDemoConfig(environment)).toThrow(/PHASE5_DELEGATED_SCOPE/);
  });

  it("rejects a non-GUID Microsoft Entra tenant ID", () => {
    const environment = azureEnvironment();
    environment.DEMO_TENANT_ID = "tenant-stratton";
    environment.ENTRA_TOKEN_ENDPOINT =
      "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token";

    expect(() => parseDemoConfig(environment)).toThrow(/DEMO_TENANT_ID/u);
  });

  it("requires the BFF confidential client ID and approved browser application ID", () => {
    const missingBffClient = azureEnvironment();
    delete missingBffClient.BFF_ENTRA_CLIENT_ID;
    expect(() => parseDemoConfig(missingBffClient)).toThrow(/BFF_ENTRA_CLIENT_ID/);

    const missingWebClient = azureEnvironment();
    delete missingWebClient.BFF_ALLOWED_CLIENT_APPLICATION_ID;
    expect(() => parseDemoConfig(missingWebClient)).toThrow(
      /BFF_ALLOWED_CLIENT_APPLICATION_ID/
    );
  });

  it("does not retain the dead completion client setting", () => {
    const config = parseDemoConfig({
      ...azureEnvironment(),
      DEMO_AUTHORITY_COMPLETION_CLIENT_ID: "stale-completion-client"
    });

    expect(config).not.toHaveProperty("DEMO_AUTHORITY_COMPLETION_CLIENT_ID");
  });

  it("rejects an ENTRA token endpoint that only contains the configured tenant as a nested path", () => {
    const environment = azureEnvironment();
    environment.ENTRA_TOKEN_ENDPOINT =
      "https://login.microsoftonline.com/other-tenant/00000000-0000-0000-0000-000000000123/oauth2/v2.0/token";

    expect(() => parseDemoConfig(environment)).toThrow(/AZURE_MODE_REQUIRES_MATCHING_ENTRA_TENANT/);
  });

  it("rejects an ENTRA token endpoint hosted anywhere other than Microsoft Entra", () => {
    const environment = azureEnvironment();
    environment.ENTRA_TOKEN_ENDPOINT =
      "https://identity-attacker.example/00000000-0000-0000-0000-000000000123/oauth2/v2.0/token";

    expect(() => parseDemoConfig(environment)).toThrow(/AZURE_MODE_REQUIRES_ENTRA_TOKEN_ORIGIN/);
  });

  it("does not validate AZURE token settings while parsing LOCAL fixtures", () => {
    expect(
      parseDemoConfig({
        PORT: "3001",
        DEMO_MODE: "LOCAL",
        PHASE5_API_BASE_URL: "http://localhost:7071",
        ENTRA_TOKEN_ENDPOINT: "not-a-url",
        PHASE5_DELEGATED_SCOPE: "",
        BFF_DELEGATED_AUDIENCE: ""
      })
    ).toMatchObject({ DEMO_MODE: "LOCAL" });
  });
});
