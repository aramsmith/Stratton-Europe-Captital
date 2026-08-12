# Stratton AFF-B review — Phase 5 — Coding round 4

**Verdict:** CONFORMS-WITH-GAPS  
**Reviewer:** AFF-B / Security and Compliance Reviewer  
**Runtime model:** GPT-5.6 Terra (`gpt-5.6-terra`)  
**Subject:** `5-coding-r6` / `da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33`  
**Final round for manifest:** true

## Scope, separation and integrity

This independent, read-only assurance review supersedes and links AFF-B round 3 for r5 without modifying it. AFF-B selected and actually ran as `gpt-5.6-terra`; implementation/finalisation used `gpt-5.6-sol`, establishing exact-model separation. Model-plan revision 111 is bound.

The supplied handoff (`ad806f8231772c82e32279da14635e1b1ae1cdb66265532e9b2d9dead2304423`) and report (`cdc88d901a5c0e0b8de867c850d91f288c3dd3fff0cf6416a529b5dbc94d430c`) matched. r5 round 3 (`63e422fa708fce1c30f1739b9d0a539d2b435110b7be9cb724dc5a799a1525a7`) and coverage 018 (`abe9b88504d5ca91dbd6297c6b1d09a35c346c87f9ec6295920d490076b1ae11`) remain preserved.

Pre- and post-output canonical checks matched `da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33`: 166/166 entries, zero missing, mismatched or duplicate paths, ordinal ordering, valid paths, UTF-8 without BOM and no trailing manifest newline. The r6 release manifest matched `88f41e40e0b1c2f7f699bd92b89d36e8d91589895012c86c4912c7247e3b9e28`.

## Evidence-chain reassessment

No security or compliance finding is introduced by or remains in the r6 evidence chain. The pre-validation input manifest is explicitly run-bound to `20260809T154227203Z`; its 123 paths, hashes and sizes independently recomputed to `17a15d2e4d42763e98087e80c2a1be4f91bf2c3c5ec17d4ed7adb0d0c78a9d8c` using `SHA256_UTF8_PATH_TAB_SHA256_TAB_SIZE_LF_V1` and exactly match the 123-entry release source inventory. The validation index, nine step records, dependency evidence, source-security summary, container summary and release records bind the same aggregate (14 independently checked binding records; zero mismatch).

`ValidationEvidence.psm1`, release generation and all three freeze steps recompute and reject input mutation or binding mismatch. Selection is by the exact run ID and normalised paths, not filesystem mtime. Behavioural coverage verifies deterministic aggregation, mutation rejection, newer-decoy resistance and mismatched dependency-record rejection. The only timestamp use found is the test-created decoy, not a selector.

## Security, privacy and supply-chain controls

- **Identity, secrets and network — CONFORMS.** Static evidence represents secret rejection, managed identities, scoped RBAC, disabled local/public access and private endpoints. No hard-coded credential pattern was found in packaged application sources; source scan reports zero secrets and zero HIGH/CRITICAL vulnerabilities or misconfigurations.
- **Data protection — CONFORMS.** Tenant/case RLS, fail-closed source/licence/privacy/special-category admission and sensitive-field log redaction are represented.
- **Model, residency intent and authority — CONFORMS-WITH-GAPS.** Callers cannot select a deployment or model. Routing is deterministic, application-owned and fail closed. `DataZoneStandard` is required; `GlobalStandard` is rejected; GPT-5.6 is pinned to `2026-07-09` with `NoAutoUpgrade`. Production capacity is zero, `BlockedAnalysisProvider` blocks analysis, benchmark observations are null and promotion remains `BLOCKED_PENDING_OBSERVED_EVIDENCE`; autonomous decision authority is none.
- **Supply chain and release — CONFORMS-WITH-GAPS.** Retained source and container evidence reports zero HIGH/CRITICAL/secret findings. API and worker evidence is bound to the exact run; local signing is explicitly non-deployable integrity evidence. Licence results remain owner-bound review evidence, not a compatibility conclusion.

## Findings and residual gaps

| BLOCKER | MAJOR | MINOR |
|---:|---:|---:|
| 0 | 0 | 0 |

Residual owner-bound gaps remain: exact regions/resources/quotas/capabilities, embedding, recovery/failover, provider terms, licences/source permissions, privacy lifecycle, retention/legal hold, classification/applicability and observed benchmarks. They are not waived or resolved; the package remains fail closed. No legal conclusion, owner value, requirement or waiver is introduced.

No Azure sign-in, provider/subscription query, target validation, what-if, deployment, inference, promotion, retention finalisation, Azure network call or runtime test occurred or is claimed. This review is architecture assurance only—not legal advice, certification, attestation, approval or Azure authorisation.

## Verdict and next action

The unchanged r6 package **CONFORMS-WITH-GAPS**. No blocker or major remains; coverage 019 supersedes 018. Preserve the subject bytes and present both final assurances and unresolved owner gates to the explicit human gate. AFF-B does not approve Phase 5.
