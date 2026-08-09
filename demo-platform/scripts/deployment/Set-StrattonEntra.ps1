[CmdletBinding()]
param(
  [ValidatePattern('^[0-9a-fA-F-]{36}$')]
  [string] $TenantId,

  [ValidatePattern('^https?://')]
  [string] $WebRedirectUri,

  [ValidatePattern('^$|^[0-9a-fA-F-]{36}$')]
  [string] $BffManagedIdentityPrincipalId,

  [ValidatePattern('^$|^[0-9a-fA-F-]{36}$')]
  [string] $BffManagedIdentityClientId,

  [switch] $WhatIf,

  [switch] $LoadOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$modulePath = Join-Path $PSScriptRoot 'Stratton.Deployment.psm1'
Import-Module $modulePath -Force

function Get-PropertyValue {
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

  $property = $InputObject.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Get-GraphCollection {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Response
  )

  $valueProperty = $Response.PSObject.Properties['value']
  if ($null -ne $valueProperty) {
    return @($valueProperty.Value)
  }

  return @($Response)
}

function Invoke-Graph {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [ValidateSet('GET', 'POST', 'PATCH')]
    [string] $Method,

    [Parameter(Mandatory)]
    [string] $Uri,

    [AllowNull()]
    [object] $Body,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  if ($null -ne $GraphInvoker) {
    return & $GraphInvoker $Method $Uri $Body
  }

  $arguments = @('rest', '--method', $Method, '--uri', $Uri)
  if ($null -ne $Body) {
    $arguments += @(
      '--headers',
      'Content-Type=application/json',
      '--body',
      ($Body | ConvertTo-Json -Depth 50 -Compress)
    )
  }

  return Invoke-AzJson -Arguments $arguments
}

function Add-ReconciliationPlan {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[object]] $Plan,

    [Parameter(Mandatory)]
    [string] $Action,

    [Parameter(Mandatory)]
    [string] $Target
  )

  $Plan.Add([pscustomobject]@{
      action = $Action
      target = $Target
    })
}

function Get-ManifestApplication {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Manifest,

    [Parameter(Mandatory)]
    [ValidateSet('web', 'bff', 'phase5')]
    [string] $Key
  )

  $application = @($Manifest.applications | Where-Object key -eq $Key)
  if ($application.Count -ne 1) {
    throw "ENTRA_MANIFEST_INVALID:$Key"
  }

  return $application[0]
}

function Find-StrattonApplication {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Definition,

    [Parameter(Mandatory)]
    [string] $IdentifierUriPrefix,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  $filter = [uri]::EscapeDataString("displayName eq '$($Definition.displayName)'")
  $uri = "https://graph.microsoft.com/v1.0/applications?`$filter=$filter"
  $candidates = @(Get-GraphCollection -Response (Invoke-Graph -Method GET -Uri $uri -GraphInvoker $GraphInvoker))
  $matches = @(
    $candidates | Where-Object {
      $_.displayName -ceq $Definition.displayName -and
      @($_.identifierUris | Where-Object { $_.StartsWith($IdentifierUriPrefix, [System.StringComparison]::Ordinal) }).Count -gt 0
    }
  )

  if ($matches.Count -gt 1 -or ($candidates.Count -gt 0 -and $matches.Count -eq 0)) {
    throw 'ENTRA_APPLICATION_CONFLICT'
  }

  if ($matches.Count -eq 1) {
    return $matches[0]
  }

  return $null
}

function New-DelegatedScope {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Id,

    [Parameter(Mandatory)]
    [string] $AdminConsentDisplayName
  )

  return [ordered]@{
    id = $Id
    adminConsentDescription = 'Allows the application to access the Stratton API on behalf of the signed-in user.'
    adminConsentDisplayName = $AdminConsentDisplayName
    isEnabled = $true
    type = 'User'
    userConsentDescription = 'Allows the application to access the Stratton API on your behalf.'
    userConsentDisplayName = $AdminConsentDisplayName
    value = 'access_as_user'
  }
}

