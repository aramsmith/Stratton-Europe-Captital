# Stratton Phase 5 OBO and Route Authority Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backward-compatible Phase 5 demo-authority API, delegated Microsoft Entra OBO identity propagation, and authoritative Azure OpenAI route validation so the completed Stratton demo can pass final handoff review without weakening human authority.

**Architecture:** Existing Phase 5 Release 1 endpoints remain unchanged. New `/v1/demo-authority` endpoints govern cross-document analysis bundles, service-authenticated completion, bundle reviews, draft preparation, and approved model-route evidence. The web proxy forwards a delegated user token to the BFF, the BFF exchanges it for a delegated Phase 5 token using managed-identity-backed OBO, and AZURE startup validates each model route against both ARM resource metadata and Phase 5 evidence.

**Tech Stack:** Node.js 22–26, TypeScript 5.9.2, Express 5.1.0, Zod 4.1.5, Azure Identity 4.13.1, Azure Container Apps authentication, Microsoft Entra OAuth 2.0 OBO, Azure Resource Manager REST, Bicep, Node test runner, Vitest 3.2.4, Playwright 1.55.0, and Pester.

## Global Constraints

- Preserve every existing Phase 5 Release 1 endpoint and its behavior; all new API operations live under `/v1/demo-authority`.
- Phase 5 remains the source of authority for bundle lifecycle, subject version, reviews, and draft preparation.
- Human operations require delegated Microsoft Entra user identity; application-only tokens cannot perform admissions, reviews, or draft preparation.
- The completion endpoint accepts only the explicitly configured demo BFF service principal.
- The browser and web proxy must not manufacture principal or role headers.
- No client secret is stored; OBO uses a managed-identity-backed federated client assertion.
- Missing identity, consent, scope, role, case access, evidence, citation, route evidence, or dependency fails closed.
- No investment-decision or committee-submission operation may be added.
- Luna, Terra, and Sol bindings require an exact match across supplied configuration, ARM resource metadata, deployment metadata, and Phase 5 route evidence.
- LOCAL mode uses deterministic contract-equivalent fixtures and cannot activate AZURE credentials or runtime validation.
- Do not run Azure login, deployment, what-if, provisioning, or runtime tests without separate authorization.
- Keep synthetic Project Danube data only.
- Keep raw tokens, documents, prompts, completions, and secrets out of telemetry.
- Work in `C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform`.
- The approved design is `docs/superpowers/specs/2026-08-07-stratton-phase5-obo-route-authority-design.md`.

---

## Planned File Structure

```text
5-coding-r4/
  app/
    migrations/002_demo_authority.sql
    openapi/stratton-openapi-3.1.yaml
    src/
      demo-authority-service.ts
      demo-authority-types.ts
      api-runtime.ts
      config.ts
      types.ts
      workload-repository.ts
  tests/app/
    unit/demo-authority-service.test.ts
    integration/demo-authority-api.test.ts
    integration/contracts-and-migrations.test.ts

demo-platform/
  apps/
    bff/src/
      identity/delegated-token.ts
      identity/obo-token-exchange.ts
      identity/*.test.ts
      phase5/demo-authority-client.ts
      phase5/demo-authority-client.test.ts
      phase5/governed-workflow-client.ts
      azure/arm-cognitive-account-client.ts
      azure/route-authority.ts
      azure/*.test.ts
      analysis/analysis-service.ts
      reviews/review-service.ts
      config.ts
      server.ts
    web/server/
      server.ts
      server.test.ts
  packages/
    contracts/src/index.ts
    scenario-data/src/project-danube.ts
  infra/
    main.bicep
    modules/demo-apps/main.bicep
    modules/demo-rbac/main.bicep
    modules/demo-rbac/role-assignments/cognitive-account-reader.bicep
    parameters/dev.bicepparam
    ADMIN-HANDOFF.md
  tests/
    e2e/evidence-to-decision.spec.ts
    security/authority-abuse.spec.ts
    iac/DemoInfra.Tests.ps1
  README.md
```

### Task 1: Add Phase 5 analysis-bundle contracts and persistence

