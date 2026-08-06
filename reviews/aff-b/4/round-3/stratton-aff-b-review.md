# AFF-B security and compliance review — Phase 4 — Implementation Plan

**Change control:** `STRATTON-CC-001`  
**Round:** `3`  
**Verdict:** `CONFORMS-WITH-GAPS`  
**Findings:** BLOCKER `0`, MAJOR `0`, MINOR `2`  
**Compact B/M/m:** `0/0/2`  
**Invoked by:** `AFF-4`; AFF-0 is governance bookkeeping only  
**Actual runtime model:** `gpt-5.6-sol`  
**Governing model plan:** revision `10` / `63750f1ea18a89fa3a7500fff05a6f98135bc6a5e98ad6301fdfbc246e94b894`  
**Coverage:** sequence `007` / `e769a9326a6bf362a566a42934ef6093d2dca8e37bc955a53474e17f664147d8`

## Assurance boundary

Independent architecture security/compliance assurance only. This record is not legal advice,
certification, formal attestation, waiver, approval, deployment authorisation, Azure validation,
runtime evidence or operating-effectiveness evidence.

## Immutable subject and final AFF-A binding

- Manifest: `cases/Stratton-Europe-Captital/4-implementation-plan/stratton-phase-4-hashes-cc-001-r3-proposed.json`
- Pre-review SHA-256: `4ecd7bd341d406f4361d8441b8c5d961848fef9506ebbd0dc8034016ee569626`
- Post-review SHA-256: `4ecd7bd341d406f4361d8441b8c5d961848fef9506ebbd0dc8034016ee569626` — `UNCHANGED`
- Bound artifacts: `13`; every hash independently recomputed and matched.
- Reviewed-subject snapshot: `cases/Stratton-Europe-Captital/reviews/aff-b/4/round-3/reviewed-subject/stratton-phase-4-hashes-cc-001-r3-proposed.json` — byte-identical.
- Final AFF-A: `cases/Stratton-Europe-Captital/reviews/aff-a/4/round-6/stratton-aff-a-review.json`
- Final AFF-A SHA-256: `e2ab8da4dbcaa8cc826ba825432129e60d2756b0e515dabaf30156eaf73627e8` — `MATCH`
- AFF-A verdict: `CONFORMS-WITH-GAPS` (0/
  0/4).

## Executive conclusion

Both former AFF-B MAJOR findings are resolved after substantive re-test. Internal Audit authority is
separated across source administration/review/merge, build, signing, immutable ACR publication,
deployment, operations, rollback and role assignment, with cross-role denials and fail-closed
activation. Every submission, audit event, receipt and verdict binds a complete purpose-specific
signing-time TrustVerificationSnapshot and signedAt in the canonical preimage, with WORM co-retention
and immutable historical verification. Four positive vectors and all ten negative mutations pass.

## Former MAJOR finding dispositions

| Finding | Prior severity | Formal disposition |
| --- | --- | --- |
| AFFB-CC001-MAJ-001 | MAJOR | RESOLVED_IN_REMEDIATION_ROUND_2 |
| AFFB-CC001-MAJ-002 | MAJOR | RESOLVED_IN_REMEDIATION_ROUND_2 |

## Canonical vector re-test

- Snapshot hash and derived snapshot ID: PASS.
- Four positive purpose-specific envelope vectors: PASS.
- Audit `eventHash`, `eventId` and `messageBodyHash`: PASS.
- Ten negative mutations: PASS, fail-closed/historical-policy dispositions matched.

## Phase 4 independent reconciliation

- 17 unique DUs and 46 unique acyclic dependency edges.
- 5 work packages; 276 unique fail-closed parameters and 276 exact evidence rows.
- All 244 Phase 3 required parameters are carried.
- 82 assertions, 14 open controls, 20 unique identity mappings and 27 validation areas.
- Exact Phase 3 binding: `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54`.
- Phase 4 r2 remains immutable at `7a4d6a5e0f9caa2bdb726798e875ce1a6726f4cb0c05a383c0ec36caa8eb8ed9`.
- Security-critical r2/r3 sections are unchanged; no security regression detected.