function New-ApplicationDefinition {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Manifest,

    [Parameter(Mandatory)]
    [object] $Application,

    [Parameter(Mandatory)]
    [string] $WebRedirectUri,

    [AllowNull()]
    [object] $BffApplication,

    [AllowNull()]
    [object] $Phase5Application
  )

  $definition = [ordered]@{
    displayName = $Application.displayName
    signInAudience = 'AzureADMyOrg'
    identifierUris = @($Application.identifierUri)
  }

  switch ($Application.key) {
    'web' {
      $definition.spa = @{ redirectUris = @($WebRedirectUri) }
      if ($null -ne $BffApplication) {
        $definition.requiredResourceAccess = @(
          @{
            resourceAppId = $BffApplication.appId
            resourceAccess = @(
              @{
                id = $Manifest.webToBffScopeId
                type = 'Scope'
              }
            )
          }
        )
      }
    }
    'bff' {
      $definition.api = @{
        requestedAccessTokenVersion = 2
        oauth2PermissionScopes = @(
          (New-DelegatedScope -Id $Manifest.webToBffScopeId -AdminConsentDisplayName 'Access Stratton Demo BFF')
        )
      }
      if ($null -ne $Phase5Application) {
        $definition.requiredResourceAccess = @(
          @{
            resourceAppId = $Phase5Application.appId
            resourceAccess = @(
              @{
                id = $Manifest.bffToPhase5ScopeId
                type = 'Scope'
              }
            )
          }
        )
      }
    }
    'phase5' {
      $definition.api = @{
        requestedAccessTokenVersion = 2
        oauth2PermissionScopes = @(
          (New-DelegatedScope -Id $Manifest.bffToPhase5ScopeId -AdminConsentDisplayName 'Access Stratton Phase 5 API')
        )
      }
      $definition.appRoles = @(
        @{
          allowedMemberTypes = @('Application')
          description = 'Allows the BFF managed identity to complete Phase 5 work.'
          displayName = 'Complete Stratton Phase 5'
          id = $Manifest.phase5CompletionRoleId
          isEnabled = $true
          value = 'Phase5.Complete'
        }
      )
    }
  }

  return $definition
}

function Test-ApplicationMatches {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Application,

    [Parameter(Mandatory)]
    [hashtable] $Definition
  )

  if (
    $Application.displayName -cne $Definition.displayName -or
    @($Application.identifierUris).Count -ne @($Definition.identifierUris).Count -or
    @($Application.identifierUris | Where-Object { $_ -notin @($Definition.identifierUris) }).Count -gt 0
  ) {
    return $false
  }

  foreach ($propertyName in @('spa', 'api', 'appRoles', 'requiredResourceAccess')) {
    if (-not $Definition.Contains($propertyName)) {
      continue
    }

    $actual = Get-PropertyValue -InputObject $Application -Name $propertyName
    $expectedJson = $Definition[$propertyName] | ConvertTo-Json -Depth 50 -Compress
    $actualJson = $actual | ConvertTo-Json -Depth 50 -Compress
    if ($actualJson -ne $expectedJson) {
      return $false
    }
  }

  return $true
}

