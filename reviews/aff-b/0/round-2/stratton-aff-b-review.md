# AFF-B Security and Compliance Reviewer — Phase 0 round 2

| Field | Value |
|---|---|
| Case | `Stratton-Europe-Captital` |
| Artifact prefix | `stratton` |
| Reviewer | AFF-B — Security and Compliance Reviewer |
| Phase | Phase 0 — Coordinate |
| Round | `2` |
| Review time | `2026-08-01T20:18:07.818+02:00` |
| Model-plan revision | `1` |
| Canonical manifest | `cases/Stratton-Europe-Captital/0-coordination/stratton-phase-0-hashes.json` |
| Canonical manifest SHA-256 | `6269d6bf65933bad447996443ea38c5bc1872aa37753b6e27078b269c3ff6fec` |
| Canonical artifact count | `12` |
| Active coverage revision | Sequence `001` — `cases/Stratton-Europe-Captital/reviews/aff-b/coverage/stratton-compliance-coverage-001.json` |
| Active coverage SHA-256 | `e40486cc167759c93868283c10a0c55d096d989282da492ce9a75981955ef2f3` |
| Superseded review | [Round 1](../round-1/stratton-aff-b-review.md) |
| Final-round status | `FINAL_FOR_UNCHANGED_MANIFEST` |

## Assurance status

**Verdict: CONFORMS-WITH-GAPS**

The unchanged Phase 0 subject appropriately classifies and locally governs the source, treats it as
untrusted evidence, records regulatory leads as inferred only, and avoids unsupported privacy,
security, sovereignty, control or approval claims. No `BLOCKER`, `MAJOR` or `MINOR` finding is raised.

Open retention, data, legal-role, regulatory-applicability and sovereignty questions remain visible
for accountable human resolution. They are neither confirmed obligations nor accepted or waived
risks. This record supersedes round 1 only to complete the review evidence binding; the subject,
manifest, model plan, coverage revision and verdict are unchanged.

## Model reassessment and runtime binding

| Item | Assessment |
|---|---|
| Approved AFF-B default | `gpt-5.6-sol` |
| Selected model | `gpt-5.6-sol` |
| Actual runtime model | `gpt-5.6-sol` |
| Runtime evidence | The task launcher exactly binds this invocation to actual model `gpt-5.6-sol`. |
| Complexity reassessment | Regulatory and security complexity are high because the source concerns cross-border financial services, AI, privacy and sovereignty; evidence complexity is moderate-to-high across 12 canonical artifacts plus assurance context; the context remains tractable. |
| Selection rationale | The approved default remains best suited to architecture-assurance synthesis across this evidence and regulatory-readiness context. |
| Override | None. No run-scoped model change or human override decision was required. |

## Canonical reviewed evidence context

| Record | Path | Sequence / round | SHA-256 or binding |
|---|---|---|---|
| Canonical subject manifest | `cases/Stratton-Europe-Captital/0-coordination/stratton-phase-0-hashes.json` | Revision `1`; 12 artifacts | `6269d6bf65933bad447996443ea38c5bc1872aa37753b6e27078b269c3ff6fec` |
| Active append-only coverage | `cases/Stratton-Europe-Captital/reviews/aff-b/coverage/stratton-compliance-coverage-001.json` | Sequence `001` | `e40486cc167759c93868283c10a0c55d096d989282da492ce9a75981955ef2f3` |
| AFF-A final review | `cases/Stratton-Europe-Captital/reviews/aff-a/0/round-2/stratton-aff-a-review.json` | Round `2` | Binds the same manifest SHA-256 and model-plan revision; verdict `CONFORMS`; final for the manifest. |
| Prior AFF-B review | `cases/Stratton-Europe-Captital/reviews/aff-b/0/round-1/stratton-aff-b-review.json` | Round `1` | Superseded by this completeness-correction record; subject verdict was `CONFORMS-WITH-GAPS`. |

Coverage sequence `001` is review evidence outside the 12-artifact subject manifest. It remains
unchanged and active; this review neither replaces nor edits it.

## Complete canonical subject reviewed

| Path | Role | Manifest SHA-256 | Inspection |
|---|---|---|---|
| `0-coordination/stratton-coordination.md` | authoritative-markdown | `a18fcb950c3be5d366483825316ade18f4103812a71b649c4367c6df851899d0` | Content and Phase 0 boundary reviewed. |
| `0-coordination/stratton-coordination.html` | rendered-html | `0934a429cb999889667b3111e61456d2f1f92f348e3c35f0f887ff1275a8432b` | Self-contained safety and Markdown consistency reviewed. |
| `0-coordination/stratton-input-inventory.json` | catalogue | `f5c71d7c8daca3f69fc4724a8ce7d7cf6813b8f75cd93c695f4d37b3f90b1f0d` | Classification, handling, provenance and normalisation link reviewed. |
| `0-coordination/stratton-model-plan.json` | catalogue | `5f736d8661eac6c740f1093a129f99f4ac111b41597075ee69750ef5e90beded` | Active revision and AFF-B assignment reviewed. |
| `0-coordination/input/Case-Study-18.pdf` | evidence | `57c786e5bdfb0bfb8efec77fb7bd9839d150d3fe2e807373b22a667f7ed50e43` | Governed binary binding reviewed through the inventory, normalised counterpart and retained validation evidence. |
| `0-coordination/input/Case-Study-18.normalised.md` | evidence | `bc55412849f67cde3d824d050b330f6d2c459f62b6de49484ec153a1ebeb3d86` | Complete normalised content reviewed. |
| `0-coordination/evidence/stratton-normalisation-validation.json` | evidence | `eef070843f2a93349b584f4ea48f1c4f7bb8601c4a00db7a880f11b0b94be24d` | Extraction and local visual-comparison evidence reviewed. |
| `0-coordination/evidence/stratton-run-journal-phase-0-candidate.jsonl` | evidence | `2c317160032f7063551f8fbd743de1b34647ad47e0f9f42179393939627c9647` | Immutable candidate lifecycle snapshot reviewed. |
| `stratton-decisions.md` | catalogue | `bd60b72172c3f767f8f5eae165e52bf354e7fa5c24859937507154dfbce8cfca` | Confirmed decisions and absence of architecture or regulatory approval reviewed. |
| `stratton-risk-log.md` | catalogue | `70f56db3b21e4bc356b34859670ee6ea227ee9643fe6a0709eb304cf1b9e4a1f` | Six open risks, ownership and treatments reviewed. |
| `stratton-regulatory-register.md` | catalogue | `2e7c0d468768393a32a9df2602a9ea4f2a825d21d4e9b42efd7444a34020bea7` | Five inferred entries and confirmation boundaries reviewed. |
| `0-coordination/evidence/stratton-hash-generation-evidence.json` | evidence | `f13efaad00fb0260d3e4d369e1723500b546aaff6cce9ea7e90f33f49eb3e40f` | Hash-generation scope and values reviewed. |

