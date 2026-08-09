# Stratton Standalone Azure Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a cost-minimised, authoritative Project Danube development environment in the empty `MoA-Sub2` Azure subscription.

**Architecture:** A new standalone Bicep entry point provisions the missing network, platform, data, messaging, and AI services and then composes the existing demo modules. The web Container App is public for Entra-authenticated presenters; BFF and Phase 5 are internal, use managed identities, and reach a private serverless Azure SQL database. Administrative PowerShell scripts separately reconcile Entra, build immutable ACR images, bootstrap data-plane state, run an approved what-if, deploy incrementally, and verify the full scenario.

**Tech Stack:** Bicep, Azure CLI, Microsoft Graph via `az rest`, PowerShell 7/Pester 5, Azure Container Apps, Azure Container Registry, Azure SQL, Storage, Service Bus, Azure AI Search, Document Intelligence, Azure OpenAI, Node.js 22, TypeScript, Playwright.

## Global Constraints

- Subscription: `MoA-Sub2` (`8364fb4d-2d36-4da5-908b-36cb8b808b8c`).
- Tenant: `27140306-eea5-4e7f-91e9-4c9e86864b3a`.
- Deployment identity: `aram@azurelab.nl`.
- Environment: `dev`.
- Region: `westeurope`.
- Resource group: `stratton-demo-rg`.
- Use the smallest suitable development SKUs and scale-to-zero or auto-pause where supported.
- Public ingress is allowed only for the web Container App.
- BFF and Phase 5 API ingress remain internal.
- Azure SQL public network access is disabled and authentication is Microsoft Entra-only.
- Use managed identities and narrowly scoped Azure RBAC; do not use application secrets, SQL passwords, account keys, registry passwords, SAS tokens, or token stores.
- Use one Azure OpenAI account with three separately named Luna, Terra, and Sol deployments.
- Use immutable SHA-256 image digests; mutable tags cannot activate an application revision.
- Retain `demo-platform/infra/parameters/dev.bicepparam` as a synthetic fixture; never deploy it.
- Run an Azure what-if and obtain approval before resource creation.
- Destructive operations require separate confirmation.
- Preserve Phase 5 human authority boundaries and do not add investment-decision or committee-submission operations.

---

### Task 1: Add Read-Only Azure Preflight

**Files:**
- Create: `demo-platform/scripts/deployment/Stratton.Deployment.psm1`
- Create: `demo-platform/scripts/deployment/Test-StrattonAzurePreflight.ps1`
- Create: `demo-platform/tests/deployment/Preflight.Tests.ps1`
- Create: `demo-platform/tests/deployment/Invoke-DeploymentTests.ps1`
- Modify: `demo-platform/package.json`

**Interfaces:**
- Produces: `Test-StrattonAzurePreflight.ps1` writes a non-secret JSON document with `subscriptionId`, `tenantId`, `location`, `resourceProviders`, `policyAssignments`, `skuAvailability`, `openAiModels`, and `blockingFindings`.
- Produces: `Assert-AzContext -SubscriptionId $subscriptionId -TenantId $tenantId -ExpectedUser $userPrincipalName` and `Invoke-AzJson -Arguments $arguments` exported from `Stratton.Deployment.psm1`.
- Consumes: Azure CLI account authenticated as `aram@azurelab.nl`.

- [ ] **Step 1: Write failing Pester tests for exact context and fail-closed findings**

```powershell
Describe 'Test-StrattonAzurePreflight' {
  It 'rejects the wrong subscription, tenant, or user' {
    { Assert-AzContext `
        -SubscriptionId 'wrong' `
        -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
        -ExpectedUser 'aram@azurelab.nl' } |
      Should -Throw 'AZURE_CONTEXT_MISMATCH'
  }

  It 'marks a missing Azure OpenAI model or quota as blocking' {
    $result = ConvertTo-PreflightResult -OpenAiModels @() -RequiredProviders @()
    $result.blockingFindings | Should -Contain 'AZURE_OPENAI_MODEL_UNAVAILABLE'
  }
}
```

- [ ] **Step 2: Run the deployment tests and verify failure**

Run:

```powershell
pwsh -NoProfile -File .\tests\deployment\Invoke-DeploymentTests.ps1
```

Expected: FAIL because the module and preflight functions do not exist.

- [ ] **Step 3: Implement strict Azure CLI helpers**

```powershell
function Invoke-AzJson {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string[]] $Arguments)

  $output = & az @Arguments --only-show-errors --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "AZURE_CLI_FAILED:$($Arguments -join ' '):$($output | Out-String)"
  }
  if (-not $output) { return $null }
  return ($output | Out-String | ConvertFrom-Json -Depth 100)
}

function Assert-AzContext {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][string] $SubscriptionId,
    [Parameter(Mandatory)][string] $TenantId,
    [Parameter(Mandatory)][string] $ExpectedUser
  )
  $account = Invoke-AzJson -Arguments @('account', 'show')
  if (
    $account.id -ne $SubscriptionId -or
    $account.tenantId -ne $TenantId -or
    $account.user.name -ne $ExpectedUser
  ) {
    throw 'AZURE_CONTEXT_MISMATCH'
  }
}
```

