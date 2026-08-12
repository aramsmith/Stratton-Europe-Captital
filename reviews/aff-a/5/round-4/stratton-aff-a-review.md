# Stratton AFF-A review — Phase 5 — Coding round 4

**Verdict:** CONFORMS-WITH-GAPS  
**Review time:** 2026-08-03T05:36:55.633+02:00  
**Reviewer runtime:** gpt-5.5; author runtimes gpt-5.3-codex, gpt-5.6-sol  
**Independence:** VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS  
**Invoked by:** AFF-5  
**Subject modification performed:** false  
**Final round for manifest:** true

## Summary
The revision-4 subject is integrity-valid, preserves revisions 1, 2 and 3 byte-identically, is bound to model-plan revision 15, and materially resolves the six AFF-B round-1 major remediation areas from an AFF-A correctness perspective. Bounded authority conflicts, owner-bound residual controls, retained AFF-B minor gaps, and independent AFF-B round-2 security/compliance assurance remain outstanding.

## Independent verification
- Manifest: cases/Stratton-Europe-Captital/5-coding-r4/stratton-phase-5-hashes.json
- Manifest SHA-256: bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626 (MATCH).
- Post-review manifest SHA-256: bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626 (UNCHANGED).
- File count: 155; file hashes: 155/155 listed entries recomputed and matched.
- Path ordering: ORDINAL_SORTED=true; artifact roles: PRESENT_FOR_ALL_ENTRIES=true.
- Encoding: no UTF-8 BOM in listed files; canonical manifest has no trailing line break.
- Model plan: revision 15 / 7ce3ff77d47384ceaf3e0515b3350578831b5a2fedfcbeba4e586399dc9f6fb4.
- Release manifest: cases/Stratton-Europe-Captital/5-coding-r4/stratton-release-manifest.json / 43625f2f2f65fd3d2bcdd6573ff1f506110c678413d98425ebb084be588ede41.
- Prior subjects: revision 1 remains 412e573e287bb1056217f6a29475df596d280543fcbeae875ce020e73dc13e9b with 153/153 entries matched; revision 2 remains 3effddfdc036578bc0ade0135002daedfdad0322fe6165279da2f43bbc0d74ef with 154/154 entries matched; revision 3 remains cf4ce5b9d6d003e796ff1e5a89c86007932e63641ec92f3a3a2cad8b787a7886 with 154/154 entries matched.
- Reviewed-subject snapshot: reviews/aff-a/5/round-4/reviewed-subject/stratton-phase-5-hashes.json / bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626.
- Hash receipt: reviews/aff-a/5/round-4/reviewed-subject/stratton-phase-5-hash-verification-receipt.json / 77fc0e0bc1b62a010de14476bf725124de7f6d3f40f734254d9d672ab0783087.
- Model receipt: reviews/aff-a/5/round-4/stratton-aff-a-model-receipt.json / c2e014a68a2304ae83eaeb257ba16e63da0cb567e4a268099c301473fb5e0a64.
- Boundary: no package code, tests, Bicep, npm, containers, Azure commands, deployments, what-if, validation or runtime tests were run.

