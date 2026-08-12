# AFF-A Review — Phase 1 — Requirements — Round 1

**Case:** `Stratton-Europe-Captital`  
**Artifact prefix:** `stratton`  
**Review time:** `2026-08-01T21:13:18.187+02:00`  
**Model-plan revision:** `1`  
**Reviewer actual model:** `gpt-5.5`  
**Phase author actual model:** `gpt-5.6-sol`  
**Canonical manifest:** `cases/Stratton-Europe-Captital/1-requirements/stratton-phase-1-hashes.json`  
**Canonical manifest SHA-256:** not independently recomputed in this runtime  
**Verdict:** `DIVERGES`  
**Final round for this manifest:** `true`

AFF-A does not approve Phase 1.

## Summary

The requirements content is largely coherent, traceable to confirmed interview decisions, bounded to Phase 1, and avoids architecture, deployment, runtime-result and approval claims. However, this round diverges because independent SHA-256 recomputation could not be completed, the interview evidence contains contradictory open-item state, the active model-plan record does not clearly carry the Phase 1 authoring reassessment, and shared regulatory/risk records remain stale against Phase 1 confirmed decisions.

## Findings

| ID | Severity | Title |
|---|---|---|
| STRATTON-P1-AFFA-R1-BLOCKER-001 | BLOCKER | Canonical manifest and listed subject SHA-256 values were not independently recomputable in this review runtime |
| STRATTON-P1-AFFA-R1-MAJOR-001 | MAJOR | Interview decision record retains contradictory OPEN openItems after declaring the interview closed with no material decisions pending |
| STRATTON-P1-AFFA-R1-MAJOR-002 | MAJOR | Active model plan does not clearly record Phase 1 authoring reassessment in the required model-plan record |
| STRATTON-P1-AFFA-R1-MAJOR-003 | MAJOR | Shared regulatory and risk records remain stale after Phase 1 confirmed decisions that the candidate uses as requirements evidence |

## Required action

Do not seek human Phase 1 approval on this AFF-A result. Remediate the findings, regenerate affected artifacts and canonical hashes, then re-invoke AFF-A over the complete final set. AFF-B must cover the identical unchanged manifest before any human gate can open.
