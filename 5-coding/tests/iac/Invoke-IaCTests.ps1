[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$testsPath = Join-Path $PSScriptRoot 'Infra.Tests.ps1'
$psRulePath = Join-Path $PSScriptRoot 'psrule\Stratton.IaC.Rule.ps1'
$infraRoot = Join-Path $PSScriptRoot '..\..\infra'
$outRoot = Join-Path $infraRoot 'out'
$pesterResultPath = Join-Path $outRoot 'pester-testResults.xml'

if (-not (Get-Module -ListAvailable -Name Pester)) {
  throw 'Pester is required but not installed.'
}

$sidecarMainJson = @(
  Get-ChildItem -Path $infraRoot -Recurse -Filter 'main.json' |
    Where-Object { $_.FullName -notlike '*\infra\out\*' }
)
if ($sidecarMainJson.Count -gt 0) {
  $names = $sidecarMainJson | ForEach-Object { $_.FullName }
  throw "Source-adjacent compiled main.json files are not allowed. Move/remove: $($names -join '; ')"
}

if (Test-Path $outRoot) {
  Get-ChildItem -Path $outRoot -Recurse -File | Remove-Item -Force
}
else {
  New-Item -ItemType Directory -Path $outRoot | Out-Null
}

$pesterConfig = New-PesterConfiguration
$pesterConfig.Run.Path = $testsPath
$pesterConfig.Run.PassThru = $true
$pesterConfig.TestResult.Enabled = $true
$pesterConfig.TestResult.OutputFormat = 'NUnitXml'
$pesterConfig.TestResult.OutputPath = $pesterResultPath

$testResult = Invoke-Pester -Configuration $pesterConfig
if ($null -eq $testResult) {
  throw 'Pester did not return a result object.'
}
if (($testResult.PassedCount + $testResult.FailedCount + $testResult.SkippedCount + $testResult.InconclusiveCount + $testResult.NotRunCount) -eq 0) {
  throw 'Pester executed zero tests.'
}
if ($testResult.FailedCount -gt 0) {
  throw "IaC tests failed. Failed: $($testResult.FailedCount), Passed: $($testResult.PassedCount)"
}

if (-not (Get-Module -ListAvailable -Name PSRule)) {
  throw 'PSRule module is required but not installed.'
}

Import-Module PSRule -ErrorAction Stop
$invokePsRule = Get-Command Invoke-PSRule -ErrorAction Stop
$invokeParams = $invokePsRule.Parameters.Keys
$requiredInvokePsRuleParams = @('Path','InputObject','As','Outcome')
$missingInvokePsRuleParams = @($requiredInvokePsRuleParams | Where-Object { $invokeParams -notcontains $_ })
if ($missingInvokePsRuleParams.Count -gt 0) {
  throw "Installed PSRule version is incompatible. Missing Invoke-PSRule parameters: $($missingInvokePsRuleParams -join ', ')"
}
if ($invokeParams -notcontains 'Name') {
  throw 'Installed PSRule version does not support -Name; targeted per-control evaluations require it.'
}

function Invoke-AzBicep {
  param([string[]]$CommandArgs,[string]$Context)
  $env:BICEP_CLI_DISABLE_VERSION_CHECK = 'true'
  $o = & az bicep @CommandArgs 2>&1
  $lines = @($o | ForEach-Object { $_.ToString() } | Where-Object { $_ -notmatch '^WARNING: A new Bicep release is available' })
  if ($LASTEXITCODE -ne 0) {
    throw "Bicep command failed for $Context`n$($lines -join [Environment]::NewLine)"
  }
  $warnings = @($lines | Where-Object { $_ -match '(?i)\bwarning\b|BCP\d{3}' })
  if ($warnings.Count -gt 0) {
    throw "Bicep warnings are not allowed for $Context`n$($warnings -join [Environment]::NewLine)"
  }
  return $lines
}

function Get-OutTemplatePath {
  param([string]$BicepFile)
  $relative = [System.IO.Path]::GetRelativePath($infraRoot, $BicepFile)
  $jsonRelative = [System.IO.Path]::ChangeExtension($relative, '.json')
  return (Join-Path $outRoot $jsonRelative)
}

function Get-ResourceArray {
  param($Template)
  if ($Template.resources -is [System.Collections.IDictionary]) { return @($Template.resources.Values) }
  return @($Template.resources)
}

$templates = @(
  Get-ChildItem -Path $infraRoot -Recurse -Filter '*.bicep' |
    Where-Object { $_.FullName -notmatch '\\parameters\\' -and $_.FullName -notmatch '\\out\\' } |
    Select-Object -ExpandProperty FullName
)

$templateObjects = @()
$resourceObjects = @()
foreach($file in $templates) {
  $outFile = Get-OutTemplatePath -BicepFile $file
  $outDir = Split-Path -Parent $outFile
  if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
  }

  Invoke-AzBicep -CommandArgs @('build','--file',$file,'--outfile',$outFile) -Context $file | Out-Null
  $templateObject = Get-Content -Raw $outFile | ConvertFrom-Json -Depth 100
  $templateObjects += $templateObject
  $resourceObjects += (Get-ResourceArray -Template $templateObject)
}

$resourceObjects = @($resourceObjects | Where-Object { $null -ne $_ -and $_.PSObject.Properties['type'] })
if ($templateObjects.Count -eq 0 -or $resourceObjects.Count -eq 0) {
  throw "Compiled object set is empty. templates=$($templateObjects.Count) resources=$($resourceObjects.Count)"
}

