# Stratton Phase 3 architecture amendment proposal

**Change control:** `STRATTON-CC-001`  
**Status:** `PROPOSED_PENDING_FORMAL_REVIEW_AND_HUMAN_APPROVAL`  
**Model-plan revision / author:** `8` / `gpt-5.6-sol`  
**Scope:** Phase 3 proposal overlay; no approval, code, Azure validation, deployment or runtime claim

## 1. Control and traceability

The human architect selected **HS-001** Internal Audit-owned verdict API/compute, **HS-002** governed production analysis/vectorisation and **HS-003** Internal Audit-owned immutable audit export. Approved Phase 3 artifacts, hashes and approval remain unchanged. The preliminary proposal manifests are preserved byte-for-byte and superseded by revision 8. This candidate requires new formal hash-bound AFF-A and AFF-B review and explicit human approval; no convergence is claimed.

The separate change-control evidence records the approved baseline hashes, superseded preliminary hashes, affected artifacts and all 19 remediations. Citadel placement, private-only posture, two-region fail-closed location pattern, source/human authority, RTO/RPO, Release 1 cap and seven baseline open controls remain unchanged.

## 2. Canonical cryptographic contract

Every hash is lowercase hexadecimal SHA-256 over UTF-8 `domainSeparator + U+000A + RFC8785(canonicalObject)`. UTF-8 has no BOM; timestamps are UTC `YYYY-MM-DDTHH:mm:ss.fffZ`. Set-semantic arrays use contract-declared ordinal ordering and reject duplicates.

| Hash | Domain and exclusions |
|---|---|
| `configurationBindingHash` | `STRATTON-CONFIGURATION-BINDING-v1`; excludes itself and approval signatures |
| `inputManifestHash` | `STRATTON-INPUT-MANIFEST-v1`; excludes itself and producer signature fields |
| `manifestHash` | `STRATTON-ASSURANCE-MANIFEST-v1`; excludes itself and submission signature fields |
| `eventHash` | `STRATTON-AUDIT-EVENT-v1`; excludes `eventId`, itself, `messageBodyHash` and producer signature fields |
| `eventId` | `STRATTON-AUDIT-EVENT-ID-v1`; derived only after `eventHash` from tenant, case, sequence and event hash |
| `messageBodyHash` | `STRATTON-AUDIT-MESSAGE-BODY-v1`; covers the final signed body and excludes only itself |
| `receiptHash` | `STRATTON-AUDIT-RECEIPT-v1`; excludes itself and Internal Audit receipt signature fields |
| `verdictHash` | `STRATTON-ASSURANCE-VERDICT-v1`; excludes itself and Internal Audit verdict signature fields |

Submission signing, audit-event signing, receipt signing and verdict signing are separate purposes and key mappings. Exact algorithms and key versions are owner inputs, not defaults. Token tenant/object identity must match the trusted producer and signer registry. Missing, unavailable, expired, revoked, compromised, wrong-purpose or mismatched algorithm/key/identity denies processing.

## 3. Internal Audit assurance boundary

`submissionId` is deterministic from the trusted producer tenant/object identity and `validationRunId`; the database enforces unique `(producerTenantId, producerObjectId, validationRunId)`. Same run and manifest is replay. Same run with a different manifest is `409` plus security alert. A correction uses a new `validationRunId` and `supersedesSubmissionId`; prior receipts and verdicts remain immutable. Verdict read is `/assurance/v1/evidence-submissions/{submissionId}/verdict`, optionally bound to the exact manifest hash.

Each manifest result object identifies an approved Azure Blob storage account resource ID, container, blob name, immutable version ID, ETag, SHA-256, media type, size and role. SAS, arbitrary URL, redirect and public path are prohibited. An Internal Audit read-only managed identity uses approved private DNS/RBAC to fetch the exact version, verifies all metadata and malware/archive/active-content policy, and copies it to assurance WORM storage. Only then is a signed acceptance receipt issued. Inaccessible, replaced or mismatched content fails closed; workload cannot write or delete the assurance copy.

