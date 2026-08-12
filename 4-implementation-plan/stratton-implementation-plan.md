# Phase 4 — Implementation Plan: Stratton Release 1

**Decision:** build one modular, Bicep-first package; deploy it only in the catalogue's acyclic stage
order; keep all unresolved values fail-closed.  
**Status:** complete Phase 4 candidate for review, not approved or executable for deployment.  
**Model:** author and actual runtime `gpt-5.6-sol`; model-plan revision
[`5`](../0-coordination/stratton-model-plan-revision-5.json).  
**Approved input:** Phase 3 approval SHA-256
`f6f9de73a70ef3376b90a0ea467ac5d35531f970d362a84bd3b653d35b8a85f3`; manifest SHA-256
`78ee209f9d600e28aba81b8a66012836e32a3850e2156157f0434ae7e6e39945`.

## 1. Decision and blockers

AFF-5 should author a single package under `iac/` with shared modules and only
`dev.bicepparam`, `tst.bicepparam` and `prd.bicepparam` environment files. No environment fork,
credential, deployment script with embedded identity, or floating dependency is permitted.

Production is blocked until exact tenant/subscription/owner identities, both signed-approved regions,
IPAM/WAN/DNS inputs, Application Gateway feature-registration evidence, explicit SQL backup
redundancy, retention/source/workload profiles, support receivers, model/version/quota/provider
evidence and Internal Audit ownership are supplied. The complete 32-item list is authoritative in
[`stratton-implementation-catalogue.json`](stratton-implementation-catalogue.json).

All seven controls remain open and unwaived:

| Control | Owner-bound gate |
|---|---|
| VAL-001 | General Counsel records DORA applicability/exemption before any formal claim or changed obligation. |
| VAL-002 | CIO and Service Operations approve business hours, typical pack and critical alerts before service/performance acceptance. |
| VAL-003 | Deal Operations, AI Governance, Legal, Compliance and CIO approve benchmark/control definitions before Internal Audit validation. |
| VAL-004 | Source/records owners approve instances, schedules, volumes and remediation before production ingestion. |
| VAL-005 | General Counsel approves both EU/EEA regions and exception process before regional production deployment/acceptance. |
| AFFB-RES-001 | General Counsel and AI Governance provide AI Act role/use-case evidence before production AI use or classification claim. |
| AFFB-RES-002 | Legal/compliance add official citations, dates and article mappings before formal regulatory representation. |

No coding, deployment, Azure `what-if` or runtime testing occurred in Phase 4.

## 2. Package and dependency strategy

The package contains `iac/infra/main.bicep`, scope-specific entry points under
`iac/infra/deployments/<DU-ID>/`, shared modules under `iac/infra/modules/`, the three environment
parameter files, policy/contracts/migrations/tests, one local validation orchestrator, a tool-version
record and separate dependency/digest evidence. `main.bicep` composes shared modules; environment files supply values,
never code branches.

Exact AVM references are published candidates, not “current” selections. An independent read-only
research agent using official sources found 21 of Phase 3's 24 distinct pins published but older.
Three are invalid and are corrected here: App Configuration `0.7.1` → `0.10.0`; Action Group
`0.5.1` → `0.8.0`; diagnostic-setting `0.7.2` is rejected because tags stop at `0.1.4` and that
module targets subscription Activity Logs, not arbitrary resource diagnostics. Use reviewed parent
modules' `diagnosticSettings` inputs or hand-written extension resources instead.

AFF-5 must review every candidate interface and changelog. `az bicep restore` populates a tag-keyed
local cache; it does **not** create a lock or digest. A separate
`Capture-OciDigestEvidence.ps1` procedure queries the official MCR Distribution manifest endpoint
and records module, exact tag, `Docker-Content-Digest`, endpoint and retrieval time in
`dependency-evidence.json`. Reject missing or incompatible candidates and never use `latest`.

