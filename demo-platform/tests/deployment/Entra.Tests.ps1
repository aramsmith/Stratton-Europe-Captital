Set-StrictMode -Version Latest

Describe 'Stratton Entra reconciliation' {
  BeforeAll {
    $script:repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $script:manifestPath = Join-Path $script:repoRoot 'scripts\deployment\entra-manifest.json'
    $script:entraScriptPath = Join-Path $script:repoRoot 'scripts\deployment\Set-StrattonEntra.ps1'
  }

  It 'rejects password credentials and implicit grant settings' {
    $manifest = Get-Content $manifestPath -Raw

    $manifest | Should -Not -Match 'passwordCredentials|clientSecret|oauth2AllowImplicitFlow'
  }

  It 'uses stable permission IDs from the checked-in manifest' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json

    $manifest.webToBffScopeId | Should -Be '2f6ce5c5-41cf-4b72-b68f-50ed84c16639'
    $manifest.bffToPhase5ScopeId | Should -Be '3d79267d-cd71-47d2-8136-091c4e0184c8'
    $manifest.phase5CompletionRoleId | Should -Be '647359fa-8313-475c-a34b-bdca05b1f329'
  }

  It 'uses the approved exact display names and Microsoft Graph v1.0' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $script = Get-Content $script:entraScriptPath -Raw

    @($manifest.applications.displayName) | Should -Be @(
      'Stratton Demo Web - dev',
      'Stratton Demo BFF - dev',
      'Stratton Phase 5 API - dev'
    )
    $script | Should -Match 'https://graph\.microsoft\.com/v1\.0'
  }

  It 'allows the documented plan-only WhatIf command without BFF identity arguments' {
    $script = Get-Content $script:entraScriptPath -Raw

    $script | Should -Match "ValidatePattern\('\^\$\|"
  }

  It 'performs Graph reads but no Graph writes in WhatIf mode' {
    . $script:entraScriptPath -LoadOnly
    $script:graphRequests = [System.Collections.Generic.List[object]]::new()

    $result = Invoke-StrattonEntraReconciliation `
      -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
      -WebRedirectUri 'http://localhost:4173' `
      -WhatIf `
      -GraphInvoker {
        param($Method, $Uri, $Body)

        $script:graphRequests.Add([pscustomobject]@{
            method = $Method
            uri = $Uri
            body = $Body
          })

        return [pscustomobject]@{ value = @() }
      }

    @($script:graphRequests | Where-Object method -ne 'GET') | Should -BeNullOrEmpty
    @($script:graphRequests | Where-Object uri -match '/applications\?') | Should -HaveCount 3
    $result.mode | Should -Be 'WhatIf'
    @($result.plan | Where-Object action -eq 'Create application') | Should -HaveCount 3
  }

  It 'rejects a managed identity principal whose client ID is not the BFF client ID' {
    . $script:entraScriptPath -LoadOnly

    {
      Get-BffManagedIdentityServicePrincipal `
        -PrincipalId '11111111-1111-1111-1111-111111111111' `
        -ClientId '22222222-2222-2222-2222-222222222222' `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          [pscustomobject]@{
            id = '11111111-1111-1111-1111-111111111111'
            appId = '33333333-3333-3333-3333-333333333333'
          }
        }
    } | Should -Throw 'ENTRA_BFF_MANAGED_IDENTITY_MISMATCH'
  }

  It 'rejects an apply without BFF managed identity inputs before making Graph calls' {
    . $script:entraScriptPath -LoadOnly
    $script:graphRequests = [System.Collections.Generic.List[object]]::new()

    {
      Invoke-StrattonEntraReconciliation `
        -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
        -WebRedirectUri 'http://localhost:4173' `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          $script:graphRequests.Add($Method)
          return [pscustomobject]@{ value = @() }
        }
    } | Should -Throw 'BFF_MANAGED_IDENTITY_INPUT_REQUIRED'

    $script:graphRequests | Should -BeNullOrEmpty
  }
}
