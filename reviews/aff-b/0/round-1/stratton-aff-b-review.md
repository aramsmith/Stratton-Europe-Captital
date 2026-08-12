# AFF-B Security and Compliance Reviewer — Phase 0 round 1

| Field | Value |
|---|---|
| Case | `Stratton-Europe-Captital` |
| Artifact prefix | `stratton` |
| Reviewer | AFF-B — Security and Compliance Reviewer |
| Phase | Phase 0 — Coordinate |
| Round | 1 |
| Review time | `2026-08-01T20:13:59.594+02:00` |
| Model-plan revision | `1` |
| Canonical hash manifest | `cases/Stratton-Europe-Captital/0-coordination/stratton-phase-0-hashes.json` |
| Canonical manifest SHA-256 | `6269d6bf65933bad447996443ea38c5bc1872aa37753b6e27078b269c3ff6fec` |
| Canonical artifact count | `12` |
| Active coverage revision | `reviews/aff-b/coverage/stratton-compliance-coverage-001.json` |
| Final round for this manifest | `true` |

## Assurance status

**Verdict: CONFORMS-WITH-GAPS**

The Phase 0 subject is appropriately classified and locally governed, treats the supplied content as
untrusted source evidence rather than authority, records regulatory statements as inferred only, and
keeps privacy, security, sovereignty, architecture, control and approval claims inside the Phase 0
boundary. No `BLOCKER`, `MAJOR` or `MINOR` finding is raised.

The gaps are discovery matters already made explicit for accountable human resolution: source and
future-data retention rules, data classes and legal roles, exact regulatory applicability, and the
meaning of sovereignty. They are not confirmed obligations or accepted risks.

## Model reassessment and runtime evidence

| Item | Value |
|---|---|
| Approved AFF-B default | `gpt-5.6-sol` |
| Selected reviewer model | `gpt-5.6-sol` |
| Actual reviewer runtime model | `gpt-5.6-sol` |
| Runtime identity evidence | The task launcher exactly binds this invocation to actual model `gpt-5.6-sol`. |
| Reassessment | The approved default remains the best fit for the cross-border financial-services, AI, privacy, sovereignty, regulatory-readiness and 12-artifact evidence context. |
| Override | None; no run-scoped human model decision was required. |

## Scope and reviewed evidence

The complete canonical subject set for model-plan revision `1` was reviewed:

| Path | Role | Manifest SHA-256 |
|---|---|---|
| `0-coordination/stratton-coordination.md` | authoritative-markdown | `a18fcb950c3be5d366483825316ade18f4103812a71b649c4367c6df851899d0` |
| `0-coordination/stratton-coordination.html` | rendered-html | `0934a429cb999889667b3111e61456d2f1f92f348e3c35f0f887ff1275a8432b` |
| `0-coordination/stratton-input-inventory.json` | catalogue | `f5c71d7c8daca3f69fc4724a8ce7d7cf6813b8f75cd93c695f4d37b3f90b1f0d` |
| `0-coordination/stratton-model-plan.json` | catalogue | `5f736d8661eac6c740f1093a129f99f4ac111b41597075ee69750ef5e90beded` |
| `0-coordination/input/Case-Study-18.pdf` | evidence | `57c786e5bdfb0bfb8efec77fb7bd9839d150d3fe2e807373b22a667f7ed50e43` |
| `0-coordination/input/Case-Study-18.normalised.md` | evidence | `bc55412849f67cde3d824d050b330f6d2c459f62b6de49484ec153a1ebeb3d86` |
| `0-coordination/evidence/stratton-normalisation-validation.json` | evidence | `eef070843f2a93349b584f4ea48f1c4f7bb8601c4a00db7a880f11b0b94be24d` |
| `0-coordination/evidence/stratton-run-journal-phase-0-candidate.jsonl` | evidence | `2c317160032f7063551f8fbd743de1b34647ad47e0f9f42179393939627c9647` |
| `stratton-decisions.md` | catalogue | `bd60b72172c3f767f8f5eae165e52bf354e7fa5c24859937507154dfbce8cfca` |
| `stratton-risk-log.md` | catalogue | `70f56db3b21e4bc356b34859670ee6ea227ee9643fe6a0709eb304cf1b9e4a1f` |
| `stratton-regulatory-register.md` | catalogue | `2e7c0d468768393a32a9df2602a9ea4f2a825d21d4e9b42efd7444a34020bea7` |
| `0-coordination/evidence/stratton-hash-generation-evidence.json` | evidence | `f13efaad00fb0260d3e4d369e1723500b546aaff6cce9ea7e90f33f49eb3e40f` |

