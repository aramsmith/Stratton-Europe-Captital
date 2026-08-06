# Phase 1 — Requirements: Stratton Release 1

**Case:** `Stratton-Europe-Captital`  
**Artifact prefix:** `stratton`  
**Candidate status:** Awaiting assurance and explicit human Phase 1 decision  
**Model-plan revision:** `2` (`../0-coordination/stratton-model-plan-revision-2.json`)  
**Authoritative catalogue:** `stratton-requirements-catalogue.json`

## Executive position

Release 1 is a controlled production rollout for the first 20 eligible new private-equity
opportunities. Its accountable outcome is to reduce median due diligence from 12 weeks to no more than
3 weeks within 12 months of programme approval, measured from formal case opening to an
investment-committee-ready recommendation. The Chief Investment Officer owns the outcome and product
sponsorship.

The solution may assist with governed evidence ingestion, retrieval, extraction, comparison, anomaly
flagging, risk and ESG analysis, citation, review and draft recommendation preparation. Deal
professionals validate material outputs; specialist conclusions require Legal and Compliance review;
the Investment Committee retains every investment decision. The candidate contains no architecture,
Azure service selection, deployment claim or runtime result.

## Interview outcome

The human architect confirmed the append-only interview record complete at
`2026-08-01T21:07:24.031+02:00`. Shared-understanding confidence closed at **96% overall**:
Business 96%, Data 94%, Application 97%, Technology 95% and Security 96%. Every domain exceeds 80%;
no material decision remains unanswered; residual details have owners and validation plans.

This confirmation authorised candidate authoring only. It is not Phase 1 approval and does not invoke
Phase 2.

## Scope and accountability

| Area | Confirmed boundary |
|---|---|
| Population | First 20 eligible new private-equity investment opportunities |
| Users | Stratton deal teams, Legal and Compliance reviewers, AI Governance and Investment Committee members |
| Journey | Formal case opening through an investment-committee-ready draft recommendation |
| Jurisdiction | Stratton's stated Central European footprint, only where confirmed sovereignty constraints are met |
| Product sponsor / outcome owner | Chief Investment Officer |
| Deal eligibility | Head of Deal Operations |
| Jurisdiction eligibility | General Counsel |
| Rollout | Programme Delivery |
| AI governance | Head of AI Governance |
| Independent validation | Internal Audit; Model Risk advises on methods but does not issue the verdict |

### Explicit non-scope

- Portfolio-company monitoring, automated SFDR filing and deal-sourcing automation.
- Autonomous investment decisions, approval decisions or transaction execution.
- External counterparty communications.
- Authoritative source-system write-back or replacement.
- Special-category personal data unless separately approved through change control.
- Wider production rollout until the Release 1 acceptance criteria pass.

## Requirements-management contract

- IDs are immutable `{CATEGORY}-{NNN}` values. Corrections append or supersede; IDs are never reused.
- Active requirements use MoSCoW priority and record owner, stakeholders, source, rationale,
  dependencies, derivation and one stable machine-testable acceptance case.
- Categories are `BR`, `FR`, `DR`, `AR`, `TR`, `SR`, `NR` and `IR`. No architecture principle (`AP`)
  is asserted because no additional mandatory design principle is needed beyond the active
  requirements.
- Material change requires impact assessment, human confirmation, regenerated artifacts and hashes,
  and renewed assurance. An approved baseline is never overwritten.

## Compact requirements register

Complete acceptance fields are authoritative in the JSON catalogue.