function Ensure-StrattonApplication {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Manifest,

    [Parameter(Mandatory)]
    [object] $ApplicationDefinition,

    [Parameter(Mandatory)]
    [hashtable] $DesiredDefinition,

    [Parameter(Mandatory)]
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[object]] $Plan,

    [switch] $WhatIf,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  $application = Find-StrattonApplication `
    -Definition $ApplicationDefinition `
    -IdentifierUriPrefix $Manifest.identifierUriPrefix `
    -GraphInvoker $GraphInvoker

  if ($null -eq $application) {
    Add-ReconciliationPlan -Plan $Plan -Action 'Create application' -Target $ApplicationDefinition.displayName
    if ($WhatIf) {
      return $null
    }

    return Invoke-Graph `
      -Method POST `
      -Uri 'https://graph.microsoft.com/v1.0/applications' `
      -Body $DesiredDefinition `
      -GraphInvoker $GraphInvoker
  }

  if (-not (Test-ApplicationMatches -Application $application -Definition $DesiredDefinition)) {
    Add-ReconciliationPlan -Plan $Plan -Action 'Update application' -Target $ApplicationDefinition.displayName
    if (-not $WhatIf) {
      $application = Invoke-Graph `
        -Method PATCH `
        -Uri "https://graph.microsoft.com/v1.0/applications/$($application.id)" `
        -Body $DesiredDefinition `
        -GraphInvoker $GraphInvoker
    }
  }

  return $application
}

function Ensure-ServicePrincipal {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Application,

    [Parameter(Mandatory)]
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[object]] $Plan,

    [switch] $WhatIf,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  $filter = [uri]::EscapeDataString("appId eq '$($Application.appId)'")
  $uri = "https://graph.microsoft.com/v1.0/servicePrincipals?`$filter=$filter"
  $matches = @(Get-GraphCollection -Response (Invoke-Graph -Method GET -Uri $uri -GraphInvoker $GraphInvoker))
  if ($matches.Count -gt 1) {
    throw 'ENTRA_SERVICE_PRINCIPAL_CONFLICT'
  }

  if ($matches.Count -eq 1) {
    return $matches[0]
  }

  Add-ReconciliationPlan -Plan $Plan -Action 'Create service principal' -Target $Application.displayName
  if ($WhatIf) {
    return $null
  }

  return Invoke-Graph `
    -Method POST `
    -Uri 'https://graph.microsoft.com/v1.0/servicePrincipals' `
    -Body @{ appId = $Application.appId } `
    -GraphInvoker $GraphInvoker
}

function Get-BffManagedIdentityServicePrincipal {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $PrincipalId,

    [Parameter(Mandatory)]
    [string] $ClientId,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  $servicePrincipal = Invoke-Graph `
    -Method GET `
    -Uri "https://graph.microsoft.com/v1.0/servicePrincipals/$PrincipalId" `
    -GraphInvoker $GraphInvoker
  if ($servicePrincipal.appId -cne $ClientId) {
    throw 'ENTRA_BFF_MANAGED_IDENTITY_MISMATCH'
  }

  return $servicePrincipal
}

function Ensure-OAuth2PermissionGrant {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $ClientServicePrincipal,

    [Parameter(Mandatory)]
    [object] $ResourceServicePrincipal,

    [Parameter(Mandatory)]
    [string] $Scope,

    [Parameter(Mandatory)]
    [string] $Target,

    [Parameter(Mandatory)]
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[object]] $Plan,

    [switch] $WhatIf,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  $filter = [uri]::EscapeDataString(
    "clientId eq '$($ClientServicePrincipal.id)' and resourceId eq '$($ResourceServicePrincipal.id)'"
  )
  $uri = "https://graph.microsoft.com/v1.0/oauth2PermissionGrants?`$filter=$filter"
  $matches = @(Get-GraphCollection -Response (Invoke-Graph -Method GET -Uri $uri -GraphInvoker $GraphInvoker))
  if ($matches.Count -gt 1) {
    throw 'ENTRA_CONSENT_CONFLICT'
  }

  $body = @{
    clientId = $ClientServicePrincipal.id
    consentType = 'AllPrincipals'
    resourceId = $ResourceServicePrincipal.id
    scope = $Scope
  }

  if ($matches.Count -eq 0) {
    Add-ReconciliationPlan -Plan $Plan -Action 'Grant admin consent' -Target $Target
    if (-not $WhatIf) {
      Invoke-Graph -Method POST -Uri 'https://graph.microsoft.com/v1.0/oauth2PermissionGrants' -Body $body -GraphInvoker $GraphInvoker | Out-Null
    }
    return
  }

  if ($matches[0].scope -cne $Scope -or $matches[0].consentType -cne 'AllPrincipals') {
    Add-ReconciliationPlan -Plan $Plan -Action 'Update admin consent' -Target $Target
    if (-not $WhatIf) {
      Invoke-Graph `
        -Method PATCH `
        -Uri "https://graph.microsoft.com/v1.0/oauth2PermissionGrants/$($matches[0].id)" `
        -Body $body `
        -GraphInvoker $GraphInvoker | Out-Null
    }
  }
}

