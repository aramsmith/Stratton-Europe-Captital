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
        evidenceManifestHash: "a".repeat(64),
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
      evidenceManifestHash: "a".repeat(64),
      modelRoute: "TERRA",
      modelDeploymentId: "terra-grounded-analysis",
      routeEvidenceId: "SEC-EVID-TERRA-ROUTE-v1",
      promptTemplateVersion: "stratton-workbench-v2",
      requestFingerprint: "b".repeat(64),
      evidenceIds: ["evidence-board-pack"]
    });
  });

  it("uses a separate application token only for bundle completion", async () => {
    const readyBundle = { ...bundle, status: "DRAFT_ONLY_READY" as const, subjectVersion: "c".repeat(64) };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(readyBundle), { status: 200 })
    );
    const client = authorityClient(fetchImpl);

    await expect(
      client.completeAnalysisBundle({
        tenantId: "tenant-stratton",
        caseId: "project-danube",
        analysisBundleId: "bundle-123",
        subjectVersion: "c".repeat(64),
        status: "DRAFT_ONLY_READY",
        unsupportedClaims: 0
      })
    ).resolves.toEqual(readyBundle);

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://authority.stratton.example/v1/demo-authority/analysis-bundles/bundle-123/completion"
    );
    expect(init?.headers).toMatchObject({
      authorization: "Bearer application-phase5-token",
      "x-correlation-id": "corr-123"
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
      evidenceManifestHash: "a".repeat(64),
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
      evidenceManifestHash: "a".repeat(64),
      analysisBundleId: "bundle-123",
      caseId: "project-danube",
      tenantId: "tenant-stratton"
    });

    const firstHeaders = fetchImpl.mock.calls[0]?.[1]?.headers as Record<string, string>;
    const secondHeaders = fetchImpl.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders["idempotency-key"]).toBe(secondHeaders["idempotency-key"]);
  });
});
