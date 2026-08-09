# Stratton demo platform

Local-only Stratton evidence-to-decision demo for synthetic Project Danube.

## Prerequisites

- Windows PowerShell or PowerShell 7
- Node `>=22.0.0 <27.0.0`
- npm (ships with Node)
- Azure CLI with Bicep support for offline `az bicep build` only
- Playwright runs with the locally installed Edge channel on Windows in this repo config

Install dependencies:

```powershell
Set-Location .\demo-platform
npm ci
```

## Local startup

Start the BFF:

```powershell
Set-Location .\demo-platform
$env:DEMO_MODE = "LOCAL"
$env:PORT = "3001"
$env:PHASE5_API_BASE_URL = "http://127.0.0.1:3001"
npx tsx .\apps\bff\src\server.ts
```

Start the web app in another shell:

```powershell
Set-Location .\demo-platform
npm run dev --workspace @stratton/demo-web -- --host 127.0.0.1 --port 4173
```

LOCAL mode uses one fixed synthetic identity with the approved demo roles. It is selected only when
`DEMO_MODE=LOCAL`; AZURE mode requires Container Apps authentication claims and cannot activate the
synthetic seam. The local fixture carries the deterministic delegated-user token
`local-delegated-token-fixture` through the BFF authority seam; it is not an Entra token and cannot
activate any Azure credential or runtime call. Client-supplied authority headers such as
`x-demo-principal-type` are rejected.

Routes:

- `http://127.0.0.1:4173/workbench`
- `http://127.0.0.1:4173/decision-room`
- `http://127.0.0.1:4173/governance`

Playwright acceptance runs do **not** reuse existing listeners on ports `3001` or `4173`. If either port is already occupied, Playwright fails closed instead of attaching to a stale or Azure-backed server.

## Reset the scenario

Reset the standard Project Danube baseline:

```powershell
Set-Location .\demo-platform
node .\scripts\reset-scenario.mjs
```

Optional prompt-injection rehearsal fixture:

```powershell
Set-Location .\demo-platform
node .\scripts\reset-scenario.mjs --fixture prompt-injection
```

Licence-denial fixtures:

```powershell
node .\scripts\reset-scenario.mjs --fixture expired-licence
node .\scripts\reset-scenario.mjs --fixture missing-licence
```

## Demo roles

- `Elena Müller` — Deal Lead persona shown in the shell
- `Stratton.Demo.Analyst` — evidence, analysis, and finding disposition
- `Stratton.Demo.DealReviewer` — financial/commercial/operational review
- `Stratton.Demo.LegalReviewer` — Legal-domain review
- `Stratton.Demo.ComplianceReviewer` — Legal/ESG/operational compliance review
- `Stratton.Demo.GovernanceOperator` — deterministic security-gate evidence
- `Stratton.Demo.CommitteePreparer` — committee-pack draft preparation
- Every privileged role also requires `Stratton.Demo.ProjectDanube.Access` and
  `Stratton.Demo.EvidenceToDecision` in the configured tenant.

## Scripted demo sequence

1. Open `/workbench`.
2. Select `Reset Project Danube` and confirm `Confirm reset`.
3. Admit these four evidence items:
   - `FY25 Board Pack`
   - `ERP Customer Rebate Export`
   - `Quality of Earnings Report`
   - `Czech Environmental Permit`
4. Set `Analysis task` to `Cross-document comparison`.
5. Set `Question` to `Challenge management EBITDA quality`.
6. Run `Run grounded analysis`.
7. Confirm the `Adjusted EBITDA quality` finding shows `EUR 4.2–5.1 million` and `3 citations`.
8. Accept `Adjusted EBITDA quality` and `Permit transfer readiness`.
9. Open `/governance`, select `Security & audit`, and run `Run security gate checks`.
10. Confirm all twelve current, version-bound gates show `PASS`.
11. Open `/decision-room`.
12. Approve Deal for the EBITDA finding and Legal plus Compliance for the permit finding.
13. Run `Prepare committee pack`.
14. Confirm `Submit to committee` stays disabled.
15. Return to `/governance` and confirm `Internal Audit verdict: Not issued`.

## Validation commands

Whole local verification:

```powershell
Set-Location .\demo-platform
npm run clean:generated
npm ci
node .\scripts\verify-demo.mjs
```

