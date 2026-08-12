# AFF-B review — Phase 5 — CC-002 — round 5

## Verdict

**CONFORMS-WITH-GAPS** — final round for the immutable r7 candidate, not a Phase 5 approval. Findings: **0 BLOCKER, 0 MAJOR, 0 MINOR**.

## Scope and independence

- Subject: `cases/Stratton-Europe-Captital/5-coding-r7`; canonical manifest SHA-256 `93ed6504c73dd2c819261e9b0a60fcd0e06d295d2dbf1c1f92c3245dc9c9b519`; 168 files.
- Pre- and post-output verification recomputed the expected manifest SHA-256 and all 168 listed file hashes; no missing or mismatched file was found.
- AFF-B used `gpt-5.6-terra`; Phase 5 implementation/finalisation used `gpt-5.6-sol`. The actual model IDs differ and AFF-B wrote only its own records. Model-plan revision 111 remains hash-bound.
- Handoff, task report, prior AFF-B round 4 and coverage 019 hashes matched their supplied values. This round supersedes coverage 019 with coverage 020 (`4e0583cce517560501898d865adca0739f54b41c167a922a832c07347e923ad5`).

## Security, privacy and supply-chain reassessment

All 168 manifest-listed files were byte-read and reassessed through static control inspection, manifest verification and retained evidence review. Private networking, public-access denial, managed identity, Entra-only SQL, scoped RBAC, parameterised SQL, tenant/case isolation, redacted logging, source allow-listing and draft-only analysis controls remain represented.

The retained source scan reports 0 HIGH/CRITICAL vulnerabilities, 0 HIGH/CRITICAL misconfigurations and 0 secrets. Both retained container scans report 0 HIGH, 0 CRITICAL and 0 secret findings. Image/SBOM/digest evidence is present. Local Cosign evidence is not deployable registry provenance. Source and container licence evidence remains `PENDING_AFF_B_REVIEW`; it is preserved as an owner/legal gap, not a legal determination.

The application retains deterministic, application-owned routing: callers cannot submit deployment or model selectors; `DataZoneStandard`, GPT-5.6 version `2026-07-09` and `NoAutoUpgrade` are enforced in the package design; `GlobalStandard` is rejected. The blocked analysis provider, null benchmark observations and `BLOCKED_PENDING_OBSERVED_EVIDENCE` promotion state prevent inference or promotion. Draft-only, source-write-back, foundation-model training and final-advice boundaries remain prohibited.

## Operational references and prior finding

`AFFA-P5-R6-MAJ-001` is resolved for the r7 candidate: root, deployment and IaC guidance select r7; Phase 7 admission requires explicit approval of the exact r7 manifest; release/freeze controls bind r7. `CandidateReference.Tests.ps1` derives the current sibling and rejects stale operational selectors. r4/r5/r6 occurrences are retained immutable-history/release-provenance references and are non-operational. No security or compliance issue remains from that finding.

## Deterministic evidence chain

The `20260809T161802421Z` validation input manifest has exactly 124 inputs and aggregate `26ac6a6e1ade2e58f74e13a276c7d345f971dcb516ecd8bfe9012618d71fa558` under `SHA256_UTF8_PATH_TAB_SHA256_TAB_SIZE_LF_V1`. The aggregate is present in all ten step records, validation index, dependency evidence, source-security evidence, container evidence and release manifest. Static review of `ValidationEvidence.psm1` and its behavioural contract confirms byte-mutation rejection, exact run/path selection and no runtime mtime selector; the sole `LastWriteTimeUtc` occurrence is the mtime-decoy test fixture.

## Residual owner gaps and boundary

Owner-bound, fail-closed gaps remain for regions/resources, capability/quota and positive capacities, embedding, recovery/failover, provider/terms/licences/source permissions, privacy lifecycle, retention/legal hold, legal/compliance classification, observed benchmark evidence and approved release identity. No applicability conclusion, owner value, requirement, waiver, legal certification or Azure authorisation is created. No Azure sign-in, query, target validation, what-if, deployment, inference, promotion, retention finalisation, network call or runtime test was performed or claimed.

## Evidence package

- Reviewed-manifest snapshot: `reviews/aff-b/5/round-5/reviewed-subject/stratton-phase-5-hashes.json` — `93ed6504c73dd2c819261e9b0a60fcd0e06d295d2dbf1c1f92c3245dc9c9b519`.
- Model receipt: `reviews/aff-b/5/round-5/stratton-aff-b-model-receipt.json` — `468598e20543a722ade366f064bdfdc0fa0d2657cd1bc40f2bc3f2c6a0ab8eca`.
- Coverage 020: `reviews/aff-b/coverage/stratton-compliance-coverage-020.json` — `4e0583cce517560501898d865adca0739f54b41c167a922a832c07347e923ad5`, superseding 019.
- Next action: preserve r7 unchanged and present the converged AFF-A/AFF-B records plus residual gaps to the explicit human gate.
