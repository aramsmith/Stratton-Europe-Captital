# Stratton deployment procedure

This procedure is prepared for a future human or separately authorised AFF-7 run. It has not been
executed in Phase 5.

## 1. Admission

Before any Azure command:

1. Verify the retained approved `STRATTON-CC-001` authority record, active `STRATTON-CC-002`
   sequence-2 record, and a new explicit human approval for the exact r7 Phase 5 hash manifest.
2. Verify the separate Phase 7 execution authorisation identifies one environment, identity, target,
   deployment unit, parameter-file hash, package hash, time window, permitted actions and abort
   conditions.
3. Use interactive Azure sign-in or the specifically authorised managed identity. GitHub OIDC, stored
   credentials, service-principal secrets and credential files are prohibited.
4. Confirm every global prerequisite and selected-DU `REQUIRED_OWNER_INPUT` sentinel has been
   replaced by approved non-secret evidence. Later-stage sentinels remain explicit and must not be
   used until their own stage is selected and authorised.
5. Confirm all seven owner-bound controls required by the intended stage are satisfied; unresolved
   later-stage controls remain blockers for those later stages only.
6. Confirm the deployment identity is distinct from the role-assignment executor and Internal Audit.
7. Treat validation, what-if and deployment as separate authorised actions. A successful validation
   does not authorise what-if or deployment.

## 2. Local package verification

Run from the case root:

```powershell
pwsh -NoProfile -File .\5-coding-r7\validation\Invoke-LocalValidation.ps1 -Scope All
```

The command must pass against the exact package hash used by the execution authorisation. A changed
file, missing tool, failed check or unaccepted finding stops the run.

Prepare an execution-specific ARM parameter file outside the immutable case package. Start from the
approved environment template, then replace owner sentinels only with approved values:

```powershell
$CaseRoot = (Get-Location).Path
$Environment = 'dev' # dev, tst or prd; must match the Phase 7 authorisation
$DeploymentUnitId = 'DU-03' # exact authorised DU
$ExecutionRoot = Join-Path $env:TEMP "stratton-$Environment-$DeploymentUnitId"
$ApprovedParameters = Join-Path $ExecutionRoot 'approved.parameters.json'
$env:BICEP_CLI_DISABLE_VERSION_CHECK = 'true'

New-Item -ItemType Directory -Force -Path $ExecutionRoot | Out-Null
$compiledOutput = @(
  az bicep build-params `
  --file ".\5-coding-r7\infra\parameters\$Environment.bicepparam" `
  --stdout 2>&1 |
    ForEach-Object { $_.ToString() } |
    Where-Object { $_ -notmatch '^WARNING: A new Bicep release is available' }
)
if ($LASTEXITCODE -ne 0) { throw 'Bicep parameter compilation failed.' }
$compiled = ($compiledOutput -join "`n") | ConvertFrom-Json -Depth 100
$compiled.parametersJson | Set-Content -LiteralPath $ApprovedParameters -Encoding utf8NoBOM
```

The human owner must now replace the global prerequisites and exact selected-DU inputs required by
the authorised environment and stage. Leave later-stage sentinels explicit; do not invent or waive
them, and do not edit the packaged `.bicepparam` file. Bind the final file to the Phase 7
authorisation after selecting the exact target:

```powershell
$document = Get-Content -Raw -LiteralPath $ApprovedParameters | ConvertFrom-Json -Depth 100
$document.parameters.environment.value = $Environment
$document.parameters.deploymentUnitId.value = $DeploymentUnitId
$document | ConvertTo-Json -Depth 100 |
  Set-Content -LiteralPath $ApprovedParameters -Encoding utf8NoBOM

$RuntimeTenantId = 'REQUIRED_OWNER_INPUT'
$preflight = @(
  '-NoProfile',
  '-File', (Join-Path $CaseRoot '5-coding-r7\tests\iac\Invoke-DeploymentPreflight.ps1'),
  '-ParameterObjectFile', $ApprovedParameters,
  '-DeploymentUnitId', $DeploymentUnitId,
  '-Environment', $Environment
)
if ($DeploymentUnitId -eq 'DU-01') {
  $preflight += @('-RuntimeTenantId', $RuntimeTenantId)
}
& pwsh @preflight
if ($LASTEXITCODE -ne 0) { throw 'Deployment preflight failed.' }

$ParameterSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ApprovedParameters).Hash.ToLowerInvariant()
Write-Host "Authorised parameter SHA-256: $ParameterSha256"
```

The displayed hash, environment and deployment unit must exactly match the execution authorisation.

## 3. Azure context and read-only preflight

Only after the execution authorisation permits the exact identity, action and targets:

```powershell
$DeploymentLocation = 'REQUIRED_OWNER_INPUT' # approved deployment-record location
$AuthorisedAccountName = 'REQUIRED_OWNER_INPUT'
$context = az account show --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'No authorised Azure context.' }
if ($context.tenantId -ne $RuntimeTenantId) {
  throw "Tenant mismatch. expected=$RuntimeTenantId actual=$($context.tenantId)"
}
if ([string]$context.user.name -cne $AuthorisedAccountName) {
  throw "Identity mismatch. expected=$AuthorisedAccountName actual=$($context.user.name)"
}
```

Confirm only the resource providers, quotas and evidence required by the selected stage. For DU-15,
confirm `Microsoft.Network/EnableApplicationGatewayNetworkIsolation` is `Registered` in the selected
target subscription. For DU-01 through DU-15 and DU-17, the independently selectable root is a
tenant-scope deployment:

```powershell
$Template = Join-Path $CaseRoot '5-coding-r7\infra\main.bicep'
$DeploymentName = "stratton-$Environment-$($DeploymentUnitId.ToLower())-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
$common = @(
  '--name', $DeploymentName,
  '--location', $DeploymentLocation,
  '--template-file', $Template,
  '--parameters', "@$ApprovedParameters"
)

az deployment tenant validate @common --output json
if ($LASTEXITCODE -ne 0) { throw 'Azure validation failed.' }
```

Validation is read-only but is still an Azure action and was not run during Phase 5. Save its output as
redacted append-only evidence. Run what-if only when separately authorised:

```powershell
az deployment tenant what-if @common --output json
if ($LASTEXITCODE -ne 0) { throw 'Azure what-if failed.' }
```

Stop on any unexpected delete, replacement, public-access enablement, policy weakening, role
escalation, location change or unresolved diagnostic omission. Deployment requires a further explicit
authorisation:

```powershell
az deployment tenant create @common --output json
if ($LASTEXITCODE -ne 0) { throw 'Azure deployment failed.' }
```

Use the normal deployment identity for DU-01 through DU-05, DU-07 through DU-15 and DU-17. Run DU-06
only as the separately authorised role-assignment executor. Do not retain multiple privileged Azure
sessions when changing authority.

## 4. Independent Internal Audit deployment

DU-16 is not exposed by the tenant root. It has a separate subscription-scope entrypoint and may run
only in `prd`, using the Internal Audit identity and assurance subscription.

Start from the approved `prd` root parameters, run the local preflight with
`-DeploymentUnitId DU-16 -Environment prd`, then derive the exact DU-16 parameter file:

```powershell
$DeploymentUnitId = 'DU-16'
$Environment = 'prd'
$InternalAuditSubscriptionId = 'REQUIRED_OWNER_INPUT'
$InternalAuditAccountName = 'REQUIRED_OWNER_INPUT'
$ExecutionRoot = Join-Path $env:TEMP 'stratton-prd-DU-16'
$ApprovedParameters = Join-Path $ExecutionRoot 'approved.parameters.json'
$AssuranceParameters = Join-Path $ExecutionRoot 'approved.assurance.parameters.json'
$rootParameters = Get-Content -Raw -LiteralPath $ApprovedParameters | ConvertFrom-Json -Depth 100
$required = @(
  'internalAuditSubscriptionIdAndAdminGroup',
  'retentionScheduleMapVersion',
  'legalHoldOwner',
  'ownerTag',
  'costCenterTag',
  'productionDataClassificationTag',
  'criticalityTag',
  'du16'
)
$assurance = [ordered]@{
  '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
  contentVersion = '1.0.0.0'
  parameters = [ordered]@{}
}
foreach ($name in $required) {
  $property = $rootParameters.parameters.PSObject.Properties[$name]
  if ($null -eq $property) { throw "Missing assurance parameter: $name" }
  $assurance.parameters[$name] = $property.Value
}
$assurance | ConvertTo-Json -Depth 100 |
  Set-Content -LiteralPath $AssuranceParameters -Encoding utf8NoBOM

