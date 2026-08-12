# Phase 0 — Coordinate: Stratton Europe Capital

**Case name:** `Stratton-Europe-Captital`  
**Artifact prefix:** `stratton`  
**Candidate status:** Awaiting assurance review and explicit human Phase 0 decision  
**Model-plan revision:** `1`

## Executive position

The supplied two-page case study is readable, copied into governed evidence, faithfully normalised,
classified, and hashed. It describes a desired sovereign, AI-enabled investment-intelligence
transformation but is not sufficient to establish approved requirements, regulatory obligations,
architecture, Azure service choices, delivery scope, or acceptance measures.

Phase 0 has not deployed, accessed Azure, tested a runtime, or approved any phase. Phase 1 may start
only after converged final reviews and explicit human approval in this interaction.

## Source readiness and handling

| Source | Readiness | Governed evidence | SHA-256 |
|---|---|---|---|
| `Case-Study-18.pdf` | READABLE; 2 pages; no OCR required | `input/Case-Study-18.pdf` | `57c786e5bdfb0bfb8efec77fb7bd9839d150d3fe2e807373b22a667f7ed50e43` |
| Normalised rendering | READABLE; headings, prose, lists, tables, and page boundary retained | `input/Case-Study-18.normalised.md` | `bc55412849f67cde3d824d050b330f6d2c459f62b6de49484ec153a1ebeb3d86` |

The source is classified **BUSINESS-CONFIDENTIAL** because it names an organisation and states
investment-management scale, operational performance, regulatory context, transformation goals, and
intended technology. No secrets, credentials, direct personal data, or regulated records were
observed in this document; that does not establish the classification of future datasets.

Normalisation omitted only decorative colours, rules, exact spacing, and page layout. The apparent
source errors and incomplete transformation-objective bullet were preserved rather than silently
corrected. Full provenance and conversion detail are in `stratton-input-inventory.json`; retained
validation evidence is in `evidence/stratton-normalisation-validation.json`.

## Model assignments

All phase owners and reviewers reassessed task fit for this case. Approved defaults remain selected;
no run-scoped override or model-related human decision is proposed.

| Scope | Selected exact model | Current Phase 0 use |
|---|---|---|
| AFF-0, AFF-1, AFF-2, AFF-3, AFF-4, AFF-6, AFF-7, AFF-B | `gpt-5.6-sol` | Coordination authoring; planning consultations only for other owners |
| AFF-5, AFF-8 | `gpt-5.3-codex` | Planning consultations only |
| AFF-A | `gpt-5.5` | Independent Phase 0 review; exact task binding differs from AFF-0 `gpt-5.6-sol` |

Each later phase must reassess and record its actual authoring runtime at entry. AFF-7 and AFF-8
consultations did not invoke those optional phases or authorise execution. The complete active plan is
`stratton-model-plan.json`, revision `1`.

## Evidence-backed known facts

The following are source statements, not approved requirements or independently verified facts:

| ID | Source statement | Evidence |
|---|---|---|
| KF-001 | The named fund is based in Vienna, reports €18 billion AUM, and manages 34 portfolio companies across Central Europe. | Source page 1, Business Challenge |
| KF-002 | The stated operating region is Austria, Germany, Switzerland, Czech Republic, and Hungary; headquarters are stated as Austria. | Source page 1, case profile |
| KF-003 | Current due diligence is stated as taking 12 weeks and consuming 60% of deal-team capacity. | Source page 1, Business Challenge |
| KF-004 | Portfolio monitoring is stated as quarterly and manual, without real-time signals. | Source page 1, Business Challenge |
| KF-005 | The source states ESG data arrives from 34 portfolio companies in inconsistent formats and associates this with SFDR reporting. | Source page 1, Business Challenge |
| KF-006 | The source states Luxembourg-based fund vehicles require AIFMD compliance documentation. | Source page 1, Business Challenge |
| KF-007 | The current solution is stated to be legacy on-premises. | Source page 1, Transformation Objective |
| KF-008 | The desired platform is described as sovereign and required to land in an “Azure Sovereign Landing zone”. | Source page 1, Transformation Objective |
| KF-009 | The source lists Azure OpenAI, Azure Machine Learning, Microsoft Fabric, Azure Synapse Analytics, Microsoft Purview, Azure Confidential Computing, Power BI, Azure API Management, and Dynamics 365. No selection rationale or approval is supplied. | Source page 1, Azure Services |
| KF-010 | Desired outcomes include a 12-to-3-week due-diligence cycle, fully automated SFDR reporting, a 40% increase in deal-sourcing pipeline, real-time anomaly detection, a new Azure environment, and mocked evidential proof. | Source page 1, Expected Outcomes |
| KF-011 | Proposed AI infusion points are GenAI due-diligence assessment, ESG extraction and standardisation, and a deal-intelligence copilot. | Source page 2, AI Infusion Point |

## Initial five-domain confidence

