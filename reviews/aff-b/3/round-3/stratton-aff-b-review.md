# AFF-B security and compliance review — Phase 3 — Azure Design

**Change control:** `STRATTON-CC-001`  
**Round:** `3`  
**Verdict:** `DIVERGES`  
**Actual runtime model:** `gpt-5.6-sol`  
**Model plan:** revision `8` / `19754c9d3b4273d91b8af61cc0e38523768967ecf50a79f9c3caee4694a41be9`  
**Coverage:** sequence `006` / `d85823693aebed0f790a81377d9e79e785db97c7f2322d0c904dfbf36deec78b`

## Assurance boundary

Independent architecture assurance only. This record is not legal advice, legal or regulatory certification, formal attestation, waiver, approval, deployment authorisation, Azure validation, runtime evidence or an operating-effectiveness conclusion.

## Immutable subject verification

- Manifest: `cases/Stratton-Europe-Captital/3-azure-design/stratton-phase-3-hashes-cc-001-proposed.json`
- SHA-256: `87d2df1790fc2df39b122f51264b50826c7716e63955d95596d6be92511e8c16` — **MATCH**
- Canonical schema: **PASS**
- Bound artifacts: `15` — **all hashes recomputed and matched**
- Final AFF-A: `cases/Stratton-Europe-Captital/reviews/aff-a/3/round-4/stratton-aff-a-review.json` / `6199029413b9cc75c594b443c676c522ed518f93b298cea0f878b06f23a78fdc`
- AFF-A verdict: `CONFORMS-WITH-GAPS`; same unchanged manifest: **yes**
- AFF-A/AFF-B subject convergence: **yes**; verdict convergence: **no**

## Executive assessment

The proposal materially improves authority separation, private evidence transfer, sandboxing, hostile-content controls, audit continuity, queue relationships, rollback preservation and activation gating. Two unresolved major defects remain: the assurance software supply chain concentrates source/build/sign/publish/deploy authority, and historical signed trust evidence is not immutably bound to signing time and exact trust snapshots. The human gate is blocked.

## Findings

### AFFB-CC001-MAJ-001 — MAJOR: Assurance supply-chain authority remains concentrated and the dedicated repository boundary is undefined

**Impact:** The proposal separates assurance from workload authority, but it does not define an independently administered Internal Audit source repository or equivalent source-control boundary. Phase 4 combines accepted-repository build/release signing, ACR push and DU-16 deployment in one assurance-build-release-deploy identity. Compromise or misuse of that principal can produce, sign, publish and deploy assurance code, weakening the independence of the verdict authority and creating false assurance.

**Evidence:**
- `3-azure-design/evidence/stratton-security-compliance-contract-cc-001-proposed.json authentication.management and authorityMatrix`
- `3-azure-design/evidence/stratton-cc-001-change-control-evidence.json PF-06`

**Owner:** Internal Audit Software Owner and Release Authority, Identity Lead, Enterprise DevSecOps and AFF-4

**Required remediation:** Define a dedicated Internal Audit-controlled repository or equivalently isolated source-control boundary with enforced branch protection and independent acceptance. Split repository merge/acceptance, reproducible build, release-signing key use, ACR push, deployment and operations into separately authorised identities and approval steps; require immutable provenance/SBOM/signature evidence and negative cross-role tests. Update the Phase 3 authority contract and Phase 4 WP-05, identity mappings, gates and validation plan, then generate new manifests for complete AFF-A/AFF-B re-review.

### AFFB-CC001-MAJ-002 — MAJOR: Signed receipt and trust evidence are not immutably bound to signing time and exact trust snapshots

**Impact:** The receipt schema does not require signedAt even though the purpose contract expects it. Signed envelopes identify keys, but the exact algorithm-policy, trust-registry and signer-mapping versions/hashes used for verification are external mutable parameters rather than immutable per-record bindings. Rotation, revocation, compromise or registry replacement can therefore make historical receipt/verdict verification ambiguous and weaken audit continuity, recovery and records evidence.

