# Phase 6 — C-level Presentation

**Artifact prefix:** `stratton`  
**Model-plan revision:** `16`  
**Candidate status:** `IMMUTABLE_CANDIDATE_READY_FOR_PARENT_REVIEW`  
**Generated:** `2026-08-03T10:20:02.891305+02:00`  
**Deck:** `deck/` — project ID `architecture-decision-executive-brief`  

## Executive narrative

The board is asked to endorse the approved architecture and coding baseline as the controlled
reference for the next step, together with an evidence-led roadmap. The request is not deployment
approval. Release 1 remains bounded to the first 20 eligible opportunities and retains deal,
specialist, Internal Audit and Investment Committee authority.

The evidence chain covers approved requirements, vendor-neutral target architecture, Azure design,
implementation sequencing and the Phase 5 revision-4 package. Phase 5 is presented only as locally
implemented and statically validated. Azure sign-in, target validation, what-if, deployment,
retention finalisation, cloud validation, runtime testing and operating-effectiveness evidence do
not exist.

## Decision requested

Endorse the approved baseline and controlled roadmap. Preserve every open fail-closed boundary and
require named-owner evidence plus separately authorised target-validation planning before any
optional deployment decision. Phase 7 — Deployment and Phase 8 — Runtime Testing remain separate,
human-invocable and unauthorised.

## Ten-slide inventory

| ID | Component | Story purpose | Claim IDs |
|---|---|---|---|
| S01 | `deck/src/slides/DecisionSummarySlide.jsx` | Decision requested and executive summary | `P6-C001`, `P6-C002`, `P6-C003` |
| S02 | `deck/src/slides/BusinessContextSlide.jsx` | Business context, challenge and stakeholders | `P6-C004`, `P6-C005`, `P6-C006` |
| S03 | `deck/src/slides/ValueLogicSlide.jsx` | Objectives, outcomes and evidence-based value logic | `P6-C007`, `P6-C008`, `P6-C009` |
| S04 | `deck/src/slides/ArchitectureChoiceSlide.jsx` | Chosen approach, alternatives and trade-offs | `P6-C010`, `P6-C011`, `P6-C012` |
| S05 | `deck/src/slides/TargetArchitectureSlide.jsx` | TOGAF target architecture | `P6-C013`, `P6-C014`, `P6-C015` |
| S06 | `deck/src/slides/AzureDesignSlide.jsx` | Azure design, landing-zone fit and WAF balance | `P6-C016`, `P6-C017`, `P6-C018` |
| S07 | `deck/src/slides/DeliveryReadinessSlide.jsx` | Delivery package and local/static validation readiness | `P6-C019`, `P6-C020`, `P6-C021`, `P6-C022` |
| S08 | `deck/src/slides/BusinessCaseSlide.jsx` | Business case, owner inputs and sensitivities | `P6-C023`, `P6-C024`, `P6-C025` |
| S09 | `deck/src/slides/GovernanceRisksSlide.jsx` | Principal risks and fail-closed governance boundaries | `P6-C026`, `P6-C027`, `P6-C028`, `P6-C029` |
| S10 | `deck/src/slides/RecommendationSlide.jsx` | Recommendation and controlled next step | `P6-C030`, `P6-C031`, `P6-C032` |

## Storyline rationale

The sequence starts with the narrow decision, then establishes the approved business boundary and
value logic before showing the architectural choices. It moves from vendor-neutral target to Azure
realisation, separates planned delivery order from actual local/static evidence, states the absence
of a numeric business case, discloses residual governance boundaries, and closes with a controlled
endorsement request rather than a deployment ask.

## Speaker notes

### S01 — Decision requested

Open with the narrow decision: endorse the evidence-backed baseline and the controlled roadmap. Make clear that the board is not being asked to approve deployment. The implementation evidence is local and static only.

**Claims:** `P6-C001`, `P6-C002`, `P6-C003`

### S02 — Business context and stakeholders

Frame the approved target as a target, not a realised outcome. Emphasise the first-20-deal boundary and the retained human decision chain from deal professionals to the Investment Committee.

**Claims:** `P6-C004`, `P6-C005`, `P6-C006`

### S03 — Objectives and value logic

Explain the causal logic without claiming benefit: governed evidence and grounded analysis may reduce avoidable search and rework, while human gates protect decision quality. Numeric value remains to be validated by accountable owners.

**Claims:** `P6-C007`, `P6-C008`, `P6-C009`

### S04 — Architecture choice and trade-offs

Present the chosen pattern as an explicit control choice. Contrast it with rejected autonomous, write-back and UI-only approaches. The cost of stronger assurance is more identities, gates and release latency.

**Claims:** `P6-C010`, `P6-C011`, `P6-C012`

### S05 — TOGAF target architecture

Walk left to right through the approved vendor-neutral flow. Point out the policy service across boundaries, grounded evidence before review, and the dashed non-automated hand-off to the committee record.

**Claims:** `P6-C013`, `P6-C014`, `P6-C015`

### S06 — Azure design and landing-zone fit

Use the approved topology to show subscription and environment separation. Balance the security and resilience strengths against fixed network cost, operating complexity and unvalidated owner parameters.

**Claims:** `P6-C016`, `P6-C017`, `P6-C018`

### S07 — Delivery and local validation readiness

Separate planned delivery order from implemented package evidence. The package and local tests are real; Azure target validation and deployment are not. Avoid the phrase deployment-ready.

