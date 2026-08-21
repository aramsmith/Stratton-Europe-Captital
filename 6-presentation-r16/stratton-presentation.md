# Phase 6 - Architecture Review Board Presentation

**Artifact prefix:** `stratton`  
**Model-plan revision:** `119`  
**Candidate status:** `R16_SLIDE11_PROMPT_DIAGRAM_VALIDATED`  
**Candidate path:** `6-presentation-r16`  
**Approval status:** `PENDING`  
**Generated:** `2026-08-21T11:33:13.126+02:00`  
**Deck:** `deck/` — project ID `architecture-decision-executive-brief`  
**Phase 5 r7 approval:** `approvals/5/stratton-phase-5-cc-002-approval-1.json` —
SHA-256 `ca419c4f84f8928156912a32ac0db29e57fa097b9785e20ecf87fa2edc2b4e4c`  
**Change note:** r16 changes only the Slide 11 `Prompt Engineering` block requested by the human architect. The label remains unchanged and gains a compact central-prompt-to-five-techniques illustration. The `Loop Engineering` and `Graph Engineering - Diamond` blocks and underlying governed model-portfolio controls remain unchanged from frozen r15; all other slide copy, claims, prices, references, IDs, the 40-minute timer, 20-slide inventory, phase boundaries and approval state remain unchanged. Integrated validation passed; this candidate remains unapproved until an explicit in-tool human decision.

## Executive narrative

This 20-slide architecture-board briefing explains the Stratton Europe Capital case, the
human-centred Agentic Architecture operating model, the approved requirements and TOGAF baseline,
the governed GPT-5.6 model portfolio, the Azure target design, the implementation package, and the
controlled path from mockup demonstration to a non-production proof of concept.

The active implementation baseline is Phase 5 r7: 124 deployable source files across all 17
implementation units, ten passing local validation steps, digest-bound container evidence and
explicit fail-closed owner gaps. The package is implemented and locally validated only. Azure
deployment has not been executed. Phase 8 runtime testing has not been executed. No production
inference, route promotion, realised benefit, compliance certification or operating-effectiveness
claim is made.

**Execution boundary:** Azure deployment has not been executed. Phase 8 runtime testing has not been executed.

## Decision requested

Approve or reject this Phase 6 presentation candidate after AFF-A and AFF-B review of the same final
hashes. Approval would freeze the board narrative and evidence package only. Optional Phase 7
deployment and Phase 8 runtime testing remain separate human-invoked decisions.

## Twenty-slide inventory

| Physical | ID | Component | Story purpose | Claim IDs |
|---:|---|---|---|---|
| 1 | S01 | `deck/src/slides/TitleSlide.jsx` | Introduce the sovereign Azure AI architecture journey and evidence boundary. | `P6-C001` |
| 2 | S02 | `deck/src/slides/CompanyProfileSlide.jsx` | Establish the fictitious company profile and source-case business challenges. | `P6-C002`, `P6-C003` |
| 3 | S03 | `deck/src/slides/TransformationAgendaSlide.jsx` | Present case-stated transformation ambitions while separating Release 1 from future scope. | `P6-C004`, `P6-C005` |
| 4 | S04 | `deck/src/slides/MyApproachSlide.jsx` | Explain the presenter method and linked architecture/reference sources. | — |
| 5 | S05 | `deck/src/slides/AgenticArchitectureRingSlide.jsx` | Show the nine-phase, reviewer-enveloped, human-final operating model. | `P6-C006` |
| 6 | S06 | `deck/src/slides/AgenticAssuranceRosterSlide.jsx` | Show the configured agent roster and same-hash assurance sequence. | `P6-C007` |
| 7 | S07 | `deck/src/slides/FrontierSolutionTitleSlide.jsx` | Frame the target solution vision as an ambition, not an achieved capability. | `P6-C008` |
| 8 | S08 | `deck/src/slides/RequirementsInterviewSlide.jsx` | Summarise the approved Release 1 outcome, scope, controls and testable baseline. | `P6-C009`–`P6-C011` |
| 9 | S09 | `deck/src/slides/TogafArchitectureSlide.jsx` | Present the approved vendor-neutral TOGAF baseline as five connected architecture views. | `P6-C012`, `P6-C013` |
| 10 | S10 | `deck/src/slides/HumanAiOperatingModelSlide.jsx` | Allocate deterministic controls, assistive AI work and accountable human decisions. | `P6-C014` |
| 11 | S11 | `deck/src/slides/ModelPortfolioSlide.jsx` | Present the Luna/Terra/Sol escalation model and the AI techniques used while retaining the approved controls as governed metadata. | `P6-C015`–`P6-C018` |
| 12 | S12 | `deck/src/slides/AzureDesignSlide.jsx` | Show the private EU Data Zone Azure Landing Zone and Citadel design intent. | `P6-C019`–`P6-C022` |
| 13 | S13 | `deck/src/slides/ImplementationPlanSlide.jsx` | Show dependency-controlled Bicep delivery and owner/human release gates. | `P6-C023`, `P6-C024` |
| 14 | S14 | `deck/src/slides/CodingSlide.jsx` | Bind the approved Phase 5 r7 package, local checks, supply-chain evidence and model controls. | `P6-C025`–`P6-C029` |
| 15 | S15 | `deck/src/slides/DeploymentSlide.jsx` | Explain the optional Phase 7 runbook without claiming execution. | `P6-C030` |
| 16 | S16 | `deck/src/slides/RunTestsSlide.jsx` | Separate actual local checks from optional Phase 8 runtime acceptance gates. | `P6-C031` |
| 17 | S17 | `deck/src/slides/CostsBenefitsSlide.jsx` | Show an illustrative public-retail cost shape, mock comparator and projected benefits. | `P6-C032`–`P6-C034` |
| 18 | S18 | `deck/src/slides/RisksMitigationsSlide.jsx` | Present working assumptions, material risks and evidence-led mitigations. | `P6-C035`, `P6-C036` |
| 19 | S19 | `deck/src/slides/NextStepsSlide.jsx` | Disclose mockup data and propose an evidence-gated non-production POC. | `P6-C037`, `P6-C038` |
| 20 | S20 | `deck/src/slides/ThankYouSlide.jsx` | Close the presentation without adding a delivery claim. | — |