**Evidence:**
- `3-azure-design/evidence/stratton-data-api-contracts-cc-001-proposed.json receiptSchema.required omits signedAt while signatureAndProducerTrust requires signedAt`
- `3-azure-design/evidence/stratton-data-api-contracts-cc-001-proposed.json canonicalCryptographicContract receiptHash/verdictHash exclusions and signatureAndProducerTrust verification`
- `3-azure-design/evidence/stratton-data-api-contracts-cc-001-proposed.json failClosedParameterGroups purpose-specific trust registry versions/hashes`

**Owner:** Internal Audit cryptographic authority, Workload Security Owner, Records Owner and AFF-3/AFF-4

**Required remediation:** Require signedAt for receipts and bind purpose, algorithm-policy ID/version/hash, trust-registry version/hash, signer-mapping version/hash, key-validity evidence and applicable compromise/revocation disposition into each signed envelope or an immutable referenced verification receipt covered by receiptHash/verdictHash. Retain those snapshots for the full record/legal-hold period and test historical verification across rotation, revocation, compromise, rollback and recovery. Regenerate affected Phase 3/4 artifacts and manifests for complete re-review.


## All 19 remediation assessments

| ID | Area | Status | Assessment |
|---|---|---|---|
| PF-01 | Canonical preimages | CONFORMS | Domain-separated RFC 8785 preimages, exclusions, ordering, UTF-8 and timestamp rules are explicit and non-self-referential. |
| PF-02 | Purpose-specific cryptographic trust | DIVERGES | Purpose separation and fail-closed policy inputs exist, but signed receipt time and immutable per-record trust-policy/registry evidence are incomplete; see AFFB-CC001-MAJ-002. |
| PF-03 | Verdict uniqueness and exact read | CONFORMS | Trusted producer plus validationRunId uniqueness, replay/conflict/supersession and exact-submission reads are explicit. |
| PF-04 | Private exact-version evidence transfer | CONFORMS | Allow-listed exact Blob version pull, ETag/hash/type/size checks, scan controls, private RBAC/DNS, WORM copy and SSRF/SAS/redirect/version-swap negatives are explicit. |
| PF-05 | Independent evaluator inputs | CONFORMS-WITH-OWNER-GATES | Internal Audit policy, registries, release/images, schemas and limits are bound, but values remain owner-supplied and fail closed. |
| PF-06 | Internal Audit assurance package and supply chain | DIVERGES | Ownership is separated from workload, but the dedicated repository boundary and separation of repository acceptance, build, signing, ACR push, deployment and operations identities are not enforced; see AFFB-CC001-MAJ-001. |
| PF-07 | Untrusted artifact sandbox | CONFORMS-WITH-OWNER-GATES | Static verification is default; dynamic execution is separately authorised, ephemeral, least-privileged, bounded and fail closed. |
| PF-08 | Analysis binding and instruction/data separation | CONFORMS | Canonical configuration/input bindings include prompt, chunking, instruction/data separation, injection, schema, alias and revocation controls. |
| PF-09 | Vector provenance and isolation | CONFORMS | Tenant/case, manifest, chunk/evidence, embedding/schema provenance and deterministic scoped keys are required with server-injected filters. |
| PF-10 | Hostile retrieval and poisoned-index recovery | CONFORMS | Prompt-injection, cross-boundary, citation spoof, index poison and revocation tests plus known-good rebuild and atomic alias switch are explicit; tools and fallback are prohibited. |
| PF-11 | Audit producer authenticity and receipt binding | CONFORMS-WITH-PF02-GAP | Producer-signed events and event/body/position receipt binding are explicit, but historical receipt trust remains blocked by AFFB-CC001-MAJ-002. |
| PF-12 | Audit stream conflict and continuity | CONFORMS | Unique tenant/case/sequence, strict sender order, predecessor validation and no continuity advance for gaps/conflicts/signature/schema/poison are explicit. |
| PF-13 | Role-separated material guard | CONFORMS-WITH-PF02-GAP | The reconciler and material guard require an exact signed VERIFIED_CONTIGUOUS receipt; cryptographic historical verification remains blocked by AFFB-CC001-MAJ-002. |
| PF-14 | Queue limits and ordering relationships | CONFORMS-WITH-OWNER-GATES | Size, TTL, grace, retry/reconciliation, duplicate window, expiry DLQ and ordering relationships fail closed when unresolved or invalid. |
| PF-15 | Phase 4 reconciliation and owner parameters | CONFORMS-WITH-OWNER-GATES | 17 DUs, 46 acyclic dependencies, five work packages, 170 owner-bound parameters, 60 assertions, 12 controls, 10 identities and 19 validation entries reconcile. |
| PF-16 | Secure activation sequence | CONFORMS | The six-step sequence gates software acceptance, infrastructure, private paths, negative tests and workload clients without premature activation. |
| PF-17 | Authority-flow overlay | CONFORMS | Editable and sanitised accessible diagrams cover pull/copy, verdict, analysis/vectorisation and audit push/receipt. |
| PF-18 | Clawpilot HTML contract | CONFORMS | Subject HTML is self-contained and passes theme, variable, font and no-external-runtime checks. |
| PF-19 | Change-control remediation evidence | CONFORMS | All 19 preliminary findings, remediation claims, baseline preservation and formal re-review boundary are enumerated. |

