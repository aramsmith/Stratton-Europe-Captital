[CmdletBinding()]
param(
  [ValidateSet('Preflight', 'FoundationWhatIf', 'FoundationDeploy', 'ApplicationWhatIf', 'ApplicationDeploy')]
  [string] $Phase,

  [switch] $ApproveProviderRegistration,

  [switch] $ApproveFoundationWhatIf,

  [switch] $ApproveApplicationWhatIf,

  [switch] $LoadOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:DemoPlatformRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:DeploymentArtifactRoot = Join-Path $script:DemoPlatformRoot 'artifacts\deployment'
$script:DeploymentStatePath = Join-Path $script:DeploymentArtifactRoot 'deployment-state.json'
$script:PreflightArtifactPath = Join-Path $script:DeploymentArtifactRoot 'preflight.json'
$script:ProviderVerificationArtifactPath = Join-Path $script:DeploymentArtifactRoot 'provider-registration-preflight.json'
$script:WhatIfArtifactPath = Join-Path $script:DeploymentArtifactRoot 'what-if.json'
$script:OutputsArtifactPath = Join-Path $script:DeploymentArtifactRoot 'outputs.json'
$script:StandaloneTemplatePath = Join-Path $script:DemoPlatformRoot 'infra\standalone\main.bicep'
$script:ApprovedSubscriptionId = '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
$script:ApprovedTenantId = '27140306-eea5-4e7f-91e9-4c9e86864b3a'
$script:ApprovedUser = 'aram@azurelab.nl'
$script:Location = 'swedencentral'
$script:OpenAiLocation = 'westeurope'
$script:ResourceGroupName = 'stratton-demo-rg'
$script:ProvisionalRedirectUri = 'http://localhost:4173'

Import-Module (Join-Path $PSScriptRoot 'Stratton.Deployment.psm1') -Force

function Get-StrattonDeploymentPhases {
  [CmdletBinding()]
  param()

  return @(
    'PREFLIGHT_COMPLETE',
    'PROVIDER_REGISTRATION_APPROVED',
    'PROVIDERS_REGISTERED',
    'FOUNDATION_WHAT_IF_READY',
    'PLATFORM_FOUNDATION_DEPLOYED',
    'ENTRA_FOUNDATION_COMPLETE',
    'IMAGES_BUILT',
    'DATA_PLANE_READY',
    'APPLICATION_WHAT_IF_READY',
    'APPLICATIONS_DEPLOYED',
    'ENTRA_REDIRECT_RECONCILED',
    'VERIFIED'
  )
}

function Get-StrattonPropertyValue {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $InputObject,

    [Parameter(Mandatory)]
    [string] $Name
  )

  if ($null -eq $InputObject) {
    return $null
  }

  if ($InputObject -is [System.Collections.IDictionary]) {
    if ($InputObject.Contains($Name)) {
      return $InputObject[$Name]
    }
    return $null
  }

  $property = $InputObject.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }
  return $property.Value
}

function Test-StrattonPropertyExists {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $InputObject,

    [Parameter(Mandatory)]
    [string] $Name
  )

  if ($null -eq $InputObject) {
    return $false
  }

  if ($InputObject -is [System.Collections.IDictionary]) {
    return $InputObject.Contains($Name)
  }

  return $null -ne $InputObject.PSObject.Properties[$Name]
}

function Copy-StrattonObject {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $InputObject
  )

  $copy = [ordered]@{}
  if ($null -eq $InputObject) {
    return $copy
  }

  if ($InputObject -is [System.Collections.IDictionary]) {
    foreach ($key in $InputObject.Keys) {
      $copy[[string] $key] = $InputObject[$key]
    }
    return $copy
  }

  foreach ($property in $InputObject.PSObject.Properties) {
    $copy[$property.Name] = $property.Value
  }
  return $copy
}

function Assert-DeploymentTransition {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $State,

    [Parameter(Mandatory)]
    [string] $NextPhase
  )

  $currentPhase = [string] (Get-StrattonPropertyValue -InputObject $State -Name 'phase')
  if ($currentPhase -eq $NextPhase) {
    return
  }

  $allowedTransitions = @{
    PREFLIGHT_COMPLETE = @('PROVIDER_REGISTRATION_APPROVED', 'PROVIDERS_REGISTERED')
    PROVIDER_REGISTRATION_APPROVED = @('PROVIDERS_REGISTERED')
    PROVIDERS_REGISTERED = @('FOUNDATION_WHAT_IF_READY')
    FOUNDATION_WHAT_IF_READY = @('PLATFORM_FOUNDATION_DEPLOYED')
    PLATFORM_FOUNDATION_DEPLOYED = @('ENTRA_FOUNDATION_COMPLETE')
    ENTRA_FOUNDATION_COMPLETE = @('IMAGES_BUILT')
    IMAGES_BUILT = @('DATA_PLANE_READY')
    DATA_PLANE_READY = @('APPLICATION_WHAT_IF_READY')
    APPLICATION_WHAT_IF_READY = @('APPLICATIONS_DEPLOYED')
    APPLICATIONS_DEPLOYED = @('ENTRA_REDIRECT_RECONCILED')
    ENTRA_REDIRECT_RECONCILED = @('VERIFIED')
  }

  if (-not $allowedTransitions.ContainsKey($currentPhase) -or $allowedTransitions[$currentPhase] -notcontains $NextPhase) {
    throw "DEPLOYMENT_TRANSITION_INVALID:${currentPhase}:${NextPhase}"
  }

  if (
    $NextPhase -eq 'PLATFORM_FOUNDATION_DEPLOYED' -and
    (Get-StrattonPropertyValue -InputObject $State -Name 'foundationWhatIfApproved') -ne $true
  ) {
    throw 'WHAT_IF_APPROVAL_REQUIRED'
  }

  if (
    $NextPhase -eq 'APPLICATIONS_DEPLOYED' -and
    (Get-StrattonPropertyValue -InputObject $State -Name 'applicationWhatIfApproved') -ne $true
  ) {
    throw 'WHAT_IF_APPROVAL_REQUIRED'
  }
}

