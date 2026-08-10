Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:RequiredProviderNamespaces = @(
  'Microsoft.App',
  'Microsoft.ContainerRegistry',
  'Microsoft.OperationalInsights',
  'Microsoft.Network',
  'Microsoft.Sql',
  'Microsoft.Storage',
  'Microsoft.ServiceBus',
  'Microsoft.Search',
  'Microsoft.CognitiveServices',
  'Microsoft.ManagedIdentity',
  'Microsoft.Insights'
)

$script:RequiredOpenAiModels = @(
  [pscustomobject]@{
    route = 'LUNA'
    modelId = 'gpt-5.6-luna'
    modelVersion = '2026-07-09'
    quotaName = 'OpenAI.DataZoneStandard.gpt-5.6-luna'
    requiredCapacity = 1
  },
  [pscustomobject]@{
    route = 'TERRA'
    modelId = 'gpt-5.6-terra'
    modelVersion = '2026-07-09'
    quotaName = 'OpenAI.DataZoneStandard.gpt-5.6-terra'
    requiredCapacity = 1
  },
  [pscustomobject]@{
    route = 'SOL'
    modelId = 'gpt-5.6-sol'
    modelVersion = '2026-07-09'
    quotaName = 'OpenAI.DataZoneStandard.gpt-5.6-sol'
    requiredCapacity = 1
  }
)

$script:RecognizedLocationParameterNames = @(
  'listofallowedlocations',
  'allowedlocations',
  'allowedregions',
  'listofallowedregions',
  'allowedlocationnames',
  'locations'
)

$script:DemoPlatformRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script:DeploymentArtifactRoot = Join-Path $script:DemoPlatformRoot 'artifacts\deployment'
$script:LogAnalyticsQueryResource = 'https://api.loganalytics.io'
$script:LogAnalyticsWorkspaceApiVersion = '2023-09-01'
$script:LogAnalyticsRequestFilePrefix = '.stratton-query-body'

function Invoke-AzJson {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string[]] $Arguments
  )

  $output = & az @Arguments --only-show-errors --output json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "AZURE_CLI_FAILED:$($Arguments -join ' '):$($output | Out-String)"
  }

  if (-not $output) {
    return $null
  }

  return ($output | Out-String | ConvertFrom-Json -Depth 100)
}

function Assert-AzContext {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $TenantId,

    [Parameter(Mandatory)]
    [string] $ExpectedUser
  )

  $account = Invoke-AzJson -Arguments @('account', 'show')
  if (
    $account.id -ne $SubscriptionId -or
    $account.tenantId -ne $TenantId -or
    $account.user.name -ne $ExpectedUser
  ) {
    throw 'AZURE_CONTEXT_MISMATCH'
  }
}

function Get-RequiredProviderNamespaces {
  [CmdletBinding()]
  param()

  return @($script:RequiredProviderNamespaces)
}

function Get-RequiredOpenAiModels {
  [CmdletBinding()]
  param()

  return @(
    $script:RequiredOpenAiModels |
      ForEach-Object {
        [pscustomobject]@{
          route = $_.route
          modelId = $_.modelId
          modelVersion = $_.modelVersion
          quotaName = $_.quotaName
          requiredCapacity = $_.requiredCapacity
        }
      }
  )
}

function Get-FirstPopulatedValue {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [AllowNull()]
    [AllowEmptyCollection()]
    [object[]] $Values
  )

  foreach ($value in $Values) {
    if ($null -ne $value -and [string]::IsNullOrWhiteSpace([string] $value) -eq $false) {
      return [string] $value
    }
  }

  return $null
}

function Get-NestedPropertyValue {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [AllowNull()]
    [object] $InputObject,

    [Parameter(Mandatory)]
    [string[]] $Path
  )

  $current = $InputObject
  foreach ($segment in $Path) {
    if ($null -eq $current) {
      return $null
    }

    $property = $current.PSObject.Properties[$segment]
    if ($null -eq $property) {
      return $null
    }

    $current = $property.Value
  }

  return $current
}

function Get-NormalizedLocationName {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $Location
  )

  if ([string]::IsNullOrWhiteSpace($Location)) {
    return $null
  }

  return $Location.Trim().ToLowerInvariant()
}

function Get-NormalizedStringTokens {
  [CmdletBinding()]
  param(
    [AllowEmptyCollection()]
    [AllowNull()]
    [object[]] $Values
  )

  $tokens = [System.Collections.Generic.List[string]]::new()
  foreach ($value in @($Values)) {
    if ($null -eq $value) {
      continue
    }

    if ($value -is [string]) {
      $normalizedValue = $value.Trim().ToLowerInvariant()
      if ($normalizedValue) {
        $tokens.Add($normalizedValue)
      }
      continue
    }

    if ($value -is [System.Collections.IEnumerable] -and $value -isnot [string]) {
      foreach ($item in $value) {
        foreach ($token in @(Get-NormalizedStringTokens -Values @($item))) {
          $tokens.Add($token)
        }
      }
      continue
    }

    if ($value.PSObject -and $value.PSObject.Properties.Count -gt 0) {
      foreach ($property in $value.PSObject.Properties) {
        foreach ($token in @(Get-NormalizedStringTokens -Values @($property.Value))) {
          $tokens.Add($token)
        }
      }
      continue
    }

    $normalizedScalar = ([string] $value).Trim().ToLowerInvariant()
    if ($normalizedScalar) {
      $tokens.Add($normalizedScalar)
    }
  }

  return @($tokens | Select-Object -Unique)
}

function Test-HasLocationSignal {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }

  return [bool] ($Value -match '(?i)(location|region|geograph|geo)')
}

function Get-SubscriptionLocations {
  [CmdletBinding()]
  param()

  $locations = @(Invoke-AzJson -Arguments @('account', 'list-locations'))
  return @(
    $locations |
      ForEach-Object {
        Get-FirstPopulatedValue -Values @(
          (Get-NestedPropertyValue -InputObject $_ -Path @('name')),
          (Get-NestedPropertyValue -InputObject $_ -Path @('displayName'))
        )
      } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      ForEach-Object { $_.Trim().ToLowerInvariant() } |
      Select-Object -Unique
  )
}

