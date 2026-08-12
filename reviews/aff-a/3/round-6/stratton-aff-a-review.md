# Stratton AFF-A review — Phase 3 — Azure Design round 6

**Change control:** `STRATTON-CC-002`  
**Verdict:** `DIVERGES`  
**Review time:** `2026-08-06T08:48:55.629+02:00`  
**Reviewer runtime:** `gpt-5.6-luna`; author runtime `gpt-5.6-sol`  
**Independence:** `VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS`  
**Invoked by:** `AFF-3`  
**Subject modification performed:** `false`

## Independent verification

- Model plan: `cases/Stratton-Europe-Captital/0-coordination/stratton-model-plan-revision-111.json` / `64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7`.
- Candidate manifest: `cases/Stratton-Europe-Captital/3-azure-design/stratton-phase-3-hashes-cc-002-proposed.json`.
- Manifest SHA-256 before and after review: `2184986970076bb5317c31459e335d1e9272973411c3e3d14a1886102b07214a` / `2184986970076bb5317c31459e335d1e9272973411c3e3d14a1886102b07214a` (`UNCHANGED`).
- Manifest entries: `10`; candidate files copied and verified: `11`.
- Hash receipt: `reviews/aff-a/3/round-6/reviewed-subject/stratton-phase-3-hash-verification-receipt.json` / `7f36600c88768e26ae50ca8be201c6e1c3959b15b623fdd66d0f391133279a06`.
- Reviewer model receipt: `reviews/aff-a/3/round-6/stratton-aff-a-model-receipt.json` / `6f16aa0d5db9bcee0ff1e455f3ece9e1b6fd4e7986558e593dfdd8e8bfad6c36`.
- Reviewed subject was not modified.

## Confirmed items

- All eleven candidate files were copied byte-identically into reviewed-subject; all JSON candidate documents parse and the HTML parses as a document.
- The proposed manifest contains ten non-self entries; all ten declared digests recompute and match. The manifest digest is recomputed as 2184986970076bb5317c31459e335d1e9272973411c3e3d14a1886102b07214a before and after review.
- Model-plan revision 111 recomputes to 64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7 and the author actual runtime is gpt-5.6-sol.
- Reviewer actual runtime is gpt-5.6-luna and differs from the author actual runtime; independence is verified.
- Markdown and HTML headings match 13/13; HTML has no external script source and includes responsive/print styling.
- The candidate retains explicit no-deployment, no-approval, no-certification, no-specific-processing-region and blocked-promotion boundaries.
- Fixed model IDs, versions, interfaces, API versions, capability fields, route allow-lists, owner-bound capacity, fail-closed substitution and human authority are present.

## Findings

| ID | Severity | Required action |
|---|---|---|
| `AFFA-P3-R6-MAJ-001` | `MAJOR` | Add explicit blocking security-evaluation gates with required pass criteria, evidence IDs and fail-closed handling for every listed security scenario; bind the same criteria in the evaluation, routing and security contracts before promotion. |
| `AFFA-P3-R6-MAJ-002` | `MAJOR` | Define the primary/recovery deployment and failover semantics for all GPT and embedding routes, approved geography and resource allow-list evidence, data/log/index/backup handling, provider-selected processing-region boundary, and deny/queue behaviour when recovery evidence is missing; bind these as testable contract fields. |
| `AFFA-P3-R6-MAJ-003` | `MAJOR` | Add a CC-002 source-binding record (or equivalent fields) with claim IDs, exact URL and section, retrieval date, supporting evidence excerpt/hash and disposition for every material provider/model/sovereignty/security assertion; bind it into the candidate manifest and change-control evidence. |
| `AFFA-P3-R6-MIN-001` | `MINOR` | Regenerate the HTML companion so every substantive Markdown table row and decision is represented without omission; regenerate the candidate manifest afterwards. |


### AFFA-P3-R6-MAJ-001 — Security evaluation scenarios are not explicit blocking promotion criteria

The evaluation contract lists security scenarios and records them as measured evidence, but `promotionGates` contains only EVAL-001 through EVAL-010 and `requiredEvidence` does not define pass/fail criteria. The security contract calls the same tests promotion gates. This leaves promotion semantics internally inconsistent and permits evidence without a blocking outcome.

### AFFA-P3-R6-MAJ-002 — EU Data Zone and two-region recovery semantics are not concretely bound

The amendment carries forward a two-region recovery pattern and makes exact primary/recovery locations owner inputs, but does not bind per-tier recovery deployments, failover routing, recovery data/index/log/backup boundaries, or the fail-closed condition when recovery provider evidence is missing. This is unresolved by the required sovereignty reconciliation.

### AFFA-P3-R6-MAJ-003 — Material source claims lack precise, claim-bound traceability

The portfolio and security contracts contain bare source URLs, without source IDs, sections, dates, excerpts/hashes or claim bindings. The existing source register is not extended by the candidate. Material Data Zone, model, API, capability and security claims therefore cannot be audited at the required precision.

### AFFA-P3-R6-MIN-001 — HTML does not reproduce every substantive Markdown table row

Headings match 13/13, but Markdown section 6 separates the explainable anomaly challenger from supervised prediction while HTML merges them and drops the explicit governed-gradient-boosted and labelled-outcome boundary. The HTML companion must be regenerated for faithful table parity.

## Verdict rationale

Three unresolved MAJOR findings yield `DIVERGES`; the MINOR parity finding remains open. `finalRoundStatus` is `false`. This review does not approve, certify, waive, deploy, test, or authorise the candidate.

## Required action

Do not approve or promote the unchanged candidate. Preserve this review, create an append-only remediation revision and new manifest, and repeat complete AFF-A/AFF-B review.

## Residual gaps and concerns

Owner-bound region, capacity, quota, reasoning, benchmark, provider, retention and classification inputs remain fail-closed. AFF-B review and explicit human approval remain pending. Concerns: regional recovery binding; source traceability; explicit blocking security-evaluation criteria; Markdown/HTML parity.