| ID | Pri. | Owner | Requirement | Test threshold |
|---|---|---|---|---|
| BR-001 | Must | Chief Investment Officer | Reduce median due diligence from 12 weeks to no more than 3 weeks within 12 months. | Median ≤ 3 weeks for first 20 eligible completed deals |
| BR-002 | Must | Head of Deal Operations | Limit Release 1 to 20 deals with recorded deal and jurisdiction eligibility. | 100% eligibility evidence |
| FR-001 | Must | Chief Investment Officer | Provide the confirmed evidence-to-draft due-diligence functions. | All listed functions demonstrated |
| FR-002 | Must | Chief Investment Officer | Require deal-professional and applicable Legal/Compliance review. | 100% auditable required approvals |
| AR-001 | Must | Head of AI Governance | Keep AI assistive and prevent all confirmed autonomous or prohibited actions. | 100% prevention; zero critical breach |
| AR-002 | Must | Investment Committee | Retain every investment decision with the Investment Committee. | Zero system-issued investment decisions |
| DR-001 | Must | Respective source owner | Admit only confirmed governed internal source domains. | 100% approved, owner-bound sources |
| DR-002 | Must | General Counsel / data owner | Gate external data on explicit AI-use licensing. | 100% approved licence records |
| DR-003 | Must | Data Protection Officer | Minimise personal data and exclude unapproved special-category data. | Zero unapproved special-category records |
| DR-004 | Must | Respective data owner | Retain provenance, owner, timestamp, licence and quality status. | 100% metadata completeness |
| DR-005 | Must | Source owner / General Counsel | Apply source retention, legal holds and working-copy deletion. | 100% auditable disposition outcomes |
| DR-006 | Must | Head of AI Governance | Prohibit foundation-model training with Stratton data. | Zero training use |
| DR-007 | Must | Data owner / CISO | Classify deal, financial, legal and portfolio data as highly confidential and enforce confirmed handling boundaries. | 100% classified with complete control evidence |
| SR-001 | Must | General Counsel | Keep production data and routine processing in approved EU/EEA locations. | Zero unapproved location |
| SR-002 | Must | General Counsel / DPO | Block extra-EEA transfers without approved mechanism, purpose and risk assessment. | Zero unapproved transfer |
| SR-003 | Must | DPO / General Counsel | Evidence GDPR lawful basis, purpose, rights, DPIA screening, processors and transfers. | 100% complete approved evidence |
| SR-004 | Must | Head of Compliance | Evidence lineage, quality, reproducibility, review and audit for SFDR-supporting output. | 100% evidence completeness |
| SR-005 | Must | Fund Legal / Compliance | Govern applicable AIFMD risk, documentation and retention records. | 100% applicable-case mapping |
| SR-006 | Must | General Counsel / Head of AI Governance | Evidence AI literacy, transparency, oversight, logging, risk and classification. | Complete evidence; no unsupported classification |
| SR-007 | Must | Identity Lead / Service Operations | Constrain privileged access to controlled, EU-based, least-privilege, audited operation. | Zero unauthorised access |
| SR-008 | Must | Internal Audit | Preserve independent validation; Model Risk advises only. | One Internal Audit verdict |
| SR-009 | Must | General Counsel | Support DORA-aligned evidence pending entity decision; make no formal compliance claim. | Zero premature compliance claims |
| SR-010 | Must | General Counsel | Keep legal governance under applicable EU/member-state law and assess and accept foreign-jurisdiction exposure. | 100% of exposures assessed and accepted |
| IR-001 | Must | Integration Lead | Use read-only APIs or controlled ingestion; prohibit AI source write-back. | Zero AI-generated source writes |
| TR-001 | Must | Enterprise Platform | Separate environments and keep production-confidential data only in production. | Zero production-confidential data in dev/test |
| TR-002 | Must | Programme Delivery | Migrate incrementally with three-deal parallel reconciliation; no big bang. | Three completed reconciliations |
| TR-003 | Must | Business Continuity | Meet availability and recovery targets. | ≥99.9% business-hours availability; RTO ≤4h; RPO ≤1h |
| TR-004 | Must | Service Operations | Provide 8x5 support, critical alert monitoring and incident ownership. | 100% critical alerts detected and assigned |
| NR-001 | Must | Head of AI Governance | Meet confirmed citation, extraction, claim and risk-detection quality thresholds. | 100% citation; ≥95% extraction; ≥99% critical fields; 0 critical unsupported/missed risk; ≤2% other unsupported; ≥90% high-risk recall |
| NR-002 | Must | Head of AI Governance | Prevent prohibited actions and audit every material human review. | 100% prevention and review evidence |
| NR-003 | Must | Enterprise Platform | Meet interactive and document-pack performance. | p95 <5s; typical pack ≤30 min |

## Regulatory boundary

The human confirmed:

- GDPR applies to EU personal-data processing.
- SFDR applies where ESG output supports regulated disclosures.
- AIFMD applies where Luxembourg AIF vehicles use the workflow.
- The EU AI Act is an AI-governance framework for Release 1; no high-risk or non-high-risk claim may
  be made without the documented role and use-case assessment.
- DORA applies where Stratton or the relevant managing entity is an in-scope AIFM or other financial
  entity. General Counsel still owns the entity-specific applicability or exemption record.

Until that DORA record exists, Release 1 must support DORA-aligned ICT risk, incident, resilience-test
and third-party/cloud oversight evidence and must not claim formal DORA compliance. The generic “sector-specific EU Directives” lead is excluded unless Legal identifies an exact
instrument and trigger. The append-only current dispositions are recorded in
`../stratton-regulatory-register.md`; related risk treatments are recorded in
`../stratton-risk-log.md`.

## Residual validation plan

| ID | Validation item | Owner | Required before |
|---|---|---|---|
| VAL-001 | Record entity-specific DORA applicability or exemption and resulting obligations. | General Counsel | Any formal DORA claim or resulting scope change |
| VAL-002 | Define business hours, typical document pack and critical-alert criteria. | CIO and Service Operations | Service acceptance tests |
| VAL-003 | Define deal eligibility, benchmark eligibility, critical fields, claim severity and control-exception handling. | Deal Operations, AI Governance, Legal, Compliance and CIO | Internal Audit validation |
| VAL-004 | Identify exact source instances, schedules, volumes and quality-remediation procedures. | Source and records owners | Production ingestion |
| VAL-005 | Confirm approved EU/EEA location list and sovereignty exception evidence process. | General Counsel | Production location and transfer acceptance |

These are owned, planned details rather than unresolved material decisions. If validation changes
confirmed intent or scope, AFF-1 must reopen the interview through AFF-0.

## Coverage and dependencies

The catalogue contains 31 active, sourced requirements and 31 stable acceptance tests. All five
interview domains are covered. The primary dependency chain is:

`governed sources → controlled integration → assistive AI → human/specialist review → independent
validation → controlled rollout → business outcome`.

No duplicate or contradictory active requirement is known. DORA is deliberately bounded as an
evidence and validation requirement, not an unsupported claim of formal compliance.

## Candidate gate

This candidate must be rendered, hashed and reviewed by the Rubber Duck Reviewer and Security and
Compliance Reviewer against the same unchanged canonical manifest and model-plan revision. Only then
may the human architect approve or reject Phase 1. Approval is not recorded here.
