# Stratton Phase 3 amendment proposal — remediation round 2

**Change control:** `STRATTON-CC-001`  
**Status:** `PROPOSED_R2_PENDING_FORMAL_REVIEW_AND_HUMAN_APPROVAL`  
**Model-plan revision / author:** `9` / `gpt-5.6-sol`  
**Evidence correction timestamp:** `2026-08-02T15:47:29.395+02:00`  
**Scope:** resolves `AFFB-CC001-MAJ-001` and `AFFB-CC001-MAJ-002`; no approval or Azure/runtime claim

## 1. Historical and review boundary

The revision-8 Phase 3 and Phase 4 manifests and every path they bind remain immutable. Formal AFF-A accepted those subjects with gaps; formal AFF-B diverged on exactly two MAJOR findings. Round 2 uses only new `-r2` paths, cites the formal reviews and coverage 006, and requires new hash-bound AFF-A/AFF-B review plus explicit human approval. Existing HS-001 verdict authority, HS-002 governed analysis/vectorisation and HS-003 immutable audit push controls remain in force.

## 2. Dedicated Internal Audit source boundary

Assurance source resides in a dedicated source-control repository or equivalent isolated source boundary independently administered by Internal Audit. Repository platform/ID, tenant or organisation, authentication, branch protection, CODEOWNERS, required reviewers, audit retention and legal hold are owner-supplied fail-closed values. Delivery can submit candidate source only through controlled contribution; it has no direct write, merge, branch-bypass, repository/pipeline administration, assurance ACR push, release-signing, DU-16 deployment or production-operations permission.

Protected release branches deny direct/force push, history rewrite, deletion and self-approval. At least two independent owner-approved reviewers are required; author, merge actor and repository administrator cannot satisfy their own approval. Privileged human roles use owner-approved PIM, phishing-resistant Conditional Access and access review. Repository administration does not imply application merge authority.

## 3. Separation of duties and chain of custody

| Stage | Separate authority | Explicit prohibitions |
|---|---|---|
| Contribution | Delivery candidate contributor | no merge, admin, pipeline edit or release action |
| Merge/acceptance | Internal Audit repository merge identity after CODEOWNERS/two-person approval | no self-approval, build, sign, publish, deploy or operate |
| Reproducible build | Internal Audit build identity | no merge, release-signing key, ACR push, deployment or operations |
| Release signing | Internal Audit release-signing identity | no merge, build, ACR push, deployment or operations |
| ACR publication | Internal Audit ACR publisher | no merge, build, signing or deployment |
| DU-16 deployment | Internal Audit deployment identity after independent approval | no merge, build, sign, push or self-approval |
| Operations / rollback | Separately authorised operations and rollback identities | no arbitrary publication/deployment; rollback only to prior approved signed release |

No human, group, workload identity, credential or pipeline identity may combine incompatible stages or self-grant a stage role. Every promotion binds: accepted commit/tree and merge evidence → source/build inputs/toolchain → reproducible provenance → SBOM/scans → image digest → release signature → immutable ACR digest → deployment approval → exact DU-16 deployed digest/configuration → operations handover. A missing or mismatched link denies promotion.

Release-signing key custody, activation, quorum, rotation, revocation and compromise are owner inputs. Break-glass is PIM/time-bound, phishing-resistant-CA protected, two-person approved, alerted and reviewed; it cannot sign releases, combine merge-to-deploy, disable audit/immutability or erase provenance. Emergency changes must repeat the normal chain before promotion. Rollback preserves failed-release evidence and never rebuilds or resigns history.

## 4. Immutable signing-time trust snapshot

Every workload assurance submission, workload audit event, Internal Audit receipt and Internal Audit verdict includes `signedAt`, the complete `TrustVerificationSnapshot`, and `snapshotHash`. The snapshot binds:

- signature purpose, signed record ID and signing time;
- algorithm-policy ID/version/hash;
- trust-registry ID/version/hash;
- signer-mapping ID/version/hash;
- producer/signer tenant and object IDs;
- key ID/version and key-valid-from/to or immutable validity evidence ID/hash;
- revocation/compromise status, effective-time disposition and evidence ID/hash as evaluated for `signedAt`;
- verification policy/schema, snapshot ID/hash, and retention/legal-hold class.

The domain-separated RFC 8785 snapshot hash is included in the signed record’s canonical preimage. Submission, event, receipt and verdict hashes now exclude only their own hash/signature mechanics; signed time, algorithm/key/trust metadata and snapshot are cryptographically covered. Receipts explicitly require `signedAt`; verdicts bind decision issuance and signing time.

Signed record and exact snapshot are stored together in Internal Audit WORM for the full record/legal-hold period. Planned rotation or registry replacement never rewrites history. Revocation/compromise effective before or at signing invalidates. Known post-signing compromise follows the immutable verification policy. Unknown or ambiguous compromise start yields `TRUST_REVIEW_REQUIRED` and blocks material transitions pending Internal Audit disposition. Disaster recovery and rollback restore and verify record/snapshot together.

## 5. Verification and WAF trade-offs

Positive canonical fixtures require purpose, signed-record, signedAt, signer/key, derived snapshot ID, embedded snapshot hash and envelope hash equality. Negative tests cover cross-role permissions, self-approval, branch/CODEOWNERS bypass, chain mismatch, break-glass abuse, unsigned rollback, missing/tampered snapshot, invalid signing time, wrong purpose, replaced registry, pre/post-signing compromise, unknown compromise start, WORM loss/recovery and software rollback.

| WAF pillar | Round-2 improvement | Trade-off |
|---|---|---|
| Security | Independent source boundary, split identities and signing-time trust evidence | More identities, approvals and key/trust evidence |
| Reliability | Immutable provenance and historically verifiable signed records | Ambiguity deliberately pauses material transitions |
| Performance efficiency | Reproducible staged promotion and bounded verification | Additional promotion and verification latency |
| Cost optimisation | No new infrastructure DU; reuses assurance services | Repository/build/attestation and audit retention add cost |
| Operational excellence | Explicit chain, emergency limits and prior-release rollback | Internal Audit operates a separate controlled software lifecycle |

All 244 amendment parameters remain owner-bound and fail closed. No repository, tenant, group, reviewer, algorithm, key, region, endpoint, retention or threshold value is selected here.

## 6. Approval block

**Required next action:** formal AFF-A and AFF-B re-review against the unchanged round-2 manifest, then explicit human decision.  
**Human architect decision:** PENDING. No convergence or approval is claimed.