function Assert-DeploymentStateBinding {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $State,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $TenantId,

    [Parameter(Mandatory)]
    [string] $ExpectedUser,

    [Parameter(Mandatory)]
    [string] $CommitSha,

    [Parameter(Mandatory)]
    [string] $ParameterHash,

    [string] $Location = $script:Location,

    [string] $OpenAiLocation = $script:OpenAiLocation
  )

  $matches = (
    (Get-StrattonPropertyValue -InputObject $State -Name 'subscriptionId') -ceq $SubscriptionId -and
    (Get-StrattonPropertyValue -InputObject $State -Name 'tenantId') -ceq $TenantId -and
    (Get-StrattonPropertyValue -InputObject $State -Name 'expectedUser') -ceq $ExpectedUser -and
    (Get-StrattonPropertyValue -InputObject $State -Name 'commitSha') -ceq $CommitSha -and
    (Get-StrattonPropertyValue -InputObject $State -Name 'parameterHash') -ceq $ParameterHash -and
    (Get-StrattonPropertyValue -InputObject $State -Name 'location') -ceq $Location -and
    (Get-StrattonPropertyValue -InputObject $State -Name 'openAiLocation') -ceq $OpenAiLocation
  )
  if (-not $matches) {
    throw 'DEPLOYMENT_STATE_BINDING_MISMATCH'
  }
}

function Assert-StrattonDeploymentAzContext {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $TenantId,

    [Parameter(Mandatory)]
    [string] $ExpectedUser,

    [Parameter(Mandatory)]
    [scriptblock] $AzInvoker
  )

  $account = & $AzInvoker @('account', 'show')
  $accountUser = Get-StrattonPropertyValue -InputObject $account -Name 'user'
  if (
    (Get-StrattonPropertyValue -InputObject $account -Name 'id') -cne $SubscriptionId -or
    (Get-StrattonPropertyValue -InputObject $account -Name 'tenantId') -cne $TenantId -or
    (Get-StrattonPropertyValue -InputObject $accountUser -Name 'name') -ine $ExpectedUser
  ) {
    throw 'AZURE_CONTEXT_MISMATCH'
  }
}

function Get-StrattonObjectHash {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $InputObject
  )

  $json = $InputObject | ConvertTo-Json -Depth 100 -Compress
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($json)
    return [Convert]::ToHexString($hasher.ComputeHash($bytes)).ToLowerInvariant()
  }
  finally {
    $hasher.Dispose()
  }
}

function Assert-StrattonArtifactHash {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Artifact,

    [Parameter(Mandatory)]
    [string] $ExpectedHash,

    [Parameter(Mandatory)]
    [string] $Kind
  )

  if ((Get-StrattonObjectHash -InputObject $Artifact) -cne $ExpectedHash) {
    throw "$($Kind.ToUpperInvariant())_ARTIFACT_DRIFT"
  }
}

function Get-StrattonFileHash {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Path
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "DEPLOYMENT_FILE_MISSING:$Path"
  }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-StrattonFileHash {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Path,

    [Parameter(Mandatory)]
    [string] $ExpectedHash,

    [Parameter(Mandatory)]
    [string] $Kind
  )

  if ((Get-StrattonFileHash -Path $Path) -cne $ExpectedHash) {
    throw "$($Kind.ToUpperInvariant())_FILE_DRIFT"
  }
}

function Assert-StrattonCommittedWorktree {
  [CmdletBinding()]
  param(
    [string] $RepositoryRoot = (Resolve-Path (Join-Path $script:DemoPlatformRoot '..')).Path,

    [scriptblock] $GitInvoker
  )

  if ($GitInvoker) {
    $result = & $GitInvoker $RepositoryRoot
    $exitCode = [int] $result.exitCode
    $status = @($result.lines)
  }
  else {
    $status = @(& git -C $RepositoryRoot status --porcelain=v1 --untracked-files=all 2>$null)
    $exitCode = $LASTEXITCODE
  }
  if ($exitCode -ne 0) {
    throw 'GIT_WORKTREE_STATUS_UNAVAILABLE'
  }

  foreach ($entry in $status) {
    if ([string]::IsNullOrWhiteSpace([string] $entry)) {
      continue
    }
    if ($entry.StartsWith('?? ')) {
      $path = $entry.Substring(3).Replace('\', '/')
      if (
        $path.StartsWith('demo-platform/artifacts/deployment/', [System.StringComparison]::Ordinal) -or
        $path -ceq 'demo-platform/infra/standalone/main.json'
      ) {
        continue
      }
    }
    throw 'GIT_WORKTREE_NOT_CLEAN'
  }
}

function Get-StrattonFoundationResumeSteps {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Phase
  )

  $steps = @(
    'PLATFORM_FOUNDATION_DEPLOYED',
    'ENTRA_FOUNDATION_COMPLETE',
    'IMAGES_BUILT',
    'DATA_PLANE_READY'
  )
  if ($Phase -eq 'FOUNDATION_WHAT_IF_READY') {
    return $steps
  }
  $index = [array]::IndexOf($steps, $Phase)
  if ($index -lt 0) {
    throw "FOUNDATION_RESUME_PHASE_INVALID:$Phase"
  }
  if ($index -ge ($steps.Count - 1)) {
    return @()
  }
  return @($steps[($index + 1)..($steps.Count - 1)])
}

function Get-StrattonApplicationResumeSteps {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Phase
  )

  switch ($Phase) {
    'APPLICATION_WHAT_IF_READY' { return @('APPLICATIONS_DEPLOYED', 'REGISTER_DEPLOYED_REDIRECT') }
    'APPLICATIONS_DEPLOYED' { return @('REGISTER_DEPLOYED_REDIRECT') }
    'ENTRA_REDIRECT_RECONCILED' { return @() }
    'VERIFIED' { return @() }
    default { throw "APPLICATION_RESUME_PHASE_INVALID:$Phase" }
  }
}

