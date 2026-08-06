# Stratton AFF-A review — Phase 5 — Coding round 2

**Verdict:** DIVERGES  
**Review time:** 2026-08-03T02:53:39.833+02:00  
**Reviewer runtime:** gpt-5.5; author runtimes gpt-5.3-codex, gpt-5.6-sol  
**Independence:** VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS  
**Invoked by:** AFF-5  
**Subject modification performed:** false  
**Final round for manifest:** false

## Summary
Revision 2 is integrity-valid and all four AFF-A round-1 findings are resolved. The review still diverges because queued analysis can call the analysis provider without rechecking current source/licence authority at worker execution time.

## Independent verification
- Manifest: cases/Stratton-Europe-Captital/5-coding-r2/stratton-phase-5-hashes.json
- Manifest SHA-256: 3effddfdc036578bc0ade0135002daedfdad0322fe6165279da2f43bbc0d74ef (MATCH).
- Post-review manifest SHA-256: 3effddfdc036578bc0ade0135002daedfdad0322fe6165279da2f43bbc0d74ef (UNCHANGED).
- File count: 154; file hashes: ALL_MANIFEST_ENTRIES_RECOMPUTED_AND_MATCHED.
- Path ordering: ORDINAL_SORTED; artifact roles: PRESENT_FOR_ALL_ENTRIES.
- Encoding: no UTF-8 BOM in listed files; canonical manifest has no trailing line break.
- Model plan: revision 13 / 9c18ca9fadea478470a2f23e7bd50a68b276b55f3fe9accdc299b82c7ad0284a.
- Prior round-1 subject: cases/Stratton-Europe-Captital/5-coding/stratton-phase-5-hashes.json / 412e573e287bb1056217f6a29475df596d280543fcbeae875ce020e73dc13e9b, with 153/153 file hashes unchanged.
- Reviewed-subject snapshot: reviews/aff-a/5/round-2/reviewed-subject/stratton-phase-5-hashes.json / 3effddfdc036578bc0ade0135002daedfdad0322fe6165279da2f43bbc0d74ef.
- Hash receipt: reviews/aff-a/5/round-2/reviewed-subject/stratton-phase-5-hash-verification-receipt.json / efeffcd783595bfafe81520cab4d83c818218698ffd2bd18c4aec9a730328abf.
- Model receipt: reviews/aff-a/5/round-2/stratton-aff-a-model-receipt.json / 977177cd58d381b08eec630106f09a105ae5e541179487cff9b4b3de5c85cf82.

## Round-1 finding dispositions
| ID | Severity | Disposition | Evidence |
|---|---|---|---|
| AFFA-P5-R1-MAJ-001 | MAJOR | RESOLVED | 5-coding-r2/infra/modules/ingress/main.bicep:3-6 allows Registered only. 5-coding-r2/infra/modules/ingress/main.bicep:158 sets featureGatePassed for Registered with evidence id and hash. 5-coding-r2/tests/iac/Invoke-DeploymentPreflight.ps1:512-515 requires Registered for every DU-15 ingress subscription. 5-coding-r2/tests/iac/Remediation.Tests.ps1:188-206 covers deployable positive and fail-closed absent/unregistered/malformed cases. |
| AFFA-P5-R1-MAJ-002 | MAJOR | RESOLVED | 5-coding-r2/deploy/README.md:17-20 now limits sentinel replacement to global prerequisites and selected DU. 5-coding-r2/tests/iac/Invoke-DeploymentPreflight.ps1:249-321 builds a selected-stage sentinel scope. 5-coding-r2/tests/iac/Remediation.Tests.ps1:197-223 admits non-selected/later-stage sentinels and rejects them when selected. |
| AFFA-P5-R1-MIN-001 | MINOR | RESOLVED | 5-coding-r2/tooling/tool-versions.json:4 records FROZEN_FOR_ASSURANCE. 5-coding-r2/tests/package/Test-PackageIntegrity.ps1:14-17 enforces FROZEN_FOR_ASSURANCE. |
| AFFA-P5-R1-MIN-002 | MINOR | RESOLVED | 5-coding-r2/README.md:49-70 separates release-manifest-only validation from freeze sequence. 5-coding-r2/stratton-build-report.md:47-49 states final hash/Test-ReleaseEvidence are subsequent freeze steps. 5-coding-r2/validation/Test-ReleaseEvidence.ps1:101-115 verifies the freeze boundary. |

