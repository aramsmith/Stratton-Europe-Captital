# Stratton AFF-A review — Phase 3 — Azure Design round 5

**Change control:** `STRATTON-CC-001`  
**Verdict:** `CONFORMS-WITH-GAPS`  
**Review time:** `2026-08-02T16:06:01.656+02:00`  
**Reviewer runtime:** `gpt-5.5`; author runtime `gpt-5.6-sol`  
**Independence:** `VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS`  
**Invoked by:** `AFF-3`  
**Subject modification performed:** `false`

## Summary
Phase 3 round-2 amendment separates assurance repository, build, signing, publication, deployment, operations and rollback authority, and binds signing-time trust snapshots at design-contract level.

## Independent verification
- Manifest: `cases/Stratton-Europe-Captital/3-azure-design/stratton-phase-3-hashes-cc-001-r2-proposed.json`
- Manifest SHA-256: `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54` (`MATCH`).
- Model plan: revision `9` / `f89c71fd12821781c5ddf3c266b2351003563c9a2b1794e579feeb556f04ddf9`.
- Artifact count: `17`; artifact hashes `ALL_MANIFEST_ENTRIES_RECOMPUTED_AND_MATCHED`.
- Reviewed-subject snapshot: `reviews/aff-a/3/round-5/reviewed-subject/stratton-phase-3-hashes-cc-001-r2-proposed.json`.
- Hash receipt: `reviews/aff-a/3/round-5/reviewed-subject/stratton-phase-3-hash-verification-receipt.json` / `ebd578d73b2b5f1f9b2d5290a144dba9836be4d78f19b3a5d6dc23247f403573`.
- Model receipt: `reviews/aff-a/3/round-5/stratton-aff-a-model-receipt.json` / `914294079d3a28d83783f64e6d10bbfc5e786bc388d920cb84cbf5494a0e6f5f`.
- Frozen subject pre/post: `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54` / `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54`.
- Trust-vector proof: `PASS` with `4` positive and `10` negative vectors.
- TOGAF traceability: `31` requirements, `19` ABBs and `10` decisions preserved.

## Findings
| ID | Severity | Status | Required action |
|---|---|---|---|
| `AFFA-P3-R5-MIN-001` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | 244 amendment parameters remain owner-bound fail-closed values; named owners must provide evidence before activation. |
| `AFFA-P3-R5-MIN-002` | `MINOR` | `PROCESS_GATE_RESIDUAL_NOT_A_SUBJECT_DEFECT` | AFF-B convergence and explicit human approval remain pending; AFF-A does not approve or certify. |

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
| TOGAF traceability | `CONFORMS` | Phase 3 preserves 31 approved requirements, 19 ABBs and 10 architecture decisions from Phase 2 without upstream modification. |
| Architecture authority model | `CONFORMS` | Phase 3 separates source repository, build, signing, publication, deployment and operation authority and binds negative cross-role tests. |
| Contract consistency | `CONFORMS` | Data, security/compliance and operations contracts share source-boundary, trust-snapshot, WORM, private-path and fail-closed semantics. |

## Prior AFF-B major finding disposition
| Finding | AFF-A correctness disposition | Evidence |
|---|---|---|
| `AFFB-CC001-MAJ-001` | `SUBSTANTIVELY_REMEDIATED_FOR_CORRECTNESS_PENDING_AFF_B_REVIEW` | Dedicated Internal Audit source boundary, separate stage identities, two-person gates, immutable chain-of-custody and cross-role negatives. |
| `AFFB-CC001-MAJ-002` | `SUBSTANTIVELY_REMEDIATED_FOR_CORRECTNESS_PENDING_AFF_B_REVIEW` | All four signed records include signedAt, purpose-specific TrustVerificationSnapshot/hash, policy/registry/mapping hashes, key validity, revocation/compromise evidence, retention class and WORM co-retention. |

## Residual gaps
| ID | Owner | Status | Description |
|---|---|---|---|
| `P3-RC-001` | Named parameter owners | `OPEN_OWNER_BOUND_FAIL_CLOSED` | 244 amendment parameters remain unresolved owner inputs. |
| `P3-RC-002` | Human architect / AFF-B | `OPEN_GATE` | AFF-B round-2 convergence and explicit human approval remain pending. |

## Non-approval statement
AFF-A does not approve STRATTON-CC-001, Phase 5, deployment, Azure operations, runtime testing, legal certification, waiver or human gate passage. Human approval remains pending.

## Verdict rationale
No blocker or unresolved major correctness finding was identified. Round 2 is internally coherent enough for AFF-A with explicit minor/owner-bound gaps, unchanged frozen hashes, and no approval/deployment/runtime claim. AFF-B must still perform its own compliance re-review on the same unchanged manifest before any human gate decision.
