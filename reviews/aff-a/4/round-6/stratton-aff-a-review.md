# Stratton AFF-A review — Phase 4 — Implementation Plan round 6

**Change control:** `STRATTON-CC-001`  
**Verdict:** `CONFORMS-WITH-GAPS`  
**Review time:** `2026-08-02T16:24:19.947+02:00`  
**Reviewer runtime:** `gpt-5.5`; author runtime `gpt-5.6-sol`  
**Independence:** `VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS`  
**Invoked by:** `AFF-4`  
**Subject modification performed:** `false`

## Summary
Phase 4 r3 is a bounded metadata correction that resolves AFFA-P4-R5-MIN-004 by binding changeControl.proposedPhase3Binding to the exact unchanged Phase 3 r2 manifest while preserving the substantive r2 security remediation.

## Independent verification
- Manifest: `cases/Stratton-Europe-Captital/4-implementation-plan/stratton-phase-4-hashes-cc-001-r3-proposed.json`
- Manifest SHA-256: `4ecd7bd341d406f4361d8441b8c5d961848fef9506ebbd0dc8034016ee569626` (`MATCH`).
- Model plan: revision `10` / `63750f1ea18a89fa3a7500fff05a6f98135bc6a5e98ad6301fdfbc246e94b894`.
- Artifact count: `13`; artifact hashes `ALL_MANIFEST_ENTRIES_RECOMPUTED_AND_MATCHED`.
- Reviewed-subject snapshot: `reviews/aff-a/4/round-6/reviewed-subject/stratton-phase-4-hashes-cc-001-r3-proposed.json`.
- Hash receipt: `reviews/aff-a/4/round-6/reviewed-subject/stratton-phase-4-hash-verification-receipt.json` / `2f6a1fbe9e9322beb79dc16d301d6d6edfa029b29d6a4d1dfb735bbd2ec53ce2`.
- Model receipt: `reviews/aff-a/4/round-6/stratton-aff-a-model-receipt.json` / `eb810a0504d26440591fa963383ba68001e4496f71960fca79469213fc2fa4f7`.
- Frozen subject pre/post: `4ecd7bd341d406f4361d8441b8c5d961848fef9506ebbd0dc8034016ee569626` / `4ecd7bd341d406f4361d8441b8c5d961848fef9506ebbd0dc8034016ee569626`.
- Phase 3 r2 binding: `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54` (`MATCHES_EXACT_UNCHANGED_PHASE_3_R2_HASH`).
- Phase 4 r2 immutability: `7a4d6a5e0f9caa2bdb726798e875ce1a6726f4cb0c05a383c0ec36caa8eb8ed9` (`MATCH`).
- DU sequence proof: `17` nodes, `46` edges, acyclic `true`.
- Trust-vector proof: `PASS` with `4` positive and `10` negative vectors.

## Findings
| ID | Severity | Status | Required action |
|---|---|---|---|
| `AFFA-P4-R6-MIN-001` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | 276 implementation parameters remain owner-bound fail-closed values; named owners must provide evidence before activation. |
| `AFFA-P4-R6-MIN-002` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | Internal Audit WP-05 package acceptance/build/sign/publish/deploy/operate remains a future fail-closed gate. |
| `AFFA-P4-R6-MIN-003` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | 14 open controls remain unwaived and gate-bound. |
| `AFFA-P4-R6-MIN-004` | `MINOR` | `BOUNDED_WORDING_GAP_NOT_SECURITY_REMEDIATION` | The r3 amendment approval block says 're-review of one unchanged r2 manifest'; authoritative r3 manifest/catalogue/model-plan correctly bind Phase 4 r3 and Phase 3 r2. Correct this wording only in any future material revision. |