## Prior finding dispositions
| ID | Severity | Disposition | Evidence |
| --- | --- | --- | --- |
| AFFA-P5-R1-MAJ-001 | MAJOR | RESOLVED_AND_RETAINED | 5-coding-r4/infra/modules/ingress/main.bicep retains Registered feature evidence alignment. 5-coding-r4/tests/iac/Remediation.Tests.ps1 retains positive and fail-closed DU-15 coverage. |
| AFFA-P5-R1-MAJ-002 | MAJOR | RESOLVED_AND_RETAINED | 5-coding-r4/tests/iac/Invoke-DeploymentPreflight.ps1 retains selected-stage and selected-environment sentinel scoping. 5-coding-r4/tests/iac/Remediation.Tests.ps1 retains selected and non-selected environment regression coverage. |
| AFFA-P5-R1-MIN-001 | MINOR | RESOLVED_AND_RETAINED | 5-coding-r4/tooling/tool-versions.json retains FROZEN_FOR_ASSURANCE. 5-coding-r4/tests/package/Test-PackageIntegrity.ps1 retains enforcement. |
| AFFA-P5-R1-MIN-002 | MINOR | RESOLVED_AND_RETAINED | 5-coding-r4/README.md and stratton-build-report.md retain the release-manifest-only validation boundary. 5-coding-r4/validation/Test-ReleaseEvidence.ps1 verifies the external freeze sequence. |
| AFFA-P5-R2-MAJ-001 | MAJOR | RESOLVED_AND_RETAINED | 5-coding-r4/app/src/worker-runtime.ts retains current source and licence authority recheck before provider execution. 5-coding-r4/tests/app/unit/worker-runtime-transactions.test.ts retains fail-closed coverage for suspended source, missing licence, expired licence and AI-analysis denial. |
| AFFB-P5-R1-MAJ-001 | MAJOR | RESOLVED_FOR_AFF_A_CORRECTNESS_REVIEW | 5-coding-r4/infra/modules/assurance/main.bicep scopes evidenceReaderCopierWriteAssignment to evidenceContainer. 5-coding-r4/infra/parameters/prd.bicepparam uses evidenceReaderCopierAuthority 'Internal Audit' and removes deliveryPrincipalId. 5-coding-r4/tests/iac/Invoke-DeploymentPreflight.ps1 rejects deliveryPrincipalId and enforces Internal Audit-controlled evidence reader-copier authority. |
| AFFB-P5-R1-MAJ-002 | MAJOR | RESOLVED_FOR_AFF_A_CORRECTNESS_REVIEW | 5-coding-r4/infra/parameters/prd.bicepparam sets retentionFinalization.state to BLOCKED_PENDING_SEPARATELY_AUTHORISED_LOCK_AND_LEGAL_HOLD_EVIDENCE and dataAdmissionEnabled false. 5-coding-r4/deploy/Invoke-AssuranceRetentionFinalization.ps1 requires -Execute plus a separately approved Phase 7 human-authorisation record and verifies observed Locked state and legal hold tags. 5-coding-r4/tests/iac/Invoke-DeploymentPreflight.ps1 ASR-19 keeps data admission blocked unless observed lock/legal-hold evidence is bound. |
| AFFB-P5-R1-MAJ-003 | MAJOR | RESOLVED_FOR_AFF_A_CORRECTNESS_REVIEW | 5-coding-r4/infra/parameters/prd.bicepparam defines workload NSG rules with explicit deny-all inbound and outbound rules. 5-coding-r4/infra/parameters/prd.bicepparam routes workload default egress through primary or recovery regional firewall route entries. 5-coding-r4/infra/modules/network/main.bicep exempts Azure-reserved subnet names while applying NSGs, routes and privateEndpointNetworkPolicies to workload subnets. 5-coding-r4/tests/iac/Invoke-DeploymentPreflight.ps1 rejects empty workload controls, missing deny rules, incorrect firewall routes and disabled private-endpoint policies. |
| AFFB-P5-R1-MAJ-004 | MAJOR | RESOLVED_FOR_AFF_A_CORRECTNESS_REVIEW | 5-coding-r4/infra/modules/integration/main.bicep defines exact serviceBusAccessPaths and scopes role assignments to Microsoft.ServiceBus/namespaces/queues resources. 5-coding-r4/infra/parameters/prd.bicepparam grants only active producer/consumer queue paths for uami-api, uami-ingest, uami-extraction and uami-indexer. 5-coding-r4/infra/modules/application-platform/main.bicep deploys only approved worker queue names and excludes q-analysis and q-audit-export. 5-coding-r4/tests/iac/Invoke-DeploymentPreflight.ps1 validates the exact queue-scoped RBAC contract and inactive authority-blocked workers. |
| AFFB-P5-R1-MAJ-005 | MAJOR | RESOLVED_FOR_AFF_A_CORRECTNESS_REVIEW | 5-coding-r4/infra/modules/application-platform/main.bicep configures Container Apps auth with Return401, HTTPS required, no excluded paths, tenant/client/audience bindings. 5-coding-r4/infra/modules/apim-lockdown/main.bicep strips spoofable x-ms-client-principal and token headers before validate-jwt and preserves the bearer token boundary. 5-coding-r4/tests/iac/Invoke-DeploymentPreflight.ps1 requires APIM and Container Apps Entra tenant, client and audience bindings to match. 5-coding-r4/app/src/api-runtime.ts rejects missing or non-human platform identity claims; retained tests cover issuer spoofing and workload-principal denial. |
| AFFB-P5-R1-MAJ-006 | MAJOR | RESOLVED_FOR_AFF_A_CORRECTNESS_REVIEW | 5-coding-r4/stratton-release-manifest.json discloses exactly three authorityConflicts. 5-coding-r4/stratton-release-manifest.json discloses fourteen unresolvedControls and two retainedMinorGaps. 5-coding-r4/validation/Test-ReleaseEvidence.ps1 requires exact authority-conflict, owner-control and retained-minor-gap disclosure. 5-coding-r4/stratton-build-report.md reflects the same authority gates, residual owner controls and retained AFF-B minor gaps. |