- [ ] **Step 4: Implement read-only provider, policy, SKU, naming, and OpenAI availability checks**

The script must use only `az account show`, `az provider show`, `az policy assignment list`,
`az graph query`, `az cognitiveservices account list-models`, and quota/read operations. It must not
register providers, create a resource group, or submit a deployment.

```powershell
$requiredProviders = @(
  'Microsoft.App',
  'Microsoft.ContainerRegistry',
  'Microsoft.OperationalInsights',
  'Microsoft.Network',
  'Microsoft.Sql',
  'Microsoft.Storage',
  'Microsoft.ServiceBus',
  'Microsoft.Search',
  'Microsoft.CognitiveServices',
  'Microsoft.ManagedIdentity',
  'Microsoft.Insights'
)
```

- [ ] **Step 5: Add deployment tests to the repository test command**

```json
{
  "scripts": {
    "test:deployment": "pwsh -NoProfile -File tests/deployment/Invoke-DeploymentTests.ps1"
  }
}
```

- [ ] **Step 6: Run tests and a real read-only preflight**

Run:

```powershell
npm run test:deployment
pwsh -NoProfile -File .\scripts\deployment\Test-StrattonAzurePreflight.ps1 `
  -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
  -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
  -ExpectedUser 'aram@azurelab.nl' `
  -Location 'westeurope' `
  -OutFile '.\artifacts\deployment\preflight.json'
```

Expected: tests PASS; preflight either contains no blocking findings or identifies exact provider,
policy, model, or quota blockers without changing Azure.

- [ ] **Step 7: Commit**

```powershell
git add demo-platform/package.json demo-platform/scripts/deployment demo-platform/tests/deployment
git commit -m "feat: add standalone Azure preflight"
```

### Task 2: Provision the Standalone Platform Foundation

**Files:**
- Create: `demo-platform/infra/standalone/main.bicep`
- Create: `demo-platform/infra/standalone/modules/network/main.bicep`
- Create: `demo-platform/infra/standalone/modules/operations/main.bicep`
- Create: `demo-platform/infra/standalone/modules/data/main.bicep`
- Create: `demo-platform/infra/standalone/modules/ai/main.bicep`
- Create: `demo-platform/infra/standalone/parameters/dev.bicepparam`
- Create: `demo-platform/tests/iac/StandaloneInfra.Tests.ps1`
- Modify: `demo-platform/tests/iac/Invoke-DemoIaCTests.ps1`

**Interfaces:**
- Produces: the `stratton-demo-rg` resource group; web, BFF, Phase 5, and bootstrap user-assigned identities; and platform outputs consumed by Task 3: `containerAppsEnvironmentId`, `containerRegistryId`, `containerRegistryServer`, `logAnalyticsWorkspaceId`, SQL identifiers, Storage identifiers, Service Bus identifiers, Search identifiers, Document Intelligence identifiers, and Azure OpenAI account/deployment bindings.
- Consumes: real tenant ID, region, Entra administrator object ID/login, and model/version values selected by preflight.

- [ ] **Step 1: Write failing standalone-template tests**

```powershell
It 'creates a VNet-integrated consumption environment and private SQL database' {
  $types = @($script:allResources.type)
  $types | Should -Contain 'Microsoft.Network/virtualNetworks'
  $types | Should -Contain 'Microsoft.App/managedEnvironments'
  $types | Should -Contain 'Microsoft.Sql/servers'
  $types | Should -Contain 'Microsoft.Sql/servers/databases'
  $types | Should -Contain 'Microsoft.Network/privateEndpoints'
  $script:templateJson | Should -Match '"publicNetworkAccess"\s*:\s*"Disabled"'
}

It 'uses one OpenAI account and three explicit deployments' {
  (@($script:allResources | Where-Object type -eq 'Microsoft.CognitiveServices/accounts')).Count |
    Should -Be 2
  (@($script:allResources | Where-Object type -eq 'Microsoft.CognitiveServices/accounts/deployments')).Count |
    Should -Be 3
}
```

- [ ] **Step 2: Run IaC tests and verify failure**

Run:

```powershell
pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1
```

Expected: FAIL because `infra/standalone/main.bicep` is absent.

- [ ] **Step 3: Implement network and private DNS**

```bicep
targetScope = 'subscription'