`verify-demo.mjs` fails closed if `infra\main.json` already exists before verification, and it removes the generated Bicep output when the verification run created it, on both success and failure.
It first runs `npm run validate` from `..\5-coding-r4\app`, then builds the contracts and
scenario-data workspaces before any consuming demo-platform typecheck or test. Per-command working
directories preserve fail-fast exit codes and generated-file cleanup, so no pre-existing `dist`
directory is required.

The additive Phase 5 authority routes are limited to analysis-bundle creation and lookup,
service-principal completion, human bundle reviews, draft preparation, and model-route-evidence
lookup under `/v1/demo-authority`. They produce only `DRAFT_ONLY` output; no investment-decision or
committee-submission operation exists.

Remove only known generated workspace outputs:

```powershell
npm run clean:generated
```

Individual commands:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright test
npx playwright test tests\security
npx playwright test tests\e2e\evidence-to-decision.spec.ts --grep "axe reports zero serious or critical violations"
az bicep build --file infra/main.bicep
az bicep lint --file infra/main.bicep
az bicep build-params --file infra/parameters/dev.bicepparam --outfile infra/parameters/dev.parameters.json
pwsh -NoProfile -File tests\iac\Invoke-DemoIaCTests.ps1
```

## Azure configuration names

Local mode uses only:

- `DEMO_MODE`
- `PORT`
- `PHASE5_API_BASE_URL`

Azure-mode configuration names are documented here for completeness only; do not use them for this local acceptance gate:

- `DEMO_TENANT_ID`
- `AZURE_SQL_SERVER_FQDN`
- `AZURE_SQL_DATABASE_NAME`
- `PHASE5_DELEGATED_SCOPE`
- `PHASE5_APPLICATION_ID`
- `BFF_ENTRA_CLIENT_ID`
- `BFF_DELEGATED_AUDIENCE`
- `BFF_REQUIRED_DELEGATED_SCOPE`
- `BFF_ALLOWED_CLIENT_APPLICATION_ID`
- `ENTRA_TOKEN_ENDPOINT`
- `AZURE_MANAGED_IDENTITY_CLIENT_ID`
- `WEB_ENTRA_CLIENT_ID`
- `WEB_BFF_DELEGATED_SCOPE`
- `BFF_INTERNAL_BASE_URL`
- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
- `AZURE_SEARCH_ENDPOINT`
- `AZURE_SEARCH_INDEX_NAME`
- `AZURE_BLOB_ACCOUNT_URL`
- `AZURE_BLOB_CONTAINER_NAME`
- `AZURE_SERVICE_BUS_NAMESPACE`
- `AZURE_SERVICE_BUS_QUEUE_NAME`
- `AZURE_OPENAI_LUNA_ENDPOINT`
- `AZURE_OPENAI_LUNA_RESOURCE_ID`
- `AZURE_OPENAI_LUNA_REGION`
- `AZURE_OPENAI_LUNA_DEPLOYMENT_ID`
- `AZURE_OPENAI_LUNA_API_VERSION`
- `AZURE_OPENAI_LUNA_EVIDENCE_ID`
- `AZURE_OPENAI_TERRA_ENDPOINT`
- `AZURE_OPENAI_TERRA_RESOURCE_ID`
- `AZURE_OPENAI_TERRA_REGION`
- `AZURE_OPENAI_TERRA_DEPLOYMENT_ID`
- `AZURE_OPENAI_TERRA_API_VERSION`
- `AZURE_OPENAI_TERRA_EVIDENCE_ID`
- `AZURE_OPENAI_SOL_ENDPOINT`
- `AZURE_OPENAI_SOL_RESOURCE_ID`
- `AZURE_OPENAI_SOL_REGION`
- `AZURE_OPENAI_SOL_DEPLOYMENT_ID`
- `AZURE_OPENAI_SOL_API_VERSION`
- `AZURE_OPENAI_SOL_EVIDENCE_ID`

The production web image runs the typed server in `apps\web\server\server.ts`. Browser `/api`
requests remain same-origin. In Azure mode, MSAL Browser uses authorization code with PKCE to acquire
the BFF delegated scope. The server accepts exactly one Bearer Authorization header, forwards it
unchanged to the internal BFF FQDN supplied as `BFF_INTERNAL_BASE_URL`, and never creates identity or
role headers. In local Vite mode no Entra call or access token is required.

Luna, Terra, and Sol require HTTPS `*.openai.azure.com` endpoints, matching Cognitive Services
account resource IDs, deployments, permitted EU regions, API versions, and route-specific versioned
evidence IDs. AZURE startup validates each binding against live ARM account/deployment metadata and
the Phase 5 approved route-evidence record, including its evidence version and current validity
period. Any mismatch fails startup; there is no route or region fallback.

## AZURE delegated OBO prerequisites

These prerequisites are configuration guidance only; they are not part of local verification:

- Register the browser as a public SPA for the exact redirect URI. MSAL Browser uses authorization
  code plus PKCE to acquire `WEB_BFF_DELEGATED_SCOPE`; do not configure a client secret,
  certificate, or web token store.
- Grant admin consent for the browser-to-BFF delegated scope. Configure Easy Auth to accept only the
  BFF client-ID audience and the registered browser client application; the BFF independently
  verifies tenant, issuer, expiry, audience, `azp`, and delegated scope.
- Grant the BFF application the Phase 5 delegated scope. Its managed identity federated credential
  supplies the OBO `client_assertion` for `api://AzureADTokenExchange/.default`; no secret is used.
