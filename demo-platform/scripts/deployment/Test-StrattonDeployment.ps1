[CmdletBinding()]
param(
  [string] $PlaywrightStorageStatePath = $env:STRATTON_PLAYWRIGHT_STORAGE_STATE,

  [string] $PlaywrightSessionStorageStatePath = $env:STRATTON_PLAYWRIGHT_SESSION_STORAGE_STATE,

  [switch] $LoadOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:DemoPlatformRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:DeploymentArtifactRoot = Join-Path $script:DemoPlatformRoot 'artifacts\deployment'
$script:DeploymentStatePath = Join-Path $script:DeploymentArtifactRoot 'deployment-state.json'
$script:OutputsArtifactPath = Join-Path $script:DeploymentArtifactRoot 'outputs.json'
$script:VerificationArtifactPath = Join-Path $script:DeploymentArtifactRoot 'verification.json'
$script:ProvisionalRedirectUri = 'http://localhost:4173'

. (Join-Path $PSScriptRoot 'Deploy-StrattonStandalone.ps1') -LoadOnly
. (Join-Path $PSScriptRoot 'Set-StrattonEntra.ps1') -LoadOnly

function Get-StrattonNestedValue {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $InputObject,

    [Parameter(Mandatory)]
    [string[]] $Path
  )

  $current = $InputObject
  foreach ($name in $Path) {
    $current = Get-StrattonPropertyValue -InputObject $current -Name $name
    if ($null -eq $current) {
      return $null
    }
  }
  return $current
}

function Get-StrattonExpectedRedirectUris {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Phase,

    [Parameter(Mandatory)]
    [string] $DeployedRedirectUri
  )

  if ($Phase -eq 'APPLICATIONS_DEPLOYED') {
    return @($DeployedRedirectUri, $script:ProvisionalRedirectUri)
  }
  if ($Phase -in @('ENTRA_REDIRECT_RECONCILED', 'VERIFIED')) {
    return @($DeployedRedirectUri)
  }
  throw "REDIRECT_EXPECTATION_PHASE_INVALID:$Phase"
}

function Get-StrattonAcceptedRedirectUriSets {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Phase,

    [Parameter(Mandatory)]
    [string] $DeployedRedirectUri
  )

  if ($Phase -eq 'APPLICATIONS_DEPLOYED') {
    return @(
      [pscustomobject]@{
        uris = @($DeployedRedirectUri, $script:ProvisionalRedirectUri)
        alreadyReconciled = $false
      }
      [pscustomobject]@{
        uris = @($DeployedRedirectUri)
        alreadyReconciled = $true
      }
    )
  }
  if ($Phase -in @('ENTRA_REDIRECT_RECONCILED', 'VERIFIED')) {
    return @(
      [pscustomobject]@{
        uris = @($DeployedRedirectUri)
        alreadyReconciled = $true
      }
    )
  }
  throw "REDIRECT_EXPECTATION_PHASE_INVALID:$Phase"
}

function Test-StrattonPrivateIpAddress {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $Address
  )

  $parsed = $null
  if (-not [System.Net.IPAddress]::TryParse($Address, [ref] $parsed)) {
    return $false
  }
  $bytes = $parsed.GetAddressBytes()
  if ($bytes.Count -ne 4) {
    return $false
  }
  return (
    $bytes[0] -eq 10 -or
    ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
    ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
  )
}

function Add-StrattonVerificationCheck {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[object]] $Checks,

    [Parameter(Mandatory)]
    [string] $Name
  )

  $Checks.Add([pscustomobject]@{
      name = $Name
      status = 'PASS'
    })
}

