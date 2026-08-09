Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$modulePath = Join-Path $repoRoot 'scripts\deployment\Stratton.Deployment.psm1'

Import-Module $modulePath -Force

Describe 'Test-StrattonAzurePreflight' {
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

  It 'marks a missing Azure OpenAI model or quota as blocking' {
    $result = ConvertTo-PreflightResult -OpenAiModels @() -RequiredProviders @()

    $result.blockingFindings | Should -Contain 'AZURE_OPENAI_MODEL_UNAVAILABLE'
  }
}
