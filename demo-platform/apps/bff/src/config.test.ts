import { describe, expect, it } from "vitest";
import { parseDemoConfig } from "./config.js";

function azureEnvironment(): NodeJS.ProcessEnv {
  return {
    PORT: "3001",
    DEMO_MODE: "AZURE",
    PHASE5_API_BASE_URL: "https://authority.stratton.example",
    DEMO_TENANT_ID: "tenant-stratton",
    TRUSTED_WEB_PROXY_PRINCIPAL_ID: "web-proxy-object-id",
    AZURE_SQL_SERVER_FQDN: "stratton.database.windows.net",
    AZURE_SQL_DATABASE_NAME: "stratton",
    PHASE5_DELEGATED_SCOPE: "api://phase5/access_as_user",
    PHASE5_APPLICATION_ID: "phase5-application-id",
    BFF_DELEGATED_AUDIENCE: "api://stratton-demo-bff",
    BFF_REQUIRED_DELEGATED_SCOPE: "access_as_user",
    ENTRA_TOKEN_ENDPOINT: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
    AZURE_MANAGED_IDENTITY_CLIENT_ID: "bff-managed-identity"
  };
}

describe("parseDemoConfig", () => {
  it("requires the delegated OBO settings in AZURE mode", () => {
    expect(parseDemoConfig(azureEnvironment())).toMatchObject({
      PHASE5_DELEGATED_SCOPE: "api://phase5/access_as_user",
      PHASE5_APPLICATION_ID: "phase5-application-id",
      BFF_DELEGATED_AUDIENCE: "api://stratton-demo-bff",
      BFF_REQUIRED_DELEGATED_SCOPE: "access_as_user",
      ENTRA_TOKEN_ENDPOINT: "https://login.microsoftonline.com/tenant-stratton/oauth2/v2.0/token",
      AZURE_MANAGED_IDENTITY_CLIENT_ID: "bff-managed-identity"
    });
  });

  it("rejects an AZURE authority configuration that omits delegated OBO settings", () => {
    const environment = azureEnvironment();
    delete environment.PHASE5_DELEGATED_SCOPE;

    expect(() => parseDemoConfig(environment)).toThrow(/PHASE5_DELEGATED_SCOPE/);
  });

  it("rejects an ENTRA token endpoint that only contains the configured tenant as a nested path", () => {
    const environment = azureEnvironment();
    environment.ENTRA_TOKEN_ENDPOINT =
      "https://login.microsoftonline.com/other-tenant/tenant-stratton/oauth2/v2.0/token";

    expect(() => parseDemoConfig(environment)).toThrow(/AZURE_MODE_REQUIRES_MATCHING_ENTRA_TENANT/);
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
