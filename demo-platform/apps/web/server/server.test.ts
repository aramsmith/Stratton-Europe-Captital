// @vitest-environment node

import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProductionWebServer, parseWebServerConfig } from "./server.js";

describe("production web server", () => {
  const azureConfig = {
    port: 8080,
    bffInternalBaseUrl: "https://stratton-demo-bff.internal.example",
    staticRoot: "dist",
    auth: {
      mode: "AZURE" as const,
      authority: "https://login.microsoftonline.com/tenant-stratton",
      clientId: "33333333-3333-3333-3333-333333333333",
      bffScope: "api://44444444-4444-4444-4444-444444444444/access_as_user"
    }
  };

  it("proxies one valid Bearer Authorization header unchanged without forwarding principal headers", async () => {
    const delegatedAccessToken = "opaque.browser.delegated.token";
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
      config: azureConfig,
      fetch: fetchMock
    });

    const response = await request(app)
      .post("/api/scenario/reset")
      .set("content-type", "application/json")
      .set("authorization", `Bearer ${delegatedAccessToken}`)
      .set("x-ms-client-principal", "untrusted-and-unused")
      .set("x-stratton-forwarded-principal", "client-spoof")
      .send({ fixture: "BASELINE" });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://stratton-demo-bff.internal.example/api/scenario/reset",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: `Bearer ${delegatedAccessToken}`,
          "content-type": "application/json"
        }),
        body: expect.any(Buffer)
      })
    );
    const forwardedRequest = fetchMock.mock.calls[0]?.[1];
    const forwardedHeaders = forwardedRequest?.headers as Record<string, string>;
    expect((forwardedRequest?.body as Buffer).toString("utf8")).toBe(
      JSON.stringify({ fixture: "BASELINE" })
    );
    expect(forwardedHeaders["authorization"]).toBe(`Bearer ${delegatedAccessToken}`);
    expect(forwardedHeaders["x-ms-client-principal"]).toBeUndefined();
    expect(forwardedHeaders["x-stratton-forwarded-principal"]).toBeUndefined();
  });

  it.each([
    ["missing", undefined],
    ["wrong scheme", "Basic dXNlcjpwYXNz"],
    ["empty bearer", "Bearer"],
    ["comma-joined bearer values", "Bearer first.token, Bearer second.token"]
  ])("fails closed when the browser Authorization header is %s", async (_name, authorization) => {
    const fetchMock = vi.fn<typeof fetch>();
    const app = createProductionWebServer({
      config: azureConfig,
      fetch: fetchMock
    });

    const pendingRequest = request(app).get("/api/scenario");
    if (authorization) {
      pendingRequest.set("authorization", authorization);
    }
    const response = await pendingRequest;

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects multiple Authorization header lines", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const app = createProductionWebServer({
      config: azureConfig,
      fetch: fetchMock
    });

    const response = await request(app)
      .get("/api/scenario")
      .set("authorization", ["Bearer first.token", "Bearer second.token"]);

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("serves public client-directed auth configuration without secrets", async () => {
    const app = createProductionWebServer({ config: azureConfig });

    const response = await request(app).get("/auth/config");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(azureConfig.auth);
    expect(JSON.stringify(response.body)).not.toMatch(/secret|sas|tokenStore/i);
  });

  it("fails closed when the production BFF route configuration is missing", () => {
    expect(() => parseWebServerConfig({ PORT: "8080" })).toThrowError(/BFF_INTERNAL_BASE_URL/);
  });

  it("ignores unrelated process environment keys while validating the production route", () => {
    expect(
      parseWebServerConfig({
        PORT: "8080",
        BFF_INTERNAL_BASE_URL: "https://stratton-demo-bff.internal.example",
        DEMO_MODE: "AZURE",
        DEMO_TENANT_ID: "tenant-stratton",
        WEB_ENTRA_CLIENT_ID: "33333333-3333-3333-3333-333333333333",
        WEB_BFF_DELEGATED_SCOPE:
          "api://44444444-4444-4444-4444-444444444444/access_as_user",
        PATH: "C:\\Windows\\System32"
      })
    ).toMatchObject({
      port: 8080,
      bffInternalBaseUrl: "https://stratton-demo-bff.internal.example",
      auth: {
        mode: "AZURE",
        authority: "https://login.microsoftonline.com/tenant-stratton",
        clientId: "33333333-3333-3333-3333-333333333333",
        bffScope: "api://44444444-4444-4444-4444-444444444444/access_as_user"
      }
    });
    expect(
      parseWebServerConfig({
        BFF_INTERNAL_BASE_URL: "https://stratton-demo-bff.internal.example",
        DEMO_MODE: "AZURE",
        DEMO_TENANT_ID: "tenant-stratton",
        WEB_ENTRA_CLIENT_ID: "33333333-3333-3333-3333-333333333333",
        WEB_BFF_DELEGATED_SCOPE:
          "api://44444444-4444-4444-4444-444444444444/access_as_user"
      }).staticRoot
    ).toMatch(/[\\/]apps[\\/]web[\\/]dist$/);
  });

  it("serves the production SPA fallback from the configured static root", async () => {
    const staticRoot = path.resolve("server", ".static-test-work");
    await rm(staticRoot, { recursive: true, force: true });
    await mkdir(staticRoot, { recursive: true });
    await writeFile(path.join(staticRoot, "index.html"), "<main>Stratton SPA</main>", "utf8");

    try {
      const app = createProductionWebServer({
        config: {
          ...azureConfig,
          staticRoot
        }
      });

      const response = await request(app).get("/workbench");

      expect(response.status).toBe(200);
      expect(response.text).toContain("Stratton SPA");
    } finally {
      await rm(staticRoot, { recursive: true, force: true });
    }
  });
});