The invocation states that the manifest and all listed hashes remain matched. AFF-A round 2 also
records retained dual-tool verification of this same manifest and all 12 entries.

## Phase 0 assurance assessment

| Focus | Status | Evidence and conclusion |
|---|---|---|
| Source classification | `CONFORMS` | `BUSINESS-CONFIDENTIAL` has a case-specific basis. The absence of observed secrets, direct personal data and regulated records is expressly limited to the supplied document. |
| Local handling | `CONFORMS` | The inventory requires case-local storage, no commit or push for this real case, and limited reproduction. |
| Retention | `GAP_RECORDED` | No enterprise period, disposal trigger or records owner is supplied. `RISK-0003` and the Phase 1 agenda carry the question without inventing a rule. |
| Untrusted input | `CONFORMS` | Source errors and incomplete wording are preserved; source statements are not promoted to approved facts or requirements; validation evidence is retained. |
| Regulatory readiness | `CONFORMS-WITH-GAPS` | Five source-stated leads remain `INFERRED`; official sources, dates, obligations, requirements and controls are not asserted. Human legal/compliance confirmation is required. |
| Privacy and security | `CONFORMS_FOR_PHASE_0` | Unknown data classes, personal-data scope, legal roles, access, threats, audit, retention, locations and transfers are explicit Phase 1 discovery items. |
| Sovereignty | `CONFORMS_FOR_PHASE_0` | “Sovereign” is not converted into residency, tenancy, jurisdiction or named Azure control conclusions. |
| Phase boundary | `CONFORMS` | No requirement, architecture, service selection, legal obligation, control, approval, deployment, test or runtime outcome is asserted. |
| HTML safety | `CONFORMS` | The subject HTML is self-contained, uses inline CSS, contains no scripts or external content dependencies, and materially matches the authoritative Markdown. |

## Coverage, confirmed controls and inferred applicability

- Confirmed obligations: **none**.
- Confirmed security, privacy or compliance requirements: **none**.
- Confirmed controls: **none**.
- Confirmed obligation-to-requirement-to-control mappings: **zero**.

Starting from no assumed regulation, the source yields five leads only: GDPR, EU AI Act, EU SFDR,
AIFMD, and an unidentified “sector-specific EU Directives” phrase. Coverage revision `001` records
each as `INFERRED`, with exact scope triggers, official sources, dates and extracted obligations still
unconfirmed. No lead is mandatory until the accountable human legal/compliance owner confirms it.

## Findings

No findings.

## Residual risk and owner-facing proposals

| Residual gap | Owner and proposal | Status |
|---|---|---|
| Retention period, disposal trigger and records owner are unknown for case inputs and future datasets. | AFF-0 should carry the existing gap to AFF-1; the accountable records/privacy owner should confirm the enterprise handling rule before broader ingestion. | `OPEN_NOT_ACCEPTED_OR_WAIVED` |
| Data classes, personal-data scope, legal roles, processing locations and transfers are unknown. | AFF-1 should obtain evidence from accountable data, privacy and security owners before confirming requirements. | `OPEN_NOT_ACCEPTED_OR_WAIVED` |
| All five regulatory leads remain inferred. | AFF-0, as register custodian, should record only approved evidence-backed updates after official-source research and accountable human confirmation; AFF-1 should derive requirements only from confirmed obligations. | `OPEN_NOT_ACCEPTED_OR_WAIVED` |
| “Sovereign” remains undefined. | The human architect with accountable legal, compliance, security and platform owners should define outcomes and constraints before design or named-control selection. | `OPEN_NOT_ACCEPTED_OR_WAIVED` |

## Verdict rationale, final status and next action

`CONFORMS-WITH-GAPS` remains appropriate: no demonstrable Phase 0 security defect, breach of a
confirmed obligation or approved requirement, or unsupported control claim was found, while material
discovery gaps remain explicit. There is no blocker or unresolved major.

This is the final AFF-B review for the unchanged canonical manifest identified above. It covers the
same subject hashes and model-plan revision as AFF-A final round 2. The phase owner may present both
reviews and the residual gaps for the explicit human Phase 0 decision. This review does not approve,
waive, certify or attest the phase and is not legal advice. Any material subject change invalidates
the hash-bound final reviews and requires complete AFF-A and AFF-B re-review.
