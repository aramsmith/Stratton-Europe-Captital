# Stratton Phase 5 — Coding: AFF-A round 6 review

**Verdict: DIVERGES**  
**Reviewer:** AFF-A / Rubber Duck Reviewer  
**Invoked by:** AFF-5  
**Round:** 6  
**Reviewed:** 2026-08-09T18:09:19.702+02:00  
**Actual reviewer model:** `gpt-5.6-luna`  
**Phase 5 author/finalisation model:** `gpt-5.6-sol`  
**Independence:** `VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS`  
**Subject modified:** No  
**Final round for manifest:** No

## Scope and supersession

This is the independent static review of the complete frozen `5-coding-r6` CC-002 sibling. AFF-A round 5 remains append-only and covers superseded sibling `5-coding-r5`; this round 6 covers the append-only r6 remediation sibling and does not modify round 5. Prior review: `reviews/aff-a/5/round-5/stratton-aff-a-review.json` (SHA-256 `f614574bcc42529b26f32b1590ab690c121cfb15ec1aad10e7ace4bb367abfbe`).

## Immutable bindings and integrity

- Canonical subject: `cases/Stratton-Europe-Captital/5-coding-r6/stratton-phase-5-hashes.json`.
- Expected, pre-review and independently recomputed SHA-256: `da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33`.
- Entries: 166; all 166 files present and matching; no duplicates or path-shape violations; ordinal path ordering and roles confirmed.
- Manifest encoding: UTF-8 without BOM and no trailing newline.
- Release manifest: `stratton-release-manifest.json`, SHA-256 `88f41e40e0b1c2f7f699bd92b89d36e8d91589895012c86c4912c7247e3b9e28`.
- Reviewed snapshot is byte-identical: `reviews/aff-a/5/round-6/reviewed-subject/stratton-phase-5-hashes.json`, SHA-256 `da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33`.
- Pre/post subject status: `da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33` / `da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33` (`UNCHANGED`).

## Prior finding disposition

`AFFA-P5-R5-MAJ-001` is **RESOLVED**. Independent review confirms a pre-validation `validation-input.json`, algorithm `SHA256_UTF8_PATH_TAB_SHA256_TAB_SIZE_LF_V1`, all 123/123 input paths/hashes/sizes and aggregate `17a15d2e4d42763e98087e80c2a1be4f91bf2c3c5ec17d4ed7adb0d0c78a9d8c` propagated through step, dependency, source-security, container and release evidence. The freeze tooling recomputes and enforces the aggregate; input mutation is rejected; evidence is selected by explicit run ID/path rather than filesystem mtime; and behavioural tests cover deterministic hashing, mutation rejection, newer-decoy resistance and mismatched dependency records.

## Confirmed conformity areas

- Callers cannot select a deployment or model; routing is deterministic, application-owned and fail closed.
- `GlobalStandard` is rejected and `DataZoneStandard` is required. GPT-5.6 version `2026-07-09` and `NoAutoUpgrade` are represented.
- Production inference remains blocked by `BlockedAnalysisProvider`; benchmark observations are null and promotion is `BLOCKED_PENDING_OBSERVED_EVIDENCE`.
- No autonomous decision authority is introduced. Authority-boundary conflicts and owner-bound controls are disclosed rather than waived.
- The complete 166-file subject was reassessed; no higher-severity contradictory finding was identified.
- No Azure sign-in, provider/subscription query, target validation, what-if, deployment, inference, promotion, retention finalisation, Azure network call or runtime test is claimed in the candidate. AFF-A performed none.

## Finding summary

| Severity | Count |
|---|---:|
| BLOCKER | 0 |
| MAJOR | 1 |
| MINOR | 0 |

### AFFA-P5-R6-MAJ-001 — Operational references still select the superseded r5 subject

**Confirmed locations and selectors:**

1. `5-coding-r6/README.md:90` — “This r5 package”. The candidate self-description identifies r6 as r5.
2. `5-coding-r6/deploy/README.md:11` — “new explicit human approval for the exact r5 Phase 5 hash manifest”. Phase 7 admission can request approval of superseded r5 rather than r6.
3. `5-coding-r6/tests/iac/README.md:6` — executable command targets `cases/Stratton-Europe-Captital/5-coding-r5/tests/iac/Invoke-IaCTests.ps1`. Test execution can target superseded r5.

These are operationally stale selectors. The intentional historical provenance sentence at root README line 9 is excluded; superseded r4/r5 provenance records are not treated as current selectors.

**Owner:** AFF-5; accountable package documentation/procedure owner to be designated through the existing governance route.

**Impact:** Assurance, approval or test execution can be directed to the superseded r5 subject instead of immutable r6, despite the r6 manifest and evidence chain being internally bound.

**Required remediation:** Replace each operational selector with the exact `5-coding-r6` candidate path and r6 manifest reference; update the affected procedure and test instruction without changing the immutable subject during review; re-scan all operational references for superseded selectors, regenerate affected release/report evidence if required, and obtain fresh convergent AFF-A/AFF-B reviews against unchanged manifest `da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33`.

## Residual gaps

Exact Azure regions/resources/deployment IDs, model capability/quota and positive capacities, embedding configuration, recovery/failover evidence, provider terms/licences/source permissions, retention/legal hold/privacy lifecycle, regulatory classification, observed benchmark metrics, and AFF-B specialist licence/compliance assurance remain explicit owner-bound gaps. No owner values or approval is invented here.

## Required action and non-approval

The new major finding blocks convergence. `finalRoundForManifest=false`; the human Phase 5 gate remains locked until remediation and re-review bind the unchanged r6 manifest. AFF-A does not approve Phase 5, waive gaps, certify compliance, authorise Azure activity, authorise retention finalisation, authorise deployment or runtime testing, or provide human approval.

## Handoff and receipt links

- Pre-review handoff: `.superpowers/sdd/2026-08-06-stratton-gpt-5-6-model-portfolio/review-task-11-pre-review.md` — SHA-256 `ad806f8231772c82e32279da14635e1b1ae1cdb66265532e9b2d9dead2304423`.
- Task 11 report: `.superpowers/sdd/2026-08-06-stratton-gpt-5-6-model-portfolio/task-11-report.md` — SHA-256 `cdc88d901a5c0e0b8de867c850d91f288c3dd3fff0cf6416a529b5dbc94d430c`.
- Prior AFF-A round 5 review — SHA-256 `f614574bcc42529b26f32b1590ab690c121cfb15ec1aad10e7ace4bb367abfbe`.
- Model receipt: `stratton-aff-a-model-receipt.json` — SHA-256 `f0e0d69c7b087f0a105b97d86c8b6156c8452e9659b5652fa3471c8304e64b5e`.
- Hash verification receipt: `reviewed-subject/stratton-phase-5-hash-verification-receipt.json` — SHA-256 `ab4a37953001ff412ac55e9ab0b15a634207ed757b895192b7713c4561d2d25e`.
- Manifest snapshot: `reviewed-subject/stratton-phase-5-hashes.json` — SHA-256 `da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33`.
