# Stratton IaC tests

Run local IaC validation:

```powershell
pwsh -NoProfile -File .\cases\Stratton-Europe-Captital\5-coding-r4\tests\iac\Invoke-IaCTests.ps1
```

Test coverage includes:
- warning-free `bicep build` for root, all 17 DU entrypoints, all modules
- warning-free `bicep build-params` for dev/tst/prd
- deterministic root template build hash check
- 32 fail-closed input contract checks
- sentinel preflight blocking contract checks (`REQUIRED_OWNER_INPUT`)
- 22 executable assertion-control checks against rendered ARM templates
- no invented default literals and no inline secrets
- PSRule policy checks (when PSRule module is available)