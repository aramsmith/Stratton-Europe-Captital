# Stratton demo infrastructure administration handoff

This handoff is configuration guidance only. It does not authorise Azure login, what-if, deployment,
or runtime testing.

## Identity and private routing

- Keep both Container Apps internal and use digest-pinned application images.
- Configure the web and BFF app registrations with the explicit tenant, client IDs, and audiences
  supplied to Bicep.
- Assign the web managed identity permission to request the configured BFF token scope.
- Assign human users only the Project Danube access, evidence-to-decision purpose, and operation roles
  they require.
- The BFF trusts forwarded human claims only when the outer Container Apps principal object ID equals
  `TRUSTED_WEB_PROXY_PRINCIPAL_ID`.
- Configure the BFF managed identity to request `PHASE5_TOKEN_SCOPE`; Phase 5 remains the immutable
  policy and transition authority.
- Configure Phase 5 to accept the `x-stratton-*` actor, tenant, case, purpose, and role context only
  when the bearer principal is the approved BFF managed identity.

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

## EU model-route bindings

For each Luna, Terra, and Sol route, keep the endpoint, Cognitive Services account resource ID,
deployment, EU region, API version, and versioned evidence ID together as one owner-approved binding.
The endpoint account name must match the resource ID account name. Accepted demo regions are
`francecentral`, `germanywestcentral`, `italynorth`, `northeurope`, `polandcentral`,
`spaincentral`, `swedencentral`, and `westeurope`.