## Findings
No blocker, major or minor AFF-A finding remains open for this manifest.

## Review area results
| Area | Status | Evidence |
| --- | --- | --- |
| Canonical integrity | CONFORMS | Revision-4 manifest SHA-256 matched expected; 155/155 file hashes matched; ordinal ordering, artifact roles, UTF-8/no-BOM and no trailing newline on the canonical manifest were verified; pre/post manifest hash was unchanged. |
| Prior subject immutability | CONFORMS | Revision 1 remains 412e573e287bb1056217f6a29475df596d280543fcbeae875ce020e73dc13e9b with 153/153 entries matched; revision 2 remains 3effddfdc036578bc0ade0135002daedfdad0322fe6165279da2f43bbc0d74ef with 154/154 entries matched; revision 3 remains cf4ce5b9d6d003e796ff1e5a89c86007932e63641ec92f3a3a2cad8b787a7886 with 154/154 entries matched. |
| Model independence | CONFORMS | AFF-A approved, selected and actual runtime model is gpt-5.5, differing from Phase 5 author actual runtime models gpt-5.3-codex and gpt-5.6-sol. |
| Upstream binding | CONFORMS | Revision 4 binds approved Phase 4 manifest 87ff470043fce913e6dd3e2121430072552443ae5cacaaa1454cb8396a9265c4, STRATTON-PHASE-4-APPROVAL-001, STRATTON-CC-001 approval ec2ddad8bc9c38993d5266985db5c9e9f12358034ba3aad9c61cd93465d8b21d, and model-plan revision 15. |
| Assurance evidence write authority | CONFORMS | Delivery write authority is removed; the evidence copier is Internal Audit-controlled and scoped to the evidence container. |
| Immutability lock and legal hold | CONFORMS-WITH-GAPS | Data admission remains blocked until separately authorised observed immutability-lock and legal-hold evidence is bound. The irreversible finalisation procedure is present but not executed in Phase 5. |
| Network fail-closed controls | CONFORMS | Workload NSGs, deny rules, firewall default routes, reserved-subnet handling and private-endpoint policies are explicitly represented and validated by retained evidence. |
| Service Bus queue authority | CONFORMS | Service Bus roles are exact queue-scoped paths for active producers and consumers; analysis and audit-export queues remain authority-blocked for deployment. |
| APIM and Container Apps identity boundary | CONFORMS | APIM and Container Apps use matching owner-bound Entra tenant/client/audience values; APIM strips spoofable platform identity headers and validates bearer tokens; Container Apps revalidates with HTTPS, Return401 and no excluded paths. |
| Release evidence disclosure | CONFORMS-WITH-GAPS | Release evidence discloses exactly three authority conflicts, fourteen owner-bound residual controls and two retained AFF-B minor gaps. These remain open and unwaived. |
| Application runtime, state, idempotency and failure paths | CONFORMS | Retained validation evidence reports application validation PASS, unit/integration coverage for idempotency, authority checks, queue failure paths, API auth semantics and blocked capabilities. |
| Retained validation evidence | CONFORMS | Full local validation run 20260803T031539999Z reports PASS with 10 PASS steps; IaC/Pester evidence reports 55/55 passed; external freeze verification was inspected as retained evidence only. |
| Phase boundary and Azure execution | CONFORMS | The subject records no Azure authentication, target validation, what-if, deployment or cloud runtime testing, and AFF-A executed none. |

## Residual gaps
Assurance verdict issuance is not deployable in DU-12, Analysis execution interface remains authority-blocked, Audit evidence export interface remains authority-blocked, VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, AFFB-RES-001, AFFB-RES-002, CC1-OWN-001, CC1-OWN-002, CC1-OWN-003, CC1-OWN-004, CC1-OWN-005, CC1-OWN-006, CC1-OWN-007, AFFB-CC001-R2-MIN-001, AFFB-CC001-R3-MIN-002 remain open and unwaived. AFF-B round-2 security and compliance assurance remains pending.

## Release disclosure
- Authority conflicts: Assurance verdict issuance is not deployable in DU-12, Analysis execution interface remains authority-blocked, Audit evidence export interface remains authority-blocked.
- Owner-bound residual controls: VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, AFFB-RES-001, AFFB-RES-002, CC1-OWN-001, CC1-OWN-002, CC1-OWN-003, CC1-OWN-004, CC1-OWN-005, CC1-OWN-006, CC1-OWN-007.
- Retained AFF-B minor gaps: AFFB-CC001-R2-MIN-001, AFFB-CC001-R3-MIN-002.