Additional published candidates may be used only after fit review: management group `0.2.0`;
subscription vending `0.8.0` only if subscriptions are not pre-provisioned; management-group policy
assignment `0.1.0`; Container Apps job `0.7.2`; Application Gateway WAF policy `0.3.0`; and dedicated
SQL database `0.3.0`. Custom policy definitions/initiatives and explicit security wrappers may remain
hand-written. The compact citation and correction record is
[`stratton-official-source-corrections.json`](evidence/stratton-official-source-corrections.json).

The full package tree, exact selections and resource-class mappings are in the catalogue. This plan
maps **23/23 SBBs**, **31/31 Must requirements**, **19/19 ABBs**, **10/10 architecture decisions** and
**44/44 Phase 3 resource-inventory entries**, with no unmapped item, plus **7/7** controls to 17
deployable units or four explicitly non-deployable work packages.

## 3. Ordered deployment DAG

[Standalone safe SVG](diagrams/stratton-dependency-dag.svg)

| Stage | Units | Admission / result |
|---:|---|---|
| 0 | WP-03 owner evidence | Only values needed for the target stage may proceed; later unknowns remain blockers. |
| 1–3 | DU-01 hierarchy → DU-02 guardrails → DU-03 resource groups | Establish separated Citadel hierarchy, inherited denies, naming and tags. |
| 4–6 | DU-04 network → DU-05 central DNS; DU-06 identity after DU-03 | IPAM/WAN/DNS and least privilege precede services. |
| 7 | DU-07 governance ∥ DU-08 monitoring | Parallel after network, DNS and identity. |
| 8 | DU-09 data/recovery | SQL accepts four Azure values, but policy admits explicit Local/Zone only in production; no implicit geo-pair. |
| 9 | DU-10 integration ∥ DU-11 regional AI | Parallel after data; model/provider/limits have no defaults. |
| 10–12 | DU-12 app platform → DU-13 private endpoints → DU-14 APIM lockdown | Images use immutable digest. APIM lockdown requires approved endpoint and DNS proof; no public fallback. |
| 13 | DU-15 private ingress | Requires `EnableApplicationGatewayNetworkIsolation=Registered`; no public frontend. |
| 14 | DU-16 assurance | Internal Audit authority only; delivery cannot alter verdicts. |
| 15 | DU-17 diagnostics | Complete minimised diagnostics and ALT-001–ALT-010 coverage. |

Every unit's dependencies, inputs, outputs, owner, exact module choice, validation, rollback and
evidence are in the catalogue. The graph is acyclic because every edge points from a lower stage to a
higher stage; the only same-stage units are independent parallel pairs.

## 4. Security, release and operational constraints

The Bicep and policy tests must carry all 22 approved assertions without weakening them. In
particular: environment is only `dev|tst|prd`; six subscriptions are distinct; both production
regions are distinct and signed-approved; nonproduction is synthetic; no environment peering;
workload public IP, public SQL/data/AI/configuration endpoints, Global/DataZone AI, fine-tuning,
secret parameters and missing mandatory tags are denied; rollout remains at most 20.

API Management is deliberately staged. DU-10 creates no admitted route. DU-13 creates and obtains
approval for group ID `Gateway`, then creates/links `privatelink.azure-api.net` and proves private
resolution and the gateway path. Only then does DU-14 set `publicNetworkAccess=Disabled`; restoring
the public gateway is not rollback. The implementation must review the selected APIM tier and
networking interface rather than inventing one universal CLI/network mode. Data/AI services are
disabled from public access and application enablement waits for private DNS proof.

Application Gateway's `snet-ingress` is delegated to `Microsoft.Network/applicationGateways`.
Private-only ingress also requires per-target-subscription evidence that
`Microsoft.Network/EnableApplicationGatewayNetworkIsolation` is `Registered`.

Azure SQL accepts `Geo`, `GeoZone`, `Local` and `Zone` for backup storage redundancy. Stratton policy
permits only an explicit `Local` or `Zone` production value after region capability evidence. The
choice applies to STR/LTR, affects future backups, can take up to 48 hours, and removes geo-restore;
the signed-approved failover group provides cross-region recovery.