function Get-StrattonCommitSha {
  [CmdletBinding()]
  param(
    [string] $RepositoryRoot = (Resolve-Path (Join-Path $script:DemoPlatformRoot '..')).Path
  )

  $commitSha = (& git -C $RepositoryRoot rev-parse HEAD 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or $commitSha -notmatch '^[0-9a-f]{40}$') {
    throw 'GIT_COMMIT_SHA_UNAVAILABLE'
  }
  return $commitSha
}

function New-StrattonFoundationParameterValues {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $TenantId
  )

  return [ordered]@{
    subscriptionId = $SubscriptionId
    tenantId = $TenantId
    location = $script:Location
    resourceGroupName = 'stratton-demo-rg'
    environmentName = 'dev'
    deployApplications = $false
    openAiLocation = $script:OpenAiLocation
    lunaModelName = 'gpt-5.6-luna'
    lunaModelVersion = '2026-07-09'
    lunaModelCapacity = 1
    terraModelName = 'gpt-5.6-terra'
    terraModelVersion = '2026-07-09'
    terraModelCapacity = 1
    solModelName = 'gpt-5.6-sol'
    solModelVersion = '2026-07-09'
    solModelCapacity = 1
    webDelegatedScope = 'api://00000000-0000-0000-0000-000000000002/access_as_user'
    bffRequiredDelegatedScope = 'access_as_user'
    phase5ApplicationId = '00000000-0000-0000-0000-000000000003'
    phase5DelegatedScope = 'api://00000000-0000-0000-0000-000000000003/access_as_user'
    webImageRepository = 'stratton/demo-web'
    webImageDigest = "sha256:$('1' * 64)"
    bffImageRepository = 'stratton/demo-bff'
    bffImageDigest = "sha256:$('2' * 64)"
    phase5ImageRepository = 'stratton/phase5-api'
    phase5ImageDigest = "sha256:$('3' * 64)"
    webContainerPort = 8080
    bffContainerPort = 3001
    webEntraClientId = '00000000-0000-0000-0000-000000000001'
    bffEntraClientId = '00000000-0000-0000-0000-000000000002'
    namePrefix = 'stratton-demo'
    tags = [ordered]@{
      environment = 'dev'
      workload = 'stratton-demo'
      case = 'project-danube'
      owner = 'aram@azurelab.nl'
      managedBy = 'bicep'
      'hackathon-team' = 'stratton-demo'
    }
  }
}

function Assert-StrattonGuid {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $Value,

    [Parameter(Mandatory)]
    [string] $Name
  )

  $parsed = [Guid]::Empty
  if (-not [Guid]::TryParse($Value, [ref] $parsed) -or $parsed -eq [Guid]::Empty) {
    throw "INVALID_ENTRA_IDENTIFIER:$Name"
  }
}

function New-StrattonApplicationParameterValues {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $FoundationParameters,

    [Parameter(Mandatory)]
    [object] $EntraArtifact,

    [Parameter(Mandatory)]
    [object] $ImagesArtifact
  )

  foreach ($name in @('webClientId', 'bffClientId', 'phase5ClientId')) {
    Assert-StrattonGuid -Value ([string] (Get-StrattonPropertyValue -InputObject $EntraArtifact -Name $name)) -Name $name
  }

  $images = @($ImagesArtifact.images)
  $requiredRepositories = @('stratton/demo-web', 'stratton/demo-bff', 'stratton/phase5-api')
  $resolvedImages = @{}
  foreach ($repository in $requiredRepositories) {
    $matches = @($images | Where-Object repository -ceq $repository)
    if ($matches.Count -ne 1 -or -not (Test-ImageDigest -Digest ([string] $matches[0].digest))) {
      throw "IMAGE_ARTIFACT_INVALID:$repository"
    }
    $resolvedImages[$repository] = $matches[0]
  }

  $values = Copy-StrattonObject -InputObject $FoundationParameters
  $values.deployApplications = $true
  $values.webEntraClientId = [string] $EntraArtifact.webClientId
  $values.bffEntraClientId = [string] $EntraArtifact.bffClientId
  $values.phase5ApplicationId = [string] $EntraArtifact.phase5ClientId
  $values.webDelegatedScope = "api://$($EntraArtifact.bffClientId)/access_as_user"
  $values.phase5DelegatedScope = "api://$($EntraArtifact.phase5ClientId)/access_as_user"
  $values.webImageDigest = [string] $resolvedImages['stratton/demo-web'].digest
  $values.bffImageDigest = [string] $resolvedImages['stratton/demo-bff'].digest
  $values.phase5ImageDigest = [string] $resolvedImages['stratton/phase5-api'].digest
  return $values
}

function Assert-StrattonParameterValuesSafe {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Values
  )

  $prohibitedNames = '(?i)^(password|clientSecret|apiKey|connectionString|accessToken|refreshToken|authorization)$'
  foreach ($property in (Copy-StrattonObject -InputObject $Values).GetEnumerator()) {
    if ([string] $property.Key -match $prohibitedNames) {
      throw "SECRET_PARAMETER_PROHIBITED:$($property.Key)"
    }
  }
}

function ConvertTo-StrattonParameterDocument {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Values
  )

  Assert-StrattonParameterValuesSafe -Values $Values
  $parameters = [ordered]@{}
  foreach ($property in (Copy-StrattonObject -InputObject $Values).GetEnumerator()) {
    $parameters[[string] $property.Key] = [ordered]@{
      value = $property.Value
    }
  }

  return [ordered]@{
    '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion = '1.0.0.0'
    parameters = $parameters
  }
}

function New-StrattonDeploymentName {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [ValidateSet('foundation', 'application')]
    [string] $Stage,

    [Parameter(Mandatory)]
    [string] $CommitSha,

    [datetime] $UtcNow = [datetime]::UtcNow
  )

  if ($CommitSha -notmatch '^[0-9a-fA-F]{8,40}$') {
    throw 'INVALID_COMMIT_SHA'
  }
  return "stratton-$Stage-$($UtcNow.ToUniversalTime().ToString('yyyyMMdd'))-$($CommitSha.Substring(0, 8).ToLowerInvariant())"
}

function New-StrattonSubscriptionWhatIfArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $DeploymentName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $Location,

    [Parameter(Mandatory)]
    [string] $TemplateFile,

    [Parameter(Mandatory)]
    [string] $ParametersFile
  )

  return @(
    'deployment', 'sub', 'what-if',
    '--name', $DeploymentName,
    '--subscription', $SubscriptionId,
    '--location', $Location,
    '--template-file', $TemplateFile,
    '--parameters', "@$ParametersFile",
    '--result-format', 'FullResourcePayloads',
    '--no-pretty-print'
  )
}

function New-StrattonSubscriptionDeploymentArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $DeploymentName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $Location,

    [Parameter(Mandatory)]
    [string] $TemplateFile,

    [Parameter(Mandatory)]
    [string] $ParametersFile
  )

  return @(
    'deployment', 'sub', 'create',
    '--name', $DeploymentName,
    '--subscription', $SubscriptionId,
    '--location', $Location,
    '--template-file', $TemplateFile,
    '--parameters', "@$ParametersFile"
  )
}

function Get-StrattonWhatIfChanges {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $WhatIfResult
  )

  $status = Get-StrattonPropertyValue -InputObject $WhatIfResult -Name 'status'
  $errorResult = Get-StrattonPropertyValue -InputObject $WhatIfResult -Name 'error'
  if ($status -cne 'Succeeded' -or $null -ne $errorResult) {
    throw 'WHAT_IF_NOT_SUCCEEDED'
  }

  $properties = Get-StrattonPropertyValue -InputObject $WhatIfResult -Name 'properties'
  if (Test-StrattonPropertyExists -InputObject $properties -Name 'changes') {
    return @(Get-StrattonPropertyValue -InputObject $properties -Name 'changes')
  }
  if (Test-StrattonPropertyExists -InputObject $WhatIfResult -Name 'changes') {
    return @(Get-StrattonPropertyValue -InputObject $WhatIfResult -Name 'changes')
  }

  throw 'WHAT_IF_SHAPE_UNRECOGNIZED'
}

function Assert-StrattonWhatIfSafe {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $WhatIfResult
  )

  $diagnostics = Get-StrattonPropertyValue -InputObject $WhatIfResult -Name 'diagnostics'
  if ($null -eq $diagnostics) {
    $whatIfProperties = Get-StrattonPropertyValue -InputObject $WhatIfResult -Name 'properties'
    $diagnostics = Get-StrattonPropertyValue -InputObject $whatIfProperties -Name 'diagnostics'
  }
  foreach ($diagnostic in @($diagnostics)) {
    $diagnosticCode = [string] (
      Get-StrattonPropertyValue -InputObject $diagnostic -Name 'code'
    )
    if ($diagnosticCode -ieq 'NestedDeploymentShortCircuited') {
      throw "WHAT_IF_INCOMPLETE:$diagnosticCode"
    }
  }

  foreach ($change in @(Get-StrattonWhatIfChanges -WhatIfResult $WhatIfResult)) {
    if ((Get-StrattonPropertyValue -InputObject $change -Name 'changeType') -ceq 'Delete') {
      throw 'WHAT_IF_DELETE_PROHIBITED'
    }
  }
}

function Get-StrattonUnregisteredProviderNamespaces {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Preflight
  )

  $reported = @(
    @($Preflight.blockingFindings) |
      Where-Object { $_ -like 'AZURE_PROVIDER_UNREGISTERED:*' } |
      ForEach-Object { $_.Substring('AZURE_PROVIDER_UNREGISTERED:'.Length) }
  )
  return @(
    foreach ($namespace in $reported) {
      $provider = @($Preflight.resourceProviders | Where-Object namespace -ieq $namespace)
      if ($provider.Count -ne 1) {
        throw "PREFLIGHT_PROVIDER_EVIDENCE_INVALID:$namespace"
      }
      if ($provider[0].registrationState -ne 'Registered') {
        $namespace
      }
    }
  )
}

function Invoke-StrattonProviderRegistration {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Preflight,

    [switch] $ApproveProviderRegistration,

    [AllowEmptyCollection()]
    [string[]] $ApprovedNamespaces,

    [string] $SubscriptionId = $script:ApprovedSubscriptionId,

    [ValidateRange(0, 300)]
    [int] $PollIntervalSeconds = 5,

    [ValidateRange(1, 120)]
    [int] $MaxPollAttempts = 60,

    [scriptblock] $AzInvoker
  )

  $namespaces = @(Get-StrattonUnregisteredProviderNamespaces -Preflight $Preflight)
  if ($PSBoundParameters.ContainsKey('ApprovedNamespaces')) {
    $approved = @($ApprovedNamespaces)
    if (
      $approved.Count -ne $namespaces.Count -or
      $null -ne (Compare-Object -ReferenceObject $namespaces -DifferenceObject $approved -CaseSensitive)
    ) {
      throw 'PROVIDER_APPROVAL_SCOPE_DRIFT'
    }
    $namespaces = $approved
  }
  if ($namespaces.Count -eq 0) {
    return @()
  }
  if (-not $ApproveProviderRegistration) {
    throw 'PROVIDER_REGISTRATION_APPROVAL_REQUIRED'
  }
  if (-not $AzInvoker) {
    $AzInvoker = {
      param([string[]] $Arguments)
      Invoke-AzJson -Arguments $Arguments
    }
  }

  foreach ($namespace in $namespaces) {
    & $AzInvoker @(
      'provider', 'register',
      '--namespace', $namespace,
      '--subscription', $SubscriptionId
    ) | Out-Null
    $registered = $false
    for ($attempt = 1; $attempt -le $MaxPollAttempts; $attempt++) {
      $provider = & $AzInvoker @(
        'provider', 'show',
        '--namespace', $namespace,
        '--subscription', $SubscriptionId
      )
      if ($provider.registrationState -ceq 'Registered') {
        $registered = $true
        break
      }
      if ($attempt -lt $MaxPollAttempts -and $PollIntervalSeconds -gt 0) {
        Start-Sleep -Seconds $PollIntervalSeconds
      }
    }
    if (-not $registered) {
      throw "PROVIDER_REGISTRATION_INDETERMINATE:$namespace"
    }
  }
  return $namespaces
}

