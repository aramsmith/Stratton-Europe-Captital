# Stratton Phase 5 package

This directory is the governance-correct CC-002 sibling candidate. It implements the approved
Phase 4 CC-002 plan bound to manifest
`5ab254e33ee9460c56026809071a3315b5fce7de887e99c65bf6d100a0140c0b` and approval
`STRATTON-PHASE-4-CC-002-APPROVAL-001`.

Phase 4 used `iac/...` as the logical release-package root. The material CC-002 propagation is
isolated beneath `5-coding-r7/`; reviewed `5-coding-r6` and `5-coding-r5`, and approved
`5-coding-r4` remain byte-for-byte frozen:

| Approved logical path | Phase 5 path |
|---|---|
| `iac/infra/` | `5-coding-r7/infra/` |
| `iac/contracts/`, application and database work | `5-coding-r7/app/` |
| `iac/tests/` | `5-coding-r7/tests/` |
| `iac/validation/` | `5-coding-r7/validation/` |
| release and deployment instructions | `5-coding-r7/deploy/` and the root release manifest |

## Package boundary

- `infra/` — parameterised Bicep for DU-01 through DU-17 and dev, tst and prd.
- `app/` — draft-only application, contracts, migrations and container definitions.
- `tests/` — executable IaC, application and package-integrity tests.
- `validation/` — local validation and dependency-evidence scripts.
- `deploy/` — human/AFF-7 procedure, verification, rollback and cleanup boundaries.
- `evidence/` — redacted command evidence produced during Phase 5 validation.
- `release/` — the release-manifest schema and canonical integrity contract.

The package contains no approved production values, credentials or secrets. Required owner inputs use
explicit fail-closed sentinels and must be replaced only through governed parameter evidence.

## EU Data Zone model portfolio

DU-11 defines the `luna`, `terra`, `sol` and `embedding` deployment contracts for dev, tst and prd.
Each GPT-5.6 contract pins version `2026-07-09`; every contract uses `DataZoneStandard`,
`NoAutoUpgrade` and native Boolean `fineTuningEnabled: false`. Global Standard is prohibited.
`modelPortfolioDeploymentEnabled` remains native Boolean `false`, and all production capacities remain
`0`; this is an intentional fail-closed owner sentinel. Local compilation and tests validate structure
only: they do not establish quota, regional model capability, Azure Policy alias availability, deployment
admission or runtime readiness. Before any separately authorised deployment, the owner must provide
positive capacities, the embedding version, approved capability/quota evidence, and live confirmation
that `Microsoft.CognitiveServices/accounts/deployments/sku.name` is available for policy enforcement.

The retained `infra/modules/regional-ai` path is a historical compatibility name. It remains the DU-11
module path and does not describe a permitted regional-only deployment SKU.
The repository intentionally ignores local case trees; the source commit is contextual only and the
canonical package-relative Phase 5 hash set is the authoritative candidate binding.

The application runtime owns deterministic Luna/Terra/Sol selection through
`stratton-model-routing-v1` and a strict per-tier deployment/residency map. Callers cannot select a
deployment or model. Route identity is persisted by migration `002_model_routing.sql`; observation
telemetry remains absent until actually returned and validated. This does not enable production
inference: Azure mode retains the blocked provider boundary and rejects the analysis queue.
The benchmark template contains null observations and
`BLOCKED_PENDING_OBSERVED_EVIDENCE` for every route; benchmark promotion remains blocked.

## Execution boundary

Phase 5 may format, restore, compile, lint and test locally. It does not authorise Azure deployment,
Azure target validation, Azure what-if, runtime cloud testing, GitHub OIDC or stored credentials.
Deployment remains a separately authorised AFF-7 or human action after Phase 5 approval.

Run the complete local gate from this directory's parent case root:

```powershell
pwsh -NoProfile -File 5-coding-r7\validation\Invoke-LocalValidation.ps1 -Scope All
```

The orchestrator writes redacted command evidence, fails on missing tools or failed checks, and does
not call an Azure target. Source and container scans record the exact Trivy database metadata and
leave licence acceptance to AFF-B rather than silently accepting a policy.

The full local validation run's `release-evidence` step validates and writes the release manifest
only. It does not generate the build report or Phase 5 hash manifest, and it does not run
`Test-ReleaseEvidence.ps1`. Those actions form the subsequent freeze sequence shown below. This
separation avoids a self-referential hash cycle and prevents the retained validation index from
claiming that final self-excluding hash verification occurred inside the full validation run.

The subsequent freeze gives reviewers one checkout-independent, self-excluding hash set. It includes
the release manifest, both build reports and only the validation, container, source-security and
dependency evidence referenced by that release candidate; superseded local runs remain audit history
but are not part of the frozen candidate.

The `Release` step retains the original `STRATTON-CC-001` authority baseline and separately binds
active `STRATTON-CC-002` approval sequence 2, Phase 3 CC-002 approval sequence 2, Phase 4 CC-002
approval sequence 1 and its exact subject, model-plan revision 111, and the superseded approved r4
manifest/approval. CC-002 supersedes r4 only for this model-portfolio sibling; it does not replace
unrelated CC-001 authority controls.

This r7 package is an AFF-5 candidate authored by `gpt-5.6-sol`. It is awaiting AFF-A, AFF-B and
explicit human approval. It claims no approval, deployment readiness or autonomous decision authority.

After the full local gate passes, freeze and independently verify the candidate in this order:

```powershell
pwsh -NoProfile -File validation\New-BuildReport.ps1
pwsh -NoProfile -File validation\New-Phase5Hashes.ps1
pwsh -NoProfile -File validation\Test-ReleaseEvidence.ps1
```

Container evidence uses pinned Azure Linux Node images and builds `linux/amd64`, the image
architecture supported by Azure Container Apps. ARM64 workstations require the pinned QEMU user-mode
emulator recorded in `tooling\tool-versions.json`; the validation gate verifies it before building.
The local digest statement is signed with an ephemeral Cosign key after the vulnerability and secret
gate passes, with transparency-log upload disabled. Production registry signing remains an authorised
release-identity responsibility outside Phase 5.