function ConvertTo-StrattonVerificationResult {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Evidence
  )

  $checks = [System.Collections.Generic.List[object]]::new()

  $resources = @($Evidence.resourceHealth)
  if (
    $resources.Count -lt 3 -or
    @(
      $resources |
        Where-Object {
          $_.provisioningState -ne 'Succeeded' -or
          $_.availabilityState -ne 'Available'
        }
    ).Count -gt 0
  ) {
    throw 'RESOURCE_HEALTH_VERIFICATION_FAILED'
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'RESOURCE_HEALTH'

  foreach ($app in @('web', 'bff', 'phase5')) {
    $healthy = @(
      $Evidence.revisions |
        Where-Object {
          $_.app -ceq $app -and
          $_.active -eq $true -and
          $_.healthState -ceq 'Healthy' -and
          $_.runningState -ceq 'Running'
        }
    )
    if ($healthy.Count -lt 1) {
      throw "CONTAINER_APP_REVISION_UNHEALTHY:$app"
    }
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'CONTAINER_APP_REVISIONS'

  if (
    $Evidence.ingress.webExternal -ne $true -or
    $Evidence.ingress.bffExternal -ne $false -or
    $Evidence.ingress.phase5External -ne $false
  ) {
    throw 'RUNTIME_INGRESS_BOUNDARY_INVALID'
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'INGRESS_BOUNDARIES'

  if (
    $Evidence.health.web -ne $true -or
    $Evidence.health.bff -ne $true -or
    $Evidence.health.phase5 -ne $true
  ) {
    throw 'RUNTIME_HEALTH_VERIFICATION_FAILED'
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'RUNTIME_HEALTH'

  foreach ($name in @('applications', 'consent', 'federatedCredential', 'completionRole')) {
    if ((Get-StrattonPropertyValue -InputObject $Evidence.entra -Name $name) -ne $true) {
      throw "ENTRA_VERIFICATION_FAILED:$name"
    }
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'ENTRA_STATE'

  if (
    $Evidence.sql.privateDns -ne $true -or
    $Evidence.sql.tokenAuthenticatedQuery -ne $true
  ) {
    throw 'PRIVATE_SQL_VERIFICATION_FAILED'
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'PRIVATE_SQL'

  $requiredRoleChecks = @(
    'ACR_PULL_WEB',
    'ACR_PULL_BFF',
    'ACR_PULL_PHASE5',
    'ACR_PULL_VERIFICATION',
    'STORAGE_BFF',
    'SERVICEBUS_BFF',
    'SERVICEBUS_PHASE5',
    'SEARCH_BFF',
    'DOCUMENT_INTELLIGENCE_BFF',
    'OPENAI_BFF'
  )
  foreach ($requiredRoleCheck in $requiredRoleChecks) {
    if (@($Evidence.roleAssignments) -notcontains $requiredRoleCheck) {
      throw "ROLE_ASSIGNMENT_VERIFICATION_FAILED:$requiredRoleCheck"
    }
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'ROLE_ASSIGNMENTS'

  $routeBindings = @($Evidence.routeBindings)
  if ($routeBindings.Count -ne 3) {
    throw 'ROUTE_BINDING_SEQUENCE_INVALID'
  }
  $expectedRoutes = @('LUNA', 'TERRA', 'SOL')
  for ($index = 0; $index -lt $expectedRoutes.Count; $index++) {
    $binding = $routeBindings[$index]
    if ($binding.route -cne $expectedRoutes[$index]) {
      throw 'ROUTE_BINDING_SEQUENCE_INVALID'
    }
    if ($binding.armMatches -ne $true -or $binding.phase5Matches -ne $true) {
      throw "ROUTE_BINDING_VERIFICATION_FAILED:$($binding.route)"
    }
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'ROUTE_BINDINGS'

  if (
    $Evidence.playwright.authenticated -ne $true -or
    $Evidence.playwright.scenario -cne 'project-danube' -or
    $Evidence.playwright.passed -ne $true
  ) {
    throw 'AUTHENTICATED_PROJECT_DANUBE_VERIFICATION_FAILED'
  }
  Add-StrattonVerificationCheck -Checks $checks -Name 'AUTHENTICATED_PROJECT_DANUBE'

  return [pscustomobject]@{
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    status = 'PASS'
    checks = @($checks)
    routeBindings = $routeBindings
    playwright = [pscustomobject]@{
      authenticated = $true
      scenario = 'project-danube'
      passed = $true
    }
  }
}

function ConvertTo-StrattonBase64Json {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $InputObject
  )

  $json = $InputObject | ConvertTo-Json -Depth 50 -Compress
  return [Convert]::ToBase64String(
    [System.Text.UTF8Encoding]::new($false).GetBytes($json)
  )
}

function Assert-StrattonVerificationJobPayload {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Image,

    [Parameter(Mandatory)]
    [string[]] $EnvironmentVariables
  )

  if ($Image -cnotmatch '^[^@\s]+/stratton/demo-bff@sha256:[a-f0-9]{64}$') {
    throw 'VERIFICATION_IMAGE_DIGEST_INVALID'
  }
  $allowedNames = @(
    'STRATTON_VERIFICATION_NONCE',
    'STRATTON_BFF_HEALTH_URL',
    'STRATTON_PHASE5_HEALTH_URL',
    'AZURE_SQL_SERVER_FQDN',
    'AZURE_SQL_DATABASE_NAME',
    'AZURE_MANAGED_IDENTITY_CLIENT_ID',
    'STRATTON_TENANT_ID',
    'STRATTON_CASE_ID',
    'STRATTON_EXPECTED_ROUTES_BASE64'
  )
  $names = [System.Collections.Generic.List[string]]::new()
  foreach ($environmentVariable in $EnvironmentVariables) {
    $separator = $environmentVariable.IndexOf('=')
    if ($separator -lt 1 -or $environmentVariable -match "[`r`n]") {
      throw 'VERIFICATION_ENVIRONMENT_VARIABLE_INVALID'
    }
    $name = $environmentVariable.Substring(0, $separator)
    if ($name -match '(?i)(password|connection.?string|client.?secret|api.?key|access.?token|refresh.?token)') {
      throw "VERIFICATION_SECRET_ENVIRONMENT_VARIABLE_PROHIBITED:$name"
    }
    if ($allowedNames -cnotcontains $name -or $names -ccontains $name) {
      throw "VERIFICATION_ENVIRONMENT_VARIABLE_INVALID:$name"
    }
    $names.Add($name)
  }
  $actualNameSet = (@($names | Sort-Object) -join '|')
  $allowedNameSet = (@($allowedNames | Sort-Object) -join '|')
  if ($actualNameSet -cne $allowedNameSet) {
    throw 'VERIFICATION_ENVIRONMENT_VARIABLE_SET_INVALID'
  }
}

function New-StrattonVerificationJobCreateArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $ContainerAppsEnvironmentId,

    [Parameter(Mandatory)]
    [string] $Image,

    [Parameter(Mandatory)]
    [string] $RegistryServer,

    [Parameter(Mandatory)]
    [string] $VerificationIdentityResourceId,

    [Parameter(Mandatory)]
    [string[]] $EnvironmentVariables
  )

  Assert-StrattonVerificationJobPayload -Image $Image -EnvironmentVariables $EnvironmentVariables
  return @(
    'containerapp', 'job', 'create',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId,
    '--environment', $ContainerAppsEnvironmentId,
    '--trigger-type', 'Manual',
    '--replica-timeout', '600',
    '--replica-retry-limit', '0',
    '--replica-completion-count', '1',
    '--parallelism', '1',
    '--image', $Image,
    '--container-name', 'verification',
    '--cpu', '0.5',
    '--memory', '1.0Gi',
    '--mi-user-assigned', $VerificationIdentityResourceId,
    '--registry-server', $RegistryServer,
    '--registry-identity', $VerificationIdentityResourceId,
    '--command', 'node',
    '--args', 'apps/bff/dist/verification-job.js',
    '--env-vars'
  ) + $EnvironmentVariables
}

function New-StrattonVerificationJobUpdateArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $Image,

    [Parameter(Mandatory)]
    [string[]] $EnvironmentVariables
  )

  Assert-StrattonVerificationJobPayload -Image $Image -EnvironmentVariables $EnvironmentVariables
  return @(
    'containerapp', 'job', 'update',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId,
    '--replica-timeout', '600',
    '--replica-retry-limit', '0',
    '--replica-completion-count', '1',
    '--parallelism', '1',
    '--image', $Image,
    '--container-name', 'verification',
    '--cpu', '0.5',
    '--memory', '1.0Gi',
    '--command', 'node',
    '--args', 'apps/bff/dist/verification-job.js',
    '--replace-env-vars'
  ) + $EnvironmentVariables
}

function New-StrattonVerificationJobIdentityArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $VerificationIdentityResourceId
  )

  return @(
    'containerapp', 'job', 'identity', 'assign',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId,
    '--user-assigned', $VerificationIdentityResourceId
  )
}

function New-StrattonVerificationJobRegistryArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $RegistryServer,

    [Parameter(Mandatory)]
    [string] $VerificationIdentityResourceId
  )

  return @(
    'containerapp', 'job', 'registry', 'set',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId,
    '--server', $RegistryServer,
    '--identity', $VerificationIdentityResourceId
  )
}

function New-StrattonVerificationJobIdentityRemovalArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [switch] $RemoveSystemAssigned,

    [string[]] $UserAssignedIdentityResourceIds = @()
  )

  if (-not $RemoveSystemAssigned -and $UserAssignedIdentityResourceIds.Count -eq 0) {
    throw 'VERIFICATION_JOB_IDENTITY_REMOVAL_EMPTY'
  }
  $arguments = @(
    'containerapp', 'job', 'identity', 'remove',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId
  )
  if ($RemoveSystemAssigned) {
    $arguments += '--system-assigned'
  }
  if ($UserAssignedIdentityResourceIds.Count -gt 0) {
    $arguments += '--user-assigned'
    $arguments += $UserAssignedIdentityResourceIds
  }
  return $arguments
}

function New-StrattonVerificationJobRegistryRemovalArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $RegistryServer
  )

  return @(
    'containerapp', 'job', 'registry', 'remove',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId,
    '--server', $RegistryServer
  )
}

function New-StrattonVerificationJobLogArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $ExecutionName
  )

  return @(
    'containerapp', 'job', 'logs', 'show',
    '--name', $JobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId,
    '--execution', $ExecutionName,
    '--container', 'verification',
    '--tail', '200',
    '--format', 'text',
    '--only-show-errors'
  )
}

function Get-StrattonVerificationExecutionValue {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $InputObject,

    [Parameter(Mandatory)]
    [ValidateSet('NAME', 'STATUS')]
    [string] $Kind
  )

  $candidates = if ($Kind -eq 'NAME') {
    @(
      Get-StrattonPropertyValue -InputObject $InputObject -Name 'name'
      Get-StrattonNestedValue -InputObject $InputObject -Path @('properties', 'latestExecutionName')
    )
  }
  else {
    @(
      Get-StrattonPropertyValue -InputObject $InputObject -Name 'status'
      Get-StrattonNestedValue -InputObject $InputObject -Path @('properties', 'status')
    )
  }
  $values = @(
    $candidates |
      Where-Object { $_ -is [string] -and -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  if ($values.Count -ne 1) {
    throw "AMBIGUOUS_VERIFICATION_JOB_EXECUTION_$Kind"
  }
  return [string] $values[0]
}

function Assert-StrattonVerificationExecutionSucceeded {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $ExecutionName,

    [AllowNull()]
    [string] $TerminalStatus
  )

  if ($TerminalStatus -cne 'Succeeded') {
    throw "VERIFICATION_JOB_FAILED:${ExecutionName}:$TerminalStatus"
  }
}