**Files:**
- Create: `5-coding-r4/app/src/demo-authority-types.ts`
- Create: `5-coding-r4/app/migrations/002_demo_authority.sql`
- Modify: `5-coding-r4/app/src/types.ts`
- Modify: `5-coding-r4/app/src/workload-repository.ts`
- Modify: `5-coding-r4/app/openapi/stratton-openapi-3.1.yaml`
- Modify: `5-coding-r4/tests/app/integration/contracts-and-migrations.test.ts`
- Create: `5-coding-r4/tests/app/unit/demo-authority-repository.test.ts`

**Interfaces:**
- Consumes: existing `CaseRecord`, `EvidenceRecord`, `EvidenceObjectRecord`, `ReviewType`, `ReviewDecision`, repository transaction and idempotency patterns.
- Produces:

```ts
export type AnalysisBundleStatus =
  | "QUEUED"
  | "IN_PROGRESS"
  | "DRAFT_ONLY_READY"
  | "BLOCKED_MISSING_EVIDENCE"
  | "FAILED";

export interface AnalysisBundleRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly evidenceManifestHash: string;
  readonly modelRoute: "LUNA" | "TERRA" | "SOL";
  readonly modelDeploymentId: string;
  readonly routeEvidenceId: string;
  readonly promptTemplateVersion: string;
  readonly requestFingerprint: string;
  readonly status: AnalysisBundleStatus;
  readonly outputKind: "DRAFT_ONLY";
  readonly unsupportedClaims: number;
  readonly subjectVersion?: string;
}

export interface AnalysisBundleEvidenceRecord {
  readonly tenantId: string;
  readonly caseId: string;
  readonly analysisBundleId: string;
  readonly evidenceId: string;
  readonly evidenceVersionId: string;
  readonly ordinal: number;
}

export interface ApprovedModelRouteEvidence {
  readonly evidenceId: string;
  readonly status: "APPROVED" | "SUSPENDED" | "EXPIRED";
  readonly resourceId: string;
  readonly deploymentId: string;
  readonly region: string;
  readonly route: "LUNA" | "TERRA" | "SOL";
  readonly apiVersion: string;
  readonly evidenceVersion: string;
  readonly validFromIso: string;
  readonly validUntilIso: string;
}
```

- [ ] **Step 1: Write failing repository and migration tests**

```ts
test("stores an immutable ordered evidence manifest for an analysis bundle", async () => {
  const repository = new InMemoryWorkloadRepository();
  await repository.createAnalysisBundle(bundle);
  await repository.appendAnalysisBundleEvidence(firstEvidence);
  await repository.appendAnalysisBundleEvidence(secondEvidence);

  assert.deepEqual(
    await repository.listAnalysisBundleEvidence("tenant-a", "project-danube", "bundle-1"),
    [firstEvidence, secondEvidence]
  );
});

test("rejects conflicting completion replay", async () => {
  const repository = new InMemoryWorkloadRepository();
  await repository.createAnalysisBundle(bundle);
  await repository.completeAnalysisBundle(completion);

  await assert.rejects(
    repository.completeAnalysisBundle({ ...completion, subjectVersion: "different" }),
    /ANALYSIS_BUNDLE_COMPLETION_CONFLICT/
  );
});
```

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
Set-Location .\5-coding-r4\app
npm run test:unit -- --test-name-pattern "analysis bundle"
npm run check:migrations
npm run check:openapi
```

Expected: FAIL because bundle repository methods, migration `002_demo_authority.sql`, and OpenAPI paths do not exist.

- [ ] **Step 3: Add additive OpenAPI paths**

Add these operations without changing existing paths:

```yaml
/v1/demo-authority/cases/{caseId}/analysis-bundles:
  post:
    operationId: createDemoAnalysisBundle
/v1/demo-authority/analysis-bundles/{analysisBundleId}:
  get:
    operationId: getDemoAnalysisBundle
/v1/demo-authority/analysis-bundles/{analysisBundleId}/completion:
  post:
    operationId: completeDemoAnalysisBundle
/v1/demo-authority/cases/{caseId}/analysis-bundles/{analysisBundleId}/reviews:
  post:
    operationId: submitDemoBundleReview
