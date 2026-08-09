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
  },
  [pscustomobject]@{
    route = 'TERRA'
    modelId = 'gpt-5.6-terra'
    modelVersion = '2026-07-09'
    quotaName = 'OpenAI.DataZoneStandard.gpt-5.6-terra'
  },
  [pscustomobject]@{
    route = 'SOL'
    modelId = 'gpt-5.6-sol'
    modelVersion = '2026-07-09'
    quotaName = 'OpenAI.DataZoneStandard.gpt-5.6-sol'
  },
  [pscustomobject]@{
    route = 'EMBEDDING'
    modelId = 'text-embedding-3-large'
    modelVersion = $null
    quotaName = 'OpenAI.DataZoneStandard.text-embedding-3-large'
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

    [Parameter(Mandatory)]
    [object[]] $RequiredModels
  )

  $blockingFindings = [System.Collections.Generic.List[string]]::new()

  $openAiSkus = @()
  try {
    $openAiSkus = @(Invoke-AzJson -Arguments @('cognitiveservices', 'account', 'list-skus', '--kind', 'OpenAI', '--location', $Location))
  }
  catch {
    $blockingFindings.Add('AZURE_OPENAI_SKU_QUERY_FAILED')
  }

  $quotaRows = @()
  try {
    $quotaRows = @(Invoke-AzJson -Arguments @('cognitiveservices', 'usage', 'list', '--location', $Location))
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

  $normalizedLocation = Get-NormalizedLocationName -Location $Location
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
      $quotaAvailable = ($null -ne $quotaRow -and $quotaLimit -gt 0)

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
        reason = $reason
      }
    }
  )

  return [pscustomobject]@{
    skuAvailability = [pscustomobject]@{
      openAiAccountSkuAvailable = (Test-OpenAiSkuAvailability -Skus $openAiSkus -Location $Location)
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

  if (@($OpenAiModels).Count -eq 0 -or @($OpenAiModels | Where-Object available -ne $true).Count -gt 0) {
    $blockingFindings.Add('AZURE_OPENAI_MODEL_UNAVAILABLE')
  }

  if (@($OpenAiModels).Count -eq 0 -or @($OpenAiModels | Where-Object quotaAvailable -ne $true).Count -gt 0) {
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
            reason = 'MODEL_DISCOVERY_NOT_RUN'
          }
        }
    )
    blockingFindings = @()
  }

  try {
    $openAiReadiness = Get-OpenAiReadiness -SubscriptionId $SubscriptionId -Location $Location -RequiredModels $requiredOpenAiModels
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
    -ResourceProviders $resourceProviders `
    -PolicyAssignments $policyAssignments `
    -SkuAvailability $openAiReadiness.skuAvailability `
    -OpenAiModels $openAiReadiness.openAiModels `
    -RequiredProviders $requiredProviders `
    -NamingConflicts $namingConflicts `
    -AdditionalBlockingFindings @($additionalBlockingFindings)
}

function Write-DeploymentArtifact {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)]
    [string] $Path,

    [Parameter(Mandatory)]
    [object] $InputObject
  )

  $directory = Split-Path -Path $Path -Parent
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $InputObject | ConvertTo-Json -Depth 50 | Set-Content -Path $Path -Encoding utf8
}

Export-ModuleMember -Function @(
  'Assert-AzContext',
  'ConvertTo-PreflightResult',
  'Get-RequiredOpenAiModels',
  'Get-RequiredProviderNamespaces',
  'Invoke-AzJson',
  'Invoke-StrattonAzurePreflight',
  'Write-DeploymentArtifact'
)
