# Stratton Phase 5 build report

Generated: 2026-08-03T01:35:34.5563675Z

## Outcome

- Candidate status: **READY_FOR_ASSURANCE**
- Deployment ready: **False**
- Full local validation: **PASS** (run 20260803T011756396Z)
- Azure authenticated, validated, what-if, or deployed: **No**
- Release manifest: [stratton-release-manifest.json](stratton-release-manifest.json)

The package is implementation and assurance evidence only. It does not authorise Azure access,
what-if, deployment, production signing, runtime testing, compliance certification, or owner-value
substitution.

## Inventory

- `app/`: 41 files
- `deploy/`: 1 files
- `infra/`: 39 files
- `README.md/`: 1 files
- `release/`: 1 files
- `tests/`: 23 files
- `tooling/`: 1 files
- `validation/`: 8 files

The release manifest binds 115 deployable source files and all 17 implementation
units. The final Phase 5 hash manifest is generated after this report and binds the report, release
manifest, package source, and only the evidence referenced by this candidate.

## Validation

- **prerequisites:** PASS - [evidence/local-validation/20260803T011756396Z/prerequisites.log](evidence/local-validation/20260803T011756396Z/prerequisites.log)
- **iac-validation:** PASS - [evidence/local-validation/20260803T011756396Z/iac-validation.log](evidence/local-validation/20260803T011756396Z/iac-validation.log)
- **module-digest-evidence:** PASS - [evidence/local-validation/20260803T011756396Z/module-digest-evidence.log](evidence/local-validation/20260803T011756396Z/module-digest-evidence.log)
- **package-integrity:** PASS - [evidence/local-validation/20260803T011756396Z/package-integrity.log](evidence/local-validation/20260803T011756396Z/package-integrity.log)
- **source-security-scan:** PASS - [evidence/local-validation/20260803T011756396Z/source-security-scan.log](evidence/local-validation/20260803T011756396Z/source-security-scan.log)
- **database-validation:** PASS - [evidence/local-validation/20260803T011756396Z/database-validation.log](evidence/local-validation/20260803T011756396Z/database-validation.log)
- **application-dependencies:** PASS - [evidence/local-validation/20260803T011756396Z/application-dependencies.log](evidence/local-validation/20260803T011756396Z/application-dependencies.log)
- **application-validation:** PASS - [evidence/local-validation/20260803T011756396Z/application-validation.log](evidence/local-validation/20260803T011756396Z/application-validation.log)
- **container-validation:** PASS - [evidence/local-validation/20260803T011756396Z/container-validation.log](evidence/local-validation/20260803T011756396Z/container-validation.log)
- **release-evidence:** PASS - [evidence/local-validation/20260803T011756396Z/release-evidence.log](evidence/local-validation/20260803T011756396Z/release-evidence.log)

Validation index: [evidence/local-validation/20260803T011756396Z/index.json](evidence/local-validation/20260803T011756396Z/index.json)

The retained full validation run's **release-evidence** step covers release-manifest generation only.
Build-report generation, canonical hash generation and **Test-ReleaseEvidence.ps1** are the subsequent
freeze sequence and are not claimed as commands inside that validation run.

## Security and supply chain

- **api:** `sha256:3d1bc500907cb6ad3c8384f775dd7dffcb7d1f53b6f6675b704ead6ccd936c55` on `linux/amd64`; HIGH 0, CRITICAL 0, secrets 0; [SBOM](evidence/containers/20260803T013247008Z/api.sbom.cdx.json), [scan](evidence/containers/20260803T013247008Z/api.trivy.json)
- **worker:** `sha256:f23a660f3e578577924fa3799a12351ecf30d5d61485a40db13702d3349b0512` on `linux/amd64`; HIGH 0, CRITICAL 0, secrets 0; [SBOM](evidence/containers/20260803T013247008Z/worker.sbom.cdx.json), [scan](evidence/containers/20260803T013247008Z/worker.trivy.json)

- Source scan: **PASS**; HIGH vulnerabilities 0, CRITICAL vulnerabilities 0, HIGH misconfigurations 0, CRITICAL misconfigurations 0, secrets 0. [Summary](evidence/source-security/20260803T013222504Z/summary.json)
- Container digest statement: [evidence/containers/20260803T013247008Z/container-digests.json](evidence/containers/20260803T013247008Z/container-digests.json)
- Signing boundary: Local integrity evidence only; an approved release identity must sign any deployable registry artifact.
- Transparency-log upload: **False**

## Traceability and release integrity

- Approved Phase 4 manifest: `87ff470043fce913e6dd3e2121430072552443ae5cacaaa1454cb8396a9265c4`
- Phase 4 approval: `STRATTON-PHASE-4-APPROVAL-001`
- Phase 5 model-plan revision: `14`
- Phase 5 model plan: `0-coordination/stratton-model-plan-revision-14.json` / `a4af30ebc44cb985c1881d2508eb2bdb8680e480c0262682fe34de2ebb40638b`
- Authority change control: `STRATTON-CC-001` / `APPROVED_FOR_PHASE5_AUTHORITY_INTERFACE_FINALISATION`
- Authority approval: `approvals/change-control/stratton-cc-001-approval-1.json` / `ec2ddad8bc9c38993d5266985db5c9e9f12358034ba3aad9c61cd93465d8b21d`
- Authority model plan: `0-coordination/stratton-model-plan-revision-11.json` / `b9fe50b7de6ba21e452d09fde4c827d03d763163dfb60c8bad9d9bd273fa900a`
- Source commit: `8d4f42b19226729bd1e3fb68e5a353b554b4b3a1`
- Commit scope: `FRAMEWORK_REPOSITORY_ANCHOR_ONLY_CASE_PACKAGE_HASHED_SEPARATELY`
- Case package tracked by Git: **False**
- Case package dirty or locally generated: **True**

- `!! ../`

## Authority gates

- None recorded.

## Residual owner controls

- `VAL-001`
- `VAL-002`
- `VAL-003`
- `VAL-004`
- `VAL-005`
- `AFFB-RES-001`
- `AFFB-RES-002`
- `AFFB-CC001-R2-MIN-001`
- `AFFB-CC001-R3-MIN-002`

## Limitations

- No Azure login, target validation, what-if, deployment, or cloud runtime test was executed.
- Local Cosign evidence uses an ephemeral non-production key; an authorised release identity must sign any registry artifact.
- Production tenant, subscription, region, network, identity, retention, model, quota, source, legal, and regulatory values remain fail-closed owner inputs.
- The seven approved residual controls remain open unless separate accountable-owner evidence resolves them.