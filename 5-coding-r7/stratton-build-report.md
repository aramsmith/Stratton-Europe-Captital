# Stratton Phase 5 build report

Generated: 2026-08-09T16:34:25.6581131Z

## Outcome

- Candidate status: **READY_FOR_ASSURANCE**
- Deployment ready: **False**
- Full local validation: **PASS** (run 20260809T161802421Z)
- Validation input SHA-256: **26ac6a6e1ade2e58f74e13a276c7d345f971dcb516ecd8bfe9012618d71fa558** (124 files)
- Azure authenticated, validated, what-if, or deployed: **No**
- Release manifest: [stratton-release-manifest.json](stratton-release-manifest.json)

The package is implementation and assurance evidence only. It does not authorise Azure access,
what-if, deployment, production signing, runtime testing, compliance certification, or owner-value
substitution.

## Inventory

- `app/`: 43 files
- `deploy/`: 2 files
- `infra/`: 39 files
- `README.md/`: 1 files
- `release/`: 1 files
- `tests/`: 27 files
- `tooling/`: 1 files
- `validation/`: 10 files

The release manifest binds 124 deployable source files and all 17 implementation
units. The final Phase 5 hash manifest is generated after this report and binds the report, release
manifest, package source, and only the evidence referenced by this candidate.

## Validation

- **prerequisites:** PASS - [evidence/local-validation/20260809T161802421Z/prerequisites.log](evidence/local-validation/20260809T161802421Z/prerequisites.log)
- **iac-validation:** PASS - [evidence/local-validation/20260809T161802421Z/iac-validation.log](evidence/local-validation/20260809T161802421Z/iac-validation.log)
- **module-digest-evidence:** PASS - [evidence/local-validation/20260809T161802421Z/module-digest-evidence.log](evidence/local-validation/20260809T161802421Z/module-digest-evidence.log)
- **package-integrity:** PASS - [evidence/local-validation/20260809T161802421Z/package-integrity.log](evidence/local-validation/20260809T161802421Z/package-integrity.log)
- **source-security-scan:** PASS - [evidence/local-validation/20260809T161802421Z/source-security-scan.log](evidence/local-validation/20260809T161802421Z/source-security-scan.log)
- **database-validation:** PASS - [evidence/local-validation/20260809T161802421Z/database-validation.log](evidence/local-validation/20260809T161802421Z/database-validation.log)
- **application-dependencies:** PASS - [evidence/local-validation/20260809T161802421Z/application-dependencies.log](evidence/local-validation/20260809T161802421Z/application-dependencies.log)
- **application-validation:** PASS - [evidence/local-validation/20260809T161802421Z/application-validation.log](evidence/local-validation/20260809T161802421Z/application-validation.log)
- **container-validation:** PASS - [evidence/local-validation/20260809T161802421Z/container-validation.log](evidence/local-validation/20260809T161802421Z/container-validation.log)
- **release-evidence:** PASS - [evidence/local-validation/20260809T161802421Z/release-evidence.log](evidence/local-validation/20260809T161802421Z/release-evidence.log)

Validation index: [evidence/local-validation/20260809T161802421Z/index.json](evidence/local-validation/20260809T161802421Z/index.json)

The retained full validation run's **release-evidence** step covers release-manifest generation only.
Build-report generation, canonical hash generation and **Test-ReleaseEvidence.ps1** are the subsequent
freeze sequence and are not claimed as commands inside that validation run.

## Security and supply chain

- **api:** `sha256:9978f6f2f34ffbeb17f9810cb95143a470ba1c14c5b300c93b5d5b878bd5cc93` on `linux/amd64`; HIGH 0, CRITICAL 0, secrets 0; [SBOM](evidence/containers/20260809T161802421Z/api.sbom.cdx.json), [scan](evidence/containers/20260809T161802421Z/api.trivy.json)
- **worker:** `sha256:867331f0e13ad70855465b1ddf570c8816758399b66a73efc47514fdee21a03d` on `linux/amd64`; HIGH 0, CRITICAL 0, secrets 0; [SBOM](evidence/containers/20260809T161802421Z/worker.sbom.cdx.json), [scan](evidence/containers/20260809T161802421Z/worker.trivy.json)

- Source scan: **PASS**; HIGH vulnerabilities 0, CRITICAL vulnerabilities 0, HIGH misconfigurations 0, CRITICAL misconfigurations 0, secrets 0. [Summary](evidence/source-security/20260809T161802421Z/summary.json)
- Container digest statement: [evidence/containers/20260809T161802421Z/container-digests.json](evidence/containers/20260809T161802421Z/container-digests.json)
- Signing boundary: Local integrity evidence only; an approved release identity must sign any deployable registry artifact.
- Transparency-log upload: **False**

## Traceability and release integrity