resource deploymentResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module network './modules/network/main.bicep' = {
  name: '${namePrefix}-network'
  scope: deploymentResourceGroup
  params: {
    location: location
    namePrefix: namePrefix
    tags: tags
  }
}
```

The subscription-scope entry point must create the resource group so the Azure what-if covers the
first resource write. The network module contains:

```bicep
resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${namePrefix}-vnet'
  location: location
  properties: {
    addressSpace: { addressPrefixes: [ '10.42.0.0/16' ] }
    subnets: [
      {
        name: 'snet-containerapps'
        properties: {
          addressPrefix: '10.42.0.0/23'
          delegations: [
            {
              name: 'Microsoft.App.environments'
              properties: { serviceName: 'Microsoft.App/environments' }
            }
          ]
        }
      }
      {
        name: 'snet-private-endpoints'
        properties: {
          addressPrefix: '10.42.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}
```

Create and link `privatelink.database.windows.net`; scope the SQL private endpoint to the second
subnet.

- [ ] **Step 4: Implement cost-minimised operations and registry resources**

Use:

```bicep
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    policies: {
      retentionPolicy: { days: 7 status: 'enabled' }
    }
  }
}
```

Create Log Analytics with `retentionInDays: 30` and a VNet-integrated Container Apps managed
environment using the consumption workload profile.

Create four standalone user-assigned identities named `${namePrefix}-web-mi`,
`${namePrefix}-bff-mi`, `${namePrefix}-phase5-mi`, and `${namePrefix}-bootstrap-mi`. Export each
resource ID, client ID, and principal ID. Application modules consume these identities rather than
creating replacements.

- [ ] **Step 5: Implement data and messaging resources**

Create:

- Azure SQL logical server with Entra-only authentication and `publicNetworkAccess: 'Disabled'`.
- General Purpose serverless database with minimum capacity `0.5`, auto-pause delay `60`, and the
  smallest supported maximum vCore value.
- Standard LRS StorageV2 account with shared-key access and public blob access disabled.
- Private `admitted-evidence` blob container.
- Service Bus Standard namespace and `analysis-work`, `q-ingestion`, `q-extraction`, and
  `q-indexing` queues.
- Azure AI Search Basic service.

- [ ] **Step 6: Implement Document Intelligence and one-account/three-deployment Azure OpenAI**

```bicep
resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAiAccountName
  location: openAiLocation
  kind: 'OpenAI'
  sku: { name: 'S0' }
  properties: {
    customSubDomainName: openAiAccountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
}

resource luna 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: 'luna-evidence-triage'
  sku: { name: 'GlobalStandard' capacity: modelCapacity }
  properties: { model: { format: 'OpenAI' name: modelName version: modelVersion } }
}
```

Repeat explicit `terra-grounded-analysis` and `sol-thesis-challenge` resources. Do not generate
deployment names from an untyped object loop because later route evidence binds to exact names.

- [ ] **Step 7: Compose outputs and real development parameters**

The standalone parameter file contains only non-secret values and must use:

```bicep
using '../main.bicep'

param subscriptionId = '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
param tenantId = '27140306-eea5-4e7f-91e9-4c9e86864b3a'
param location = 'westeurope'
param resourceGroupName = 'stratton-demo-rg'
param environmentName = 'dev'
```

Model name, model version, and capacity remain explicit parameters populated from the successful
preflight result.

- [ ] **Step 8: Build, lint, and test**

Run:

```powershell
az bicep build --file .\infra\standalone\main.bicep
az bicep lint --file .\infra\standalone\main.bicep
az bicep build-params --file .\infra\standalone\parameters\dev.bicepparam `
  --outfile .\infra\standalone\parameters\dev.parameters.json
pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1
```

Expected: all commands PASS and generated JSON is removed after tests.

- [ ] **Step 9: Commit**

```powershell
git add demo-platform/infra/standalone demo-platform/tests/iac
git commit -m "feat: provision standalone Azure platform"
```

### Task 3: Compose Public Web, Internal BFF, and Internal Phase 5

**Files:**
- Create: `demo-platform/infra/standalone/modules/phase5/main.bicep`
- Modify: `demo-platform/infra/modules/demo-apps/main.bicep`
- Modify: `demo-platform/infra/main.bicep`
- Modify: `demo-platform/infra/standalone/main.bicep`
- Modify: `demo-platform/tests/iac/DemoInfra.Tests.ps1`
- Modify: `demo-platform/tests/iac/StandaloneInfra.Tests.ps1`

**Interfaces:**
- Produces: `webAppFqdn`, `bffAppFqdn`, `phase5ApiFqdn`, and the three user-assigned managed identity IDs/client IDs/principal IDs.
- Consumes: platform and identity outputs from Task 2, Entra application IDs from Task 4, and image digests from Task 5.

- [ ] **Step 1: Replace the obsolete ingress test with the approved boundary test**

```powershell
It 'exposes only the web application publicly' {
  $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
  ($apps | Where-Object { $_.name -match 'webAppName' }).properties.configuration.ingress.external |
    Should -BeTrue
  ($apps | Where-Object { $_.name -match 'bffAppName' }).properties.configuration.ingress.external |
    Should -BeFalse
}
```

Add a standalone assertion that Phase 5 ingress is also internal.

- [ ] **Step 2: Run IaC tests and verify failure**

Expected: FAIL because the current web ingress is internal and Phase 5 is not deployed.

- [ ] **Step 3: Make web ingress public and scale development apps safely**

```bicep
configuration: {
  ingress: {
    external: true
    allowInsecure: false
    targetPort: webContainerPort
    transport: 'auto'
  }
}
template: {
  scale: {
    minReplicas: 0
    maxReplicas: 1
  }
}
```

Keep BFF ingress internal. Set BFF and Phase 5 minimum replicas to `0` only after health and startup
tests demonstrate that cold-start retries are handled by the web proxy; otherwise keep those two at
`1` and document the standing cost.

Refactor `demo-apps/main.bicep` to accept `webIdentityResourceId`, `webIdentityClientId`,
`webIdentityPrincipalId`, `bffIdentityResourceId`, `bffIdentityClientId`, and
`bffIdentityPrincipalId`. Remove its identity resource declarations so the foundation deployment can
create stable principals before Entra configuration.

- [ ] **Step 4: Add the Phase 5 API Container App**

Configure `Dockerfile.api`, port `3000`, production runtime settings, SQL and Service Bus endpoints,
the BFF managed-identity client ID for completion, and a dedicated Phase 5 user-assigned identity.
Use managed identity for ACR pull, Azure SQL, and Service Bus.

```bicep
env: [
  { name: 'APP_ENV', value: 'dev' }
  { name: 'API_PORT', value: '3000' }
  { name: 'API_RUNTIME_MODE', value: 'production' }
  { name: 'ROLLOUT_ADMISSION_MAX', value: '1' }
  { name: 'LOG_LEVEL', value: 'INFO' }
  { name: 'ANALYSIS_CAPABILITY_ENABLED', value: 'false' }
  { name: 'AUDIT_EXPORT_CAPABILITY_ENABLED', value: 'false' }
  { name: 'DEMO_AUTHORITY_COMPLETION_CLIENT_ID', value: bffIdentityClientId }
  { name: 'AZURE_MANAGED_IDENTITY_CLIENT_ID', value: phase5Identity.properties.clientId }
]
```

- [ ] **Step 5: Configure Phase 5 authentication**

Enable Easy Auth for Phase 5, accept only the Phase 5 application audience, and set
`allowedApplications` to the BFF application client ID and BFF managed-identity client ID. This
admits delegated OBO calls and direct managed-identity completion tokens while rejecting unrelated
clients. Preserve the application’s completion-client validation for direct completion tokens.

- [ ] **Step 6: Add Phase 5 RBAC and SQL bootstrap outputs**

Grant:

- `AcrPull` on the registry.
- Azure Service Bus Data Sender/Receiver only where the Phase 5 production runtime uses them.
- SQL database user permissions emitted as Entra bootstrap SQL; do not grant SQL DB Contributor.

- [ ] **Step 7: Build and test**

Run the Task 2 Bicep commands plus:

```powershell
npm run test:deployment
```

Expected: public web/internal backend tests PASS; three apps are pinned by digest.

- [ ] **Step 8: Commit**

```powershell
git add demo-platform/infra demo-platform/tests/iac
git commit -m "feat: compose standalone demo runtimes"
```

### Task 4: Reconcile Entra Applications and Consent

**Files:**
- Create: `demo-platform/scripts/deployment/Set-StrattonEntra.ps1`
- Create: `demo-platform/scripts/deployment/entra-manifest.json`
- Create: `demo-platform/tests/deployment/Entra.Tests.ps1`
- Modify: `demo-platform/scripts/deployment/Stratton.Deployment.psm1`

**Interfaces:**
- Produces: `artifacts/deployment/entra.json` containing only `webClientId`, `bffClientId`, `phase5ClientId`, scope IDs, app-role ID, service-principal object IDs, and consent state.
- Consumes: the provisional local redirect URI, BFF managed-identity principal/client IDs, the final
  deployed web redirect URI during reconciliation, and the approved tenant.

- [ ] **Step 1: Write failing tests for idempotency and no-secret manifests**

```powershell
It 'rejects password credentials and implicit grant settings' {
  $manifest = Get-Content $manifestPath -Raw
  $manifest | Should -Not -Match 'passwordCredentials|clientSecret|oauth2AllowImplicitFlow'
}

It 'uses stable permission IDs from the checked-in manifest' {
  $manifest.webToBffScopeId | Should -Be '2f6ce5c5-41cf-4b72-b68f-50ed84c16639'
  $manifest.bffToPhase5ScopeId | Should -Be '3d79267d-cd71-47d2-8136-091c4e0184c8'
  $manifest.phase5CompletionRoleId | Should -Be '647359fa-8313-475c-a34b-bdca05b1f329'
}
```

- [ ] **Step 2: Run deployment tests and verify failure**

- [ ] **Step 3: Implement find-or-create application and service-principal helpers**

Use Microsoft Graph v1.0 through `az rest`. Match applications by exact display name and checked-in
identifier URI prefix. If multiple matches exist, throw `ENTRA_APPLICATION_CONFLICT`.

```powershell
function Invoke-Graph {
  param([string] $Method, [string] $Uri, [object] $Body)
  $arguments = @('rest', '--method', $Method, '--uri', $Uri)
  if ($null -ne $Body) {
    $arguments += @('--headers', 'Content-Type=application/json', '--body', ($Body | ConvertTo-Json -Depth 50 -Compress))
  }
  Invoke-AzJson -Arguments $arguments
}
```

- [ ] **Step 4: Reconcile the SPA, BFF API, and Phase 5 API**

Use display names:

- `Stratton Demo Web - dev`
- `Stratton Demo BFF - dev`
- `Stratton Phase 5 API - dev`

Set access-token version 2, exact SPA redirect URI, the stable scopes and completion role, and the
required API permissions.

- [ ] **Step 5: Reconcile admin consent and the managed-identity federated credential**

Create the BFF federated identity credential from runtime values:

```powershell
$federatedCredential = @{
  name = 'stratton-demo-bff-mi-dev'
  issuer = 'https://login.microsoftonline.com/27140306-eea5-4e7f-91e9-4c9e86864b3a/v2.0'
  subject = $BffManagedIdentityPrincipalId
  audiences = @('api://AzureADTokenExchange')
}
```

Assign the Phase 5 completion app role only to the BFF managed-identity service principal.

- [ ] **Step 6: Run tests and a non-destructive `-WhatIf` mode**

```powershell
pwsh -NoProfile -File .\scripts\deployment\Set-StrattonEntra.ps1 `
  -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
  -WebRedirectUri 'http://localhost:4173' `
  -WhatIf
```

Expected: prints a create/update plan and performs no Graph writes.

- [ ] **Step 7: Commit**

```powershell
git add demo-platform/scripts/deployment demo-platform/tests/deployment
git commit -m "feat: automate Stratton Entra configuration"
```

### Task 5: Build and Resolve Immutable ACR Images

**Files:**
- Create: `demo-platform/scripts/deployment/Build-StrattonImages.ps1`
- Create: `demo-platform/tests/deployment/Images.Tests.ps1`
- Modify: `demo-platform/scripts/deployment/Stratton.Deployment.psm1`

**Interfaces:**
- Produces: when invoked after platform provisioning, `artifacts/deployment/images.json` with
  repositories, build IDs, and `sha256:` digests for `stratton/demo-web`, `stratton/demo-bff`, and
  `stratton/phase5-api`.
- Consumes: ACR name from Task 2 and Dockerfiles already present in the repository.

- [ ] **Step 1: Write failing tests for digest validation**

```powershell
It 'accepts only sha256 image digests' {
  Test-ImageDigest 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' |
    Should -BeTrue
  Test-ImageDigest 'latest' | Should -BeFalse
}
```

- [ ] **Step 2: Run deployment tests and verify failure**

- [ ] **Step 3: Implement ACR builds**

Use unique build tags only as temporary lookup keys:

```powershell
$buildTag = "dev-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())-$($CommitSha.Substring(0, 8))"
az acr build --registry $RegistryName --image "stratton/demo-web:$buildTag" `
  --file demo-platform/apps/web/Dockerfile demo-platform
```

Run analogous builds for BFF and Phase 5 API. Capture task IDs and fail on any non-successful build.

- [ ] **Step 4: Resolve manifest digests and write the non-secret artifact**

```powershell
$digest = az acr repository show `
  --name $RegistryName `
  --image "$Repository`:$buildTag" `
  --query digest -o tsv
if ($digest -notmatch '^sha256:[a-f0-9]{64}$') {
  throw "INVALID_IMAGE_DIGEST:$Repository"
}
```

- [ ] **Step 5: Run tests**

Expected: deployment tests PASS; do not run actual ACR builds until the registry exists.

- [ ] **Step 6: Commit**

```powershell
git add demo-platform/scripts/deployment demo-platform/tests/deployment
git commit -m "feat: build immutable Stratton images"
```

### Task 6: Bootstrap SQL, Search, and Route Evidence

**Files:**
- Create: `demo-platform/scripts/deployment/Initialize-StrattonDataPlane.ps1`
- Create: `5-coding-r4/app/Dockerfile.bootstrap`
- Create: `5-coding-r4/app/src/bootstrap-main.ts`
- Create: `5-coding-r4/app/src/bootstrap-runtime.ts`
- Create: `5-coding-r4/tests/app/unit/bootstrap-runtime.test.ts`
- Create: `demo-platform/scripts/deployment/search-index.json`
- Create: `demo-platform/scripts/deployment/route-evidence.json`
- Create: `demo-platform/tests/deployment/DataPlane.Tests.ps1`
- Modify: `demo-platform/scripts/deployment/Stratton.Deployment.psm1`

**Interfaces:**
- Produces: the immutable `stratton/bootstrap` image digest, then
  `artifacts/deployment/data-plane.json` with migration hashes, Search index ETag, and three Phase 5
  route-evidence IDs/versions.
- Consumes: `5-coding-r4/app/migrations/001_init.sql`, `002_demo_authority.sql`, demo projection SQL output, real resource IDs/endpoints, model deployment names, tenant ID, and BFF/Phase 5 identities.

- [ ] **Step 1: Write failing tests for migration ordering and tenant-scoped evidence**

```powershell
It 'orders Phase 5 migrations before demo projection bootstrap' {
  (Get-StrattonMigrationFiles -RepositoryRoot $repoRoot).Name |
    Should -Be @('001_init.sql', '002_demo_authority.sql', 'demo-projection.sql')
}

It 'defines exactly one approved record for each governed route' {
  $routes = Get-Content $routeEvidencePath -Raw | ConvertFrom-Json
  @($routes.route) | Should -Be @('LUNA', 'TERRA', 'SOL')
  @($routes | Where-Object tenantId -ne '27140306-eea5-4e7f-91e9-4c9e86864b3a').Count |
    Should -Be 0
}
```

- [ ] **Step 2: Run deployment tests and verify failure**

- [ ] **Step 3: Implement the VNet bootstrap runtime**

The bootstrap image runs as a manually triggered Container Apps Job in the VNet. It uses
`DefaultAzureCredential` with its user-assigned managed identity and performs SQL migrations, Search
index reconciliation, and route-evidence insertion. It accepts only non-secret environment values
and exits non-zero on a changed migration hash or destructive Search schema change.

```typescript
export interface BootstrapInput {
  readonly tenantId: string;
  readonly sqlServerFqdn: string;
  readonly sqlDatabaseName: string;
  readonly searchEndpoint: string;
  readonly searchIndexName: string;
  readonly routes: readonly RouteEvidenceInput[];
}

export async function runBootstrap(
  input: BootstrapInput,
  dependencies: BootstrapDependencies
): Promise<BootstrapReceipt> {
  await dependencies.migrations.apply();
  await dependencies.search.reconcile();
  const routeEvidence = await dependencies.routeEvidence.upsert(input.routes);
  return { migrationHashes: dependencies.migrations.hashes(), routeEvidence };
}
```

`Dockerfile.bootstrap` uses the same pinned Azure Linux Node base as the Phase 5 API and contains no
shell package manager or database password.

- [ ] **Step 4: Apply migrations and least-privilege users transactionally**

Calculate SHA-256 for each migration, record successful application in a deployment migration table,
and reject a changed hash for an already-applied migration. Create contained Entra users for the BFF
and Phase 5 identities and grant only the object permissions required by their repositories.

- [ ] **Step 5: Create or reconcile the Search index**

Use a managed-identity bearer token for `https://search.azure.com/.default`. Compare the existing
index schema with `search-index.json`; reject destructive field changes instead of recreating the
index.

- [ ] **Step 6: Insert approved route evidence**

Populate each record from live ARM outputs:

```json
{
  "route": "LUNA",
  "evidenceId": "SEC-EVID-LUNA-ROUTE-v1",
  "evidenceVersion": "route-evidence-luna-v1",
  "accountResourceId": "${openAiAccountResourceId}",
  "deploymentId": "luna-evidence-triage",
  "region": "westeurope",
  "apiVersion": "2025-01-01-preview",
  "approvalStatus": "APPROVED"
}
```

The script sets a bounded validity interval and never uses a sentinel tenant.

- [ ] **Step 7: Create and invoke the manual Container Apps bootstrap job**

`Initialize-StrattonDataPlane.ps1` deploys or updates a manual-trigger Container Apps Job using the
bootstrap identity. Before creating the job, it builds `5-coding-r4/app/Dockerfile.bootstrap`
through ACR, resolves its immutable `sha256:` digest, and appends the digest to
`artifacts/deployment/images.json`. It starts one execution, waits for terminal status, retrieves
only redacted structured logs, and writes the receipt to `artifacts/deployment/data-plane.json`.

- [ ] **Step 8: Run tests**

Expected: deployment tests PASS. Live bootstrap is deferred until network and SQL are provisioned.

- [ ] **Step 9: Commit**

```powershell
git add 5-coding-r4/app 5-coding-r4/tests/app/unit demo-platform/scripts/deployment demo-platform/tests/deployment
git commit -m "feat: bootstrap standalone data plane"
```

### Task 7: Add the Controlled Deployment Orchestrator

**Files:**
- Create: `demo-platform/scripts/deployment/Deploy-StrattonStandalone.ps1`
- Create: `demo-platform/scripts/deployment/Test-StrattonDeployment.ps1`
- Create: `demo-platform/tests/deployment/Orchestrator.Tests.ps1`
- Modify: `demo-platform/README.md`
- Modify: `demo-platform/infra/ADMIN-HANDOFF.md`

**Interfaces:**
- Produces: `artifacts/deployment/deployment-state.json`, `what-if.json`, `outputs.json`, and `verification.json`.
- Consumes: all artifacts and scripts from Tasks 1-6.

- [ ] **Step 1: Write failing state-machine tests**

```powershell
It 'cannot deploy before approved what-if state' {
  $state = [pscustomobject]@{
    phase = 'FOUNDATION_WHAT_IF_READY'
    foundationWhatIfApproved = $false
  }
  { Assert-DeploymentTransition -State $state -NextPhase 'PLATFORM_FOUNDATION_DEPLOYED' } |
    Should -Throw 'WHAT_IF_APPROVAL_REQUIRED'
}

It 'never invokes delete or complete-mode deployment commands' {
  $scriptText | Should -Not -Match 'az group delete|az resource delete|--mode Complete'
}
```

- [ ] **Step 2: Run deployment tests and verify failure**

- [ ] **Step 3: Implement explicit phases and resumable state**

Allowed phases:

```powershell
$phases = @(
  'PREFLIGHT_COMPLETE',
  'PROVIDER_REGISTRATION_APPROVED',
  'PROVIDERS_REGISTERED',
  'FOUNDATION_WHAT_IF_READY',
  'PLATFORM_FOUNDATION_DEPLOYED',
  'ENTRA_FOUNDATION_COMPLETE',
  'IMAGES_BUILT',
  'DATA_PLANE_READY',
  'APPLICATION_WHAT_IF_READY',
  'APPLICATIONS_DEPLOYED',
  'ENTRA_REDIRECT_RECONCILED',
  'VERIFIED'
)
```

Persist state atomically after each successful phase. Reject subscription, tenant, commit, or
parameter-hash drift when resuming.

- [ ] **Step 4: Implement explicit provider-registration approval**

The preflight artifact lists unregistered required providers. The orchestrator stops unless
`-ApproveProviderRegistration` is supplied, then registers only those exact namespaces and waits
until each reaches `Registered`. Provider registration is recorded separately because it is a
subscription-level control-plane change outside the Bicep what-if.

- [ ] **Step 5: Implement subscription-scope what-if only after clean preflight**

The foundation what-if uses `deployApplications=false`. The subscription-scope Bicep creates
`stratton-demo-rg` in `westeurope` with tags:

```powershell
@{
  environment = 'dev'
  workload = 'stratton-demo'
  case = 'project-danube'
  owner = 'aram@azurelab.nl'
  managedBy = 'bicep'
}
```

Run incremental subscription what-if and save the full JSON. The script stops at
`FOUNDATION_WHAT_IF_READY` unless `-ApproveFoundationWhatIf` is explicitly supplied.

- [ ] **Step 6: Implement incremental foundation and application deployment**

Use named deployments containing the UTC date and commit prefix. Pass parameters as JSON artifacts;
never place tokens or secrets in command-line arguments or deployment parameters. The foundation
deployment creates the resource group, shared services, and stable managed identities with
`deployApplications=false`. After Entra configuration, image build, and data bootstrap, rerun the
same template with `deployApplications=true`.

After application deployment, call `Set-StrattonEntra.ps1` again with
`https://$($outputs.webAppFqdn)` as the exact SPA redirect URI and remove the provisional local
redirect only after browser verification succeeds.

Before activating applications, run a second subscription-scope what-if with
`deployApplications=true`, the real Entra IDs, and immutable image digests. Stop at
`APPLICATION_WHAT_IF_READY` unless `-ApproveApplicationWhatIf` is explicitly supplied.

- [ ] **Step 7: Implement runtime verification**

Verify:

- resource health and successful Container Apps revisions;
- web external ingress and BFF/Phase 5 internal ingress;
- web `/healthz`, BFF `/healthz`, and Phase 5 health from an internal execution context;
- Entra application/consent/federated credential state;
- private SQL DNS and token-authenticated query;
- Search, Storage, Service Bus, Document Intelligence, and OpenAI role assignments;
- all three ARM/Phase 5 route bindings; and
- authenticated Playwright execution of the Project Danube scenario.

- [ ] **Step 8: Update runbooks**

Document exact commands:

```powershell
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase Preflight
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase FoundationWhatIf
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase FoundationDeploy -ApproveFoundationWhatIf
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase ApplicationWhatIf
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase ApplicationDeploy -ApproveApplicationWhatIf
pwsh -NoProfile -File .\scripts\deployment\Test-StrattonDeployment.ps1
```

- [ ] **Step 9: Run local tests**

Run:

```powershell
npm run clean:generated
npm ci
node .\scripts\verify-demo.mjs
npm run test:deployment
```

Expected: all local gates PASS.

- [ ] **Step 10: Commit**

```powershell
git add demo-platform/scripts/deployment demo-platform/tests/deployment demo-platform/README.md demo-platform/infra/ADMIN-HANDOFF.md
git commit -m "feat: orchestrate standalone Azure deployment"
```

### Task 8: Add the Standalone Topology to Both HTML Guides

**Files:**
- Create: `demo-platform/docs/Stratton-Demo-Guide.html`
- Create: `demo-platform/docs/Stratton-Demo-Guide-SharePoint.html`
- Create: `demo-platform/scripts/deployment/Sync-StrattonGuides.ps1`
- Create: `demo-platform/tests/deployment/Guides.Tests.ps1`
- Update after validation:
  `C:\Users\arsmith\Projects\Agentic-Architecture-v2\cases\Stratton-Europe-Captital\Stratton-Demo-Guide.html`
- Update after validation:
  `C:\Users\arsmith\Projects\Agentic-Architecture-v2\cases\Stratton-Europe-Captital\Stratton-Demo-Guide-SharePoint.html`
- Update matching package copies under:
  `C:\Users\arsmith\Projects\Agentic-Architecture-v2\cases\Stratton-Europe-Captital\stratton-demo-package`

**Interfaces:**
- Produces: tracked authoritative guide sources and SHA-256-identical active-case copies.
- Consumes: the existing active-case guides and the approved architecture/design text.

- [ ] **Step 1: Copy the current guides into tracked documentation sources**

Use `Copy-Item` only for the initial import; all subsequent edits use the tracked
`demo-platform/docs` files.

- [ ] **Step 2: Write failing guide-content and sandbox-safety tests**

```powershell
It 'explains the BFF and the standalone deployment stages' {
  $guide | Should -Match 'Backend for Frontend'
  $guide | Should -Match 'MoA-Sub2'
  $guide | Should -Match 'Preflight'
  $guide | Should -Match 'Azure what-if'
}

It 'keeps the SharePoint edition self-contained' {
  $sharePointGuide | Should -Not -Match '<script[^>]+src=|<link[^>]+href=|fetch\(|XMLHttpRequest|<iframe|<object|<embed'
}
```

- [ ] **Step 3: Run deployment tests and verify failure**

- [ ] **Step 4: Add the approved standalone architecture section**

Include:

- subscription, tenant, region, and resource group;
- public web/internal BFF/internal Phase 5 topology;
- a plain-language BFF definition;
- private SQL and managed-identity boundaries;
- one OpenAI account with three governed deployments;
- seven controlled deployment stages;
- minimum-cost development posture;
- what-if approval and fail-closed controls; and
- post-deployment Project Danube verification.

Use only embedded CSS and semantic HTML. The SharePoint edition must not add scripts, external
resources, storage, navigation APIs, network calls, workers, frames, objects, embeds, or inline event
handlers.

- [ ] **Step 5: Implement checked copy synchronisation**

`Sync-StrattonGuides.ps1` copies only the two named guide files to the four approved destinations,
then compares SHA-256 hashes and throws `GUIDE_HASH_MISMATCH` on divergence.

- [ ] **Step 6: Run tests and synchronise**

```powershell
npm run test:deployment
pwsh -NoProfile -File .\scripts\deployment\Sync-StrattonGuides.ps1
```

Expected: tests PASS and all active-case/package copies match the tracked source.

- [ ] **Step 7: Commit**

```powershell
git add demo-platform/docs demo-platform/scripts/deployment/Sync-StrattonGuides.ps1 demo-platform/tests/deployment/Guides.Tests.ps1
git commit -m "docs: add standalone Azure deployment guide"
```

### Task 9: Validate, Review, and Produce the Authorised What-If

**Files:**
- Modify only if validation exposes defects in files from Tasks 1-8.
- Generate, do not commit: `demo-platform/artifacts/deployment/*.json`

**Interfaces:**
- Produces: clean local validation evidence and the exact Azure create/modify/delete what-if for human approval.
- Consumes: all prior tasks and the authenticated `MoA-Sub2` context.

- [ ] **Step 1: Run complete local verification**

```powershell
Set-Location .\demo-platform
npm run clean:generated
npm ci
node .\scripts\verify-demo.mjs
npm run test:deployment
az bicep build --file .\infra\standalone\main.bicep
az bicep lint --file .\infra\standalone\main.bicep
```

Expected: all commands PASS.

- [ ] **Step 2: Run a fresh read-only Azure preflight**

Expected: no blocking findings. If Azure OpenAI model availability or quota is blocked, stop and
report the exact model/region/quota gap; do not substitute an unapproved region or model silently.

- [ ] **Step 3: Run a whole-change code review**

Use the repository review workflow to check:

- public/private ingress boundaries;
- Entra permissions and federated credential semantics;
- SQL private networking and Entra-only access;
- RBAC scope;
- secret-free parameters and logs;
- image digest enforcement;
- route-evidence/ARM binding;
- state-machine resume safety; and
- guide sandbox safety.

Fix all Critical and Important findings, rerun targeted tests, and repeat review until no merge
blockers remain.

- [ ] **Step 4: Review and approve required provider registrations**

If preflight reports unregistered namespaces, present the exact namespace list. Register only after
explicit approval, then rerun preflight. Do not create the resource group or any workload resource.

- [ ] **Step 5: Generate and inspect the foundation subscription-scope Azure what-if**

```powershell
pwsh -NoProfile -File .\scripts\deployment\Deploy-StrattonStandalone.ps1 -Phase FoundationWhatIf
```

Expected:

- only resources under `stratton-demo-rg`;
- creation of `stratton-demo-rg` itself;
- creates for the approved standalone platform;
- no Container Apps, Container Apps Jobs, or image references because `deployApplications=false`;
- no deletes;
- no unrelated modifications; and
- no secret values.

- [ ] **Step 6: Present the exact foundation what-if and stop for approval**

Do not pass `-ApproveFoundationWhatIf` and do not create the resource group, deploy applications, or
bootstrap data-plane state in this task. Report resource counts by create/modify/delete and list any
policy warnings or estimated standing-cost services.

- [ ] **Step 7: Commit final remediation**

```powershell
git add demo-platform 5-coding-r4 docs
git commit -m "fix: close standalone deployment review findings"
```

Skip the commit if review required no changes.
