# Requires PSRule

Rule 'Stratton.Storage.PublicAccessDisabled' -If {
  $TargetObject.type -eq 'Microsoft.Storage/storageAccounts'
} {
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool](($pna -eq 'Disabled' -or $pna.StartsWith('[')) -and ($TargetObject.properties.allowBlobPublicAccess -eq $false))
}

Rule 'Stratton.Sql.PublicNetworkDisabled' -If {
  $TargetObject.type -eq 'Microsoft.Sql/servers'
} {
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool]($pna -eq 'Disabled' -or $pna.StartsWith('['))
}

Rule 'Stratton.ServiceBus.PremiumPrivate' -If {
  $TargetObject.type -eq 'Microsoft.ServiceBus/namespaces'
} {
  $rawSku = $TargetObject.sku.name
  $sku = if ($rawSku -is [string]) { $rawSku } elseif ($rawSku.PSObject.Properties['value']) { [string]$rawSku.value } else { [string]$rawSku }
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool](($sku -eq 'Premium' -or $sku.StartsWith('[')) -and ($pna -eq 'Disabled' -or $pna.StartsWith('[')))
}

Rule 'Stratton.AppConfig.PublicNetworkDisabled' -If {
  $TargetObject.type -eq 'Microsoft.AppConfiguration/configurationStores'
} {
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool]($pna -eq 'Disabled' -or $pna.StartsWith('['))
}

Rule 'Stratton.KeyVault.PublicNetworkDisabled' -If {
  $TargetObject.type -eq 'Microsoft.KeyVault/vaults'
} {
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool](($pna -eq 'Disabled' -or $pna.StartsWith('[')) -and ([string]$TargetObject.properties.networkAcls.defaultAction -eq 'Deny'))
}

Rule 'Stratton.ACR.PublicNetworkDisabled' -If {
  $TargetObject.type -eq 'Microsoft.ContainerRegistry/registries'
} {
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool]($pna -eq 'Disabled' -or $pna.StartsWith('['))
}

Rule 'Stratton.Cognitive.PublicNetworkDisabled' -If {
  $TargetObject.type -eq 'Microsoft.CognitiveServices/accounts'
} {
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool](($pna -eq 'Disabled' -or $pna.StartsWith('[')) -and ($TargetObject.properties.disableLocalAuth -eq $true))
}

Rule 'Stratton.Search.PublicNetworkDisabled' -If {
  $TargetObject.type -eq 'Microsoft.Search/searchServices'
} {
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool]($pna -match '^(?i)disabled$' -or $pna.StartsWith('['))
}

Rule 'Stratton.APIM.PublicNetworkDisabled' -If {
  $TargetObject.type -eq 'Microsoft.ApiManagement/service'
} {
  $rawPna = $TargetObject.properties.publicNetworkAccess
  $pna = if ($rawPna -is [string]) { $rawPna } elseif ($rawPna.PSObject.Properties['value']) { [string]$rawPna.value } else { [string]$rawPna }
  [bool]($pna -eq 'Disabled' -or $pna.StartsWith('['))
}

Rule 'Stratton.ContainerApp.PrivateIngress' -If {
  $TargetObject.type -eq 'Microsoft.App/containerApps'
} {
  [bool]($TargetObject.properties.configuration.ingress.external -eq $false)
}

Rule 'Stratton.AppGateway.PrivateFrontendOnly' -If {
  $TargetObject.type -eq 'Microsoft.Network/applicationGateways'
} {
  $ips = @($TargetObject.properties.frontendIPConfigurations)
  [bool](@($ips | Where-Object { $_.properties.publicIPAddress }).Count -eq 0)
}

Rule 'Stratton.Tags.RequiredSeven' -If {
  $TargetObject.PSObject.Properties['type'] -and $TargetObject.PSObject.Properties['tags']
} {
  $tags = $TargetObject.tags
  if ($tags -is [string]) {
    return [bool]($tags -match "parameters\('tags'\)")
  }
  if ($tags -is [System.Collections.IDictionary] -or $tags -is [pscustomobject]) {
    $required = @('environment','workload','owner','costCenter','dataClassification','criticality','managedBy')
    return [bool](@($required | Where-Object { -not $tags.PSObject.Properties.Name.Contains($_) }).Count -eq 0)
  }
  return $false
}

Rule 'Stratton.RolloutLimitFixed20' -If {
  $TargetObject.parameters -and $TargetObject.parameters.rolloutAdmissionMaximum
} {
  [bool](($TargetObject.parameters.rolloutAdmissionMaximum.minValue -eq 20) -and ($TargetObject.parameters.rolloutAdmissionMaximum.maxValue -eq 20))
}