**Claims:** `P6-C019`, `P6-C020`, `P6-C021`, `P6-C022`

### S08 — Business case and sensitivities

State plainly that no approved numeric business case exists. Ask for owner-supplied dated inputs rather than presenting placeholders as estimates. Highlight the principal sensitivity drivers without numbers.

**Claims:** `P6-C023`, `P6-C024`, `P6-C025`

### S09 — Risks and governance boundaries

Disclose the exact counts and names. These are deliberate fail-closed boundaries, not waived defects. Compliance coverage is architecture assurance only and does not establish legal compliance or operating effectiveness.

**Claims:** `P6-C026`, `P6-C027`, `P6-C028`, `P6-C029`

### S10 — Recommendation and controlled next step

Close with an endorsement request, not a deployment request. The immediate roadmap is owner evidence closure and authorised target-validation planning. Optional Phases 7 and 8 remain separate human decisions.

**Claims:** `P6-C030`, `P6-C031`, `P6-C032`

## Claim and source traceability

The machine-readable catalogue contains **32** supported material claims:

- `SOURCE_FACT`: 6
- `HUMAN_OWNED_HYPOTHESIS`: 3
- `APPROVED_DESIGN_INTENT`: 13
- `IMPLEMENTED_AND_STATICALLY_VALIDATED`: 7
- `UNTESTED_RUNTIME_BEHAVIOUR`: 3

Each claim records a stable claim ID, slide ID, statement, classification, source path and section,
approval/evidence status, and caveat or owner validation need. Primary source clusters are the
approved Phase 1 requirements, Phase 2 architecture and VIEW-03, approved Phase 3 design plus
change control, approved Phase 4 plan plus dependency DAG, Phase 5 revision-4 build and release
evidence, final AFF-A round 4, final AFF-B round 2, coverage 009 and Phase 5 approval.

Catalogue: [`stratton-claim-catalogue.json`](stratton-claim-catalogue.json).

## Financial and assumption boundary

- No approved numeric business case, ROI, Azure price, rate, cost total or realised benefit exists.
- FinOps, Enterprise Platform and the Chief Investment Officer must provide a dated, owner-approved
  Azure Pricing Calculator estimate after exact region, capacity, usage and resilience inputs.
- Benefit validation requires dated baseline and post-adoption cycle-time, effort, quality, review
  and exception evidence approved by the accountable business and control owners.
- Principal sensitivities are region, resilience, document volume, model quota, processing hours,
  support model, licensing, commercial terms and adoption.

## Residual disclosure

Open, unwaived and fail closed:

1. **Three authority conflicts:** assurance verdict issuance is not deployable in DU-12; analysis
   execution remains authority-blocked; audit evidence export remains authority-blocked.
2. **Fourteen owner-bound controls:** `VAL-001`–`VAL-005`, `AFFB-RES-001`–`AFFB-RES-002`, and
   `CC1-OWN-001`–`CC1-OWN-007`.
3. **Two retained AFF-B minor gaps:** `AFFB-CC001-R2-MIN-001` and
   `AFFB-CC001-R3-MIN-002`.

No legal conclusion, compliance certification, waiver, target behaviour or operating-effectiveness
claim is made.

## Build, inspection and export status

- DECKIO theme: shadcn design system, ocean palette.
- Registered slides: **10** (`S01`–`S10`).
- Production build: **PASS**; preserved at [`deck/dist/index.html`](deck/dist/index.html).
- Audience-anonymous browser boundary: **PASS**. `deck/src/data/claims.js` contains only the static
  slide-to-claim-ID mapping needed for display. Full claim statements and governed source paths remain
  solely in [`stratton-claim-catalogue.json`](stratton-claim-catalogue.json), outside the DECKIO source
  and production JavaScript bundle.
- Case-insensitive forbidden-string scan: **PASS** with zero matches across 47 `deck/src` files and
  11 `deck/dist` JavaScript files for `stratton`, `Stratton-Europe`, `Agentic-Architecture`,
  `5-coding`, `reviews/aff`, and `approvals/`.
- Visual inspection: **PASS** at 1280×720; all ten slides captured and DOM overflow checks are
  false. Transient captures remain outside the canonical manifest.
- PDF export: **PASS**; [`deck/deck.pdf`](deck/deck.pdf), 1,457,166 bytes, 10 pages.
- Build evidence: [`evidence/deck-build.log`](evidence/deck-build.log).
- PDF evidence: [`evidence/pdf-export.log`](evidence/pdf-export.log).
- Anonymous-bundle evidence:
  [`evidence/forbidden-string-scan.json`](evidence/forbidden-string-scan.json).
- Visual measurements: [`evidence/visual-measurements.json`](evidence/visual-measurements.json).

## Exact output paths

- `6-presentation/stratton-presentation.md`
- `6-presentation/stratton-presentation.html`
- `6-presentation/stratton-claim-catalogue.json`
- `6-presentation/deck/deck.config.js`
- `6-presentation/deck/src/`
- `6-presentation/deck/dist/`
- `6-presentation/deck/deck.pdf`
- `6-presentation/stratton-phase-6-hashes.json`

## Gate boundary

This is an immutable candidate for parent-owned review orchestration. AFF-A, AFF-B, human approval,
approval records, the run journal, dashboard and solution overview are outside this write boundary
and have not been invoked or modified.
