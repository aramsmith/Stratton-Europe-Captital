import { expect, test, type APIRequestContext } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const caseId = "project-danube";
const admittedEvidenceIds = [
  "evidence-board-pack",
  "evidence-erp-rebates",
  "evidence-qoe-report",
  "evidence-environmental-permit"
] as const;

async function prepareAnalysis(request: APIRequestContext): Promise<Record<string, unknown>> {
  expect((await request.post("/api/scenario/reset")).ok()).toBeTruthy();
  for (const evidenceId of admittedEvidenceIds) {
    expect(
      (
        await request.post(`/api/evidence/${evidenceId}/admit`, {
          data: { caseId }
        })
      ).ok()
    ).toBeTruthy();
  }
  expect(
    (
      await request.post("/api/analysis-runs", {
        data: {
          caseId,
          taskClass: "CROSS_DOCUMENT_COMPARISON",
          question: "Challenge management EBITDA quality"
        }
      })
    ).ok()
  ).toBeTruthy();
  return (await (await request.get("/api/scenario")).json()) as Record<string, unknown>;
}

test("local delegated identity fixture preserves the browser bearer and rejects application tokens during delegated parsing", async () => {
  await expect(
    run(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        `
          import { createProductionWebServer } from "./apps/web/server/server.ts";
          import { resolveDelegatedUserToken } from "./apps/bff/src/identity/delegated-token.ts";

          const forwarded = [];
          const app = createProductionWebServer({
            config: {
              port: 0,
              bffInternalBaseUrl: "https://stratton-demo-bff.internal.example",
              staticRoot: "dist",
              auth: {
                mode: "AZURE",
                authority: "https://login.microsoftonline.com/local-stratton-demo",
                clientId: "33333333-3333-3333-3333-333333333333",
                bffScope: "api://44444444-4444-4444-4444-444444444444/access_as_user"
              }
            },
            fetch: async (_url, init) => {
              forwarded.push(init);
              return new Response(null, { status: 204 });
            }
          });
          const server = app.listen(0);
          await new Promise((resolve) => server.once("listening", resolve));
          const address = server.address();
          if (!address || typeof address === "string") {
            throw new Error("WEB_FIXTURE_ADDRESS_UNAVAILABLE");
          }
          try {
            const response = await fetch("http://127.0.0.1:" + address.port + "/api/scenario", {
              method: "POST",
              headers: { authorization: "Bearer browser-access-token" }
            });
            if (
              response.status !== 204 ||
              forwarded.length !== 1 ||
              forwarded[0].headers.authorization !== "Bearer browser-access-token"
            ) {
              throw new Error("DELEGATED_BROWSER_BEARER_NOT_PRESERVED");
            }
          } finally {
            await new Promise((resolve, reject) =>
              server.close((error) => error ? reject(error) : resolve())
            );
          }

          await resolveDelegatedUserToken(
            {
              header: (name) => name.toLowerCase() === "authorization" ? "Bearer application-token" : undefined,
              rawHeaders: ["Authorization", "Bearer application-token"]
            },
            {
              expectedTenantId: "local-stratton-demo",
              expectedAudience: "44444444-4444-4444-4444-444444444444",
              requiredScope: "access_as_user",
              expectedClientApplicationId: "33333333-3333-3333-3333-333333333333"
            },
            {
              verify: async () => ({
                tid: "local-stratton-demo",
                oid: "application-object-id",
                aud: "44444444-4444-4444-4444-444444444444",
                azp: "33333333-3333-3333-3333-333333333333",
                idtyp: "app",
                exp: 1900000000
              })
            }
          ).then(
            () => {
              throw new Error("APPLICATION_TOKEN_WAS_ACCEPTED");
            },
            (error) => {
              if (error?.status !== 401 || error?.code !== "UNAUTHENTICATED") {
                throw error;
              }
            }
          );
        `
      ],
      { cwd: process.cwd() }
    )
  ).resolves.toBeDefined();
});

