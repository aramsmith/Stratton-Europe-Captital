# AFF-B Security and Compliance Review — Phase 6 — Round 3

**Case:** `Stratton-Europe-Captital`  
**Immutable subject:** `cases/Stratton-Europe-Captital/6-presentation-r6`  
**Verdict:** **DIVERGES**  
**Reviewed at:** `2026-08-10T01:32:43.3812148+02:00`  
**Phase 6 approval:** **not granted**

## Binding and independence

- Canonical manifest SHA-256: `3e5c859c8fe5bf71154c1131692c56e612549fb165221c1b291ef95e39590219`.
- Independent parent verification: **155/155** listed artifact hashes matched; the manifest and reviewed snapshot are byte-identical.
- Final AFF-A round 6 SHA-256: `13029b87a1ee99cefa97354ee6955018b23745266e89d08bf217a7426e312e13`; verdict **CONFORMS**; findings **0**; same exact r6 manifest.
- Model-plan revision `113`: Sol author, Luna AFF-A and Terra AFF-B.
- AFF-B selected and actual runtime: `gpt-5.6-terra`; exact model separation from author and AFF-A is verified.

## Scope

The review covered all 20 slides, Markdown, HTML, 38 claims, 69 source references, dated pricing evidence, browser/network/static receipts, disclosure scan, asset-rights inventory, PDF evidence, Phase 5 r7 boundaries, regulatory wording and the no-deployment/no-runtime/no-certification boundary.

## Finding

### MAJOR — `AFFB-P6-R3-MAJ-001` — visible reviewer roster conflicts with active model governance

`deck/src/slides/AgenticAssuranceRosterSlide.jsx` and the compiled bundle visibly identify:

- AFF-A as `gpt-5.4`
- AFF-B as `gpt-5.6-sol`

Model-plan revision 113 binds the current Phase 6 author and reviewers to:

- AFF-6 author: `gpt-5.6-sol`
- AFF-A reviewer: `gpt-5.6-luna`
- AFF-B reviewer: `gpt-5.6-terra`

The slide describes an independent assurance crew but does not visibly distinguish legacy framework defaults from the active case assignments. A board reader can therefore infer incorrect reviewer-model independence and an unapproved model route.

**Required action:** create a new append-only presentation candidate. Replace legacy hard-coded roster models with truthful case-active or explicitly evidence-bound routing, update associated notes and traceability, rebuild and refreeze the subject, then obtain fresh AFF-A and AFF-B reviews against the same new manifest. Do not modify immutable r6.

## Confirmed controls

- APIM Premium v2 pricing is bound to a dated `2026-08-10` West Europe snapshot; no live-rate or future-price claim is made.
- The on-premises comparator, premium and projected benefits are illustrative or hypothetical, not customer quotes or realised outcomes.
- EU Data Zone Standard, NoAutoUpgrade and Global Standard prohibition are design/static implementation boundaries, not observed Azure runtime facts.
- GDPR is a requirements boundary; EU AI Act role/use-case classification, DORA applicability and detailed legal mappings remain owner/legal-gated.
- The disclosure scan reports no high-confidence credential or local-system findings.
- PDF metadata is bounded and transparent: blank parsed fields, no XMP or attachments, and disclosed `MuPDF 1.29.0`.
- Runtime-network evidence is local-only with zero external or failed requests; static evidence reports no source maps, external CSS dependencies or missing references.
- Asset/source/brand rights and all coverage-020 owner controls remain explicit fail-closed gates.
- No Azure deployment, inference, promotion, retention finalisation, Phase 8 runtime testing, compliance certification or operating-effectiveness evidence exists.

## Retained owner gates

Regions and resource IDs, quota/capacity, embeddings and benchmarks, recovery/failover, provider terms, source and licence permissions, privacy lifecycle, retention/legal hold, legal and regulatory classification, release identity, asset rights and future Azure/runtime evidence remain unresolved, unwaived and fail closed.

## Regulatory boundary

This review makes no legal conclusion, jurisdiction decision, compliance certification, formal attestation or waiver. GDPR, EU AI Act, DORA, SFDR and AIFMD statements remain exactly within their sourced, conditional or human-owner boundaries.

## Verdict rationale

The r6 package is strong on bounded claims, pricing disclosure, privacy/export hygiene and no-runtime overclaiming. However, the visible assurance roster materially contradicts revision 113 and the actual Luna/Terra reviewer evidence. Because the contradiction can misrepresent independent-review governance to the architecture board, the immutable r6 subject diverges and requires a new revisioned candidate.

## Human and execution boundary

This record does not approve Phase 6 or authorise Phases 7 or 8. Human approval remains unavailable until remediation, fresh same-manifest AFF-A/AFF-B review and explicit in-tool human decision.