function Wait-StrattonVerificationJobExecution {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $ExecutionName,

    [ValidateRange(0, 3600)]
    [int] $PollIntervalSeconds = 10,

    [ValidateRange(1, 360)]
    [int] $MaxPollAttempts = 60,

    [scriptblock] $AzInvoker
  )

  if (-not $AzInvoker) {
    $AzInvoker = {
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
    'Stopped'
  )
  $terminalStatus = $null
  $lastStatus = $null
  for ($attempt = 1; $attempt -le $MaxPollAttempts; $attempt++) {
    $execution = & $AzInvoker @(
      'containerapp', 'job', 'execution', 'show',
      '--name', $JobName,
      '--resource-group', $ResourceGroupName,
      '--subscription', $SubscriptionId,
      '--job-execution-name', $ExecutionName
    )
    $status = Get-StrattonVerificationExecutionValue -InputObject $execution -Kind STATUS
    $lastStatus = $status
    if ($status -in $terminalStatuses) {
      $terminalStatus = $status
      break
    }
    if ($attempt -lt $MaxPollAttempts -and $PollIntervalSeconds -gt 0) {
      Start-Sleep -Seconds $PollIntervalSeconds
    }
  }

  if ($null -eq $terminalStatus) {
    throw "VERIFICATION_JOB_NOT_TERMINAL:${ExecutionName}:$lastStatus"
  }

  Assert-StrattonVerificationExecutionSucceeded `
    -ExecutionName $ExecutionName `
    -TerminalStatus $terminalStatus
  return $terminalStatus
}

function Test-StrattonVerificationJsonLogFrame {
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
      $null -ne (Get-StrattonPropertyValue -InputObject $frame -Name 'TimeStamp') -and
      $null -ne (Get-StrattonPropertyValue -InputObject $frame -Name 'Log')
    ) {
      return $true
    }
  }
  return $false
}

function ConvertFrom-StrattonVerificationJobLog {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $RawLog,

    [Parameter(Mandatory)]
    [string] $ExpectedNonce,

    [Parameter(Mandatory)]
    [datetimeoffset] $InvocationStartedAt,

    [Parameter(Mandatory)]
    [datetimeoffset] $Now
  )

  $prefix = 'STRATTON_VERIFICATION_RECEIPT:'
  $lines = @($RawLog -split "`r?`n")
  if (@($lines | Where-Object { Test-StrattonVerificationJsonLogFrame -Line $_ }).Count -gt 0) {
    throw 'VERIFICATION_JOB_LOG_FORMAT_INVALID'
  }
  $markerLines = @(
    $lines |
      Where-Object { $_.Contains($prefix, [System.StringComparison]::Ordinal) }
  )
  if ($markerLines.Count -eq 0) {
    throw 'VERIFICATION_JOB_RECEIPT_MISSING'
  }
  if ($markerLines.Count -gt 1) {
    throw 'VERIFICATION_JOB_RECEIPT_AMBIGUOUS'
  }
  $markerIndex = $markerLines[0].IndexOf($prefix, [System.StringComparison]::Ordinal)
  $encoded = $markerLines[0].Substring($markerIndex + $prefix.Length).Trim()
  if ($encoded -cnotmatch '^[A-Za-z0-9+/]+={0,2}$') {
    throw 'VERIFICATION_JOB_RECEIPT_MALFORMED'
  }
  try {
    $json = [System.Text.UTF8Encoding]::new($false).GetString(
      [Convert]::FromBase64String($encoded)
    )
    $receipt = $json | ConvertFrom-Json -Depth 50
  }
  catch {
    throw 'VERIFICATION_JOB_RECEIPT_MALFORMED'
  }

  if (
    (Get-StrattonPropertyValue -InputObject $receipt -Name 'version') -ne 1 -or
    [string] (Get-StrattonPropertyValue -InputObject $receipt -Name 'nonce') -cne $ExpectedNonce
  ) {
    throw 'VERIFICATION_JOB_RECEIPT_BINDING_INVALID'
  }
  try {
    $generatedAt = [datetimeoffset] (
      Get-StrattonPropertyValue -InputObject $receipt -Name 'generatedAtUtc'
    )
  }
  catch {
    throw 'VERIFICATION_JOB_RECEIPT_MALFORMED'
  }
  if (
    ($generatedAt -lt $InvocationStartedAt) -or
    ($generatedAt -gt $Now.AddMinutes(1)) -or
    ($Now.Subtract($generatedAt) -gt [timespan]::FromMinutes(15))
  ) {
    throw 'VERIFICATION_JOB_RECEIPT_STALE'
  }

  $checks = Get-StrattonPropertyValue -InputObject $receipt -Name 'checks'
  foreach ($name in @(
      'bffHealth',
      'phase5Health',
      'sqlPrivateDns',
      'sqlTokenAuthenticatedQuery'
    )) {
    if ((Get-StrattonPropertyValue -InputObject $checks -Name $name) -ne $true) {
      throw "VERIFICATION_JOB_CHECK_FAILED:$name"
    }
  }
  $routeBindings = @(
    Get-StrattonPropertyValue -InputObject $receipt -Name 'routeBindings'
  )
  if (
    $routeBindings.Count -ne 3 -or
    @($routeBindings.route) -join '|' -cne 'LUNA|TERRA|SOL'
  ) {
    throw 'VERIFICATION_JOB_ROUTE_BINDINGS_INVALID'
  }
  return [pscustomobject]@{
    bffHealth = $true
    phase5Health = $true
    sqlPrivateDns = $true
    sqlTokenAuthenticatedQuery = $true
    routeBindings = $routeBindings
  }
}

function ConvertTo-StrattonKustoStringLiteral {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Value
  )

  return Assert-StrattonKustoLiteralSafe -Value $Value -Name 'VerificationLiteral'
}

function Get-StrattonVerificationJobReceipt {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $ExecutionName,

    [Parameter(Mandatory)]
    [string] $WorkspaceResourceId,

    [Parameter(Mandatory)]
    [string] $ExpectedNonce,

    [Parameter(Mandatory)]
    [datetimeoffset] $InvocationStartedAt,

    [ValidateRange(1, 10)]
    [int] $LiveLogMaxAttempts = 3,

    [ValidateRange(1, 10)]
    [int] $LogAnalyticsMaxAttempts = 3,

    [ValidateRange(0, 30)]
    [int] $RetryIntervalSeconds = 2,

    [string] $TemporaryDirectory,

    [scriptblock] $NowProvider,

    [scriptblock] $AzInvoker,

    [scriptblock] $LogInvoker
  )

  if (-not $NowProvider) {
    $NowProvider = { [datetimeoffset]::UtcNow }
  }
  if (-not $AzInvoker) {
    $AzInvoker = {
      param([string[]] $Arguments)
      Invoke-AzJson -Arguments $Arguments
    }
  }
  if (-not $LogInvoker) {
    $LogInvoker = {
      param([string[]] $Arguments)
      $rawLog = & az @Arguments 2>&1
      if ($LASTEXITCODE -ne 0) {
        throw 'VERIFICATION_JOB_LOG_RETRIEVAL_FAILED'
      }
      return ($rawLog | Out-String)
    }
  }

  $logArguments = New-StrattonVerificationJobLogArguments `
    -JobName $JobName `
    -ResourceGroupName $ResourceGroupName `
    -SubscriptionId $SubscriptionId `
    -ExecutionName $ExecutionName
  $receiptParser = {
    param(
      [string] $RawLog,
      [datetimeoffset] $Now,
      [hashtable] $State
    )

    ConvertFrom-StrattonVerificationJobLog `
      -RawLog $RawLog `
      -ExpectedNonce $State.ExpectedNonce `
      -InvocationStartedAt $State.InvocationStartedAt `
      -Now $Now
  }

  return Get-StrattonDurableJobReceipt `
    -JobName $JobName `
    -ExecutionName $ExecutionName `
    -ContainerName 'verification' `
    -ReceiptMarker 'STRATTON_VERIFICATION_RECEIPT:' `
    -WorkspaceResourceId $WorkspaceResourceId `
    -SubscriptionId $SubscriptionId `
    -LogArguments $logArguments `
    -InvocationStartedAt $InvocationStartedAt `
    -ReceiptParser $receiptParser `
    -ReceiptParserState @{
      ExpectedNonce = $ExpectedNonce
      InvocationStartedAt = $InvocationStartedAt
    } `
    -RetryableErrorMessages @(
      'VERIFICATION_JOB_LOG_RETRIEVAL_FAILED',
      'VERIFICATION_JOB_RECEIPT_MISSING'
    ) `
    -MissingReceiptError 'VERIFICATION_JOB_RECEIPT_MISSING' `
    -QueryFailedError 'VERIFICATION_JOB_LOG_ANALYTICS_QUERY_FAILED' `
    -TemporaryDirectory $TemporaryDirectory `
    -LiveLogMaxAttempts $LiveLogMaxAttempts `
    -LogAnalyticsMaxAttempts $LogAnalyticsMaxAttempts `
    -RetryIntervalSeconds $RetryIntervalSeconds `
    -NowProvider $NowProvider `
    -AzInvoker $AzInvoker `
    -LogInvoker $LogInvoker
}

