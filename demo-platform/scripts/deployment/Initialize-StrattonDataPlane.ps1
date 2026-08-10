[CmdletBinding()]
param(
  [string] $ResourceGroupName,

  [string] $DeploymentName = 'stratton-standalone',

  [string] $JobName = 'stratton-bootstrap',

  [ValidateRange(0, 3600)]
  [int] $PollIntervalSeconds = 10,

  [ValidateRange(1, 360)]
  [int] $MaxPollAttempts = 180,

  [switch] $WhatIf,

  [switch] $LoadOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$demoPlatformRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$modulePath = Join-Path $PSScriptRoot 'Stratton.Deployment.psm1'
Import-Module $modulePath -Force

function Get-RequiredDeploymentOutput {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Outputs,

    [Parameter(Mandatory)]
    [string] $Name
  )

  $property = $Outputs.PSObject.Properties[$Name]
  if ($null -eq $property) {
    throw "DEPLOYMENT_OUTPUT_MISSING:$Name"
  }
  $valueProperty = $property.Value.PSObject.Properties['value']
  $value = if ($null -ne $valueProperty) { [string] $valueProperty.Value } else { [string] $property.Value }
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "DEPLOYMENT_OUTPUT_EMPTY:$Name"
  }
  return $value
}

function Get-Sha256Text {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Value
  )

  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Value)
    return [Convert]::ToHexString($hasher.ComputeHash($bytes)).ToLowerInvariant()
  }
  finally {
    $hasher.Dispose()
  }
}

function Resolve-RouteTemplateValue {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Value,

    [Parameter(Mandatory)]
    [object] $Outputs
  )

  $template = [regex]::Match($Value, '^\$\{([A-Za-z][A-Za-z0-9]*)\}$')
  if ($template.Success) {
    return Get-RequiredDeploymentOutput -Outputs $Outputs -Name $template.Groups[1].Value
  }
  return $Value
}

function Assert-StrattonRouteSequence {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object[]] $RouteDefinitions
  )

  $expectedRoutes = @('LUNA', 'TERRA', 'SOL')
  if ($RouteDefinitions.Count -ne $expectedRoutes.Count) {
    throw 'ROUTE_EVIDENCE_DEFINITION_INVALID'
  }
  for ($index = 0; $index -lt $expectedRoutes.Count; $index++) {
    $routeProperty = $RouteDefinitions[$index].PSObject.Properties['route']
    if ($null -eq $routeProperty -or [string] $routeProperty.Value -cne $expectedRoutes[$index]) {
      throw 'ROUTE_EVIDENCE_DEFINITION_INVALID'
    }
  }
}

function Get-BootstrapRouteEvidence {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Outputs,

    [Parameter(Mandatory)]
    [datetimeoffset] $Now
  )

  $routeDefinitions = Get-Content (Join-Path $PSScriptRoot 'route-evidence.json') -Raw | ConvertFrom-Json
  Assert-StrattonRouteSequence -RouteDefinitions @($routeDefinitions)

  return @(
    foreach ($definition in $routeDefinitions) {
      if (
        $definition.tenantId -ne '27140306-eea5-4e7f-91e9-4c9e86864b3a' -or
        $definition.caseId -ne 'project-danube' -or
        $definition.approvalStatus -ne 'APPROVED'
      ) {
        throw "ROUTE_EVIDENCE_SCOPE_INVALID:$($definition.route)"
      }
      $validityDays = [int] $definition.validityDays
      if ($validityDays -lt 1 -or $validityDays -gt 90) {
        throw "ROUTE_EVIDENCE_VALIDITY_INVALID:$($definition.route)"
      }
      [pscustomobject]@{
        route = [string] $definition.route
        tenantId = [string] $definition.tenantId
        caseId = [string] $definition.caseId
        evidenceId = [string] $definition.evidenceId
        evidenceVersion = [string] $definition.evidenceVersion
        accountResourceId = Resolve-RouteTemplateValue -Value ([string] $definition.accountResourceId) -Outputs $Outputs
        deploymentId = Resolve-RouteTemplateValue -Value ([string] $definition.deploymentId) -Outputs $Outputs
        region = Resolve-RouteTemplateValue -Value ([string] $definition.region) -Outputs $Outputs
        apiVersion = [string] $definition.apiVersion
        approvalStatus = [string] $definition.approvalStatus
        validFromIso = $Now.ToUniversalTime().ToString('o')
        validUntilIso = $Now.AddDays($validityDays).ToUniversalTime().ToString('o')
      }
    }
  )
}

