# Stratton AFF-A review — Phase 3 — Azure Design round 4

**Change control:** `STRATTON-CC-001`  
**Verdict:** `CONFORMS-WITH-GAPS`  
**Review time:** `2026-08-02T14:43:24.681+02:00`  
**Reviewer runtime:** `gpt-5.5`; author runtime `gpt-5.6-sol`  
**Subject modification performed:** `false`

## Summary
Phase 3 proposed revision 8 remediates the preliminary AFF-A concerns at design-contract level, preserves the approved baseline and preliminary copy, and binds to model-plan revision 8 and a recomputed manifest hash.

## Independent verification
- Manifest: `cases/Stratton-Europe-Captital/3-azure-design/stratton-phase-3-hashes-cc-001-proposed.json`
- Manifest SHA-256: `87d2df1790fc2df39b122f51264b50826c7716e63955d95596d6be92511e8c16` (`MATCH`)
- Model plan: revision `8` / `19754c9d3b4273d91b8af61cc0e38523768967ecf50a79f9c3caee4694a41be9`
- Artifact count: `15`; artifact hashes: `ALL_MANIFEST_ENTRIES_RECOMPUTED_AND_MATCHED`
- Schema validation: `PASS` against `.github/schemas/aff-phase-hashes.schema.json`
- Parser/accessibility checks: JSON, XML/SVG/Draw.io and HTML parse; SVG sanitisation and Clawpilot contract pass.
- Phase 3 parameter coverage: `138` required parameters; `ALL_138_REQUIRED_PARAMETERS_PRESENT_IN_PHASE_4_PARAMETER_EVIDENCE_REQUIREMENTS`.

## Findings
| ID | Severity | Status | Required remediation |
|---|---|---|---|
| `AFFA-P3-R4-MIN-001` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | Named owners must provide the required Phase 4 parameter evidence before implementation activation; no Phase 3 subject remediation is required for this review. |
| `AFFA-P3-R4-MIN-002` | `MINOR` | `OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT` | Accountable owners must resolve or explicitly accept the fail-closed controls at the appropriate human gate; this proposal does not waive them. |

## Review area results
| Area | Status | Evidence |
|---|---|---|
| Non-circular canonical preimages | `CONFORMS` | Domain-separated RFC8785 rules define exact exclusions; manifests do not self-list; hash-generation evidence records self-reference exclusion. |
| Signature/trust/key-purpose policy | `CONFORMS` | Four signer purposes, trust registries, key versions, validity/revocation/compromise and wrong-purpose denial are present. |
| Exact submission uniqueness/replay/correction/verdict read | `CONFORMS` | submissionId derives from trusted producer identity plus validationRunId; replay/conflict/correction and exact verdict endpoint are specified. |
| Private exact Blob-version pull/copy | `CONFORMS` | Approved account/container/blob/version/ETag/hash/type/size/role plus private RBAC/DNS and WORM copy are required; SAS/URL/public/redirect are denied. |
| Evaluation inputs | `CONFORMS` | Internal Audit-owned policy, registries, test suite, release/image digests, schemas and limits bind verdicts. |
| Internal Audit-owned assurance software/release package and authority | `CONFORMS-WITH-GAPS` | WP-05 and DU-16 define ownership and signed release gates; package creation remains future owner-bound work. |
| Untrusted artifact sandbox | `CONFORMS` | Static default and separately authorised ephemeral no-management/no-secret/no-public-egress sandbox are specified fail-closed. |
| Governed analysis/input/configuration hashes | `CONFORMS` | configurationBindingHash and inputManifestHash bind adapter, prompt, model, embedding, safety, chunking, filters and revocation evidence. |
| Vector provenance and tenant/case isolation | `CONFORMS` | Vector records and keys include tenant/case, manifest hashes, chunk/evidence provenance, dimensions and schema. |
| Prompt-injection/poison/revocation recovery | `CONFORMS` | Hostile-content, cross-boundary, citation, index poison and revocation tests plus known-good alias recovery are specified. |
| Producer-signed audit events | `CONFORMS` | Audit events require producer token/signature/trust verification and final signed body hashing. |
| Unique stream position/continuity | `CONFORMS` | Unique tenant/case/sequence, SessionId tenantId:caseId, predecessor validation and no continuity advance for gaps/conflicts/poison are specified. |
| Signed receipt binding/material guard | `CONFORMS` | Receipt binds identity/key/event/body/stream/signer and role-separated reconciler verifies before VERIFIED_CONTIGUOUS/material transition. |
| Queue size/TTL/duplicate/order assertions | `CONFORMS` | Message size, duplicate window, max delivery, dead-letter-on-expiry, TTL/retry relationship and one-dispatcher ordering are assertions/parameters. |
| Phase 4 DU/work package/parameter/assertion/control/identity/validation reconciliation | `CONFORMS-WITH-GAPS` | 17 DUs, five WPs, 170 parameters, 60 assertions, 12 controls, 10 identities and 19 validation entries reconcile; owner inputs remain fail-closed. |
| Dependency rationale/activation sequence | `CONFORMS` | 17-node/46-edge graph is acyclic; DU-09→DU-16 rationale and six-step activation are stated. |
| Authority overlay | `CONFORMS` | Accessible draw.io/SVG authority overlay is bound and sanitised with title/description and no script/foreignObject/external references. |
| HTML | `CONFORMS` | Phase amendment HTML files are self-contained, parseable, Clawpilot-themed with theme detector first and no external runtime dependencies. |
| Change-control evidence | `CONFORMS` | Change evidence enumerates all 19 preliminary findings, dispositions, baselines, superseded preliminary copies and review/approval boundaries. |

## Residual controls
| ID | Owner | Status | Description |
|---|---|---|---|
| `P3-RC-001` | Named parameter owners | `OPEN_OWNER_BOUND_FAIL_CLOSED` | 138 Phase 3 amendment parameters remain unresolved and fail-closed with Phase 4 owner/evidence coverage. |
| `P3-RC-002` | Named baseline control owners | `OPEN_OWNER_BOUND_FAIL_CLOSED` | Seven approved baseline controls remain open, unwaived and gate-bound. |

## Verdict rationale
No blocker or unresolved major finding was identified. Residual gaps are explicit, owner-bound and fail-closed; no approval, convergence, deployment, Azure validation or runtime evidence is claimed.

## Non-approval statement
AFF-A does not approve, waive, certify, attest, deploy, test, fix or modify the reviewed subject.
