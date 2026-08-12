# Stratton Phase 3 CC-002 model-portfolio amendment

**Change control:** `STRATTON-CC-002`  
**Status:** `IMPLEMENTATION_COMPLETE_REVIEW_PENDING`  
**Author model:** `gpt-5.6-sol`  
**Scope:** append-only Phase 3 candidate; deployment remains blocked

## 1. Change identifier and status

`STRATTON-CC-002` proposes a Phase 3 overlay for a fixed GPT-5.6 portfolio and the
`EU Data Zone Standard` inference posture. It does not rewrite the canonical Phase 3 design or either
`STRATTON-CC-001` candidate. The candidate remains subject to hash-bound AFF-A and AFF-B review and
an explicit human decision. No approval is claimed.

## 2. Human decision and reason for change

The governing specification records the human-selected direction: use the smallest governed model
that meets the evidence threshold, while retaining accountable human authority. A single flagship
model would spend avoidable latency and cost on routine work; opaque dynamic routing would weaken
task-to-model reproducibility. The selected design therefore combines specialist extraction and
retrieval with fixed Luna, Terra and Sol routes, ordered escalation, independent route evaluation and
fail-closed operation.

## 3. Superseded regional-only statements

This overlay identifies, but does not edit, the canonical statements that deny Data Zone deployment
types in `stratton-azure-design.md`, `stratton-design-catalogue.json` and their network, operations,
traceability and WAF evidence. On a future explicit human decision for these exact candidate bytes,
those statements are superseded only for Azure OpenAI inference by the boundary in section 4.

The approved-location gates, private networking, two-region workload recovery pattern, data-at-rest
controls and owner evidence remain unchanged. “Regional” continues to describe named Azure resource
and recovery locations once supplied by the owners; it is not a promise about the provider-selected
inference processing region.

## 4. EU Data Zone Standard sovereignty boundary

The target Azure deployment type is `EU Data Zone Standard`, with Azure SKU name
`DataZoneStandard` and `NoAutoUpgrade`. Prompts and outputs remain within the EU Data Zone. Data at
rest remains in the designated EU geography. Microsoft selects the processing region within that
zone, and the architecture does not promise a specific processing region.

`Global Standard prohibited` is an enforced policy statement. Exact Azure resource regions,
capacity, quota, commercial terms and provider evidence remain owner-bound inputs. Production
inference stays blocked until General Counsel, the DPO, CISO and AI Governance supply the required
location, provider-data-use, capability, quota and authority evidence.

## 5. Luna, Terra and Sol role table

| Tier | Model | Version | Purpose |
|---|---|---|---|
| LUNA | `gpt-5.6-luna` | `2026-07-09` | High-volume triage, query rewrite, first-pass summary |
| TERRA | `gpt-5.6-terra` | `2026-07-09` | Default grounded professional analysis |
| SOL | `gpt-5.6-sol` | `2026-07-09` | Gated complex and high-consequence reasoning |

| Tier | Azure deployment interface | API version | Reasoning effort and capacity |
|---|---|---|---|
| LUNA | Chat Completions | `2024-12-01-preview` | `REQUIRED_OWNER_INPUT` after route benchmark |
| TERRA | Responses | `2025-04-01-preview` | `REQUIRED_OWNER_INPUT` after route benchmark |
| SOL | Responses | `2025-04-01-preview` | `REQUIRED_OWNER_INPUT` after route benchmark |

Each record binds a 1,050,000-token context window, 128,000 maximum output tokens, text and image
input, structured outputs and tool capability. Release 1 policy keeps autonomous tool execution
disabled. Application configuration resolves an owner-supplied deployment name or resource ID; it
never invokes an unapproved direct model alias. None of the three models supplies a material
approval, authoritative legal or compliance conclusion, or investment decision.

## 6. Specialist extraction, retrieval and anomaly foundation