/v1/demo-authority/cases/{caseId}/analysis-bundles/{analysisBundleId}/draft-recommendations:
  post:
    operationId: prepareDemoBundleDraft
/v1/demo-authority/model-route-evidence/{evidenceId}:
  get:
    operationId: getDemoModelRouteEvidence
```

Define strict request/response schemas with `additionalProperties: false`, singular `subjectVersion`, ordered `evidenceIds`, citation counts, and `DRAFT_ONLY` output.

- [ ] **Step 4: Implement in-memory and SQL repository contracts**

Add repository methods:

```ts
createAnalysisBundle(record: AnalysisBundleRecord): Promise<void>;
getAnalysisBundle(tenantId: string, caseId: string, bundleId: string): Promise<AnalysisBundleRecord | undefined>;
appendAnalysisBundleEvidence(record: AnalysisBundleEvidenceRecord): Promise<void>;
listAnalysisBundleEvidence(tenantId: string, caseId: string, bundleId: string): Promise<readonly AnalysisBundleEvidenceRecord[]>;
completeAnalysisBundle(record: AnalysisBundleCompletionRecord): Promise<void>;
appendAnalysisBundleReview(record: AnalysisBundleReviewRecord): Promise<void>;
listAnalysisBundleReviews(tenantId: string, caseId: string, bundleId: string): Promise<readonly AnalysisBundleReviewRecord[]>;
getApprovedModelRouteEvidence(evidenceId: string): Promise<ApprovedModelRouteEvidence | undefined>;
```

Migration tables must include tenant/case keys, unique idempotency constraints, immutable evidence ordinals, row-level security predicates, and no raw content columns.

- [ ] **Step 5: Run Phase 5 validation**

Run:

```powershell
Set-Location .\5-coding-r4\app
npm run test:unit
npm run check:openapi
npm run check:migrations
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add 5-coding-r4\app\src 5-coding-r4\app\migrations\002_demo_authority.sql 5-coding-r4\app\openapi 5-coding-r4\tests
git commit -m "feat: add Phase 5 demo authority contracts"
```

### Task 2: Implement the additive Phase 5 authority lifecycle

**Files:**
- Create: `5-coding-r4/app/src/demo-authority-service.ts`
- Create: `5-coding-r4/tests/app/unit/demo-authority-service.test.ts`
- Create: `5-coding-r4/tests/app/integration/demo-authority-api.test.ts`
- Modify: `5-coding-r4/app/src/api-runtime.ts`
- Modify: `5-coding-r4/app/src/config.ts`
- Modify: `5-coding-r4/app/src/index.ts`

**Interfaces:**
- Consumes: Task 1 repository methods and records.
- Produces: `createDemoAuthorityService(config)` and six `/v1/demo-authority` handlers.

- [ ] **Step 1: Write failing delegated-human and service-principal tests**

```ts
test("bundle creation requires a delegated human DealContributor", async () => {
  const response = await request(app)
    .post("/v1/demo-authority/cases/project-danube/analysis-bundles")
    .set("x-ms-client-principal", encodePrincipal({
      idtyp: "user",
      roles: ["DealContributor"]
    }))
    .send(validBundleRequest);
  assert.equal(response.status, 202);
});

test("application principal cannot submit a human review", async () => {
  const response = await request(app)
    .post("/v1/demo-authority/cases/project-danube/analysis-bundles/bundle-1/reviews")
    .set("x-ms-client-principal", encodePrincipal({
      idtyp: "app",
      appid: "demo-bff"
    }))
    .send(validReview);
  assert.equal(response.status, 403);
});

