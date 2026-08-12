# Stratton risk log

| Risk ID | Risk | Evidence | Impact | Owner | Treatment / validation | Status |
|---|---|---|---|---|---|---|
| RISK-0001 | “Sovereign” and “Azure Sovereign Landing zone” are not defined in the source. | `Case-Study-18.pdf`, page 1 | A later design could apply the wrong sovereignty, residency, tenancy, or operational-control interpretation. | Human architect with legal, compliance, security, and platform owners | Define required sovereignty outcomes and constraints during Phase 1; do not select a landing-zone implementation before confirmation. | OPEN |
| RISK-0002 | Regulatory applicability and exact obligations are not confirmed. | `Case-Study-18.pdf`, page 1 names GDPR, EU AI Act, SFDR, AIFMD, and unspecified sector directives. | Requirements or controls could be unsupported, incomplete, or incorrectly scoped. | Accountable legal/compliance owner | Confirm each scope trigger, jurisdiction, role, fund/vehicle structure, data processing context, and effective obligation during Phase 1. | OPEN |
| RISK-0003 | Data classes, source systems, locations, transfer constraints, retention, and access ownership are absent. | Source-wide omission | Sensitive investment, legal, financial, personal, or portfolio-company data could be mishandled. | Data owner and security/privacy owners | Complete the Phase 1 data and security interview before architecture. | OPEN |
| RISK-0004 | Outcome measures lack baselines, measurement definitions, time horizons, and accountable owners. | `Case-Study-18.pdf`, page 1, Expected Outcomes | Benefits cannot be tested or evidenced reliably. | Business sponsor | Define metric formulae, baselines, target dates, evidence sources, and acceptance thresholds in Phase 1. | OPEN |
| RISK-0005 | “Evidential proof (mocked)” is ambiguous and may be mistaken for observed production evidence. | `Case-Study-18.pdf`, page 1, Expected Outcomes | Stakeholders could overstate readiness or achieved benefits. | Human architect and business sponsor | Define allowed synthetic evidence, labelling, provenance, and acceptance use; never represent mocked evidence as runtime observation. | OPEN |
| RISK-0006 | The final transformation-objective bullet is grammatically incomplete. | `Case-Study-18.pdf`, page 1 | Intended growth and new-service outcomes may be misunderstood. | Business sponsor | Clarify the intended statement during Phase 1 without silently repairing the source. | OPEN |

## Phase 1 append-only disposition — 2026-08-01T21:07:24.031+02:00

The original entries above remain immutable Phase 0 history. The current dispositions below are bound
to confirmed interview decisions in
`1-requirements/stratton-interview-decisions.json`; they do not claim Phase 1 approval.

| Risk ID | Current disposition | Evidence | Residual owner / action |
|---|---|---|---|
| RISK-0001 | TREATED-PENDING-VALIDATION | INT-D-002 confirms sovereignty outcomes and accountability. | General Counsel confirms approved EU/EEA locations and exception evidence. |
| RISK-0002 | TREATED-PENDING-VALIDATION | INT-D-007 and INT-D-009 confirm applicability boundaries and owners. | General Counsel records entity-specific DORA applicability or exemption; AFF-0 maintains the register. |
| RISK-0003 | TREATED-PENDING-VALIDATION | INT-D-003 confirms sources, owners, classifications, use, provenance and retention boundaries. | Source and records owners complete exact system, schedule, volume and quality-remediation mappings. |
| RISK-0004 | TREATED-PENDING-VALIDATION | INT-D-001 and INT-D-005 define the outcome, population, thresholds and acceptance owners. | CIO and named owners approve detailed measurement definitions before validation. |
| RISK-0005 | TREATED | INT-D-005 requires clear synthetic labelling and excludes mocked evidence from production-benefit claims. | CIO accepts production-benefit evidence; Internal Audit validates independently. |
| RISK-0006 | TREATED | INT-D-008 explicitly confirms Release 1 scope and non-scope without repairing the source text. | Any expansion uses human-gated requirements change control. |

## STRATTON-CC-001 append-only risk — 2026-08-02T14:08:46.058+02:00

| Risk ID | Risk | Evidence | Impact | Owner | Treatment / validation | Status |
|---|---|---|---|---|---|---|
| RISK-0007 | Phase 5 remains active while its authority-interface finalisation depends on unapproved Phase 3/4 amendments. | `STRATTON-CC-001` proposed hash manifests and active AI interaction | Implemented interfaces could diverge from the eventual approved authority contract. | AFF-5 with AFF-3, AFF-4 and human architect | Keep authority-interface finalisation fail-closed; preserve approved baselines and require unchanged-hash AFF-A/AFF-B convergence plus explicit human approval before binding the amendment. | OPEN |

## STRATTON-CC-001 formal-review risks — 2026-08-02T15:08:10.9119864+02:00

| Risk ID | Risk | Evidence | Impact | Owner | Treatment / validation | Status |
|---|---|---|---|---|---|---|
| RISK-0008 | Assurance repository acceptance, build, signing, ACR publication, deployment and operations are not yet separated into independently authorised duties. | `reviews/aff-b/3/round-3/stratton-aff-b-review.json` and `reviews/aff-b/4/round-2/stratton-aff-b-review.json`, finding `AFFB-CC001-MAJ-001` | One compromised or misused principal could create, sign, publish and deploy false assurance software. | Internal Audit Software Owner and Release Authority, Identity Lead, Enterprise DevSecOps, AFF-3 and AFF-4 | Define an Internal Audit-controlled source boundary; split duties and identities; bind immutable provenance, SBOM and signatures; prove negative cross-role access before activation. | OPEN_BLOCKS_CC_GATE |
| RISK-0009 | Signed receipts and verdicts do not yet bind signing time and the exact immutable trust-policy, registry, signer-mapping, validity and revocation/compromise snapshot. | Same formal AFF-B records, finding `AFFB-CC001-MAJ-002` | Historical verification could become ambiguous after rotation, revocation, compromise or registry replacement, weakening audit continuity and records evidence. | Internal Audit cryptographic authority, Workload Security Owner, Records Owner, AFF-3 and AFF-4 | Bind and retain immutable per-record trust snapshots covered by the signed record hash; test historical verification across rotation, revocation, compromise, rollback and recovery. | OPEN_BLOCKS_CC_GATE |