function Get-IdentityBootstrapSql {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $BootstrapSql
  )

  $marker = '-- BFF is deliberately limited to the demo projection table.'
  $markerIndex = $BootstrapSql.IndexOf($marker, [System.StringComparison]::Ordinal)
  if ($markerIndex -lt 0) {
    throw 'IDENTITY_BOOTSTRAP_SQL_INVALID'
  }
  return $BootstrapSql.Substring($markerIndex)
}

function Assert-StrattonBootstrapJobPayload {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Image,

    [Parameter(Mandatory)]
    [string[]] $EnvironmentVariables
  )

  if ($Image -notmatch '@sha256:[a-f0-9]{64}$') {
    throw 'BOOTSTRAP_IMAGE_DIGEST_INVALID'
  }
  foreach ($environmentVariable in $EnvironmentVariables) {
    $separator = $environmentVariable.IndexOf('=')
    if ($separator -lt 1) {
      throw 'BOOTSTRAP_ENVIRONMENT_VARIABLE_INVALID'
    }
    $name = $environmentVariable.Substring(0, $separator)
    if ($name -match '(?i)(password|connection.?string|client.?secret|api.?key|token)') {
      throw "BOOTSTRAP_SECRET_ENVIRONMENT_VARIABLE_PROHIBITED:$name"
    }
  }
}

function New-StrattonBootstrapJobCreateArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $ContainerAppsEnvironmentId,

    [Parameter(Mandatory)]
    [string] $Image,

    [Parameter(Mandatory)]
    [string] $RegistryServer,

    [Parameter(Mandatory)]
    [string] $BootstrapIdentityResourceId,

    [Parameter(Mandatory)]
    [string[]] $EnvironmentVariables
  )

  Assert-StrattonBootstrapJobPayload -Image $Image -EnvironmentVariables $EnvironmentVariables
  return @(
    'containerapp', 'job', 'create',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--environment', $ContainerAppsEnvironmentId,
    '--trigger-type', 'Manual',
    '--replica-timeout', '1800',
    '--replica-retry-limit', '0',
    '--replica-completion-count', '1',
    '--parallelism', '1',
    '--image', $Image,
    '--container-name', 'bootstrap',
    '--cpu', '0.5',
    '--memory', '1.0Gi',
    '--mi-user-assigned', $BootstrapIdentityResourceId,
    '--registry-server', $RegistryServer,
    '--registry-identity', $BootstrapIdentityResourceId,
    '--env-vars'
  ) + $EnvironmentVariables
}

function New-StrattonBootstrapJobUpdateArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $Image,

    [Parameter(Mandatory)]
    [string[]] $EnvironmentVariables
  )

  Assert-StrattonBootstrapJobPayload -Image $Image -EnvironmentVariables $EnvironmentVariables
  return @(
    'containerapp', 'job', 'update',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--replica-timeout', '1800',
    '--replica-retry-limit', '0',
    '--replica-completion-count', '1',
    '--parallelism', '1',
    '--image', $Image,
    '--container-name', 'bootstrap',
    '--cpu', '0.5',
    '--memory', '1.0Gi',
    '--replace-env-vars'
  ) + $EnvironmentVariables
}

function New-StrattonBootstrapJobIdentityArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $BootstrapIdentityResourceId
  )

  return @(
    'containerapp', 'job', 'identity', 'assign',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--user-assigned', $BootstrapIdentityResourceId
  )
}

function New-StrattonBootstrapJobRegistryArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $RegistryServer,

    [Parameter(Mandatory)]
    [string] $BootstrapIdentityResourceId
  )

  return @(
    'containerapp', 'job', 'registry', 'set',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--server', $RegistryServer,
    '--identity', $BootstrapIdentityResourceId
  )
}

function New-StrattonBootstrapJobLogArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $ExecutionName
  )

  return @(
    'containerapp', 'job', 'logs', 'show',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--execution', $ExecutionName,
    '--container', 'bootstrap',
    '--tail', '200',
    '--format', 'text',
    '--only-show-errors'
  )
}

function Get-StrattonOptionalPropertyValue {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $InputObject,

    [Parameter(Mandatory)]
    [string[]] $Path
  )

  $current = $InputObject
  foreach ($name in $Path) {
    if ($null -eq $current) {
      return $null
    }
    $property = $current.PSObject.Properties[$name]
    if ($null -eq $property) {
      return $null
    }
    $current = $property.Value
  }
  return $current
}

