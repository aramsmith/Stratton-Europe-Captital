[CmdletBinding()]
param(
  [Parameter(Mandatory)]
  [string] $RegistryName,

  [string] $CommitSha,

  [string] $OutFile,

  [ValidateRange(0, 3600)]
  [int] $PollIntervalSeconds = 5,

  [ValidateRange(1, 3600)]
  [int] $MaxPollAttempts = 120
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$modulePath = Join-Path $PSScriptRoot 'Stratton.Deployment.psm1'
Import-Module $modulePath -Force

$demoPlatformRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path

if (-not $PSBoundParameters.ContainsKey('CommitSha')) {
  $CommitSha = (& git -C $demoPlatformRoot rev-parse HEAD 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($CommitSha)) {
    throw 'GIT_COMMIT_SHA_UNAVAILABLE'
  }
}

if (-not $PSBoundParameters.ContainsKey('OutFile')) {
  $OutFile = Join-Path $demoPlatformRoot 'artifacts\deployment\images.json'
}

Invoke-StrattonImageBuilds `
  -RegistryName $RegistryName `
  -CommitSha $CommitSha `
  -DemoPlatformRoot $demoPlatformRoot `
  -OutFile $OutFile `
  -PollIntervalSeconds $PollIntervalSeconds `
  -MaxPollAttempts $MaxPollAttempts
