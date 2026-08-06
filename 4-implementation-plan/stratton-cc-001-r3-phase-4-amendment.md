# Stratton Phase 4 implementation-plan amendment — bounded correction r3

**Change control:** `STRATTON-CC-001`  
**Status:** `PROPOSED_R3_PENDING_FORMAL_REVIEW_AND_HUMAN_APPROVAL`  
**Model-plan revision / author:** `10` / `gpt-5.6-sol`  
**Evidence correction timestamp:** `2026-08-02T16:12:29.836+02:00`  
**Proposed Phase 3 r2 input:** `3-azure-design/stratton-phase-3-hashes-cc-001-r2-proposed.json` / `e1b344c59fb2378de07503bee7b27b8f71bb987a148dabd36d66b51830b9bf54`

## 1. Immutable history and scope

The revision-8 Phase 3/4 manifests and all 29 reviewed artifact paths remain unchanged. Formal AFF-A accepted those subjects with gaps; formal AFF-B diverged on `AFFB-CC001-MAJ-001` and `AFFB-CC001-MAJ-002`. Phase 4 r3 copies the reviewed r2 plan under new paths, binds model-plan revision 10 and frozen Phase 3 r2, and corrects only the current-candidate path; no review, coverage or approval record is created.

The r3 plan retains **17 infrastructure DUs and 46 acyclic edges**. It has five work packages, 276 fail-closed parameters, 82 assertions, 14 open controls, 20 identity mappings, 27 local validation areas and 35 resource-class mappings. Every parameter has named owners, required evidence and `UNRESOLVED_FAIL_CLOSED` status.

## 2. WP-05 dedicated source and release boundary

`WP-05` now requires a dedicated Internal Audit repository or equivalent isolated source boundary. Platform/repository ID, tenant or organisation, authentication, branch protection, CODEOWNERS, required reviewers, audit retention and legal hold are owner inputs. `5-coding/assurance/` is delivery candidate staging only and never authoritative. Delivery may contribute a candidate but cannot write, merge, administer, alter pipelines, sign, publish, deploy or operate assurance.

| Stage | Separate identity and gate |
|---|---|
| Repository administration | PIM/CA/access-reviewed platform administration; no application merge authority |
| Review and merge | CODEOWNERS plus two independent reviewers, then separate merge identity; no author/self approval |
| Reproducible build | Accepted immutable commit/tree only; emits toolchain/input/provenance/SBOM/scan evidence |
| Release signing | Separate key identity after independent evidence approval; cannot build/push/deploy |
| ACR publication | Separate publisher writes exact signed digest/attestations to immutable Internal Audit ACR |
| DU-16 deployment | Separate deployer consumes independently approved exact digest/template/configuration |
| Production operations | Separate operator receives handover and cannot publish/deploy arbitrary releases |
| Rollback | Separate rollback authority and production approval; prior approved signed release only |

No person, group, credential, workload or pipeline identity can combine incompatible stages, self-approve or self-grant. Break-glass cannot sign, combine merge-to-deploy, disable audit/immutability or erase provenance. Normal independent gates must rerun before an emergency change is promoted.

## 3. Immutable release chain

Promotion verifies the complete chain: accepted commit/tree and merge approvals → source/build inputs, recipe and toolchain → reproducible provenance → SBOM/scans → image digest → release signature and signing-time trust snapshot → immutable ACR digest/publication evidence → deployment approval → exact DU-16 deployed digest/template/configuration → operations handover. Any missing, substituted, mismatched or self-approved link blocks.

DU-16 deploys only the exact independently approved chain. Rollback preserves the failed release and selects a prior chain already signed and present in immutable ACR; it never rebuilds, resigns or rewrites evidence.

## 4. Signing-time trust evidence

Submission, audit event, receipt and verdict contracts require `signedAt` and a complete `TrustVerificationSnapshot` plus hash. The snapshot records the exact purpose, signed record ID, algorithm policy, trust registry, signer mapping, signer identity, key/version/validity, revocation/compromise effective-time disposition, verification schema and retention/legal-hold evidence evaluated at signing.

Snapshot and metadata are inside each canonical signed-record preimage; only the actual signature bytes and own hash mechanics are excluded. Signed record and snapshot are atomically co-retained in Internal Audit WORM. Receipt reconciliation and material guards verify the historical snapshot, not a current mutable registry.

Planned rotation does not rewrite valid history. Pre-signing revocation/compromise invalidates; known post-signing compromise follows immutable policy. Unknown or ambiguous compromise start yields `TRUST_REVIEW_REQUIRED` and blocks material transitions. Disaster recovery and software rollback restore record/snapshot together.

## 5. Activation and verification sequence

1. Internal Audit provisions the repository boundary and protection/audit controls.
2. Identity Governance proves distinct stage identities, two-person gates, PIM/CA/access reviews and negative role intersections.
3. Delivery contributes candidate source only; independent reviewers and merge identity accept the exact tree.
4. Separate build, signing and ACR publication stages create the immutable chain.
5. Separate deployer activates the exact approved DU-16 digest/configuration; DU-13 private paths remain required.
6. Canonical snapshot/envelope vectors, WORM co-storage, historical trust and recovery/rollback tests pass.
7. Separate operations accepts handover; workload clients, analysis, audit and material transitions remain disabled until all existing gates also pass.

Local tests cover repository bypass/self-approval, every cross-role action, chain substitution, break-glass abuse, unsigned rollback, missing/tampered snapshots, signing outside validity, wrong purpose, replaced registry, revocation/compromise before/after signing, unknown compromise time, WORM loss/recovery and rollback.

## 6. WAF balance and approval block

| Pillar | Improvement | Trade-off |
|---|---|---|
| Security | Independent repository, stage-separated authority and immutable signing-time trust | More identities, approvals and key custody |
| Reliability | Reproducible provenance and historically verifiable WORM records | Ambiguous trust blocks transitions |
| Performance efficiency | Deterministic staged promotion and verification | Added release latency |
| Cost optimisation | No new DU; repository/build/attestation reuse planned service classes | Separate source/build/audit retention add cost |
| Operational excellence | Controlled contribution, exact deployment chain and constrained rollback | Internal Audit operates a full independent software lifecycle |

**Required next action:** formal AFF-A/AFF-B re-review of one unchanged r2 manifest, then explicit human decision.  
**Human architect decision:** PENDING. No convergence or approval is claimed.