## Storyline rationale

The sequence moves from source-case context and transformation ambition through the architecture
method, human-governed agentic operating model, approved requirements, TOGAF baseline, model
portfolio, Azure design and implementation evidence. It then separates implemented local evidence
from optional deployment and runtime testing, makes cost and benefit assumptions explicit, and
closes with risks and a non-production POC rather than a production commitment.

## Speaker notes

| ID | Presenter emphasis |
|---|---|
| S01 | This is an architecture decision brief, not evidence of deployment or production readiness. |
| S02 | All company figures and challenges come from the fictitious Case Study 18 source; the inherited approved change is limited to red challenge-panel styling. |
| S03 | The 12-to-3-week, automated-SFDR, pipeline and anomaly outcomes are case ambitions; only the approved Release 1 scope is current. |
| S04 | The linked frameworks and samples inform the method; they do not prove regulatory applicability or solution fitness by themselves. |
| S05 | The human architect remains accountable; the approved visible change is the `ARB Presentation` label, and the deck timer is 40 minutes. |
| S06 | AFF-6 is the Architecture Review Board presentation role; `Present before you spend` reinforces the decision-before-execution boundary. Luna and Terra remain planned reviewers. |
| S07 | The Frontier Company statement is an aspirational target vision, not an achieved operating capability. |
| S08 | Emphasise the first 20 eligible deals, retained human authority and 31 sourced requirements with 31 acceptance tests. |
| S09 | The TOGAF baseline is approved and vendor neutral: 19 ABBs, five views, ten decisions and seven owner-bound gates. |
| S10 | The five-step relay makes handoff explicit. AI prepares governed evidence; people validate, approve and decide. The removed evidence note remains authoritative through `P6-C014`, including the committee-ready caveat. |
| S11 | Use the smallest approved model that meets evidence needs. The bottom rail illustrates Prompt Engineering as a central prompt connected to five technique nodes, Loop Engineering as work entering a decision with repeat and done paths, and Graph Engineering - Diamond as one input branching across three paths before converging. `P6-C017` remains governed metadata and promotion remains benchmarked, human validated and fail closed. |
| S12 | The architecture blocks are interactive presentation elements only. Removed governance and fail-closed callouts remain approved design metadata; exact regions, IDs, capacity and runtime behaviour remain unproven. |
| S13 | The approved Azure design becomes one modular package, deployed only in dependency-safe sequence; owner input, validation and human release gates remain authoritative. |
| S14 | The header owner-decision badge was removed without removing the owner-sizing service metadata. All evidence shown remains local/static; Azure execution and production inference remain blocked. |
| S15 | Phase 7 remains an authorised-attempt runbook only. A separate human invocation, owner values, what-if review, stop-on-failure evidence and rollback posture are required. |
| S16 | Pester validates IaC structure and PSRule checks Azure rules locally. The six larger cards remain planned runtime gates with method, threshold and release consequence for a separately authorised exact deployment. |
| S17 | The Azure values are an illustrative public-retail snapshot. The exactly USD 200,000 comparator is human-directed mock data; its removed visible caveat remains authoritative metadata, and the GPT-4o mini token assumption remains only a public-rate proxy. |
| S18 | Each risk is paired with its evidence-led mitigation. Assumptions remain working assessments and require observed evidence before a production commitment. |
| S19 | Mockup data demonstrated the target experience. Investigate data, map formats and evaluate a representative non-production POC, then proceed or refine based on whether Value or Control evidence justifies further investment. |
| S20 | Close without implying that Phase 6, deployment, runtime testing or business benefits are approved or achieved. |

