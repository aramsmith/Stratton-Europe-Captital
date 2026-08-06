# Task 5 Report — Stratton AI Deal Workbench vertical slice

## Scope completed
- Implemented the primary AI Deal Workbench vertical slice across the typed BFF and Fluent web UI in `demo-platform`.
- Read the exact Task 5 brief first and kept all code changes out of `5-coding-r4`.
- Preserved the existing Stratton shell, routes, scenario baseline, and typed error/correlation envelope patterns.

## Constraints applied
- Visible AI workbench remains the primary analyst experience.
- Deterministic Luna/Terra/Sol routing is explicit and has no silent fallback.
- Material findings require admitted citations; analysis fails closed when evidence is incomplete.
- Human accept/edit/challenge/reject actions are required for finding disposition.
- Edited findings preserve immutable original AI text via `originalAiSummary` and `textHistory`.
- Synthetic data only; no investment decision operation; no Azure deployment/access work.
- Strict TypeScript maintained.

## TDD execution
1. Added failing contract, BFF, client, and workbench tests first.
2. Ran failing test commands and captured red-state failures for missing schemas, services, client methods, and UI.
3. Implemented minimal BFF and web changes to satisfy those tests.
4. Rebuilt shared workspace packages consumed through `dist` exports.
5. Re-ran targeted tests, fixed lint/type issues, then re-ran full validation.

## BFF changes
- Added `apps/bff/src/analysis/model-router.ts` for deterministic task routing.
- Added `apps/bff/src/analysis/analysis-service.ts` to:
  - require admitted core evidence;
  - call `Phase5Client.requestAnalysis` with deterministic Terra deployment mapping;
  - resolve known scenario findings including canonical `finding-ebitda-quality`;
  - verify all finding citations resolve to admitted evidence;
  - persist findings as `DRAFT`;
  - record route, policy, correlation, and disposition governance events.
- Added `apps/bff/src/evidence/evidence-service.ts` to admit evidence, verify case scope, persist provenance state, and append governance events.
- Added `apps/bff/src/routes/evidence-routes.ts` and `apps/bff/src/routes/analysis-routes.ts` for:
  - `POST /api/evidence/:evidenceId/admit`
  - `POST /api/analysis-runs`
  - `POST /api/findings/:findingId/disposition`
- Updated `apps/bff/src/server.ts` to wire the new services/routes using a local no-Azure Phase 5 client for the demo runtime.
- Extended `apps/bff/src/server.test.ts` to cover evidence admission and non-human disposition denial.

## Web changes
- Extended `apps/web/src/api/demoClient.ts` with typed evidence admission, analysis run, and finding disposition calls.
- Added Fluent workbench components:
  - `DealWorkbenchPage.tsx`
  - `EvidenceTable.tsx`
  - `AnalysisTaskPanel.tsx`
  - `FindingCard.tsx`
  - `CitationPanel.tsx`
- Updated `apps/web/src/app/routes.tsx` so `/workbench` renders the new primary analyst experience.
- Updated `apps/web/src/app/App.tsx` to refresh scenario state after evidence admission, analysis, and human disposition actions.
- Extended `StatusBadge.tsx` for route/provenance states.

## Shared contract and scenario changes
- Extended `packages/contracts/src/index.ts` with:
  - provenance status;
  - finding text history/original AI text support;
  - workbench request/response schemas for evidence admission, analysis runs, and finding disposition;
  - governance event detail support.
- Updated `packages/scenario-data/src/project-danube.ts` with provenance and source preview fields.
- Rebuilt shared package outputs used by the application runtime.

## Tests and validation run
### Red phase
- `npm --workspace @stratton/contracts test -- index.test.ts` → FAIL before implementation.
- `npm --workspace @stratton/demo-bff test -- analysis-service.test.ts evidence-service.test.ts` → FAIL before implementation.
- `npm --workspace @stratton/demo-web test -- demoClient.test.ts DealWorkbenchPage.test.tsx` → FAIL before implementation.

### Targeted validation
- `npm --workspace @stratton/demo-bff test -- analysis-service.test.ts` → PASS.
- `npm --workspace @stratton/demo-web test -- DealWorkbenchPage.test.tsx` → PASS.
- Additional targeted coverage:
  - `npm --workspace @stratton/demo-bff test -- analysis-service.test.ts evidence-service.test.ts server.test.ts` → PASS.
  - `npm --workspace @stratton/demo-web test -- demoClient.test.ts DealWorkbenchPage.test.tsx StrattonShell.test.tsx` → PASS.

### Root validation
- `npm run validate` from `demo-platform` → PASS.
- Observed non-failing pre-existing tool warnings:
  - Node warns that `demo-platform\eslint.config.js` is reparsed as ESM because the root `package.json` lacks `"type": "module"`.
  - Vite warns that the production web chunk exceeds 500 kB after minification.

## Self-review notes
- Confirmed the canonical EBITDA finding matches the required title, summary, route, and citations.
- Confirmed the disposition path rejects non-human principals and preserves original AI text on edited acceptance.
- Confirmed workbench interactions stay source-linked and accessible via explicit labels/headings/buttons.
- Confirmed no code changes were made under `5-coding-r4`.

## Files intentionally not included in this task
- Existing unrelated working tree change: `.superpowers/sdd/2026-08-06-stratton-evidence-to-decision-demos/task-4-report.md` was left untouched and will not be staged with the Task 5 commit.
