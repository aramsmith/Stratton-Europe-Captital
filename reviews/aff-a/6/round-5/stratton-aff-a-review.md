# AFF-A Rubber Duck Review — Phase 6 — C-level Presentation — Round 5

**Case:** `Stratton-Europe-Captital`  
**Immutable subject:** `cases/Stratton-Europe-Captital/6-presentation-r5`  
**Verdict:** **CONFORMS-WITH-GAPS**  
**Reviewed at:** `2026-08-10T00:54:49.790+02:00`  
**Final round for this manifest:** **true**  
**Phase 6 approval:** **not granted**

## Binding and independence

- Canonical manifest: `cases/Stratton-Europe-Captital/6-presentation-r5/stratton-phase-6-hashes.json`
- Expected and recomputed SHA-256: `84c3d53a711137b8fbd934d0fd9fcc2f3803a8b3d3144467326ff49091c01ba1`; pre-review and post-review values are identical.
- Manifest count: **155**; recomputed listed hashes: **155/155**; duplicate paths: **0**; safe relative paths: **PASS**; canonical array ordering: **PASS** (lexically ordered; the manifest represents ordinal order by array position).
- Model-plan revision: `112`; path `cases/Stratton-Europe-Captital/0-coordination/stratton-model-plan-revision-112.json`; SHA-256 `09634cb3c5a152b65c8a5f4e97835e6f9ab1bb5cee8b039ad2398260b5ae6c7d`.
- The revision explicitly binds the 20-slide `TWENTY_SLIDE_REMEDIATION_CANDIDATE`, does not claim Phase 6 approval, and records the r4 supersession and remediation outcomes.
- Approved AFF-A default: `gpt-5.5`; selected exact model: `gpt-5.6-luna`; actual reviewer runtime: `gpt-5.6-luna`.
- Phase-author selected and actual runtime: `gpt-5.6-sol`.
- **Exact actual separation:** reviewer `gpt-5.6-luna` ≠ author `gpt-5.6-sol`; independence is verified. The human-approved Luna route is recorded in revision 112 and the author receipt.
- Author receipt: `cases/Stratton-Europe-Captital/6-presentation-r5/evidence/stratton-aff-6-model-receipt.json`; SHA-256 `11d11a8d06bf3795b6fd361490abda8b8ce73fb07eabade9dc1ccb8141cb3797`.

## Round-4 supersession and dispositions

The immutable r4 record remains byte-identical: manifest SHA-256 `2b7636177aaebcc3aada661860598db36e1fe888517b7a4ec17154353bdce106` and AFF-A review SHA-256 `3753d03eda88801519988029266ce24be7fa6ca3dd94d2cdf8d460b29fe98cd1`. Round 5 supersedes its review coverage only; it does not rewrite r4.

| Finding | Disposition |
|---|---|
| `AFFA-P6-R4-BLK-001` — stale revision 111 governing a 20-slide candidate | **RESOLVED.** Revision 112 is an append-only 20-slide candidate binding, carries the human direction, binds the r5 manifest, and keeps `phase6ApprovalClaimed: false`. |
| `AFFA-P6-R4-MAJ-001` — APIM Standard v2/PremiumV2 cost contradiction | **RESOLVED.** Phase 5 r7 parameter files use `skuName: 'PremiumV2'`, capacity `1` in dev, test and production; the r5 pricing snapshot uses one West Europe Premium v2 primary meter at `3.83562 USD/hour`. Standard v2 is retained only as an explicit prior/upstream variance. |
| `AFFA-P6-R4-MIN-001` — undisclosed PDF producer marker | **RESOLVED.** The r5 receipt discloses `/Producer(MuPDF 1.29.0)`, blank parsed fields, zero XMP, zero attachments, no local identity markers and deterministic image-only assembly. |

## Findings

### MINOR — `AFFA-P6-R5-MIN-001` — stale “live rates” wording remains in deck metadata

`deck/deck.config.js` and the built `deck/dist/assets/index-v7cT-W1l.js` still contain the metadata phrase `slide-17 combines live Azure Retail Prices API rates`, while the visible cost slide, Markdown, HTML, pricing snapshot and evidence correctly describe a dated 2026-08-10 West Europe public-PAYG snapshot and display `DATED API SNAPSHOT`.

This is a bounded source/export parity and truthfulness gap: it does not change the displayed Premium v2 values or the arithmetic, but a metadata consumer could read the package as asserting live-rate behaviour rather than a frozen dated input. **Owner:** AFF-6, with AFF-0 coordinating a new candidate/revision if corrected. **Action:** replace the stale metadata wording with dated-snapshot wording and regenerate the affected dist artifacts and manifest; any such change requires a new AFF-A/AFF-B review. The immutable r5 subject is not modified by this review.

