Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$modulePath = Join-Path $repoRoot 'scripts\deployment\Stratton.Deployment.psm1'

Import-Module $modulePath -Force

Describe 'Test-StrattonAzurePreflight' {
  BeforeAll {
    $preflightScriptPath = Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path 'scripts\deployment\Test-StrattonAzurePreflight.ps1'
    . $preflightScriptPath -LoadOnly

    function New-OpenAiSkuAvailabilityEvidence {
      [CmdletBinding()]
      param()

      return [pscustomobject]@{
        openAiAccountSkuAvailable = $true
        openAiAccountSkus = @()
        quota = @()
        discoveredOpenAiAccounts = @()
      }
    }

    function New-AvailableOpenAiModelEvidence {
      [CmdletBinding()]
      param(
        [string] $Route = 'LUNA',
        [string] $ModelId = 'gpt-5.6-luna',
        [string] $RequiredVersion = '2026-07-09',
        [string] $QuotaName = 'OpenAI.DataZoneStandard.gpt-5.6-luna'
      )

      return [pscustomobject]@{
        route = $Route
        modelId = $ModelId
        requiredVersion = $RequiredVersion
        discoveryAccountName = 'oai-we'
        discoveryAccountResourceGroup = 'rg-ai'
        available = $true
        quotaName = $QuotaName
        quotaLimit = 100
        quotaCurrentValue = 0
        quotaAvailable = $true
        reason = 'AVAILABLE'
      }
    }
  }

  It 'exports the Azure CLI helper commands' {
    (Get-Command Assert-AzContext -ErrorAction Stop).CommandType | Should -Be 'Function'
    (Get-Command Invoke-AzJson -ErrorAction Stop).CommandType | Should -Be 'Function'
  }

  It 'rejects the wrong subscription, tenant, or user' {
    Mock Invoke-AzJson {
      [pscustomobject]@{
        id = '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
        tenantId = '27140306-eea5-4e7f-91e9-4c9e86864b3a'
        user = [pscustomobject]@{
          name = 'aram@azurelab.nl'
        }
      }
    } -ModuleName Stratton.Deployment

    {
      Assert-AzContext `
        -SubscriptionId 'wrong' `
        -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
        -ExpectedUser 'aram@azurelab.nl'
    } | Should -Throw 'AZURE_CONTEXT_MISMATCH'
  }

  It 'fails closed when a required provider is not registered' {
    $result = ConvertTo-PreflightResult `
      -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
      -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
      -Location 'westeurope' `
      -RequiredProviders @('Microsoft.ServiceBus') `
      -ResourceProviders @(
        [pscustomobject]@{
          namespace = 'Microsoft.ServiceBus'
          registrationState = 'NotRegistered'
        }
      )

    $result.blockingFindings | Should -Contain 'AZURE_PROVIDER_UNREGISTERED:Microsoft.ServiceBus'
  }

  It 'allows only provider-registration findings to reach the separate approval gate' {
    $providerOnly = [pscustomobject]@{
      blockingFindings = @('AZURE_PROVIDER_UNREGISTERED:Microsoft.ServiceBus')
    }
    $mixed = [pscustomobject]@{
      blockingFindings = @(
        'AZURE_PROVIDER_UNREGISTERED:Microsoft.ServiceBus',
        'AZURE_OPENAI_MODEL_UNAVAILABLE'
      )
    }

    {
      Assert-StrattonPreflightResult -Result $providerOnly -AllowProviderRegistrationPending
    } | Should -Not -Throw
    {
      Assert-StrattonPreflightResult -Result $mixed -AllowProviderRegistrationPending
    } | Should -Throw 'AZURE_PREFLIGHT_BLOCKED:AZURE_OPENAI_MODEL_UNAVAILABLE'
  }

  It 'marks a missing Azure OpenAI model or quota as blocking' {
    $result = ConvertTo-PreflightResult -OpenAiModels @() -RequiredProviders @()

    $result.blockingFindings | Should -Contain 'AZURE_OPENAI_MODEL_UNAVAILABLE'
  }

  It 'defaults the OpenAI location to the platform location for existing callers' {
    $result = ConvertTo-PreflightResult `
      -Location 'swedencentral' `
      -RequiredProviders @() `
      -SkuAvailability (New-OpenAiSkuAvailabilityEvidence) `
      -OpenAiModels @((New-AvailableOpenAiModelEvidence))

    $result.location | Should -Be 'swedencentral'
    $result.openAiLocation | Should -Be 'swedencentral'
  }

  It 'defers only account-scoped model discovery for an empty standalone subscription' {
    $result = ConvertTo-PreflightResult `
      -RequiredProviders @() `
      -SkuAvailability (New-OpenAiSkuAvailabilityEvidence) `
      -OpenAiModels @(
        [pscustomobject]@{
          route = 'LUNA'
          modelId = 'gpt-5.6-luna'
          available = $false
          quotaAvailable = $true
          reason = 'NO_OPENAI_ACCOUNT_AVAILABLE_FOR_LIST_MODELS'
        }
      )

    $result.blockingFindings | Should -Not -Contain 'AZURE_OPENAI_MODEL_UNAVAILABLE'
    $result.blockingFindings | Should -Not -Contain 'AZURE_OPENAI_QUOTA_UNAVAILABLE'
  }

  It 'requires remaining DataZoneStandard quota for every deployed route' {
    $scriptText = Get-Content $modulePath -Raw
    $scriptText | Should -Not -Match 'OpenAI\.GlobalStandard\.'

    $result = ConvertTo-PreflightResult `
      -RequiredProviders @() `
      -SkuAvailability (New-OpenAiSkuAvailabilityEvidence) `
      -OpenAiModels @(
        [pscustomobject]@{
          route = 'LUNA'
          modelId = 'gpt-5.6-luna'
          available = $false
          quotaAvailable = $false
          reason = 'NO_OPENAI_ACCOUNT_AVAILABLE_FOR_LIST_MODELS'
        }
      )

    $result.blockingFindings | Should -Contain 'AZURE_OPENAI_QUOTA_UNAVAILABLE'
  }

  It 'blocks when location allow evidence is indeterminate' {
    $result = ConvertTo-PreflightResult `
      -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
      -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
      -Location 'westeurope' `
      -RequiredProviders @() `
      -SkuAvailability (New-OpenAiSkuAvailabilityEvidence) `
      -OpenAiModels @((New-AvailableOpenAiModelEvidence)) `
      -PolicyAssignments @(
        [pscustomobject]@{
          name = 'unknown-location-policy'
          displayName = 'Unknown location policy'
          scope = '/subscriptions/8364fb4d-2d36-4da5-908b-36cb8b808b8c'
          enforcementMode = 'Default'
          allowedLocations = @()
          locationEvidenceStatus = 'Indeterminate'
          locationEvidenceReason = 'UNRECOGNISED_LOCATION_PARAMETER_SHAPE'
          matchedLocationParameters = @('approvedGeographies')
        }
      )

    $result.blockingFindings | Should -Contain 'AZURE_POLICY_LOCATION_INDETERMINATE:unknown-location-policy'
  }

  It 'redacts raw policy parameters from the serialized artifact' {
    $result = ConvertTo-PreflightResult `
      -Location 'westeurope' `
      -RequiredProviders @() `
      -SkuAvailability (New-OpenAiSkuAvailabilityEvidence) `
      -OpenAiModels @((New-AvailableOpenAiModelEvidence)) `
      -PolicyAssignments @(
        [pscustomobject]@{
          name = 'safe-policy'
          displayName = 'Safe policy'
          scope = '/subscriptions/test-sub'
          enforcementMode = 'Default'
          policyDefinitionId = '/providers/Microsoft.Authorization/policyDefinitions/safe-policy'
          parameters = [pscustomobject]@{
            secretValue = [pscustomobject]@{
              value = 'do-not-serialize'
            }
          }
          allowedLocations = @('westeurope')
          locationEvidenceStatus = 'Allowed'
          locationEvidenceReason = 'PARAMETER_ALLOW_LIST'
          matchedLocationParameters = @('allowedLocations')
        }
      )

    $artifact = $result | ConvertTo-Json -Depth 100

    $result.policyAssignments[0].PSObject.Properties.Name | Should -Not -Contain 'parameters'
    $artifact | Should -Not -Match 'do-not-serialize'
  }

  InModuleScope 'Stratton.Deployment' {
    It 'marks an unknown location policy parameter shape as indeterminate and redacts raw parameters' {
      Mock Invoke-AzJson {
        @(
          [pscustomobject]@{
            name = 'geo-policy'
            displayName = 'Geo policy'
            scope = '/subscriptions/test-sub'
            enforcementMode = 'Default'
            policyDefinitionId = '/providers/Microsoft.Authorization/policyDefinitions/geo-policy'
            parameters = [pscustomobject]@{
              approvedGeographies = [pscustomobject]@{
                value = @('EU')
              }
              evidenceNote = [pscustomobject]@{
                value = 'sensitive'
              }
            }
          }
        )
      } -ModuleName Stratton.Deployment

      $assignment = @(Get-PolicyAssignments -SubscriptionId 'test-sub' -TargetLocation 'westeurope' -KnownLocations @('westeurope', 'northeurope'))[0]

      @($assignment.allowedLocations).Count | Should -Be 0
      $assignment.locationEvidenceStatus | Should -Be 'Indeterminate'
      $assignment.locationEvidenceReason | Should -Be 'UNRECOGNISED_LOCATION_PARAMETER_SHAPE'
      $assignment.matchedLocationParameters | Should -Contain 'approvedGeographies'
      $assignment.PSObject.Properties.Name | Should -Not -Contain 'parameters'
    }

    It 'does not use an OpenAI account outside the target region' {
      $requiredModels = @(
        [pscustomobject]@{
          route = 'LUNA'
          modelId = 'gpt-5.6-luna'
          modelVersion = '2026-07-09'
          quotaName = 'OpenAI.DataZoneStandard.gpt-5.6-luna'
        }
      )

      Mock Invoke-AzJson {
        param([string[]] $Arguments)

        if ($Arguments[0] -eq 'cognitiveservices' -and $Arguments[1] -eq 'account' -and $Arguments[2] -eq 'list-skus') {
          return @(
            [pscustomobject]@{
              name = 'S0'
              locations = @('WESTEUROPE')
            }
          )
        }

        if ($Arguments[0] -eq 'cognitiveservices' -and $Arguments[1] -eq 'usage' -and $Arguments[2] -eq 'list') {
          return @(
            [pscustomobject]@{
              name = [pscustomobject]@{
                value = 'OpenAI.DataZoneStandard.gpt-5.6-luna'
              }
              currentValue = 0
              limit = 100
              unit = 'Count'
            }
          )
        }

        if ($Arguments[0] -eq 'cognitiveservices' -and $Arguments[1] -eq 'account' -and $Arguments[2] -eq 'list-models') {
          throw 'list-models should not be called for a non-westeurope account'
        }

        throw "Unexpected az invocation: $($Arguments -join ' ')"
      } -ModuleName Stratton.Deployment

      Mock Get-OpenAiAccounts {
        @(
          [pscustomobject]@{
            name = 'oai-eastus'
            resourceGroup = 'rg-eastus'
            location = 'eastus'
            kind = 'OpenAI'
          }
        )
      } -ModuleName Stratton.Deployment

      $result = Get-OpenAiReadiness -SubscriptionId 'test-sub' -Location 'westeurope' -RequiredModels $requiredModels

      $result.openAiModels[0].available | Should -BeFalse
      $result.openAiModels[0].discoveryAccountName | Should -BeNullOrEmpty
      $result.openAiModels[0].reason | Should -Be 'NO_OPENAI_ACCOUNT_AVAILABLE_FOR_LIST_MODELS'
    }

    It 'uses the OpenAI location, rather than the platform location, for Azure OpenAI discovery' {
      $requiredModels = @(
        [pscustomobject]@{
          route = 'LUNA'
          modelId = 'gpt-5.6-luna'
          modelVersion = '2026-07-09'
          quotaName = 'OpenAI.DataZoneStandard.gpt-5.6-luna'
        }
      )
      $calls = [System.Collections.Generic.List[string]]::new()

      Mock Invoke-AzJson {
        param([string[]] $Arguments)
        $calls.Add(($Arguments -join ' '))

        if ($Arguments[0..2] -join ' ' -eq 'cognitiveservices account list-skus') {
          return @([pscustomobject]@{ name = 'S0'; locations = @('WESTEUROPE') })
        }
        if ($Arguments[0..2] -join ' ' -eq 'cognitiveservices usage list') {
          return @(
            [pscustomobject]@{
              name = [pscustomobject]@{ value = 'OpenAI.DataZoneStandard.gpt-5.6-luna' }
              currentValue = 0
              limit = 100
              unit = 'Count'
            }
          )
        }
        if ($Arguments[0..2] -join ' ' -eq 'cognitiveservices account list-models') {
          return @([pscustomobject]@{ modelName = 'gpt-5.6-luna'; version = '2026-07-09' })
        }
        throw "Unexpected az invocation: $($Arguments -join ' ')"
      } -ModuleName Stratton.Deployment

      Mock Get-OpenAiAccounts {
        @(
          [pscustomobject]@{
            name = 'oai-we'
            resourceGroup = 'rg-we'
            location = 'westeurope'
            kind = 'OpenAI'
          }
        )
      } -ModuleName Stratton.Deployment

      $result = Get-OpenAiReadiness `
        -SubscriptionId 'test-sub' `
        -Location 'swedencentral' `
        -OpenAiLocation 'westeurope' `
        -RequiredModels $requiredModels

      $result.openAiModels[0].available | Should -BeTrue
      $result.openAiModels[0].discoveryAccountName | Should -Be 'oai-we'
      ($calls -join "`n") | Should -Match '--location westeurope'
      ($calls -join "`n") | Should -Not -Match '--location swedencentral'
    }

    It 'records split locations while keeping policy checks on the platform location' {
      $global:strattonObservedPolicyLocation = $null
      Mock Assert-AzContext {} -ModuleName Stratton.Deployment
      Mock Get-RequiredProviderNamespaces { @() } -ModuleName Stratton.Deployment
      Mock Get-RequiredOpenAiModels { @() } -ModuleName Stratton.Deployment
      Mock Get-ProviderReadiness { @() } -ModuleName Stratton.Deployment
      Mock Get-PolicyAssignments {
        param($SubscriptionId, $TargetLocation)
        $global:strattonObservedPolicyLocation = $TargetLocation
        @()
      } -ModuleName Stratton.Deployment
      Mock Get-NamingConflicts { @() } -ModuleName Stratton.Deployment
      Mock Get-OpenAiReadiness {
        [pscustomobject]@{
          skuAvailability = New-OpenAiSkuAvailabilityEvidence
          openAiModels = @()
          blockingFindings = @()
        }
      } -ModuleName Stratton.Deployment

      $result = Invoke-StrattonAzurePreflight `
        -SubscriptionId 'test-sub' `
        -TenantId 'test-tenant' `
        -ExpectedUser 'operator@example.invalid' `
        -Location 'swedencentral' `
        -OpenAiLocation 'westeurope'

      $result.location | Should -Be 'swedencentral'
      $result.openAiLocation | Should -Be 'westeurope'
      $global:strattonObservedPolicyLocation | Should -Be 'swedencentral'
      Remove-Variable -Name strattonObservedPolicyLocation -Scope Global -ErrorAction SilentlyContinue
    }

    It 'does not accept blank listed model versions for version-pinned models' {
      $requiredModels = @(
        [pscustomobject]@{
          route = 'LUNA'
          modelId = 'gpt-5.6-luna'
          modelVersion = '2026-07-09'
          quotaName = 'OpenAI.DataZoneStandard.gpt-5.6-luna'
        }
      )

      Mock Invoke-AzJson {
        param([string[]] $Arguments)

        if ($Arguments[0] -eq 'cognitiveservices' -and $Arguments[1] -eq 'account' -and $Arguments[2] -eq 'list-skus') {
          return @(
            [pscustomobject]@{
              name = 'S0'
              locations = @('WESTEUROPE')
            }
          )
        }

        if ($Arguments[0] -eq 'cognitiveservices' -and $Arguments[1] -eq 'usage' -and $Arguments[2] -eq 'list') {
          return @(
            [pscustomobject]@{
              name = [pscustomobject]@{
                value = 'OpenAI.DataZoneStandard.gpt-5.6-luna'
              }
              currentValue = 0
              limit = 100
              unit = 'Count'
            }
          )
        }

        if ($Arguments[0] -eq 'cognitiveservices' -and $Arguments[1] -eq 'account' -and $Arguments[2] -eq 'list-models') {
          return @(
            [pscustomobject]@{
              modelName = 'gpt-5.6-luna'
              version = ''
            }
          )
        }

        throw "Unexpected az invocation: $($Arguments -join ' ')"
      } -ModuleName Stratton.Deployment

      Mock Get-OpenAiAccounts {
        @(
          [pscustomobject]@{
            name = 'oai-we'
            resourceGroup = 'rg-we'
            location = 'westeurope'
            kind = 'OpenAI'
          }
        )
      } -ModuleName Stratton.Deployment

      $result = Get-OpenAiReadiness -SubscriptionId 'test-sub' -Location 'westeurope' -RequiredModels $requiredModels

      $result.openAiModels[0].available | Should -BeFalse
      $result.openAiModels[0].reason | Should -Be 'MODEL_VERSION_UNKNOWN'
    }
  }
}
