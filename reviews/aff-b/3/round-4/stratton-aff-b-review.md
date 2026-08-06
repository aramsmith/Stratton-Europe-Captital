# AFF-B security and compliance review — Phase 3 — Azure Design

**Change control:** `STRATTON-CC-001`  
**Round:** `4`  
**Verdict:** `CONFORMS-WITH-GAPS`  
**Findings:** BLOCKER `0`, MAJOR `0`, MINOR `1`  
**Compact B/M/m:** `0/0/1`  
**Invoked by:** `AFF-3`; AFF-0 is governance bookkeeping only  
**Actual runtime model:** `gpt-5.6-sol`  
**Governing model plan:** revision `10` / `63750f1ea18a89fa3a7500fff05a6f98135bc6a5e98ad6301fdfbc246e94b894`  
**Coverage:** sequence `007` / `e769a9326a6bf362a566a42934ef6093d2dca8e37bc955a53474e17f664147d8`

## Assurance boundary

Independent architecture security/compliance assurance only. This record is not legal advice,
certification, formal attestation, waiver, approval, deployment authorisation, Azure validation,
runtime evidence or operating-effectiveness evidence.

## Immutable subject and final AFF-A binding

- Manifest: `cases/Stratton-Europe-Captital/3-azure-design/stratton-phase-3-hashes-cc-001-r2-proposed.json`
- Pre-review SHA-256: `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54`
- Post-review SHA-256: `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54` — `UNCHANGED`
- Bound artifacts: `17`; every hash independently recomputed and matched.
- Reviewed-subject snapshot: `cases/Stratton-Europe-Captital/reviews/aff-b/3/round-4/reviewed-subject/stratton-phase-3-hashes-cc-001-r2-proposed.json` — byte-identical.
- Final AFF-A: `cases/Stratton-Europe-Captital/reviews/aff-a/3/round-5/stratton-aff-a-review.json`
- Final AFF-A SHA-256: `1be8a11a1cf51e9009be9db1e9dcb2f8e5369181c1c6862b988de9d29f28d539` — `MATCH`
- AFF-A verdict: `CONFORMS-WITH-GAPS` (0/
  0/2).

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


## Final AFF-A residual alignment

- `AFFA-P3-R5-MIN-001` — OWNER_BOUND_RESIDUAL_CONTROL_NOT_A_SUBJECT_DEFECT: 244 amendment parameters remain owner-bound fail-closed values; named owners must provide evidence before activation.
- `AFFA-P3-R5-MIN-002` — PROCESS_GATE_RESIDUAL_NOT_A_SUBJECT_DEFECT: AFF-B convergence and explicit human approval remain pending; AFF-A does not approve or certify.

Owner-bound parameters, provider evidence, data residency, AI Act classification, DORA applicability,
retention/legal-hold values and activation evidence remain unwaived and fail closed.

## Convergence and human gate

AFF-A and AFF-B now cover the same exact unchanged subject and both return `CONFORMS-WITH-GAPS`.
Review convergence is established, but human approval remains pending. This record does not approve
STRATTON-CC-001, Phase 5 authority finalisation, deployment or Azure operations.