- Configure Phase 5 `DEMO_AUTHORITY_COMPLETION_CLIENT_ID` with the deployed BFF managed-identity
  client ID and authorize only that service principal to complete bundles. This is a Phase 5 setting,
  not a BFF runtime setting.

See `infra\ADMIN-HANDOFF.md` for app-role assignments, SQL bootstrap, and exact RBAC scopes.

## Explicit no-deployment boundary

This task stops at local build, test, Playwright, Bicep compilation, and Pester validation.

Do **not** run any of the following from this README or `verify-demo.mjs`:

- `az login`
- `az deployment ...`
- `az deployment group|sub|mg|tenant what-if ...`
- Azure runtime smoke tests against deployed resources

## Troubleshooting

### POLICY_DENIED

- Use `project-danube` for allowed requests.
- A `project-vltava` request is expected to fail with `POLICY_DENIED`.
- The prompt-injection fixture intentionally keeps hostile evidence quarantined.

### Missing citations or missing EUR 4.2–5.1 million finding

- Reset the scenario.
- Admit all four baseline evidence items before running analysis.
- Use `Cross-document comparison` with `Challenge management EBITDA quality`.
- EXPIRED or MISSING evidence licences are intentionally denied and recorded against security gate
  `CC002-R2-SEC-GATE-008`.

### Committee pack remains blocked

- Confirm Deal approval targets `finding-ebitda-quality`.
- Confirm Legal and Compliance approvals target `finding-permit-transfer`.
- Use the exact authoritative `analysisAuthority.subjectVersion` returned after Phase 5 completion;
  a finding text version or a stale completion version is rejected.
- Re-run the deterministic security-gate checks after a new analysis or failed hostile test; stale,
  failed, or not-run gate evidence cannot satisfy readiness.

### Entra consent, OBO, or completion failures

- Confirm tenant admin consent for both browser-to-BFF and BFF-to-Phase-5 delegated scopes.
- Confirm the browser sends exactly one bearer token to the same-origin `/api` route; missing,
  malformed, repeated, application-only, or wrong-scope tokens are denied before a human review.
- Confirm the BFF federated credential trusts the deployed BFF managed identity and the tenant token
  endpoint matches `DEMO_TENANT_ID`. Do not replace this OBO assertion with a secret.
- For completion denial, confirm `DEMO_AUTHORITY_COMPLETION_CLIENT_ID` is the BFF managed-identity
  client ID, not the BFF application registration client ID.

### ARM or route-evidence startup failure

- Verify the account resource ID, HTTPS endpoint account name, deployment, actual ARM region, API
  version, route-evidence ID and version, and evidence validity interval agree for each Luna, Terra,
  and Sol route.
- Use only the accepted EU regions. Correct the owner-approved route-evidence record or deployment
  configuration; do not introduce a region or route fallback.

### Unavailable routes or failed page loads

- Confirm the BFF is listening on `http://127.0.0.1:3001/healthz`.
- Confirm the web app is listening on `http://127.0.0.1:4173/workbench`.
- If Playwright is starting servers, let `playwright.config.ts` manage them.
- If port `3001` or `4173` is already occupied, stop the other listener first; the acceptance config intentionally refuses to reuse it.

### Stale scenario state

- Run `node .\scripts\reset-scenario.mjs`.
- Or use `Reset Project Danube` in the shell and confirm the reset dialog.
- If a previous run already created governed findings, reset before re-running analysis.
- If `infra\main.json` exists from an interrupted verification, inspect it before deletion; `verify-demo.mjs` will not overwrite a pre-existing file.
