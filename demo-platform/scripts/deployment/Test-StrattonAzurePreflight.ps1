[CmdletBinding()]
param(
  [string] $SubscriptionId,

  [string] $TenantId,

  [string] $ExpectedUser,

  [string] $Location,

  [string] $OpenAiLocation,

  [string] $OutFile,

  [switch] $AllowProviderRegistrationPending,

  [switch] $LoadOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$modulePath = Join-Path $PSScriptRoot 'Stratton.Deployment.psm1'
Import-Module $modulePath -Force

function Assert-StrattonPreflightResult {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Result,

    [switch] $AllowProviderRegistrationPending
  )

  $blockingFindings = @($Result.blockingFindings)
  if ($AllowProviderRegistrationPending) {
    $blockingFindings = @(
      $blockingFindings |
        Where-Object { $_ -notlike 'AZURE_PROVIDER_UNREGISTERED:*' }
    )
  }
  if ($blockingFindings.Count -gt 0) {
    throw "AZURE_PREFLIGHT_BLOCKED:$($blockingFindings -join ',')"
  }
}

if ($LoadOnly) {
  return
}

foreach ($requiredParameter in @('SubscriptionId', 'TenantId', 'ExpectedUser', 'Location', 'OutFile')) {
  if ([string]::IsNullOrWhiteSpace([string] (Get-Variable -Name $requiredParameter -ValueOnly))) {
    throw "PREFLIGHT_PARAMETER_REQUIRED:$requiredParameter"
  }
}

$result = Invoke-StrattonAzurePreflight `
  -SubscriptionId $SubscriptionId `
  -TenantId $TenantId `
  -ExpectedUser $ExpectedUser `
  -Location $Location `
  -OpenAiLocation $(if ([string]::IsNullOrWhiteSpace($OpenAiLocation)) { $Location } else { $OpenAiLocation })

Write-DeploymentArtifact -Path $OutFile -InputObject $result
Assert-StrattonPreflightResult `
  -Result $result `
  -AllowProviderRegistrationPending:$AllowProviderRegistrationPending

$result