function Read-StrattonJsonArtifact {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Path
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "DEPLOYMENT_ARTIFACT_MISSING:$Path"
  }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -Depth 100
}

function Set-StrattonArtifactSection {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Path,

    [Parameter(Mandatory)]
    [string] $Name,

    [Parameter(Mandatory)]
    [object] $Value
  )

  $artifact = [ordered]@{}
  if (Test-Path -LiteralPath $Path -PathType Leaf) {
    $artifact = Copy-StrattonObject -InputObject (Read-StrattonJsonArtifact -Path $Path)
  }
  $artifact[$Name] = $Value
  Write-DeploymentArtifact -Path $Path -InputObject $artifact
  return $artifact
}

function Save-StrattonDeploymentState {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $State,

    [Parameter(Mandatory)]
    [string] $NextPhase,

    [hashtable] $Updates = @{},

    [string] $Path = $script:DeploymentStatePath
  )

  if ((Get-StrattonPropertyValue -InputObject $State -Name 'phase') -ne $NextPhase) {
    Assert-DeploymentTransition -State $State -NextPhase $NextPhase
  }
  $nextState = Copy-StrattonObject -InputObject $State
  $nextState.phase = $NextPhase
  foreach ($key in $Updates.Keys) {
    $nextState[$key] = $Updates[$key]
  }
  $nextState.updatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  Write-DeploymentArtifact -Path $Path -InputObject $nextState
  return [pscustomobject] $nextState
}

function Get-StrattonDeploymentState {
  [CmdletBinding()]
  param(
    [string] $Path = $script:DeploymentStatePath
  )

  return Read-StrattonJsonArtifact -Path $Path
}

function ConvertFrom-StrattonArmOutputs {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Deployment
  )

  $properties = Get-StrattonPropertyValue -InputObject $Deployment -Name 'properties'
  $outputs = Get-StrattonPropertyValue -InputObject $properties -Name 'outputs'
  if ($null -eq $outputs) {
    throw 'DEPLOYMENT_OUTPUTS_MISSING'
  }
  $values = [ordered]@{}
  foreach ($output in $outputs.PSObject.Properties) {
    $values[$output.Name] = Get-StrattonPropertyValue -InputObject $output.Value -Name 'value'
  }
  return $values
}

function Get-StrattonRequiredValue {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $InputObject,

    [Parameter(Mandatory)]
    [string] $Name
  )

  $value = Get-StrattonPropertyValue -InputObject $InputObject -Name $Name
  if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string] $value)) {
    throw "DEPLOYMENT_VALUE_MISSING:$Name"
  }
  return $value
}

function Invoke-StrattonScriptFile {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Path,

    [hashtable] $Parameters = @{},

    [scriptblock] $ScriptInvoker
  )

  if ($ScriptInvoker) {
    return & $ScriptInvoker $Path $Parameters
  }
  return & $Path @Parameters
}

