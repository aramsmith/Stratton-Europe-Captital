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

function Invoke-StrattonContainerAppNodeCommand {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $AppName,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $Code
  )

  $encoded = [Convert]::ToBase64String([System.Text.UTF8Encoding]::new($false).GetBytes($Code))
  $bootstrap = "eval(Buffer.from('$encoded','base64').toString('utf8'))"
  $command = "node --input-type=module -e `"$bootstrap`""
  $output = & az containerapp exec `
    --name $AppName `
    --resource-group $ResourceGroupName `
    --subscription $SubscriptionId `
    --command $command 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "CONTAINER_APP_INTERNAL_VERIFICATION_FAILED:$AppName"
  }
  return ($output | Out-String)
}

function Invoke-StrattonDefaultInternalVerification {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Outputs,

    [Parameter(Mandatory)]
    [string] $ResourceGroupName,

    [Parameter(Mandatory)]
    [string] $SubscriptionId
  )

  $bffAppName = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name 'bffAppName')
  $phase5AppName = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name 'phase5AppName')
  $phase5Fqdn = [string] (Get-StrattonRequiredValue -InputObject $Outputs -Name 'phase5ApiFqdn')

  $bffHealth = Invoke-StrattonContainerAppNodeCommand `
    -AppName $bffAppName `
    -ResourceGroupName $ResourceGroupName `
    -SubscriptionId $SubscriptionId `
    -Code "const response=await fetch('http://127.0.0.1:3001/healthz');if(!response.ok)process.exit(1);console.log('STRATTON_BFF_HEALTH_PASS');"
  $phase5Health = Invoke-StrattonContainerAppNodeCommand `
    -AppName $bffAppName `
    -ResourceGroupName $ResourceGroupName `
    -SubscriptionId $SubscriptionId `
    -Code "const response=await fetch('https://$phase5Fqdn/health');if(!response.ok)process.exit(1);console.log('STRATTON_PHASE5_HEALTH_PASS');"
  $sqlResult = Invoke-StrattonContainerAppNodeCommand `
    -AppName $bffAppName `
    -ResourceGroupName $ResourceGroupName `
    -SubscriptionId $SubscriptionId `
    -Code @'
const dns = await import('node:dns/promises');
const { DefaultAzureCredential } = await import('@azure/identity');
const sql = await import('mssql');
const resolved = await dns.lookup(process.env.AZURE_SQL_SERVER_FQDN);
const octets = resolved.address.split('.').map(Number);
const privateAddress = octets.length === 4 && (
  octets[0] === 10 ||
  (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
  (octets[0] === 192 && octets[1] === 168)
);
if (!privateAddress) process.exit(1);
console.log(`STRATTON_SQL_PRIVATE_DNS_PASS:${resolved.address}`);
const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID
});
const access = await credential.getToken('https://database.windows.net/.default');
if (!access?.token) process.exit(1);
const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER_FQDN,
  database: process.env.AZURE_SQL_DATABASE_NAME,
  options: { encrypt: true, trustServerCertificate: false },
  authentication: {
    type: 'azure-active-directory-access-token',
    options: { token: access.token }
  }
});
await pool.request().query('SELECT 1 AS verified');
await pool.close();
console.log('STRATTON_SQL_QUERY_PASS');
'@

  $routeResult = Invoke-StrattonContainerAppNodeCommand `
    -AppName $phase5AppName `
    -ResourceGroupName $ResourceGroupName `
    -SubscriptionId $SubscriptionId `
    -Code @'
const { DefaultAzureCredential } = await import('@azure/identity');
const sql = await import('mssql');
const credential = new DefaultAzureCredential({
  managedIdentityClientId: process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID
});
const access = await credential.getToken('https://database.windows.net/.default');
if (!access?.token) process.exit(1);
const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER_FQDN,
  database: process.env.AZURE_SQL_DATABASE_NAME,
  options: { encrypt: true, trustServerCertificate: false },
  authentication: {
    type: 'azure-active-directory-access-token',
    options: { token: access.token }
  }
});
const request = pool.request();
await request.query("EXEC sys.sp_set_session_context @key=N'tenant_id', @value=N'27140306-eea5-4e7f-91e9-4c9e86864b3a'; EXEC sys.sp_set_session_context @key=N'case_id', @value=N'project-danube';");
const result = await request.query("SELECT route, resource_id AS resourceId, deployment_id AS deploymentId, region, api_version AS apiVersion, evidence_id AS evidenceId, evidence_version AS evidenceVersion, status, valid_from AS validFrom, valid_until AS validUntil FROM dbo.approved_model_route_evidence ORDER BY CASE route WHEN 'LUNA' THEN 1 WHEN 'TERRA' THEN 2 WHEN 'SOL' THEN 3 ELSE 4 END;");
await pool.close();
console.log(`STRATTON_ROUTES:${JSON.stringify(result.recordset)}`);
'@

  $routeLine = @($routeResult -split "`r?`n" | Where-Object { $_ -match 'STRATTON_ROUTES:' }) |
    Select-Object -Last 1
  if (-not $routeLine) {
    throw 'PHASE5_ROUTE_EVIDENCE_UNAVAILABLE'
  }
  $routeJson = $routeLine.Substring($routeLine.IndexOf('STRATTON_ROUTES:') + 'STRATTON_ROUTES:'.Length)

  return [pscustomobject]@{
    bffHealth = ($bffHealth -match 'STRATTON_BFF_HEALTH_PASS')
    phase5Health = ($phase5Health -match 'STRATTON_PHASE5_HEALTH_PASS')
    sqlPrivateDns = ($sqlResult -match 'STRATTON_SQL_PRIVATE_DNS_PASS:(?<address>[0-9.]+)') -and
      (Test-StrattonPrivateIpAddress -Address $Matches.address)
    sqlTokenAuthenticatedQuery = ($sqlResult -match 'STRATTON_SQL_QUERY_PASS')
    routeBindings = @($routeJson | ConvertFrom-Json -Depth 30)
  }
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
    Invoke-StrattonDefaultInternalVerification `
      -Outputs $outputs `
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
