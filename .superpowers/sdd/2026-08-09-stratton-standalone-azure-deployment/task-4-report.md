# Task 4 Report: Entra Applications and Consent

## Delivered

- Added `scripts/deployment/entra-manifest.json` with the approved display names, identifier URI
  prefix, stable scope IDs, stable Phase 5 completion app-role ID, and federated credential name.
  It contains no credentials, certificates, implicit-grant settings, or tokens.
- Added `scripts/deployment/Set-StrattonEntra.ps1`.
  - Uses only Microsoft Graph v1.0 through `az rest` (via `Invoke-AzJson`).
  - Finds applications by exact display name plus the checked-in identifier URI prefix, failing with
    `ENTRA_APPLICATION_CONFLICT` on ambiguity.
  - Reconciles the SPA redirect URI, BFF and Phase 5 v2 access-token settings, delegated scopes,
    required API access, service principals, tenant-wide delegated grants, BFF federated credential,
    and the Phase 5 application-role assignment.
  - Verifies that the supplied BFF managed-identity principal resolves to the supplied client ID.
  - Restricts the Phase 5 completion role assignment endpoint to that verified BFF managed-identity
    service principal.
  - Refuses an apply lacking BFF managed-identity inputs before any Graph request.
  - Implements read-only `-WhatIf`: all Graph mutations and artifact writes are behind the
    non-WhatIf branch. It reads the three applications and prints a plan.
  - Writes `artifacts/deployment/entra.json` only after a successful apply, with the specified
    non-secret IDs and consent state only.
- Added the shared `Write-DeploymentArtifact` module helper.
- Added Entra Pester coverage and changed the existing deployment test runner to discover all
  deployment test files.

## Validation evidence

1. `npm run test:deployment` completed successfully: **16 passed, 0 failed**.
2. PowerShell parser validation passed for `Set-StrattonEntra.ps1` and
   `Stratton.Deployment.psm1`.
3. The required command completed without Graph mutations:

   ```powershell
   pwsh -NoProfile -File .\scripts\deployment\Set-StrattonEntra.ps1 `
     -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
     -WebRedirectUri 'http://localhost:4173' `
     -WhatIf
   ```

   Its read-only plan listed creates for the web, BFF, and Phase 5 applications. No artifact was
   written.
4. `git -c core.whitespace=cr-at-eol diff --check` completed successfully.

## Self-review

- Confirmed no Graph write (`POST` or `PATCH`) is reachable when `-WhatIf` is used.
- Confirmed no client secret, password credential, certificate, implicit-grant setting, or token is
  represented in the manifest or artifact.
- Confirmed the pre-existing untracked `demo-platform/artifacts/` and
  `demo-platform/infra/standalone/main.json` were not staged or modified.
- No Graph writes or Azure resource changes were made during this task.

## Fix round 1/5

### Addressed findings

- Bound the entry-point tenant parameter to
  `27140306-eea5-4e7f-91e9-4c9e86864b3a` and added an `az account show` tenant
  assertion before reconciliation can issue any Graph request.
- Preserved the matched application object after Graph `PATCH` returns HTTP 204/no content.
- Re-read matched applications with credential and implicit-grant properties selected, then failed
  closed on password credentials, key credentials, implicit access-token issuance, or implicit
  ID-token issuance.
- Required the approved BFF principal to be a `ManagedIdentity` service principal.
- Queried all pages of the Phase 5 service principal's `appRoleAssignedTo` collection and failed
  closed when the completion role was assigned to any principal other than the approved BFF UAMI.
- Kept `-WhatIf` Graph operations read-only and kept output limited to the non-secret plan.

### Exact validation commands and results

1. Full deployment tests:

   ```powershell
   Set-Location "C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform\demo-platform"; npm run test:deployment
   ```

   Result: exit code 0; **25 passed, 0 failed** across `Entra.Tests.ps1` and
   `Preflight.Tests.ps1`.

2. PowerShell parser validation:

   ```powershell
   $paths = @('C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform\demo-platform\scripts\deployment\Set-StrattonEntra.ps1','C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform\demo-platform\tests\deployment\Entra.Tests.ps1'); foreach ($path in $paths) { $tokens=$null; $errors=$null; [System.Management.Automation.Language.Parser]::ParseFile($path,[ref]$tokens,[ref]$errors) | Out-Null; if ($errors.Count -gt 0) { $errors | ForEach-Object { "${path}:$($_.Message)" }; exit 1 } }; 'PowerShell parser validation passed for Set-StrattonEntra.ps1 and Entra.Tests.ps1.'
   ```

   Result: exit code 0; `PowerShell parser validation passed for
   Set-StrattonEntra.ps1 and Entra.Tests.ps1.`

3. Live read-only WhatIf:

   ```powershell
   Set-Location "C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform\demo-platform"; pwsh -NoProfile -File .\scripts\deployment\Set-StrattonEntra.ps1 -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' -WebRedirectUri 'http://localhost:4173' -WhatIf
   ```

   Result: exit code 0; the plan contained only:

   ```text
   Create application  Stratton Demo Web - dev
   Create application  Stratton Demo BFF - dev
   Create application  Stratton Phase 5 API - dev
   ```

   The command performed Graph reads only and emitted no secrets.

4. Whitespace validation:

   ```powershell
   git -C "C:\Users\arsmith\Projects\Stratton-Europe-Captital-private\.worktrees\stratton-demo-platform" -c core.whitespace=cr-at-eol diff --check
   ```

   Result: exit code 0 with no output.