function Get-PolicyLocationEvaluation {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $Parameters,

    [AllowNull()]
    [string] $PolicyName,

    [AllowNull()]
    [string] $PolicyDisplayName,

    [AllowNull()]
    [string] $PolicyDefinitionId,

    [AllowNull()]
    [string] $TargetLocation,

    [AllowEmptyCollection()]
    [string[]] $KnownLocations = @()
  )

  $normalizedTargetLocation = Get-NormalizedLocationName -Location $TargetLocation
  $normalizedKnownLocations = @(
    $KnownLocations |
      ForEach-Object { Get-NormalizedLocationName -Location $_ } |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )

  if ($null -eq $Parameters -or @($Parameters.PSObject.Properties).Count -eq 0) {
    if (
      (Test-HasLocationSignal -Value $PolicyName) -or
      (Test-HasLocationSignal -Value $PolicyDisplayName) -or
      (Test-HasLocationSignal -Value $PolicyDefinitionId)
    ) {
      return [pscustomobject]@{
        allowedLocations = @()
        locationEvidenceStatus = 'Indeterminate'
        locationEvidenceReason = 'LOCATION_POLICY_WITHOUT_ASSIGNMENT_PARAMETERS'
        matchedLocationParameters = @()
      }
    }

    return [pscustomobject]@{
      allowedLocations = @()
      locationEvidenceStatus = 'NotApplicable'
      locationEvidenceReason = 'NO_LOCATION_SIGNAL'
      matchedLocationParameters = @()
    }
  }

  $recognizedParameterNames = [System.Collections.Generic.List[string]]::new()
  $genericLocationParameterNames = [System.Collections.Generic.List[string]]::new()
  $recognizedLocationTokens = [System.Collections.Generic.List[string]]::new()
  $genericLocationTokens = [System.Collections.Generic.List[string]]::new()

  foreach ($parameter in $Parameters.PSObject.Properties) {
    $parameterName = $parameter.Name
    $normalizedParameterName = $parameterName.Trim().ToLowerInvariant()
    $parameterValue = Get-NestedPropertyValue -InputObject $parameter.Value -Path @('value')
    if ($null -eq $parameterValue) {
      $parameterValue = $parameter.Value
    }

    $tokens = @(Get-NormalizedStringTokens -Values @($parameterValue))
    if ($script:RecognizedLocationParameterNames -contains $normalizedParameterName) {
      $recognizedParameterNames.Add($parameterName)
      foreach ($token in $tokens) {
        $recognizedLocationTokens.Add($token)
      }
      continue
    }

    if (Test-HasLocationSignal -Value $parameterName) {
      $genericLocationParameterNames.Add($parameterName)
      foreach ($token in $tokens) {
        $genericLocationTokens.Add($token)
      }
    }
  }

  $hasLocationSignal = (
    $recognizedParameterNames.Count -gt 0 -or
    $genericLocationParameterNames.Count -gt 0 -or
    (Test-HasLocationSignal -Value $PolicyName) -or
    (Test-HasLocationSignal -Value $PolicyDisplayName) -or
    (Test-HasLocationSignal -Value $PolicyDefinitionId)
  )

  if (-not $hasLocationSignal) {
    return [pscustomobject]@{
      allowedLocations = @()
      locationEvidenceStatus = 'NotApplicable'
      locationEvidenceReason = 'NO_LOCATION_SIGNAL'
      matchedLocationParameters = @()
    }
  }

  $allowedLocations = if ($recognizedParameterNames.Count -gt 0) {
    @($recognizedLocationTokens | Select-Object -Unique)
  }
  else {
    @(
      $genericLocationTokens |
        Where-Object {
          $normalizedToken = $_
          $normalizedToken -eq $normalizedTargetLocation -or $normalizedKnownLocations -contains $normalizedToken
        } |
        Select-Object -Unique
    )
  }

  $allowedLocations = @($allowedLocations)

  if ($allowedLocations.Count -gt 0) {
    if ($normalizedTargetLocation -and $allowedLocations -contains $normalizedTargetLocation) {
      return [pscustomobject]@{
        allowedLocations = $allowedLocations
        locationEvidenceStatus = 'Allowed'
        locationEvidenceReason = 'PARAMETER_ALLOW_LIST'
        matchedLocationParameters = @($recognizedParameterNames + $genericLocationParameterNames | Select-Object -Unique)
      }
    }

    return [pscustomobject]@{
      allowedLocations = $allowedLocations
      locationEvidenceStatus = 'Denied'
      locationEvidenceReason = 'PARAMETER_ALLOW_LIST'
      matchedLocationParameters = @($recognizedParameterNames + $genericLocationParameterNames | Select-Object -Unique)
    }
  }

  return [pscustomobject]@{
    allowedLocations = @()
    locationEvidenceStatus = 'Indeterminate'
    locationEvidenceReason = 'UNRECOGNISED_LOCATION_PARAMETER_SHAPE'
    matchedLocationParameters = @($recognizedParameterNames + $genericLocationParameterNames | Select-Object -Unique)
  }
}

function Get-SafePolicyAssignments {
  [CmdletBinding()]
  param(
    [AllowEmptyCollection()]
    [object[]] $PolicyAssignments
  )

  return @(
    foreach ($policyAssignment in @($PolicyAssignments)) {
      [pscustomobject]@{
        name = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $policyAssignment -Path @('name')))
        displayName = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $policyAssignment -Path @('displayName')))
        scope = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $policyAssignment -Path @('scope')))
        enforcementMode = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $policyAssignment -Path @('enforcementMode')))
        policyDefinitionId = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $policyAssignment -Path @('policyDefinitionId')))
        allowedLocations = @(
          @(Get-NestedPropertyValue -InputObject $policyAssignment -Path @('allowedLocations')) |
            ForEach-Object { Get-NormalizedLocationName -Location $_ } |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
            Select-Object -Unique
        )
        locationEvidenceStatus = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $policyAssignment -Path @('locationEvidenceStatus')))
        locationEvidenceReason = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $policyAssignment -Path @('locationEvidenceReason')))
        matchedLocationParameters = @(
          @(Get-NestedPropertyValue -InputObject $policyAssignment -Path @('matchedLocationParameters')) |
            Where-Object { -not [string]::IsNullOrWhiteSpace([string] $_) } |
            Select-Object -Unique
        )
      }
    }
  )
}

function Get-NormalizedModelVersion {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $Version
  )

  if ([string]::IsNullOrWhiteSpace($Version)) {
    return $null
  }

  $trimmedVersion = $Version.Trim()
  if ($trimmedVersion -match '^(?i:unknown|n/?a|notset|unset)$') {
    return $null
  }

  return $trimmedVersion
}

function Get-ProviderReadiness {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string[]] $RequiredProviders
  )

  return @(
    foreach ($providerNamespace in $RequiredProviders) {
      $provider = Invoke-AzJson -Arguments @('provider', 'show', '--namespace', $providerNamespace)
      [pscustomobject]@{
        namespace = $provider.namespace
        registrationState = $provider.registrationState
        isRegistered = ($provider.registrationState -eq 'Registered')
      }
    }
  )
}

function Get-PolicyAssignments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $TargetLocation,

    [AllowEmptyCollection()]
    [string[]] $KnownLocations = @()
  )

  $assignments = @(Invoke-AzJson -Arguments @('policy', 'assignment', 'list', '--scope', "/subscriptions/$SubscriptionId"))
  return @(Get-SafePolicyAssignments -PolicyAssignments @(
    $assignments |
      ForEach-Object {
        $parametersValue = Get-NestedPropertyValue -InputObject $_ -Path @('parameters')
        $locationEvaluation = Get-PolicyLocationEvaluation `
          -Parameters $parametersValue `
          -PolicyName $_.name `
          -PolicyDisplayName $_.displayName `
          -PolicyDefinitionId (Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $_ -Path @('policyDefinitionId')))) `
          -TargetLocation $TargetLocation `
          -KnownLocations $KnownLocations

        [pscustomobject]@{
          name = $_.name
          displayName = $_.displayName
          scope = $_.scope
          enforcementMode = $_.enforcementMode
          policyDefinitionId = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $_ -Path @('policyDefinitionId')))
          allowedLocations = @($locationEvaluation.allowedLocations)
          locationEvidenceStatus = $locationEvaluation.locationEvidenceStatus
          locationEvidenceReason = $locationEvaluation.locationEvidenceReason
          matchedLocationParameters = @($locationEvaluation.matchedLocationParameters)
        }
      }
  ))
}

function Get-AllowedLocationsFromPolicyParameters {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $Parameters,

    [AllowNull()]
    [string] $TargetLocation,

    [AllowEmptyCollection()]
    [string[]] $KnownLocations = @()
  )

  return @(
    (Get-PolicyLocationEvaluation -Parameters $Parameters -TargetLocation $TargetLocation -KnownLocations $KnownLocations).allowedLocations
  )
}

function Get-NamingConflicts {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $TargetResourceGroupName
  )

  $query = "ResourceContainers | where type =~ 'microsoft.resources/subscriptions/resourcegroups' | where subscriptionId =~ '$SubscriptionId' | where name =~ '$TargetResourceGroupName' | project name, subscriptionId, location"

  $result = Invoke-AzJson -Arguments @('graph', 'query', '-q', $query)
  return @($result.data)
}

function Get-OpenAiAccounts {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId
  )

  $query = "Resources | where subscriptionId =~ '$SubscriptionId' | where type =~ 'microsoft.cognitiveservices/accounts' | extend kindText = tostring(kind) | where kindText =~ 'OpenAI' or kindText has 'OpenAI' | project id, name, resourceGroup, location, kind | order by location asc, name asc"

  $result = Invoke-AzJson -Arguments @('graph', 'query', '-q', $query)
  return @($result.data)
}

function Get-NormalizedListedModels {
  [CmdletBinding()]
  param(
    [AllowEmptyCollection()]
    [object[]] $ListedModels
  )

  return @(
    foreach ($model in @($ListedModels)) {
      $modelName = Get-FirstPopulatedValue -Values @(
        (Get-NestedPropertyValue -InputObject $model -Path @('name')),
        (Get-NestedPropertyValue -InputObject $model -Path @('modelName')),
        (Get-NestedPropertyValue -InputObject $model -Path @('model', 'name')),
        (Get-NestedPropertyValue -InputObject $model -Path @('properties', 'model', 'name')),
        (Get-NestedPropertyValue -InputObject $model -Path @('properties', 'modelName')),
        (Get-NestedPropertyValue -InputObject $model -Path @('id'))
      )
      if (-not $modelName) {
        continue
      }

      [pscustomobject]@{
        modelId = $modelName
        modelVersion = Get-NormalizedModelVersion -Version (Get-FirstPopulatedValue -Values @(
          (Get-NestedPropertyValue -InputObject $model -Path @('version')),
          (Get-NestedPropertyValue -InputObject $model -Path @('modelVersion')),
          (Get-NestedPropertyValue -InputObject $model -Path @('model', 'version')),
          (Get-NestedPropertyValue -InputObject $model -Path @('properties', 'version')),
          (Get-NestedPropertyValue -InputObject $model -Path @('properties', 'model', 'version'))
        ))
      }
    }
  )
}

