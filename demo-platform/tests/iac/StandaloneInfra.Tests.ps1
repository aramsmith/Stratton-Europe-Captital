Set-StrictMode -Version Latest

Describe 'Stratton standalone platform foundation' {
  BeforeAll {
    function Get-TemplateResources {
      param([Parameter(Mandatory)][object[]] $Resources)

      foreach ($resource in @($Resources)) {
        $resource
        if ($resource.type -eq 'Microsoft.Resources/deployments' -and $resource.properties.template.resources) {
          Get-TemplateResources -Resources $resource.properties.template.resources
        }
      }
    }

    $script:repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $script:mainBicepPath = Join-Path $script:repoRoot 'infra\standalone\main.bicep'
    $script:compiledTemplatePath = Join-Path $script:repoRoot ('.stratton-standalone-infra-{0}.json' -f [System.Guid]::NewGuid().ToString('N'))
    $script:buildOutput = & az bicep build --file $script:mainBicepPath --outfile $script:compiledTemplatePath 2>&1
    $script:buildExitCode = $LASTEXITCODE
    $script:templateJson = $null
    $script:template = $null
    $script:allResources = @()

    if ($script:buildExitCode -eq 0 -and (Test-Path $script:compiledTemplatePath)) {
      $script:templateJson = Get-Content -Path $script:compiledTemplatePath -Raw
      $script:template = $script:templateJson | ConvertFrom-Json -Depth 100
      $script:allResources = @(Get-TemplateResources -Resources $script:template.resources)
    }
  }

  AfterAll {
    if ($script:compiledTemplatePath -and (Test-Path $script:compiledTemplatePath)) {
      Remove-Item -Path $script:compiledTemplatePath -Force
    }
  }

  It 'builds the subscription-scoped standalone template' {
    $script:buildExitCode | Should -Be 0 -Because (($script:buildOutput | Out-String).Trim())
    Test-Path $script:compiledTemplatePath | Should -BeTrue
    (@($script:template.resources | Where-Object type -eq 'Microsoft.Resources/resourceGroups')).Count | Should -Be 1
  }

  It 'creates a VNet-integrated consumption environment and private SQL database' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $types = @($script:allResources.type)
    $types | Should -Contain 'Microsoft.Network/virtualNetworks'
    $types | Should -Contain 'Microsoft.App/managedEnvironments'
    $types | Should -Contain 'Microsoft.Sql/servers'
    $types | Should -Contain 'Microsoft.Sql/servers/databases'
    $types | Should -Contain 'Microsoft.Network/privateEndpoints'
    $script:templateJson | Should -Match '"publicNetworkAccess"\s*:\s*"Disabled"'
  }

  It 'uses one OpenAI account and three explicit deployments' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    (@($script:allResources | Where-Object type -eq 'Microsoft.CognitiveServices/accounts')).Count |
      Should -Be 2
    (@($script:allResources | Where-Object type -eq 'Microsoft.CognitiveServices/accounts/deployments')).Count |
      Should -Be 3
  }

  It 'provisions cost-minimised operations resources and stable identities' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $registry = @($script:allResources | Where-Object type -eq 'Microsoft.ContainerRegistry/registries')
    $registry.Count | Should -Be 1
    $registry[0].sku.name | Should -Be 'Basic'
    $registry[0].properties.adminUserEnabled | Should -BeFalse
    $registry[0].properties.PSObject.Properties['policies'] | Should -BeNullOrEmpty -Because 'Basic ACR does not support the Premium-only native retention policy; a later operational process performs cleanup.'

    $workspace = @($script:allResources | Where-Object type -eq 'Microsoft.OperationalInsights/workspaces')
    $workspace.Count | Should -Be 1
    $workspace[0].properties.retentionInDays | Should -Be 30

    $environment = @($script:allResources | Where-Object type -eq 'Microsoft.App/managedEnvironments')
    $environment.Count | Should -Be 1
    $environment[0].properties.vnetConfiguration.infrastructureSubnetId | Should -Not -BeNullOrEmpty
    $environment[0].properties.workloadProfiles[0].workloadProfileType | Should -Be 'Consumption'

    $identities = @($script:allResources | Where-Object type -eq 'Microsoft.ManagedIdentity/userAssignedIdentities')
    $identities.Count | Should -Be 4
    $identityJson = $identities | ConvertTo-Json -Depth 20
    foreach ($identityName in @('web-mi', 'bff-mi', 'phase5-mi', 'bootstrap-mi')) {
      $identityJson | Should -Match $identityName
    }
  }

  It 'provisions private data, messaging, search, and document intelligence services' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $storageAccounts = @($script:allResources | Where-Object type -eq 'Microsoft.Storage/storageAccounts')
    $storageAccounts.Count | Should -Be 1
    $storageAccounts[0].properties.allowSharedKeyAccess | Should -BeFalse
    (@($script:allResources | Where-Object type -eq 'Microsoft.Storage/storageAccounts/blobServices/containers')).Count | Should -Be 1
    (@($script:allResources | Where-Object type -eq 'Microsoft.ServiceBus/namespaces')).Count | Should -Be 1
    (@($script:allResources | Where-Object type -eq 'Microsoft.ServiceBus/namespaces/queues')).Count | Should -Be 4
    (@($script:allResources | Where-Object type -eq 'Microsoft.Search/searchServices')).Count | Should -Be 1
    $script:templateJson | Should -Match 'azureADOnlyAuthentication'
    $script:templateJson | Should -Match 'autoPauseDelay'
    $script:templateJson | Should -Match 'admitted-evidence'
  }

  It 'exports the platform bindings required by application deployments' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    foreach ($outputName in @(
      'containerAppsEnvironmentId', 'containerRegistryId', 'containerRegistryServer', 'logAnalyticsWorkspaceId',
      'sqlServerResourceId', 'sqlServerFqdn', 'sqlDatabaseName', 'sqlDatabaseResourceId',
      'blobStorageAccountName', 'blobStorageAccountResourceId', 'blobContainerName',
      'serviceBusFqdn', 'serviceBusNamespaceResourceId', 'serviceBusQueueName',
      'searchEndpoint', 'searchServiceResourceId', 'searchIndexName',
      'documentIntelligenceEndpoint', 'documentIntelligenceAccountResourceId',
      'lunaOpenAiEndpoint', 'lunaOpenAiAccountResourceId', 'lunaOpenAiDeploymentId',
      'terraOpenAiEndpoint', 'terraOpenAiAccountResourceId', 'terraOpenAiDeploymentId',
      'solOpenAiEndpoint', 'solOpenAiAccountResourceId', 'solOpenAiDeploymentId',
      'webIdentityResourceId', 'webIdentityClientId', 'webIdentityPrincipalId',
      'bffIdentityResourceId', 'bffIdentityClientId', 'bffIdentityPrincipalId',
      'phase5IdentityResourceId', 'phase5IdentityClientId', 'phase5IdentityPrincipalId',
      'bootstrapIdentityResourceId', 'bootstrapIdentityClientId', 'bootstrapIdentityPrincipalId'
    )) {
      $script:template.outputs.PSObject.Properties.Name | Should -Contain $outputName
    }
  }
}