function Get-StrattonExpectedVerificationRoutes {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Outputs
  )

  return @(
    foreach ($definition in @(
        Get-Content (Join-Path $PSScriptRoot 'route-evidence.json') -Raw |
          ConvertFrom-Json -Depth 30
      )) {
      [pscustomobject]@{
        route = [string] $definition.route
        resourceId = Resolve-StrattonRouteTemplateValue `
          -Value ([string] $definition.accountResourceId) `
          -Outputs $Outputs
        deploymentId = Resolve-StrattonRouteTemplateValue `
          -Value ([string] $definition.deploymentId) `
          -Outputs $Outputs
        region = Resolve-StrattonRouteTemplateValue `
          -Value ([string] $definition.region) `
          -Outputs $Outputs
        apiVersion = [string] $definition.apiVersion
        evidenceId = [string] $definition.evidenceId
        evidenceVersion = [string] $definition.evidenceVersion
      }
    }
  )
}

function Get-StrattonPinnedVerificationImage {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $State,

    [Parameter(Mandatory)]
    [object] $Outputs
  )

  $parametersPath = Join-Path $script:DeploymentArtifactRoot 'application.parameters.json'
  Assert-StrattonFileHash `
    -Path $parametersPath `
    -ExpectedHash ([string] (
      Get-StrattonRequiredValue -InputObject $State -Name 'applicationParameterFileHash'
    )) `
    -Kind 'PARAMETER'
  $parameterDocument = Read-StrattonJsonArtifact -Path $parametersPath
  $repository = [string] (
    Get-StrattonNestedValue `
      -InputObject $parameterDocument `
      -Path @('parameters', 'bffImageRepository', 'value')
  )
  $digest = [string] (
    Get-StrattonNestedValue `
      -InputObject $parameterDocument `
      -Path @('parameters', 'bffImageDigest', 'value')
  )
  if ($repository -cne 'stratton/demo-bff' -or -not (Test-ImageDigest -Digest $digest)) {
    throw 'VERIFICATION_IMAGE_PARAMETER_INVALID'
  }
  $imagesArtifact = Read-StrattonJsonArtifact `
    -Path (Join-Path $script:DeploymentArtifactRoot 'images.json')
  $matches = @(
    $imagesArtifact.images |
      Where-Object {
        $_.repository -ceq $repository -and
        $_.digest -ceq $digest
      }
  )
  if ($matches.Count -ne 1) {
    throw 'VERIFICATION_IMAGE_ARTIFACT_DRIFT'
  }
  $registryServer = [string] (
    Get-StrattonRequiredValue -InputObject $Outputs -Name 'containerRegistryServer'
  )
  return "$registryServer/$repository@$digest"
}

function Assert-StrattonVerificationJobDefinition {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Job,

    [Parameter(Mandatory)]
    [string] $Image,

    [Parameter(Mandatory)]
    [string] $RegistryServer,

    [Parameter(Mandatory)]
    [string] $VerificationIdentityResourceId,

    [Parameter(Mandatory)]
    [string[]] $EnvironmentVariables
  )

  $identityType = [string] (Get-StrattonNestedValue -InputObject $Job -Path @('identity', 'type'))
  $userAssigned = Get-StrattonNestedValue `
    -InputObject $Job `
    -Path @('identity', 'userAssignedIdentities')
  $identityNames = @(
    if ($null -ne $userAssigned) {
      $userAssigned.PSObject.Properties.Name
    }
  )
  if (
    $identityType -cne 'UserAssigned' -or
    $identityNames.Count -ne 1 -or
    $identityNames[0] -ine $VerificationIdentityResourceId
  ) {
    throw 'VERIFICATION_JOB_IDENTITY_INVALID'
  }

  $registries = @(
    Get-StrattonNestedValue -InputObject $Job -Path @('properties', 'configuration', 'registries')
  )
  if (
    $registries.Count -ne 1 -or
    [string] $registries[0].server -cne $RegistryServer -or
    [string] $registries[0].identity -ine $VerificationIdentityResourceId
  ) {
    throw 'VERIFICATION_JOB_REGISTRY_INVALID'
  }
  if (
    [string] (Get-StrattonNestedValue -InputObject $Job -Path @('properties', 'configuration', 'triggerType')) -cne 'Manual'
  ) {
    throw 'VERIFICATION_JOB_TRIGGER_INVALID'
  }
  $containers = @(
    Get-StrattonNestedValue -InputObject $Job -Path @('properties', 'template', 'containers')
  )
  if (
    $containers.Count -ne 1 -or
    [string] $containers[0].name -cne 'verification' -or
    [string] $containers[0].image -cne $Image -or
    @($containers[0].command) -join ' ' -cne 'node' -or
    @($containers[0].args) -join ' ' -cne 'apps/bff/dist/verification-job.js'
  ) {
    throw 'VERIFICATION_JOB_CONTAINER_INVALID'
  }
  $actualEnvironment = @(
    $containers[0].env |
      ForEach-Object { "$($_.name)=$($_.value)" }
  )
  $actualEnvironmentSet = (@($actualEnvironment | Sort-Object) -join '|')
  $expectedEnvironmentSet = (@($EnvironmentVariables | Sort-Object) -join '|')
  if ($actualEnvironmentSet -cne $expectedEnvironmentSet) {
    throw 'VERIFICATION_JOB_ENVIRONMENT_INVALID'
  }
}

