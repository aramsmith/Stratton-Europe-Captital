import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiServer } from "../../../app/src/api-runtime.js";
import { InMemoryIdempotencyStore } from "../../../app/src/idempotency-store.js";
import { StructuredLogger } from "../../../app/src/logger.js";
import { InMemoryQueueRouter } from "../../../app/src/queue-adapters.js";
import { InMemoryWorkloadRepository } from "../../../app/src/workload-repository.js";
import { createDemoAuthorityRepository } from "../support/demo-authority-fixture.js";

function principalHeader(idtyp: "user" | "app", roles: readonly string[], appid?: string): string {
  const claims = [
    { typ: "tid", val: "tenant-a" },
    { typ: "oid", val: idtyp === "user" ? "contributor-a" : "service-a" },
    { typ: "iss", val: "https://login.microsoftonline.com/tenant-a/v2.0" },
    { typ: "idtyp", val: idtyp },
    ...roles.map((role) => ({ typ: "roles", val: role })),
    ...(appid ? [{ typ: "appid", val: appid }] : [])
  ];
  return Buffer.from(JSON.stringify({ auth_typ: "aad", role_typ: "roles", claims }), "utf8").toString("base64");
}

test("demo authority routes reject application reviews and unconfigured completion applications", async () => {
  const repository = new InMemoryWorkloadRepository();
  const { server } = createApiServer({
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    queueProducer: new InMemoryQueueRouter(),
    logger: new StructuredLogger("test"),
    requestBodyLimitBytes: 32_768,
    modelProviderEvidenceId: "model-evidence",
    regionalDeploymentEvidenceId: "region-evidence",
    promptGovernanceEvidenceId: "prompt-evidence",
    idempotencyLeaseDurationSeconds: 120,
    analysisCapabilityEnabled: true,
    auditExportCapabilityEnabled: true,
    completionClientId: "demo-bff"
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const review = await fetch(
      `${baseUrl}/v1/demo-authority/cases/project-danube/analysis-bundles/bundle-1/reviews`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "review-1",
          "x-ms-client-principal": principalHeader("app", ["DealReviewer"], "demo-bff")
        },
        body: JSON.stringify({})
      }
    );
    assert.equal(review.status, 403);

    const completion = await fetch(
      `${baseUrl}/v1/demo-authority/analysis-bundles/bundle-1/completion`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "completion-1",
          "x-ms-client-principal": principalHeader("app", [], "unexpected-app")
        },
        body: JSON.stringify({})
      }
    );
    assert.equal(completion.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("demo authority API completes the additive bundle lifecycle without Release 1 analysis rows", async () => {
  const repository = await createDemoAuthorityRepository();
  const { server } = createApiServer({
    repository,
    idempotencyStore: new InMemoryIdempotencyStore(),
    queueProducer: new InMemoryQueueRouter(),
    logger: new StructuredLogger("test"),
    requestBodyLimitBytes: 32_768,
    modelProviderEvidenceId: "model-evidence",
    regionalDeploymentEvidenceId: "region-evidence",
    promptGovernanceEvidenceId: "prompt-evidence",
    idempotencyLeaseDurationSeconds: 120,
    analysisCapabilityEnabled: true,
    auditExportCapabilityEnabled: true,
    completionClientId: "demo-bff"
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const humanPrincipal = principalHeader(
    "user",
    ["DealContributor", "DealReviewer", "LegalApprover", "ComplianceApprover", "CaseReader"]
  );
  const applicationPrincipal = principalHeader("app", [], "demo-bff");
  const post = async (
    path: string,
    principal: string,
    idempotencyKey: string,
    body: Record<string, unknown>
  ) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": idempotencyKey,
        "x-ms-client-principal": principal
      },
      body: JSON.stringify(body)
    });

  try {
    const crossTenantRoute = await fetch(
      `${baseUrl}/v1/demo-authority/model-route-evidence/route-evidence-1?tenantId=tenant-b`,
      {
        headers: { "x-ms-client-principal": applicationPrincipal }
      }
    );
    assert.equal(crossTenantRoute.status, 403);
    const tenantRoute = await fetch(
      `${baseUrl}/v1/demo-authority/model-route-evidence/route-evidence-1?tenantId=tenant-a`,
      {
        headers: { "x-ms-client-principal": applicationPrincipal }
      }
    );
    assert.equal(tenantRoute.status, 200);

    const create = await post(
      "/v1/demo-authority/cases/case-1/analysis-bundles",
      humanPrincipal,
      "bundle-create-1",
      {
        tenantId: "tenant-a",
        caseId: "case-1",
        analysisBundleId: "bundle-1",
        modelRoute: "TERRA",
        modelDeploymentId: "terra-prod-eu",
        routeEvidenceId: "route-evidence-1",
        promptTemplateVersion: "phase5-template-v1",
        requestFingerprint: "request-1",
        evidenceIds: ["ev-1"]
      }
    );
    assert.equal(create.status, 202);
    const created = (await create.json()) as {
      evidenceManifestHash: string;
      evidence: readonly unknown[];
    };
    assert.equal(created.evidence.length, 1);

    const completionBody = {
      tenantId: "tenant-a",
      caseId: "case-1",
      analysisBundleId: "bundle-1",
      outputManifestHash: "c".repeat(64),
      evidenceManifestHash: created.evidenceManifestHash,
      modelRoute: "TERRA",
      modelDeploymentId: "terra-prod-eu",
      routeEvidenceId: "route-evidence-1",
      status: "DRAFT_ONLY_READY",
      citationCounts: {
        totalClaims: 2,
        citedClaims: 2,
        materialClaims: 1,
        citedMaterialClaims: 1,
        unsupportedClaims: 0
      }
    };
    const completion = await post(
      "/v1/demo-authority/analysis-bundles/bundle-1/completion",
      applicationPrincipal,
      "bundle-complete-1",
      completionBody
    );
    assert.equal(completion.status, 200);
    const completed = (await completion.json()) as {
      subjectVersion: string;
      citationCounts: typeof completionBody.citationCounts;
    };
    assert.equal(completed.subjectVersion, completionBody.outputManifestHash);
    assert.deepEqual(completed.citationCounts, completionBody.citationCounts);

    const get = await fetch(`${baseUrl}/v1/demo-authority/analysis-bundles/bundle-1`, {
      headers: { "x-ms-client-principal": humanPrincipal }
    });
    assert.equal(get.status, 200);
    assert.equal(((await get.json()) as { subjectVersion: string }).subjectVersion, completionBody.outputManifestHash);

    for (const reviewType of ["DEAL", "LEGAL", "COMPLIANCE"] as const) {
      const review = await post(
        `/v1/demo-authority/cases/case-1/analysis-bundles/bundle-1/reviews`,
        humanPrincipal,
        `review-${reviewType.toLowerCase()}`,
        {
          tenantId: "tenant-a",
          caseId: "case-1",
          analysisBundleId: "bundle-1",
          reviewId: `review-${reviewType.toLowerCase()}`,
          subjectVersion: completionBody.outputManifestHash,
          reviewType,
          decision: "APPROVED",
          rationale: "Bundle-scoped evidence and citation assessment are complete.",
          evidenceManifestHash: created.evidenceManifestHash
        }
      );
      assert.equal(review.status, 201);
    }

    const draft = await post(
      "/v1/demo-authority/cases/case-1/analysis-bundles/bundle-1/draft-recommendations",
      humanPrincipal,
      "draft-1",
      {
        tenantId: "tenant-a",
        caseId: "case-1",
        analysisBundleId: "bundle-1",
        subjectVersion: completionBody.outputManifestHash
      }
    );
    assert.equal(draft.status, 200);
    assert.equal(((await draft.json()) as { status: string }).status, "DRAFT_RECOMMENDATION_READY");
    assert.equal(await repository.getAnalysisRun("tenant-a", "case-1", "bundle-1"), undefined);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
