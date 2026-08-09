# Task 6 report: delegated Container Apps authentication and least privilege

## Outcome

Implemented the delegated web-to-BFF token path and the supporting Container Apps and RBAC configuration. The web proxy now accepts only the platform-provided `x-ms-token-aad-access-token` for API forwarding, sends it unchanged as the bearer token, and does not decode the token or emit identity/role headers. It has no managed-identity token acquisition path.

## RED evidence

1. Replaced the web proxy contract tests before production changes and ran:
   `npm --workspace @stratton/demo-web test -- server/server.test.ts`
   Result: 2 expected failures. The proxy returned 401 because it still required a decoded client-principal header, and config still required `BFF_TOKEN_SCOPE` and `AZURE_MANAGED_IDENTITY_CLIENT_ID`.
2. Added delegated Container Apps Pester cases before IaC changes and ran:
   `pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1`
   Result: 4 expected failures: the six explicit delegated/completion parameters were absent, token storage was absent, stale web managed-identity token wiring remained, and ARM Reader assignments were absent.

## GREEN evidence

- `npm --workspace @stratton/demo-web test -- server/server.test.ts`: 5 passed.
- `npm --workspace @stratton/demo-web run typecheck`: passed.
- `az bicep lint --file .\infra\main.bicep`: passed (Azure CLI only reported its available Bicep-version notice).
- `az bicep build --file .\infra\main.bicep`: passed.
- `az bicep build-params --file .\infra\parameters\dev.bicepparam`: passed.
- `pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1`: 17 passed, 0 failed.

No Azure login, deployment, what-if, provisioning, or runtime test was run.

## Files changed

- `demo-platform/apps/web/server/server.ts`
- `demo-platform/apps/web/server/server.test.ts`
- `demo-platform/infra/main.bicep`
- `demo-platform/infra/modules/demo-apps/main.bicep`
- `demo-platform/infra/modules/demo-rbac/main.bicep`
- `demo-platform/infra/modules/demo-rbac/role-assignments/cognitive-account-reader.bicep` (new)
- `demo-platform/infra/parameters/dev.bicepparam`
- `demo-platform/infra/ADMIN-HANDOFF.md`
- `demo-platform/tests/iac/DemoInfra.Tests.ps1`

## Configuration and least privilege

- Web auth enables the Container Apps token store, requests `webDelegatedScope`, rejects unauthenticated callers, and remains internal and HTTPS-only.
- BFF auth validates the explicit delegated audience and scope. Its environment supplies the Task 3 OBO inputs: Phase 5 delegated scope and application ID, BFF audience and required scope, tenant token endpoint, and BFF managed-identity client ID. The completion client ID is separately configured for the Phase 5 authorization handoff.
- The stale `PHASE5_TOKEN_SCOPE`, web `BFF_TOKEN_SCOPE`, and web managed-identity settings were removed.
- The BFF gets deterministic ARM Reader assignments only on the supplied Luna, Terra, and Sol Cognitive Services accounts. Existing account-scoped data-plane roles and private/digest-pinned app settings remain unchanged.
- No client secret, account key, or broad Reader scope was introduced.

## Self-review

Reviewed the compiled-template Pester assertions for auth enablement, `Return401`, web token store, delegated scope/audience inputs, absence of stale settings/secrets, and the three-account Reader deployment loop. Reviewed the proxy tests for unchanged token forwarding, absent principal forwarding, missing-token 401, body and response-header preservation, and static SPA behavior.

## Concerns / follow-up

The supplied development parameter values are non-secret placeholders. An Entra administrator must perform the documented registration, consent, federated-credential, completion-authorization, and route-evidence provisioning steps before deployment. Azure CLI noted a newer Bicep release is available; this is informational only and did not affect lint/build results.

## Commit

e28b4e feat: configure delegated demo authentication

## Fix Round 1

### Plan correction

The original Task 6 plan incorrectly depended on Container Apps server-directed authentication and
the Easy Auth token store to provide a delegated BFF access token. The corrected implementation uses
Microsoft-supported client-directed authentication: MSAL Browser runs authorization code + PKCE,
requests the full BFF App ID URI delegated scope, and sends the resulting token to the same-origin web
proxy as one `Authorization: Bearer ...` header. The proxy forwards that header unchanged. No client
secret, certificate, Blob SAS token-store configuration, managed-identity human token, or fabricated
principal header is introduced.

The BFF Easy Auth policy now validates the v2 access-token audience as the BFF application client-ID
GUID and restricts `allowedApplications` to the web public client ID. The BFF then independently
verifies signature, issuer, tenant, expiry, `aud`, approved `azp`, and required `scp`, and binds those
claims to the outer Easy Auth principal. OBO sends `BFF_ENTRA_CLIENT_ID` as `client_id` and uses the
BFF managed-identity federated assertion. Phase 5
`DEMO_AUTHORITY_COMPLETION_CLIENT_ID` is documented as the BFF managed-identity client ID and is not a
BFF runtime setting.

### RED evidence

- `npm --workspace @stratton/demo-web test -- server/server.test.ts src/api/demoClient.test.ts src/app/App.test.tsx`
  - Exit 1: 3 failed files; 6 failed and 19 passed tests. Failures showed the proxy still consumed
    `x-ms-token-aad-access-token`, no public auth config or UI sign-in path existed, and API requests
    did not acquire/send browser delegated tokens.
