Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module Pester -MinimumVersion 5.0.0

$configuration = [PesterConfiguration]::Default
$configuration.Run.Path = $PSScriptRoot
$configuration.Run.PassThru = $true
$configuration.Output.Verbosity = 'Detailed'
$configuration.Should.ErrorAction = 'Stop'

$result = Invoke-Pester -Configuration $configuration
if ($result.Result -ne 'Passed') {
  exit 1
}
