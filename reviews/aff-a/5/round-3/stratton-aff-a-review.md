# Stratton AFF-A review — Phase 5 — Coding round 3

**Verdict:** CONFORMS-WITH-GAPS  
**Review time:** 2026-08-03T03:41:52.9129705+02:00  
**Reviewer runtime:** gpt-5.5; author runtimes gpt-5.3-codex, gpt-5.6-sol  
**Independence:** VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS  
**Invoked by:** AFF-5  
**Subject modification performed:** false  
**Final round for manifest:** true

## Summary
Revision 3 is integrity-valid, preserves both earlier reviewed subjects, resolves AFFA-P5-R2-MAJ-001, and presents no new material AFF-A finding. Bounded residual controls and AFF-B specialist assurance remain outstanding.

## Independent verification
- Manifest: cases/Stratton-Europe-Captital/5-coding-r3/stratton-phase-5-hashes.json
- Manifest SHA-256: cf4ce5b9d6d003e796ff1e5a89c86007932e63641ec92f3a3a2cad8b787a7886 (MATCH).
- Post-review manifest SHA-256: cf4ce5b9d6d003e796ff1e5a89c86007932e63641ec92f3a3a2cad8b787a7886 (UNCHANGED).
- File count: 154; file hashes: ALL_MANIFEST_ENTRIES_RECOMPUTED_AND_MATCHED.
- Path ordering: ORDINAL_SORTED; artifact roles: PRESENT_FOR_ALL_ENTRIES.
- Encoding: no UTF-8 BOM in listed files; canonical manifest has no trailing line break.
- Model plan: revision 14 / a4af30ebc44cb985c1881d2508eb2bdb8680e480c0262682fe34de2ebb40638b.
- Prior subjects: revision 1 remains 153/153 unchanged at 412e573e287bb1056217f6a29475df596d280543fcbeae875ce020e73dc13e9b; revision 2 remains 154/154 unchanged at 3effddfdc036578bc0ade0135002daedfdad0322fe6165279da2f43bbc0d74ef.
- Reviewed-subject snapshot: reviews/aff-a/5/round-3/reviewed-subject/stratton-phase-5-hashes.json / cf4ce5b9d6d003e796ff1e5a89c86007932e63641ec92f3a3a2cad8b787a7886.
- Hash receipt: reviews/aff-a/5/round-3/reviewed-subject/stratton-phase-5-hash-verification-receipt.json / b514825898f07af9198b89e21691447bbab09d69db70fc59ea9c4d2cd630b748.
- Model receipt: reviews/aff-a/5/round-3/stratton-aff-a-model-receipt.json / 02606e5d7cfdf4c696bd0dd5b988cc847d61f19f09efe8e6b0901f54fa3fce5e.

## Prior finding dispositions
| ID | Severity | Disposition | Evidence |
|---|---|---|---|
| AFFA-P5-R1-MAJ-001 | MAJOR | RESOLVED_AND_RETAINED | 5-coding-r3/infra/modules/ingress/main.bicep retains Registered feature evidence alignment. 5-coding-r3/tests/iac/Remediation.Tests.ps1 retains positive and fail-closed DU-15 coverage. |
| AFFA-P5-R1-MAJ-002 | MAJOR | RESOLVED_AND_RETAINED | 5-coding-r3/tests/iac/Invoke-DeploymentPreflight.ps1 retains selected-stage and selected-environment sentinel scoping. 5-coding-r3/tests/iac/Remediation.Tests.ps1 retains selected and non-selected environment regression coverage. |
| AFFA-P5-R1-MIN-001 | MINOR | RESOLVED_AND_RETAINED | 5-coding-r3/tooling/tool-versions.json retains FROZEN_FOR_ASSURANCE. 5-coding-r3/tests/package/Test-PackageIntegrity.ps1 retains enforcement. |
| AFFA-P5-R1-MIN-002 | MINOR | RESOLVED_AND_RETAINED | 5-coding-r3/README.md and stratton-build-report.md retain the release-manifest-only validation boundary. 5-coding-r3/validation/Test-ReleaseEvidence.ps1 verifies the external freeze sequence. |
| AFFA-P5-R2-MAJ-001 | MAJOR | RESOLVED | 5-coding-r3/app/src/worker-runtime.ts:68-92 defines stable fail-closed reasons for missing/inactive source, absent/invalid/expired licence and AI-analysis denial. 5-coding-r3/app/src/worker-runtime.ts:426-477 re-reads current source and latest licence, persists BLOCKED_MISSING_EVIDENCE, and appends deterministic redacted denial evidence before provider execution. 5-coding-r3/app/src/worker-runtime.ts:482-489 invokes the provider only after the authority recheck succeeds. 5-coding-r3/tests/app/unit/worker-runtime-transactions.test.ts:536-636 covers source suspension, missing licence, expired licence and AI-analysis denial, zero provider calls, stable blocked state, dead-letter behaviour and audit deduplication. |

