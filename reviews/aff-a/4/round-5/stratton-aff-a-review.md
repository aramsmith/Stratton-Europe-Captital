# Stratton AFF-A review — Phase 4 — Implementation Plan round 5

**Change control:** `STRATTON-CC-001`  
**Verdict:** `CONFORMS-WITH-GAPS`  
**Review time:** `2026-08-02T16:06:01.656+02:00`  
**Reviewer runtime:** `gpt-5.5`; author runtime `gpt-5.6-sol`  
**Independence:** `VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS`  
**Invoked by:** `AFF-4`  
**Subject modification performed:** `false`

## Summary
Phase 4 round-2 amendment translates authority separation and signing-time trust semantics into work packages, deployable units, identity mappings, assertions and validation gates.

## Independent verification
- Manifest: `cases/Stratton-Europe-Captital/4-implementation-plan/stratton-phase-4-hashes-cc-001-r2-proposed.json`
- Manifest SHA-256: `7a4d6a5e0f9caa2bdb726798e875ce1a6726f4cb0c05a383c0ec36caa8eb8ed9` (`MATCH`).
- Model plan: revision `9` / `f89c71fd12821781c5ddf3c266b2351003563c9a2b1794e579feeb556f04ddf9`.
- Artifact count: `13`; artifact hashes `ALL_MANIFEST_ENTRIES_RECOMPUTED_AND_MATCHED`.
- Reviewed-subject snapshot: `reviews/aff-a/4/round-5/reviewed-subject/stratton-phase-4-hashes-cc-001-r2-proposed.json`.
- Hash receipt: `reviews/aff-a/4/round-5/reviewed-subject/stratton-phase-4-hash-verification-receipt.json` / `ef0bd2fd5ce579b0d48d9c3a236be908217dc49ac89e58ceb4d8b97325c4d9e4`.
- Model receipt: `reviews/aff-a/4/round-5/stratton-aff-a-model-receipt.json` / `55fd145b01b1f4b7bbc09ebe5f998e34494a5812cf6d8c42f6bca21ea6c23748`.
- Frozen subject pre/post: `7a4d6a5e0f9caa2bdb726798e875ce1a6726f4cb0c05a383c0ec36caa8eb8ed9` / `7a4d6a5e0f9caa2bdb726798e875ce1a6726f4cb0c05a383c0ec36caa8eb8ed9`.
- Trust-vector proof: `PASS` with `4` positive and `10` negative vectors.
- DU sequence proof: `17` nodes, `46` edges, acyclic `true`.
- Phase 3 r2 binding: `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54` (`MATCHES_FROZEN_PHASE_3_R2_HASH_WITH_MINOR_STALE_CHANGECONTROL_REFERENCE`).

## Findings
| ID | Severity | Status | Required action |
|---|---|---|---|
| `AFFA-P4-R5-MIN-001` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | 276 implementation parameters remain owner-bound fail-closed values; named owners must provide evidence before activation. |
| `AFFA-P4-R5-MIN-002` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | Internal Audit WP-05 package acceptance/build/sign/publish/deploy/operate remains a future fail-closed gate. |
| `AFFA-P4-R5-MIN-003` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | 14 open controls remain unwaived and gate-bound. |
| `AFFA-P4-R5-MIN-004` | `MINOR` | `BOUNDED_INTERNAL_REFERENCE_GAP` | changeControl.proposedPhase3Binding still names the revision-8 Phase 3 proposal path; manifest/upstreamBinding/proposedUpstream correctly bind the r2 hash. |

