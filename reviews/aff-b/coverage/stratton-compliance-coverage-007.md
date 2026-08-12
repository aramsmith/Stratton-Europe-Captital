# AFF-B compliance coverage 007 — STRATTON-CC-001 final formal coverage

**Status:** `FROZEN_FORMAL_FINAL`  
**JSON SHA-256:** `e769a9326a6bf362a566a42934ef6093d2dca8e37bc955a53474e17f664147d8`  
**Actual runtime model:** `gpt-5.6-sol`  
**Governing model plan:** revision `10` / `63750f1ea18a89fa3a7500fff05a6f98135bc6a5e98ad6301fdfbc246e94b894`  
**Formalised:** `2026-08-02T16:29:24.713+02:00`

## Assurance and applicability boundary

Architecture security/compliance assurance only. This is not legal advice, certification, attestation,
waiver, approval, Azure validation, deployment or runtime evidence. GDPR and the EU AI Act governance
boundary remain human-confirmed inputs; SFDR and AIFMD remain trigger-conditional; DORA remains
conditional under `VAL-001`. No owner decision, production value or waiver is invented.

## Preserved traceability

Coverage 007 preserves all 25 obligation clusters, 31 active requirement IDs, 19 ABBs, 10 architecture
decisions, `CC1-COV-01` through `CC1-COV-09`, `PF-01` through `PF-19`, and every prior owner-bound
control. It replaces the prior draft-only sequence-007 bytes in place and is now immutable.

## Canonical subjects and final AFF-A bindings

| Phase | Subject manifest | Subject SHA-256 | Final AFF-A record | AFF-A SHA-256 | Verdict (B/M/m) |
| --- | --- | --- | --- | --- | --- |
| 3 | `cases/Stratton-Europe-Captital/3-azure-design/stratton-phase-3-hashes-cc-001-r2-proposed.json` | `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54` | `cases/Stratton-Europe-Captital/reviews/aff-a/3/round-5/stratton-aff-a-review.json` | `1be8a11a1cf51e9009be9db1e9dcb2f8e5369181c1c6862b988de9d29f28d539` | CONFORMS-WITH-GAPS (0/0/2) |
| 4 | `cases/Stratton-Europe-Captital/4-implementation-plan/stratton-phase-4-hashes-cc-001-r3-proposed.json` | `4ecd7bd341d406f4361d8441b8c5d961848fef9506ebbd0dc8034016ee569626` | `cases/Stratton-Europe-Captital/reviews/aff-a/4/round-6/stratton-aff-a-review.json` | `e2ab8da4dbcaa8cc826ba825432129e60d2756b0e515dabaf30156eaf73627e8` | CONFORMS-WITH-GAPS (0/0/4) |

Phase 4 binds the exact Phase 3 hash `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54`. Historical Phase 4 r2 remains
immutable at `7a4d6a5e0f9caa2bdb726798e875ce1a6726f4cb0c05a383c0ec36caa8eb8ed9`.

## Change-control coverage

| ID | Domain | Coverage status |
| --- | --- | --- |
| CC1-COV-01 | Authority separation and no workload verdict authority | COVERED_DESIGN_FAIL_CLOSED_OWNER_INPUTS_OPEN |
| CC1-COV-02 | Internal Audit repository/build/sign/ACR/deploy/operate supply chain | COVERED_DESIGN_FAIL_CLOSED_OWNER_INPUTS_OPEN |
| CC1-COV-03 | Private exact-version Blob pull/copy, anti-SSRF, scan and WORM | COVERED_DESIGN_FAIL_CLOSED_OWNER_INPUTS_OPEN |
| CC1-COV-04 | Purpose-specific signing-time trust snapshots and historical verification | COVERED_WITH_MINOR_HELPER_FIELD_CONSISTENCY_GAP |
| CC1-COV-05 | Evaluator sandbox and untrusted artifact handling | COVERED_DESIGN_FAIL_CLOSED_OWNER_INPUTS_OPEN |
| CC1-COV-06 | Prompt injection, instruction/data separation, retrieval isolation and recovery | COVERED_DESIGN_FAIL_CLOSED_OWNER_INPUTS_OPEN |
| CC1-COV-07 | Regional private AI and retained human authority | COVERED_WITH_VAL-005_AND_AFFB-RES-001_OPEN |
| CC1-COV-08 | Producer-signed audit, stream continuity, receipt trust and material guard | COVERED_WITH_MINOR_HELPER_FIELD_CONSISTENCY_GAP |
| CC1-COV-09 | Queue limits, retention, recovery, rollback and secure activation | COVERED_DESIGN_FAIL_CLOSED_OWNER_INPUTS_OPEN |

## Former AFF-B major findings

| Finding | Prior status | Coverage status |
| --- | --- | --- |
| AFFB-CC001-MAJ-001 | OPEN_SUBJECT_REMEDIATION_REQUIRED | REMEDIATION_EVIDENCE_MAPPED_FOR_INDEPENDENT_FORMAL_RETEST |
| AFFB-CC001-MAJ-002 | OPEN_SUBJECT_REMEDIATION_REQUIRED | REMEDIATION_EVIDENCE_MAPPED_FOR_INDEPENDENT_FORMAL_RETEST |

The formal phase reviews independently re-test and disposition both former MAJOR findings.

## Owner-bound controls

| ID | Owner | Required before | Status |
| --- | --- | --- | --- |
| VAL-001 | General Counsel | Before any formal DORA claim or scope-changing obligation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| VAL-002 | Chief Investment Officer and Service Operations | Before service/performance acceptance | OPEN_FAIL_CLOSED_NOT_WAIVED |
| VAL-003 | Deal Operations, AI Governance, General Counsel, Compliance and Chief Investment Officer | Before Internal Audit validation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| VAL-004 | Source and records owners | Before production ingestion | OPEN_FAIL_CLOSED_NOT_WAIVED |
| VAL-005 | General Counsel | Before production location/transfer acceptance and regional deployment | OPEN_FAIL_CLOSED_NOT_WAIVED |
| AFFB-RES-001 | General Counsel and Head of AI Governance | Before production AI use or classification claim | OPEN_FAIL_CLOSED_NOT_WAIVED |
| AFFB-RES-002 | Legal and compliance owners | Before formal representation relying on the regulatory register | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-001 | Internal Audit, Identity Lead and Workload Security Owner | Before any assurance submission/audit/receipt/verdict signature activation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-002 | Internal Audit, Source Storage Owner, Network Lead and Records Owner | Before evidence pull/copy acceptance | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-003 | Internal Audit Software Owner, Release Authority, Security Operations and Business Continuity | Before WP-05 acceptance, DU-16 deployment or evaluation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-004 | Head of AI Governance, Data Owner, Application Engineering and Service Operations | Before analysis/vectorisation or index alias activation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-005 | Internal Audit, Application Owner and Service Operations | Before audit sender/receiver/receipt guard activation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-006 | Internal Audit Repository Owner, Security Owner, Identity Lead and Release Authority | Before authoritative source acceptance, build/sign/publish/deploy or operations | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-007 | Internal Audit Cryptographic Evidence Owner, Workload Security Owner, Records Owner and Business Continuity | Before any submission/audit/receipt/verdict signature or historical trust acceptance | OPEN_FAIL_CLOSED_NOT_WAIVED |

Human approval remains pending. Coverage 007 does not approve STRATTON-CC-001, Phase 5 authority
finalisation, deployment or Azure operations.
