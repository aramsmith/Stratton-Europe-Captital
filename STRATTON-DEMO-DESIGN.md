# Stratton Evidence-to-Decision Demos — Design

**Date:** 6 August 2026  
**Status:** Approved design  
**Case:** Stratton Europe Capital, Release 1  
**Audience:** Investment leadership, deal teams, Legal, Compliance, AI Governance, Internal Audit, and technology decision-makers

## 1. Purpose

Create two core, realistic Azure-hosted demos and one compact optional demo that represent the
Stratton case rather than the Agentic Architecture Factory process.

The demos must show how Stratton can accelerate due diligence while preserving evidence quality,
human investment authority, regulatory controls, and auditability. They will use one coherent
synthetic private-equity opportunity so the audience can follow evidence from intake through a
committee-ready recommendation.

## 2. Success criteria

The demo suite must:

- present a credible Microsoft-native business application suitable for enterprise users;
- implement functional evidence, analysis, review, decision-preparation, and governance flows;
- show the AI workbench as a visible primary user experience;
- demonstrate source-linked findings and 100% citation coverage for material demo claims;
- expose contradictions, anomalies, risks, and unresolved conditions in a reproducible scenario;
- require human acceptance, challenge, and specialist review at the appropriate stages;
- prevent the system from issuing or implying an investment decision;
- demonstrate fail-closed responses for missing evidence, policy failures, and unavailable AI routes;
- deploy to Azure using synthetic data only; and
- provide a resettable scenario for repeatable demonstrations.

## 3. Scope

### 3.1 Core demos

1. **Stratton AI Deal Workbench** — governed evidence intake, extraction, comparison, anomaly and
   risk analysis, citations, and deal-professional review.
2. **Stratton Investment Decision Room** — material-claim challenge, specialist approvals,
   unresolved-condition gates, recommendation drafting, and committee preparation.

### 3.2 Optional compact demo

3. **Stratton Governance & Assurance Console** — evidence lineage, policy decisions, model routing,
   security-gate results, human approvals, and Internal Audit export readiness.

The third demo is a bounded workspace over the same case and platform. It is not a separate product.

### 3.3 Non-goals

- Real Stratton, portfolio-company, employee, or counterparty data.
- Autonomous investment recommendations, approvals, decisions, or transactions.
- Production source-system write-back.
- Formal legal, regulatory, audit, or compliance certification.
- A complete production rollout or proof of achieved production service levels.
- Separate applications or duplicated back ends for each demo.

## 4. Shared scenario

All demos use the fictional **Project Danube** opportunity. The resettable synthetic data room
contains financial, commercial, legal, ESG, and operational evidence with known expected outcomes.

The scenario includes:

- a board pack and ERP export with conflicting customer-rebate values;
- recurring operating costs represented as one-off EBITDA adjustments;
- a quality-of-earnings report with licensed external-evidence metadata;
- a material environmental-permit transfer condition;
- customer-concentration evidence;
- deliberately incomplete, expired, unlicensed, and cross-case evidence for negative tests; and
- known human-review and policy outcomes for deterministic demo replay.

The principal analytical finding is that adjusted EBITDA may be overstated by a synthetic
EUR 4.2–5.1 million range. This is scenario data, not a statement about Stratton or a real company.

## 5. User experience

### 5.1 Design language

Use a **Dynamics 365-style shell with custom Fluent 2 workspaces**.

The shared shell provides:

- Microsoft-style app header and left navigation;
- deal records, stages, owners, activities, and audit timeline;
- role-aware navigation for Deals, Evidence, Decisions, and Governance; and
- consistent case and workflow status across the three workspaces.

Custom Fluent workspaces provide the space required for AI findings, evidence comparison, risk
visualisation, citations, review panels, and assurance evidence. The design should feel
Microsoft-native without copying a Dynamics product screen or forcing analytical work into standard
CRM forms.

