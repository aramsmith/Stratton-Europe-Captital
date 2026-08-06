# Stratton Phase 5 build report

Generated: 2026-08-03T00:52:22.3044434Z

## Outcome

- Candidate status: **READY_FOR_ASSURANCE**
- Deployment ready: **False**
- Full local validation: **PASS** (run 20260803T003434092Z)
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

- **prerequisites:** PASS - [evidence/local-validation/20260803T003434092Z/prerequisites.log](evidence/local-validation/20260803T003434092Z/prerequisites.log)
- **iac-validation:** PASS - [evidence/local-validation/20260803T003434092Z/iac-validation.log](evidence/local-validation/20260803T003434092Z/iac-validation.log)
- **module-digest-evidence:** PASS - [evidence/local-validation/20260803T003434092Z/module-digest-evidence.log](evidence/local-validation/20260803T003434092Z/module-digest-evidence.log)
- **package-integrity:** PASS - [evidence/local-validation/20260803T003434092Z/package-integrity.log](evidence/local-validation/20260803T003434092Z/package-integrity.log)
- **source-security-scan:** PASS - [evidence/local-validation/20260803T003434092Z/source-security-scan.log](evidence/local-validation/20260803T003434092Z/source-security-scan.log)
- **database-validation:** PASS - [evidence/local-validation/20260803T003434092Z/database-validation.log](evidence/local-validation/20260803T003434092Z/database-validation.log)
- **application-dependencies:** PASS - [evidence/local-validation/20260803T003434092Z/application-dependencies.log](evidence/local-validation/20260803T003434092Z/application-dependencies.log)
- **application-validation:** PASS - [evidence/local-validation/20260803T003434092Z/application-validation.log](evidence/local-validation/20260803T003434092Z/application-validation.log)
- **container-validation:** PASS - [evidence/local-validation/20260803T003434092Z/container-validation.log](evidence/local-validation/20260803T003434092Z/container-validation.log)
- **release-evidence:** PASS - [evidence/local-validation/20260803T003434092Z/release-evidence.log](evidence/local-validation/20260803T003434092Z/release-evidence.log)

Validation index: [evidence/local-validation/20260803T003434092Z/index.json](evidence/local-validation/20260803T003434092Z/index.json)

The retained full validation run's **release-evidence** step covers release-manifest generation only.
Build-report generation, canonical hash generation and **Test-ReleaseEvidence.ps1** are the subsequent
freeze sequence and are not claimed as commands inside that validation run.

## Security and supply chain

- **api:** `sha256:04e9cec850a169b1f38f8cc202523ae1404599fd0a1112c7abece91a9b8505fd` on `linux/amd64`; HIGH 0, CRITICAL 0, secrets 0; [SBOM](evidence/containers/20260803T005005457Z/api.sbom.cdx.json), [scan](evidence/containers/20260803T005005457Z/api.trivy.json)
- **worker:** `sha256:53a65aa058888a30c23db294bbef59e3cdc847cc15768ad0956750d43dce79a7` on `linux/amd64`; HIGH 0, CRITICAL 0, secrets 0; [SBOM](evidence/containers/20260803T005005457Z/worker.sbom.cdx.json), [scan](evidence/containers/20260803T005005457Z/worker.trivy.json)

- Source scan: **PASS**; HIGH vulnerabilities 0, CRITICAL vulnerabilities 0, HIGH misconfigurations 0, CRITICAL misconfigurations 0, secrets 0. [Summary](evidence/source-security/20260803T004940668Z/summary.json)
- Container digest statement: [evidence/containers/20260803T005005457Z/container-digests.json](evidence/containers/20260803T005005457Z/container-digests.json)
- Signing boundary: Local integrity evidence only; an approved release identity must sign any deployable registry artifact.
- Transparency-log upload: **False**

## Traceability and release integrity

- Approved Phase 4 manifest: `87ff470043fce913e6dd3e2121430072552443ae5cacaaa1454cb8396a9265c4`
- Phase 4 approval: `STRATTON-PHASE-4-APPROVAL-001`
- Phase 5 model-plan revision: `13`
- Phase 5 model plan: `0-coordination/stratton-model-plan-revision-13.json` / `9c18ca9fadea478470a2f23e7bd50a68b276b55f3fe9accdc299b82c7ad0284a`
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