AFF-A round 2 was reviewed as assurance context. It records `CONFORMS`, final-round status `true`, and
the same canonical manifest SHA-256 and model-plan revision. The active AFF-B coverage output is
revision `001`; it is bound to that manifest hash and records zero confirmed obligation, requirement,
control or coverage mappings.

## Phase 0 assurance assessment

| Focus | Assessment | Evidence |
|---|---|---|
| Source classification | Conforms. `BUSINESS-CONFIDENTIAL` has a case-specific basis; absence of observed secrets, direct personal data and regulated records is correctly qualified. | Input inventory `classification`; coordination lines 25–28. |
| Local handling | Conforms. The governed copy and generated content are restricted to the case workspace, with explicit no-commit/no-push handling for this real case and limited reproduction. | Input inventory `classification.handling`; operating-contract case boundary. |
| Retention | Gap remains explicit. No enterprise retention period, disposal trigger or records owner is supplied; Phase 1 is tasked to establish retention and ownership rather than invent them. | `RISK-0003`; coordination data-readiness gaps and interview agenda. |
| Untrusted input | Conforms. Apparent errors and an incomplete sentence are preserved, source statements are not promoted to requirements or facts, and normalisation has retained local validation evidence. | Normalised source note; coordination lines 30–33 and 50–67; normalisation-validation record. |
| Regulatory readiness | Conforms with gaps. Five source-stated entries remain `INFERRED`; no official source, date, obligation, requirement or control is claimed, and accountable human confirmation is required. | `stratton-regulatory-register.md`; coverage revision `001`. |
| Privacy and security | Conforms for Phase 0. Unknown data classes, personal-data scope, legal roles, access, threats, audit and retention are explicitly identified for Phase 1 ownership and confirmation. | Coordination confidence table, interview agenda and `RISK-0003`. |
| Sovereignty | Conforms for Phase 0. “Sovereign” and the stated landing-zone phrase are not translated into residency, tenancy, jurisdiction or Azure control conclusions. | `RISK-0001`; coordination known fact `KF-008` and interview agenda. |
| Phase boundary | Conforms. No requirement, architecture, Azure service selection, legal obligation, control, approval, deployment, test or runtime result is asserted. | Coordination phase-boundary section; decisions record. |
| HTML safety and consistency | Conforms. The rendering is self-contained, uses inline CSS, has no script or external content dependency, and materially matches the Markdown. | `stratton-coordination.html`. |

## Confirmed obligations, requirements and controls

- Confirmed obligations: **none**.
- Confirmed security/privacy/compliance requirements: **none**.
- Confirmed controls: **none**.
- Confirmed obligation-to-requirement-to-control mappings: **zero**.

Observed Phase 0 handling safeguards are evidence practices, not approved regulatory controls.

## Inferred applicability

The source names GDPR and the EU AI Act, states SFDR reporting and AIFMD documentation contexts, and
uses the phrase “sector-specific EU Directives”. These are five source-stated applicability leads only.
Their exact instruments, jurisdictions, scope triggers, dates and obligations require official-source
research and accountable legal/compliance confirmation. Coverage revision `001` reproduces the
register state without converting any lead into a mandatory obligation.

## Findings

No findings.

## Residual risk and owner-facing proposals

| Residual gap | Owner-facing proposal | Status |
|---|---|---|
| Retention period, disposal trigger and records owner are unknown for case inputs and future datasets. | AFF-0 should carry the existing gap to AFF-1; the accountable records/privacy owner should confirm the applicable enterprise handling rule before broader ingestion. | OPEN; not accepted or waived. |
| Data classes, personal-data scope, legal roles, processing locations and transfers are unknown. | AFF-1 should obtain evidence and accountable data, privacy and security owners before requirements are confirmed. | OPEN; not accepted or waived. |
| All five regulatory leads remain inferred. | AFF-0 should update the register only after official-source research and human legal/compliance confirmation; AFF-1 should create requirements only from confirmed obligations. | OPEN; not accepted or waived. |
| “Sovereign” remains undefined. | The human architect with legal, compliance, security and platform owners should define outcomes and constraints before any design or named control is selected. | OPEN; not accepted or waived. |

## Verdict rationale and next action

`CONFORMS-WITH-GAPS` is appropriate because no demonstrable Phase 0 security defect, confirmed-obligation
breach or unsupported control claim was found, while material discovery gaps remain explicit. There is
no blocker or unresolved major.

This is the final AFF-B round for canonical manifest SHA-256
`6269d6bf65933bad447996443ea38c5bc1872aa37753b6e27078b269c3ff6fec`.
AFF-A round 2 and this review cover the same unchanged subject hashes. The human may now decide the
Phase 0 gate with the residual gaps visible. This review does not approve, waive, certify or attest the
phase and is not legal advice. Any material subject change invalidates both hash-bound reviews and
requires complete AFF-A and AFF-B re-review.