function Ensure-FederatedCredential {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $BffApplication,

    [Parameter(Mandatory)]
    [object] $Manifest,

    [Parameter(Mandatory)]
    [string] $TenantId,

    [Parameter(Mandatory)]
    [string] $BffManagedIdentityPrincipalId,

    [Parameter(Mandatory)]
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[object]] $Plan,

    [switch] $WhatIf,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  $body = @{
    name = $Manifest.federatedCredentialName
    issuer = "https://login.microsoftonline.com/$TenantId/v2.0"
    subject = $BffManagedIdentityPrincipalId
    audiences = @('api://AzureADTokenExchange')
  }
  $uri = "https://graph.microsoft.com/v1.0/applications/$($BffApplication.id)/federatedIdentityCredentials"
  $matches = @(
    Get-GraphCollection -Response (Invoke-Graph -Method GET -Uri $uri -GraphInvoker $GraphInvoker) |
      Where-Object name -eq $Manifest.federatedCredentialName
  )
  if ($matches.Count -gt 1) {
    throw 'ENTRA_FEDERATED_CREDENTIAL_CONFLICT'
  }

  if ($matches.Count -eq 0) {
    Add-ReconciliationPlan -Plan $Plan -Action 'Create federated credential' -Target $Manifest.federatedCredentialName
    if (-not $WhatIf) {
      Invoke-Graph -Method POST -Uri $uri -Body $body -GraphInvoker $GraphInvoker | Out-Null
    }
    return
  }

  $actualJson = @{
    name = $matches[0].name
    issuer = $matches[0].issuer
    subject = $matches[0].subject
    audiences = @($matches[0].audiences)
  } | ConvertTo-Json -Depth 10 -Compress
  $expectedJson = $body | ConvertTo-Json -Depth 10 -Compress
  if ($actualJson -ne $expectedJson) {
    Add-ReconciliationPlan -Plan $Plan -Action 'Update federated credential' -Target $Manifest.federatedCredentialName
    if (-not $WhatIf) {
      Invoke-Graph `
        -Method PATCH `
        -Uri "$uri/$($matches[0].id)" `
        -Body $body `
        -GraphInvoker $GraphInvoker | Out-Null
    }
  }
}

function Ensure-Phase5CompletionRoleAssignment {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [object] $Phase5ServicePrincipal,

    [Parameter(Mandatory)]
    [object] $Manifest,

    [Parameter(Mandatory)]
    [object] $BffManagedIdentityServicePrincipal,

    [Parameter(Mandatory)]
    [AllowEmptyCollection()]
    [System.Collections.Generic.List[object]] $Plan,

    [switch] $WhatIf,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  $uri = "https://graph.microsoft.com/v1.0/servicePrincipals/$($BffManagedIdentityServicePrincipal.id)/appRoleAssignments"
  $assignments = @(Get-GraphCollection -Response (Invoke-Graph -Method GET -Uri $uri -GraphInvoker $GraphInvoker))
  $assignment = @(
    $assignments | Where-Object {
      $_.resourceId -eq $Phase5ServicePrincipal.id -and
      $_.appRoleId -eq $Manifest.phase5CompletionRoleId
    }
  )
  if ($assignment.Count -gt 1) {
    throw 'ENTRA_APP_ROLE_ASSIGNMENT_CONFLICT'
  }

  if ($assignment.Count -eq 0) {
    Add-ReconciliationPlan -Plan $Plan -Action 'Assign Phase 5 completion role' -Target 'BFF managed identity'
    if (-not $WhatIf) {
      Invoke-Graph `
        -Method POST `
        -Uri $uri `
        -Body @{
          principalId = $BffManagedIdentityServicePrincipal.id
          resourceId = $Phase5ServicePrincipal.id
          appRoleId = $Manifest.phase5CompletionRoleId
        } `
        -GraphInvoker $GraphInvoker | Out-Null
    }
  }
}

