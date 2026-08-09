# Final Review Fix Wave

## Result

Resolved all two Critical, three Important, and four directly related minor findings in one fix
wave. Phase 5 now owns a tenant-scoped, additive bundle lifecycle that does not depend on Release 1
analysis rows. The BFF and LOCAL fixture use the same completion contract, route evidence remains
behind real-tenant RLS, rerun denial occurs before authority/Azure work, and the complete clean
verification gate passes.

## Findings addressed

1. **Critical — route-evidence RLS**
   - Removed the `__model-route-evidence__` sentinel.
   - Changed repository lookup to `getApprovedModelRouteEvidence(tenantId, evidenceId)`.
   - SQL now uses `tenant_id=@tenant_id`, the real tenant session context, and tenant-scoped lookup.
   - The startup application-authenticated endpoint requires an explicit `tenantId` query value and
     verifies it equals the authenticated principal tenant.
   - The BFF supplies configured `DEMO_TENANT_ID`; in-memory and fake-SQL tests deny cross-tenant reads.

2. **Critical — additive bundle lifecycle**
   - Completion accepts `outputManifestHash`, exact bundle/route binding, and bundle-scoped citation
     counts including material-claim completeness.
   - The accepted output-manifest hash is persisted as authoritative `subjectVersion`.
   - Counts are persisted on `analysis_bundles`; GET, review, and draft use only bundle state.
   - Bundle lookup resolves from `analysis_bundles`, not `analysis_runs`.
   - In-memory API and BFF-to-real-Phase-5 integration cover create → complete → get → three reviews
     → draft without preseeded analysis-run, claim, or citation rows.

3. **Important — OpenAPI response drift**
   - `AnalysisBundleResponse` now requires strict `evidence[]` records with exactly
     `evidenceId`, `evidenceVersionId`, and `ordinal`.
   - Demo checks run outside the Release 1 loop and assert exact create, response, and completion
     property sets.

4. **Important — LOCAL completion parity**
   - LOCAL validates the exact application ID, lifecycle, output-manifest format, evidence/route
     binding, citation counts, material completeness, unsupported claims, replay, and conflicts.
   - Negative parity tests cover wrong application, stale binding, incomplete/impossible counts,
     and conflicting replay.

5. **Important — rerun guard**
   - Restored the pre-authority `assertAnalysisRerunAllowed(state)` check while retaining the
     post-run optimistic-concurrency check.
   - The covering test proves blocked reruns create no bundle, perform no Azure analysis, issue no
     completion, and do not read a completed bundle.

6. **Related contract fixes**
   - Completion OpenAPI documents application authentication and only `DRAFT_ONLY_READY`.
   - Removed create-request `evidenceManifestHash` consistently because the BFF cannot know the
     server-selected immutable evidence-version manifest before creation; Phase 5 still computes,
     returns, and binds the authoritative versioned manifest hash.
   - SQL completion uses `AND subject_version IS NULL`, checks affected rows, accepts an identical
     race replay, and rejects conflicting replay.
   - ARM account validation accepts only the design-approved exact kinds `OpenAI` and `AIServices`;
     broader `CognitiveServices` remains denied.

## Files

### Phase 5

- `5-coding-r4/app/migrations/002_demo_authority.sql`
- `5-coding-r4/app/openapi/stratton-openapi-3.1.yaml`
- `5-coding-r4/app/scripts/check-migrations.mjs`
- `5-coding-r4/app/scripts/check-openapi.mjs`
- `5-coding-r4/app/src/api-runtime.ts`
- `5-coding-r4/app/src/demo-authority-service.ts`
- `5-coding-r4/app/src/demo-authority-types.ts`
- `5-coding-r4/app/src/types.ts`
- `5-coding-r4/app/src/workload-repository.ts`
- `5-coding-r4/tests/app/support/demo-authority-fixture.ts`
- `5-coding-r4/tests/app/integration/contracts-and-migrations.test.ts`
- `5-coding-r4/tests/app/integration/demo-authority-api.test.ts`
- `5-coding-r4/tests/app/unit/demo-authority-repository.test.ts`
- `5-coding-r4/tests/app/unit/demo-authority-service.test.ts`
- `5-coding-r4/tests/app/unit/demo-authority-sql-repository.test.ts`

### Demo platform