function Find-QuotaRow {
  [CmdletBinding()]
  param(
    [AllowEmptyCollection()]
    [object[]] $QuotaRows,

    [Parameter(Mandatory)]
    [string] $QuotaName
  )

  foreach ($row in @($QuotaRows)) {
    $name = Get-FirstPopulatedValue -Values @(
      (Get-NestedPropertyValue -InputObject $row -Path @('name', 'value')),
      (Get-NestedPropertyValue -InputObject $row -Path @('name'))
    )
    if ($name -eq $QuotaName) {
      return $row
    }
  }

  return $null
}

function Test-OpenAiSkuAvailability {
  [CmdletBinding()]
  param(
    [AllowEmptyCollection()]
    [object[]] $Skus,

    [Parameter(Mandatory)]
    [string] $Location
  )

  $normalizedLocation = $Location.ToUpperInvariant()
  return [bool] @(
    $Skus |
      Where-Object {
        $_.name -eq 'S0' -and (
          @($_.locations) -contains $normalizedLocation -or
          @($_.locations) -contains $Location
        )
      }
  ).Count
}

function Get-OpenAiReadiness {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $SubscriptionId,

    [Parameter(Mandatory)]
    [string] $Location,

    [string] $OpenAiLocation = $Location,

    [Parameter(Mandatory)]
    [object[]] $RequiredModels
  )

  $blockingFindings = [System.Collections.Generic.List[string]]::new()
  $effectiveOpenAiLocation = if ([string]::IsNullOrWhiteSpace($OpenAiLocation)) {
    $Location
  }
  else {
    $OpenAiLocation
  }

  $openAiSkus = @()
  try {
    $openAiSkus = @(Invoke-AzJson -Arguments @('cognitiveservices', 'account', 'list-skus', '--kind', 'OpenAI', '--location', $effectiveOpenAiLocation))
  }
  catch {
    $blockingFindings.Add('AZURE_OPENAI_SKU_QUERY_FAILED')
  }

  $quotaRows = @()
  try {
    $quotaRows = @(Invoke-AzJson -Arguments @('cognitiveservices', 'usage', 'list', '--location', $effectiveOpenAiLocation))
  }
  catch {
    $blockingFindings.Add('AZURE_OPENAI_QUOTA_QUERY_FAILED')
  }

  $discoveredAccounts = @()
  try {
    $discoveredAccounts = @(Get-OpenAiAccounts -SubscriptionId $SubscriptionId)
  }
  catch {
    $blockingFindings.Add('AZURE_OPENAI_ACCOUNT_DISCOVERY_FAILED')
  }

  $normalizedLocation = Get-NormalizedLocationName -Location $effectiveOpenAiLocation
  $selectedAccount = @(
    $discoveredAccounts |
      Where-Object {
        (Get-NormalizedLocationName -Location (Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $_ -Path @('location'))))) -eq $normalizedLocation
      }
  ) | Select-Object -First 1

  $listedModels = @()
  if ($null -ne $selectedAccount) {
    try {
      $listedModels = @(Invoke-AzJson -Arguments @(
        'cognitiveservices',
        'account',
        'list-models',
        '--name',
        $selectedAccount.name,
        '--resource-group',
        $selectedAccount.resourceGroup
      ))
    }
    catch {
      $blockingFindings.Add('AZURE_OPENAI_MODEL_QUERY_FAILED')
    }
  }

  $normalizedModels = @(Get-NormalizedListedModels -ListedModels $listedModels)
  $openAiModels = @(
    foreach ($requiredModel in $RequiredModels) {
      $requiredVersion = Get-NormalizedModelVersion -Version $requiredModel.modelVersion
      $quotaRow = Find-QuotaRow -QuotaRows $quotaRows -QuotaName $requiredModel.quotaName
      $quotaLimit = if ($null -ne $quotaRow) { [double] $quotaRow.limit } else { $null }
      $quotaCurrentValue = if ($null -ne $quotaRow) { [double] $quotaRow.currentValue } else { $null }
      $requiredCapacityProperty = $requiredModel.PSObject.Properties['requiredCapacity']
      $requiredCapacity = if ($null -ne $requiredCapacityProperty) {
        [double] $requiredCapacityProperty.Value
      }
      else {
        1.0
      }
      $quotaAvailable = (
        $null -ne $quotaRow -and
        ($quotaLimit - $quotaCurrentValue) -ge $requiredCapacity
      )

      $modelCandidates = @(
        $normalizedModels |
          Where-Object { $_.modelId -eq $requiredModel.modelId }
      )

      $match = @(
        $modelCandidates |
          Where-Object {
            $requiredVersion -eq $null -or $_.modelVersion -eq $requiredVersion
          }
      ) | Select-Object -First 1

      $available = ($null -ne $match)
      $reason = if ($available -and $quotaAvailable) {
        'AVAILABLE'
      }
      elseif ($available) {
        'QUOTA_UNAVAILABLE'
      }
      elseif ($null -eq $selectedAccount) {
        'NO_OPENAI_ACCOUNT_AVAILABLE_FOR_LIST_MODELS'
      }
      elseif ($modelCandidates.Count -eq 0) {
        'MODEL_NOT_LISTED'
      }
      elseif ($requiredVersion -and @($modelCandidates | Where-Object { $null -eq $_.modelVersion }).Count -gt 0) {
        'MODEL_VERSION_UNKNOWN'
      }
      else {
        'MODEL_VERSION_MISMATCH'
      }

      [pscustomobject]@{
        route = $requiredModel.route
        modelId = $requiredModel.modelId
        requiredVersion = $requiredVersion
        discoveryAccountName = if ($null -ne $selectedAccount) { $selectedAccount.name } else { $null }
        discoveryAccountResourceGroup = if ($null -ne $selectedAccount) { $selectedAccount.resourceGroup } else { $null }
        available = $available
        quotaName = $requiredModel.quotaName
        quotaLimit = $quotaLimit
        quotaCurrentValue = $quotaCurrentValue
        quotaAvailable = $quotaAvailable
        requiredCapacity = $requiredCapacity
        reason = $reason
      }
    }
  )

  return [pscustomobject]@{
    skuAvailability = [pscustomobject]@{
      openAiAccountSkuAvailable = (Test-OpenAiSkuAvailability -Skus $openAiSkus -Location $effectiveOpenAiLocation)
      openAiAccountSkus = @($openAiSkus)
      quota = @(
        foreach ($requiredModel in $RequiredModels) {
          $quotaRow = Find-QuotaRow -QuotaRows $quotaRows -QuotaName $requiredModel.quotaName
          if ($null -ne $quotaRow) {
            [pscustomobject]@{
              name = Get-FirstPopulatedValue -Values @(
                (Get-NestedPropertyValue -InputObject $quotaRow -Path @('name', 'value')),
                (Get-NestedPropertyValue -InputObject $quotaRow -Path @('name'))
              )
              localized = Get-FirstPopulatedValue -Values @(
                (Get-NestedPropertyValue -InputObject $quotaRow -Path @('name', 'localizedValue')),
                (Get-NestedPropertyValue -InputObject $quotaRow -Path @('localized'))
              )
              currentValue = [double] $quotaRow.currentValue
              limit = [double] $quotaRow.limit
              unit = $quotaRow.unit
            }
          }
        }
      )
      discoveredOpenAiAccounts = @($discoveredAccounts)
    }
    openAiModels = $openAiModels
    blockingFindings = @($blockingFindings)
  }
}