Every private endpoint carries an explicit group ID, central private DNS zone, VNet link and
resolver/forwarder path. These are listed in the catalogue. The central connectivity subscription
owns them; no zone, link, Container Apps default-domain zone, resolver or enterprise forwarding
topology is inferred.

Production requires a hash-bound release manifest, approved change/ticket window, named deployer and
role-assignment executor, target subscriptions/regions, backup and restore position, rollback owner,
communications, monitoring readiness and explicit go/no-go. A failed stage stops downstream work,
retains command output, correlation/deployment IDs and state inventory, assigns the owning unit and
requires correction plus a new scoped authorisation before retry.

Rollback favours traffic stop, scale-to-zero, previous immutable image digest, forward correction,
PITR and controlled private DNS failback. Deletion, failover/failback, restore, replication removal,
role revocation, immutable-policy change, Key Vault purge or production cleanup is destructive and
requires the human/AFF-7 authorisation to name it. Internal Audit alone controls assurance cleanup.

Operations accepts the service only with owners for RB-001–RB-012, alert receivers and 8x5 rota,
dashboards, minimised telemetry/retention, identity/PIM/emergency access, backup/restore and
state-consistency procedures, model-change suspension, first-three-deal reconciliation and the
20-deal stop. Evidence and release manifests are retained under the approved schedule/legal holds;
no duration is invented.

Cost control starts pay-as-you-go through evidence-led benchmarking. FinOps prepares an
owner-approved Azure Pricing Calculator bill of materials only after region, capacity and commercial
inputs exist; budgets/alerts monitor hubs, Firewall/DNS, APIM/Application Gateway, SQL, Search,
regional AI, warm recovery, immutable storage and logs. Cost never justifies weakening separation,
retention, recovery or security.

## 5. Phase 5 authoring and local validation

### Prerequisites

AFF-5 must record exact versions in `iac/tooling/tool-versions.json`: Azure CLI/Bicep, PowerShell,
Pester, PSRule for Azure, Node/npm and repository-selected linters/scanners. It must provide a clean
checkout, no Azure credential files, the approved Phase 3/4 hashes, dependency/network access needed
only for initial restore, and owner-supplied non-secret parameter values. Foundry Citadel, ALZ and
sovereign policy revisions remain blockers until immutable revisions and adaptation records exist.

### Commands and expected outcomes

Run from the case root in PowerShell. AFF-5 authors the referenced scripts/configuration first.

```powershell
# Tool and source hygiene
az version
az bicep version
git status --short
pwsh -NoProfile -File iac/validation/Invoke-LocalValidation.ps1 -Scope Prerequisites
```

Expected: pinned tools match `tool-versions.json`; clean intended worktree; no secrets, credentials,
unknown parameter defaults or upstream edits.