## Upstream and prior hash bindings
| Path | SHA-256 | Result |
| --- | --- | --- |
| 4-implementation-plan/stratton-phase-4-hashes.json | 87ff470043fce913e6dd3e2121430072552443ae5cacaaa1454cb8396a9265c4 | MATCH |
| approvals/4/stratton-phase-4-approval-1.json | 305e897a63291bb592d24ced46cc372e6ab2034d46eaca100d7af8db6490c0b5 | MATCH |
| approvals/change-control/stratton-cc-001-approval-1.json | ec2ddad8bc9c38993d5266985db5c9e9f12358034ba3aad9c61cd93465d8b21d | MATCH |
| 0-coordination/stratton-model-plan-revision-11.json | b9fe50b7de6ba21e452d09fde4c827d03d763163dfb60c8bad9d9bd273fa900a | MATCH |
| 3-azure-design/stratton-phase-3-hashes-cc-001-r2-proposed.json | e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54 | MATCH |
| 4-implementation-plan/stratton-phase-4-hashes-cc-001-r3-proposed.json | 4ecd7bd341d406f4361d8441b8c5d961848fef9506ebbd0dc8034016ee569626 | MATCH |
| reviews/aff-a/3/round-5/stratton-aff-a-review.json | 1be8a11a1cf51e9009be9db1e9dcb2f8e5369181c1c6862b988de9d29f28d539 | MATCH |
| reviews/aff-a/4/round-6/stratton-aff-a-review.json | e2ab8da4dbcaa8cc826ba825432129e60d2756b0e515dabaf30156eaf73627e8 | MATCH |
| reviews/aff-b/3/round-4/stratton-aff-b-review.json | 0adf627a1e43de0553d106eb6c446a47f3b2718cf3adeafa844c7bd5944e5e9c | MATCH |
| reviews/aff-b/4/round-3/stratton-aff-b-review.json | b220e01bbede12f7fff81e3220c15a2271b27b4970c35bd963ee877049e3d7b9 | MATCH |
| reviews/aff-b/coverage/stratton-compliance-coverage-007.json | e769a9326a6bf362a566a42934ef6093d2dca8e37bc955a53474e17f664147d8 | MATCH |
| 0-coordination/stratton-model-plan-revision-15.json | 7ce3ff77d47384ceaf3e0515b3350578831b5a2fedfcbeba4e586399dc9f6fb4 | MATCH |
| reviews/aff-a/5/round-3/stratton-aff-a-review.json | bcb5f8ad241cdd82a3ea290002584e91cd0a394806d6db09083c26cffe7339e8 | MATCH |
| reviews/aff-b/5/round-1/stratton-aff-b-review.json | a46643eef6a9e2e146cd6ad811f012d733e533e499a33c9531c94c8357d27e9e | MATCH |
| 5-coding/stratton-phase-5-hashes.json | 412e573e287bb1056217f6a29475df596d280543fcbeae875ce020e73dc13e9b | MATCH |
| 5-coding/stratton-release-manifest.json | bd970abee4da60a743c83affc8f07fe4d81978a2bbf9b5706e8310bb328d6510 | MATCH |
| 5-coding-r2/stratton-phase-5-hashes.json | 3effddfdc036578bc0ade0135002daedfdad0322fe6165279da2f43bbc0d74ef | MATCH |
| 5-coding-r2/stratton-release-manifest.json | 13e6b259d31e05d2f74148ff645e2a2413953cb5bd827ae754b015207b909859 | MATCH |
| 5-coding-r3/stratton-phase-5-hashes.json | cf4ce5b9d6d003e796ff1e5a89c86007932e63641ec92f3a3a2cad8b787a7886 | MATCH |
| 5-coding-r3/stratton-release-manifest.json | 5f52ec6de83f8c72da68a55ea77c214e1d00d93d8fe7287b8558308b964f96b9 | MATCH |
| 5-coding-r4/stratton-release-manifest.json | 43625f2f2f65fd3d2bcdd6573ff1f506110c678413d98425ebb084be588ede41 | MATCH |

## Required action
AFF-5 may invoke AFF-B round 2 only against this exact unchanged revision-4 manifest bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626. Any material change requires a new sibling candidate and new final AFF-A and AFF-B reviews. The human Phase 5 gate remains locked until AFF-A and AFF-B final verdicts converge on the same unchanged manifest and the human explicitly approves Phase 5.

## Non-approval statement
AFF-A does not approve Phase 5, waive any residual gap, certify compliance, authorise Azure activity, authorise retention finalisation, authorise deployment or runtime testing, or provide human approval.
