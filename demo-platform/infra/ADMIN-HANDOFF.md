# Stratton demo infrastructure administration handoff

Local repository validation remains read-only. Azure changes occur only through the controlled
standalone orchestrator below, with separate provider-registration, foundation what-if, and
application what-if approvals.

## Controlled standalone deployment

Run from `demo-platform` while signed in as `aram@azurelab.nl` to subscription
`8364fb4d-2d36-4da5-908b-36cb8b808b8c` and tenant
`27140306-eea5-4e7f-91e9-4c9e86864b3a`:

```powershell
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase Preflight
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase FoundationWhatIf
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase FoundationDeploy -ApproveFoundationWhatIf
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase ApplicationWhatIf
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase ApplicationDeploy -ApproveApplicationWhatIf
pwsh -NoProfile -File .\scripts\deployment\Test-StrattonDeployment.ps1
```

When `preflight.json` lists unregistered providers, inspect the exact namespaces and explicitly run:

```powershell
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase FoundationWhatIf -ApproveProviderRegistration
```

The post-registration recheck is written to
`artifacts\deployment\provider-registration-preflight.json`, preserving the exact preflight evidence
that was approved if the command must resume.

OpenAI readiness and the Bicep deployments both use `DataZoneStandard`; preflight requires remaining
quota for every route's requested capacity. Restrictive `.dockerignore` files exclude dependencies,
test output, artifacts, and local credential files from all ACR build contexts.

## Approved split-region recovery target

Keep the approved subscription, tenant, signed-in user, and `stratton-demo-rg`. Platform resources
now target `swedencentral`; Azure OpenAI remains in `westeurope`. This is a recovery from the
partially failed westeurope foundation, where Azure SQL returned `ProvisioningDisabled` and
Container Apps returned `AKSCapacityHeavyUsage`; Azure OpenAI model/quota readiness remains valid
in westeurope. The read-only preflight evaluates policy, location, provider, naming, and general
readiness against the platform location, and Azure OpenAI SKU, model, quota, and account discovery
against `openAiLocation`. It records both locations, and deployment state rejects either location
drifting. Do not delete the partial resource group or any partial OpenAI account: destructive
cleanup is pending explicit approval. Retain the complete what-if review, no-delete requirement,
and all separate approval gates.

The provider approval cannot approve either Bicep what-if. Foundation deploys shared services and
stable identities with `deployApplications=false`; application activation uses
`deployApplications=true`, real Entra IDs, and immutable digests. Both deployments are
subscription-scoped and incremental. Complete mode and Azure delete commands are prohibited.

The state machine persists atomically after each successful phase and rejects subscription, tenant,
user, commit, or parameter-hash drift. Review `artifacts\deployment\what-if.json` before each
approval. `outputs.json` and `verification.json` contain non-secret evidence only.

Before the final verification command, set `STRATTON_PLAYWRIGHT_STORAGE_STATE` to a protected
authenticated Playwright storage-state file and `STRATTON_PLAYWRIGHT_SESSION_STORAGE_STATE` to a
protected JSON object containing the deployed origin's MSAL session-storage key/value pairs. Keep
both sensitive files outside the repository. Authenticated verification disables traces,
screenshots, videos, and HTML reports. Verification checks Azure Resource Health, active Container
Apps revisions, public/internal ingress, all health endpoints, Entra reconciliation, private SQL DNS
plus token-authenticated query, exact dependency RBAC, Luna/Terra/Sol ARM and Phase 5 bindings, and
the authenticated Project Danube scenario. The provisional localhost SPA redirect is removed only
after that browser scenario passes.