function Invoke-StrattonVerificationJob {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Outputs,

    [Parameter(Mandatory)]
    [string] $Image,

    [Parameter(Mandatory)]
    [object[]] $ExpectedRoutes,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [ValidateRange(0, 3600)]
    [int] $PollIntervalSeconds = 10,

    [ValidateRange(1, 360)]
    [int] $MaxPollAttempts = 60,

    [scriptblock] $NonceProvider,

    [scriptblock] $NowProvider,

    [scriptblock] $AzInvoker,

    [scriptblock] $LogInvoker
  )

  if (-not $NonceProvider) {
    $NonceProvider = { [guid]::NewGuid().ToString('N') }
  }
  if (-not $NowProvider) {
    $NowProvider = { [datetimeoffset]::UtcNow }
  }
  if (-not $AzInvoker) {
    $AzInvoker = {
      param([string[]] $Arguments)
      Invoke-AzJson -Arguments $Arguments
    }
  }
  if (-not $LogInvoker) {
    $LogInvoker = {
      param([string[]] $Arguments)
      $rawLog = & az @Arguments 2>&1
      if ($LASTEXITCODE -ne 0) {
        throw 'VERIFICATION_JOB_LOG_RETRIEVAL_FAILED'
      }
      return ($rawLog | Out-String)
    }
  }

  $jobName = 'stratton-verification'
  $nonce = [string] (& $NonceProvider)
  if ([string]::IsNullOrWhiteSpace($nonce) -or $nonce -cnotmatch '^[A-Za-z0-9-]{8,128}$') {
    throw 'VERIFICATION_JOB_NONCE_INVALID'
  }
  $invocationStartedAt = [datetimeoffset] (& $NowProvider)
  $registryServer = [string] (
    Get-StrattonRequiredValue -InputObject $Outputs -Name 'containerRegistryServer'
  )
  $identityResourceId = [string] (
    Get-StrattonRequiredValue -InputObject $Outputs -Name 'verificationIdentityResourceId'
  )
  $environmentVariables = @(
    "STRATTON_VERIFICATION_NONCE=$nonce",
    "STRATTON_BFF_HEALTH_URL=https://$(Get-StrattonRequiredValue -InputObject $Outputs -Name 'bffAppFqdn')/healthz",
    "STRATTON_PHASE5_HEALTH_URL=https://$(Get-StrattonRequiredValue -InputObject $Outputs -Name 'phase5ApiFqdn')/health",
    "AZURE_SQL_SERVER_FQDN=$(Get-StrattonRequiredValue -InputObject $Outputs -Name 'sqlServerFqdn')",
    "AZURE_SQL_DATABASE_NAME=$(Get-StrattonRequiredValue -InputObject $Outputs -Name 'sqlDatabaseName')",
    "AZURE_MANAGED_IDENTITY_CLIENT_ID=$(Get-StrattonRequiredValue -InputObject $Outputs -Name 'verificationIdentityClientId')",
    "STRATTON_TENANT_ID=$script:ApprovedTenantId",
    'STRATTON_CASE_ID=project-danube',
    "STRATTON_EXPECTED_ROUTES_BASE64=$(ConvertTo-StrattonBase64Json -InputObject $ExpectedRoutes)"
  )
  Assert-StrattonVerificationJobPayload -Image $Image -EnvironmentVariables $environmentVariables

  $jobExists = $false
  $existingJob = $null
  try {
    $existingJob = & $AzInvoker @(
      'containerapp', 'job', 'show',
      '--name', $jobName,
      '--resource-group', $ResourceGroupName,
      '--subscription', $SubscriptionId
    )
    $jobExists = $true
  }
  catch {
    if ($_.Exception.Message -notmatch '(?i)(JOB_NOT_FOUND|ResourceNotFound|could not be found|not found)') {
      throw
    }
  }

  if ($jobExists) {
    $existingIdentityType = [string] (
      Get-StrattonNestedValue -InputObject $existingJob -Path @('identity', 'type')
    )
    $existingUserAssigned = Get-StrattonNestedValue `
      -InputObject $existingJob `
      -Path @('identity', 'userAssignedIdentities')
    $extraIdentityIds = @(
      if ($null -ne $existingUserAssigned) {
        $existingUserAssigned.PSObject.Properties.Name |
          Where-Object { $_ -ine $identityResourceId }
      }
    )
    $removeSystemAssigned = $existingIdentityType -match 'SystemAssigned'
    if ($removeSystemAssigned -or $extraIdentityIds.Count -gt 0) {
      & $AzInvoker (New-StrattonVerificationJobIdentityRemovalArguments `
          -JobName $jobName `
          -ResourceGroupName $ResourceGroupName `
          -SubscriptionId $SubscriptionId `
          -RemoveSystemAssigned:$removeSystemAssigned `
          -UserAssignedIdentityResourceIds $extraIdentityIds) | Out-Null
    }
    foreach ($existingRegistry in @(
        Get-StrattonNestedValue `
          -InputObject $existingJob `
          -Path @('properties', 'configuration', 'registries')
      )) {
      if (
        -not [string]::IsNullOrWhiteSpace([string] $existingRegistry.server) -and
        [string] $existingRegistry.server -cne $registryServer
      ) {
        & $AzInvoker (New-StrattonVerificationJobRegistryRemovalArguments `
            -JobName $jobName `
            -ResourceGroupName $ResourceGroupName `
            -SubscriptionId $SubscriptionId `
            -RegistryServer ([string] $existingRegistry.server)) | Out-Null
      }
    }
    & $AzInvoker (New-StrattonVerificationJobIdentityArguments `
        -JobName $jobName `
        -ResourceGroupName $ResourceGroupName `
        -SubscriptionId $SubscriptionId `
        -VerificationIdentityResourceId $identityResourceId) | Out-Null
    & $AzInvoker (New-StrattonVerificationJobRegistryArguments `
        -JobName $jobName `
        -ResourceGroupName $ResourceGroupName `
        -SubscriptionId $SubscriptionId `
        -RegistryServer $registryServer `
        -VerificationIdentityResourceId $identityResourceId) | Out-Null
    & $AzInvoker (New-StrattonVerificationJobUpdateArguments `
        -JobName $jobName `
        -ResourceGroupName $ResourceGroupName `
        -SubscriptionId $SubscriptionId `
        -Image $Image `
        -EnvironmentVariables $environmentVariables) | Out-Null
  }
  else {
    & $AzInvoker (New-StrattonVerificationJobCreateArguments `
        -JobName $jobName `
        -ResourceGroupName $ResourceGroupName `
        -SubscriptionId $SubscriptionId `
        -ContainerAppsEnvironmentId (
          Get-StrattonRequiredValue -InputObject $Outputs -Name 'containerAppsEnvironmentId'
        ) `
        -Image $Image `
        -RegistryServer $registryServer `
        -VerificationIdentityResourceId $identityResourceId `
        -EnvironmentVariables $environmentVariables) | Out-Null
  }

  $reconciledJob = & $AzInvoker @(
    'containerapp', 'job', 'show',
    '--name', $jobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId
  )
  Assert-StrattonVerificationJobDefinition `
    -Job $reconciledJob `
    -Image $Image `
    -RegistryServer $registryServer `
    -VerificationIdentityResourceId $identityResourceId `
    -EnvironmentVariables $environmentVariables

  $started = & $AzInvoker @(
    'containerapp', 'job', 'start',
    '--name', $jobName,
    '--resource-group', $ResourceGroupName,
    '--subscription', $SubscriptionId
  )
  $executionName = Get-StrattonVerificationExecutionValue -InputObject $started -Kind NAME
  Wait-StrattonVerificationJobExecution `
    -JobName $jobName `
    -ResourceGroupName $ResourceGroupName `
    -SubscriptionId $SubscriptionId `
    -ExecutionName $executionName `
    -PollIntervalSeconds $PollIntervalSeconds `
    -MaxPollAttempts $MaxPollAttempts `
    -AzInvoker $AzInvoker | Out-Null

  return Get-StrattonVerificationJobReceipt `
    -JobName $jobName `
    -ResourceGroupName $ResourceGroupName `
    -SubscriptionId $SubscriptionId `
    -ExecutionName $executionName `
    -WorkspaceResourceId (
      Get-StrattonRequiredValue -InputObject $Outputs -Name 'logAnalyticsWorkspaceId'
    ) `
    -ExpectedNonce $nonce `
    -InvocationStartedAt $invocationStartedAt `
    -NowProvider $NowProvider `
    -AzInvoker $AzInvoker `
    -LogInvoker $LogInvoker
}

function Test-StrattonRoleAssignment {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object[]] $Assignments,

    [Parameter(Mandatory)]
    [string] $PrincipalId,

    [Parameter(Mandatory)]
    [string] $Scope,

    [Parameter(Mandatory)]
    [string] $RoleDefinitionGuid
  )

  return [bool] @(
    $Assignments |
      Where-Object {
        $_.principalId -ceq $PrincipalId -and
        $_.scope.TrimEnd('/') -ceq $Scope.TrimEnd('/') -and
        ([string] $_.roleDefinitionId).TrimEnd('/').EndsWith("/$RoleDefinitionGuid", [System.StringComparison]::OrdinalIgnoreCase)
      }
  ).Count
}

function Get-StrattonRoleAssignmentKey {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $PrincipalId,

    [Parameter(Mandatory)]
    [string] $Scope,

    [Parameter(Mandatory)]
    [string] $RoleDefinitionGuid
  )

  return '{0}|{1}|{2}' -f @(
    $PrincipalId.ToLowerInvariant(),
    $Scope.TrimEnd('/').ToLowerInvariant(),
    $RoleDefinitionGuid.ToLowerInvariant()
  )
}

function Assert-StrattonExactRuntimeRoleAssignments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object[]] $Assignments,

    [Parameter(Mandatory)]
    [object[]] $ExpectedAssignments,

    [Parameter(Mandatory)]
    [string[]] $RuntimePrincipalIds
  )

  $expectedKeys = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::Ordinal
  )
  foreach ($expected in $ExpectedAssignments) {
    $expectedKeys.Add(
      (Get-StrattonRoleAssignmentKey `
          -PrincipalId ([string] $expected.principalId) `
          -Scope ([string] $expected.scope) `
          -RoleDefinitionGuid ([string] $expected.roleDefinitionGuid))
    ) | Out-Null
  }

  $actualKeys = [System.Collections.Generic.HashSet[string]]::new(
    [System.StringComparer]::Ordinal
  )
  foreach ($assignment in @(
      $Assignments |
        Where-Object { @($RuntimePrincipalIds) -icontains [string] $_.principalId }
    )) {
    $roleDefinitionGuid = ([string] $assignment.roleDefinitionId).TrimEnd('/').Split('/')[-1]
    $key = Get-StrattonRoleAssignmentKey `
      -PrincipalId ([string] $assignment.principalId) `
      -Scope ([string] $assignment.scope) `
      -RoleDefinitionGuid $roleDefinitionGuid
    if (-not $expectedKeys.Contains($key)) {
      throw "UNEXPECTED_RUNTIME_ROLE_ASSIGNMENT:$key"
    }
    $actualKeys.Add($key) | Out-Null
  }

  foreach ($key in $expectedKeys) {
    if (-not $actualKeys.Contains($key)) {
      throw "EXPECTED_RUNTIME_ROLE_ASSIGNMENT_MISSING:$key"
    }
  }
}

function Get-StrattonExpectedRuntimeRoleAssignments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Outputs
  )

  $roles = @{
    acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
    storage = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
    serviceBus = '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
    search = '1407120a-92aa-4202-b7e9-c0e197c71c8f'
    cognitiveUser = 'a97b65f3-24c7-4388-baec-2e87135dc908'
    openAiUser = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
    reader = 'acdd72a7-3385-48ef-bd42-f606fba81ae7'
  }
  $expected = [System.Collections.Generic.List[object]]::new()
  $registryId = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name 'containerRegistryId')
  foreach ($app in @(
      @{ label = 'ACR_PULL_WEB'; principal = 'webIdentityPrincipalId' }
      @{ label = 'ACR_PULL_BFF'; principal = 'bffIdentityPrincipalId' }
      @{ label = 'ACR_PULL_PHASE5'; principal = 'phase5IdentityPrincipalId' }
      @{ label = 'ACR_PULL_VERIFICATION'; principal = 'verificationIdentityPrincipalId' }
    )) {
    $expected.Add([pscustomobject]@{
        label = $app.label
        principalId = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name $app.principal)
        scope = $registryId
        roleDefinitionGuid = $roles.acrPull
      })
  }

  $bffPrincipalId = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name 'bffIdentityPrincipalId')
  $phase5PrincipalId = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name 'phase5IdentityPrincipalId')
  $storageScope = '{0}/blobServices/default/containers/{1}' -f @(
    (Get-StrattonRequiredValue -InputObject $Outputs -Name 'blobStorageAccountResourceId'),
    (Get-StrattonRequiredValue -InputObject $Outputs -Name 'blobContainerName')
  )
  $expected.Add([pscustomobject]@{
      label = 'STORAGE_BFF'
      principalId = $bffPrincipalId
      scope = $storageScope
      roleDefinitionGuid = $roles.storage
    })

  $serviceBusRoot = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name 'serviceBusNamespaceResourceId')
  $expected.Add([pscustomobject]@{
      label = 'SERVICEBUS_BFF'
      principalId = $bffPrincipalId
      scope = "$serviceBusRoot/queues/$(Get-StrattonRequiredValue -InputObject $Outputs -Name 'serviceBusQueueName')"
      roleDefinitionGuid = $roles.serviceBus
    })
  foreach ($queueOutputName in @('ingestionQueueName', 'extractionQueueName', 'indexingQueueName')) {
    $expected.Add([pscustomobject]@{
        label = 'SERVICEBUS_PHASE5'
        principalId = $phase5PrincipalId
        scope = "$serviceBusRoot/queues/$(Get-StrattonRequiredValue -InputObject $Outputs -Name $queueOutputName)"
        roleDefinitionGuid = $roles.serviceBus
      })
  }

  foreach ($dependency in @(
      @{
        label = 'SEARCH_BFF'
        scope = 'searchServiceResourceId'
        role = $roles.search
      }
      @{
        label = 'DOCUMENT_INTELLIGENCE_BFF'
        scope = 'documentIntelligenceAccountResourceId'
        role = $roles.cognitiveUser
      }
    )) {
    $expected.Add([pscustomobject]@{
        label = $dependency.label
        principalId = $bffPrincipalId
        scope = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name $dependency.scope)
        roleDefinitionGuid = $dependency.role
      })
  }

  foreach ($outputName in @('lunaOpenAiAccountResourceId', 'terraOpenAiAccountResourceId', 'solOpenAiAccountResourceId')) {
    $scope = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name $outputName)
    foreach ($role in @($roles.openAiUser, $roles.reader)) {
      $expected.Add([pscustomobject]@{
          label = 'OPENAI_BFF'
          principalId = $bffPrincipalId
          scope = $scope
          roleDefinitionGuid = $role
        })
    }
  }

  return @(
    $expected |
      Group-Object {
        Get-StrattonRoleAssignmentKey `
          -PrincipalId ([string] $_.principalId) `
          -Scope ([string] $_.scope) `
          -RoleDefinitionGuid ([string] $_.roleDefinitionGuid)
      } |
      ForEach-Object { $_.Group[0] }
  )
}