Internal Audit alone supplies the evaluation policy ID/version/hash, benchmark and test-suite registry bindings, evaluator release manifest and signed image digests, schemas, approval evidence and object/rate/time/CPU/memory/process/storage limits. Verdicts bind those inputs and copied object hashes; a workload-supplied decision or policy is never authoritative.

Static verification is default. Separately authorised dynamic execution uses an ephemeral, non-root, immutable-image sandbox with read-only copied input, no management-plane role, secrets or public egress, explicit private dependencies, hostile-file controls and approved resource limits. The sandbox is destroyed after results. Missing authorisation, sandbox or policy yields `INCONCLUSIVE` or `FAIL`, never `PASS`.

## 4. Governed analysis and vectorisation

The immutable configuration binding includes adapter, prompt, regional model/deployment/version, embedding deployment/model/version/dimensions, content safety, chunking, instruction/data separation, prompt-injection control and corpus, Search schema/alias, server-filter, evidence-revocation, no-tool-use and limits evidence. The input manifest canonically binds tenant/case, admitted evidence version/content hash, classification, licence expiry, citation locator and chunking policy.

Vector records persist tenant and case IDs, both manifest hashes, chunk text hash, chunking policy, exact evidence/version/content hash/citation, embedding binding/dimensions and Search schema. Deterministic keys include tenant and case. Server code injects tenant, case, classification, admission and licence filters from authenticated policy context; caller filters are never accepted.

Indirect prompt injection, malicious evidence instructions, cross-tenant/case retrieval, schema escape, citation spoofing, poisoned index and revocation/version-swap tests are mandatory. Revocation, licence expiry or content change invalidates affected chunks/runs. A versioned known-good index is rebuilt and the alias switches atomically only after validation. No tools, autonomous action, source write-back or lower-control fallback are allowed.

## 5. Signed immutable audit push

The workload commits the business mutation, canonical audit fields and SQL outbox in one transaction, then a purpose-specific signer creates `eventHash`, `eventId`, producer signature and final `messageBodyHash`. There is no cross-database transaction. Stream position is unique on `(tenantId, caseId, sequence)` and Service Bus `SessionId=tenantId:caseId`; the sender dispatches strictly in sequence.

Internal Audit verifies producer token/signature/trust, all hashes, message size, unique position and predecessor before advancing continuity. Same position/hash is replay; same position/different hash is conflict even when event IDs differ. Unknown schema, gap, malformed signature, conflict or poison is retained/quarantined and never advances continuity.

The signed receipt binds verified producer identity/key metadata, event and final body hashes, stream position and assurance signer metadata. It proves authenticated receipt and integrity—not truth or compliance. A role-separated reconciler verifies Internal Audit trust/signature and exact binding before local `VERIFIED_CONTIGUOUS`; a database update cannot fabricate success. Material transitions trust only that valid receipt. TTL must exceed grace plus maximum retry/reconciliation; message size, duplicate window, expiry dead-letter and sender ordering are explicit fail-closed inputs. Rollback preserves outbox, DLQ, quarantine and immutable records.

## 6. WAF trade-offs and unresolved inputs

| Pillar | Optimised outcome | Trade-off |
|---|---|---|
| Security | Purpose-specific trust, private exact-version copy, sandbox, tenant filters and signed receipts | More identities, registries and negative tests |
| Reliability | Deterministic replay, WORM copies, ordered continuity and known-good index recovery | Eventual consistency can pause transitions |
| Performance efficiency | Bounded queue, evaluator and provider limits | Excess or untrusted work is rejected, not degraded |
| Cost optimisation | Reuses 17 planned infrastructure units | Independent assurance compute/storage/ACR and rebuild capacity add cost |
| Operational excellence | Versioned schemas, signed releases, poison/revocation/recovery procedures | Additional Internal Audit release and runbook ownership |

All 138 amendment parameters remain fail closed with named owners/evidence in Phase 4. No tenant, region, endpoint, queue, identity, algorithm, key, model, dimension, prompt, retention, quota, limit or threshold value is selected here.

## 7. Approval block

**Required next action:** formal AFF-A and AFF-B re-review against the same final manifest, then explicit human decision.  
**Human architect decision:** PENDING. This proposal does not modify or approve the historical baseline.