- `npm --workspace @stratton/demo-bff test -- src/config.test.ts src/identity/delegated-token.test.ts src/identity/identity-resolver.test.ts src/identity/trusted-identity.test.ts src/identity/obo-token-exchange.test.ts`
  - Exit 1: 5 failed files; 10 failed and 20 passed tests. Failures showed missing BFF/web client
    configuration, header-based delegated intake still used the Easy Auth token header, `azp` was not
    enforced, forwarded-principal behavior remained, and OBO omitted `client_id`. One nested-test
    collection mistake in the new test was corrected before GREEN.
- `pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1`
  - Exit 1: 11 passed and 8 failed. Failures showed web server-directed auth/token-store wiring,
    stale audience/completion/proxy settings, missing exact client IDs/allowed application, missing
    Reader de-duplication assertions, stale handoff text, and a duplicated compile harness.

### GREEN and verification evidence

- `npm --workspace @stratton/demo-web test -- server/server.test.ts src/api/demoClient.test.ts src/app/App.test.tsx`
  - Exit 0: 3 files and 25 tests passed.
- `npm --workspace @stratton/demo-bff test -- src/config.test.ts src/identity/delegated-token.test.ts src/identity/identity-resolver.test.ts src/identity/trusted-identity.test.ts src/identity/obo-token-exchange.test.ts`
  - Exit 0: 5 files and 31 tests passed.
- `npm --workspace @stratton/demo-web test`
  - Exit 0: 8 files and 46 tests passed.
- `npm --workspace @stratton/demo-bff test`
  - Exit 0: 27 files and 182 tests passed.
- `npm --workspace @stratton/demo-web run typecheck`
  - Exit 0.
- `npm --workspace @stratton/demo-bff run typecheck`
  - Exit 0.
- `npm --workspace @stratton/demo-web run build`
  - Exit 0; Vite transformed 2,456 modules and emitted the production SPA/server. Vite reported the
    existing informational chunk-size warning.
- `npm --workspace @stratton/demo-bff run build`
  - Exit 0.
- `npm --workspace @stratton/demo-web run lint`
  - Exit 0; Node reported the existing `MODULE_TYPELESS_PACKAGE_JSON` warning.
- `npx eslint apps/bff/src/config.ts apps/bff/src/config.test.ts apps/bff/src/server.ts apps/bff/src/server.test.ts apps/bff/src/identity/delegated-token.ts apps/bff/src/identity/delegated-token.test.ts apps/bff/src/identity/azure-ad-token-verifier.ts apps/bff/src/identity/identity-resolver.ts apps/bff/src/identity/identity-resolver.test.ts apps/bff/src/identity/trusted-identity.ts apps/bff/src/identity/trusted-identity.test.ts apps/bff/src/identity/obo-token-exchange.ts apps/bff/src/identity/obo-token-exchange.test.ts --max-warnings 0`
  - Exit 0; Node reported the same existing module-type warning.
- `az bicep lint --file .\infra\main.bicep`
  - Exit 0; Azure CLI only reported the available Bicep-version notice.
- `az bicep build --file .\infra\main.bicep`
  - Exit 0; Azure CLI only reported the available Bicep-version notice.
- `az bicep build-params --file .\infra\parameters\dev.bicepparam`
  - Exit 0; Azure CLI only reported the available Bicep-version notice.
- `pwsh -NoProfile -File .\tests\iac\Invoke-DemoIaCTests.ps1`
  - Exit 0: 19 passed, 0 failed.
- `git -c core.whitespace=cr-at-eol diff --check`
  - Exit 0 with no output. Generated Bicep JSON outputs were removed after validation.

No Azure login, deployment, what-if, provisioning, or runtime test was run.

### Files changed

- `demo-platform/README.md`
- `demo-platform/apps/web/package.json`
- `demo-platform/apps/web/server/server.ts`
- `demo-platform/apps/web/server/server.test.ts`
- `demo-platform/apps/web/src/api/demoClient.ts`
- `demo-platform/apps/web/src/api/demoClient.test.ts`
- `demo-platform/apps/web/src/app/App.tsx`
- `demo-platform/apps/web/src/app/App.test.tsx` (new)
- `demo-platform/apps/web/src/auth/browserAuth.ts` (new)
- `demo-platform/apps/web/src/main.tsx`
- `demo-platform/apps/bff/src/config.ts`
- `demo-platform/apps/bff/src/config.test.ts`
- `demo-platform/apps/bff/src/server.ts`
- `demo-platform/apps/bff/src/server.test.ts`
- `demo-platform/apps/bff/src/identity/azure-ad-token-verifier.ts`
- `demo-platform/apps/bff/src/identity/delegated-token.ts`
- `demo-platform/apps/bff/src/identity/delegated-token.test.ts`
- `demo-platform/apps/bff/src/identity/identity-resolver.ts`
- `demo-platform/apps/bff/src/identity/identity-resolver.test.ts`
- `demo-platform/apps/bff/src/identity/obo-token-exchange.ts`
- `demo-platform/apps/bff/src/identity/obo-token-exchange.test.ts`
- `demo-platform/apps/bff/src/identity/trusted-identity.ts`
- `demo-platform/apps/bff/src/identity/trusted-identity.test.ts`
- `demo-platform/infra/main.bicep`
- `demo-platform/infra/modules/demo-apps/main.bicep`
- `demo-platform/infra/modules/demo-rbac/main.bicep`
- `demo-platform/infra/modules/demo-rbac/role-assignments/cognitive-account-reader.bicep` (removed;
  generic account-role-assignment module reused)
- `demo-platform/infra/parameters/dev.bicepparam`
- `demo-platform/infra/ADMIN-HANDOFF.md`
- `demo-platform/tests/iac/DemoInfra.Tests.ps1`
- `demo-platform/package-lock.json`
