# AFF-B Security and Compliance Review

**Phase:** Phase 6 — C-level Presentation  
**Round:** 2  
**Verdict:** **CONFORMS-WITH-GAPS**  
**Findings:** BLOCKER 0 · MAJOR 0 · MINOR 0  
**Reviewed:** 2026-08-03T12:03:05.127+02:00

## Assurance boundary

Specialist architecture assurance only. This is not legal advice, certification, attestation, waiver, approval, a licensing conclusion, deployment authorisation, Azure validation, runtime assurance or operating-effectiveness evidence. AFF-B used `gpt-5.6-sol` in a separate specialist context and write boundary from the author; no model-ID independence is claimed because the exact model ID is the same.

## Subject integrity

- Manifest: `6-presentation-r3/stratton-phase-6-hashes.json`
- SHA-256 pre/post: `c59220ac2d551c11c40aeb5fe49b8b4253dcffaf49f1a9c2d086e39e439d6606` — unchanged
- Artifacts: 95/95 recomputed and matched
- Final AFF-A round 3: `8c542720f995a9a5b3b35a520b5bc84e4cbd718ae13becfdcc1e5729dd3ab7cb` — `CONFORMS`
- Coverage 011: `8936b09ba1bbb0277479ee7f1b3127c7372227a98fa6856697a461e77b83e264` — `ACTIVE_PHASE6_REVISION3_CONVERGED_AFF_B_ROUND2_HUMAN_GATE_PENDING`
- Preserved unchanged: r1 `b714ba7860570b4cc166dc6741a0f1ef3825a679b3790c6337dae7e05f748951`, r2 `a9116def3c48fa1c2769d7635178201bdfab35fba5ac92fcf93e5d13d15c8b5f`, AFF-B round 1 `5db090b60e348014ed8365399a106587fd68d26f80c04a25240a13e46877d27d`, coverage 010 `f141e2cbe2d8bad4a46ea28a71a62f3538547147c665f29eb7d3a55dabed4382`

## Prior finding dispositions

### AFFB-P6-R1-MAJ-001 — resolved without waiver

The source system-font override and reproducible `build-portable-hardened.mjs` workflow require no new dependency and no engine or `node_modules` modification. Final CSS has zero external `@import`/`url()` dependencies. Recursive inspection covers 18 production files with zero external dependencies or source maps. The ten-slide nested network receipt records eight successful local calls, zero external calls and zero failures. The evidence truthfully distinguishes 71 production-inert library/engine URL strings from observed calls and makes no licensing or universal reachability claim.

### AFFB-P6-R1-MIN-001 — resolved without waiver

Export evidence uses case-relative paths. `deck/deck.pdf` is ten pages at SHA-256 `7871128d05df9e5d78a8552d44f9bad475cd467f40759cbd2d79eaaf1ef0faf0` and contains no Info/XMP metadata or unnecessary local/platform/path values. The sanitiser derives identity/profile/workspace checks dynamically, retains no pre-sanitisation metadata values, and the candidate-wide 121-file disclosure scan records zero findings.

## Assessment

- Claims, 32 classifications and 66 sources remain evidence-bound and caveated.
- No fabricated ROI, Azure price, rate, cost total, realised benefit, certification, deployment, runtime validation or operating-effectiveness claim was found.
- Three authority conflicts, fourteen owner-bound controls and two retained AFF-B minor gaps remain explicit, unwaived and fail closed.
- No customer logo or external imagery was found. Source, package, favicon and branding rights remain human-owner gates; no licensing conclusion is made.
- No new Phase 6 security/compliance finding was introduced by revision 3.

## Residual risk and applicability

GDPR remains human-confirmed with detailed citations open under `AFFB-RES-002`; EU AI Act classification remains open under `AFFB-RES-001`; SFDR and AIFMD remain human-confirmed conditional; DORA remains inferred conditional under `VAL-001`. `VAL-001–005`, `AFFB-RES-001–002`, `CC1-OWN-001–007`, `AFFB-CC001-R2-MIN-001` and `AFFB-CC001-R3-MIN-002` remain open as previously recorded. Coverage 011 adds no law, requirement or owner and claims no runtime operating effectiveness.

## Human gate

The unchanged revision-3 subject may now be presented with final AFF-A, final AFF-B, coverage 011 and residual gaps for an explicit in-tool human Phase 6 decision. **Phase 6 is not approved.** Any material change requires new reviews. Phases 7 and 8 remain unauthorised.