function Get-ResourcesByType {
  param([string]$Type)
  return @($resourceObjects | Where-Object { [string]$_.type -eq $Type })
}

$expectedResourceTypes = @(
  'Microsoft.Storage/storageAccounts',
  'Microsoft.Sql/servers',
  'Microsoft.ServiceBus/namespaces',
  'Microsoft.AppConfiguration/configurationStores',
  'Microsoft.KeyVault/vaults',
  'Microsoft.ContainerRegistry/registries',
  'Microsoft.CognitiveServices/accounts',
  'Microsoft.Search/searchServices',
  'Microsoft.ApiManagement/service',
  'Microsoft.App/containerApps',
  'Microsoft.Network/applicationGateways'
)
$typePresence = @{}
foreach($resourceType in $expectedResourceTypes) {
  $count = @(Get-ResourcesByType $resourceType).Count
  $typePresence[$resourceType] = $count
  if ($count -eq 0) {
    throw "Expected resource type not present in compiled templates: $resourceType"
  }
}

$ruleInputs = [ordered]@{
  'Stratton.Storage.PublicAccessDisabled' = @(Get-ResourcesByType 'Microsoft.Storage/storageAccounts')
  'Stratton.Sql.PublicNetworkDisabled' = @(Get-ResourcesByType 'Microsoft.Sql/servers')
  'Stratton.ServiceBus.PremiumPrivate' = @(Get-ResourcesByType 'Microsoft.ServiceBus/namespaces')
  'Stratton.AppConfig.PublicNetworkDisabled' = @(Get-ResourcesByType 'Microsoft.AppConfiguration/configurationStores')
  'Stratton.KeyVault.PublicNetworkDisabled' = @(Get-ResourcesByType 'Microsoft.KeyVault/vaults')
  'Stratton.ACR.PublicNetworkDisabled' = @(Get-ResourcesByType 'Microsoft.ContainerRegistry/registries')
  'Stratton.Cognitive.PublicNetworkDisabled' = @(Get-ResourcesByType 'Microsoft.CognitiveServices/accounts')
  'Stratton.Search.PublicNetworkDisabled' = @(Get-ResourcesByType 'Microsoft.Search/searchServices')
  'Stratton.APIM.PublicNetworkDisabled' = @(Get-ResourcesByType 'Microsoft.ApiManagement/service')
  'Stratton.ContainerApp.PrivateIngress' = @(Get-ResourcesByType 'Microsoft.App/containerApps')
  'Stratton.AppGateway.PrivateFrontendOnly' = @(Get-ResourcesByType 'Microsoft.Network/applicationGateways')
  'Stratton.Tags.RequiredSeven' = @($resourceObjects | Where-Object { $_.PSObject.Properties['tags'] })
  'Stratton.RolloutLimitFixed20' = @($templateObjects | Where-Object { $_.parameters -and $_.parameters.rolloutAdmissionMaximum })
}

$allRuleResults = @()
$coverageSummary = @()
foreach($ruleName in $ruleInputs.Keys) {
  $applicable = @($ruleInputs[$ruleName] | ForEach-Object { $_ })
  if ($applicable.Count -eq 0) {
    throw "PSRule control has zero applicable objects: $ruleName"
  }

  $ruleItems = @($applicable | Invoke-PSRule -Path $psRulePath -Name $ruleName -As Detail -Outcome Pass,Fail,Error -WarningAction SilentlyContinue)
  if ($ruleItems.Count -eq 0) {
    throw "PSRule returned zero evaluations for rule: $ruleName"
  }
  if ($ruleItems.Count -ne $applicable.Count) {
    throw "PSRule evaluation count mismatch for $ruleName. applicable=$($applicable.Count) evaluated=$($ruleItems.Count)"
  }

  $allRuleResults += $ruleItems
  $coverageSummary += "$ruleName=$($ruleItems.Count)"
}

if ($allRuleResults.Count -eq 0) {
  throw 'PSRule returned zero evaluations across all controls.'
}

$failed = @($allRuleResults | Where-Object { [string]$_.Outcome -eq 'Fail' })
$errored = @($allRuleResults | Where-Object { [string]$_.Outcome -eq 'Error' })
$passed = @($allRuleResults | Where-Object { [string]$_.Outcome -eq 'Pass' })

if ($failed.Count -gt 0 -or $errored.Count -gt 0) {
  $summary = @($failed + $errored) | ForEach-Object { "$($_.RuleName): $($_.TargetName) [$([string]$_.Outcome)]" }
  throw "PSRule validation failed. Failed: $($failed.Count), Error: $($errored.Count), Passed: $($passed.Count). Failing evaluations: $($summary -join '; ')"
}

$typePresenceSummary = ($expectedResourceTypes | ForEach-Object { "$_=$($typePresence[$_])" }) -join ', '
Write-Host ("IaC tests passed. Pester Passed: {0}, Failed: {1}. PesterResultPath: {2}. PSRule Evaluations: {3}, Passed: {4}, Failed: {5}, Error: {6}. Coverage: {7}. ResourceTypes: {8}. Compiled templates written to: {9}" -f $testResult.PassedCount, $testResult.FailedCount, $pesterResultPath, $allRuleResults.Count, $passed.Count, $failed.Count, $errored.Count, ($coverageSummary -join ', '), $typePresenceSummary, $outRoot)
