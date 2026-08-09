# Stratton demo infrastructure administration handoff

This handoff is configuration guidance only. It defines a no-deployment boundary: do not run Azure
login, what-if, deployment, provisioning, or runtime validation as part of this repository task.

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
  the configured BFF application principal and returns an authoritative `subjectVersion`; reviews
  and draft preparation must supply that exact version.
- Provision a route-evidence record for each Luna, Terra, and Sol binding before activation. Each
  record must identify the account resource ID, deployment, region, API version, evidence version,
  and approved validity interval.
- Maintain the no-secret boundary: do not configure client secrets, account keys, registry passwords,
  token-store Blob SAS values, or token values in Bicep, parameters, Container Apps settings, source
  control, or telemetry.

## SQL bootstrap

Run the emitted `sqlBootstrapSql` once in the approved database as a Microsoft Entra administrator.
The runtime identity receives only:

```sql
GRANT SELECT, INSERT, UPDATE
ON OBJECT::dbo.demo_scenario_projection
TO [<bff-managed-identity>];
```

Do not add `db_datareader`, `db_datawriter`, database-wide `EXECUTE`, or SQL DB Contributor.
`sys.sp_set_session_context` is used for tenant and case context; no custom stored procedure grant is
required by this projection.

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
deployment, EU region, API version, and versioned evidence ID together as one owner-approved binding.
The endpoint account name must match the resource ID account name. Accepted demo regions are
`francecentral`, `germanywestcentral`, `italynorth`, `northeurope`, `polandcentral`,
`spaincentral`, `swedencentral`, and `westeurope`.

Before activation, AZURE startup reads ARM account and deployment metadata and the approved Phase 5
route-evidence record. It fails closed unless the configured and authoritative route, resource ID,
HTTPS endpoint, deployment, actual location, API version, evidence ID, evidence version, and current
validity interval agree. Do not add a route, region, or stale-evidence fallback.

## Local verification and troubleshooting

The local gate is `npm run clean:generated`, `npm ci`, then
`node .\scripts\verify-demo.mjs` from `demo-platform`. It runs Phase 5 validation from
`..\5-coding-r4\app` before demo-platform tests, preserves fail-fast errors, and cleans generated
Bicep output. It does not log in to Azure or perform a deployment, what-if, provisioning, or runtime
test.

- Consent or OBO failure: check both delegated consent grants, the browser's single same-origin
  bearer header, BFF audience/`azp`/scope validation, and the BFF managed-identity federated
  credential. Do not add a client secret or token store.
- Subject-version or review failure: use the exact `subjectVersion` returned by Phase 5 completion,
  not a local finding text version.
- Completion failure: make `DEMO_AUTHORITY_COMPLETION_CLIENT_ID` equal the BFF managed-identity
  client ID and grant only that principal the completion permission.
- ARM or evidence failure: reconcile every binding field above and renew the owner-approved
  route-evidence record before starting the BFF.