| Capability | Bound service or method | Control boundary |
|---|---|---|
| Document structure | Azure AI Document Intelligence `prebuilt-layout` | Extracts text, tables, marks, paragraphs and coordinates; custom models wait for labelled benchmark evidence |
| Multilingual retrieval | Azure OpenAI `text-embedding-3-large` plus Azure AI Search hybrid and semantic retrieval | Maximum input is 8,191 tokens and maximum dimensions are 3,072; promoted dimensions and chunking are owner-selected after benchmarking |
| Numerical anomaly detection | Deterministic rules and statistical checks | Primary detector for financial anomalies; explanations cannot override it |
| Explainable anomaly challenger | Isolation Forest or a separately governed equivalent | Future scope; requires representative anomaly data and validation |
| Supervised prediction | Governed gradient-boosted challenger | Future scope; blocked until sufficient labelled outcomes and separate validation exist |

Any embedding-dimension or chunking change invalidates affected evaluation evidence and requires a
complete index rebuild. Search remains derived, security-filtered and rebuildable. Fine-tuning with
Stratton data remains out of scope. No model training on Stratton content.

## 7. Deterministic routing and escalation

`deterministic workflow routing` selects the initial tier from the workflow step and task class; no
model selects its own route. The fixed base routes are:

| Task class | Initial tier |
|---|---|
| `EVIDENCE_TRIAGE` | LUNA |
| `QUERY_REWRITE` | LUNA |
| `FIRST_PASS_SUMMARY` | LUNA |
| `GROUNDED_ANALYSIS` | TERRA |
| `CROSS_DOCUMENT_COMPARISON` | TERRA |
| `ESG_NORMALISATION` | TERRA |
| `COMPLEX_RISK_SYNTHESIS` | SOL |
| `INVESTMENT_THESIS_CHALLENGE` | SOL |

Escalation reasons are evaluated in this order:

1. `VALIDATION_FAILURE`;
2. `LOW_CONFIDENCE`;
3. `CONFLICTING_MATERIAL_EVIDENCE`;
4. `HIGH_RISK_SPECIALIST_CONCLUSION`;
5. `AUTHORISED_HUMAN_REQUEST`.

Luna may move only to Terra, Terra may move only to Sol or a named human, and Sol stops for human
resolution when it cannot produce supported output. Every tier runs structured output validation,
schema validation, citation validation and factual consistency validation before human validation.
There is no unrecorded substitution or downgrade: an unavailable approved deployment queues the work
or fails closed. Microsoft Foundry Model Router is deferred and not a production component.

## 8. Evaluation and promotion gates

Every promoted route requires at least `100 representative generative cases per promoted route`,
covering approved languages, document types, risk levels and expected failure modes. Extraction and
anomaly capabilities use separate representative datasets. Promotion requires all of these minimum
gates:

| Measure | Gate |
|---|---|
| Material citation coverage | exactly 100% |
| Extraction accuracy | at least 95% |
| Critical-field accuracy | at least 99% |
| Critical unsupported claims | zero |
| Missed critical risks | zero |
| Other unsupported claims | no more than 2% |
| High-risk recall | at least 90% |
| Interactive latency | p95 below 5 seconds |
| Typical document-pack completion | within 30 minutes |

The benchmark also records groundedness, citation accessibility, structured-output validity,
prompt-injection and poisoned-evidence resistance, tokens, cost, escalation, correction effort and
parity across owner-approved deployment locations. Champion/challenger results, raw inputs, derived
metrics and reviewer evidence are retained. A model, version, API, deployment, prompt, content
filter, embedding, chunking or routing-policy change invalidates the affected evidence. Promotion
remains blocked until every gate passes and accountable owners record their decisions.

## 9. Security, privacy and compliance controls

Azure OpenAI, Document Intelligence, Search, Storage, SQL, Service Bus, Key Vault and configuration
services retain private endpoints, central private DNS and public-network denial where supported.
Every database remains publicly inaccessible in every environment. Workloads use separate managed
identities, Microsoft Entra authorisation and least privilege; no shared key or stored credential is
introduced.

Evidence is untrusted until source authority, licence, purpose, classification, malware/content scan
and admission checks pass. Prompt templates separate instructions from evidence; hostile
instructions are treated as data. Cross-case retrieval, caller-defined security filters, citation
spoofing and poisoned-index changes are denied and tested. Material narrative requires accessible
citations and consistent source evidence.