## Owner-bound residual controls

| ID | Owner | Required before | Status |
|---|---|---|---|
| VAL-001 | General Counsel | Any formal DORA claim or scope-changing obligation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| VAL-002 | Chief Investment Officer and Service Operations | Service and performance acceptance | OPEN_FAIL_CLOSED_NOT_WAIVED |
| VAL-003 | Deal Operations, AI Governance, General Counsel, Compliance and Chief Investment Officer | Internal Audit validation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| VAL-004 | Source and records owners | Production ingestion | OPEN_FAIL_CLOSED_NOT_WAIVED |
| VAL-005 | General Counsel | Production regional deployment, location and transfer acceptance | OPEN_FAIL_CLOSED_NOT_WAIVED |
| AFFB-RES-001 | General Counsel and Head of AI Governance | Production AI use or any classification claim | OPEN_FAIL_CLOSED_NOT_WAIVED |
| AFFB-RES-002 | Legal and compliance owners | Any formal representation relying on the regulatory register | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-001 | Internal Audit, Identity Lead and Workload Security Owner | Any assurance submission, audit, receipt or verdict signature activation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-002 | Internal Audit, Source Storage Owner, Network Lead and Records Owner | Evidence pull/copy acceptance | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-003 | Internal Audit Software Owner, Release Authority, Security Operations and Business Continuity | WP-05 acceptance, DU-16 deployment or evaluation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-004 | Head of AI Governance, Data Owner, Application Engineering and Service Operations | Analysis/vectorisation or index alias activation | OPEN_FAIL_CLOSED_NOT_WAIVED |
| CC1-OWN-005 | Internal Audit, Application Owner and Service Operations | Audit sender, receiver or receipt guard activation | OPEN_FAIL_CLOSED_NOT_WAIVED |

## Applicability and claim boundary

GDPR and the EU AI Act governance boundary remain human-confirmed inputs; no AI Act risk classification is asserted. SFDR and AIFMD remain trigger-conditional. DORA remains inferred and entity-specific applicability is open under `VAL-001`. Official article-level evidence remains open under `AFFB-RES-002`. No legal conclusion, compliance claim, certification, attestation, deployment, Azure validation or runtime result is made.

## Final status

`SAME_UNCHANGED_MANIFEST_CONFIRMED_BUT_VERDICT_DIVERGENCE_HUMAN_GATE_BLOCKED`

AFF-B did not modify the subject and does not approve, waive, certify, attest, deploy, validate Azure, test runtime behaviour or authorise activation.