test("Phase 5 authority API denies an application principal at the human bundle-review seam", async () => {
  await expect(
    run(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        `
          import { createApiServer } from "../5-coding-r4/app/src/api-runtime.ts";
          import { InMemoryIdempotencyStore } from "../5-coding-r4/app/src/idempotency-store.ts";
          import { StructuredLogger } from "../5-coding-r4/app/src/logger.ts";
          import { InMemoryQueueRouter } from "../5-coding-r4/app/src/queue-adapters.ts";
          import { InMemoryWorkloadRepository } from "../5-coding-r4/app/src/workload-repository.ts";

          const principal = Buffer.from(JSON.stringify({
            auth_typ: "aad",
            role_typ: "roles",
            claims: [
              { typ: "tid", val: "tenant-a" },
              { typ: "oid", val: "application-object-id" },
              { typ: "iss", val: "https://login.microsoftonline.com/tenant-a/v2.0" },
              { typ: "idtyp", val: "app" },
              { typ: "appid", val: "demo-bff" },
              { typ: "roles", val: "DealReviewer" }
            ]
          }), "utf8").toString("base64");
          const { server } = createApiServer({
            repository: new InMemoryWorkloadRepository(),
            idempotencyStore: new InMemoryIdempotencyStore(),
            queueProducer: new InMemoryQueueRouter(),
            logger: new StructuredLogger("test"),
            requestBodyLimitBytes: 32768,
            modelProviderEvidenceId: "model-evidence",
            regionalDeploymentEvidenceId: "region-evidence",
            promptGovernanceEvidenceId: "prompt-evidence",
            idempotencyLeaseDurationSeconds: 120,
            analysisCapabilityEnabled: true,
            auditExportCapabilityEnabled: true,
            completionClientId: "demo-bff"
          });
          await new Promise((resolve) => server.listen(0, resolve));
          const address = server.address();
          if (!address || typeof address === "string") {
            throw new Error("PHASE5_FIXTURE_ADDRESS_UNAVAILABLE");
          }
          try {
            const response = await fetch(
              "http://127.0.0.1:" + address.port +
                "/v1/demo-authority/cases/project-danube/analysis-bundles/bundle-1/reviews",
              {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "idempotency-key": "application-review-denial",
                  "x-ms-client-principal": principal
                },
                body: JSON.stringify({})
              }
            );
            const body = await response.json();
            if (response.status !== 403 || body.code !== "POLICY_DENIED") {
              throw new Error(
                "APPLICATION_REVIEW_NOT_DENIED:" + response.status + ":" + JSON.stringify(body)
              );
            }
          } finally {
            await new Promise((resolve, reject) =>
              server.close((error) => error ? reject(error) : resolve())
            );
          }
        `
      ],
      { cwd: process.cwd() }
    )
  ).resolves.toBeDefined();
});

test("local contract-equivalent authority uses every admitted evidence item and the exact completion subject version", async ({
  request
}) => {
  let scenario = await prepareAnalysis(request);
  const analysisAuthority = scenario.analysisAuthority as Record<string, string>;
  const subjectVersion = analysisAuthority.subjectVersion;
  expect(subjectVersion).toMatch(/^[a-f0-9]{64}$/);
  expect((scenario.latestAnalysisRun as { admittedEvidenceIds: string[] }).admittedEvidenceIds.sort()).toEqual(
    [...admittedEvidenceIds].sort()
  );

  for (const findingId of ["finding-ebitda-quality", "finding-permit-transfer"]) {
    expect(
      (
        await request.post(`/api/findings/${findingId}/disposition`, {
          data: { caseId, action: "ACCEPT" }
        })
      ).ok()
    ).toBeTruthy();
  }
  expect((await request.post("/api/governance/security-gates/run", { data: { caseId } })).ok()).toBeTruthy();

  const staleReview = await request.post("/api/findings/finding-ebitda-quality/reviews", {
    data: {
      caseId,
      reviewType: "DEAL",
      decision: "APPROVED",
      rationale: "A stale completion version must not authorize review.",
      subjectVersion: "stale-subject-version"
    }
  });
  expect(staleReview.status()).toBe(409);

  for (const [reviewType, findingId] of [
    ["DEAL", "finding-ebitda-quality"],
    ["LEGAL", "finding-permit-transfer"],
    ["COMPLIANCE", "finding-permit-transfer"]
  ] as const) {
    expect(
      (
        await request.post(`/api/findings/${findingId}/reviews`, {
          data: {
            caseId,
            reviewType,
            decision: "APPROVED",
            rationale: `${reviewType} review uses the Phase 5 completion subject version.`,
            subjectVersion
          }
        })
      ).ok()
    ).toBeTruthy();
  }
  expect((await request.post("/api/recommendation/prepare", { data: { caseId } })).ok()).toBeTruthy();

  scenario = (await (await request.get("/api/scenario")).json()) as Record<string, unknown>;
  const governedSubjectVersions = (scenario.governanceEvents as Array<Record<string, unknown>>)
    .filter((event) =>
      ["SPECIALIST_REVIEW_RECORDED", "COMMITTEE_PACK_DRAFT_PREPARED"].includes(String(event.type))
    )
    .map((event) => (event.metadata as Record<string, string>).subjectVersion);
  expect(governedSubjectVersions).toEqual([subjectVersion, subjectVersion, subjectVersion, subjectVersion]);
});