test("only the configured BFF application can complete a bundle", async () => {
  const response = await request(app)
    .post("/v1/demo-authority/analysis-bundles/bundle-1/completion")
    .set("x-ms-client-principal", encodePrincipal({
      idtyp: "app",
      appid: "unexpected-app"
    }))
    .send(validCompletion);
  assert.equal(response.status, 403);
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```powershell
Set-Location .\5-coding-r4\app
node --import tsx --test ..\tests\app\integration\demo-authority-api.test.ts
```

Expected: FAIL with 404 or missing service exports.

- [ ] **Step 3: Implement bundle creation and status**

Bundle creation must:

1. require a human `DealContributor`;
2. validate case access and purpose;
3. deduplicate and sort `evidenceIds` into deterministic ordinal order;
4. validate every evidence item is admitted, licensed, extracted, indexed, and versioned;
5. validate the approved route-evidence record;
6. compute `evidenceManifestHash`;
7. create `QUEUED` bundle state under the existing transaction/idempotency wrapper.

Return:

```json
{
  "analysisBundleId": "deterministic-id",
  "status": "QUEUED",
  "evidenceManifestHash": "sha256",
  "evidence": [
    { "evidenceId": "ev-1", "evidenceVersionId": "evv-1", "ordinal": 1 }
  ]
}
```

- [ ] **Step 4: Implement service completion**

Require an application principal whose `appid`/`azp` equals `DEMO_AUTHORITY_COMPLETION_CLIENT_ID`.

Completion must reject:

- user principals;
- a different application;
- stale or duplicate conflicting completion;
- unsupported material claims;
- zero material claims;
- missing citations;
- route/deployment/evidence mismatch.

Successful completion persists `DRAFT_ONLY_READY` and returns:

```json
{
  "analysisBundleId": "bundle-1",
  "status": "DRAFT_ONLY_READY",
  "outputKind": "DRAFT_ONLY",
  "subjectVersion": "output-manifest-sha256"
}
```

- [ ] **Step 5: Implement bundle review and draft endpoints**

Human review rules:

```ts
const requiredRoleByReview = {
  DEAL: "DealReviewer",
  LEGAL: "LegalApprover",
  COMPLIANCE: "ComplianceApprover"
} as const;
```

Require exact bundle `subjectVersion`, review eligibility, complete citations, and idempotent replay. Draft preparation requires all applicable current approvals and returns only `DRAFT_RECOMMENDATION_READY` with `DRAFT_ONLY`.

- [ ] **Step 6: Implement approved route-evidence GET**

Require an authenticated `CaseReader` or configured BFF application principal. Return only safe metadata; never return documents or secrets. Expired/suspended evidence returns `403 POLICY_DENIED`.

- [ ] **Step 7: Run all Phase 5 tests**

Run:

```powershell
Set-Location .\5-coding-r4\app
npm run validate
```

Expected: all existing and new Phase 5 checks pass.

- [ ] **Step 8: Commit**

```powershell
git add 5-coding-r4
git commit -m "feat: implement Phase 5 demo authority lifecycle"
```

### Task 3: Add delegated token intake and managed-identity-backed OBO

**Files:**
- Create: `demo-platform/apps/bff/src/identity/delegated-token.ts`
- Create: `demo-platform/apps/bff/src/identity/delegated-token.test.ts`
- Create: `demo-platform/apps/bff/src/identity/obo-token-exchange.ts`
- Create: `demo-platform/apps/bff/src/identity/obo-token-exchange.test.ts`
- Create: `demo-platform/apps/bff/src/phase5/demo-authority-client.ts`
- Create: `demo-platform/apps/bff/src/phase5/demo-authority-client.test.ts`
- Modify: `demo-platform/apps/bff/src/config.ts`
- Modify: `demo-platform/apps/bff/src/server.ts`
- Modify: `demo-platform/apps/bff/src/identity/identity-resolver.ts`

**Interfaces:**
- Consumes: Container Apps `x-ms-client-principal` and `x-ms-token-aad-access-token`.
- Produces:

```ts
export interface DelegatedUserToken {
  readonly accessToken: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly scopes: readonly string[];
  readonly roles: readonly string[];
}

export interface OboTokenExchange {
  acquirePhase5Token(userAssertion: string): Promise<string>;
}

export interface DemoAuthorityClient {
  createAnalysisBundle(input: CreateAnalysisBundleInput): Promise<AnalysisBundleAccepted>;
  completeAnalysisBundle(input: CompleteAnalysisBundleInput): Promise<AnalysisBundleReady>;
  getAnalysisBundle(bundleId: string): Promise<AnalysisBundleStatus>;
  submitBundleReview(input: SubmitBundleReviewInput): Promise<void>;
  prepareBundleDraft(input: PrepareBundleDraftInput): Promise<void>;
  getModelRouteEvidence(evidenceId: string): Promise<ApprovedModelRouteEvidence>;
}
```

- [ ] **Step 1: Write failing token-validation tests**

Cover missing token, wrong tenant, wrong audience, expired token, application token, missing delegated scope, malformed JWT, and valid delegated token. Tests use signed local JWT fixtures or an injected verifier; they never decode-and-trust unsigned claims.

```ts
await expect(resolveDelegatedUserToken(request, policy)).rejects.toMatchObject({
  status: 401,
  code: "UNAUTHENTICATED"
});
```

- [ ] **Step 2: Write failing OBO protocol tests**

Assert the token request contains:

```text
grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
requested_token_use=on_behalf_of
assertion=<incoming-user-token>
scope=<phase5-delegated-scope>
client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer
client_assertion=<managed-identity-federated-token>
```

Assert no client secret is accepted or logged.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```powershell
Set-Location .\demo-platform
npm --workspace @stratton/demo-bff test -- src/identity/delegated-token.test.ts src/identity/obo-token-exchange.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement fail-closed AZURE configuration**

Add required AZURE settings:

```ts
PHASE5_DELEGATED_SCOPE
PHASE5_APPLICATION_ID
BFF_DELEGATED_AUDIENCE
BFF_REQUIRED_DELEGATED_SCOPE
ENTRA_TOKEN_ENDPOINT
AZURE_MANAGED_IDENTITY_CLIENT_ID
```

Reject non-HTTPS authority/base URLs and tenant mismatches. LOCAL mode uses explicit injected fixtures and does not read AZURE token settings.

- [ ] **Step 5: Implement OBO exchange**

Use `ManagedIdentityCredential` to acquire a federated assertion for `api://AzureADTokenExchange/.default`, then POST the OBO request to the tenant token endpoint. Cache only Phase 5 tokens by user assertion hash until before expiry. Clear failed exchanges and never persist the incoming assertion.

- [ ] **Step 6: Implement the demo-authority HTTP client**

Human endpoints use the OBO delegated token. Completion uses a separate BFF application token from managed identity. Forward correlation, traceparent, and deterministic idempotency. Match the strict Phase 5 schemas from Tasks 1–2.

- [ ] **Step 7: Run focused and package tests**

Run:

```powershell
Set-Location .\demo-platform
npm --workspace @stratton/demo-bff test
npm --workspace @stratton/demo-bff run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add demo-platform\apps\bff
git commit -m "feat: add delegated Phase 5 OBO client"
```

### Task 4: Replace the demo workflow with authoritative bundle orchestration

**Files:**
- Modify: `demo-platform/packages/contracts/src/index.ts`
- Modify: `demo-platform/packages/scenario-data/src/project-danube.ts`
- Modify: `demo-platform/apps/bff/src/phase5/governed-workflow-client.ts`
- Modify: `demo-platform/apps/bff/src/phase5/governed-workflow-client.test.ts`
- Modify: `demo-platform/apps/bff/src/analysis/analysis-service.ts`
- Modify: `demo-platform/apps/bff/src/analysis/analysis-service.test.ts`
- Modify: `demo-platform/apps/bff/src/reviews/review-service.ts`
- Modify: `demo-platform/apps/bff/src/reviews/review-service.test.ts`
- Modify: `demo-platform/apps/bff/src/server.ts`

**Interfaces:**
- Consumes: `DemoAuthorityClient` from Task 3 and existing Azure supporting adapters.
- Produces: scenario state containing `analysisBundleId` and authoritative `subjectVersion`.

- [ ] **Step 1: Write failing orchestration-order tests**

```ts
expect(callOrder).toEqual([
  "phase5:createBundle",
  "azure:requestAnalysis",
  "phase5:completeBundle",
  "phase5:getBundle"
]);
```

Add negative tests proving:

- authority denial prevents Azure calls;
- Azure failure prevents completion;
- completion failure prevents local success;
- missing subject version prevents visible findings;
- repeated fingerprint returns the same bundle without repeating Azure work.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```powershell
Set-Location .\demo-platform
npm --workspace @stratton/demo-bff test -- src/phase5/governed-workflow-client.test.ts src/analysis/analysis-service.test.ts
```

Expected: FAIL because existing orchestration calls the old single-run interface.

- [ ] **Step 3: Update shared contracts**

Add:

```ts
analysisAuthority: {
  analysisBundleId: string;
  evidenceManifestHash: string;
  subjectVersion: string;
  status: "DRAFT_ONLY_READY";
}
```

Remove use of locally synthesized subject versions for reviews and draft preparation. Existing visible findings and citations remain unchanged.

- [ ] **Step 4: Implement bundle analysis orchestration**

The analysis service must:

1. select admitted evidence IDs deterministically;
2. create a Phase 5 bundle using the human delegated token;
3. execute Azure supporting analysis;
4. derive output manifest and citation assessment;
5. complete Phase 5 using the BFF application identity;
6. fetch authoritative bundle status;
7. save local projection only after `DRAFT_ONLY_READY`.

- [ ] **Step 5: Implement authoritative reviews and draft preparation**

Map local review eligibility to Phase 5 bundle review endpoints. Use exact `subjectVersion` returned by Phase 5. Local projection follows Phase 5 success; it does not precede it.

- [ ] **Step 6: Preserve LOCAL mode**

Implement a contract-equivalent in-memory `DemoAuthorityClient` fixture. It must enforce the same human/application separation, evidence manifest, subject version, and lifecycle. It must be impossible to instantiate in AZURE mode.

- [ ] **Step 7: Run BFF, contracts, scenario, and web tests**

Run:

```powershell
Set-Location .\demo-platform
npm --workspace @stratton/contracts test
npm --workspace @stratton/scenario-data test
npm --workspace @stratton/demo-bff test
npm --workspace @stratton/demo-web test
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add demo-platform\packages demo-platform\apps\bff demo-platform\apps\web
git commit -m "feat: govern demo workflow with Phase 5 bundles"
```

### Task 5: Add authoritative ARM and Phase 5 route validation

**Files:**
- Create: `demo-platform/apps/bff/src/azure/arm-cognitive-account-client.ts`
- Create: `demo-platform/apps/bff/src/azure/arm-cognitive-account-client.test.ts`
- Create: `demo-platform/apps/bff/src/azure/route-authority.ts`
- Create: `demo-platform/apps/bff/src/azure/route-authority.test.ts`
- Modify: `demo-platform/apps/bff/src/azure/azure-config.ts`
- Modify: `demo-platform/apps/bff/src/azure/azure-config.test.ts`
- Modify: `demo-platform/apps/bff/src/server.ts`
- Modify: `demo-platform/apps/bff/src/telemetry/redacted-logger.test.ts`

**Interfaces:**
- Consumes: supplied route config, ARM token, `DemoAuthorityClient.getModelRouteEvidence`.
- Produces:

```ts
export interface AuthoritativeRouteBinding {
  readonly route: "LUNA" | "TERRA" | "SOL";
  readonly resourceId: string;
  readonly accountName: string;
  readonly location: string;
  readonly endpoint: string;
  readonly deploymentId: string;
  readonly apiVersion: string;
  readonly evidenceId: string;
  readonly evidenceVersion: string;
}
```

- [ ] **Step 1: Write failing ARM-client tests**

Use injected `fetch` and token factories. Assert the client requests:

```text
GET https://management.azure.com{resourceId}?api-version=2023-05-01
GET https://management.azure.com{resourceId}/deployments/{deploymentId}?api-version=2024-10-01
```

Validate exact resource ID, kind, location, endpoint, deployment parent, and model deployment ID.

- [ ] **Step 2: Write failing cross-authority tests**

Test valid match and each failure independently:

- ARM region differs from Phase 5 evidence;
- endpoint differs from ARM;
- evidence expired/suspended;
- route or deployment differs;
- account name differs;
- ARM or Phase 5 unavailable.

Every failure must throw a stable fail-closed configuration error.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```powershell
Set-Location .\demo-platform
npm --workspace @stratton/demo-bff test -- src/azure/arm-cognitive-account-client.test.ts src/azure/route-authority.test.ts
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement startup authority resolution**

`parseAzureDemoConfig` may validate syntax only. `resolveAuthoritativeRoutes` must replace declared `region` as authority with actual ARM `location` and Phase 5 evidence. Return immutable approved deployments only after all three routes pass.

- [ ] **Step 5: Restrict telemetry**

Log only route, resource ID hash, location, deployment ID hash, evidence ID, evidence version, and outcome. Never log ARM tokens, response bodies, or Phase 5 tokens.

- [ ] **Step 6: Run BFF tests and typecheck**

Run:

```powershell
Set-Location .\demo-platform
npm --workspace @stratton/demo-bff test
npm --workspace @stratton/demo-bff run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add demo-platform\apps\bff
git commit -m "feat: validate authoritative Azure model routes"
```

### Task 6: Configure Container Apps delegated authentication and least privilege

**Files:**
- Modify: `demo-platform/apps/web/server/server.ts`
- Modify: `demo-platform/apps/web/server/server.test.ts`
- Modify: `demo-platform/infra/main.bicep`
- Modify: `demo-platform/infra/modules/demo-apps/main.bicep`
- Modify: `demo-platform/infra/modules/demo-rbac/main.bicep`
- Create: `demo-platform/infra/modules/demo-rbac/role-assignments/cognitive-account-reader.bicep`
- Modify: `demo-platform/infra/parameters/dev.bicepparam`
- Modify: `demo-platform/infra/ADMIN-HANDOFF.md`
- Modify: `demo-platform/tests/iac/DemoInfra.Tests.ps1`

**Interfaces:**
- Consumes: Entra app IDs/scopes, Phase 5 app ID, BFF managed identity, three Cognitive Services resource IDs.
- Produces: private web/BFF Container Apps with token stores, delegated scopes, and ARM Reader assignments.

- [ ] **Step 1: Write failing web-proxy tests**

Assert the proxy:

- reads only `x-ms-token-aad-access-token`;
- forwards it as `Authorization: Bearer`;
- does not send `x-stratton-forwarded-principal`;
- returns 401 when the delegated token is missing;
- never uses managed identity for a human API request.

- [ ] **Step 2: Write failing IaC tests**

Assert compiled Bicep includes:

- Container Apps auth enabled on web and BFF;
- unauthenticated access rejected;
- web token store enabled;
- BFF delegated audience and issuer;
- explicit Phase 5 delegated scope and OBO settings;
- completion client ID;
- Reader role scoped to each supplied Cognitive Services account;
- no client secret or account key.

- [ ] **Step 3: Run focused tests and confirm failure**

Run:

```powershell
Set-Location .\demo-platform
npm --workspace @stratton/demo-web test -- server/server.test.ts
pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1
```

Expected: FAIL because current proxy uses managed identity and IaC lacks delegated/OBO authority settings.

- [ ] **Step 4: Update the production web proxy**

Forward the platform-provided delegated access token. Preserve content type, correlation ID, traceparent, body limits, and same-origin response handling. Do not decode the token in the web tier.

- [ ] **Step 5: Update Bicep authentication**

Add explicit parameters:

```bicep
param webDelegatedScope string
param bffDelegatedAudience string
param bffRequiredDelegatedScope string
param phase5ApplicationId string
param phase5DelegatedScope string
param demoAuthorityCompletionClientId string
```

Configure Container Apps auth/token store and environment variables. Keep both apps internal, HTTPS-only, digest-pinned, and separately identified.

- [ ] **Step 6: Add ARM Reader assignments**

Assign the BFF identity Reader on exactly the supplied Luna, Terra, and Sol Cognitive Services account IDs. Use deterministic assignment IDs and no subscription-wide scope.

- [ ] **Step 7: Update admin handoff**

Document:

1. web, BFF, and Phase 5 app registrations;
2. delegated scopes and admin consent;
3. BFF managed-identity federated credential;
4. completion application authorization;
5. token-store settings;
6. route-evidence record provisioning;
7. no-secret boundary.

- [ ] **Step 8: Build and test Bicep**

Run:

```powershell
Set-Location .\demo-platform
az bicep lint --file .\infra\main.bicep
az bicep build --file .\infra\main.bicep
az bicep build-params --file .\infra\parameters\dev.bicepparam
pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1
```

Expected: PASS. Do not run deployment or what-if.

- [ ] **Step 9: Commit**

```powershell
git add demo-platform\apps\web demo-platform\infra demo-platform\tests\iac
git commit -m "feat: configure delegated demo authentication"
```

### Task 7: Update acceptance, runbooks, and final verification

**Files:**
- Modify: `demo-platform/tests/e2e/evidence-to-decision.spec.ts`
- Modify: `demo-platform/tests/security/authority-abuse.spec.ts`
- Create: `demo-platform/tests/security/phase5-boundary.spec.ts`
- Create: `demo-platform/tests/security/route-authority.spec.ts`
- Modify: `demo-platform/scripts/verify-demo-lib.mjs`
- Modify: `demo-platform/README.md`
- Modify: `demo-platform/infra/ADMIN-HANDOFF.md`

**Interfaces:**
- Consumes: completed Phase 5 bundle lifecycle, OBO seam, route authority, and IaC.
- Produces: repeatable local evidence that both final blockers are resolved.

- [ ] **Step 1: Write failing end-to-end boundary tests**

Add local contract-equivalent acceptance tests proving:

- the browser/web/BFF chain carries delegated user identity;
- an application token cannot perform a human review;
- bundle creation uses all admitted evidence IDs;
- Phase 5 completion supplies the authoritative subject version;
- reviews and draft preparation use that exact version;
- no investment-decision operation exists.

- [ ] **Step 2: Write failing route-authority acceptance tests**

Use local ARM and Phase 5 fixtures to prove startup succeeds only when route, resource ID, endpoint, deployment, actual EU location, API version, evidence ID, evidence version, and validity period match.

- [ ] **Step 3: Run focused Playwright/security tests and confirm failure**

Run:

```powershell
Set-Location .\demo-platform
npx playwright test tests/security/phase5-boundary.spec.ts tests/security/route-authority.spec.ts
```

Expected: FAIL until the new local fixtures and startup wiring are complete.

- [ ] **Step 4: Update verification sequence**

Add Phase 5 validation before demo-platform tests:

```js
{ command: "npm", args: ["run", "validate"], cwd: "../5-coding-r4/app" }
```

Extend the command runner to support per-command `cwd` while preserving fail-fast exit codes and generated-file cleanup.

- [ ] **Step 5: Update README**

Document:

- local delegated identity fixture;
- AZURE OBO prerequisites;
- Phase 5 additive endpoints;
- ARM and route-evidence startup validation;
- exact local verification commands;
- explicit no-deployment boundary;
- troubleshooting for consent, OBO, subject-version, completion-client, ARM, and evidence mismatches.

- [ ] **Step 6: Run complete clean verification**

Run:

```powershell
Set-Location .\demo-platform
npm run clean:generated
npm ci
node .\scripts\verify-demo.mjs
```

Expected:

- Phase 5 validate passes;
- all demo unit/integration tests pass;
- Playwright passes;
- Bicep lint/build/build-params pass;
- Pester passes;
- no Azure login/deployment/what-if/runtime command runs;
- `git status --short` is clean after generated-output cleanup.

- [ ] **Step 7: Confirm acceptance boundaries**

Verify:

```powershell
git diff --name-only HEAD~1..HEAD | Select-String "5-coding-r4|demo-platform"
rg -n "approve investment|issue investment decision" .\demo-platform .\5-coding-r4
git status --short
```

Expected: only intended paths changed, no investment-decision operation exists, and the worktree is clean.

- [ ] **Step 8: Commit**

```powershell
git add 5-coding-r4 demo-platform
git commit -m "test: verify Phase 5 OBO and route authority"
```

---

## Final Acceptance

Before copying into the active case:

- run `npm run validate` in `5-coding-r4/app`;
- run `node scripts/verify-demo.mjs` in `demo-platform`;
- obtain a whole-branch review from the base before Task 1 through final HEAD;
- resolve all Critical and Important findings;
- confirm the approved design and plan copies in the active case match the committed worktree versions;
- confirm no Azure login, deployment, what-if, provisioning, or runtime test occurred;
- request a separate explicit user decision before deployment;
- copy the reviewed `demo-platform` and authorized additive `5-coding-r4` changes into the active local case without disturbing unrelated running processes.