& pwsh -NoProfile `
  -File (Join-Path $CaseRoot '5-coding-r7\tests\iac\Invoke-DeploymentPreflight.ps1') `
  -ParameterObjectFile $ApprovedParameters `
  -DeploymentUnitId DU-16 `
  -Environment prd
if ($LASTEXITCODE -ne 0) { throw 'DU-16 preflight failed.' }

$AssuranceParameterSha256 =
  (Get-FileHash -Algorithm SHA256 -LiteralPath $AssuranceParameters).Hash.ToLowerInvariant()
Write-Host "Authorised assurance parameter SHA-256: $AssuranceParameterSha256"
```

The assurance parameter hash must be explicitly bound by the Phase 7 authorisation. After signing in
as the authorised Internal Audit identity, verify the context and run the same separate
validate/what-if/create gates:

```powershell
$context = az account show --subscription $InternalAuditSubscriptionId --output json |
  ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $context.tenantId -ne $RuntimeTenantId) {
  throw 'Internal Audit Azure context does not match the authorised tenant.'
}
if ([string]$context.user.name -cne $InternalAuditAccountName) {
  throw 'Internal Audit Azure identity does not match the authorised principal.'
}

$AssuranceTemplate = Join-Path $CaseRoot '5-coding-r7\infra\assurance-main.bicep'
$AssuranceName = "stratton-prd-du16-$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss'))"
$assuranceCommon = @(
  '--subscription', $InternalAuditSubscriptionId,
  '--name', $AssuranceName,
  '--location', $DeploymentLocation,
  '--template-file', $AssuranceTemplate,
  '--parameters', "@$AssuranceParameters"
)

az deployment sub validate @assuranceCommon --output json
if ($LASTEXITCODE -ne 0) { throw 'DU-16 Azure validation failed.' }
```

Only after separate what-if authorisation:

```powershell
az deployment sub what-if @assuranceCommon --output json
if ($LASTEXITCODE -ne 0) { throw 'DU-16 Azure what-if failed.' }
```

Only after a further explicit deployment authorisation:

```powershell
az deployment sub create @assuranceCommon --output json
if ($LASTEXITCODE -ne 0) { throw 'DU-16 Azure deployment failed.' }
```

The Bicep deployment creates version-enabled containers and **unlocked** time-based retention
policies. It does not claim that the irreversible policy lock or legal hold already exists, and
`retentionFinalization.dataAdmissionEnabled` must remain `false` with state
`BLOCKED_PENDING_SEPARATELY_AUTHORISED_LOCK_AND_LEGAL_HOLD_EVIDENCE`.

Only after a separate Phase 7 human authorisation may Internal Audit execute the irreversible
retention-finalisation script. The authorisation record and its SHA-256 are mandatory inputs:

```powershell
& (Join-Path $CaseRoot '5-coding-r7\deploy\Invoke-AssuranceRetentionFinalization.ps1') `
  -SubscriptionId $InternalAuditSubscriptionId `
  -TenantId $RuntimeTenantId `
  -ResourceGroupName 'REQUIRED_OWNER_INPUT' `
  -EvidenceStorageAccountName 'REQUIRED_OWNER_INPUT' `
  -EvidenceContainerName 'REQUIRED_OWNER_INPUT' `
  -VerdictStorageAccountName 'REQUIRED_OWNER_INPUT' `
  -VerdictContainerName 'REQUIRED_OWNER_INPUT' `
  -LegalHoldTags @('REQUIRED_OWNER_INPUT') `
  -HumanAuthorisationPath 'REQUIRED_OWNER_INPUT' `
  -HumanAuthorisationSha256 'REQUIRED_OWNER_INPUT' `
  -EvidenceOutputDirectory 'REQUIRED_OWNER_INPUT' `
  -Execute `
  -Confirm:$false
```