## Claim and source traceability

The machine-readable catalogue contains 38 material claims:

- `SOURCE_FACT`: 12
- `HUMAN_OWNED_HYPOTHESIS`: 4
- `APPROVED_DESIGN_INTENT`: 14
- `IMPLEMENTED_AND_STATICALLY_VALIDATED`: 5
- `UNTESTED_RUNTIME_BEHAVIOUR`: 3

Each claim records a stable claim ID, slide ID, statement, classification, source path and section,
approval/evidence status, and caveat. Catalogue:
[`stratton-claim-catalogue.json`](stratton-claim-catalogue.json).

## Financial and assumption boundary

- The Azure cost shape uses a dated `2026-08-10` West Europe public PAYG rate snapshot embedded in
  `deck/src/data/azurePricing.js`; it includes one APIM Premium v2 unit at `$3.83562` per hour and
  excludes taxes, support, discounts and negotiated terms.
- The displayed Azure estimate is approximately `$8.0K` per month and `$95.8K` per year.
- The $200.0K annual on-premises comparator, +109% premium and approximately $104.2K gap are human-directed illustrative planning assumptions, not a customer quote, procurement estimate, achieved cost or assured business case.
- The token assumption uses GPT-4o mini as a public-rate proxy. It is not a cost claim for the
  approved GPT-5.6 Luna, Terra or Sol routes.
- Cycle-time, security, governance and decision-quality benefits are projected or enabled only.
  No realised benefit is claimed.

## Residual disclosure

Open, unwaived and fail closed:

1. Exact Azure regions, resources, deployment IDs, capacity, quota and policy-alias evidence.
2. Embedding dimensions, chunking, representative benchmarks and complete index-rebuild evidence.
3. Recovery, failover, retention, legal hold, privacy lifecycle and deletion evidence.
4. Provider terms, licence compatibility, source permissions and dated official-source mappings.
5. GDPR detail, EU AI Act role/use-case classification and DORA applicability decisions.
6. Production release identity, target validation, Azure deployment, inference, promotion and
   operating-effectiveness evidence.
7. The three authority conflicts, fourteen owner-bound controls and two retained AFF-B minor gaps
   bound by the approved Phase 5 r7 package.

No legal conclusion, certification, waiver or production-readiness claim is made.

## Assurance and export status

- Registered DECKIO slides: **20**.
- Model-plan revision 119 binds Sol authoring with planned Luna and Terra reviews; the actual integration author model is `gpt-5.6-sol`.
- Frozen-r15 baseline plus the focused r16 Slide 11 content contract: **PASS**.
- The r16 change is limited to `ModelPortfolioSlide.jsx`, its CSS module, revision metadata and the focused regression test.
- The claim catalogue retains the same 38 material claims; the three new technique labels are presentation taxonomy, not delivery or runtime claims.
- Phase 7 and Phase 8 remain `NOT_INVOKED`.
- No Phase 6 r16 approval is claimed by this candidate.

## Output paths

- `6-presentation-r16/stratton-presentation.md`
- `6-presentation-r16/stratton-presentation.html`
- `6-presentation-r16/stratton-claim-catalogue.json`
- `6-presentation-r16/deck/deck.config.js`
- `6-presentation-r16/deck/src/`

## Gate boundary

This candidate records no approval. AFF-A, AFF-B, compliance coverage and human approval are
external lifecycle gates. Phase 6 r16 remains unapproved until the human architect records an
explicit decision in the active AI interaction. No Phase 7 or Phase 8 authority is granted.
