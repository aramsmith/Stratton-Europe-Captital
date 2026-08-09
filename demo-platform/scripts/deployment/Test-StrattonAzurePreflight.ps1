[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string] $SubscriptionId,

  [Parameter(Mandatory)]
  [string] $TenantId,

  [Parameter(Mandatory)]
  [string] $ExpectedUser,

  [Parameter(Mandatory)]
  [string] $Location,

  [Parameter(Mandatory)]
  [string] $OutFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$modulePath = Join-Path $PSScriptRoot 'Stratton.Deployment.psm1'
Import-Module $modulePath -Force

$result = Invoke-StrattonAzurePreflight `
  -SubscriptionId $SubscriptionId `
  -TenantId $TenantId `
  -ExpectedUser $ExpectedUser `
  -Location $Location

$outputDirectory = Split-Path -Parent $OutFile
if (-not [string]::IsNullOrWhiteSpace($outputDirectory)) {
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$result |
  ConvertTo-Json -Depth 100 |
  Set-Content -LiteralPath $OutFile -Encoding utf8NoBOM

if (@($result.blockingFindings).Count -gt 0) {
  throw "AZURE_PREFLIGHT_BLOCKED:$($result.blockingFindings -join ',')"
}

$result
