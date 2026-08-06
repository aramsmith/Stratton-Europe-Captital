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

## Instantiated design constants in this parameter contract

- Required queue names: `q-ingestion`, `q-extraction`, `q-analysis`, `q-indexing`, `q-audit-export`
- Required identity set: API, ingest, extraction, analysis, indexer, audit-export, deploy, monitor, role-assignment executor, assurance authority
- Required tag keys: `environment`, `workload`, `owner`, `costCenter`, `dataClassification`, `criticality`, `managedBy`
- ALT intent identifiers: `ALT-001`..`ALT-010` (preflight-enforced)
- Central private DNS zone inventory includes SQL/Storage/ServiceBus/KeyVault/AppConfig/Search/OpenAI/Cognitive/ACR/APIM/Monitor zones

Run preflight before any deployment workflow.