These confidence labels describe readiness for the Phase 1 interview only; they are not quality scores.

| Domain | Confidence | Evidence present | Material readiness gaps |
|---|---|---|---|
| Business and outcomes | MEDIUM | Challenges, transformation objective, and target outcomes are stated. | Sponsor, priority, scope boundaries, metric definitions, baselines, target dates, costs, value ownership, and acceptance are absent. |
| Data and information | LOW | Broad document, financial, legal, market, ESG, patent, regulatory, and portfolio data categories are mentioned. | Systems of record, schemas, volumes, quality, lineage, locations, classifications, personal data, rights, retention, transfers, and owners are absent. |
| Application and AI | LOW | Three AI use concepts and a list of desired Azure services are supplied. | Users, workflows, system boundaries, integration contracts, model choice, grounding, human oversight, evaluation, failure handling, explainability, and prohibited uses are absent. |
| Technology and operations | LOW | Legacy on-premises starting point and a desired Azure sovereignty landing zone are stated. | Existing estate, environments, connectivity, identity, landing-zone definition, availability, RTO/RPO, performance, support, migration constraints, and operational ownership are absent. |
| Security, privacy, sovereignty, and compliance | LOW | GDPR, EU AI Act, SFDR, AIFMD, sector directives, cross-border operations, and “sovereign” are named. | Exact applicability, legal roles, data sensitivity, threat model, access model, residency, transfers, audit, retention, controls, risk acceptance, and accountable confirmations are absent. |

## Phase 1 interview-preparation handoff

AFF-1 should use the `grill-me` workflow and ask one question per human interaction. It must establish
evidence-backed, testable requirements without treating the case-study statements or listed Azure
services as approved requirements or design.

### Interview agenda and likely questions

| Priority | Domain | First decision or evidence sought | Likely follow-on questions | Accountable owner needed |
|---|---|---|---|---|
| 1 | Business | What decision, workflow, and measurable outcome is in scope for the first release? | Which users, deals, funds, and portfolio companies are included; how are the 3-week and 40% targets calculated and accepted? | Business sponsor and product owner |
| 2 | Sovereignty and compliance | What does “sovereign” mean for this case, and which obligations are confirmed applicable? | Which legal entities, jurisdictions, fund vehicles, processing roles, AI roles, residency rules, transfers, and sector directives apply? | Human architect, legal/compliance owner, privacy owner, security owner |
| 3 | Data | Which governed source systems and data classes feed each use case? | Where are they held; who owns them; what personal, confidential, regulated, licensed, or third-party data exists; what are quality, retention, lineage, and transfer constraints? | Data owners and records/privacy owners |
| 4 | AI and workflow | What decisions may AI support, and what must remain human-controlled? | What grounding, evaluation, explainability, review, audit, refusal, correction, model-risk, and prohibited-use criteria apply? | Business process owners, model-risk owner, legal/compliance owner |
| 5 | Technology and operations | What current estate and enterprise platform constraints govern migration and operation? | Which landing-zone baseline is authoritative; what identity, connectivity, environments, integrations, availability, RTO/RPO, performance, support, and decommissioning constraints apply? | Platform, operations, identity, network, and application owners |
| 6 | Evidence and acceptance | What may “mocked” evidence prove, and how must it be labelled? | Which evidence is synthetic, which outcomes require later runtime validation, and who accepts each result? | Human architect, business sponsor, assurance owner |

### Unresolved ownership

Named accountable people or roles have not been supplied for the business sponsor, product owner, fund
and vehicle legal owner, legal/compliance authority, privacy owner, security owner, data owners,
model-risk owner, enterprise/platform owner, operations owner, or benefits-measurement owner. Phase 1
must identify them or record owner assignment as a blocker.

## Open risks and regulatory readiness

The active shared records are:

- `../stratton-risk-log.md`: six open risks covering sovereignty meaning, legal applicability, data
  governance, metric definition, mocked evidence, and incomplete source wording.
- `../stratton-regulatory-register.md`: five source-stated, **INFERRED** entries. No obligation is
  confirmed, no official source has yet been retrieved, and no requirement or control is assigned.
- `../stratton-decisions.md`: only the human-selected case name and artifact prefix are confirmed.

The mutable case-root `../stratton-run-journal.jsonl` remains the append-only operational record and is
excluded from the immutable candidate hash set because later review and approval events must append to
it. The reviewed lifecycle state is frozen in
`evidence/stratton-run-journal-phase-0-candidate.jsonl`.

## Phase boundary and gate

No requirement, architecture, Azure topology, service selection, legal obligation, control, benefit,
approval, deployment result, test result, or runtime observation is asserted by Phase 0.

The remaining gate conditions are final AFF-A and AFF-B reviews over one unchanged canonical hash
manifest, followed by an explicit human decision in this interaction. Approval would hand the case to
Phase 1; it would not certify requirements completeness or invoke any later phase. A cumulative
`solution-overview.html` must not be generated until that approval and its matching journal event
exist.