```powershell
# Non-mutating format comparison, restore/cache, lint and build
Get-ChildItem iac/infra -Recurse -Filter *.bicep | ForEach-Object {
  $formatted = ((az bicep format --file $_.FullName --stdout) -join "`n").Replace("`r`n","`n").TrimEnd([char]10)
  $current = (Get-Content $_.FullName -Raw).Replace("`r`n","`n").TrimEnd([char]10)
  if ($formatted -cne $current) {
    throw "Bicep formatting differs: $($_.FullName)"
  }
}
az bicep restore --file iac/infra/main.bicep --force
az bicep lint --file iac/infra/main.bicep
az bicep build --file iac/infra/main.bicep --outfile iac/out/main.json
'dev','tst','prd' | ForEach-Object {
  az bicep build-params --file "iac/infra/parameters/$_.bicepparam" `
    --outfile "iac/out/$_.parameters.json"
}
pwsh -NoProfile -File iac/validation/Invoke-LocalValidation.ps1 -Scope Bicep
```

Expected: format creates no subsequent diff; restore resolves every exact reference and writes
only the tag-keyed local cache; lint/build emit no unaccepted result; all parameters compile without
a secret or production default. Then run
`pwsh -NoProfile -File iac/validation/Capture-OciDigestEvidence.ps1`; expected: independently captured
MCR manifest digests and retrieval metadata match every exact external module reference.

```powershell
# Parameter consistency, ARM/template unit tests, policy and security
Invoke-Pester -Path iac/tests/parameters -CI
Invoke-Pester -Path iac/tests/unit -CI
Invoke-PSRule -InputPath iac/out -Module PSRule.Rules.Azure -Outcome Fail,Error
Invoke-PSRule -InputPath iac/out -Path iac/tests/policy -Outcome Fail,Error
pwsh -NoProfile -File iac/validation/Invoke-LocalValidation.ps1 -Scope Security
```

Expected: dev/tst/prd expose the same parameter schema; all 32 fail-closed parameters and 22
assertions are tested; rendered templates prove public-access denial, identities, tags, diagnostics,
locations, SQL backup redundancy and APIM sequencing; JSON/ARM schemas and secret scans pass.

```powershell
# Contracts, migrations, application and supply chain (only after WP-01 exists)
npm ci --offline
npm run lint:openapi
npm run check:openapi-compat
pwsh -NoProfile -File iac/validation/Invoke-LocalValidation.ps1 -Scope Database
pwsh -NoProfile -File iac/validation/Invoke-LocalValidation.ps1 -Scope Application
pwsh -NoProfile -File iac/validation/Invoke-LocalValidation.ps1 -Scope Containers
```

Expected: OpenAPI is valid/backward-compatible; migrations pass static/least-privilege review;
selected application formatter, linter, type/build, unit and local integration tests pass; images
have immutable digests, SBOM, signature, vulnerability and licence results with no unaccepted
finding. The orchestrator must fail clearly as **not applicable** only where no application artefact
exists; it may not silently skip an applicable check.

```powershell
# Local determinism/idempotency-oriented assertion
az bicep build --file iac/infra/main.bicep --outfile iac/out/main.first.json
az bicep build --file iac/infra/main.bicep --outfile iac/out/main.second.json
if ((Get-FileHash iac/out/main.first.json -Algorithm SHA256).Hash -ne
    (Get-FileHash iac/out/main.second.json -Algorithm SHA256).Hash) { throw 'Non-deterministic build' }
Invoke-Pester -Path iac/tests -CI
```

Expected: identical inputs produce byte-identical templates; duplicate-role/name tests and
dependency/DAG tests pass. This is not runtime deployment idempotency.

```powershell
# Release manifest and content hashes
pwsh -NoProfile -File iac/validation/Invoke-LocalValidation.ps1 -Scope Release
$HashRoot = (Resolve-Path -LiteralPath 'iac').Path
$ContentHashManifest = Join-Path $HashRoot 'release/content-hashes.json'
$RelativePaths = @(
  Get-ChildItem -LiteralPath $HashRoot -Recurse -File |
    ForEach-Object {
      $RelativePath = [IO.Path]::GetRelativePath($HashRoot, $_.FullName).Replace('\', '/')
      if (
        $RelativePath -notmatch '(^|/)out(/|$)' -and
        $RelativePath -ne 'release/content-hashes.json'
      ) {
        $RelativePath
      }
    }
)
[Array]::Sort($RelativePaths, [StringComparer]::Ordinal)
$ContentHashes = @(
  $RelativePaths |
  ForEach-Object {
    $ResolvedPath = Join-Path $HashRoot $_
    [ordered]@{
      path = $_
      sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $ResolvedPath).Hash.ToLowerInvariant()
    }
  }
)
$ContentHashJson = ConvertTo-Json -InputObject $ContentHashes -Depth 4 -Compress
[IO.File]::WriteAllText(
  $ContentHashManifest,
  $ContentHashJson,
  [Text.UTF8Encoding]::new($false)
)
```

Expected: schema-valid release manifest binds source commit, tool versions, module digests, parameter
hashes, template/image hashes, test results, upstream approvals and unresolved blockers. The explicit
file set excludes the generated hash manifest itself. Hashing resolves full filesystem paths, while
the evidence is ordinal-sorted and serialised with normalised paths relative to the `iac` root, so
recomputation is independent of the checkout location. Compact JSON is written explicitly as UTF-8
without BOM or platform-specific trailing newline. Phase 5 does not deploy.

The commands above are local and require no Azure target permissions after dependencies are cached.
ARM `validate`, subscription feature/provider/quota checks and `what-if` are separate Azure
preflights. They require interactive or approved managed-identity authentication and permissions at
the exact target scope. Use the command matching each unit's tenant, management-group or subscription
scope; do not invent one universal path.

```powershell
az deployment sub validate --name $DeploymentName --location $DeploymentRecordLocation `
  --subscription $TargetSubscriptionId --template-file $EntryPoint `
  --parameters $ParameterFile
```

Expected: ARM accepts the selected target-scope request and policy does not reject it. No resource is
deployed. Tenant and management-group units use their corresponding `az deployment tenant validate`
or `az deployment mg validate` command only when the approved identity has that scope.

At minimum, an authorised subscription preflight verifies providers, quotas/SKUs and:

```powershell
az feature show --namespace Microsoft.Network --name EnableApplicationGatewayNetworkIsolation `
  --subscription $TargetSubscriptionId --query properties.state -o tsv
```

Expected `Registered` for every ingress target. Missing access or any other state blocks DU-15.

Azure `what-if` is separate, target- and identity-authorised and not mandatory without Azure access:

```powershell
az deployment sub what-if --name $DeploymentName --location $DeploymentRecordLocation `
  --subscription $TargetSubscriptionId --template-file $EntryPoint `
  --parameters $ParameterFile --result-format FullResourcePayloads
```

It must not run in Phase 5 unless that phase's governing profile and explicit authorisation permit it.

## 6. Manual deployment pattern

Phase 7 is **not invoked by this plan**. After approved Phase 6 and a separate attempt-specific human
authorisation, a human uses interactive sign-in:

```powershell
az login --use-device-code
az account show
az account set --subscription $TargetSubscriptionId
az deployment sub create --name $DeploymentName --location $DeploymentRecordLocation `
  --subscription $TargetSubscriptionId --template-file $EntryPoint `
  --parameters $ParameterFile
```

Tenant/management-group units use the corresponding `az deployment tenant create` or
`az deployment mg create --management-group-id $ManagementGroupId` command with the same hash-bound
entry point and parameters. AFF-7 may instead use only the managed identity explicitly named by its
authorisation. GitHub OIDC, service-principal secrets, certificates stored in the case and cached
credentials as release artefacts are prohibited.

Execute DU-01 through DU-17 exactly by stage, capturing before/after inventory, command/output,
deployment operation IDs, policy results and approvals. Do not infer values: `$TargetSubscriptionId`,
`$DeploymentRecordLocation`, `$EntryPoint`, `$ParameterFile`, `$ManagementGroupId` and
`$DeploymentName` must come from the approved attempt/release manifest.

## 7. AFF-5 handoff

AFF-5 can proceed with package authoring and local validation, but not Azure execution. It must:

1. create exactly the catalogue package structure and no environment fork;
2. implement units and WP-01 without changing Phase 3 intent;
3. preserve every fail-closed parameter, assertion, release constraint and open control;
4. review each AVM interface/changelog, restore its exact tag to cache and separately capture digest
   evidence, or record a governed incompatibility for AFF-3;
5. author the validation orchestrator/tests so every command above is executable;
6. produce a hash-bound release manifest and complete local evidence;
7. stop on unknown values, infeasible boundaries or any proposed public/credential fallback.

Phase 5 completion requires successful local format/lint/restore/build, parameter, policy/security,
template/unit, deterministic-build, application (where applicable), supply-chain, release-manifest
and content-hash checks. Azure access, `what-if`, deployment and runtime evidence are not Phase 5
success criteria.