Provider terms and configuration evidence must demonstrate the required no-training-use boundary
before enablement. Telemetry contains route, deployment, policy, validation, latency, token and cost
metadata, not document, prompt or completion bodies. Retention and legal hold remain owner inputs.
GDPR control evidence, EU AI Act role/use-case classification evidence, DORA applicability and
source-licence evidence remain open fail-closed controls; this architecture does not provide a legal
classification or certification.

## 10. Release 1 versus future scope

| Capability | Scope |
|---|---|
| Due-diligence evidence-to-draft | **Release 1** — Document Intelligence → embeddings/Search → Terra, with Sol only for a gated escalation |
| Risk and ESG evidence analysis | **Release 1** — assistive deterministic validation plus Terra or Sol; specialist and human authority retained |
| Automated SFDR reporting | **Future capability — not Release 1** |
| Deal-intelligence copilot and sourcing automation | **Future capability — not Release 1** |
| Portfolio financial-anomaly monitoring | **Future capability — not Release 1** |
| Custom Document Intelligence, supervised anomaly prediction or Model Router evaluation | **Future capability — not Release 1** |

Model availability does not enlarge Release 1, remove the 20-deal cap or weaken source, review,
committee and human-authority controls.

## 11. Operational evidence envelope

Every inference records case and work-item IDs; task class and routing reason; tier, deployment ID,
model and version; API and reasoning-effort setting; prompt, policy, content-filter and route-policy
versions; retrieval and evidence-manifest hashes; structured, citation and factual-consistency
results; escalation and human-review events; and token, latency and cost measurements. Sensitive
bodies are excluded from operational logs.

| WAF pillar | Design response | Trade-off |
|---|---|---|
| Reliability | Fixed routes, fail-closed queues, version pinning and invalidation/recovery evidence | Provider or evidence failure pauses analysis |
| Security | EU Data Zone boundary, private paths, managed identity and human authority | More policy, identity and assurance evidence |
| Cost Optimisation | Luna handles validated routine work; route-level token/cost telemetry supports right-sizing | Three deployments and route benchmarks add fixed governance effort |
| Operational Excellence | IaC-first deployment records, `NoAutoUpgrade`, immutable route evidence, alerts and runbooks | Every material configuration change repeats evaluation and change control |
| Performance Efficiency | Task-tier matching, separate interactive/pack measures and benchmarked capacity | Stronger tiers are unavailable as an unrecorded fallback |

Existing CAF names, tags and pinned AVM candidates remain unchanged. The Azure OpenAI account remains
`oai-stratton-<env>-<loc>-<suffix>` through
`br/public:avm/res/cognitive-services/account:0.12.0`; deployment child resources use owner-supplied
IDs and one parameterised Bicep codebase in the later implementation phase.

## 12. Explicit non-claims and owner inputs

This candidate makes no quota, deployment, runtime-test, production-readiness, achieved-benefit,
specific EU processing-region, certification, regulatory-classification, reviewer-acceptance,
phase-approval or production-promotion claim. Deployment remains blocked.

`REQUIRED_OWNER_INPUT` covers exact primary and recovery Azure resource regions, all deployment
names/IDs, capacity and quota, reasoning effort, embedding dimensions, chunking, commercial terms,
provider-data-use evidence, source licences, retention, control-owner IDs, benchmark evidence and EU
AI Act classification evidence. Missing, expired or mismatched input returns deny. Models do not
make investment decisions, and no lower tier silently replaces an unavailable governed deployment.

## 13. Required AFF-A, AFF-B and human approval

The Rubber Duck Reviewer must use `gpt-5.6-luna` and the Security and Compliance Reviewer must use
`gpt-5.6-terra`, both against the same unchanged candidate manifest. Their reviews must assess the
fixed routes, benchmark gates, EU Data Zone boundary, GDPR and EU AI Act evidence gaps, source
licences, provider data use, prompt injection, private connectivity, logging, retention and human
authority.

Only after both hash-bound reviews converge may the human architect decide this amendment in the
active AI interaction. Reviewers do not approve, certify or waive the subject. Until that decision,
the candidate remains `IMPLEMENTATION_COMPLETE_REVIEW_PENDING` and cannot authorise Azure work or
production promotion.