- Approved Phase 4 manifest: `5ab254e33ee9460c56026809071a3315b5fce7de887e99c65bf6d100a0140c0b`
- Phase 4 approval: `STRATTON-PHASE-4-CC-002-APPROVAL-001`
- Phase 5 model-plan revision: `111`
- Phase 5 model plan: `0-coordination/stratton-model-plan-revision-111.json` / `64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7`
- Authority change control: `STRATTON-CC-001` / `APPROVED_FOR_PHASE5_AUTHORITY_INTERFACE_FINALISATION`
- Authority approval: `approvals/change-control/stratton-cc-001-approval-1.json` / `ec2ddad8bc9c38993d5266985db5c9e9f12358034ba3aad9c61cd93465d8b21d`
- Authority model plan: `0-coordination/stratton-model-plan-revision-11.json` / `b9fe50b7de6ba21e452d09fde4c827d03d763163dfb60c8bad9d9bd273fa900a`
- Model-portfolio change control: `STRATTON-CC-002` / `CANDIDATE_AWAITING_AFF_A_AFF_B_AND_HUMAN_APPROVAL`
- CC-002 approval: `approvals/change-control/stratton-cc-002-approval-2.json` / `fa8f8ccea8d044cc253fceb54adb74727cf9852fbf73325e45633bc362d04117`
- Phase 3 CC-002 approval: `approvals/3/stratton-phase-3-cc-002-approval-2.json` / `c0d51c1e2478371c452f068361ca857b2afeb49f295dd2fd5880c58e895a96a5`
- Phase 4 CC-002 approval and subject: `71d6b0c306ddff4f58b5b29868ac2ec895d554609e6243a4d95b8e910b14b373` / `5ab254e33ee9460c56026809071a3315b5fce7de887e99c65bf6d100a0140c0b`
- Superseded approved r4 manifest and approval: `bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626` / `f39fbd68d4574f77e7d31d5fb7608739a1e472fa808fc91b14969009a27b1cd4`
- Candidate root and canonical manifest: `5-coding-r7` / `5-coding-r7/stratton-phase-5-hashes.json`
- AFF-5 implementation author/model receipt: `gpt-5.6-sol`
- Source commit: `44fc80fe9b5c79cbdd39ff3c316d53c1a80685bf`
- Commit scope: `FRAMEWORK_REPOSITORY_ANCHOR_ONLY_CASE_PACKAGE_HASHED_SEPARATELY`
- Case package tracked by Git: **False**
- Case package dirty or locally generated: **True**

- `!! ../`

## Authority gates

- `Assurance verdict issuance is not deployable in DU-12`
- `Analysis execution interface remains authority-blocked`
- `Audit evidence export interface remains authority-blocked`

## Residual owner controls

- `VAL-001`
- `VAL-002`
- `VAL-003`
- `VAL-004`
- `VAL-005`
- `AFFB-RES-001`
- `AFFB-RES-002`
- `CC1-OWN-001`
- `CC1-OWN-002`
- `CC1-OWN-003`
- `CC1-OWN-004`
- `CC1-OWN-005`
- `CC1-OWN-006`
- `CC1-OWN-007`

## Current owner-bound gaps

- Exact Azure region pair, resources and deployment IDs remain REQUIRED_OWNER_INPUT.
- Regional model capability and quota evidence, positive capacities and live policy-alias verification remain REQUIRED_OWNER_INPUT.
- Embedding version, dimensions, chunking parameters and index-rebuild evidence remain REQUIRED_OWNER_INPUT.
- Recovery, failover and security-gate operating evidence remains absent and owner-bound.
- Provider terms, licences, source permissions and time-sensitive official-source evidence remain owner-bound.
- Retention, legal hold, privacy lifecycle and deletion evidence remains owner-bound and fail closed.
- GDPR detail, EU AI Act role/use-case classification and DORA applicability require accountable-human confirmation.
- Observed benchmark latency, representative-case, pack-time, token and cost evidence remains absent.
- Production inference and benchmark promotion require later explicit authority and remain blocked.

## Retained AFF-B minor gaps

- `AFFB-CC001-R2-MIN-001`
- `AFFB-CC001-R3-MIN-002`

## Limitations

- No Azure login, target validation, what-if, deployment, or cloud runtime test was executed.
- No Azure subscription/provider/alias query, Azure network call, model inference, promotion or
  retention finalisation was executed.
- Callers cannot select a deployment or model. Routing is deterministic and application-owned.
- Data Zone Standard is required; Global Standard is rejected; GPT-5.6 version `2026-07-09` and
  `NoAutoUpgrade` are pinned.
- Production inference is blocked. Benchmark observations are null and promotion is blocked.
- No autonomous decision authority is granted.
- Local Cosign evidence uses an ephemeral non-production key; an authorised release identity must sign any registry artifact.
- Production tenant, subscription, region, network, identity, retention, model, quota, source, legal, and regulatory values remain fail-closed owner inputs.
- All fourteen owner-bound residual controls and both retained AFF-B minor gaps remain open and unwaived.