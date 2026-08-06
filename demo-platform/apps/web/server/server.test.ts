// @vitest-environment node

import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProductionWebServer, parseWebServerConfig } from "./server.js";

function encodePrincipal(input: {
  readonly tenantId: string;
  readonly actorId: string;
  readonly roles: readonly string[];
}): string {
  return Buffer.from(
    JSON.stringify({
      auth_typ: "aad",
      claims: [
        {
          typ: "http://schemas.microsoft.com/identity/claims/tenantid",
          val: input.tenantId
        },
        {
          typ: "http://schemas.microsoft.com/identity/claims/objectidentifier",
          val: input.actorId
        },
        ...input.roles.map((role) => ({
          typ: "roles",
          val: role
        }))
      ]
    }),
    "utf8"
  ).toString("base64");
}

describe("production web server", () => {
  it("proxies same-origin API calls to the private BFF with trusted identity and managed identity", async () => {
    const principal = encodePrincipal({
      tenantId: "tenant-stratton",
      actorId: "actor-123",
      roles: ["Stratton.Demo.ProjectDanube.Access"]
    });
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ caseId: "project-danube" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-correlation-id": "corr-upstream"
        }
      })
    );

    const app = createProductionWebServer({
      config: {
        port: 8080,
        bffInternalBaseUrl: "https://stratton-demo-bff.internal.example",
        bffTokenScope: "api://bff-client-id/.default",
        managedIdentityClientId: "11111111-1111-1111-1111-111111111111",
        staticRoot: "dist"
      },
      getAccessToken: vi.fn().mockResolvedValue("managed-identity-token"),
      fetch: fetchMock
    });

    const response = await request(app)
      .post("/api/scenario/reset")
      .set("content-type", "application/json")
      .set("x-ms-client-principal", principal)
      .set("x-demo-principal-type", "HUMAN")
      .set("x-stratton-forwarded-principal", "client-spoof")
      .send({ fixture: "BASELINE" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://stratton-demo-bff.internal.example/api/scenario/reset",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer managed-identity-token",
          "content-type": "application/json",
          "x-stratton-forwarded-principal": principal
        }),
        body: expect.any(Buffer)
      })
    );
    const forwardedRequest = fetchMock.mock.calls[0]?.[1];
    const forwardedHeaders = forwardedRequest?.headers as Record<string, string>;
    expect((forwardedRequest?.body as Buffer).toString("utf8")).toBe(
      JSON.stringify({ fixture: "BASELINE" })
    );
    expect(forwardedHeaders["x-demo-principal-type"]).toBeUndefined();
    expect(forwardedHeaders["x-stratton-forwarded-principal"]).not.toBe("client-spoof");
  });

  it("fails closed when the production BFF route configuration is missing", () => {
    expect(() =>
      parseWebServerConfig({
        PORT: "8080",
        AZURE_MANAGED_IDENTITY_CLIENT_ID: "11111111-1111-1111-1111-111111111111"
      })
    ).toThrowError(/BFF_INTERNAL_BASE_URL/);
  });

  it("ignores unrelated process environment keys while validating the production route", () => {
    expect(
      parseWebServerConfig({
        PORT: "8080",
        BFF_INTERNAL_BASE_URL: "https://stratton-demo-bff.internal.example",
        BFF_TOKEN_SCOPE: "api://bff-client-id/.default",
        AZURE_MANAGED_IDENTITY_CLIENT_ID: "11111111-1111-1111-8111-111111111111",
        PATH: "C:\\Windows\\System32"
      })
    ).toMatchObject({
      port: 8080,
      bffInternalBaseUrl: "https://stratton-demo-bff.internal.example"
    });
    expect(
      parseWebServerConfig({
        BFF_INTERNAL_BASE_URL: "https://stratton-demo-bff.internal.example",
        BFF_TOKEN_SCOPE: "api://bff-client-id/.default",
        AZURE_MANAGED_IDENTITY_CLIENT_ID: "11111111-1111-1111-8111-111111111111"
      }).staticRoot
    ).toMatch(/[\\/]apps[\\/]web[\\/]dist$/);
  });

  it("does not proxy a request without a Container Apps principal", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const app = createProductionWebServer({
      config: {
        port: 8080,
        bffInternalBaseUrl: "https://stratton-demo-bff.internal.example",
        bffTokenScope: "api://bff-client-id/.default",
        managedIdentityClientId: "11111111-1111-1111-1111-111111111111",
        staticRoot: "dist"
      },
      getAccessToken: vi.fn().mockResolvedValue("managed-identity-token"),
      fetch: fetchMock
    });

    const response = await request(app).get("/api/scenario");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves the production SPA fallback from the configured static root", async () => {
    const staticRoot = path.resolve("server", ".static-test-work");
    await rm(staticRoot, { recursive: true, force: true });
    await mkdir(staticRoot, { recursive: true });
    await writeFile(path.join(staticRoot, "index.html"), "<main>Stratton SPA</main>", "utf8");

    try {
      const app = createProductionWebServer({
        config: {
          port: 8080,
          bffInternalBaseUrl: "https://stratton-demo-bff.internal.example",
          bffTokenScope: "api://bff-client-id/.default",
          managedIdentityClientId: "11111111-1111-1111-8111-111111111111",
          staticRoot
        },
        getAccessToken: vi.fn().mockResolvedValue("managed-identity-token")
      });

      const response = await request(app).get("/workbench");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Stratton SPA");
    } finally {
      await rm(staticRoot, { recursive: true, force: true });
    }
  });
});
