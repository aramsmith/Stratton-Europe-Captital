import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiServer } from "../../../app/src/api-runtime.js";
import { InMemoryIdempotencyStore } from "../../../app/src/idempotency-store.js";
import { StructuredLogger } from "../../../app/src/logger.js";
import { InMemoryQueueRouter } from "../../../app/src/queue-adapters.js";
import { InMemoryWorkloadRepository } from "../../../app/src/workload-repository.js";

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