function ConvertTo-PreflightResult {
  [CmdletBinding()]
  param(
    [string] $SubscriptionId = '',
    [string] $TenantId = '',
    [string] $Location = '',
    [string] $OpenAiLocation = $Location,
    [AllowEmptyCollection()]
    [object[]] $ResourceProviders = @(),
    [AllowEmptyCollection()]
    [object[]] $PolicyAssignments = @(),
    [AllowNull()]
    [object] $SkuAvailability = $null,
    [AllowEmptyCollection()]
    [object[]] $OpenAiModels = @(),
    [AllowEmptyCollection()]
    [string[]] $RequiredProviders = @(),
    [AllowEmptyCollection()]
    [object[]] $NamingConflicts = @(),
    [AllowEmptyCollection()]
    [string[]] $AdditionalBlockingFindings = @()
  )

  $blockingFindings = [System.Collections.Generic.List[string]]::new()
  $sanitizedPolicyAssignments = @(Get-SafePolicyAssignments -PolicyAssignments $PolicyAssignments)
  $normalizedLocation = Get-NormalizedLocationName -Location $Location
  $effectiveOpenAiLocation = if ([string]::IsNullOrWhiteSpace($OpenAiLocation)) {
    $Location
  }
  else {
    $OpenAiLocation
  }

  foreach ($providerNamespace in $RequiredProviders) {
    $provider = @($ResourceProviders | Where-Object namespace -eq $providerNamespace) | Select-Object -First 1
    if ($null -eq $provider -or $provider.registrationState -ne 'Registered') {
      $blockingFindings.Add("AZURE_PROVIDER_UNREGISTERED:$providerNamespace")
    }
  }

  foreach ($policyAssignment in $sanitizedPolicyAssignments) {
    $allowedLocations = @($policyAssignment.allowedLocations)
    if ($policyAssignment.locationEvidenceStatus -eq 'Indeterminate') {
      $blockingFindings.Add("AZURE_POLICY_LOCATION_INDETERMINATE:$($policyAssignment.name)")
      continue
    }

    if ($policyAssignment.locationEvidenceStatus -eq 'Denied') {
      $blockingFindings.Add("AZURE_POLICY_LOCATION_DENIED:$($policyAssignment.name)")
      continue
    }

    if ($allowedLocations.Count -gt 0 -and $allowedLocations -notcontains $normalizedLocation) {
      $blockingFindings.Add("AZURE_POLICY_LOCATION_DENIED:$($policyAssignment.name)")
    }
  }

  foreach ($conflict in @($NamingConflicts)) {
    $name = Get-FirstPopulatedValue -Values @(
      (Get-NestedPropertyValue -InputObject $conflict -Path @('name')),
      $conflict
    )
    if ($name) {
      $blockingFindings.Add("AZURE_RESOURCE_GROUP_NAME_CONFLICT:$name")
    }
  }

  if ($null -eq $SkuAvailability -or $SkuAvailability.openAiAccountSkuAvailable -ne $true) {
    $blockingFindings.Add('AZURE_OPENAI_SKU_UNAVAILABLE')
  }

  $openAiModels = @($OpenAiModels)
  $accountScopedModelDiscoveryDeferred = (
    $openAiModels.Count -gt 0 -and
    @($SkuAvailability.discoveredOpenAiAccounts).Count -eq 0 -and
    @(
      $openAiModels |
        Where-Object {
          $_.reason -cne 'NO_OPENAI_ACCOUNT_AVAILABLE_FOR_LIST_MODELS' -or
          $_.quotaAvailable -ne $true
        }
    ).Count -eq 0
  )
  if (
    $openAiModels.Count -eq 0 -or
    (
      @($openAiModels | Where-Object available -ne $true).Count -gt 0 -and
      -not $accountScopedModelDiscoveryDeferred
    )
  ) {
    $blockingFindings.Add('AZURE_OPENAI_MODEL_UNAVAILABLE')
  }

  if ($openAiModels.Count -eq 0 -or @($openAiModels | Where-Object quotaAvailable -ne $true).Count -gt 0) {
    $blockingFindings.Add('AZURE_OPENAI_QUOTA_UNAVAILABLE')
  }

  foreach ($finding in @($AdditionalBlockingFindings)) {
    if (-not [string]::IsNullOrWhiteSpace($finding)) {
      $blockingFindings.Add($finding)
    }
  }

  return [pscustomobject]@{
    subscriptionId = $SubscriptionId
    tenantId = $TenantId
    location = $Location
    openAiLocation = $effectiveOpenAiLocation
    resourceProviders = @($ResourceProviders)
    policyAssignments = $sanitizedPolicyAssignments
    skuAvailability = if ($null -ne $SkuAvailability) { $SkuAvailability } else { [pscustomobject]@{} }
    openAiModels = @($OpenAiModels)
    namingConflicts = @($NamingConflicts)
    blockingFindings = @($blockingFindings | Select-Object -Unique)
  }
}

