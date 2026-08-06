Set-StrictMode -Version Latest

Describe 'Stratton demo infrastructure' {
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
    $script:mainBicepPath = Join-Path $script:repoRoot 'infra\main.bicep'
    $script:compiledTemplatePath = Join-Path ([System.IO.Path]::GetTempPath()) ("stratton-demo-infra-{0}.json" -f [System.Guid]::NewGuid().ToString('N'))
    $script:parameterNamesRequiringExplicitValues = @(
      'tenantId'
      'location'
      'containerAppsEnvironmentId'
      'containerRegistryId'
      'containerRegistryServer'
      'logAnalyticsWorkspaceId'
      'sqlServerFqdn'
      'sqlDatabaseName'
      'sqlDatabaseResourceId'
      'blobStorageAccountName'
      'blobStorageAccountResourceId'
      'blobContainerName'
      'serviceBusFqdn'
      'serviceBusNamespaceResourceId'
      'serviceBusQueueName'
      'searchEndpoint'
      'searchServiceResourceId'
      'searchIndexName'
      'documentIntelligenceEndpoint'
      'documentIntelligenceAccountResourceId'
      'lunaOpenAiEndpoint'
      'lunaOpenAiAccountResourceId'
      'lunaOpenAiDeploymentId'
      'lunaOpenAiApiVersion'
      'lunaOpenAiEvidenceId'
      'terraOpenAiEndpoint'
      'terraOpenAiAccountResourceId'
      'terraOpenAiDeploymentId'
      'terraOpenAiApiVersion'
      'terraOpenAiEvidenceId'
      'solOpenAiEndpoint'
      'solOpenAiAccountResourceId'
      'solOpenAiDeploymentId'
      'solOpenAiApiVersion'
      'solOpenAiEvidenceId'
      'phase5ApiBaseUrl'
      'webImageRepository'
      'webImageDigest'
      'bffImageRepository'
      'bffImageDigest'
      'webEntraClientId'
      'webAllowedAudiences'
      'bffEntraClientId'
      'bffAllowedAudiences'
    )

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

  It 'builds the demo infrastructure template' {
    $script:buildExitCode | Should -Be 0 -Because (($script:buildOutput | Out-String).Trim())
    Test-Path $script:compiledTemplatePath | Should -BeTrue
  }

  It 'keeps both demo applications private' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
    $apps.Count | Should -Be 2
    foreach ($app in $apps) {
      $app.properties.configuration.ingress.external | Should -BeFalse
      $app.properties.configuration.ingress.allowInsecure | Should -BeFalse
    }
  }

  It 'does not enable registry admin credentials' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    (@($script:allResources | Where-Object type -eq 'Microsoft.ContainerRegistry/registries')).Count |
      Should -Be 0

    $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
    foreach ($app in $apps) {
      $registries = @($app.properties.configuration.registries)
      $registries.Count | Should -Be 1
      foreach ($registry in $registries) {
        @($registry.PSObject.Properties.Name) | Should -Contain 'identity'
        @($registry.PSObject.Properties.Name) | Should -Not -Contain 'username'
        @($registry.PSObject.Properties.Name) | Should -Not -Contain 'passwordSecretRef'
      }
    }
  }

  It 'pins every application image by digest' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $images = @(
      $script:allResources |
        Where-Object type -eq 'Microsoft.App/containerApps' |
        ForEach-Object { $_.properties.template.containers } |
        ForEach-Object { $_ } |
        Select-Object -ExpandProperty image
    )

    $images.Count | Should -Be 2
    foreach ($image in $images) {
      $image | Should -Match "^\[variables\('(?:web|bff)Image'\)\]$"
    }

    $script:templateJson | Should -Match "format\('\{0\}/\{1\}@\{2\}'"
    $script:templateJson | Should -Match "parameters\('webImageDigest'\)"
    $script:templateJson | Should -Match "parameters\('bffImageDigest'\)"
  }

  It 'assigns separate user-assigned identities to both applications' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $identities = @($script:allResources | Where-Object type -eq 'Microsoft.ManagedIdentity/userAssignedIdentities')
    $identities.Count | Should -Be 2

    $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
    foreach ($app in $apps) {
      $app.identity.type | Should -Be 'UserAssigned'
      (@($app.identity.userAssignedIdentities.PSObject.Properties)).Count | Should -Be 1
    }
  }

  It 'preserves supplied shared resource IDs instead of reconstructing same-resource-group bindings' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
    foreach ($app in $apps) {
      $app.properties.managedEnvironmentId | Should -Be "[parameters('containerAppsEnvironmentId')]"
    }

    $diagnosticSettings = @($script:allResources | Where-Object type -eq 'Microsoft.Insights/diagnosticSettings')
    foreach ($diagnosticSetting in $diagnosticSettings) {
      $diagnosticSetting.properties.workspaceId | Should -Be "[parameters('logAnalyticsWorkspaceId')]"
    }

    $script:templateJson | Should -Match '"subscriptionId"\s*:\s*"\[variables\(''sqlDatabaseResourceIdParts''\)\[2\]\]"'
    $script:templateJson | Should -Match '"resourceGroup"\s*:\s*"\[variables\(''sqlDatabaseResourceIdParts''\)\[4\]\]"'

    foreach ($scopedResourceParameter in @(
      'containerRegistryId'
      'blobStorageAccountResourceId'
      'serviceBusNamespaceResourceId'
      'searchServiceResourceId'
      'documentIntelligenceAccountResourceId'
    )) {
      $script:templateJson | Should -Match ('"subscriptionId"\s*:\s*"\[split\(parameters\(''' + $scopedResourceParameter + '''\), ''/''\)\[2\]\]"')
      $script:templateJson | Should -Match ('"resourceGroup"\s*:\s*"\[split\(parameters\(''' + $scopedResourceParameter + '''\), ''/''\)\[4\]\]"')
    }
  }

  It 'emits least-privilege role assignments for pull and approved Azure dependencies' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $roleAssignments = @($script:allResources | Where-Object type -eq 'Microsoft.Authorization/roleAssignments')
    $roleAssignments.Count | Should -BeGreaterOrEqual 7

    $templateText = $script:templateJson
    foreach ($roleGuid in @(
      '7f951dda-4ed3-4680-a7ca-43fe172d538d'
      'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
      '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
      '1407120a-92aa-4202-b7e9-c0e197c71c8f'
      'a97b65f3-24c7-4388-baec-2e87135dc908'
      '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
    )) {
      $templateText | Should -Match ([Regex]::Escape($roleGuid))
    }
  }

  It 'does not emit SQL DB Contributor for runtime identities and keeps SQL bootstrap output' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $script:templateJson | Should -Not -Match ([Regex]::Escape('9b7fa17d-e63e-47b0-bb0a-15c516ac86ec'))
    $script:template.outputs.sqlBootstrapSql | Should -Not -BeNullOrEmpty
    $script:templateJson | Should -Match 'CREATE USER'
    $script:templateJson | Should -Match 'ALTER ROLE db_datareader ADD MEMBER'
    $script:templateJson | Should -Match 'ALTER ROLE db_datawriter ADD MEMBER'
  }

  It 'routes diagnostics to the supplied workspace' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $diagnosticSettings = @($script:allResources | Where-Object type -eq 'Microsoft.Insights/diagnosticSettings')
    $diagnosticSettings.Count | Should -BeGreaterOrEqual 3
    foreach ($diagnosticSetting in $diagnosticSettings) {
      ($diagnosticSetting.properties.workspaceId | Out-String) | Should -Match 'logAnalyticsWorkspaceId'
    }
  }

  It 'keeps owner-bound inputs fail-closed with no defaults' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    foreach ($parameterName in $script:parameterNamesRequiringExplicitValues) {
      $parameter = $script:template.parameters.$parameterName
      $parameter | Should -Not -BeNullOrEmpty
      @($parameter.PSObject.Properties.Name) | Should -Not -Contain 'defaultValue'
    }
  }

  It 'enables Entra authentication with explicit allowed audiences for both apps' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $authConfigs = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps/authConfigs')
    $authConfigs.Count | Should -Be 2
    foreach ($authConfig in $authConfigs) {
      $authConfig.properties.platform.enabled | Should -BeTrue
      $authConfig.properties.globalValidation.unauthenticatedClientAction | Should -Be 'Return401'
      $authConfig.properties.globalValidation.redirectToProvider | Should -Be 'azureactivedirectory'
      ($authConfig.properties.identityProviders.azureActiveDirectory.validation.allowedAudiences | Out-String) |
        Should -Match 'AllowedAudiences'
    }
  }
}