function Get-UniqueExecutionValue {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $InputObject,

    [Parameter(Mandatory)]
    [string] $Kind
  )

  $executionNames = @(
    @(
      Get-StrattonOptionalPropertyValue -InputObject $InputObject -Path @('properties', 'latestExecutionName')
      Get-StrattonOptionalPropertyValue -InputObject $InputObject -Path @('latestExecutionName')
    ) |
      Where-Object { $_ -is [string] -and -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  if ($executionNames.Count -eq 1) {
    return [string] $executionNames[0]
  }
  $values = @(
    @(
      $InputObject
      Get-StrattonOptionalPropertyValue -InputObject $InputObject -Path @('name')
      Get-StrattonOptionalPropertyValue -InputObject $InputObject -Path @('properties', 'name')
    ) |
      Where-Object { $_ -is [string] -and -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  if ($values.Count -ne 1 -or $executionNames.Count -gt 1) {
    throw "AMBIGUOUS_JOB_$Kind"
  }
  return [string] $values[0]
}

function Get-StrattonJobExecutionStatus {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $Execution
  )

  $status = Get-StrattonOptionalPropertyValue -InputObject $Execution -Path @('properties', 'status')
  return Get-UniqueExecutionValue -InputObject ([pscustomobject]@{ name = $status }) -Kind 'EXECUTION_STATUS'
}

function Wait-StrattonBootstrapJobExecution {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $ExecutionName,

    [ValidateRange(0, 3600)]
    [int] $PollIntervalSeconds = 10,

    [ValidateRange(1, 360)]
    [int] $MaxPollAttempts = 180,

    [scriptblock] $JobInvoker
  )

  if (-not $JobInvoker) {
    $JobInvoker = {
      param([string[]] $Arguments)
      Invoke-AzJson -Arguments $Arguments
    }
  }

  $terminalStatuses = @(
    'Succeeded',
    'Failed',
    'Canceled',
    'Cancelled',
    'Degraded',
    'Stopped',
    'Unknown'
  )
  $terminalStatus = $null
  for ($attempt = 1; $attempt -le $MaxPollAttempts; $attempt++) {
    $execution = & $JobInvoker @(
      'containerapp', 'job', 'execution', 'show',
      '--name', $JobName,
      '--resource-group', $ResourceGroupName,
      '--job-execution-name', $ExecutionName
    )
    $status = Get-StrattonJobExecutionStatus -Execution $execution
    if ($status -in $terminalStatuses) {
      $terminalStatus = $status
      break
    }
    if ($attempt -lt $MaxPollAttempts -and $PollIntervalSeconds -gt 0) {
      Start-Sleep -Seconds $PollIntervalSeconds
    }
  }

  if ($terminalStatus -ne 'Succeeded') {
    throw "BOOTSTRAP_JOB_FAILED:${ExecutionName}:$terminalStatus"
  }
  return $terminalStatus
}

function Test-StrattonBootstrapJsonLogFrame {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $Line
  )

  if ([string]::IsNullOrWhiteSpace($Line)) {
    return $false
  }
  $trimmed = $Line.Trim()
  if (-not ($trimmed.StartsWith('{') -or $trimmed.StartsWith('['))) {
    return $false
  }
  try {
    $frames = @($trimmed | ConvertFrom-Json -Depth 10)
  }
  catch {
    return $false
  }
  foreach ($frame in $frames) {
    if (
      $null -ne (Get-StrattonOptionalPropertyValue -InputObject $frame -Path @('TimeStamp')) -and
      $null -ne (Get-StrattonOptionalPropertyValue -InputObject $frame -Path @('Log'))
    ) {
      return $true
    }
  }
  return $false
}

function Get-RedactedBootstrapLogEntries {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $RawLog
  )

  $entries = [System.Collections.Generic.List[object]]::new()
  foreach ($line in @($RawLog -split "`r?`n")) {
    if (Test-StrattonBootstrapJsonLogFrame -Line $line) {
      throw 'BOOTSTRAP_JOB_LOG_FORMAT_INVALID'
    }
    $jsonStart = $line.IndexOf('{')
    if ($jsonStart -lt 0) {
      continue
    }
    try {
      $entry = $line.Substring($jsonStart) | ConvertFrom-Json -Depth 30
      if (
        (Get-StrattonOptionalPropertyValue -InputObject $entry -Path @('service')) -ne
        'stratton-bootstrap'
      ) {
        continue
      }
      $serialized = $entry | ConvertTo-Json -Depth 30 -Compress
      if ($serialized -match '(?i)(password|connection.?string|client.?secret|api.?key|authorization)') {
        throw 'BOOTSTRAP_LOG_REDACTION_FAILED'
      }
      $entries.Add($entry)
    }
    catch [System.Management.Automation.RuntimeException] {
      throw
    }
    catch {
      continue
    }
  }
  return @($entries)
}