function Invoke-StrattonAzurePreflight {
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

    [string] $OpenAiLocation = $Location,

    [string] $TargetResourceGroupName = 'stratton-demo-rg'
  )

  Assert-AzContext -SubscriptionId $SubscriptionId -TenantId $TenantId -ExpectedUser $ExpectedUser

  $requiredProviders = Get-RequiredProviderNamespaces
  $requiredOpenAiModels = Get-RequiredOpenAiModels
  $additionalBlockingFindings = [System.Collections.Generic.List[string]]::new()

  $resourceProviders = @()
  try {
    $resourceProviders = @(Get-ProviderReadiness -RequiredProviders $requiredProviders)
  }
  catch {
    $additionalBlockingFindings.Add('AZURE_PROVIDER_QUERY_FAILED')
  }

  $policyAssignments = @()
  try {
    $policyAssignments = @(Get-PolicyAssignments -SubscriptionId $SubscriptionId -TargetLocation $Location)
  }
  catch {
    $additionalBlockingFindings.Add('AZURE_POLICY_QUERY_FAILED')
  }

  $namingConflicts = @()
  try {
    $namingConflicts = @(Get-NamingConflicts -SubscriptionId $SubscriptionId -TargetResourceGroupName $TargetResourceGroupName)
  }
  catch {
    $additionalBlockingFindings.Add('AZURE_NAMING_QUERY_FAILED')
  }

  $openAiReadiness = [pscustomobject]@{
    skuAvailability = [pscustomobject]@{
      openAiAccountSkuAvailable = $false
      openAiAccountSkus = @()
      quota = @()
      discoveredOpenAiAccounts = @()
    }
    openAiModels = @(
      $requiredOpenAiModels |
        ForEach-Object {
          [pscustomobject]@{
            route = $_.route
            modelId = $_.modelId
            requiredVersion = $_.modelVersion
            discoveryAccountName = $null
            discoveryAccountResourceGroup = $null
            available = $false
            quotaName = $_.quotaName
            quotaLimit = $null
            quotaCurrentValue = $null
            quotaAvailable = $false
            requiredCapacity = $_.requiredCapacity
            reason = 'MODEL_DISCOVERY_NOT_RUN'
          }
        }
    )
    blockingFindings = @()
  }

  try {
    $openAiReadiness = Get-OpenAiReadiness `
      -SubscriptionId $SubscriptionId `
      -Location $Location `
      -OpenAiLocation $OpenAiLocation `
      -RequiredModels $requiredOpenAiModels
  }
  catch {
    $additionalBlockingFindings.Add('AZURE_OPENAI_READINESS_QUERY_FAILED')
  }

  foreach ($finding in @($openAiReadiness.blockingFindings)) {
    $additionalBlockingFindings.Add($finding)
  }

  return ConvertTo-PreflightResult `
    -SubscriptionId $SubscriptionId `
    -TenantId $TenantId `
    -Location $Location `
    -OpenAiLocation $OpenAiLocation `
    -ResourceProviders $resourceProviders `
    -PolicyAssignments $policyAssignments `
    -SkuAvailability $openAiReadiness.skuAvailability `
    -OpenAiModels $openAiReadiness.openAiModels `
    -RequiredProviders $requiredProviders `
    -NamingConflicts $namingConflicts `
    -AdditionalBlockingFindings @($additionalBlockingFindings)
}

function Test-ImageDigest {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [string] $Digest
  )

  if ([string]::IsNullOrWhiteSpace($Digest)) {
    return $false
  }

  return ($Digest -cmatch '^sha256:[a-f0-9]{64}$')
}

function Get-StrattonImageBuildDefinitions {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $DemoPlatformRoot
  )

  $resolvedDemoPlatformRoot = (Resolve-Path -LiteralPath $DemoPlatformRoot).Path
  $worktreeRoot = (Resolve-Path -LiteralPath (Join-Path $resolvedDemoPlatformRoot '..')).Path
  $phase5AppRoot = (Resolve-Path -LiteralPath (Join-Path $worktreeRoot '5-coding-r4\app')).Path

  return @(
    [pscustomobject]@{
      repository = 'stratton/demo-web'
      dockerfileRelativePath = 'apps\web\Dockerfile'
      sourceContextPath = $resolvedDemoPlatformRoot
    },
    [pscustomobject]@{
      repository = 'stratton/demo-bff'
      dockerfileRelativePath = 'apps\bff\Dockerfile'
      sourceContextPath = $resolvedDemoPlatformRoot
    },
    [pscustomobject]@{
      repository = 'stratton/phase5-api'
      dockerfileRelativePath = 'Dockerfile.api'
      sourceContextPath = $phase5AppRoot
    }
  )
}

function New-TemporaryImageTag {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Repository,

    [Parameter(Mandatory)]
    [string] $CommitSha
  )

  if ($CommitSha -notmatch '^[0-9a-fA-F]{8,40}$') {
    throw 'INVALID_COMMIT_SHA'
  }

  $shortCommitSha = $CommitSha.Substring(0, 8).ToLowerInvariant()
  $repositoryToken = ($Repository.Split('/')[-1] -replace '[^a-zA-Z0-9-]', '-').ToLowerInvariant()
  $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $uniquenessSuffix = [Guid]::NewGuid().ToString('N').Substring(0, 8).ToLowerInvariant()

  return "dev-$timestamp-$shortCommitSha-$repositoryToken-$uniquenessSuffix"
}

function Get-AcrBuildRunId {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $BuildResult,

    [Parameter(Mandatory)]
    [string] $Repository
  )

  $candidates = [System.Collections.Generic.List[string]]::new()
  foreach ($candidate in @(
      (Get-NestedPropertyValue -InputObject $BuildResult -Path @('runId')),
      (Get-NestedPropertyValue -InputObject $BuildResult -Path @('name'))
    )) {
    if (-not [string]::IsNullOrWhiteSpace([string] $candidate)) {
      $candidates.Add([string] $candidate)
    }
  }

  $resourceId = Get-FirstPopulatedValue -Values @((Get-NestedPropertyValue -InputObject $BuildResult -Path @('id')))
  if (-not [string]::IsNullOrWhiteSpace($resourceId)) {
    $resourceIdTail = ($resourceId -split '/')[-1]
    if (-not [string]::IsNullOrWhiteSpace($resourceIdTail)) {
      $candidates.Add($resourceIdTail)
    }
  }

  $distinctCandidates = @(
    $candidates |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )

  if ($distinctCandidates.Count -ne 1) {
    throw "AMBIGUOUS_IMAGE_BUILD_ID:${Repository}"
  }

  return $distinctCandidates[0]
}

function Get-AcrRunStatus {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $RunStatusResult,

    [Parameter(Mandatory)]
    [string] $Repository,

    [Parameter(Mandatory)]
    [string] $BuildId
  )

  $distinctStatuses = @(
    @(
      (Get-NestedPropertyValue -InputObject $RunStatusResult -Path @('status')),
      (Get-NestedPropertyValue -InputObject $RunStatusResult -Path @('runStatus')),
      (Get-NestedPropertyValue -InputObject $RunStatusResult -Path @('properties', 'status')),
      (Get-NestedPropertyValue -InputObject $RunStatusResult -Path @('properties', 'runStatus'))
    ) |
      Where-Object { -not [string]::IsNullOrWhiteSpace([string] $_) } |
      ForEach-Object { [string] $_ } |
      Select-Object -Unique
  )

  if ($distinctStatuses.Count -ne 1) {
    throw "AMBIGUOUS_IMAGE_BUILD_STATUS:${Repository}:${BuildId}"
  }

  return $distinctStatuses[0]
}

function Get-AcrImageDigest {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $DigestResult,

    [Parameter(Mandatory)]
    [string] $Repository
  )

  $digestCandidates = [System.Collections.Generic.List[string]]::new()

  foreach ($candidate in @(
      $DigestResult,
      (Get-NestedPropertyValue -InputObject $DigestResult -Path @('digest')),
      (Get-NestedPropertyValue -InputObject $DigestResult -Path @('value'))
    )) {
    if ($null -eq $candidate) {
      continue
    }

    foreach ($item in @($candidate)) {
      if (-not [string]::IsNullOrWhiteSpace([string] $item)) {
        $digestCandidates.Add([string] $item)
      }
    }
  }

  $distinctDigests = @(
    $digestCandidates |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )

  if ($distinctDigests.Count -ne 1) {
    throw "AMBIGUOUS_IMAGE_DIGEST:${Repository}"
  }

  if (-not (Test-ImageDigest -Digest $distinctDigests[0])) {
    throw "INVALID_IMAGE_DIGEST:${Repository}"
  }

  return $distinctDigests[0]
}

function New-StrattonAcrBuildArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $RegistryName,

    [Parameter(Mandatory)]
    [string] $Repository,

    [Parameter(Mandatory)]
    [string] $BuildTag,

    [Parameter(Mandatory)]
    [string] $DockerfileRelativePath
  )

  return @(
    'acr', 'build',
    '--registry', $RegistryName,
    '--image', "${Repository}:$BuildTag",
    '--file', $DockerfileRelativePath,
    '--no-wait',
    '.'
  )
}

function ConvertFrom-StrattonAcrBuildQueueOutput {
  [CmdletBinding()]
  param(
    [AllowEmptyCollection()]
    [AllowNull()]
    [object[]] $Output,

    [Parameter(Mandatory)]
    [string] $Repository
  )

  $runIds = @(
    foreach ($line in @($Output)) {
      $text = [string] $line
      if ($text -match '^WARNING:\s+Queued a build with ID:\s*(?<runId>[A-Za-z0-9][A-Za-z0-9._-]*)\s*$') {
        $Matches.runId
      }
    }
  )
  if ($runIds.Count -ne 1) {
    throw "AMBIGUOUS_IMAGE_BUILD_ID:${Repository}"
  }

  return [pscustomobject]@{
    runId = $runIds[0]
  }
}

function Invoke-StrattonAcrBuildQueue {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string[]] $Arguments,

    [Parameter(Mandatory)]
    [string] $Repository
  )

  $output = & az @Arguments 2>&1
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "AZURE_CLI_FAILED:$($Arguments -join ' '):$($output | Out-String)"
  }

  return ConvertFrom-StrattonAcrBuildQueueOutput -Output @($output) -Repository $Repository
}

function Invoke-StrattonImageBuilds {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $RegistryName,

    [Parameter(Mandatory)]
    [string] $CommitSha,

    [string] $DemoPlatformRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path,

    [string] $OutFile = (Join-Path $PSScriptRoot '..\..\artifacts\deployment\images.json'),

    [ValidateRange(0, 3600)]
    [int] $PollIntervalSeconds = 5,

    [ValidateRange(1, 3600)]
    [int] $MaxPollAttempts = 120,

    [scriptblock] $BuildInvoker,

    [scriptblock] $RunStatusInvoker,

    [scriptblock] $DigestInvoker
  )

  if ([string]::IsNullOrWhiteSpace($RegistryName)) {
    throw 'REGISTRY_NAME_REQUIRED'
  }

  if (-not $BuildInvoker) {
    $BuildInvoker = {
      param($Definition, $ResolvedRegistryName, $BuildTag)

      Push-Location -LiteralPath $Definition.sourceContextPath
      try {
        Invoke-StrattonAcrBuildQueue `
          -Arguments (New-StrattonAcrBuildArguments `
            -RegistryName $ResolvedRegistryName `
            -Repository $Definition.repository `
            -BuildTag $BuildTag `
            -DockerfileRelativePath $Definition.dockerfileRelativePath) `
          -Repository $Definition.repository
      }
      finally {
        Pop-Location
      }
    }
  }

  if (-not $RunStatusInvoker) {
    $RunStatusInvoker = {
      param($ResolvedRegistryName, $BuildId, $Definition)

      Invoke-AzJson -Arguments @(
        'acr', 'task', 'show-run',
        '--registry', $ResolvedRegistryName,
        '--run-id', $BuildId
      )
    }
  }

  if (-not $DigestInvoker) {
    $DigestInvoker = {
      param($ResolvedRegistryName, $Repository, $BuildTag, $Definition)

      Invoke-AzJson -Arguments @(
        'acr', 'repository', 'show',
        '--name', $ResolvedRegistryName,
        '--image', "$Repository`:$BuildTag",
        '--query', 'digest'
      )
    }
  }

  $terminalStatuses = @('Succeeded', 'Failed', 'Error', 'Canceled', 'Cancelled')
  $definitions = @(Get-StrattonImageBuildDefinitions -DemoPlatformRoot $DemoPlatformRoot)
  $images = foreach ($definition in $definitions) {
    $buildTag = New-TemporaryImageTag -Repository $definition.repository -CommitSha $CommitSha
    $buildResult = & $BuildInvoker $definition $RegistryName $buildTag
    $buildId = Get-AcrBuildRunId -BuildResult $buildResult -Repository $definition.repository

    $terminalStatus = $null
    for ($attempt = 1; $attempt -le $MaxPollAttempts; $attempt++) {
      $runStatus = & $RunStatusInvoker $RegistryName $buildId $definition
      $currentStatus = Get-AcrRunStatus `
        -RunStatusResult $runStatus `
        -Repository $definition.repository `
        -BuildId $buildId

      if ($terminalStatuses -contains $currentStatus) {
        $terminalStatus = $currentStatus
        break
      }

      if ($attempt -lt $MaxPollAttempts -and $PollIntervalSeconds -gt 0) {
        Start-Sleep -Seconds $PollIntervalSeconds
      }
    }

    if (-not $terminalStatus) {
      throw "IMAGE_BUILD_STATUS_INDETERMINATE:$($definition.repository):${buildId}"
    }

    if ($terminalStatus -ne 'Succeeded') {
      throw "IMAGE_BUILD_FAILED:$($definition.repository):${buildId}:${terminalStatus}"
    }

    $digest = Get-AcrImageDigest `
      -DigestResult (& $DigestInvoker $RegistryName $definition.repository $buildTag $definition) `
      -Repository $definition.repository

    [pscustomobject]@{
      repository = $definition.repository
      buildId = $buildId
      digest = $digest
    }
  }

  $artifact = [pscustomobject]@{
    registryName = $RegistryName
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    images = @($images)
  }

  Write-DeploymentArtifact -Path $OutFile -InputObject $artifact
  return $artifact
}

function Get-StrattonMigrationFiles {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $RepositoryRoot
  )

  $resolvedRepositoryRoot = (Resolve-Path -LiteralPath $RepositoryRoot).Path
  $worktreeRoot = (Resolve-Path -LiteralPath (Join-Path $resolvedRepositoryRoot '..')).Path
  $migrationPaths = @(
    [pscustomobject]@{
      Name = '001_init.sql'
      Path = Join-Path $worktreeRoot '5-coding-r4\app\migrations\001_init.sql'
    },
    [pscustomobject]@{
      Name = '002_demo_authority.sql'
      Path = Join-Path $worktreeRoot '5-coding-r4\app\migrations\002_demo_authority.sql'
    },
    [pscustomobject]@{
      Name = 'demo-projection.sql'
      Path = Join-Path $resolvedRepositoryRoot 'apps\bff\migrations\001_demo_projection.sql'
    }
  )

  return @(
    foreach ($migration in $migrationPaths) {
      if (-not (Test-Path -LiteralPath $migration.Path -PathType Leaf)) {
        throw "MIGRATION_FILE_MISSING:$($migration.Name)"
      }
      [pscustomobject]@{
        Name = $migration.Name
        Path = (Resolve-Path -LiteralPath $migration.Path).Path
        Sha256 = (Get-FileHash -LiteralPath $migration.Path -Algorithm SHA256).Hash.ToLowerInvariant()
      }
    }
  )
}

function Get-StrattonBootstrapImageBuildDefinition {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $DemoPlatformRoot
  )

  $resolvedDemoPlatformRoot = (Resolve-Path -LiteralPath $DemoPlatformRoot).Path
  $worktreeRoot = (Resolve-Path -LiteralPath (Join-Path $resolvedDemoPlatformRoot '..')).Path
  $phase5AppRoot = (Resolve-Path -LiteralPath (Join-Path $worktreeRoot '5-coding-r4\app')).Path

  return [pscustomobject]@{
    repository = 'stratton/bootstrap'
    dockerfileRelativePath = 'Dockerfile.bootstrap'
    sourceContextPath = $phase5AppRoot
  }
}

function Invoke-StrattonBootstrapImageBuild {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $RegistryName,

    [Parameter(Mandatory)]
    [string] $CommitSha,

    [string] $DemoPlatformRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path,

    [string] $OutFile = (Join-Path $PSScriptRoot '..\..\artifacts\deployment\images.json'),

    [ValidateRange(0, 3600)]
    [int] $PollIntervalSeconds = 5,

    [ValidateRange(1, 3600)]
    [int] $MaxPollAttempts = 120,

    [scriptblock] $BuildInvoker,

    [scriptblock] $RunStatusInvoker,

    [scriptblock] $DigestInvoker
  )

  if ([string]::IsNullOrWhiteSpace($RegistryName)) {
    throw 'REGISTRY_NAME_REQUIRED'
  }

  $definition = Get-StrattonBootstrapImageBuildDefinition -DemoPlatformRoot $DemoPlatformRoot
  if (-not $BuildInvoker) {
    $BuildInvoker = {
      param($Definition, $ResolvedRegistryName, $BuildTag)

      Push-Location -LiteralPath $Definition.sourceContextPath
      try {
        Invoke-StrattonAcrBuildQueue `
          -Arguments (New-StrattonAcrBuildArguments `
            -RegistryName $ResolvedRegistryName `
            -Repository $Definition.repository `
            -BuildTag $BuildTag `
            -DockerfileRelativePath $Definition.dockerfileRelativePath) `
          -Repository $Definition.repository
      }
      finally {
        Pop-Location
      }
    }
  }

  if (-not $RunStatusInvoker) {
    $RunStatusInvoker = {
      param($ResolvedRegistryName, $BuildId, $Definition)

      Invoke-AzJson -Arguments @(
        'acr', 'task', 'show-run',
        '--registry', $ResolvedRegistryName,
        '--run-id', $BuildId
      )
    }
  }

  if (-not $DigestInvoker) {
    $DigestInvoker = {
      param($ResolvedRegistryName, $Repository, $BuildTag, $Definition)

      Invoke-AzJson -Arguments @(
        'acr', 'repository', 'show',
        '--name', $ResolvedRegistryName,
        '--image', "$Repository`:$BuildTag",
        '--query', 'digest'
      )
    }
  }

  $buildTag = New-TemporaryImageTag -Repository $definition.repository -CommitSha $CommitSha
  $buildResult = & $BuildInvoker $definition $RegistryName $buildTag
  $buildId = Get-AcrBuildRunId -BuildResult $buildResult -Repository $definition.repository
  $terminalStatuses = @('Succeeded', 'Failed', 'Error', 'Canceled', 'Cancelled')
  $terminalStatus = $null
  for ($attempt = 1; $attempt -le $MaxPollAttempts; $attempt++) {
    $runStatus = & $RunStatusInvoker $RegistryName $buildId $definition
    $currentStatus = Get-AcrRunStatus `
      -RunStatusResult $runStatus `
      -Repository $definition.repository `
      -BuildId $buildId

    if ($terminalStatuses -contains $currentStatus) {
      $terminalStatus = $currentStatus
      break
    }

    if ($attempt -lt $MaxPollAttempts -and $PollIntervalSeconds -gt 0) {
      Start-Sleep -Seconds $PollIntervalSeconds
    }
  }

  if (-not $terminalStatus) {
    throw "IMAGE_BUILD_STATUS_INDETERMINATE:$($definition.repository):${buildId}"
  }
  if ($terminalStatus -ne 'Succeeded') {
    throw "IMAGE_BUILD_FAILED:$($definition.repository):${buildId}:${terminalStatus}"
  }

  $digest = Get-AcrImageDigest `
    -DigestResult (& $DigestInvoker $RegistryName $definition.repository $buildTag $definition) `
    -Repository $definition.repository

  $existingImages = @()
  if (Test-Path -LiteralPath $OutFile -PathType Leaf) {
    $existingArtifact = Get-Content -LiteralPath $OutFile -Raw | ConvertFrom-Json -Depth 50
    if (
      $existingArtifact.registryName -and
      $existingArtifact.registryName -ne $RegistryName
    ) {
      throw 'IMAGE_ARTIFACT_REGISTRY_MISMATCH'
    }
    $existingImages = @($existingArtifact.images | Where-Object repository -ne $definition.repository)
  }

  $artifact = [pscustomobject]@{
    registryName = $RegistryName
    generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
    images = @(
      $existingImages + [pscustomobject]@{
        repository = $definition.repository
        buildId = $buildId
        digest = $digest
      }
    )
  }
  Write-DeploymentArtifact -Path $OutFile -InputObject $artifact
  return $artifact
}

function Get-StrattonUtcTimestampLiteral {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [datetimeoffset] $Value
  )

  return $Value.ToUniversalTime().UtcDateTime.ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')
}

function Assert-StrattonKustoLiteralSafe {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [AllowEmptyString()]
    [string] $Value,

    [Parameter(Mandatory)]
    [string] $Name
  )

  if ($Value -cnotmatch '^[A-Za-z0-9._:\-]{1,256}$') {
    throw "KUSTO_LITERAL_UNSAFE:$Name"
  }

  return $Value
}

function New-StrattonJobReceiptKustoQuery {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ExecutionName,

    [Parameter(Mandatory)]
    [string] $ContainerName,

    [Parameter(Mandatory)]
    [string] $ReceiptMarker,

    [Parameter(Mandatory)]
    [datetimeoffset] $WindowStart,

    [Parameter(Mandatory)]
    [datetimeoffset] $WindowEnd
  )

  $job = Assert-StrattonKustoLiteralSafe -Value $JobName -Name 'JobName'
  $execution = Assert-StrattonKustoLiteralSafe -Value $ExecutionName -Name 'ExecutionName'
  $container = Assert-StrattonKustoLiteralSafe -Value $ContainerName -Name 'ContainerName'
  $marker = Assert-StrattonKustoLiteralSafe -Value $ReceiptMarker -Name 'ReceiptMarker'
  $start = Get-StrattonUtcTimestampLiteral -Value $WindowStart
  $end = Get-StrattonUtcTimestampLiteral -Value $WindowEnd

  return (@(
      'union isfuzzy=true ContainerAppConsoleLogs, ContainerAppConsoleLogs_CL',
      '| extend StrattonJob = tostring(coalesce(column_ifexists("ContainerAppName", ""), column_ifexists("ContainerAppName_s", ""))),',
      'StrattonExecution = tostring(coalesce(column_ifexists("ExecutionName", ""), column_ifexists("ExecutionName_s", ""), column_ifexists("JobName", ""), column_ifexists("JobName_s", ""))),',
      'StrattonReplica = tostring(coalesce(column_ifexists("ContainerGroupName", ""), column_ifexists("ContainerGroupName_g", ""), column_ifexists("ContainerGroupName_s", ""))),',
      'StrattonContainer = tostring(coalesce(column_ifexists("ContainerName", ""), column_ifexists("ContainerName_s", ""))),',
      'StrattonLog = tostring(coalesce(column_ifexists("Log", ""), column_ifexists("Log_s", "")))',
      "| where TimeGenerated between (datetime($start) .. datetime($end))",
      "| where StrattonJob == '$job'",
      "| where StrattonExecution == '$execution' or StrattonReplica startswith '$execution'",
      "| where StrattonContainer == '$container'",
      "| where StrattonLog contains '$marker'",
      '| project TimeGenerated, Log = StrattonLog',
      '| order by TimeGenerated asc'
    ) -join ' ')
}

function New-StrattonLogAnalyticsQueryBody {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Query,

    [Parameter(Mandatory)]
    [datetimeoffset] $WindowStart,

    [Parameter(Mandatory)]
    [datetimeoffset] $WindowEnd
  )

  return [ordered]@{
    query = $Query
    timespan = '{0}/{1}' -f
      (Get-StrattonUtcTimestampLiteral -Value $WindowStart),
      (Get-StrattonUtcTimestampLiteral -Value $WindowEnd)
  }
}

function New-StrattonTemporaryJsonFile {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Directory,

    [Parameter(Mandatory)]
    [object] $InputObject,

    [string] $Prefix = '.stratton-request'
  )

  New-Item -ItemType Directory -Path $Directory -Force | Out-Null
  $path = Join-Path $Directory "$Prefix.$([System.Guid]::NewGuid().ToString('N')).json"
  [System.IO.File]::WriteAllText(
    $path,
    ($InputObject | ConvertTo-Json -Depth 20),
    [System.Text.UTF8Encoding]::new($false)
  )
  return $path
}

function New-StrattonLogAnalyticsWorkspaceRestArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $WorkspaceResourceId,

    [string] $SubscriptionId
  )

  if (
    $WorkspaceResourceId -notmatch
    '^/subscriptions/[^/?#\s]+/resourceGroups/[^/?#\s]+/providers/Microsoft\.OperationalInsights/workspaces/[^/?#\s]+$'
  ) {
    throw 'LOG_ANALYTICS_WORKSPACE_RESOURCE_ID_INVALID'
  }

  $arguments = @(
    'rest',
    '--method', 'get',
    '--url', "$($WorkspaceResourceId)?api-version=$($script:LogAnalyticsWorkspaceApiVersion)"
  )
  if (-not [string]::IsNullOrWhiteSpace($SubscriptionId)) {
    $arguments += @('--subscription', $SubscriptionId)
  }
  return $arguments
}

function New-StrattonLogAnalyticsQueryRestArguments {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $WorkspaceCustomerId,

    [Parameter(Mandatory)]
    [string] $BodyFilePath,

    [string] $SubscriptionId
  )

  if ($WorkspaceCustomerId -cnotmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$') {
    throw 'LOG_ANALYTICS_WORKSPACE_INVALID'
  }

  $arguments = @(
    'rest',
    '--method', 'post',
    '--url', "$script:LogAnalyticsQueryResource/v1/workspaces/$WorkspaceCustomerId/query",
    '--resource', $script:LogAnalyticsQueryResource,
    '--headers', 'Content-Type=application/json',
    '--body', "@$BodyFilePath"
  )
  if (-not [string]::IsNullOrWhiteSpace($SubscriptionId)) {
    $arguments += @('--subscription', $SubscriptionId)
  }
  return $arguments
}

function Get-StrattonLogAnalyticsWorkspaceCustomerId {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $WorkspaceResourceId,

    [Parameter(Mandatory)]
    [scriptblock] $AzInvoker,

    [string] $SubscriptionId
  )

  $workspace = & $AzInvoker (
    New-StrattonLogAnalyticsWorkspaceRestArguments `
      -WorkspaceResourceId $WorkspaceResourceId `
      -SubscriptionId $SubscriptionId
  )
  $customerIds = @(
    @(
      Get-NestedPropertyValue -InputObject $workspace -Path @('properties', 'customerId')
      Get-NestedPropertyValue -InputObject $workspace -Path @('customerId')
    ) |
      Where-Object { $_ -is [string] -and -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -Unique
  )
  if (
    $customerIds.Count -ne 1 -or
    [string] $customerIds[0] -cnotmatch '^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$'
  ) {
    throw 'LOG_ANALYTICS_WORKSPACE_INVALID'
  }
  return [string] $customerIds[0]
}

function ConvertFrom-StrattonLogAnalyticsQueryResponse {
  [CmdletBinding()]
  param(
    [AllowNull()]
    [object] $Response,

    [string] $ColumnName = 'Log'
  )

  if ($null -eq $Response) {
    throw 'LOG_ANALYTICS_RESPONSE_INVALID'
  }
  $tables = @(Get-NestedPropertyValue -InputObject $Response -Path @('tables'))
  if ($tables.Count -eq 0) {
    throw 'LOG_ANALYTICS_RESPONSE_INVALID'
  }

  $values = [System.Collections.Generic.List[string]]::new()
  $columnFound = $false
  foreach ($table in $tables) {
    $columns = @(Get-NestedPropertyValue -InputObject $table -Path @('columns'))
    if ($columns.Count -eq 0) {
      throw 'LOG_ANALYTICS_RESPONSE_INVALID'
    }
    $columnNames = @(
      $columns |
        ForEach-Object { [string] (Get-NestedPropertyValue -InputObject $_ -Path @('name')) }
    )
    $columnIndex = [array]::IndexOf($columnNames, $ColumnName)
    if ($columnIndex -lt 0) {
      continue
    }
    $columnFound = $true
    foreach ($row in @(Get-NestedPropertyValue -InputObject $table -Path @('rows'))) {
      if ($row -is [string] -or $row -isnot [System.Collections.IEnumerable]) {
        throw 'LOG_ANALYTICS_RESPONSE_INVALID'
      }
      $cells = @($row)
      if ($cells.Count -ne $columnNames.Count) {
        throw 'LOG_ANALYTICS_RESPONSE_INVALID'
      }
      $value = [string] $cells[$columnIndex]
      if (-not [string]::IsNullOrWhiteSpace($value)) {
        $values.Add($value)
      }
    }
  }
  if (-not $columnFound) {
    throw 'LOG_ANALYTICS_RESPONSE_INVALID'
  }
  return @($values)
}

function Get-StrattonDurableJobReceipt {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $JobName,

    [Parameter(Mandatory)]
    [string] $ExecutionName,

    [Parameter(Mandatory)]
    [string] $ContainerName,

    [Parameter(Mandatory)]
    [string] $ReceiptMarker,

    [Parameter(Mandatory)]
    [string] $WorkspaceResourceId,

    [Parameter(Mandatory)]
    [string[]] $LogArguments,

    [Parameter(Mandatory)]
    [datetimeoffset] $InvocationStartedAt,

    [Parameter(Mandatory)]
    [scriptblock] $ReceiptParser,

    [hashtable] $ReceiptParserState = @{},

    [Parameter(Mandatory)]
    [string[]] $RetryableErrorMessages,

    [Parameter(Mandatory)]
    [string] $MissingReceiptError,

    [Parameter(Mandatory)]
    [string] $QueryFailedError,

    [Parameter(Mandatory)]
    [scriptblock] $AzInvoker,

    [Parameter(Mandatory)]
    [scriptblock] $LogInvoker,

    [string] $SubscriptionId,

    [string] $TemporaryDirectory,

    [ValidateRange(1, 10)]
    [int] $LiveLogMaxAttempts = 3,

    [ValidateRange(1, 10)]
    [int] $LogAnalyticsMaxAttempts = 3,

    [ValidateRange(0, 30)]
    [int] $RetryIntervalSeconds = 2,

    [scriptblock] $NowProvider
  )

  if (-not $NowProvider) {
    $NowProvider = { [datetimeoffset]::UtcNow }
  }
  if ([string]::IsNullOrWhiteSpace($TemporaryDirectory)) {
    $TemporaryDirectory = $script:DeploymentArtifactRoot
  }

  for ($attempt = 1; $attempt -le $LiveLogMaxAttempts; $attempt++) {
    try {
      $rawLog = & $LogInvoker $LogArguments
      return & $ReceiptParser `
        ([string] ($rawLog | Out-String)) `
        ([datetimeoffset] (& $NowProvider)) `
        $ReceiptParserState
    }
    catch {
      if ($_.Exception.Message -notin $RetryableErrorMessages) {
        throw
      }
    }
    if ($attempt -lt $LiveLogMaxAttempts -and $RetryIntervalSeconds -gt 0) {
      Start-Sleep -Seconds $RetryIntervalSeconds
    }
  }

  $workspaceCustomerId = Get-StrattonLogAnalyticsWorkspaceCustomerId `
    -WorkspaceResourceId $WorkspaceResourceId `
    -SubscriptionId $SubscriptionId `
    -AzInvoker $AzInvoker

  $queryFailed = $false
  for ($attempt = 1; $attempt -le $LogAnalyticsMaxAttempts; $attempt++) {
    $now = [datetimeoffset] (& $NowProvider)
    $windowStart = $InvocationStartedAt.AddMinutes(-1)
    $windowEnd = $now.AddMinutes(1)
    $bodyFilePath = $null
    try {
      $bodyFilePath = New-StrattonTemporaryJsonFile `
        -Directory $TemporaryDirectory `
        -Prefix $script:LogAnalyticsRequestFilePrefix `
        -InputObject (
          New-StrattonLogAnalyticsQueryBody `
            -Query (
              New-StrattonJobReceiptKustoQuery `
                -JobName $JobName `
                -ExecutionName $ExecutionName `
                -ContainerName $ContainerName `
                -ReceiptMarker $ReceiptMarker `
                -WindowStart $windowStart `
                -WindowEnd $windowEnd
            ) `
            -WindowStart $windowStart `
            -WindowEnd $windowEnd
        )
      $response = & $AzInvoker (
        New-StrattonLogAnalyticsQueryRestArguments `
          -WorkspaceCustomerId $workspaceCustomerId `
          -BodyFilePath $bodyFilePath `
          -SubscriptionId $SubscriptionId
      )
      $rawLog = (ConvertFrom-StrattonLogAnalyticsQueryResponse -Response $response) -join "`n"
      return & $ReceiptParser ([string] $rawLog) $now $ReceiptParserState
    }
    catch {
      if ($_.Exception.Message -in $RetryableErrorMessages) {
        $queryFailed = $false
      }
      elseif (
        $_.Exception.Message -eq 'LOG_ANALYTICS_RESPONSE_INVALID' -or
        $_.Exception.Message -match '^AZURE_CLI_FAILED:'
      ) {
        $queryFailed = $true
      }
      else {
        throw
      }
    }
    finally {
      if (
        -not [string]::IsNullOrWhiteSpace($bodyFilePath) -and
        (Test-Path -LiteralPath $bodyFilePath)
      ) {
        Remove-Item -LiteralPath $bodyFilePath -Force -ErrorAction SilentlyContinue
      }
    }
    if ($attempt -lt $LogAnalyticsMaxAttempts -and $RetryIntervalSeconds -gt 0) {
      Start-Sleep -Seconds $RetryIntervalSeconds
    }
  }

  if ($queryFailed) {
    throw $QueryFailedError
  }
  throw $MissingReceiptError
}

