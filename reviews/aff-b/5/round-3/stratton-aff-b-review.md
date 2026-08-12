# Stratton AFF-B review — Phase 5 — Coding round 3

**Verdict:** CONFORMS-WITH-GAPS  
**Reviewer:** AFF-B / Security and Compliance Reviewer  
**Invoked by:** AFF-5  
**Runtime model:** gpt-5.6-terra  
**Subject:** `5-coding-r5` / `e73132030070a39fbf6cf121fc8fe2988ac7a944368aa2894527bf51d506fc0f`  
**Final round for manifest:** true

## Scope and binding

This independent, read-only review supersedes AFF-B Phase 5 round 2 for the older approved `5-coding-r4` subject; round 3 covers the sibling `5-coding-r5` subject and does not alter round 2. The approved AFF-B default is `gpt-5.6-sol`; selected and actual runtime model are `gpt-5.6-terra`. AFF-5 author/finalisation model is `gpt-5.6-sol`. Separate AFF-B role, context and write boundary are established. Model-plan revision 111 is bound: `0-coordination/stratton-model-plan-revision-111.json` / `64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7`.

Pre-review manifest hash is `e73132030070a39fbf6cf121fc8fe2988ac7a944368aa2894527bf51d506fc0f`. Static recomputation matched 162/162 files: no missing or mismatched file, duplicate or malformed path; ordinal ordering, roles, UTF-8 without BOM and no trailing newline all conform. Release-manifest digest matched `154543da6430cfbbdd91352b011ceef723a370e718540413dd10a456386bf49f`. Approved r4 remains `bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626`, 155/155 matched.

Receipts: snapshot `e73132030070a39fbf6cf121fc8fe2988ac7a944368aa2894527bf51d506fc0f`; model receipt `8c383b9e8992140a8e2d5caae5be7b7190326d24b5d62979bf6688094d19e02a`; hash receipt `700ce8e56d95b7c38b6ba26fa665861d3834eb74eefabc85ef2f2b2de6658ec3`; coverage 018 `abe9b88504d5ca91dbd6297c6b1d09a35c346c87f9ec6295920d490076b1ae11`.

## Findings

| BLOCKER | MAJOR | MINOR |
|---:|---:|---:|
| 0 | 0 | 0 |

No remediation finding is raised. Existing owner-bound gates remain residual gaps rather than a package defect: the package keeps them explicit and fail closed.

## Confirmed controls

- **Secrets, identity, RBAC and exposure — CONFORMS.** `app/src/config.ts`, `infra/modules/application-platform/main.bicep`, `infra/modules/identity-rbac/main.bicep`, `infra/modules/regional-ai/main.bicep` and `infra/modules/private-endpoints/main.bicep` represent secret rejection, managed identities, disabled local/public access, internal ingress, private endpoints and scoped assignments.
- **Tenant/case and data controls — CONFORMS.** `app/migrations/001_init.sql` applies tenant/case RLS filter and block predicates; `app/src/policy-service.ts` denies unapproved source/licence/purpose/privacy/special-category paths; `app/src/logger.ts` redacts sensitive fields.
- **Routing and safety gates — CONFORMS.** `app/src/model-routing-policy.ts`, `app/src/api-runtime.ts` and `app/src/config.ts` constrain deterministic application-owned routes without model/deployment input, role-gate escalations and pin GPT-5.6 `2026-07-09`. `infra/parameters/*.bicepparam` requires `DataZoneStandard`, rejects `GlobalStandard`, sets `NoAutoUpgrade` and keeps capacities zero. `app/src/worker-main.ts` uses `BlockedAnalysisProvider`; `evidence/model-portfolio/model-portfolio-benchmark-template.json` leaves observations null and promotion blocked.
- **Integrity and supply chain — CONFORMS.** `stratton-release-manifest.json`, `evidence/dependency-evidence.json`, `evidence/source-security/20260809T151113916Z/summary.json` and `evidence/containers/20260809T151143476Z/summary.json` bind release, AVM digest, remediation and retained zero HIGH/CRITICAL/secret scan results. Licence results remain disclosure evidence only, with no compatibility conclusion.
- **Safeguards and authority — CONFORMS-WITH-GAPS.** `deploy/README.md` and `deploy/Invoke-AssuranceRetentionFinalization.ps1` require separate human Phase 7 authorisation, target binding, rollback safeguards and observed lock/legal-hold evidence. They do not authorise execution in Phase 5. No autonomous decision authority is introduced.

## Residual owner-bound gaps and evidence limits

Existing accountable owners retain region/resource/deployment identifiers, quota/capability, embedding configuration, recovery/failover, provider terms, source permissions/licences, privacy lifecycle, retention/legal hold and classification evidence. These remain unresolved, unwaived and fail closed. No Azure sign-in, target validation, what-if, deployment, provider/subscription query, model inference, promotion, retention finalisation or runtime test was performed or is claimed. No Azure or runtime operating-effectiveness evidence exists.

No legal applicability conclusion, requirement, control, waiver, owner value or certification is introduced. Inferred applicability remains governed by existing records and accountable human decisions.

## Verdict and next action

The hash-bound package **CONFORMS-WITH-GAPS**: no blocker or unresolved major exists; residual gates remain explicit and fail closed. Preserve these r5 bytes and present this review, coverage 018 and companion assurance to the human gate. Any material change requires a new subject and re-review.

This is architecture assurance, not legal advice, certification, formal attestation, waiver or approval. AFF-B does not approve Phase 5 or authorise Azure activity, deployment, retention finalisation, promotion or runtime testing.