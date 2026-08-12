# Stratton AFF-A review — Phase 5 — Coding round 1

**Verdict:** DIVERGES  
**Review time:** 2026-08-03T01:52:02.667+02:00  
**Reviewer runtime:** gpt-5.5; author runtimes gpt-5.3-codex, gpt-5.6-sol  
**Independence:** VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS  
**Invoked by:** AFF-5  
**Subject modification performed:** alse  
**Final round for manifest:** alse

## Summary
The canonical Phase 5 manifest and all 153 listed files verified exactly, and the subject remained unchanged before and after review. The review diverges because two unresolved major findings make the future DU-15 ingress gate and selected-stage deployment procedure internally inconsistent with the approved baseline.

## Independent verification
- Manifest: cases/Stratton-Europe-Captital/5-coding/stratton-phase-5-hashes.json
- Manifest SHA-256: $preHash (MATCH).
- Post-review manifest SHA-256: $postHash (UNCHANGED).
- File count: 153; file hashes: ALL_MANIFEST_ENTRIES_RECOMPUTED_AND_MATCHED.
- Path ordering: ORDINAL_SORTED; artifact roles: PRESENT_FOR_ALL_ENTRIES.
- Model plan: revision 12 / b37f156239461815c70ade2b459dc935434619a3e88c1f94afe74c0e7d897d7.
- Reviewed-subject snapshot: eviews/aff-a/5/round-1/reviewed-subject/stratton-phase-5-hashes.json / $snapshotHash.
- Hash receipt: eviews/aff-a/5/round-1/reviewed-subject/stratton-phase-5-hash-verification-receipt.json / $hashReceiptHash.
- Model receipt: eviews/aff-a/5/round-1/stratton-aff-a-model-receipt.json / $modelHash.

## Findings
| ID | Severity | Status | Owner | Required action |
|---|---|---|---|---|
| AFFA-P5-R1-MAJ-001 | MAJOR | OPEN | AFF-5 | Align DU-15 Application Gateway network-isolation evidence semantics so preflight and the Bicep module accept the same value, then add a selected-DU-15 deployability test. |
| AFFA-P5-R1-MAJ-002 | MAJOR | OPEN | AFF-5 | Make preflight/procedure validate the selected DU plus global prerequisites while keeping later-stage sentinels fail closed, matching the Phase 4 target-stage gate. |
| AFFA-P5-R1-MIN-001 | MINOR | OPEN | AFF-5 | Refresh or explain the 	ooling/tool-versions.json IN_PROGRESS status in the frozen candidate. |
| AFFA-P5-R1-MIN-002 | MINOR | OPEN | AFF-5 | Retain or clarify final self-excluding hash/Test-ReleaseEvidence evidence. |

## Evidence and consequence
### AFFA-P5-R1-MAJ-001
infra/modules/ingress/main.bicep constrains eatureRegistrationEvidenceState to APPROVED and only passes the gate for APPROVED, while 	ests/iac/Invoke-DeploymentPreflight.ps1 requires the same evidence map to equal Registered; the fixture also uses Registered. A DU-15 run cannot reliably satisfy both retained gates.

### AFFA-P5-R1-MAJ-002
The approved Phase 4 plan allows only values needed for the target stage to proceed, with later unknowns remaining blockers. The Phase 5 deployment README and preflight scan require every sentinel in the full parameter object to be replaced before any run, changing the approved incremental deployment model.

### AFFA-P5-R1-MIN-001
	ooling/tool-versions.json records status: IN_PROGRESS while the candidate is frozen for assurance and the build report reports full local validation PASS.

### AFFA-P5-R1-MIN-002
The package README describes New-Phase5Hashes.ps1 and Test-ReleaseEvidence.ps1 after final report generation, but the retained elease-evidence step records only New-ReleaseManifest.ps1 / "Release manifest written".

## Review area results
| Area | Status | Evidence |
|---|---|---|
| Canonical integrity | CONFORMS | Manifest and 153 file hashes matched; pre/post manifest hash unchanged. |
| Model independence | CONFORMS | AFF-A gpt-5.5 differs from gpt-5.3-codex and gpt-5.6-sol. |
| Upstream binding | CONFORMS | Phase 4 approval, STRATTON-CC-001 approval and model-plan revision 12 are bound. |
| IaC and deployment semantics | DIVERGES | MAJ-001 and MAJ-002 require remediation. |
| Application runtime and queues | CONFORMS-WITH-GAPS | No additional material correctness defect found by static review. |
| Validation/release evidence | CONFORMS-WITH-GAPS | PASS evidence retained, with MIN-001 and MIN-002. |
| Phase boundary | CONFORMS | No Azure authentication, validate, what-if, deployment or runtime cloud test is claimed. |

## Residual gaps
VAL-001 through VAL-005, AFFB-RES-001, AFFB-RES-002, AFFB-CC001-R2-MIN-001 and AFFB-CC001-R3-MIN-002 remain open and unwaived.

## Required action
AFF-5 must preserve this reviewed subject byte-identically, remediate in a revisioned Phase 5 candidate and re-invoke AFF-A. This review does not approve Phase 5, waive any gap, authorise Azure activity or open the human gate.