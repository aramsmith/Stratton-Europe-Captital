# Stratton demo infrastructure administration handoff

This handoff is configuration guidance only. It does not authorise Azure login, what-if, deployment,
or runtime testing.

## Identity, delegated authentication, and private routing

- Keep both Container Apps internal and use digest-pinned application images.
- Configure the web, BFF, and Phase 5 app registrations with the explicit tenant, client IDs,
  audiences, and delegated scopes supplied to Bicep. Grant tenant admin consent for the web
  `webDelegatedScope`, BFF `bffRequiredDelegatedScope`, and Phase 5
  `phase5DelegatedScope` permissions before enabling the route.
- The web Container App uses the enabled Container Apps token store and asks Entra for the BFF
  delegated scope. Its proxy forwards only the platform-provided
  `x-ms-token-aad-access-token` as the BFF bearer token. It must not decode the token, request a
  managed-identity token for a human request, or manufacture principal or role headers.
- Configure the BFF auth policy to reject unauthenticated calls and validate
  `bffDelegatedAudience` and `bffRequiredDelegatedScope` against the supplied tenant issuer.
- Assign human users only the Project Danube access, evidence-to-decision purpose, and operation roles
  they require.
- The BFF trusts forwarded human claims only when the outer Container Apps principal object ID equals
  `TRUSTED_WEB_PROXY_PRINCIPAL_ID`.
- Create the BFF managed-identity federated credential in the Phase 5 app registration. The BFF
  obtains a federated assertion for `api://AzureADTokenExchange/.default` and exchanges the
  incoming user assertion for `phase5DelegatedScope`; Phase 5 remains the immutable policy and
  transition authority.
- Authorize `demoAuthorityCompletionClientId` for the Phase 5 completion application permission.
  The BFF uses its managed identity to obtain the Phase 5 application token for completion and
  route-evidence retrieval; do not use that application token for a human API request.
- Provision a route-evidence record for each Luna, Terra, and Sol binding before activation.
  Each record must identify the account resource ID, deployment, region, API version, evidence
  version, and approved validity interval.
- Maintain the no-secret boundary: do not configure client secrets, account keys, registry
  passwords, or token values in Bicep, parameters, Container Apps settings, source control, or
  telemetry.

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
- Reader: the BFF identity only, on each supplied Luna, Terra, and Sol Cognitive Services account
  resource. Do not grant Reader at subscription, resource-group, or unrelated account scope.

## EU model-route bindings

For each Luna, Terra, and Sol route, keep the endpoint, Cognitive Services account resource ID,
deployment, EU region, API version, and versioned evidence ID together as one owner-approved binding.
The endpoint account name must match the resource ID account name. Accepted demo regions are
`francecentral`, `germanywestcentral`, `italynorth`, `northeurope`, `polandcentral`,
`spaincentral`, `swedencentral`, and `westeurope`.