function Invoke-StrattonStandalonePhase {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [ValidateSet('Preflight', 'FoundationWhatIf', 'FoundationDeploy', 'ApplicationWhatIf', 'ApplicationDeploy')]
    [string] $Phase,

    [switch] $ApproveProviderRegistration,

    [switch] $ApproveFoundationWhatIf,

    [switch] $ApproveApplicationWhatIf,

    [string] $SubscriptionId = $script:ApprovedSubscriptionId,

    [string] $TenantId = $script:ApprovedTenantId,

    [string] $ExpectedUser = $script:ApprovedUser,

    [string] $Location = $script:Location,

    [string] $OpenAiLocation = $script:OpenAiLocation,

    [scriptblock] $AzInvoker,

    [scriptblock] $ScriptInvoker
  )

  if (-not $AzInvoker) {
    $AzInvoker = {
      param([string[]] $Arguments)
      Invoke-AzJson -Arguments $Arguments
    }
  }
  Assert-StrattonCommittedWorktree
  Assert-StrattonDeploymentAzContext `
    -SubscriptionId $SubscriptionId `
    -TenantId $TenantId `
    -ExpectedUser $ExpectedUser `
    -AzInvoker $AzInvoker

  $foundationValues = New-StrattonFoundationParameterValues -SubscriptionId $SubscriptionId -TenantId $TenantId
  $parameterHash = Get-StrattonObjectHash -InputObject $foundationValues
  $commitSha = Get-StrattonCommitSha

  if ($Phase -eq 'Preflight') {
    if (Test-Path -LiteralPath $script:DeploymentStatePath -PathType Leaf) {
      $existingState = Get-StrattonDeploymentState
      Assert-DeploymentStateBinding `
        -State $existingState `
        -SubscriptionId $SubscriptionId `
        -TenantId $TenantId `
        -ExpectedUser $ExpectedUser `
        -CommitSha $commitSha `
        -ParameterHash $parameterHash `
        -Location $Location `
        -OpenAiLocation $OpenAiLocation
      if ($existingState.phase -ne 'PREFLIGHT_COMPLETE') {
        throw 'DEPLOYMENT_ALREADY_ADVANCED'
      }
    }

    Invoke-StrattonScriptFile `
      -Path (Join-Path $PSScriptRoot 'Test-StrattonAzurePreflight.ps1') `
      -Parameters @{
        SubscriptionId = $SubscriptionId
        TenantId = $TenantId
        ExpectedUser = $ExpectedUser
        Location = $Location
        OpenAiLocation = $OpenAiLocation
        OutFile = $script:PreflightArtifactPath
        AllowProviderRegistrationPending = $true
      } `
      -ScriptInvoker $ScriptInvoker | Out-Null
    $preflight = Read-StrattonJsonArtifact -Path $script:PreflightArtifactPath
    $nonProviderBlockers = @($preflight.blockingFindings | Where-Object { $_ -notlike 'AZURE_PROVIDER_UNREGISTERED:*' })
    if ($nonProviderBlockers.Count -gt 0) {
      throw "AZURE_PREFLIGHT_BLOCKED:$($nonProviderBlockers -join ',')"
    }

    $state = [ordered]@{
      phase = 'PREFLIGHT_COMPLETE'
      subscriptionId = $SubscriptionId
      tenantId = $TenantId
      expectedUser = $ExpectedUser
      location = $Location
      openAiLocation = $OpenAiLocation
      commitSha = $commitSha
      parameterHash = $parameterHash
      preflightArtifactHash = (Get-StrattonObjectHash -InputObject $preflight)
      pendingProviderNamespaces = @(Get-StrattonUnregisteredProviderNamespaces -Preflight $preflight)
      providerRegistrationApproved = $false
      foundationWhatIfApproved = $false
      applicationWhatIfApproved = $false
      createdAtUtc = (Get-Date).ToUniversalTime().ToString('o')
      updatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    }
    Write-DeploymentArtifact -Path $script:DeploymentStatePath -InputObject $state
    return [pscustomobject] $state
  }

  $state = Get-StrattonDeploymentState
  Assert-DeploymentStateBinding `
    -State $state `
    -SubscriptionId $SubscriptionId `
    -TenantId $TenantId `
    -ExpectedUser $ExpectedUser `
    -CommitSha $commitSha `
    -ParameterHash $parameterHash `
    -Location $Location `
    -OpenAiLocation $OpenAiLocation

  if ($Phase -eq 'FoundationWhatIf') {
    if ($state.phase -eq 'PREFLIGHT_COMPLETE') {
      $preflight = Read-StrattonJsonArtifact -Path $script:PreflightArtifactPath
      Assert-StrattonArtifactHash `
        -Artifact $preflight `
        -ExpectedHash ([string] $state.preflightArtifactHash) `
        -Kind 'PREFLIGHT'
      $pendingProviders = @(Get-StrattonUnregisteredProviderNamespaces -Preflight $preflight)
      if ($pendingProviders.Count -gt 0) {
        if (-not $ApproveProviderRegistration) {
          throw 'PROVIDER_REGISTRATION_APPROVAL_REQUIRED'
        }
        $state = Save-StrattonDeploymentState `
          -State $state `
          -NextPhase 'PROVIDER_REGISTRATION_APPROVED' `
          -Updates @{
            providerRegistrationApproved = $true
            approvedProviderNamespaces = $pendingProviders
          }
      }
      else {
        $state = Save-StrattonDeploymentState -State $state -NextPhase 'PROVIDERS_REGISTERED'
      }
    }

    if ($state.phase -eq 'PROVIDER_REGISTRATION_APPROVED') {
      $preflight = Read-StrattonJsonArtifact -Path $script:PreflightArtifactPath
      Assert-StrattonArtifactHash `
        -Artifact $preflight `
        -ExpectedHash ([string] $state.preflightArtifactHash) `
        -Kind 'PREFLIGHT'
      Invoke-StrattonProviderRegistration `
        -Preflight $preflight `
        -ApprovedNamespaces @($state.approvedProviderNamespaces) `
        -SubscriptionId $SubscriptionId `
        -ApproveProviderRegistration:(
          $ApproveProviderRegistration -or
          (Get-StrattonPropertyValue -InputObject $state -Name 'providerRegistrationApproved') -eq $true
        ) `
        -AzInvoker $AzInvoker | Out-Null
      Invoke-StrattonScriptFile `
        -Path (Join-Path $PSScriptRoot 'Test-StrattonAzurePreflight.ps1') `
        -Parameters @{
          SubscriptionId = $SubscriptionId
          TenantId = $TenantId
          ExpectedUser = $ExpectedUser
          Location = $Location
          OpenAiLocation = $OpenAiLocation
          OutFile = $script:ProviderVerificationArtifactPath
        } `
        -ScriptInvoker $ScriptInvoker | Out-Null
      $providerVerification = Read-StrattonJsonArtifact -Path $script:ProviderVerificationArtifactPath
      $state = Save-StrattonDeploymentState `
        -State $state `
        -NextPhase 'PROVIDERS_REGISTERED' `
        -Updates @{
          pendingProviderNamespaces = @()
          providerRegistrationVerificationArtifactHash = (
            Get-StrattonObjectHash -InputObject $providerVerification
          )
        }
    }

    if ($state.phase -ne 'PROVIDERS_REGISTERED') {
      throw "DEPLOYMENT_PHASE_REQUIRED:PROVIDERS_REGISTERED:$($state.phase)"
    }

    $parametersPath = Join-Path $script:DeploymentArtifactRoot 'foundation.parameters.json'
    Write-DeploymentArtifact `
      -Path $parametersPath `
      -InputObject (ConvertTo-StrattonParameterDocument -Values $foundationValues)
    $deploymentName = New-StrattonDeploymentName -Stage foundation -CommitSha $commitSha
    $whatIfResult = & $AzInvoker (New-StrattonSubscriptionWhatIfArguments `
        -DeploymentName $deploymentName `
        -SubscriptionId $SubscriptionId `
        -Location $Location `
        -TemplateFile $script:StandaloneTemplatePath `
        -ParametersFile $parametersPath)
    Assert-StrattonWhatIfSafe -WhatIfResult $whatIfResult
    Set-StrattonArtifactSection `
      -Path $script:WhatIfArtifactPath `
      -Name 'foundation' `
      -Value $whatIfResult | Out-Null
    return Save-StrattonDeploymentState `
      -State $state `
      -NextPhase 'FOUNDATION_WHAT_IF_READY' `
      -Updates @{
        foundationDeploymentName = $deploymentName
        foundationParametersHash = (Get-StrattonObjectHash -InputObject $foundationValues)
        foundationParameterFileHash = (Get-StrattonFileHash -Path $parametersPath)
        templateFileHash = (Get-StrattonFileHash -Path $script:StandaloneTemplatePath)
        foundationWhatIfHash = (Get-StrattonObjectHash -InputObject $whatIfResult)
        foundationWhatIfApproved = $false
      }
  }

  if ($Phase -eq 'FoundationDeploy') {
    $parametersPath = Join-Path $script:DeploymentArtifactRoot 'foundation.parameters.json'
    $remainingSteps = @(Get-StrattonFoundationResumeSteps -Phase $state.phase)
    if ($remainingSteps.Count -eq 0) {
      return $state
    }

    if ($state.phase -eq 'FOUNDATION_WHAT_IF_READY') {
      if (-not $ApproveFoundationWhatIf) {
        throw 'WHAT_IF_APPROVAL_REQUIRED'
      }
      if (
        (Get-StrattonPropertyValue -InputObject $state -Name 'foundationParametersHash') -cne
        (Get-StrattonObjectHash -InputObject $foundationValues)
      ) {
        throw 'FOUNDATION_PARAMETER_DRIFT'
      }
      Assert-StrattonFileHash `
        -Path $parametersPath `
        -ExpectedHash ([string] $state.foundationParameterFileHash) `
        -Kind 'PARAMETER'
      Assert-StrattonFileHash `
        -Path $script:StandaloneTemplatePath `
        -ExpectedHash ([string] $state.templateFileHash) `
        -Kind 'TEMPLATE'
      $whatIfArtifact = Read-StrattonJsonArtifact -Path $script:WhatIfArtifactPath
      Assert-StrattonArtifactHash `
        -Artifact (Get-StrattonRequiredValue -InputObject $whatIfArtifact -Name 'foundation') `
        -ExpectedHash ([string] $state.foundationWhatIfHash) `
        -Kind 'WHAT_IF'
      $state = Save-StrattonDeploymentState `
        -State $state `
        -NextPhase $state.phase `
        -Updates @{ foundationWhatIfApproved = $true }
      Assert-DeploymentTransition -State $state -NextPhase 'PLATFORM_FOUNDATION_DEPLOYED'

      $deployment = & $AzInvoker (New-StrattonSubscriptionDeploymentArguments `
          -DeploymentName $state.foundationDeploymentName `
          -SubscriptionId $SubscriptionId `
          -Location $Location `
          -TemplateFile $script:StandaloneTemplatePath `
          -ParametersFile $parametersPath)
      $foundationOutputs = ConvertFrom-StrattonArmOutputs -Deployment $deployment
      Set-StrattonArtifactSection `
        -Path $script:OutputsArtifactPath `
        -Name 'foundation' `
        -Value $foundationOutputs | Out-Null
      $state = Save-StrattonDeploymentState `
        -State $state `
        -NextPhase 'PLATFORM_FOUNDATION_DEPLOYED'
    }

    $outputsArtifact = Read-StrattonJsonArtifact -Path $script:OutputsArtifactPath
    $foundationOutputs = Get-StrattonRequiredValue -InputObject $outputsArtifact -Name 'foundation'
    if ($state.phase -eq 'PLATFORM_FOUNDATION_DEPLOYED') {
      Invoke-StrattonScriptFile `
        -Path (Join-Path $PSScriptRoot 'Set-StrattonEntra.ps1') `
        -Parameters @{
          TenantId = $TenantId
          WebRedirectUri = $script:ProvisionalRedirectUri
          BffManagedIdentityPrincipalId = (Get-StrattonRequiredValue -InputObject $foundationOutputs -Name 'bffIdentityPrincipalId')
          BffManagedIdentityClientId = (Get-StrattonRequiredValue -InputObject $foundationOutputs -Name 'bffIdentityClientId')
        } `
        -ScriptInvoker $ScriptInvoker | Out-Null
      $state = Save-StrattonDeploymentState -State $state -NextPhase 'ENTRA_FOUNDATION_COMPLETE'
    }

    if ($state.phase -eq 'ENTRA_FOUNDATION_COMPLETE') {
      $registryServer = [string] (Get-StrattonRequiredValue -InputObject $foundationOutputs -Name 'containerRegistryServer')
      Invoke-StrattonScriptFile `
        -Path (Join-Path $PSScriptRoot 'Build-StrattonImages.ps1') `
        -Parameters @{
          RegistryName = $registryServer.Split('.')[0]
          CommitSha = $commitSha
          OutFile = (Join-Path $script:DeploymentArtifactRoot 'images.json')
        } `
        -ScriptInvoker $ScriptInvoker | Out-Null
      $state = Save-StrattonDeploymentState -State $state -NextPhase 'IMAGES_BUILT'
    }

    if ($state.phase -eq 'IMAGES_BUILT') {
      Invoke-StrattonScriptFile `
        -Path (Join-Path $PSScriptRoot 'Initialize-StrattonDataPlane.ps1') `
        -Parameters @{
          ResourceGroupName = $script:ResourceGroupName
          DeploymentName = $state.foundationDeploymentName
        } `
        -ScriptInvoker $ScriptInvoker | Out-Null
      $state = Save-StrattonDeploymentState -State $state -NextPhase 'DATA_PLANE_READY'
    }
    return $state
  }

  if ($Phase -eq 'ApplicationWhatIf') {
    if ($state.phase -ne 'DATA_PLANE_READY') {
      throw "DEPLOYMENT_PHASE_REQUIRED:DATA_PLANE_READY:$($state.phase)"
    }
    $entraArtifact = Read-StrattonJsonArtifact -Path (Join-Path $script:DeploymentArtifactRoot 'entra.json')
    $imagesArtifact = Read-StrattonJsonArtifact -Path (Join-Path $script:DeploymentArtifactRoot 'images.json')
    $applicationValues = New-StrattonApplicationParameterValues `
      -FoundationParameters $foundationValues `
      -EntraArtifact $entraArtifact `
      -ImagesArtifact $imagesArtifact
    $parametersPath = Join-Path $script:DeploymentArtifactRoot 'application.parameters.json'
    Write-DeploymentArtifact `
      -Path $parametersPath `
      -InputObject (ConvertTo-StrattonParameterDocument -Values $applicationValues)
    $deploymentName = New-StrattonDeploymentName -Stage application -CommitSha $commitSha
    $whatIfResult = & $AzInvoker (New-StrattonSubscriptionWhatIfArguments `
        -DeploymentName $deploymentName `
        -SubscriptionId $SubscriptionId `
        -Location $Location `
        -TemplateFile $script:StandaloneTemplatePath `
        -ParametersFile $parametersPath)
    Assert-StrattonWhatIfSafe -WhatIfResult $whatIfResult
    Set-StrattonArtifactSection `
      -Path $script:WhatIfArtifactPath `
      -Name 'application' `
      -Value $whatIfResult | Out-Null
    return Save-StrattonDeploymentState `
      -State $state `
      -NextPhase 'APPLICATION_WHAT_IF_READY' `
      -Updates @{
        applicationDeploymentName = $deploymentName
        applicationParametersHash = (Get-StrattonObjectHash -InputObject $applicationValues)
        applicationParameterFileHash = (Get-StrattonFileHash -Path $parametersPath)
        templateFileHash = (Get-StrattonFileHash -Path $script:StandaloneTemplatePath)
        applicationWhatIfHash = (Get-StrattonObjectHash -InputObject $whatIfResult)
        applicationWhatIfApproved = $false
      }
  }

  if ($Phase -eq 'ApplicationDeploy') {
    $parametersPath = Join-Path $script:DeploymentArtifactRoot 'application.parameters.json'
    $remainingSteps = @(Get-StrattonApplicationResumeSteps -Phase $state.phase)
    if ($remainingSteps.Count -eq 0) {
      return $state
    }

    if ($state.phase -eq 'APPLICATION_WHAT_IF_READY') {
      if (-not $ApproveApplicationWhatIf) {
        throw 'WHAT_IF_APPROVAL_REQUIRED'
      }
      $entraArtifact = Read-StrattonJsonArtifact -Path (Join-Path $script:DeploymentArtifactRoot 'entra.json')
      $imagesArtifact = Read-StrattonJsonArtifact -Path (Join-Path $script:DeploymentArtifactRoot 'images.json')
      $applicationValues = New-StrattonApplicationParameterValues `
        -FoundationParameters $foundationValues `
        -EntraArtifact $entraArtifact `
        -ImagesArtifact $imagesArtifact
      if (
        (Get-StrattonPropertyValue -InputObject $state -Name 'applicationParametersHash') -cne
        (Get-StrattonObjectHash -InputObject $applicationValues)
      ) {
        throw 'APPLICATION_PARAMETER_DRIFT'
      }
      Assert-StrattonFileHash `
        -Path $parametersPath `
        -ExpectedHash ([string] $state.applicationParameterFileHash) `
        -Kind 'PARAMETER'
      Assert-StrattonFileHash `
        -Path $script:StandaloneTemplatePath `
        -ExpectedHash ([string] $state.templateFileHash) `
        -Kind 'TEMPLATE'
      $whatIfArtifact = Read-StrattonJsonArtifact -Path $script:WhatIfArtifactPath
      Assert-StrattonArtifactHash `
        -Artifact (Get-StrattonRequiredValue -InputObject $whatIfArtifact -Name 'application') `
        -ExpectedHash ([string] $state.applicationWhatIfHash) `
        -Kind 'WHAT_IF'
      $state = Save-StrattonDeploymentState `
        -State $state `
        -NextPhase $state.phase `
        -Updates @{ applicationWhatIfApproved = $true }
      Assert-DeploymentTransition -State $state -NextPhase 'APPLICATIONS_DEPLOYED'

      $deployment = & $AzInvoker (New-StrattonSubscriptionDeploymentArguments `
          -DeploymentName $state.applicationDeploymentName `
          -SubscriptionId $SubscriptionId `
          -Location $Location `
          -TemplateFile $script:StandaloneTemplatePath `
          -ParametersFile $parametersPath)
      $applicationOutputs = ConvertFrom-StrattonArmOutputs -Deployment $deployment
      Set-StrattonArtifactSection `
        -Path $script:OutputsArtifactPath `
        -Name 'application' `
        -Value $applicationOutputs | Out-Null
      $state = Save-StrattonDeploymentState -State $state -NextPhase 'APPLICATIONS_DEPLOYED'
    }

    if (
      $state.phase -eq 'APPLICATIONS_DEPLOYED' -and
      (Get-StrattonPropertyValue -InputObject $state -Name 'deployedRedirectRegistered') -ne $true
    ) {
      $outputsArtifact = Read-StrattonJsonArtifact -Path $script:OutputsArtifactPath
      $applicationOutputs = Get-StrattonRequiredValue -InputObject $outputsArtifact -Name 'application'
      $deployedRedirectUri = "https://$(Get-StrattonRequiredValue -InputObject $applicationOutputs -Name 'webAppFqdn')"
      Invoke-StrattonScriptFile `
        -Path (Join-Path $PSScriptRoot 'Set-StrattonEntra.ps1') `
        -Parameters @{
          TenantId = $TenantId
          WebRedirectUri = $deployedRedirectUri
          AdditionalWebRedirectUri = $script:ProvisionalRedirectUri
          BffManagedIdentityPrincipalId = (Get-StrattonRequiredValue -InputObject $applicationOutputs -Name 'bffIdentityPrincipalId')
          BffManagedIdentityClientId = (Get-StrattonRequiredValue -InputObject $applicationOutputs -Name 'bffIdentityClientId')
        } `
        -ScriptInvoker $ScriptInvoker | Out-Null
      $state = Save-StrattonDeploymentState `
        -State $state `
        -NextPhase $state.phase `
        -Updates @{
          deployedRedirectUri = $deployedRedirectUri
          deployedRedirectRegistered = $true
          provisionalRedirectRetained = $true
        }
    }
    return $state
  }

  throw "UNSUPPORTED_DEPLOYMENT_PHASE:$Phase"
}

if ($LoadOnly) {
  return
}

if ([string]::IsNullOrWhiteSpace($Phase)) {
  throw 'DEPLOYMENT_PHASE_REQUIRED'
}

Invoke-StrattonStandalonePhase `
  -Phase $Phase `
  -ApproveProviderRegistration:$ApproveProviderRegistration `
  -ApproveFoundationWhatIf:$ApproveFoundationWhatIf `
  -ApproveApplicationWhatIf:$ApproveApplicationWhatIf