## Review area results
| Area | Status | Evidence |
|---|---|---|---|
| Frozen subject and artifact hashes | `CONFORMS` | The r3 manifest and all 13 manifest-bound artifacts were recomputed and matched before and after review. |
| Model independence | `CONFORMS` | AFF-A actual runtime gpt-5.5 differs from author actual runtime gpt-5.6-sol; VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS recorded. |
| Phase 3 r2 binding | `CONFORMS` | Manifest, upstreamBinding, proposedUpstream and changeControl.proposedPhase3Binding all bind e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54. |
| AFFA-P4-R5-MIN-004 resolution | `CONFORMS` | The stale current-candidate Phase 3 path is corrected; remaining old-path references are explicitly historical revision-8/before references. |
| Substantive remediation preservation | `CONFORMS` | No DU, requirement, SBB, ABB, identity, trust-vector or security-control count changed from r2; r3 is metadata/path cleanup. |
| Authority separation | `CONFORMS` | Repository administration, review, merge, build, release signing, ACR publication, DU-16 deployment, operations, rollback and role assignment remain separated. |
| Trust-vector semantics | `CONFORMS` | Four positives and ten negatives recompute/pass with purpose-specific snapshots and fail-closed/no-rewrite negative outcomes. |
| DU sequencing | `CONFORMS` | 17 DU nodes and 46 edges are acyclic; DU-16 ordering remains implementable. |
| Parameter/assertion/control counts | `CONFORMS-WITH-GAPS` | 276 parameters, 82 assertions and 14 controls are carried; owner values remain fail-closed. |
| Traceability completeness | `CONFORMS` | 23 SBBs, 44 resource inventory entries, 31 requirements, 19 ABBs and 10 architecture decisions remain mapped with zero unmapped entries. |
| Markdown/HTML/diagram/schema | `CONFORMS` | Markdown/HTML parity, Clawpilot theme contract, SVG sanitisation and manifest schema checks pass. |
| No unauthorised execution | `CONFORMS` | No approval, Phase 5, Azure operation, deployment, what-if or runtime test is claimed or performed. |

## Prior AFF-B major finding disposition
| Finding | AFF-A correctness disposition | Evidence |
|---|---|---|
| `AFFB-CC001-MAJ-001` | `SUBSTANTIVELY_REMEDIATED_FOR_CORRECTNESS_PENDING_AFF_B_REVIEW` | Dedicated Internal Audit source boundary, separate stage identities, two-person gates, immutable chain-of-custody and cross-role negatives are preserved in r3. |
| `AFFB-CC001-MAJ-002` | `SUBSTANTIVELY_REMEDIATED_FOR_CORRECTNESS_PENDING_AFF_B_REVIEW` | SignedAt, purpose-specific TrustVerificationSnapshot/hash, policy/registry/mapping hashes, key validity, revocation/compromise evidence, retention class and WORM co-retention are preserved in r3. |

## Residual gaps
| ID | Owner | Status | Description |
|---|---|---|---|
| `P4-RC-001` | Named parameter owners | `OPEN_OWNER_BOUND_FAIL_CLOSED` | 276 implementation parameters have UNRESOLVED_FAIL_CLOSED evidence status. |
| `P4-RC-002` | Internal Audit | `OPEN_OWNER_BOUND_FAIL_CLOSED` | WP-05 acceptance/build/sign/publish/deploy/operate chain is planned and pre-activation gate-bound. |
| `P4-RC-003` | Named control owners | `OPEN_OWNER_BOUND_FAIL_CLOSED` | 14 controls remain open, unwaived and fail-closed. |
| `P4-RC-004` | AFF-4 future revision if needed | `BOUNDED_WORDING_GAP` | The r3 amendment approval block should say r3 subject/manifest in any future material revision; authoritative JSON bindings are correct. |

## Non-approval statement
AFF-A does not approve STRATTON-CC-001, Phase 5, deployment, Azure operations, runtime testing, legal certification, waiver or human gate passage. Human approval and AFF-B remain pending.

## Verdict rationale
No blocker or unresolved major correctness finding was identified. AFFA-P4-R5-MIN-004 is resolved in the authoritative current-candidate binding and the substantive security remediation is unchanged. Remaining gaps are explicit minor/owner-bound or wording issues; AFF-B and human approval remain pending.
