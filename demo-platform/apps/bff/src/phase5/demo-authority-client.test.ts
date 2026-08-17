import { describe, expect, it, vi } from "vitest";
import {
  createDemoAuthorityClient,
  type AnalysisBundleStatus
} from "./demo-authority-client.js";

const bundle: AnalysisBundleStatus = {
  tenantId: "tenant-stratton",
  caseId: "project-danube",
  analysisBundleId: "bundle-123",
  evidenceManifestHash: "a".repeat(64),
  modelRoute: "TERRA",
  modelDeploymentId: "terra-grounded-analysis",
  routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
  promptTemplateVersion: "stratton-workbench-v2",
  requestFingerprint: "b".repeat(64),
  status: "QUEUED",
  outputKind: "DRAFT_ONLY",
  unsupportedClaims: 0,
  evidence: [
    {
      evidenceId: "evidence-board-pack",
      evidenceVersionId: "evidence-board-pack-v1",
      ordinal: 1
    }
  ],
  citationCounts: {
    totalClaims: 0,
    citedClaims: 0,
    materialClaims: 0,
    citedMaterialClaims: 0,
    unsupportedClaims: 0
  }
};

function authorityClient(fetchImpl: typeof fetch) {
  return createDemoAuthorityClient({
    baseUrl: "https://authority.stratton.example",
    oboTokenExchange: {
      acquirePhase5Token: vi.fn().mockResolvedValue("delegated-phase5-token")
    },
    getDelegatedUserToken: vi.fn().mockResolvedValue({
      accessToken: "signed-user-token",
      tenantId: "tenant-stratton",
      actorId: "human-object-id",
      scopes: ["access_as_user"],
      roles: ["DealContributor"]
    }),
    getApplicationToken: vi.fn().mockResolvedValue("application-phase5-token"),
    getRequestContext: () => ({
      identity: {
        actorId: "human-object-id",
        tenantId: "tenant-stratton",
        principalType: "HUMAN",
        roles: ["Stratton.Demo.ProjectDanube.Access"]
      },
      correlationId: "corr-123",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00aa0ba902b7-01"
    }),
    fetch: fetchImpl
  });
}

