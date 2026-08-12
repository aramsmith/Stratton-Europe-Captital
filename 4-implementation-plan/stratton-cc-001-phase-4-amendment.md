# Stratton Phase 4 implementation-plan amendment proposal

**Change control:** `STRATTON-CC-001`  
**Status:** `PROPOSED_PENDING_FORMAL_REVIEW_AND_HUMAN_APPROVAL`  
**Model-plan revision / author:** `8` / `gpt-5.6-sol`  
**Proposed Phase 3 input:** `3-azure-design/stratton-phase-3-hashes-cc-001-proposed.json` / `87d2df1790fc2df39b122f51264b50826c7716e63955d95596d6be92511e8c16`

## 1. Control and scope

This proposal plans **HS-001** Internal Audit verdict authority, **HS-002** governed analysis/vectorisation and **HS-003** immutable audit push/receipt. Approved Phase 3/4 baselines, approvals, Phase 5 code/IaC and coordinator/review records remain unchanged. Preliminary manifests are preserved byte-for-byte and superseded. This candidate requires formal hash-bound AFF-A/AFF-B re-review and explicit human approval; no convergence, deployment or runtime result is claimed.

The catalogue carries 17 infrastructure DUs, 46 acyclic edges, five work packages, 170 fail-closed parameters, 60 assertions, 12 open controls, 10 role-separated identity mappings and 19 local validation entries. Every parameter has named owner, evidence and `UNRESOLVED_FAIL_CLOSED` status.

## 2. Minimum infrastructure DU refinement

No infrastructure DU is added. The 46-edge DAG remains correct: DU-16 already depends on DU-09 because assurance pull/copy needs the approved private, versioned workload evidence source account/container IDs; it is not a cross-database dependency.

| Unit | Revision 8 responsibility |
|---|---|
| DU-09 | Expose approved exact-version evidence source IDs and least-privilege private read path |
| DU-10 | Canonical producer-signed event, final body hash, strict stream order and size/TTL/deduplication/expiry assertions |
| DU-11 | Canonical analysis bindings, complete vector provenance, server filters, hostile-content/revocation and known-good alias recovery |
| DU-12 | Purpose-specific workload clients, exact-submission verdict read, role-separated receipt reconciliation and transition guard |
| DU-13 | Evidence pull private DNS/RBAC, SSRF/version-swap denial, sandbox private dependency and no-management/no-public path |
| DU-16 | Internal Audit infrastructure using only accepted signed release/images; pull/copy, isolated evaluation, audit receiver and purpose signers |
| DU-17 | Trust, pull/copy, sandbox, injection/retrieval/index and signed audit/receipt operational alerts |

## 3. Internal Audit-owned assurance software package

`WP-05` plans a separate candidate `5-coding/assurance/` package: private API, evidence copier/verifier, isolated evaluator, audit receiver, receipt/verdict signers, SQL migrations/outboxes, schemas/clients, tests, SBOM/scans/signatures/release manifest and recovery runbooks. AFF-5 may author a candidate, but Internal Audit owns repository acceptance, independent review, build/release signing, ACR, image digests, deployment identity, configuration, operations and rollback. Delivery/workload identities cannot push assurance images or administer the package. DU-16 deploys only exact Internal Audit-approved signed digests and release-manifest hash.

No package or Phase 5 file is created by this proposal.

## 4. Activation sequence

1. Internal Audit accepts and signs WP-05 software/release evidence.
2. DU-09 exposes approved private exact-version sources; DU-16 deploys assurance infrastructure with the accepted release only.
3. DU-13 completes private endpoints, DNS, source RBAC and sandbox network denial; no public, SAS or redirect fallback.
4. Pull/copy, SSRF/version-swap/scan, purpose trust/signature, sandbox and recovery tests pass.
5. DU-12 activates workload submission, exact-verdict and receipt clients after role-separation tests.
6. Analysis and audit remain disabled until all owner inputs, hostile-content/provenance, signed-stream/receipt, configuration-relation and DU-17 alert gates pass.

Failure at any step leaves clients/material transitions disabled and preserves SQL outboxes, Service Bus queues/DLQ, quarantine and WORM records.

## 5. Verification and rollback

Local tests cover non-self-referential canonical vectors; four signer purposes and token/producer mapping; replay/conflict/supersession; exact private Blob version pull/copy and negative SSRF/redirect/version-swap cases; signed assurance release and sandbox isolation; injection/cross-tenant/citation/index poison/revocation; signed audit order/conflict/gap/poison; exact signed receipt guard; and message size, duplicate window, expiry and TTL relationship.

Rollback is authority-specific. Workload stops clients/senders and retains outbox/trust state. Internal Audit alone rolls assurance back to a previously accepted signed release while preserving SQL, queues/DLQ, quarantine, WORM copies, events, receipts and verdicts. Immutability is never shortened and no public/lower-control fallback is enabled.

## 6. WAF balance and approval block

| Pillar | Plan outcome | Trade-off |
|---|---|---|
| Security | Purpose trust, independent release, private pull/copy, sandbox and role-separated guard | More identities, evidence and owner gates |
| Reliability | Ordered replay, immutable copies/receipts and known-good index recovery | Fail-closed pauses are expected |
| Performance efficiency | Explicit provider, evaluator, object and queue limits | Excess work rejects rather than degrades controls |
| Cost optimisation | Keeps 17 DUs and reuses service classes | WP-05 assurance build/ACR/compute and recovery capacity add cost |
| Operational excellence | Signed release, 19 local validation areas and explicit rollback authority | Internal Audit must operate a separate software lifecycle |

**Required next action:** formal AFF-A and AFF-B review of one unchanged Phase 4 manifest, then explicit human decision.  
**Human architect decision:** PENDING. No approval or convergence is claimed.