## Review area results
| Area | Status | Evidence |
|---|---|---|---|
| Frozen subject and artifact hashes | `CONFORMS` | Subject manifests and every manifest-bound artifact were recomputed and matched before and after review. |
| Model independence | `CONFORMS` | AFF-A actual runtime gpt-5.5 differs from author actual runtime gpt-5.6-sol; recorded as VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS. |
| Historical boundary | `CONFORMS` | Revision-8 manifests are byte-identical; superseded interim r2 hashes are historical non-subject evidence only. |
| Authority separation | `CONFORMS` | Repository administration, review, merge, build, release signing, ACR publication, DU-16 deployment, operations, rollback and role assignment are separately owned and mutually denied. |
| Trust-vector semantics | `CONFORMS` | Four positive vectors recompute purpose, signedRecordId, signedAt, signer tenant/object, key, policy/registry/mapping hashes, validity/revocation evidence, retention class, snapshot ID/hash and envelope hash; ten negatives deny/block/review/recover/no-rewrite. |
| Signed record immutability | `CONFORMS` | Submission, audit event, receipt and verdict include signedAt and TrustVerificationSnapshot/hash inside canonical preimages and co-retain records/snapshots in Internal Audit WORM. |
| Prior AFF-B MAJOR remediation | `CONFORMS-WITH-GAPS` | Both prior AFF-B MAJOR findings are substantively remediated for AFF-A correctness; AFF-B still owns compliance judgement. |
| Owner values | `CONFORMS-WITH-GAPS` | Repository IDs, tenants, groups, keys, algorithms, endpoints, regions, retention and thresholds remain owner-supplied fail-closed values. |
| Markdown/HTML/diagram consistency | `CONFORMS` | Candidate Markdown/HTML headings are in parity; HTML is self-contained with Clawpilot variables; diagrams parse without active script/foreignObject/external runtime reference. |
| No unauthorised execution | `CONFORMS` | The subjects claim no approval, deployment, what-if, Azure operation, Phase 5 output or runtime validation. |
| Phase 3 r2 binding | `CONFORMS-WITH-GAPS` | Manifest, upstreamBinding and proposedUpstream bind the exact Phase 3 r2 hash; one catalogue changeControl cross-reference is stale and minor. |
| DU sequencing | `CONFORMS` | 17 DU nodes and 46 dependency edges are acyclic; DU-16 precedes dependent workload/private-path activation. |
| Implementation fidelity | `CONFORMS` | WP-05, DU-06, DU-12, DU-13, DU-16 and DU-17 translate Phase 3 authority, identity, assertion, evidence and gate requirements into implementable tasks. |
| Traceability completeness | `CONFORMS` | 23 SBBs, 44 resource inventory entries, 31 requirements, 19 ABBs and 10 architecture decisions are mapped with zero unmapped entries. |

## Prior AFF-B major finding disposition
| Finding | AFF-A correctness disposition | Evidence |
|---|---|---|
| `AFFB-CC001-MAJ-001` | `SUBSTANTIVELY_REMEDIATED_FOR_CORRECTNESS_PENDING_AFF_B_REVIEW` | Dedicated Internal Audit source boundary, separate stage identities, two-person gates, immutable chain-of-custody and cross-role negatives. |
| `AFFB-CC001-MAJ-002` | `SUBSTANTIVELY_REMEDIATED_FOR_CORRECTNESS_PENDING_AFF_B_REVIEW` | All four signed records include signedAt, purpose-specific TrustVerificationSnapshot/hash, policy/registry/mapping hashes, key validity, revocation/compromise evidence, retention class and WORM co-retention. |

## Residual gaps
| ID | Owner | Status | Description |
|---|---|---|---|
| `P4-RC-001` | Named parameter owners | `OPEN_OWNER_BOUND_FAIL_CLOSED` | 276 implementation parameters have UNRESOLVED_FAIL_CLOSED evidence status. |
| `P4-RC-002` | Internal Audit | `OPEN_OWNER_BOUND_FAIL_CLOSED` | WP-05 acceptance/build/sign/publish/deploy/operate chain is planned and pre-activation gate-bound. |
| `P4-RC-003` | Named control owners | `OPEN_OWNER_BOUND_FAIL_CLOSED` | 14 controls remain open, unwaived and fail-closed. |
| `P4-RC-004` | AFF-4 future revision if needed | `BOUNDED_REFERENCE_GAP` | One non-authoritative change-control cross-reference is stale. |

## Non-approval statement
AFF-A does not approve STRATTON-CC-001, Phase 5, deployment, Azure operations, runtime testing, legal certification, waiver or human gate passage. Human approval remains pending.

## Verdict rationale
No blocker or unresolved major correctness finding was identified. Round 2 is internally coherent enough for AFF-A with explicit minor/owner-bound gaps, unchanged frozen hashes, and no approval/deployment/runtime claim. AFF-B must still perform its own compliance re-review on the same unchanged manifest before any human gate decision.
