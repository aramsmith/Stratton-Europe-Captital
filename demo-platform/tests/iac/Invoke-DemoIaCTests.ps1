Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module Pester -MinimumVersion 5.0.0

$configuration = [PesterConfiguration]::Default
$configuration.Run.Path = @(
  (Join-Path $PSScriptRoot 'DemoInfra.Tests.ps1')
  (Join-Path $PSScriptRoot 'StandaloneInfra.Tests.ps1')
)
$configuration.Run.PassThru = $true
$configuration.Output.Verbosity = 'Detailed'
$configuration.Should.ErrorAction = 'Stop'

$result = Invoke-Pester -Configuration $configuration
if ($result.FailedCount -gt 0) {
  exit 1
}