function Get-BootstrapReceipt {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object[]] $LogEntries
  )

  $receipts = @(
    $LogEntries |
      Where-Object { $_.message -eq 'bootstrap-receipt' -and $null -ne $_.context.receipt } |
      ForEach-Object { $_.context.receipt }
  )
  if ($receipts.Count -ne 1) {
    throw 'BOOTSTRAP_RECEIPT_MISSING_OR_AMBIGUOUS'
  }
  return $receipts[0]
}

function Invoke-StrattonDataPlaneBootstrap {
  [CmdletBinding()]
  param()

  $deployment = Invoke-AzJson -Arguments @('deployment', 'sub', 'show', '--name', $DeploymentName)
  $outputs = $deployment.properties.outputs
  if ($null -eq $outputs) {
    throw 'DEPLOYMENT_OUTPUTS_MISSING'
  }
  $registryServer = Get-RequiredDeploymentOutput -Outputs $outputs -Name 'containerRegistryServer'
  $registryName = $registryServer.Split('.')[0]
  $bootstrapArtifact = Invoke-StrattonBootstrapImageBuild `
    -RegistryName $registryName `
    -CommitSha (git -C (Join-Path $demoPlatformRoot '..') rev-parse HEAD).Trim() `
    -DemoPlatformRoot $demoPlatformRoot
  $bootstrapImage = @($bootstrapArtifact.images | Where-Object repository -eq 'stratton/bootstrap')
  if ($bootstrapImage.Count -ne 1) {
    throw 'BOOTSTRAP_IMAGE_ARTIFACT_AMBIGUOUS'
  }

  $migrationOutputs = [ordered]@{
    '001_init.sql' = Get-RequiredDeploymentOutput -Outputs $outputs -Name 'sqlPhase5InitialMigrationSql'
    '002_demo_authority.sql' = Get-RequiredDeploymentOutput -Outputs $outputs -Name 'sqlPhase5AuthorityMigrationSql'
    'demo-projection.sql' = Get-RequiredDeploymentOutput -Outputs $outputs -Name 'sqlProjectionMigrationSql'
  }
  $migrationHashes = [ordered]@{}
  foreach ($migration in $migrationOutputs.GetEnumerator()) {
    $migrationHashes[$migration.Key] = Get-Sha256Text -Value $migration.Value
  }
  $routes = Get-BootstrapRouteEvidence -Outputs $outputs -Now [datetimeoffset]::UtcNow
  $searchSchema = Get-Content (Join-Path $PSScriptRoot 'search-index.json') -Raw | ConvertFrom-Json
  $identityBootstrapSql = Get-IdentityBootstrapSql -BootstrapSql (
    Get-RequiredDeploymentOutput -Outputs $outputs -Name 'sqlBootstrapSql'
  )
  $environmentVariables = @(
    'BOOTSTRAP_TENANT_ID=27140306-eea5-4e7f-91e9-4c9e86864b3a',
    "AZURE_SQL_SERVER_FQDN=$(Get-RequiredDeploymentOutput -Outputs $outputs -Name 'sqlServerFqdn')",
    "AZURE_SQL_DATABASE_NAME=$(Get-RequiredDeploymentOutput -Outputs $outputs -Name 'sqlDatabaseName')",
    "AZURE_SEARCH_ENDPOINT=$(Get-RequiredDeploymentOutput -Outputs $outputs -Name 'searchEndpoint')",
    "AZURE_SEARCH_INDEX_NAME=$(Get-RequiredDeploymentOutput -Outputs $outputs -Name 'searchIndexName')",
    "AZURE_MANAGED_IDENTITY_CLIENT_ID=$(Get-RequiredDeploymentOutput -Outputs $outputs -Name 'bootstrapIdentityClientId')",
    "BOOTSTRAP_PROJECTION_MIGRATION_SQL=$($migrationOutputs['demo-projection.sql'])",
    "BOOTSTRAP_IDENTITY_BOOTSTRAP_SQL=$identityBootstrapSql",
    "BOOTSTRAP_EXPECTED_MIGRATION_HASHES_JSON=$($migrationHashes | ConvertTo-Json -Compress)",
    "BOOTSTRAP_SEARCH_SCHEMA_JSON=$($searchSchema | ConvertTo-Json -Compress -Depth 20)",
    "BOOTSTRAP_ROUTES_JSON=$($routes | ConvertTo-Json -Compress -Depth 20)"
  )
  $bootstrapIdentityResourceId = Get-RequiredDeploymentOutput -Outputs $outputs -Name 'bootstrapIdentityResourceId'
  $image = "$registryServer/stratton/bootstrap@$($bootstrapImage[0].digest)"
  $jobExists = $false
  try {
    Invoke-AzJson -Arguments @('containerapp', 'job', 'show', '--name', $JobName, '--resource-group', $ResourceGroupName) | Out-Null
    $jobExists = $true
  }
  catch {
    $jobExists = $false
  }
  if ($jobExists) {
    Invoke-AzJson -Arguments (
      New-StrattonBootstrapJobIdentityArguments `
        -JobName $JobName `
        -ResourceGroupName $ResourceGroupName `
        -BootstrapIdentityResourceId $bootstrapIdentityResourceId
    ) | Out-Null
    Invoke-AzJson -Arguments (
      New-StrattonBootstrapJobRegistryArguments `
        -JobName $JobName `
        -ResourceGroupName $ResourceGroupName `
        -RegistryServer $registryServer `
        -BootstrapIdentityResourceId $bootstrapIdentityResourceId
    ) | Out-Null
    Invoke-AzJson -Arguments (
      New-StrattonBootstrapJobUpdateArguments `
        -JobName $JobName `
        -ResourceGroupName $ResourceGroupName `
        -Image $image `
        -EnvironmentVariables $environmentVariables
    ) | Out-Null
  }
  else {
    Invoke-AzJson -Arguments (
      New-StrattonBootstrapJobCreateArguments `
        -JobName $JobName `
        -ResourceGroupName $ResourceGroupName `
        -ContainerAppsEnvironmentId (Get-RequiredDeploymentOutput -Outputs $outputs -Name 'containerAppsEnvironmentId') `
        -Image $image `
        -RegistryServer $registryServer `
        -BootstrapIdentityResourceId $bootstrapIdentityResourceId `
        -EnvironmentVariables $environmentVariables
    ) | Out-Null
  }

  $started = Invoke-AzJson -Arguments @(
    'containerapp', 'job', 'start',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName
  )
  $executionName = Get-UniqueExecutionValue -InputObject $started -Kind 'EXECUTION_NAME'
  Wait-StrattonBootstrapJobExecution `
    -JobName $JobName `
    -ResourceGroupName $ResourceGroupName `
    -ExecutionName $executionName `
    -PollIntervalSeconds $PollIntervalSeconds `
    -MaxPollAttempts $MaxPollAttempts | Out-Null

  $logArguments = New-StrattonBootstrapJobLogArguments `
    -JobName $JobName `
    -ResourceGroupName $ResourceGroupName `
    -ExecutionName $executionName
  $rawLog = & az @logArguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw 'BOOTSTRAP_LOG_RETRIEVAL_FAILED'
  }
  $redactedLogs = Get-RedactedBootstrapLogEntries -RawLog ($rawLog | Out-String)
  foreach ($entry in $redactedLogs) {
    Write-Output ($entry | ConvertTo-Json -Depth 30 -Compress)
  }
  $receipt = Get-BootstrapReceipt -LogEntries $redactedLogs
  $receiptRoutes = @(
    $routes |
      ForEach-Object {
        $routeReceipt = @($receipt.routeEvidence | Where-Object evidenceId -eq $_.evidenceId)
        if ($routeReceipt.Count -ne 1 -or $routeReceipt[0].evidenceVersion -ne $_.evidenceVersion) {
          throw "BOOTSTRAP_ROUTE_RECEIPT_INVALID:$($_.route)"
        }
        [pscustomobject]@{
          route = $_.route
          evidenceId = $_.evidenceId
          evidenceVersion = $_.evidenceVersion
        }
      }
  )
  if (@($receipt.migrationHashes).Count -ne 3 -or [string]::IsNullOrWhiteSpace([string] $receipt.searchIndexEtag)) {
    throw 'BOOTSTRAP_RECEIPT_INVALID'
  }
  $artifact = [pscustomobject]@{
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    migrationHashes = @($receipt.migrationHashes | Select-Object name, sha256)
    searchIndexEtag = [string] $receipt.searchIndexEtag
    routeEvidence = $receiptRoutes
  }
  Write-DeploymentArtifact `
    -Path (Join-Path $demoPlatformRoot 'artifacts\deployment\data-plane.json') `
    -InputObject $artifact
  return $artifact
}

if ($LoadOnly) {
  return
}

if ([string]::IsNullOrWhiteSpace($ResourceGroupName)) {
  throw 'RESOURCE_GROUP_NAME_REQUIRED'
}

if ($WhatIf) {
  [pscustomobject]@{
    mode = 'WhatIf'
    resourceGroupName = $ResourceGroupName
    deploymentName = $DeploymentName
    jobName = $JobName
  }
  return
}

Invoke-StrattonDataPlaneBootstrap
