# Stratton Phase 5 parameter model

These files are **sentinel-bearing owner-input contracts** and are not directly deployable.

## Selected-DU override model

- `dev.bicepparam`, `tst.bicepparam`, and `prd.bicepparam` include the full approved fail-closed surface.
- `deploymentUnitId` is a dispatcher placeholder and must be overridden per execution target.
- Use `--parameters deploymentUnitId=<DU-xx>` (or equivalent) for each run.
- DU-16 is excluded from `main.bicep`; deploy DU-16 only via `infra/assurance-main.bicep` under assurance authority.

## Sentinel behavior

- Preflight rejects `REQUIRED_OWNER_INPUT` and empty string values in global prerequisites and the
  selected DU's environment-scoped input surface.
- Later-stage sentinels remain explicit in the full parameter contract and do not block an earlier
  selected DU. They fail closed when their own DU is selected.
- Empty selected-DU mandatory structures/collections are rejected before Azure execution.
- The approved STRATTON-CC-001 evidence is hash-bound in every environment contract; its three
  unimplemented authority-provisioning flags remain `false`.

## EU Data Zone model portfolio

All environments retain four DU-11 model keys: `luna`, `terra`, `sol` and `embedding`. The production
parameter contracts are intentionally non-deployable: `modelPortfolioDeploymentEnabled=false`, every
model capacity is `0`, the embedding version remains `REQUIRED_OWNER_INPUT`, and
`modelCapabilityAndQuotaEvidenceByEnvironment` remains unresolved. Native Boolean `false` deliberately
retains those owner sentinels; native Boolean `true` requires exact `dev`, `tst` and `prd` records with
`approvalState: APPROVED`, typed capability/quota evidence IDs, lowercase 64-character SHA-256 values,
and an exact target (`environment`, workload subscription, AI resource group, location and OpenAI account).
Each record's `portfolioBindingSha256` is the SHA-256 of the versioned canonical target, approval state,
evidence IDs/hashes, and all four resolved deployment names, model names/versions, capacities,
`DataZoneStandard`, `NoAutoUpgrade` and `fineTuningEnabled=false`; stale or changed evidence,
target/portfolio values fail admission. The evidence record is
therefore structurally bound to the DU-11 target and portfolio, while the owner remains responsible for
supplying the immutable approved evidence artifacts represented by the IDs/hashes. Local Bicep/test success
is structural validation only and is not quota, capability, Azure Policy alias, deployment or runtime
evidence. The policy alias
`Microsoft.CognitiveServices/accounts/deployments/sku.name` must be verified live only during a
separately authorised pre-deployment evidence step.

## Instantiated design constants in this parameter contract

- Required queue names: `q-ingestion`, `q-extraction`, `q-analysis`, `q-indexing`, `q-audit-export`
- Required identity set: API, ingest, extraction, analysis, indexer, audit-export, deploy, monitor, role-assignment executor, assurance authority
- Required tag keys: `environment`, `workload`, `owner`, `costCenter`, `dataClassification`, `criticality`, `managedBy`
- ALT intent identifiers: `ALT-001`..`ALT-010` (preflight-enforced)
- Central private DNS zone inventory includes SQL/Storage/ServiceBus/KeyVault/AppConfig/Search/OpenAI/Cognitive/ACR/APIM/Monitor zones

Run preflight before any deployment workflow.
