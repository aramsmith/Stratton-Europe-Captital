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

Routes:

- `http://127.0.0.1:4173/workbench`
- `http://127.0.0.1:4173/decision-room`
- `http://127.0.0.1:4173/governance`

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

## Demo roles

- `Elena Müller` — Deal Lead persona shown in the shell
- `Deal` reviewer — specialist approval
- `Legal` reviewer — specialist approval
- `Compliance` reviewer — specialist approval

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
9. Open `/decision-room`.
10. Approve `Deal`, `Legal`, and `Compliance` reviews.
11. Run `Prepare committee pack`.
12. Confirm `Submit to committee` stays disabled.
13. Open `/governance` and confirm `Internal Audit verdict: Not issued`.

## Validation commands

Whole local verification:

```powershell
Set-Location .\demo-platform
node .\scripts\verify-demo.mjs
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
- `AZURE_MANAGED_IDENTITY_CLIENT_ID`
- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`
- `AZURE_SEARCH_ENDPOINT`
- `AZURE_SEARCH_INDEX_NAME`
- `AZURE_BLOB_ACCOUNT_URL`
- `AZURE_BLOB_CONTAINER_NAME`
- `AZURE_SERVICE_BUS_NAMESPACE`
- `AZURE_SERVICE_BUS_QUEUE_NAME`
- `AZURE_OPENAI_LUNA_ENDPOINT`
- `AZURE_OPENAI_LUNA_DEPLOYMENT_ID`
- `AZURE_OPENAI_LUNA_API_VERSION`
- `AZURE_OPENAI_LUNA_EVIDENCE_ID`
- `AZURE_OPENAI_TERRA_ENDPOINT`
- `AZURE_OPENAI_TERRA_DEPLOYMENT_ID`
- `AZURE_OPENAI_TERRA_API_VERSION`
- `AZURE_OPENAI_TERRA_EVIDENCE_ID`
- `AZURE_OPENAI_SOL_ENDPOINT`
- `AZURE_OPENAI_SOL_DEPLOYMENT_ID`
- `AZURE_OPENAI_SOL_API_VERSION`
- `AZURE_OPENAI_SOL_EVIDENCE_ID`

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

### Unavailable routes or failed page loads

- Confirm the BFF is listening on `http://127.0.0.1:3001/healthz`.
- Confirm the web app is listening on `http://127.0.0.1:4173/workbench`.
- If Playwright is starting servers, let `playwright.config.ts` manage them.

### Stale scenario state

- Run `node .\scripts\reset-scenario.mjs`.
- Or use `Reset Project Danube` in the shell and confirm the reset dialog.
- If a previous run already created governed findings, reset before re-running analysis.