## Confirmed controls and independent checks

- Revision 112 sufficiently governs the 20-slide candidate without claiming Phase 6 approval; the candidate, approval, deployment, runtime, inference, promotion, benefit, certification and production-readiness boundaries are explicit and fail closed.
- Full subject review covered **20 slides**, **38 material claims**, **69 source references**, all five claim classes, speaker notes, exact paths, and the Markdown/HTML/catalogue/deck order. Local source references resolved; no missing source path was found.
- Deck import order and catalogue order match all 20 slide components. Manifest role counts match: 107 presentation-source, 22 presentation-export, 3 diagram, 2 test, 1 tooling, 17 evidence, 1 catalogue, 1 rendered HTML and 1 authoritative Markdown.
- Phase 5 r7 wording is consistent: **124 deployable source files**, **17 deployable units**, **10/10 local validation steps**, and **5 + 8** work packages. No deployment or runtime result is claimed.
- APIM cost basis is consistent across the cost source, slide, Markdown, HTML, catalogue, snapshot and current Phase 5 package: one Premium v2 unit, West Europe primary meter, `3.83562 USD/hour`, 730-hour month. Standard v2 is explicitly labelled as the upstream variance only.
- Arithmetic independently recomputes to `$7,985.55/month`, `$95,826.60/year` and `$17,157.77` annual comparator gap, displayed as approximately `$8.0K`, `$95.8K` and `$17.2K`. The snapshot records the same totals and excludes taxes, support, discounts and negotiated terms. The `+60%` comparator badge is explicitly mock/human-owned, not presented as a derived customer quote.
- The visible `LIVE API RATES` treatment was replaced by `DATED API SNAPSHOT`; the metadata residue is the sole new finding.
- PDF receipt and bytes agree: 20 pages, 960×600 points, deterministic two-run assembly, blank/null document-info values, no XMP, no attachments, no local identity markers, and the disclosed non-sensitive MuPDF producer marker.
- Browser evidence records 60 slide/mode combinations (20 × reference-mono/system/reduced-motion), all zero overflow/clipping/collision/console/page findings; determinism reports three matching runs. Network evidence is local-only (10 successful 2xx/3xx requests, zero external and zero failed), static scan reports 21 production files, no source maps, no external CSS dependencies and no missing local dependencies.
- External distribution remains blocked behind the explicit accountable asset-rights owner gate; no licensing or compliance conclusion is inferred. AFF-B specialist assurance was not invoked or substituted.
- No subject file was edited, rebuilt, formatted, executed, deployed, inferred against or runtime-tested. This review used read-only static inspection, byte reads and SHA-256 verification only.

## Residual gaps and boundaries

- The metadata wording finding remains open on the immutable r5 subject and must be corrected only through a new revisioned candidate if required.
- Asset rights, provider/source permissions, exact Azure regions and resource IDs, owner values, quota/capacity, recovery/retention/privacy evidence, benchmarks, regulatory classification, deployment, inference, promotion, achieved benefits and operating-effectiveness evidence remain open and fail closed as documented by the candidate.
- This record is AFF-A assurance only. It does not invoke AFF-B, approve Phase 6, waive the minor finding, certify compliance, provide legal advice or formal attestation, authorise Azure activity, authorise Phase 7/8, or claim production readiness.

## Final-round status

`finalRoundForManifest: true` is permitted by the `CONFORMS-WITH-GAPS` verdict for this unchanged r5 manifest. The minor gap is explicitly bounded for human acceptance or remediation. A human Phase 6 decision and a converged AFF-B review on the same unchanged manifest are still required before any Phase 6 gate can open. Optional Phases 7 and 8 remain separately human-invoked.

## Output records

- Review JSON: `cases/Stratton-Europe-Captital/reviews/aff-a/6/round-5/stratton-aff-a-review.json`
- Model receipt: `cases/Stratton-Europe-Captital/reviews/aff-a/6/round-5/stratton-aff-a-model-receipt.json`
- Reviewed-subject snapshot: `cases/Stratton-Europe-Captital/reviews/aff-a/6/round-5/reviewed-subject/stratton-phase-6-hashes.json`
- Hash verification receipt: `cases/Stratton-Europe-Captital/reviews/aff-a/6/round-5/reviewed-subject/stratton-phase-6-hash-verification-receipt.json`
- The verification receipt records the review JSON hash and all non-circular output hashes; it does not hash itself.