### 5.2 Demo 1 — Stratton AI Deal Workbench

The workbench is the main analyst experience. It must visibly support:

- governed document-pack upload and admission status;
- evidence inventory, provenance, ownership, classification, and licence state;
- document extraction and source preview;
- natural-language analytical tasks;
- cross-document comparison;
- numerical anomaly and contradiction detection;
- financial, commercial, legal, ESG, and operational risk views;
- AI findings with confidence, materiality, and source-resolvable citations;
- an evidence side panel that opens the cited source location;
- visible model route and processing status where useful; and
- deal-professional accept, edit, reject, or challenge actions.

Approved or challenged findings pass to Demo 2 with their evidence and review history intact.

### 5.3 Demo 2 — Stratton Investment Decision Room

The decision room must visibly support:

- deal stage and committee-preparation status;
- reviewed material findings received from Demo 1;
- claim-by-claim evidence and reviewer disposition;
- Legal and Compliance review requirements;
- open challenges, conditions, and accountable owners;
- a source-linked, AI-assembled recommendation draft;
- an explicit statement that the AI cannot issue an investment decision;
- a blocked committee-submission action while mandatory conditions remain unresolved;
- final committee-pack preparation after required reviews; and
- an append-only audit timeline of material human and system actions.

The Investment Committee decision remains outside system authority.

### 5.4 Demo 3 — Stratton Governance & Assurance Console

The compact console must show:

- evidence lineage from source admission to recommendation claim;
- policy decisions for purpose, role, case, licence, location, and evidence state;
- the Luna, Terra, or Sol route selected for each task and the reason;
- primary or approved recovery deployment status;
- prompt-injection, citation-spoofing, cross-case retrieval, and authority-abuse gate outcomes;
- model, prompt, index, filter, and policy version evidence;
- material human approvals and unresolved control items;
- operational trace correlation; and
- a controlled Internal Audit evidence-export preview.

The workload must not create, alter, or imply an Internal Audit verdict.

## 6. Architecture

### 6.1 Application packaging

Build one deployable platform with three route-level workspaces:

- a React and TypeScript web application using Fluent 2 components;
- a typed private application API;
- an asynchronous document and analysis worker; and
- shared scenario, policy, evidence, review, and audit services.

Each workspace has a single clear purpose and consumes stable API contracts. The workspaces share the
shell and case context but do not directly depend on one another's internal components.

### 6.2 Azure services

The functional slice uses:

- Microsoft Entra ID for user identity and application roles;
- Azure Container Apps for the web application, API, and worker;
- Azure API Management as the governed API boundary where included by the deployment topology;
- Azure AI Document Intelligence for structural extraction;
- Azure AI Search for rebuildable, security-filtered retrieval;
- Azure OpenAI deployments for governed Luna, Terra, and Sol task routes;
- Azure SQL Database for cases, evidence metadata, claims, reviews, policy decisions, and work state;
- Azure Blob Storage for synthetic source evidence and audit exports;
- Azure Service Bus for document and analysis jobs; and
- Application Insights and Log Analytics for correlated operational telemetry.

The demo should reuse the existing Stratton Phase 5 implementation and infrastructure where it
matches this design. New code must not duplicate an existing service or contract without a documented
reason.

## 7. Data and functional flow

The principal flow is:

`Synthetic evidence upload → quarantine → admission and provenance checks → extraction → indexing →
AI retrieval and analysis → cited finding → human acceptance or challenge → specialist review →
condition enforcement → committee-ready draft → governance and audit evidence`

Key rules:

- Azure AI Search is derived and rebuildable, not authoritative.
- Every material finding and recommendation claim resolves to admitted evidence.
- Unlicensed, expired, revoked, or cross-case evidence is excluded.
- Raw document and prompt bodies are not written to operational telemetry.
- AI-generated output remains draft content until the required human action is recorded.
- The recommendation draft cannot transition to an investment decision.