Internal verification is non-interactive. `Test-StrattonDeployment.ps1` reconciles the manually
triggered `stratton-verification` Container Apps job in the existing managed environment, using the
immutable BFF image digest from the deployment artifacts. It starts one execution, polls that exact
execution to a terminal state, and retrieves only its `verification` container logs with
`az containerapp job logs show`. `Unknown` is treated as indeterminate, so polling continues until a
real terminal status or the poll budget is exhausted. If the live log is not yet durable, the
bootstrap and verification receipts both use the same bounded-retry helper that falls back to the
deployed Log Analytics workspace through core `az rest` against
`https://api.loganalytics.io/v1/workspaces/<customerId>/query`, scoped to the exact job, execution,
container, receipt marker, and recent time window. No Azure CLI extension is required or installed;
the query body is written to a temporary JSON file next to the deployment artifacts, passed as
`--body @<file>` so Windows `az.cmd` quoting cannot corrupt it, and deleted after every attempt.
Verification fails closed unless the job succeeds and emits exactly
one fresh nonce-bound base64 receipt. The receipt contains boolean checks and the three route
bindings only; no access token or secret is placed in environment variables, commands, logs, or
artifacts.

## Client-directed Microsoft Entra authentication

- Register the web application as a public single-page application with its exact deployed redirect
  URI. MSAL Browser uses the authorization code flow with PKCE; do not add a client secret or
  certificate.
- Expose the BFF delegated permission using the full App ID URI scope supplied as
  `webDelegatedScope`. Configure the BFF app registration with
  `requestedAccessTokenVersion: 2`. For v2 access tokens, the strict `aud` claim is the BFF
  application client-ID GUID, while the browser requests the full App ID URI scope and the BFF
  requires only the scope value in `scp`.
- Grant tenant admin consent for the web public client to request `webDelegatedScope`. Grant the BFF
  confidential application delegated permission and tenant admin consent for
  `phase5DelegatedScope`.
- The web Container App does not use server-directed authentication or a token store. Its static SPA
  is available anonymously so the browser can start sign-in. The browser signs in through MSAL
  Browser, acquires the BFF delegated token, and sends exactly one `Authorization: Bearer ...`
  header to the same-origin `/api` proxy.
- The web proxy returns 401 for a missing, malformed, or repeated bearer header. It forwards one
  valid Authorization header unchanged and never decodes the token or manufactures identity or role
  headers.
- Configure BFF Container Apps Easy Auth with `Return401`, the BFF client-ID GUID as its only allowed
  audience, and the approved web public client ID as its only `allowedApplications` entry. The BFF
  application independently verifies the token signature, issuer, tenant, expiry, `aud`, `azp`, and
  required `scp`, then binds those verified user claims to the outer Easy Auth principal.

## BFF OBO and Phase 5 completion authorization

- Create the managed-identity federated credential on the BFF app registration, not on the Phase 5
  app registration. It must trust the deployed BFF user-assigned managed identity and permit the BFF
  confidential client to use the managed-identity assertion for
  `api://AzureADTokenExchange/.default`.
- The BFF sends its app-registration client ID as `client_id`, the incoming delegated token as the
  OBO assertion, the managed-identity federated assertion as `client_assertion`, and the full
  `phase5DelegatedScope` to the tenant v2 token endpoint. No client secret or certificate is used.
- Phase 5 completion tokens are issued directly to the BFF managed identity. Configure Phase 5
  `DEMO_AUTHORITY_COMPLETION_CLIENT_ID` as the deployed BFF managed-identity client ID and authorize
  that service principal for the Phase 5 completion application permission. This value is not a BFF
  runtime setting.
- The additive Phase 5 route set is limited to bundle creation and lookup, service-principal
  completion, human bundle review, draft preparation, and route-evidence lookup under
  `/v1/demo-authority`. Human operations require the OBO delegated token. Completion accepts only
  the configured BFF application principal, validates bundle/route binding plus citation and
  material-claim counts, and persists the submitted output-manifest hash as the authoritative
  `subjectVersion`; reviews and draft preparation must supply that exact version.
- Provision a route-evidence record for each Luna, Terra, and Sol binding before activation. Each
  record must identify the account resource ID, deployment, region, API version, evidence version,
  and approved validity interval. The BFF sends `DEMO_TENANT_ID` explicitly on startup lookups;
  Phase 5 must query the same tenant and set that real tenant in SQL session context. Do not
  configure a sentinel or RLS bypass.
- Maintain the no-secret boundary: do not configure client secrets, account keys, registry passwords,
  token-store Blob SAS values, or token values in Bicep, parameters, Container Apps settings, source
  control, or telemetry.

## SQL bootstrap