function Get-StrattonRoleAssignmentChecks {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Outputs,

    [Parameter(Mandatory)]
    [object[]] $Assignments
  )

  $expected = @(Get-StrattonExpectedRuntimeRoleAssignments -Outputs $Outputs)
  $runtimePrincipalIds = @(
    Get-StrattonRequiredValue -InputObject $Outputs -Name 'webIdentityPrincipalId'
    Get-StrattonRequiredValue -InputObject $Outputs -Name 'bffIdentityPrincipalId'
    Get-StrattonRequiredValue -InputObject $Outputs -Name 'phase5IdentityPrincipalId'
    Get-StrattonRequiredValue -InputObject $Outputs -Name 'verificationIdentityPrincipalId'
  )
  Assert-StrattonExactRuntimeRoleAssignments `
    -Assignments $Assignments `
    -ExpectedAssignments $expected `
    -RuntimePrincipalIds $runtimePrincipalIds
  return @($expected.label | Select-Object -Unique)
}

function Resolve-StrattonRouteTemplateValue {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Value,

    [Parameter(Mandatory)]
    [object] $Outputs
  )

  $match = [regex]::Match($Value, '^\$\{([A-Za-z][A-Za-z0-9]*)\}$')
  if ($match.Success) {
    return [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name $match.Groups[1].Value)
  }
  return $Value
}

function Get-StrattonRouteVerification {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Outputs,

    [Parameter(Mandatory)]
    [object[]] $Phase5Bindings,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [scriptblock] $AzInvoker
  )

  $definitions = @(
    Get-Content (Join-Path $PSScriptRoot 'route-evidence.json') -Raw |
      ConvertFrom-Json -Depth 30
  )
  $bindings = [System.Collections.Generic.List[object]]::new()
  foreach ($definition in $definitions) {
    $resourceId = Resolve-StrattonRouteTemplateValue -Value ([string] $definition.accountResourceId) -Outputs $Outputs
    $deploymentId = Resolve-StrattonRouteTemplateValue -Value ([string] $definition.deploymentId) -Outputs $Outputs
    $region = Resolve-StrattonRouteTemplateValue -Value ([string] $definition.region) -Outputs $Outputs
    $parts = $resourceId -split '/'
    if ($parts.Count -lt 9) {
      throw "ROUTE_RESOURCE_ID_INVALID:$($definition.route)"
    }
    $account = & $AzInvoker @(
      'cognitiveservices', 'account', 'show',
      '--name', $parts[8],
      '--resource-group', $parts[4],
      '--subscription', $SubscriptionId
    )
    $deployment = & $AzInvoker @(
      'cognitiveservices', 'account', 'deployment', 'show',
      '--name', $parts[8],
      '--resource-group', $parts[4],
      '--deployment-name', $deploymentId,
      '--subscription', $SubscriptionId
    )
    $phase5 = @($Phase5Bindings | Where-Object route -ceq $definition.route)
    $now = [datetimeoffset]::UtcNow
    $phase5Matches = (
      $phase5.Count -eq 1 -and
      $phase5[0].resourceId -ceq $resourceId -and
      $phase5[0].deploymentId -ceq $deploymentId -and
      $phase5[0].region -ceq $region -and
      $phase5[0].apiVersion -ceq $definition.apiVersion -and
      $phase5[0].evidenceId -ceq $definition.evidenceId -and
      $phase5[0].evidenceVersion -ceq $definition.evidenceVersion -and
      $phase5[0].status -ceq 'APPROVED' -and
      [datetimeoffset] $phase5[0].validFrom -le $now -and
      [datetimeoffset] $phase5[0].validUntil -gt $now
    )
    $bindings.Add([pscustomobject]@{
        route = [string] $definition.route
        armMatches = (
          [string] $account.id -ceq $resourceId -and
          [string] $account.location -ceq $region -and
          [string] $deployment.name -ceq $deploymentId
        )
        phase5Matches = $phase5Matches
      })
  }
  return @($bindings)
}

function Invoke-StrattonAuthenticatedPlaywright {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $BaseUrl,

    [Parameter(Mandatory)]
    [string] $StorageStatePath,

    [Parameter(Mandatory)]
    [string] $SessionStorageStatePath
  )

  if (-not (Test-Path -LiteralPath $StorageStatePath -PathType Leaf)) {
    throw 'PLAYWRIGHT_AUTH_STORAGE_STATE_MISSING'
  }
  if (-not (Test-Path -LiteralPath $SessionStorageStatePath -PathType Leaf)) {
    throw 'PLAYWRIGHT_AUTH_SESSION_STORAGE_STATE_MISSING'
  }
  $previousBaseUrl = $env:STRATTON_E2E_BASE_URL
  $previousStorageState = $env:STRATTON_E2E_STORAGE_STATE
  $previousSessionStorageState = $env:STRATTON_E2E_SESSION_STORAGE_STATE
  try {
    $env:STRATTON_E2E_BASE_URL = $BaseUrl
    $env:STRATTON_E2E_STORAGE_STATE = (Resolve-Path -LiteralPath $StorageStatePath).Path
    $env:STRATTON_E2E_SESSION_STORAGE_STATE = (
      Resolve-Path -LiteralPath $SessionStorageStatePath
    ).Path
    Push-Location $script:DemoPlatformRoot
    try {
      & npx playwright test `
        'tests\e2e\evidence-to-decision.spec.ts' `
        --grep 'Project Danube moves from evidence to committee preparation'
      if ($LASTEXITCODE -ne 0) {
        throw 'AUTHENTICATED_PROJECT_DANUBE_PLAYWRIGHT_FAILED'
      }
    }
    finally {
      Pop-Location
    }
  }
  finally {
    $env:STRATTON_E2E_BASE_URL = $previousBaseUrl
    $env:STRATTON_E2E_STORAGE_STATE = $previousStorageState
    $env:STRATTON_E2E_SESSION_STORAGE_STATE = $previousSessionStorageState
  }
  return [pscustomobject]@{
    authenticated = $true
    scenario = 'project-danube'
    passed = $true
  }
}

function Invoke-StrattonDeploymentVerification {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $PlaywrightStorageStatePath,

    [Parameter(Mandatory)]
    [string] $PlaywrightSessionStorageStatePath,

    [scriptblock] $AzInvoker,

    [scriptblock] $HttpInvoker,

    [scriptblock] $InternalInvoker,

    [scriptblock] $EntraInvoker,

    [scriptblock] $PlaywrightInvoker,

    [scriptblock] $RedirectReconciler
  )

  if (-not $AzInvoker) {
    $AzInvoker = {
      param([string[]] $Arguments)
      Invoke-AzJson -Arguments $Arguments
    }
  }
  if (-not $HttpInvoker) {
    $HttpInvoker = {
      param([string] $Uri)
      Invoke-WebRequest -Uri $Uri -Method Get -MaximumRedirection 0 -TimeoutSec 30
    }
  }

  Assert-StrattonCommittedWorktree
  $state = Get-StrattonDeploymentState -Path $script:DeploymentStatePath
  $subscriptionId = $script:ApprovedSubscriptionId
  $foundationParameters = New-StrattonFoundationParameterValues `
    -SubscriptionId $script:ApprovedSubscriptionId `
    -TenantId $script:ApprovedTenantId
  Assert-DeploymentStateBinding `
    -State $state `
    -SubscriptionId $script:ApprovedSubscriptionId `
    -TenantId $script:ApprovedTenantId `
    -ExpectedUser $script:ApprovedUser `
    -CommitSha (Get-StrattonCommitSha) `
    -ParameterHash (Get-StrattonObjectHash -InputObject $foundationParameters)
  Assert-StrattonDeploymentAzContext `
    -SubscriptionId $script:ApprovedSubscriptionId `
    -TenantId $script:ApprovedTenantId `
    -ExpectedUser $script:ApprovedUser `
    -AzInvoker $AzInvoker
  if ($state.phase -notin @('APPLICATIONS_DEPLOYED', 'ENTRA_REDIRECT_RECONCILED', 'VERIFIED')) {
    throw "DEPLOYMENT_PHASE_REQUIRED:APPLICATIONS_DEPLOYED:$($state.phase)"
  }
  $outputsArtifact = Read-StrattonJsonArtifact -Path $script:OutputsArtifactPath
  $outputs = Get-StrattonPropertyValue -InputObject $outputsArtifact -Name 'application'
  if ($null -eq $outputs) {
    throw 'APPLICATION_OUTPUTS_MISSING'
  }

  $apps = @(& $AzInvoker @(
      'containerapp', 'list',
      '--resource-group', 'stratton-demo-rg',
      '--subscription', $subscriptionId
    ))
  $resourceHealth = @(
    foreach ($appOutputName in @('webAppName', 'bffAppName', 'phase5AppName')) {
      $appName = [string] (Get-StrattonRequiredValue -InputObject $outputs -Name $appOutputName)
      $app = @($apps | Where-Object name -ceq $appName)
      if ($app.Count -ne 1) {
        throw "CONTAINER_APP_INVENTORY_INVALID:$appName"
      }
      $resourceId = [string] (Get-StrattonPropertyValue -InputObject $app[0] -Name 'id')
      if ([string]::IsNullOrWhiteSpace($resourceId)) {
        throw "CONTAINER_APP_RESOURCE_ID_MISSING:$appName"
      }
      $availability = & $AzInvoker @(
        'rest',
        '--method', 'GET',
        '--url', "https://management.azure.com${resourceId}/providers/Microsoft.ResourceHealth/availabilityStatuses/current?api-version=2025-05-01",
        '--subscription', $subscriptionId
      )
      [pscustomobject]@{
        name = $appName
        provisioningState = [string] (Get-StrattonNestedValue -InputObject $app[0] -Path @('properties', 'provisioningState'))
        availabilityState = [string] (Get-StrattonNestedValue -InputObject $availability -Path @('properties', 'availabilityState'))
      }
    }
  )
  $revisions = @(
    foreach ($mapping in @(
        @{ app = 'web'; output = 'webAppName' }
        @{ app = 'bff'; output = 'bffAppName' }
        @{ app = 'phase5'; output = 'phase5AppName' }
      )) {
      $appName = [string] (Get-StrattonRequiredValue -InputObject $outputs -Name $mapping.output)
      foreach ($revision in @(& $AzInvoker @(
            'containerapp', 'revision', 'list',
            '--name', $appName,
            '--resource-group', 'stratton-demo-rg',
            '--subscription', $subscriptionId
          ))) {
        [pscustomobject]@{
          app = $mapping.app
          active = (Get-StrattonNestedValue -InputObject $revision -Path @('properties', 'active'))
          healthState = [string] (Get-StrattonNestedValue -InputObject $revision -Path @('properties', 'healthState'))
          runningState = [string] (Get-StrattonNestedValue -InputObject $revision -Path @('properties', 'runningState'))
        }
      }
    }
  )
  $webName = [string] (Get-StrattonRequiredValue -InputObject $outputs -Name 'webAppName')
  $bffName = [string] (Get-StrattonRequiredValue -InputObject $outputs -Name 'bffAppName')
  $phase5Name = [string] (Get-StrattonRequiredValue -InputObject $outputs -Name 'phase5AppName')
  $webApp = @($apps | Where-Object name -ceq $webName)[0]
  $bffApp = @($apps | Where-Object name -ceq $bffName)[0]
  $phase5App = @($apps | Where-Object name -ceq $phase5Name)[0]

  $webHealthUri = "https://$(Get-StrattonRequiredValue -InputObject $outputs -Name 'webAppFqdn')/healthz"
  $webHealth = & $HttpInvoker $webHealthUri
  $internal = if ($InternalInvoker) {
    & $InternalInvoker $outputs 'stratton-demo-rg' $subscriptionId
  }
  else {
    $expectedRoutes = @(Get-StrattonExpectedVerificationRoutes -Outputs $outputs)
    Invoke-StrattonVerificationJob `
      -Outputs $outputs `
      -Image (Get-StrattonPinnedVerificationImage -State $state -Outputs $outputs) `
      -ExpectedRoutes $expectedRoutes `
      -ResourceGroupName 'stratton-demo-rg' `
      -SubscriptionId $subscriptionId
  }
  $sqlServer = & $AzInvoker @(
    'resource', 'show',
    '--ids', ([string] (Get-StrattonRequiredValue -InputObject $outputs -Name 'sqlServerResourceId')),
    '--subscription', $subscriptionId
  )

  $deployedRedirectUri = "https://$(Get-StrattonRequiredValue -InputObject $outputs -Name 'webAppFqdn')"
  $redirectAlreadyReconciled = $false
  $entraResult = $null
  foreach ($redirectCandidate in @(
      Get-StrattonAcceptedRedirectUriSets `
      -Phase ([string] $state.phase) `
      -DeployedRedirectUri $deployedRedirectUri
    )) {
    $expectedRedirectUris = @($redirectCandidate.uris)
    $candidateResult = if ($EntraInvoker) {
      & $EntraInvoker $outputs $expectedRedirectUris
    }
    else {
      $entraParameters = @{
        TenantId = $script:ApprovedTenantId
        WebRedirectUri = $expectedRedirectUris[0]
        BffManagedIdentityPrincipalId = [string] (Get-StrattonRequiredValue -InputObject $outputs -Name 'bffIdentityPrincipalId')
        BffManagedIdentityClientId = [string] (Get-StrattonRequiredValue -InputObject $outputs -Name 'bffIdentityClientId')
        WhatIf = $true
      }
      if ($expectedRedirectUris.Count -gt 1) {
        $entraParameters.AdditionalWebRedirectUri = $expectedRedirectUris[1]
      }
      Invoke-StrattonEntraReconciliation @entraParameters
    }
    if (@($candidateResult.plan).Count -eq 0) {
      $entraResult = $candidateResult
      $redirectAlreadyReconciled = ($redirectCandidate.alreadyReconciled -eq $true)
      break
    }
  }
  if ($null -eq $entraResult) {
    throw 'ENTRA_RECONCILIATION_DRIFT'
  }

  $assignments = @(& $AzInvoker @(
      'role', 'assignment', 'list',
      '--subscription', $subscriptionId,
      '--all',
      '--include-inherited'
    ))
  $roleChecks = Get-StrattonRoleAssignmentChecks -Outputs $outputs -Assignments $assignments
  $routeBindings = Get-StrattonRouteVerification `
    -Outputs $outputs `
    -Phase5Bindings @($internal.routeBindings) `
    -SubscriptionId $subscriptionId `
    -AzInvoker $AzInvoker
  $playwright = if ($PlaywrightInvoker) {
    & $PlaywrightInvoker `
      $deployedRedirectUri `
      $PlaywrightStorageStatePath `
      $PlaywrightSessionStorageStatePath
  }
  else {
    Invoke-StrattonAuthenticatedPlaywright `
      -BaseUrl $deployedRedirectUri `
      -StorageStatePath $PlaywrightStorageStatePath `
      -SessionStorageStatePath $PlaywrightSessionStorageStatePath
  }

  $evidence = [pscustomobject]@{
    resourceHealth = $resourceHealth
    revisions = $revisions
    ingress = [pscustomobject]@{
      webExternal = (Get-StrattonNestedValue -InputObject $webApp -Path @('properties', 'configuration', 'ingress', 'external'))
      bffExternal = (Get-StrattonNestedValue -InputObject $bffApp -Path @('properties', 'configuration', 'ingress', 'external'))
      phase5External = (Get-StrattonNestedValue -InputObject $phase5App -Path @('properties', 'configuration', 'ingress', 'external'))
    }
    health = [pscustomobject]@{
      web = ($webHealth.StatusCode -eq 200)
      bff = ($internal.bffHealth -eq $true)
      phase5 = ($internal.phase5Health -eq $true)
    }
    entra = [pscustomobject]@{
      applications = $true
      consent = $true
      federatedCredential = $true
      completionRole = $true
    }
    sql = [pscustomobject]@{
      privateDns = (
        $internal.sqlPrivateDns -eq $true -and
        (Get-StrattonNestedValue -InputObject $sqlServer -Path @('properties', 'publicNetworkAccess')) -ceq 'Disabled'
      )
      tokenAuthenticatedQuery = ($internal.sqlTokenAuthenticatedQuery -eq $true)
    }
    roleAssignments = $roleChecks
    routeBindings = $routeBindings
    playwright = $playwright
  }
  $result = ConvertTo-StrattonVerificationResult -Evidence $evidence

  if ($state.phase -eq 'APPLICATIONS_DEPLOYED') {
    if (-not $redirectAlreadyReconciled) {
      if ($RedirectReconciler) {
        & $RedirectReconciler $outputs $deployedRedirectUri | Out-Null
      }
      else {
        Invoke-StrattonEntraReconciliation `
          -TenantId $script:ApprovedTenantId `
          -WebRedirectUri $deployedRedirectUri `
          -BffManagedIdentityPrincipalId ([string] (Get-StrattonRequiredValue -InputObject $outputs -Name 'bffIdentityPrincipalId')) `
          -BffManagedIdentityClientId ([string] (Get-StrattonRequiredValue -InputObject $outputs -Name 'bffIdentityClientId')) | Out-Null
      }
    }
    $state = Save-StrattonDeploymentState `
      -State $state `
      -NextPhase 'ENTRA_REDIRECT_RECONCILED' `
      -Updates @{ provisionalRedirectRetained = $false }
  }

  if ($state.phase -eq 'ENTRA_REDIRECT_RECONCILED') {
    Write-DeploymentArtifact -Path $script:VerificationArtifactPath -InputObject $result
    $state = Save-StrattonDeploymentState -State $state -NextPhase 'VERIFIED'
  }
  elseif ($state.phase -eq 'VERIFIED') {
    Write-DeploymentArtifact -Path $script:VerificationArtifactPath -InputObject $result
  }
  return $result
}

if ($LoadOnly) {
  return
}

if ([string]::IsNullOrWhiteSpace($PlaywrightStorageStatePath)) {
  throw 'PLAYWRIGHT_AUTH_STORAGE_STATE_REQUIRED'
}
if ([string]::IsNullOrWhiteSpace($PlaywrightSessionStorageStatePath)) {
  throw 'PLAYWRIGHT_AUTH_SESSION_STORAGE_STATE_REQUIRED'
}

Invoke-StrattonDeploymentVerification `
  -PlaywrightStorageStatePath $PlaywrightStorageStatePath `
  -PlaywrightSessionStorageStatePath $PlaywrightSessionStorageStatePath