function Invoke-StrattonEntraReconciliation {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-fA-F-]{36}$')]
    [string] $TenantId,

    [Parameter(Mandatory)]
    [ValidatePattern('^https?://')]
    [string] $WebRedirectUri,

    [ValidatePattern('^$|^[0-9a-fA-F-]{36}$')]
    [string] $BffManagedIdentityPrincipalId,

    [ValidatePattern('^$|^[0-9a-fA-F-]{36}$')]
    [string] $BffManagedIdentityClientId,

    [switch] $WhatIf,

    [AllowNull()]
    [scriptblock] $GraphInvoker
  )

  $manifestPath = Join-Path $PSScriptRoot 'entra-manifest.json'
  $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
  $plan = [System.Collections.Generic.List[object]]::new()

  if (
    -not $WhatIf -and
    ([string]::IsNullOrWhiteSpace($BffManagedIdentityPrincipalId) -or
      [string]::IsNullOrWhiteSpace($BffManagedIdentityClientId))
  ) {
    throw 'BFF_MANAGED_IDENTITY_INPUT_REQUIRED'
  }

  $webDefinition = Get-ManifestApplication -Manifest $manifest -Key web
  $bffDefinition = Get-ManifestApplication -Manifest $manifest -Key bff
  $phase5Definition = Get-ManifestApplication -Manifest $manifest -Key phase5

  $web = Ensure-StrattonApplication `
    -Manifest $manifest `
    -ApplicationDefinition $webDefinition `
    -DesiredDefinition (New-ApplicationDefinition -Manifest $manifest -Application $webDefinition -WebRedirectUri $WebRedirectUri) `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker
  $bff = Ensure-StrattonApplication `
    -Manifest $manifest `
    -ApplicationDefinition $bffDefinition `
    -DesiredDefinition (New-ApplicationDefinition -Manifest $manifest -Application $bffDefinition -WebRedirectUri $WebRedirectUri) `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker
  $phase5 = Ensure-StrattonApplication `
    -Manifest $manifest `
    -ApplicationDefinition $phase5Definition `
    -DesiredDefinition (New-ApplicationDefinition -Manifest $manifest -Application $phase5Definition -WebRedirectUri $WebRedirectUri) `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker

  if ($WhatIf -and ($null -eq $web -or $null -eq $bff -or $null -eq $phase5)) {
    return [pscustomobject]@{
      mode = 'WhatIf'
      plan = @($plan)
    }
  }

  $web = Ensure-StrattonApplication `
    -Manifest $manifest `
    -ApplicationDefinition $webDefinition `
    -DesiredDefinition (New-ApplicationDefinition -Manifest $manifest -Application $webDefinition -WebRedirectUri $WebRedirectUri -BffApplication $bff) `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker
  $bff = Ensure-StrattonApplication `
    -Manifest $manifest `
    -ApplicationDefinition $bffDefinition `
    -DesiredDefinition (New-ApplicationDefinition -Manifest $manifest -Application $bffDefinition -WebRedirectUri $WebRedirectUri -Phase5Application $phase5) `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker

  $webServicePrincipal = Ensure-ServicePrincipal -Application $web -Plan $plan -WhatIf:$WhatIf -GraphInvoker $GraphInvoker
  $bffServicePrincipal = Ensure-ServicePrincipal -Application $bff -Plan $plan -WhatIf:$WhatIf -GraphInvoker $GraphInvoker
  $phase5ServicePrincipal = Ensure-ServicePrincipal -Application $phase5 -Plan $plan -WhatIf:$WhatIf -GraphInvoker $GraphInvoker
  if ($WhatIf -and ($null -eq $webServicePrincipal -or $null -eq $bffServicePrincipal -or $null -eq $phase5ServicePrincipal)) {
    return [pscustomobject]@{
      mode = 'WhatIf'
      plan = @($plan)
    }
  }

  if ([string]::IsNullOrWhiteSpace($BffManagedIdentityPrincipalId) -or [string]::IsNullOrWhiteSpace($BffManagedIdentityClientId)) {
    Add-ReconciliationPlan -Plan $plan -Action 'Validate BFF managed identity' -Target 'BFF managed identity principal and client IDs'
    return [pscustomobject]@{
      mode = 'WhatIf'
      plan = @($plan)
    }
  }

  $bffManagedIdentityServicePrincipal = Get-BffManagedIdentityServicePrincipal `
    -PrincipalId $BffManagedIdentityPrincipalId `
    -ClientId $BffManagedIdentityClientId `
    -GraphInvoker $GraphInvoker

  Ensure-OAuth2PermissionGrant `
    -ClientServicePrincipal $webServicePrincipal `
    -ResourceServicePrincipal $bffServicePrincipal `
    -Scope 'access_as_user' `
    -Target 'Stratton Demo Web to Stratton Demo BFF' `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker
  Ensure-OAuth2PermissionGrant `
    -ClientServicePrincipal $bffServicePrincipal `
    -ResourceServicePrincipal $phase5ServicePrincipal `
    -Scope 'access_as_user' `
    -Target 'Stratton Demo BFF to Stratton Phase 5 API' `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker
  Ensure-FederatedCredential `
    -BffApplication $bff `
    -Manifest $manifest `
    -TenantId $TenantId `
    -BffManagedIdentityPrincipalId $BffManagedIdentityPrincipalId `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker
  Ensure-Phase5CompletionRoleAssignment `
    -Phase5ServicePrincipal $phase5ServicePrincipal `
    -Manifest $manifest `
    -BffManagedIdentityServicePrincipal $bffManagedIdentityServicePrincipal `
    -Plan $plan `
    -WhatIf:$WhatIf `
    -GraphInvoker $GraphInvoker

  if ($WhatIf) {
    return [pscustomobject]@{
      mode = 'WhatIf'
      plan = @($plan)
    }
  }

  $artifact = [ordered]@{
    webClientId = $web.appId
    bffClientId = $bff.appId
    phase5ClientId = $phase5.appId
    webToBffScopeId = $manifest.webToBffScopeId
    bffToPhase5ScopeId = $manifest.bffToPhase5ScopeId
    phase5CompletionRoleId = $manifest.phase5CompletionRoleId
    servicePrincipalObjectIds = @{
      web = $webServicePrincipal.id
      bff = $bffServicePrincipal.id
      phase5 = $phase5ServicePrincipal.id
      bffManagedIdentity = $bffManagedIdentityServicePrincipal.id
    }
    consent = @{
      webToBff = 'Granted'
      bffToPhase5 = 'Granted'
      phase5CompletionRole = 'AssignedToBffManagedIdentity'
    }
  }
  $artifactPath = Join-Path $PSScriptRoot '..\..\artifacts\deployment\entra.json'
  Write-DeploymentArtifact -Path $artifactPath -InputObject $artifact

  return [pscustomobject]@{
    mode = 'Applied'
    plan = @($plan)
    artifact = $artifact
  }
}

if (-not $LoadOnly) {
  $result = Invoke-StrattonEntraReconciliation `
    -TenantId $TenantId `
    -WebRedirectUri $WebRedirectUri `
    -BffManagedIdentityPrincipalId $BffManagedIdentityPrincipalId `
    -BffManagedIdentityClientId $BffManagedIdentityClientId `
    -WhatIf:$WhatIf

  if ($WhatIf) {
    $result.plan | Format-Table -AutoSize
  }
}
