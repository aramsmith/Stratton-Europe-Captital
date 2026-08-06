# Task 1 Report

Status: DONE_WITH_CONCERNS

Files changed:
- demo-platform/package.json
- demo-platform/package-lock.json
- demo-platform/tsconfig.base.json
- demo-platform/eslint.config.js
- demo-platform/apps/web/package.json
- demo-platform/apps/web/tsconfig.json
- demo-platform/apps/web/vite.config.ts
- demo-platform/apps/bff/package.json
- demo-platform/apps/bff/tsconfig.json
- demo-platform/packages/contracts/package.json
- demo-platform/packages/contracts/tsconfig.json
- demo-platform/packages/contracts/src/index.ts
- demo-platform/packages/contracts/src/index.test.ts
- demo-platform/packages/scenario-data/package.json
- demo-platform/packages/scenario-data/tsconfig.json
- demo-platform/packages/scenario-data/src/index.ts
- demo-platform/packages/azure-ai-document-intelligence/package.json
- demo-platform/packages/azure-ai-document-intelligence/src/index.ts

Commits:
- 1f2d8b1 chore: initialise Stratton demo workspace

Tests:
- `Set-Location 'C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform\demo-platform'; npm install --no-audit --no-fund` → passed; added 582 packages.
- `Set-Location 'C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform\demo-platform'; npm --workspace @stratton/contracts test` → passed.
- `Set-Location 'C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform\demo-platform'; npm --workspace @stratton/contracts run typecheck` → passed.
- `Set-Location 'C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform\demo-platform'; npm --workspace @stratton/contracts run build` → passed.

Self-review notes:
- Verified the contract test fails before implementation, then passes after adding the zod schemas and invariant.
- Confirmed the shared exports compile under strict TypeScript.
- Kept changes isolated to `demo-platform/` and avoided `5-coding-r4/`.

Concerns:
- Added local workspace stubs for `@azure/ai-document-intelligence` and `@stratton/scenario-data` so the exact manifest could install in this environment.
- Web and BFF are still scaffolds only; later tasks must add actual runtime code and broader workspace validation.

## Fix round 1

Status: DONE

Files changed:
- `demo-platform/apps/bff/package.json`
- `demo-platform/apps/bff/src/server.ts`
- `demo-platform/apps/bff/src/server.test.ts`
- `demo-platform/apps/web/tsconfig.json`
- `demo-platform/apps/web/index.html`
- `demo-platform/apps/web/src/app.ts`
- `demo-platform/apps/web/src/app.test.ts`
- `demo-platform/apps/web/src/main.tsx`
- `demo-platform/docs/superpowers/plans/2026-08-06-stratton-evidence-to-decision-demos.md`
- `demo-platform/package-lock.json`
- `demo-platform/packages/contracts/src/index.ts`
- `demo-platform/packages/contracts/src/index.test.ts`
- `demo-platform/packages/azure-ai-document-intelligence/` removed

Commands/results:
- `npm --workspace @stratton/contracts test` → passed; 4 tests passed, including quarantined/rejected evidence coverage.
- `npm install` in `demo-platform`, `demo-platform/packages/contracts`, `demo-platform/apps/bff`, and `demo-platform/apps/web` → passed and refreshed the workspace installs/lockfile.
- `npm run validate` → passed end-to-end (lint, typecheck, test, build).

Commit hash:
- `914cd65` `fix: enforce evidence admission and restore workspace validation`

Self-review:
- The new scenario-level invariant blocks material findings from citing quarantined or rejected evidence.
- The workspace now uses the official Azure REST document intelligence package and no longer tracks the shadow package.
- Minimal app entrypoints/tests exist for web and BFF, and the root validation pipeline is green.
