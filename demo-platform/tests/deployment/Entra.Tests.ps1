Set-StrictMode -Version Latest

Describe 'Stratton Entra reconciliation' {
  BeforeAll {
    $script:repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $script:manifestPath = Join-Path $script:repoRoot 'scripts\deployment\entra-manifest.json'
    $script:entraScriptPath = Join-Path $script:repoRoot 'scripts\deployment\Set-StrattonEntra.ps1'
    . $script:entraScriptPath -LoadOnly

    function New-TestMatchedApplication {
      param(
        [object[]] $PasswordCredentials = @(),
        [object[]] $KeyCredentials = @(),
        [bool] $EnableAccessTokenIssuance = $false,
        [bool] $EnableIdTokenIssuance = $false
      )

      return [pscustomobject]@{
        id = '11111111-1111-1111-1111-111111111111'
        appId = '22222222-2222-2222-2222-222222222222'
        displayName = 'Stratton Demo Web - dev'
        identifierUris = @('api://27140306-eea5-4e7f-91e9-4c9e86864b3a/stratton-demo-web-dev')
        passwordCredentials = @($PasswordCredentials)
        keyCredentials = @($KeyCredentials)
        web = [pscustomobject]@{
          redirectUris = @()
          implicitGrantSettings = [pscustomobject]@{
            enableAccessTokenIssuance = $EnableAccessTokenIssuance
            enableIdTokenIssuance = $EnableIdTokenIssuance
          }
        }
        spa = [pscustomobject]@{ redirectUris = @('http://old.example') }
        api = $null
        appRoles = @()
        requiredResourceAccess = @()
      }
    }
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

  It 'uses tenant-scoped identifier URIs accepted by the Entra application policy' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $expectedPrefix = 'api://27140306-eea5-4e7f-91e9-4c9e86864b3a/stratton-demo-'

    $manifest.identifierUriPrefix | Should -Be $expectedPrefix
    @($manifest.applications.identifierUri).Count | Should -Be 3
    @($manifest.applications.identifierUri | Where-Object {
        -not $_.StartsWith($expectedPrefix, [System.StringComparison]::Ordinal)
      }).Count | Should -Be 0
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
    $script | Should -Match 'signInAudience'
  }

  It 'passes Graph JSON through a temporary body file and cleans it up' {
    $script:bodyFilePath = $null
    $body = [ordered]@{
      displayName = 'Stratton Demo Web - dev'
      identifierUris = @('api://stratton-demo-web-dev')
    }

    $result = Invoke-Graph `
      -Method POST `
      -Uri 'https://graph.microsoft.com/v1.0/applications' `
      -Body $body `
      -AzInvoker {
        param([string[]] $Arguments)

        $bodyArgumentIndex = [array]::IndexOf($Arguments, '--body')
        $bodyReference = $Arguments[$bodyArgumentIndex + 1]
        $script:bodyFilePath = $bodyReference.Substring(1)
        Test-Path -LiteralPath $script:bodyFilePath | Should -BeTrue
        (Get-Content -LiteralPath $script:bodyFilePath -Raw | ConvertFrom-Json).displayName |
          Should -Be 'Stratton Demo Web - dev'
        ($Arguments -join ' ') | Should -Not -Match '\{"displayName"'
        return [pscustomobject]@{ id = 'created' }
      }

    $result.id | Should -Be 'created'
    Test-Path -LiteralPath $script:bodyFilePath | Should -BeFalse
  }

  It 'cleans up the temporary Graph body file when Azure CLI fails' {
    $script:bodyFilePath = $null

    {
      Invoke-Graph `
        -Method PATCH `
        -Uri 'https://graph.microsoft.com/v1.0/applications/11111111-1111-1111-1111-111111111111' `
        -Body @{ displayName = 'Stratton Demo Web - dev' } `
        -AzInvoker {
          param([string[]] $Arguments)

          $bodyArgumentIndex = [array]::IndexOf($Arguments, '--body')
          $script:bodyFilePath = $Arguments[$bodyArgumentIndex + 1].Substring(1)
          throw 'simulated Azure CLI failure'
        }
    } | Should -Throw 'simulated Azure CLI failure'

    Test-Path -LiteralPath $script:bodyFilePath | Should -BeFalse
  }

  It 'can retain the provisional local redirect while registering the deployed SPA redirect' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $definition = Get-ManifestApplication -Manifest $manifest -Key web

    $desired = New-ApplicationDefinition `
      -Manifest $manifest `
      -Application $definition `
      -WebRedirectUri 'https://stratton.example' `
      -AdditionalWebRedirectUri 'http://localhost:4173'

    @($desired.spa.redirectUris) | Should -Be @(
      'https://stratton.example',
      'http://localhost:4173'
    )
  }

  It 'ignores Graph read-only fields while comparing the controlled application contract' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $definition = Get-ManifestApplication -Manifest $manifest -Key phase5
    $desired = New-ApplicationDefinition `
      -Manifest $manifest `
      -Application $definition `
      -WebRedirectUri 'http://localhost:4173'
    $actual = $desired | ConvertTo-Json -Depth 50 | ConvertFrom-Json -Depth 50
    $actual.api | Add-Member -NotePropertyName acceptMappedClaims -NotePropertyValue $null
    $actual.api.oauth2PermissionScopes[0] |
      Add-Member -NotePropertyName origin -NotePropertyValue 'Application'
    $actual.appRoles[0] |
      Add-Member -NotePropertyName origin -NotePropertyValue 'Application'

    Test-ApplicationMatches -Application $actual -Definition $desired | Should -BeTrue
  }

  It 'rejects mutable API authorization settings outside the controlled contract' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $definition = Get-ManifestApplication -Manifest $manifest -Key bff
    $desired = New-ApplicationDefinition `
      -Manifest $manifest `
      -Application $definition `
      -WebRedirectUri 'http://localhost:4173'
    $actual = $desired | ConvertTo-Json -Depth 50 | ConvertFrom-Json -Depth 50
    $actual.api | Add-Member -NotePropertyName acceptMappedClaims -NotePropertyValue $true
    $actual.api | Add-Member -NotePropertyName knownClientApplications -NotePropertyValue @(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    )
    $actual.api | Add-Member -NotePropertyName preAuthorizedApplications -NotePropertyValue @(
      [pscustomobject]@{
        appId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
        delegatedPermissionIds = @($manifest.webToBffScopeId)
      }
    )

    Test-ApplicationMatches -Application $actual -Definition $desired | Should -BeFalse
  }

  It 'rejects every federated credential outside the exact approved set' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $plan = [System.Collections.Generic.List[object]]::new()

    {
      Ensure-FederatedCredential `
        -BffApplication ([pscustomobject]@{ id = '11111111-1111-1111-1111-111111111111' }) `
        -Manifest $manifest `
        -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
        -BffManagedIdentityPrincipalId '22222222-2222-2222-2222-222222222222' `
        -Plan $plan `
        -WhatIf `
        -GraphInvoker {
          [pscustomobject]@{
            value = @(
              [pscustomobject]@{ name = $manifest.federatedCredentialName }
              [pscustomobject]@{ name = 'unauthorized-workload' }
            )
          }
        }
    } | Should -Throw 'ENTRA_FEDERATED_CREDENTIAL_SCOPE_VIOLATION'
  }

  It 'allows the documented plan-only WhatIf command without BFF identity arguments' {
    $script = Get-Content $script:entraScriptPath -Raw

    $script | Should -Match "ValidatePattern\('\^\$\|"
  }

  It 'performs Graph reads but no Graph writes in WhatIf mode' {
    $script:graphRequests = [System.Collections.Generic.List[object]]::new()

    $result = Invoke-StrattonEntraReconciliation `
      -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
      -WebRedirectUri 'http://localhost:4173' `
      -WhatIf `
      -AccountInvoker {
        [pscustomobject]@{ tenantId = '27140306-eea5-4e7f-91e9-4c9e86864b3a' }
      } `
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

  It 'rejects a tenant other than the approved tenant before account or Graph calls' {
    $script:accountCalls = 0
    $script:graphCalls = 0

    {
      Invoke-StrattonEntraReconciliation `
        -TenantId 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' `
        -WebRedirectUri 'http://localhost:4173' `
        -WhatIf `
        -AccountInvoker {
          $script:accountCalls++
          [pscustomobject]@{ tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
        } `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          $script:graphCalls++
          [pscustomobject]@{ value = @() }
        }
    } | Should -Throw 'ENTRA_TENANT_NOT_APPROVED'

    $script:accountCalls | Should -Be 0
    $script:graphCalls | Should -Be 0
  }

  It 'rejects the wrong active Azure tenant before any Graph call' {
    $script:graphCalls = 0

    {
      Invoke-StrattonEntraReconciliation `
        -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
        -WebRedirectUri 'http://localhost:4173' `
        -WhatIf `
        -AccountInvoker {
          [pscustomobject]@{ tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }
        } `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          $script:graphCalls++
          [pscustomobject]@{ value = @() }
        }
    } | Should -Throw 'ENTRA_AZURE_TENANT_MISMATCH'

    $script:graphCalls | Should -Be 0
  }

  It 'preserves the existing application when Graph PATCH returns no content' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $definition = Get-ManifestApplication -Manifest $manifest -Key web
    $existingApplication = New-TestMatchedApplication
    $plan = [System.Collections.Generic.List[object]]::new()

    $application = Ensure-StrattonApplication `
      -Manifest $manifest `
      -ApplicationDefinition $definition `
      -DesiredDefinition (New-ApplicationDefinition `
        -Manifest $manifest `
        -Application $definition `
        -WebRedirectUri 'http://localhost:4173') `
      -Plan $plan `
      -GraphInvoker {
        param($Method, $Uri, $Body)

        if ($Uri -match '/applications\?') {
          return [pscustomobject]@{ value = @($existingApplication) }
        }

        if ($Method -eq 'GET') {
          return $existingApplication
        }

        return $null
      }

    $application.id | Should -Be '11111111-1111-1111-1111-111111111111'
    $application.appId | Should -Be '22222222-2222-2222-2222-222222222222'
    @($plan | Where-Object action -eq 'Update application') | Should -HaveCount 1
  }

  It 'rejects an existing matched application with password credentials' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $definition = Get-ManifestApplication -Manifest $manifest -Key web
    $application = New-TestMatchedApplication -PasswordCredentials @(
      [pscustomobject]@{
        displayName = 'prohibited-secret'
        keyId = '33333333-3333-3333-3333-333333333333'
      }
    )

    {
      Find-StrattonApplication `
        -Definition $definition `
        -IdentifierUriPrefix $manifest.identifierUriPrefix `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          if ($Uri -match '&') {
            throw 'WINDOWS_AZ_URI_SPLIT'
          }
          if ($Uri -match '/applications\?') {
            return [pscustomobject]@{
              value = @(
                [pscustomobject]@{
                  id = $application.id
                  appId = $application.appId
                  displayName = $application.displayName
                  identifierUris = @($application.identifierUris)
                }
              )
            }
          }

          return $application
        }
    } | Should -Throw 'ENTRA_APPLICATION_PASSWORD_CREDENTIALS_PROHIBITED'
  }

  It 'rejects an existing matched application with key credentials' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $definition = Get-ManifestApplication -Manifest $manifest -Key web
    $application = New-TestMatchedApplication -KeyCredentials @(
      [pscustomobject]@{
        displayName = 'prohibited-certificate'
        keyId = '44444444-4444-4444-4444-444444444444'
        type = 'AsymmetricX509Cert'
        usage = 'Verify'
      }
    )

    {
      Find-StrattonApplication `
        -Definition $definition `
        -IdentifierUriPrefix $manifest.identifierUriPrefix `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          if ($Uri -match '/applications\?') {
            return [pscustomobject]@{ value = @($application) }
          }

          return $application
        }
    } | Should -Throw 'ENTRA_APPLICATION_KEY_CREDENTIALS_PROHIBITED'
  }

  It 'rejects an existing matched application with implicit access-token issuance' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $definition = Get-ManifestApplication -Manifest $manifest -Key web
    $application = New-TestMatchedApplication -EnableAccessTokenIssuance $true

    {
      Find-StrattonApplication `
        -Definition $definition `
        -IdentifierUriPrefix $manifest.identifierUriPrefix `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          if ($Uri -match '/applications\?') {
            return [pscustomobject]@{ value = @($application) }
          }

          return $application
        }
    } | Should -Throw 'ENTRA_APPLICATION_IMPLICIT_GRANT_PROHIBITED'
  }

  It 'rejects an existing matched application with implicit ID-token issuance' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $definition = Get-ManifestApplication -Manifest $manifest -Key web
    $application = New-TestMatchedApplication -EnableIdTokenIssuance $true

    {
      Find-StrattonApplication `
        -Definition $definition `
        -IdentifierUriPrefix $manifest.identifierUriPrefix `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          if ($Uri -match '/applications\?') {
            return [pscustomobject]@{ value = @($application) }
          }

          return $application
        }
    } | Should -Throw 'ENTRA_APPLICATION_IMPLICIT_GRANT_PROHIBITED'
  }

  It 'rejects a managed identity principal whose client ID is not the BFF client ID' {
    {
      Get-BffManagedIdentityServicePrincipal `
        -PrincipalId '11111111-1111-1111-1111-111111111111' `
        -ClientId '22222222-2222-2222-2222-222222222222' `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          [pscustomobject]@{
            id = '11111111-1111-1111-1111-111111111111'
            appId = '33333333-3333-3333-3333-333333333333'
            servicePrincipalType = 'ManagedIdentity'
          }
        }
    } | Should -Throw 'ENTRA_BFF_MANAGED_IDENTITY_MISMATCH'
  }

  It 'rejects an ordinary application service principal as the BFF managed identity' {
    {
      Get-BffManagedIdentityServicePrincipal `
        -PrincipalId '11111111-1111-1111-1111-111111111111' `
        -ClientId '22222222-2222-2222-2222-222222222222' `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          [pscustomobject]@{
            id = '11111111-1111-1111-1111-111111111111'
            appId = '22222222-2222-2222-2222-222222222222'
            servicePrincipalType = 'Application'
          }
        }
    } | Should -Throw 'ENTRA_BFF_MANAGED_IDENTITY_TYPE_INVALID'
  }

  It 'rejects a Phase 5 completion-role assignment to a foreign principal' {
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $plan = [System.Collections.Generic.List[object]]::new()
    $script:graphRequests = [System.Collections.Generic.List[object]]::new()

    {
      Ensure-Phase5CompletionRoleAssignment `
        -Phase5ServicePrincipal ([pscustomobject]@{
          id = '55555555-5555-5555-5555-555555555555'
        }) `
        -Manifest $manifest `
        -BffManagedIdentityServicePrincipal ([pscustomobject]@{
          id = '11111111-1111-1111-1111-111111111111'
        }) `
        -Plan $plan `
        -WhatIf `
        -GraphInvoker {
          param($Method, $Uri, $Body)

          $script:graphRequests.Add([pscustomobject]@{
              method = $Method
              uri = $Uri
            })
          if ($Uri -notmatch 'page=2') {
            return [pscustomobject]@{
              value = @()
              '@odata.nextLink' = 'https://graph.microsoft.com/v1.0/servicePrincipals/55555555-5555-5555-5555-555555555555/appRoleAssignedTo?page=2'
            }
          }

          [pscustomobject]@{
            value = @(
              [pscustomobject]@{
                id = '66666666-6666-6666-6666-666666666666'
                principalId = '77777777-7777-7777-7777-777777777777'
                resourceId = '55555555-5555-5555-5555-555555555555'
                appRoleId = '647359fa-8313-475c-a34b-bdca05b1f329'
              }
            )
          }
        }
    } | Should -Throw 'ENTRA_PHASE5_ROLE_ASSIGNED_TO_FOREIGN_PRINCIPAL'

    @($script:graphRequests | Where-Object method -ne 'GET') | Should -BeNullOrEmpty
    @($script:graphRequests | Where-Object uri -match '/appRoleAssignedTo') | Should -HaveCount 2
  }

  It 'rejects an apply without BFF managed identity inputs before making Graph calls' {
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