## Findings
No blocker, major or minor AFF-A finding remains open for this manifest.

## Review area results
| Area | Status | Evidence |
|---|---|---|
| Canonical integrity | CONFORMS | Revision-3 manifest SHA-256 matched expected; 154/154 file hashes matched; ordinal ordering, artifact roles, revision-14 binding, UTF-8/no-BOM and no trailing newline on the canonical manifest were verified; pre/post manifest hash was unchanged. |
| Prior subject immutability | CONFORMS | Revision 1 remains 412e573e287bb1056217f6a29475df596d280543fcbeae875ce020e73dc13e9b with 153/153 entries matched; revision 2 remains 3effddfdc036578bc0ade0135002daedfdad0322fe6165279da2f43bbc0d74ef with 154/154 entries matched. |
| Model independence | CONFORMS | AFF-A actual runtime gpt-5.5 differs from Phase 5 author actual runtimes gpt-5.3-codex and gpt-5.6-sol. |
| Upstream binding | CONFORMS | The release manifest binds approved Phase 4, STRATTON-CC-001 approval and subjects, active coverage, and model-plan revision 14; all referenced hashes recomputed. |
| Prior remediation chain | CONFORMS | All four round-1 findings remain resolved, and AFFA-P5-R2-MAJ-001 is resolved in revision 3. |
| IaC and deployment procedure | CONFORMS | The complete retained package preserves DU-15 Registered evidence, selected-stage/environment preflight semantics, one-codebase parameterisation and the no-deployment Phase 5 boundary. |
| Application runtime, state, queue and idempotency logic | CONFORMS | Queued analysis now performs a current authority check before provider execution, persists deterministic blocked state, avoids provider calls after denial, and retains non-retryable dead-letter and audit deduplication behaviour. |
| Validation and release evidence | CONFORMS-WITH-GAPS | Retained full local validation run 20260803T011756396Z reports PASS and the external freeze sequence recomputes. AFF-B specialist review and owner-bound residual controls remain pending. |
| Markdown/HTML consistency | CONFORMS | The build-report Markdown and HTML carry materially equivalent outcomes, validation, security, traceability, residual controls and limitations. |
| Phase boundary | CONFORMS | The subject records no Azure authentication, target validation, what-if, deployment or cloud runtime testing, and AFF-A executed none. |

## Residual gaps
VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, AFFB-RES-001, AFFB-RES-002, AFFB-CC001-R2-MIN-001, AFFB-CC001-R3-MIN-002 remain open and unwaived. AFF-B security and compliance assurance remains pending.

## Required action
AFF-5 may invoke AFF-B against this exact unchanged revision-3 manifest. Any material AFF-B remediation requires a new sibling candidate and new final AFF-A and AFF-B reviews. The human Phase 5 gate remains locked. This review does not approve Phase 5, waive any gap, certify compliance or authorise Azure activity.