## Findings

### AFFB-CC001-R2-MIN-001 — MINOR

**Purpose metadata retains two stale signing-time field labels**

Normative audit/verdict schemas, canonical hash contracts and vectors require signedAt, so historical trust binding remains enforceable. The helper purpose list still names producerSignatureCreatedAt for WORKLOAD_AUDIT_EVENT and issuedAt without signedAt for INTERNAL_AUDIT_VERDICT; generated clients must not treat that helper list as normative.

Evidence:
- `3-azure-design/evidence/stratton-data-api-contracts-cc-001-r2-proposed.json signatureAndProducerTrust.purposes WORKLOAD_AUDIT_EVENT fields`
- `3-azure-design/evidence/stratton-data-api-contracts-cc-001-r2-proposed.json signatureAndProducerTrust.purposes INTERNAL_AUDIT_VERDICT fields`
- `3-azure-design/evidence/stratton-data-api-contracts-cc-001-r2-proposed.json canonicalCryptographicContract and normative event/verdict schemas`

Required action: Before signature-client implementation, align both helper lists to signedAt while retaining issuedAt as the separate verdict decision timestamp.

Acceptance criteria:
- WORKLOAD_AUDIT_EVENT helper fields name signedAt.
- INTERNAL_AUDIT_VERDICT helper fields include signedAt and retain issuedAt only as decision time.
- Normative schemas, canonical preimages, vectors and WORM snapshot binding remain unchanged.

### AFFB-CC001-R3-MIN-002 — MINOR

**Phase 4 r3 amendment approval wording calls the corrected subject unchanged r2**

The authoritative r3 manifest, catalogue, evidence and model plan correctly bind Phase 4 r3 and exact Phase 3 r2. The prose wording can mislead a human reader but cannot override the hash-bound current-candidate records.

Evidence:
- `4-implementation-plan/stratton-cc-001-r3-phase-4-amendment.md approval block`
- `4-implementation-plan/stratton-cc-001-r3-phase-4-amendment.html approval block`
- `reviews/aff-a/4/round-6/stratton-aff-a-review.json AFFA-P4-R6-MIN-004`

Required action: Correct the wording in any future material revision; automation and approvals must use the canonical r3 manifest/catalogue hashes, not the prose label.

Acceptance criteria:
- Any future material amendment names the Phase 4 r3 subject and Phase 3 r2 binding accurately.
- No edit is made solely to mutate this now-frozen subject.
- Automation continues to use canonical manifest and catalogue bindings.


## Final AFF-A residual alignment

- `AFFA-P4-R6-MIN-001` — OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT: 276 implementation parameters remain owner-bound fail-closed values; named owners must provide evidence before activation.
- `AFFA-P4-R6-MIN-002` — OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT: Internal Audit WP-05 package acceptance/build/sign/publish/deploy/operate remains a future fail-closed gate.
- `AFFA-P4-R6-MIN-003` — OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT: 14 open controls remain unwaived and gate-bound.
- `AFFA-P4-R6-MIN-004` — BOUNDED_WORDING_GAP_NOT_SECURITY_REMEDIATION: The r3 amendment approval block says 're-review of one unchanged r2 manifest'; authoritative r3 manifest/catalogue/model-plan correctly bind Phase 4 r3 and Phase 3 r2. Correct this wording only in any future material revision.

Owner-bound parameters, provider evidence, data residency, AI Act classification, DORA applicability,
retention/legal-hold values and activation evidence remain unwaived and fail closed.

## Convergence and human gate

AFF-A and AFF-B now cover the same exact unchanged subject and both return `CONFORMS-WITH-GAPS`.
Review convergence is established, but human approval remains pending. This record does not approve
STRATTON-CC-001, Phase 5 authority finalisation, deployment or Azure operations.
