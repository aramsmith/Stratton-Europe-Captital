# Stratton regulatory register

This register records case-stated potential applicability only. It is architecture assurance, not
legal advice, certification, or attestation. No instrument below is confirmed applicable until the
accountable legal/compliance owner confirms its exact trigger and obligations.

| Entry ID | Instrument | Jurisdiction | Source-stated trigger | Official source | Publication / effective date | Extracted obligation | Confidence | Human confirmation | Requirement IDs | Controls | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| REG-0001 | GDPR | European Union / EEA | Named in the source regulatory context; processing roles and personal-data scope are not described. | NOT YET RETRIEVED | NOT YET CONFIRMED | NOT YET EXTRACTED | INFERRED | REQUIRED | None | None | OPEN |
| REG-0002 | EU AI Act | European Union | Named in the source regulatory context; provider/deployer role, AI-system classification, and use-case scope are not established. | NOT YET RETRIEVED | NOT YET CONFIRMED | NOT YET EXTRACTED | INFERRED | REQUIRED | None | None | OPEN |
| REG-0003 | EU SFDR | European Union | Source states ESG reporting obligations and portfolio-company data collection. Entity/product scope is not established. | NOT YET RETRIEVED | NOT YET CONFIRMED | NOT YET EXTRACTED | INFERRED | REQUIRED | None | None | OPEN |
| REG-0004 | AIFMD | European Union / Luxembourg implementation | Source states regulatory reporting for Luxembourg-based fund vehicles. Vehicle and manager scope are not established. | NOT YET RETRIEVED | NOT YET CONFIRMED | NOT YET EXTRACTED | INFERRED | REQUIRED | None | None | OPEN |
| REG-0005 | “Sector-specific EU Directives” | Unspecified | Generic phrase in the source regulatory context; no instrument or trigger is identified. | NOT YET IDENTIFIED | NOT YET CONFIRMED | NOT YET EXTRACTED | INFERRED | REQUIRED | None | None | BLOCKED-PENDING-IDENTIFICATION |

## Phase 1 append-only disposition — revision 002

The original inferred entries above remain immutable Phase 0 history. The current dispositions below
record human-confirmed Phase 1 applicability boundaries. They are architecture requirements evidence,
not legal advice, certification, attestation or a formal compliance claim. Official-source citation
and detailed obligation mapping remain accountable-owner validation work.

| Entry | Instrument | Current applicability boundary | Confirming authority | Requirement IDs | Current status |
|---|---|---|---|---|---|
| REG-0001 | GDPR | Applies because Release 1 processes EU personal data; material constraints are minimisation, purpose limitation, lawful basis, data-subject handling, DPIA screening, processor controls and transfer governance. | DPO and General Counsel | DR-003, SR-002, SR-003 | CONFIRMED-PENDING-DETAILED-EVIDENCE |
| REG-0002 | EU AI Act | Applies as an AI-governance framework; Release 1 has no high-risk or non-high-risk classification until the documented role and use-case assessment confirms it. | General Counsel and Head of AI Governance | AR-001, AR-002, SR-006, SR-008 | CONFIRMED-PENDING-CLASSIFICATION-EVIDENCE |
| REG-0003 | SFDR | Applies where ESG output supports regulated disclosures. | Head of Compliance | DR-004, SR-004 | CONFIRMED-CONDITIONAL |
| REG-0004 | AIFMD | Applies where Luxembourg AIF vehicles use the workflow. | Fund Legal and Compliance | DR-005, SR-005 | CONFIRMED-CONDITIONAL |
| REG-0005 | Sector-specific EU Directives | Removed from active applicability unless Legal identifies an exact instrument and trigger. | General Counsel | None | REMOVED-PENDING-NEW-EVIDENCE |
| REG-0006 | DORA | Applies where Stratton or the relevant managing entity is an in-scope AIFM or other financial entity; entity-specific applicability or exemption remains to be recorded. Release 1 supports DORA-aligned evidence without claiming formal compliance meanwhile. | General Counsel | SR-009, TR-003, TR-004 | CONDITIONAL-VALIDATION-OPEN |