describe("createDemoAuthorityClient", () => {
  it("reads route evidence with an application token before a request context exists", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          evidenceId: "SEC-EVID-TERRA-ROUTE-v1",
          status: "APPROVED",
          resourceId:
            "/subscriptions/11111111-1111-1111-1111-111111111111/resourceGroups/rg-ai/providers/Microsoft.CognitiveServices/accounts/stratton-terra",
          deploymentId: "terra-grounded-analysis",
          region: "westeurope",
          route: "TERRA",
          apiVersion: "2025-01-01-preview",
          evidenceVersion: "route-evidence-v1",
          validFromIso: "2026-01-01T00:00:00.000Z",
          validUntilIso: "2027-01-01T00:00:00.000Z"
        }),
        { status: 200 }
      )
    );
    const client = createDemoAuthorityClient({
      baseUrl: "https://authority.stratton.example",
      oboTokenExchange: {
        acquirePhase5Token: vi.fn(() => {
          throw new Error("OBO must not be used for startup authority");
        })
      },
      getDelegatedUserToken: vi.fn(() => {
        throw new Error("A delegated user must not be required for startup authority");
      }),
      getApplicationToken: vi.fn().mockResolvedValue("application-phase5-token"),
      getRequestContext: () => {
        throw new Error("No request context exists during startup");
      },
      fetch: fetchImpl
    });

    await expect(
      client.getModelRouteEvidence(
        "00000000-0000-0000-0000-000000000123",
        "SEC-EVID-TERRA-ROUTE-v1"
      )
    ).resolves.toMatchObject({
      route: "TERRA",
      deploymentId: "terra-grounded-analysis"
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://authority.stratton.example/v1/demo-authority/model-route-evidence/SEC-EVID-TERRA-ROUTE-v1?tenantId=00000000-0000-0000-0000-000000000123",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: expect.any(String) })
      })
    );
  });

  it("admits evidence with delegated OBO identity and the caller idempotency key", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          evidenceId: "evidence-board-pack",
          status: "ADMITTED"
        }),
        { status: 200 }
      )
    );
    const client = authorityClient(fetchImpl);

    await client.admitEvidence({
      tenantId: "tenant-stratton",
      caseId: "project-danube",
      evidenceId: "evidence-board-pack",
      idempotencyKey: "admit:project-danube:evidence-board-pack",
      correlationId: "corr-123"
    });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://authority.stratton.example/v1/evidence/evidence-board-pack/admission"
    );
    expect(init?.headers).toMatchObject({
      "idempotency-key": "admit:project-danube:evidence-board-pack",
      "x-correlation-id": "corr-123"
    });
    expect((init?.headers as Record<string, string>).authorization).toMatch(
      /^Bearer \S+$/
    );
    expect(init?.headers).not.toHaveProperty("x-stratton-actor-id");
    expect(JSON.parse(String(init?.body))).toEqual({
      caseId: "project-danube"
    });
  });

  it("uses a delegated OBO token and forwards trace context for human bundle creation", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(bundle), { status: 202 })
    );
    const client = authorityClient(fetchImpl);

    await expect(
      client.createAnalysisBundle({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-123",
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        promptTemplateVersion: "stratton-workbench-v2",
        requestFingerprint: "b".repeat(64),
        evidenceIds: ["evidence-board-pack"]
      })
    ).resolves.toEqual(bundle);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://authority.stratton.example/v1/demo-authority/cases/project-danube/analysis-bundles"
    );
    expect(init?.headers).toMatchObject({
      authorization: "Bearer delegated-phase5-token",
      "x-correlation-id": "corr-123",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00aa0ba902b7-01"
    });
    expect(init?.headers).toHaveProperty("idempotency-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      tenantId: "tenant-stratton",
      caseId: "project-danube",
      analysisBundleId: "bundle-123",
      modelRoute: "TERRA",
      modelDeploymentId: "terra-grounded-analysis",
      routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      promptTemplateVersion: "stratton-workbench-v2",
      requestFingerprint: "b".repeat(64),
      evidenceIds: ["evidence-board-pack"]
    });
  });

  it("uses a separate application token only for bundle completion", async () => {
    const citationCounts = {
      totalClaims: 2,
      citedClaims: 2,
      materialClaims: 1,
      citedMaterialClaims: 1,
      unsupportedClaims: 0
    };
    const readyBundle = {
      ...bundle,
      status: "DRAFT_ONLY_READY" as const,
      subjectVersion: "c".repeat(64),
      citationCounts
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(readyBundle), { status: 200 })
    );
    const client = authorityClient(fetchImpl);

    await expect(
      client.completeAnalysisBundle({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-123",
        outputManifestHash: "c".repeat(64),
        evidenceManifestHash: bundle.evidenceManifestHash,
        modelRoute: "TERRA",
        modelDeploymentId: "terra-grounded-analysis",
        routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
        status: "DRAFT_ONLY_READY",
        citationCounts
      })
    ).resolves.toEqual(readyBundle);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://authority.stratton.example/v1/demo-authority/analysis-bundles/bundle-123/completion"
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      tenantId: "tenant-stratton",
      caseId: "project-danube",
      analysisBundleId: "bundle-123",
      outputManifestHash: "c".repeat(64),
      evidenceManifestHash: bundle.evidenceManifestHash,
      modelRoute: "TERRA",
      modelDeploymentId: "terra-grounded-analysis",
      routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      status: "DRAFT_ONLY_READY",
      citationCounts
    });
    expect(init?.headers).toMatchObject({
      authorization: "Bearer application-phase5-token",
      "x-correlation-id": "corr-123"
    });
  });

  it("classifies Phase 5 network failures without exposing request data", async () => {
    const fetchError = Object.assign(new TypeError("fetch failed"), {
      cause: { code: "ENOTFOUND" }
    });
    const client = authorityClient(
      vi.fn<typeof fetch>().mockRejectedValue(fetchError)
    );

    await expect(
      client.admitEvidence({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        evidenceId: "evidence-board-pack",
        idempotencyKey: "evidence-admission-1",
        correlationId: "corr-123"
      })
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "PHASE5_REQUEST_FAILED:TypeError:ENOTFOUND"
    });
  });

  it("preserves the Phase 5 HTTP status when Easy Auth returns a non-contract response", async () => {
    const client = authorityClient(
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response("unauthorized", { status: 401 })
      )
    );

    await expect(
      client.admitEvidence({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        evidenceId: "evidence-board-pack",
        idempotencyKey: "evidence-admission-1",
        correlationId: "corr-123"
      })
    ).rejects.toMatchObject({
      code: "DEPENDENCY_UNAVAILABLE",
      message: "PHASE5_HTTP_401"
    });
  });

  it("derives the same idempotency key for semantically identical bundle input", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () =>
      new Response(JSON.stringify(bundle), { status: 202 })
    );
    const client = authorityClient(fetchImpl);
    const input = {
      tenantId: "tenant-stratton",
      caseId: "project-danube",
      analysisBundleId: "bundle-123",
      modelRoute: "TERRA" as const,
      modelDeploymentId: "terra-grounded-analysis",
      routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      promptTemplateVersion: "stratton-workbench-v2",
      requestFingerprint: "b".repeat(64),
      evidenceIds: ["evidence-board-pack"]
    };

    await client.createAnalysisBundle(input);
    await client.createAnalysisBundle({
      evidenceIds: ["evidence-board-pack"],
      requestFingerprint: "b".repeat(64),
      promptTemplateVersion: "stratton-workbench-v2",
      routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      modelDeploymentId: "terra-grounded-analysis",
      modelRoute: "TERRA",
      analysisBundleId: "bundle-123",
      caseId: "project-danube",
      tenantId: "tenant-stratton"
    });

    const firstHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    const secondHeaders = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders["idempotency-key"]).toBe(secondHeaders["idempotency-key"]);
  });
});
