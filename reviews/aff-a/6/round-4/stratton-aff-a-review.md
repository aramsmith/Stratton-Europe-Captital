# AFF-A Rubber Duck Review — Phase 6 — C-level Presentation — Round 4

**Case:** `Stratton-Europe-Captital`  
**Subject:** `cases/Stratton-Europe-Captital/6-presentation-r4`  
**Verdict:** **DIVERGES**  
**Review time:** `2026-08-10T00:21:50.961+02:00`  
**Final round for this manifest:** `false`

## Binding and independence

- Canonical manifest: `cases/Stratton-Europe-Captital/6-presentation-r4/stratton-phase-6-hashes.json`
- Expected and recomputed SHA-256: `2b7636177aaebcc3aada661860598db36e1fe888517b7a4ec17154353bdce106`; pre/post identity remained unchanged.
- Manifest verification: **154/154** hashes matched; 0 duplicates; ordinal order and safe relative paths passed.
- Model-plan revision `111`, SHA-256 `64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7`.
- AFF-A approved default `gpt-5.5`; selected/actual `gpt-5.6-luna`.
- Phase-author actual `gpt-5.6-sol`; exact actual IDs differ and separation is verified.

## Findings

### BLOCKER — AFFA-P6-R4-BLK-001 — Active model-plan mismatch

Revision 111 records a 19-slide, `WORKING_DRAFT_NOT_FROZEN` predecessor with no canonical manifest. The immutable r4 manifest, author receipt and evidence bind a 20-slide candidate to that same revision. This is a material governing-record failure, not an acceptable retained active revision.

**Evidence:** `0-coordination/stratton-model-plan-revision-111.json:50-61,249-250`; `6-presentation-r4/stratton-phase-6-hashes.json:7,33,819-820`; `6-presentation-r4/evidence/stratton-aff-6-model-receipt.json`.  
**Owner/action:** AFF-6/AFF-0 must create a new append-only model-plan binding for the 20-slide candidate, including the human direction/approval for the expanded storyline; never edit revision 111 or the immutable subject.

### MAJOR — AFFA-P6-R4-MAJ-001 — Cost input/SKU contradiction

The cost data prices APIM Standard v2, while the Phase 5 coding slide labels current evidence as APIM PremiumV2, capacity 1. The board figure is therefore not reproducibly tied to one current SKU set. The illustrative and GPT-4o mini public-rate proxy caveats are good but do not resolve this contradiction.

**Evidence:** `deck/src/data/azurePricing.js:3,16,30,55`; `deck/src/slides/CodingSlide.jsx:77-80`; `deck/src/slides/CostsBenefitsSlide.jsx:96,137`; `stratton-presentation.md:86,112`.  
**Owner/action:** AFF-6 with the adjacent Phase 4/5 owners must reconcile the cost inputs or label the figure as a separate Standard v2 scenario with the PremiumV2 variance; then create a new hash-bound candidate.

### MINOR — AFFA-P6-R4-MIN-001 — PDF producer metadata is not disclosed

The export receipt records blank document fields, zero XMP and zero attachments. Read-only bytes still contain `/Info` and `/Producer(MuPDF 1.29.0)`. No local-user or platform marker was found, but the sanitisation record is incomplete about the remaining producer marker.

**Evidence:** `evidence/pdf-export-receipt.json:15-31`; immutable `deck/deck.pdf` SHA-256 `8c444c67b47528665bbdbefa277960fe7506cd23f7bcbdcf56f90b4c57a02da2`.  
**Owner/action:** AFF-6 must disclose and accept the marker or remove it in a new PDF/candidate; do not alter this subject.

## Confirmed review areas

- Canonical manifest hash matched 2b7636177aaebcc3aada661860598db36e1fe888517b7a4ec17154353bdce106 before and after review.
- All 154 listed artifacts existed and recomputed hashes matched; paths were safe, duplicate-free and ordinal sorted.
- Manifest role counts matched: 107 presentation-source, 22 presentation-export, 3 diagram, 2 test, 1 tooling, 16 evidence, 1 catalogue, 1 rendered HTML and 1 authoritative Markdown.
- The reviewed-subject manifest snapshot is byte-identical to the canonical manifest.
- Author receipt hash matched 11e60ab661828550e46764d6ae7baf5787bdfa35e0b433d70d2cef522e36ed6a; author actual model is gpt-5.6-sol.
- AFF-A default is gpt-5.5; selected and actual reviewer model is gpt-5.6-luna; actual author model is gpt-5.6-sol; separation is verified.
- The r4 catalogue contains 20 slides, 38 distinct material claims and 68 source references with zero missing source paths; deck order matches the catalogue.
- Markdown and HTML carry the 20-slide inventory, claim IDs and execution-boundary language; no external runtime reference was found in the HTML.
- The narrative distinguishes source fact, hypothesis, design intent, static evidence and untested runtime behaviour; GPT-4o mini is explicitly a public-rate proxy rather than an approved GPT-5.6 route cost.
- Phase 5 r7 wording is bounded: 124 deployable source files, 17 implementation units, ten local validation steps and 5 + 8 work-package wording; no Azure execution or runtime claim is made.
- Browser/determinism/network/static evidence is present and locally bounded; this review did not execute any of it.
- Asset-rights evidence blocks external distribution pending accountable owner confirmation or asset replacement.
- Prior AFF-A round 3 hash matched 8c542720f995a9a5b3b35a520b5bc84e4cbd718ae13becfdcc1e5729dd3ab7cb and is superseded because it covered revision 3, not r4.
- No subject file was edited, rebuilt, executed, exported, deployed, inferred against or runtime-tested; AFF-B was not invoked.

## Residual gaps and boundary

- Model-plan mismatch, cost/SKU reconciliation and PDF producer disclosure remain open.
- External distribution remains blocked by the explicit asset-rights owner gate.
- Phase 5 owner-bound regions, quota/capacity, recovery, retention, licence/source permissions, regulatory classification and benchmark evidence remain open and fail closed.
- AFF-B specialist review for r4 and human Phase 6 approval are absent; AFF-A does not substitute for either.
- Static-only review: read-only file/hash inspection and static text/source review only. No npm, Playwright, browser script, PDF export, build, Azure command, deployment, inference, runtime test, subject code execution or subject modification occurred.

## Rationale and non-approval

The subject is hash-integrity valid and evidence-rich, but the active governing model plan is stale for the bound 20-slide candidate and a material cost input contradiction remains. The blocker and unresolved major require a new candidate/model-plan binding and full same-hash review convergence. **AFF-A does not approve Phase 6, waive residual gaps, certify compliance, provide legal advice or formal attestation, authorise Azure activity, authorise deployment/runtime testing, or invoke AFF-B.**