The isolated standalone dev deployment configures the `bootstrap-mi` user-assigned managed identity
as the private SQL server's Microsoft Entra administrator and grants that same identity Search
Service Contributor at the Azure AI Search service scope. This is a manually triggered bootstrap
identity for schema, contained-user, Search index, and route-evidence reconciliation. It is not an
application runtime identity and must not be attached to the web, BFF, or Phase 5 containers.

The bootstrap job applies the emitted `sqlBootstrapSql` without a database password. The application
runtime identity receives only:

```sql
GRANT SELECT, INSERT, UPDATE
ON OBJECT::dbo.demo_scenario_projection
TO [<bff-managed-identity>];
```

Do not add `db_datareader`, `db_datawriter`, database-wide `EXECUTE`, or SQL DB Contributor.
`sys.sp_set_session_context` is used for tenant and case context; no custom stored procedure grant is
required by this projection.

The separate `verification-mi` identity is attached only to the verification job. It receives
AcrPull at the registry and this contained-database permission:

```sql
GRANT SELECT
ON OBJECT::dbo.approved_model_route_evidence
TO [<verification-managed-identity>];
```

It is not a SQL administrator and receives no Storage, Service Bus, Search, Document Intelligence,
OpenAI, or broad Azure Reader role.

## Azure RBAC scopes

- Storage Blob Data Contributor: the supplied `admitted-evidence` container only.
- Azure Service Bus Data Sender: the supplied `analysis-work` queue only.
- AcrPull: the supplied registry. Azure Container Registry does not expose a repository child
  resource for an ARM role-assignment scope.
- Search Index Data Reader: the supplied Azure AI Search service. Azure AI Search indexes are data
  plane objects, not ARM child-resource scopes for Azure RBAC assignment.
- Cognitive Services User and Cognitive Services OpenAI User: the supplied account resources. The
  applicable built-in data-plane roles are assigned at Cognitive Services account scope.
- Reader (`acdd72a7-3385-48ef-bd42-f606fba81ae7`): the BFF identity only, once per distinct supplied
  Luna, Terra, or Sol Cognitive Services account resource. Do not grant Reader at subscription,
  resource-group, or unrelated account scope.

## EU model-route bindings

For each Luna, Terra, and Sol route, keep the endpoint, Cognitive Services account resource ID,
deployment, EU region, API version, versioned evidence ID, and separate expected evidence version
together as one owner-approved binding. The endpoint account name must match the resource ID account
name. Accepted demo regions are
`francecentral`, `germanywestcentral`, `italynorth`, `northeurope`, `polandcentral`,
`spaincentral`, `swedencentral`, and `westeurope`.

Before activation, AZURE startup reads ARM account and deployment metadata and the approved Phase 5
route-evidence record. It fails closed unless the configured and authoritative route, resource ID,
HTTPS endpoint, deployment, actual location, API version, evidence ID, configured
`AZURE_OPENAI_*_ROUTE_EVIDENCE_VERSION`, Phase 5 `evidenceVersion`, and current validity interval
agree exactly. Keep the evidence ID and evidence version as separate values. Do not add a route,
region, or stale-evidence fallback.

## Local verification and troubleshooting

Run these exact commands from `demo-platform`:

```powershell
npm run clean:generated
npm ci
node .\scripts\verify-demo.mjs
```

The local verification script runs `npm ci` and then `npm run validate` from
`..\5-coding-r4\app` before demo-platform tests. It preserves fail-fast exit and stderr details and
cleans generated Bicep output. It does not log in to Azure or perform deployment, provider
registration, Entra writes, image builds, jobs, or runtime tests.

- Consent or OBO failure: check both delegated consent grants, the browser's single same-origin
  bearer header, BFF audience/`azp`/scope validation, and the BFF managed-identity federated
  credential. `DEMO_TENANT_ID` must be a GUID. Do not add a client secret or token store.
- Subject-version or review failure: use the exact `subjectVersion` returned by Phase 5 completion,
  not a local finding text version.
- Completion failure: make `DEMO_AUTHORITY_COMPLETION_CLIENT_ID` equal the BFF managed-identity
  client ID and grant only that principal the completion permission.
- ARM or evidence failure: reconcile every binding field above and renew the owner-approved
  route-evidence record before starting the BFF.