function Write-DeploymentArtifact {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Path,

    [Parameter(Mandatory)]
    [object] $InputObject
  )

  $resolvedPath = [System.IO.Path]::GetFullPath($Path)
  $directory = Split-Path -Path $resolvedPath -Parent
  if ([string]::IsNullOrWhiteSpace($directory)) {
    $directory = (Get-Location).Path
  }

  New-Item -ItemType Directory -Path $directory -Force | Out-Null

  $fileName = [System.IO.Path]::GetFileName($resolvedPath)
  $temporaryPath = Join-Path $directory ".$fileName.$([System.Guid]::NewGuid().ToString('N')).tmp"
  $json = $InputObject | ConvertTo-Json -Depth 50
  $stream = $null
  $writer = $null

  try {
    $stream = [System.IO.FileStream]::new(
      $temporaryPath,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    $writer = [System.IO.StreamWriter]::new($stream, [System.Text.UTF8Encoding]::new($false))
    $writer.Write($json)
    $writer.Flush()
    $stream.Flush($true)
    $writer.Dispose()
    $writer = $null
    $stream.Dispose()
    $stream = $null

    if (Test-Path -LiteralPath $resolvedPath) {
      [System.IO.File]::Move($temporaryPath, $resolvedPath, $true)
    }
    else {
      [System.IO.File]::Move($temporaryPath, $resolvedPath)
    }
  }
  catch {
    if ($null -ne $writer) {
      $writer.Dispose()
    }

    if ($null -ne $stream) {
      $stream.Dispose()
    }

    if (Test-Path -LiteralPath $temporaryPath) {
      Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
    }

    throw
  }
}

Export-ModuleMember -Function @(
  'Assert-AzContext',
  'Assert-StrattonKustoLiteralSafe',
  'ConvertFrom-StrattonLogAnalyticsQueryResponse',
  'ConvertTo-PreflightResult',
  'Get-RequiredOpenAiModels',
  'Get-RequiredProviderNamespaces',
  'Get-StrattonDurableJobReceipt',
  'Get-StrattonLogAnalyticsWorkspaceCustomerId',
  'Get-StrattonMigrationFiles',
  'Invoke-AzJson',
  'Invoke-StrattonBootstrapImageBuild',
  'Invoke-StrattonImageBuilds',
  'Invoke-StrattonAzurePreflight',
  'New-StrattonJobReceiptKustoQuery',
  'New-StrattonLogAnalyticsQueryBody',
  'New-StrattonLogAnalyticsQueryRestArguments',
  'New-StrattonLogAnalyticsWorkspaceRestArguments',
  'New-StrattonTemporaryJsonFile',
  'Test-ImageDigest',
  'Write-DeploymentArtifact'
)
