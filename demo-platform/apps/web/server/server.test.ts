// @vitest-environment node

import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProductionWebServer, parseWebServerConfig } from "./server.js";

describe("production web server", () => {
  it("proxies the platform delegated token unchanged without forwarding principal headers", async () => {
    const delegatedAccessToken = "opaque.platform.delegated.token";
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
        staticRoot: "dist"
      },
      fetch: fetchMock
    });

    const response = await request(app)
      .post("/api/scenario/reset")
      .set("content-type", "application/json")
      .set("x-ms-token-aad-access-token", delegatedAccessToken)
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

  it("fails closed when the platform delegated token is missing", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const app = createProductionWebServer({
      config: {
        port: 8080,
        bffInternalBaseUrl: "https://stratton-demo-bff.internal.example",
        staticRoot: "dist"
      },
      fetch: fetchMock
    });

    const response = await request(app).get("/api/scenario");

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when the production BFF route configuration is missing", () => {
    expect(() => parseWebServerConfig({ PORT: "8080" })).toThrowError(/BFF_INTERNAL_BASE_URL/);
  });

  it("ignores unrelated process environment keys while validating the production route", () => {
    expect(
      parseWebServerConfig({
        PORT: "8080",
        BFF_INTERNAL_BASE_URL: "https://stratton-demo-bff.internal.example",
        PATH: "C:\\Windows\\System32"
      })
    ).toMatchObject({
      port: 8080,
      bffInternalBaseUrl: "https://stratton-demo-bff.internal.example"
    });
    expect(
      parseWebServerConfig({
        BFF_INTERNAL_BASE_URL: "https://stratton-demo-bff.internal.example"
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
          port: 8080,
          bffInternalBaseUrl: "https://stratton-demo-bff.internal.example",
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
