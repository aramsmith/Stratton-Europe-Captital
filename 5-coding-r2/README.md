# Stratton Phase 5 package

This directory implements the approved Phase 4 plan bound to manifest
`87ff470043fce913e6dd3e2121430072552443ae5cacaaa1454cb8396a9265c4` and approval
`STRATTON-PHASE-4-APPROVAL-001`.

Phase 4 used `iac/...` as the logical release-package root. Model-plan revision 13 places this
revisioned Phase 5 candidate beneath `5-coding-r2/`, so the path mapping is:

| Approved logical path | Phase 5 path |
|---|---|
| `iac/infra/` | `5-coding-r2/infra/` |
| `iac/contracts/`, application and database work | `5-coding-r2/app/` |
| `iac/tests/` | `5-coding-r2/tests/` |
| `iac/validation/` | `5-coding-r2/validation/` |
| release and deployment instructions | `5-coding-r2/deploy/` and the root release manifest |

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
The repository intentionally ignores local case trees; the source commit is contextual only and the
canonical package-relative Phase 5 hash set is the authoritative candidate binding.

## Execution boundary

Phase 5 may format, restore, compile, lint and test locally. It does not authorise Azure deployment,
Azure target validation, Azure what-if, runtime cloud testing, GitHub OIDC or stored credentials.
Deployment remains a separately authorised AFF-7 or human action after Phase 5 approval.

Run the complete local gate from this directory's parent case root:

```powershell
pwsh -NoProfile -File 5-coding-r2\validation\Invoke-LocalValidation.ps1 -Scope All
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

The `Release` step requires the explicit `STRATTON-CC-001` human approval record to bind the final
Phase 3 and Phase 4 subjects, AFF-A/AFF-B reviews, coverage record and governing model plan. That
record now exists as `STRATTON-CC-001-APPROVAL-001`; owner-bound inputs and unimplemented authority
resources remain fail closed. Run `-Scope All` only while the immutable approval binding remains valid.

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