The script obtains each policy ETag, locks both policies, sets legal holds, rereads the observed
Azure state and emits hashable evidence. Only after that evidence is independently accepted may an
approved parameter revision set:

- `state` to `ACTIVE_OBSERVED_LOCK_AND_LEGAL_HOLD_EVIDENCE_VERIFIED`;
- `dataAdmissionEnabled` to `true`;
- both immutability-lock and legal-hold evidence IDs and SHA-256 values.

Rerun DU-16 preflight against that exact approved parameter object before any data admission. A
declarative boolean or requested configuration is never accepted as proof of the observed lock or
legal hold.

No Azure validation, what-if or deployment was run during Phase 5.

## 5. Stage order

Deploy only admitted stages, in this order:

| Stage | Units | Required gate |
|---:|---|---|
| 0 | WP-03 parameters/evidence | All inputs for the selected target stage are approved. |
| 1 | DU-01 | Parent management group, subscriptions, ownership and permissions. |
| 2 | DU-02 | Reviewed policy revisions, approved locations and Citadel source decision. |
| 3 | DU-03 | Naming, location codes, owner and cost centre. |
| 4 | DU-04 | IPAM, WAN, routing and egress evidence. |
| 5 | DU-05 | Central DNS ownership, resolver and forwarding targets. |
| 6 | DU-06 | Identity groups and separated role-assignment executor. |
| 7 | DU-07, DU-08 | Governance source, retention and receivers; units may run in parallel. |
| 8 | DU-09 | Regions, SQL backup capability, retention and recovery inputs. |
| 9 | DU-10, DU-11 | API, workload, regional model, provider and quota inputs. |
| 10 | DU-12 | Locally validated immutable application image digests. |
| 11 | DU-13 | Private-link targets and central DNS zones exist. |
| 12 | DU-14 | APIM Gateway private endpoint is approved and private DNS/path proof exists. |
| 13 | DU-15 | Application Gateway network-isolation feature registration is evidenced. |
| 14 | DU-16 | Internal Audit identity, subscription and immutable-retention inputs. |
| 15 | DU-17 | Complete deployed-resource inventory exists. |

Preflight uses this approved dependency/stage model to evaluate assertions applicable to the selected
DU and its dependency closure. Sentinel admission remains narrower: only global prerequisites and
the selected DU's mandatory, environment-scoped values are required for the current execution.
Selecting a later DU exposes and rejects its unresolved sentinels.

Never admit an application or data route before APIM private connectivity is proven and public access
is disabled. Never use a public APIM gateway or public Application Gateway frontend as fallback.

## 6. Verification

Capture redacted evidence for:

- deployment operation and template hash;
- resource IDs, locations, tags and managed identities;
- public-network denial and private endpoint approval;
- central DNS records, links, resolver paths and private resolution;
- deterministic RBAC and independent assurance ownership;
- SQL backup redundancy, failover configuration and restore plan;
- regional AI deployment type and provider/model evidence;
- diagnostics, alerts, immutable audit storage and hash-chain verification;
- application health, draft-only behaviour and prohibited-action negative tests.

Runtime verification must use synthetic data unless a separately approved production test permits
otherwise.

## 7. Rollback and cleanup

Rollback is stage-specific and approval-bound:

- stop admission and traffic before changing infrastructure;
- prefer forward correction, prior image digest or SQL PITR;
- preserve queues, DLQs, logs, audit records, release evidence and immutable verdicts;
- never re-enable public access as a recovery shortcut;
- never cancel subscriptions, delete shared hubs/DNS, purge Key Vault, remove legal holds, weaken
  immutability, fail over/fail back, delete data or revoke assurance ownership without the named
  accountable approvals;
- cleanup may remove only newly created, empty and dependency-free resources explicitly listed in the
  execution authorisation.

Every deployment, rollback and cleanup attempt requires a new append-only evidence record and the
post-attempt human gate.
