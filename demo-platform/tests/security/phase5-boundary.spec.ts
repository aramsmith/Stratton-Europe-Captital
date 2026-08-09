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

test("local delegated identity fixture preserves the browser bearer and blocks application tokens before human review", async () => {
  await expect(
    run(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "--eval",
        `
          import request from "supertest";
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
          const response = await request(app)
            .post("/api/scenario")
            .set("authorization", "Bearer local-delegated-user-token");
          if (
            response.status !== 204 ||
            forwarded.length !== 1 ||
            forwarded[0].headers.authorization !== "Bearer local-delegated-user-token"
          ) {
            throw new Error("DELEGATED_BROWSER_BEARER_NOT_PRESERVED");
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