## 8. Model and analytical behaviour

Use deterministic task routing aligned with the Stratton design:

- Luna for evidence triage, query rewriting, and first-pass summaries;
- Terra for grounded analysis, cross-document comparison, and ESG normalisation; and
- Sol for complex risk synthesis and investment-thesis challenge.

Numerical anomaly detection uses deterministic rules and statistical checks as the primary detector.
AI may explain or contextualise an anomaly but cannot override the underlying calculation.

Escalation occurs for validation failure, low confidence, conflicting material evidence,
high-consequence specialist conclusions, or an authorised human request. Missing approved route or
recovery evidence queues the work or returns a controlled failure; it never triggers silent model or
region substitution.

## 9. Error handling and control behaviour

The user interface must present actionable, non-success-shaped failure states.

- Failed evidence admission explains the blocking policy and required owner action.
- Missing or unresolved citations block material narrative generation.
- Cross-case access or caller-filter override returns a denial and records a security event.
- Role, purpose, or case-policy failure prevents access to the affected operation.
- AI deployment unavailability queues eligible work or returns controlled failure.
- Analysis errors preserve the last valid state and offer an idempotent retry where safe.
- Unresolved Legal or Compliance conditions visibly block committee submission.
- Audit-export failure does not alter the case or review state.

No failure path may fabricate an answer, drop a control, silently broaden access, or imply success.

## 10. Security and privacy

- Use synthetic data only.
- Authenticate users with Entra ID and authorise by application role, case, and purpose.
- Use managed identity for Azure service access.
- Keep production-shaped service paths private where supported by the approved deployment scope.
- Preserve case isolation in SQL and Search filters.
- Reject raw sensitive payload fields that are not required by the contract.
- Store secrets in Azure Key Vault or deployment configuration, never in source code or demo data.
- Record provenance, model route, policy result, citation, and material human action.
- Prohibit foundation-model training with demo content.
- Keep the experience explicit that governance evidence is not legal certification.

## 11. Testing strategy

### 11.1 Automated tests

- Component, keyboard-navigation, colour-contrast, and accessibility tests for each workspace.
- Typed API contract tests between the web application, API, and worker.
- Integration tests for SQL, Blob, Service Bus, Search, Document Intelligence, and model adapters.
- Scenario tests covering the complete Project Danube evidence-to-decision journey.
- Deterministic tests for expected anomalies, contradictions, citations, and review gates.
- Negative tests for missing citations, unlicensed evidence, cross-case retrieval, caller-filter
  override, direct and indirect prompt injection, unavailable AI routes, and attempted autonomous
  authority.
- Reset tests proving the scenario returns to a known initial state.

### 11.2 Azure validation

Azure smoke tests verify:

- Entra sign-in and role enforcement;
- application-to-service managed identity;
- private or governed service connectivity;
- durable case and review state;
- queue processing and idempotent retries;
- evidence extraction, retrieval, citation resolution, and model routing;
- telemetry correlation without sensitive bodies; and
- repeatable scenario reset.

### 11.3 Demo acceptance

The suite is demo-ready only when:

- expected findings reproduce from a clean reset;
- every material visible claim has a resolvable citation;
- all required human and specialist gates behave as designed;
- negative scenarios fail closed and visibly;
- no real confidential or personal data is present;
- no screen implies that AI made the investment decision; and
- the deployed Azure environment can complete the scripted journey without manual data repair.

## 12. Delivery boundary

The first implementation plan should deliver the platform in vertical slices:

1. shared shell, identity, case scenario, and reset capability;
2. governed evidence flow and AI Deal Workbench;
3. review workflow and Investment Decision Room;
4. Governance & Assurance Console;
5. Azure integration, observability, negative tests, and scripted demo hardening.

Deployment and runtime testing require explicit approval at the point defined by the Stratton case
governance. This design does not itself authorise Azure provisioning or claim runtime success.