- `demo-platform/apps/bff/src/analysis/analysis-service.ts`
- `demo-platform/apps/bff/src/analysis/analysis-service.test.ts`
- `demo-platform/apps/bff/src/azure/arm-cognitive-account-client.ts`
- `demo-platform/apps/bff/src/azure/arm-cognitive-account-client.test.ts`
- `demo-platform/apps/bff/src/azure/route-authority.ts`
- `demo-platform/apps/bff/src/azure/route-authority.test.ts`
- `demo-platform/apps/bff/src/phase5/demo-authority-client.ts`
- `demo-platform/apps/bff/src/phase5/demo-authority-client.test.ts`
- `demo-platform/apps/bff/src/phase5/governed-workflow-client.ts`
- `demo-platform/apps/bff/src/phase5/governed-workflow-client.test.ts`
- `demo-platform/apps/bff/src/phase5/local-demo-authority-client.ts`
- `demo-platform/apps/bff/src/phase5/local-demo-authority-client.test.ts`
- `demo-platform/tests/security/phase5-boundary.spec.ts`
- `demo-platform/tests/security/route-authority.spec.ts`
- `demo-platform/README.md`
- `demo-platform/infra/ADMIN-HANDOFF.md`

## RED evidence

### Phase 5 final-review reproductions

```powershell
Set-Location .\5-coding-r4\app
node --import tsx --test `
  ..\tests\app\unit\demo-authority-repository.test.ts `
  ..\tests\app\unit\demo-authority-sql-repository.test.ts `
  ..\tests\app\unit\demo-authority-service.test.ts `
  ..\tests\app\integration\demo-authority-api.test.ts
npm run check:openapi
npm run check:migrations
```

Initial result: 10 tests, 3 passed and 7 failed. Failures reproduced cross-tenant route visibility,
sentinel SQL context, missing tenant predicate, Release 1 lifecycle dependence, non-atomic SQL
completion, and replay conflict handling. OpenAPI failed on the stale create/response property set;
migration checks failed because bundle citation columns were absent.

### BFF and LOCAL parity reproductions

```powershell
Set-Location .\demo-platform
npm --workspace @stratton/demo-bff test -- `
  src/phase5/demo-authority-client.test.ts `
  src/phase5/local-demo-authority-client.test.ts `
  src/analysis/analysis-service.test.ts `
  src/azure/arm-cognitive-account-client.test.ts `
  src/azure/route-authority.test.ts
```

Initial result: exit 1. New tests reproduced permissive LOCAL completion, missing explicit route
tenant propagation, late rerun denial, stale completion payloads, and `AIServices` rejection.

Additional focused RED proofs:

- Impossible material counts: 1 test failed with `Missing expected rejection`.
- Reordered idempotent completion replay: 1 test failed with
  `ANALYSIS_BUNDLE_COMPLETION_CONFLICT`.

## GREEN evidence

### Phase 5

```powershell
Set-Location .\5-coding-r4\app
npm run validate
```

- Format, lint, typecheck, build, OpenAPI, migrations, and Docker checks passed.
- Unit: **55/55**.
- Integration: **35/35**.

### Demo workspaces

```powershell
Set-Location .\demo-platform
npm run validate
```

- BFF: **189/189**.
- Web: **49/49**.
- Contracts: **9/9**.
- Scenario data: **7/7**.
- Script tests: **9/9**.
- Lint, typecheck, and builds passed.

### Acceptance and infrastructure

```powershell
npx playwright test
az bicep lint --file .\infra\main.bicep
az bicep build --file .\infra\main.bicep --stdout
az bicep build-params --file .\infra\parameters\dev.bicepparam `
  --outfile .\infra\parameters\dev.parameters.json
pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1
```

- Playwright/security acceptance: **13/13**.
- Explicit BFF-to-real-Phase-5 contract test: **1/1**.
- Offline Bicep lint/build/build-params passed; generated parameter output removed.
- Pester: **20/20**.

### Complete clean gate

```powershell
Set-Location .\demo-platform
npm run clean:generated
node .\scripts\verify-demo.mjs
npm run clean:generated
```

Final result: exit code **0**. The gate restored Phase 5 dependencies, ran full Phase 5 validation,
all demo lint/typecheck/test/build steps, Playwright, offline Bicep checks, and Pester. Generated
outputs were removed afterward.

No Azure login, deployment, what-if, provisioning, or live runtime test was run.

## Self-review

- Confirmed no RLS sentinel or bypass remains.
- Confirmed route-evidence SQL includes both real tenant predicate and real tenant session context.
- Confirmed completion/GET/review/draft contain no `analysis_runs`, `material_claims`, or `citations`
  dependency.
- Confirmed response shaping does not expose internal tenant/count persistence fields unexpectedly.
- Confirmed citation invariants reject negative, unsupported, zero-material, over-total, and
  incomplete-material assessments.
- Confirmed SQL and LOCAL replay compare semantic fields rather than object property order.
- Confirmed no raw prompt, completion, document, or token persistence was added.
- Confirmed `git -c core.whitespace=cr-at-eol diff --check` passes.

## Concerns

- Root `npm ci` reports 13 inherited audit findings; Phase 5 `npm ci` reports one inherited moderate
  finding. No dependency manifest changed.
- Existing Node deprecation/module-type warnings, pending `esbuild` allow-scripts warning, Vite
  chunk-size warning, and Bicep upgrade notice remain informational.
- Deployment remains explicitly out of scope and requires separate authorization.