## Findings
| ID | Severity | Status | Owner | Required action |
|---|---|---|---|---|
| AFFA-P5-R2-MAJ-001 | MAJOR | OPEN | AFF-5 | Recheck current source status, latest licence presence, expiry and aiAnalysisAllowed inside WorkerRuntime.handleAnalysis before calling the provider; update the analysis run to a blocked state and audit the denial without invoking the provider, and add worker-level regression coverage for expired/revoked queued analysis authority. |

### AFFA-P5-R2-MAJ-001 — Queued analysis worker can call the analysis provider without rechecking current source and licence authority.
If a source licence expires or is revoked after REQUEST_ANALYSIS is queued but before q-analysis processing, the worker may still send admitted evidence to the analysis provider and only later evaluate draft-storage policy. That weakens the fail-closed source-authority boundary for asynchronous execution.

Evidence:
- 5-coding-r2/app/src/api-runtime.ts:505 builds policy evidence with licenceActive = licence exists and is not expired.
- 5-coding-r2/app/src/api-runtime.ts:1156-1159 rejects requestAnalysis when source is inactive, licence missing, or licence expired, and suspends the source on expiry.
- 5-coding-r2/app/src/worker-runtime.ts:344-361 reads source and latest licence for REQUEST_ANALYSIS but does not check source status, licence presence, licence expiry, or aiAnalysisAllowed before proceeding.
- 5-coding-r2/app/src/worker-runtime.ts:411-416 calls analysisProvider.runDraftOnlyAnalysis after only the evidence-admission check.
- 5-coding-r2/app/src/worker-runtime.ts:497-504 constructs later STORE_ANALYSIS_DRAFT policy evidence from source status and licence booleans, but not licence expiry, and occurs after provider execution.
- 5-coding-r2/tests/app/integration/api-runtime.test.ts:514-548 covers expired licence denial at the API boundary; no worker regression covers an expired or revoked licence between queueing and worker execution.

## Review area results
| Area | Status | Evidence |
|---|---|---|
| Canonical integrity | CONFORMS | Revision-2 manifest SHA-256 matched expected; 154/154 file hashes matched; ordinal path ordering, artifact roles, revision-13 binding, UTF-8/no-BOM and no trailing newline on the canonical manifest verified; pre/post manifest hash unchanged. |
| Prior subject immutability | CONFORMS | Round-1 manifest SHA-256 remained 412e573e287bb1056217f6a29475df596d280543fcbeae875ce020e73dc13e9b and all 153 listed file hashes still matched. |
| Model independence | CONFORMS | AFF-A actual runtime gpt-5.5 differs from Phase author actual runtime models gpt-5.3-codex and gpt-5.6-sol. |
| Upstream binding | CONFORMS | Release manifest binds approved Phase 4, Phase 4 approval, STRATTON-CC-001 approval and model-plan revision 13. |
| Round-1 finding remediation | CONFORMS | All four AFF-A round-1 findings are resolved. |
| IaC and deployment procedure | CONFORMS | DU-15 Registered evidence and selected-stage preflight semantics are aligned. |
| Application runtime, state, queue and idempotency logic | DIVERGES | AFFA-P5-R2-MAJ-001 identifies a material asynchronous analysis authority gap. |
| Validation and release evidence | CONFORMS-WITH-GAPS | Retained full local validation reports PASS; release-evidence is release-manifest-only and final freeze sequence is separated. AFF-B licence review and residual owner controls remain pending. |
| Markdown/HTML consistency | CONFORMS | Build-report Markdown and HTML carry materially equivalent outcome, validation, release-boundary, security, traceability, residual-control and limitation statements. |
| Phase boundary | CONFORMS | The subject records no Azure authentication, target validation, what-if, deployment or cloud runtime testing, and AFF-A executed none. |

## Residual gaps
VAL-001, VAL-002, VAL-003, VAL-004, VAL-005, AFFB-RES-001, AFFB-RES-002, AFFB-CC001-R2-MIN-001, AFFB-CC001-R3-MIN-002 remain open and unwaived.

## Required action
AFF-5 must preserve the reviewed revision-2 subject byte-identically, remediate AFFA-P5-R2-MAJ-001 in a new revisioned candidate, regenerate affected artifacts and hashes, and invoke a new AFF-A round before AFF-B or human gate progression. This review does not approve Phase 5, waive any gap, authorise Azure activity or open the human gate.
