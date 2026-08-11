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
    $script:compiledTemplatePath = Join-Path $script:repoRoot (".stratton-demo-infra-{0}.json" -f [System.Guid]::NewGuid().ToString('N'))
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
      'ingestionQueueName'
      'extractionQueueName'
      'indexingQueueName'
      'searchEndpoint'
      'searchServiceResourceId'
      'searchIndexName'
      'documentIntelligenceEndpoint'
      'documentIntelligenceAccountResourceId'
      'lunaOpenAiEndpoint'
      'lunaOpenAiAccountResourceId'
      'lunaOpenAiRegion'
      'lunaOpenAiDeploymentId'
      'lunaOpenAiApiVersion'
      'lunaOpenAiEvidenceId'
      'lunaOpenAiRouteEvidenceVersion'
      'terraOpenAiEndpoint'
      'terraOpenAiAccountResourceId'
      'terraOpenAiRegion'
      'terraOpenAiDeploymentId'
      'terraOpenAiApiVersion'
      'terraOpenAiEvidenceId'
      'terraOpenAiRouteEvidenceVersion'
      'solOpenAiEndpoint'
      'solOpenAiAccountResourceId'
      'solOpenAiRegion'
      'solOpenAiDeploymentId'
      'solOpenAiApiVersion'
      'solOpenAiEvidenceId'
      'solOpenAiRouteEvidenceVersion'
      'webDelegatedScope'
      'bffRequiredDelegatedScope'
      'phase5ApplicationId'
      'modelProviderEvidenceId'
      'regionalDeploymentEvidenceId'
      'promptGovernanceEvidenceId'
      'phase5DelegatedScope'
      'webImageRepository'
      'webImageDigest'
      'bffImageRepository'
      'bffImageDigest'
      'phase5ImageRepository'
      'phase5ImageDigest'
      'webIdentityResourceId'
      'webIdentityClientId'
      'webIdentityPrincipalId'
      'bffIdentityResourceId'
      'bffIdentityClientId'
      'bffIdentityPrincipalId'
      'phase5IdentityResourceId'
      'phase5IdentityClientId'
      'phase5IdentityPrincipalId'
      'verificationIdentityResourceId'
      'verificationIdentityClientId'
      'verificationIdentityPrincipalId'
      'webEntraClientId'
      'bffEntraClientId'
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

  It 'derives the Phase 5 URL inside the app module without a reference-bound parameter' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $appsDeployment = @(
      $script:template.resources |
        Where-Object {
          $_.type -eq 'Microsoft.Resources/deployments' -and
          $_.name -match '-apps'
        }
    )
    $appsDeployment.Count | Should -Be 1
    $appsDeployment[0].properties.parameters.PSObject.Properties.Name |
      Should -Not -Contain 'phase5ApiBaseUrl'
    $appsSource = Get-Content -Path (
      Join-Path $script:repoRoot 'infra\modules\demo-apps\main.bicep'
    ) -Raw
    $appsSource | Should -Match 'containerAppsEnvironment\.properties\.defaultDomain'
  }

  It 'exposes only the web application publicly' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
    ($apps | Where-Object { $_.name -match 'webAppName' }).properties.configuration.ingress.external |
      Should -BeTrue
    ($apps | Where-Object { $_.name -match 'bffAppName' }).properties.configuration.ingress.external |
      Should -BeFalse
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

    $images.Count | Should -Be 3
    foreach ($image in $images) {
      $image | Should -Match "^\[variables\('(?:web|bff|phase5)Image'\)\]$"
    }

    $script:templateJson | Should -Match "format\('\{0\}/\{1\}@\{2\}'"
    $script:templateJson | Should -Match "parameters\('webImageDigest'\)"
    $script:templateJson | Should -Match "parameters\('bffImageDigest'\)"
    $script:templateJson | Should -Match "parameters\('phase5ImageDigest'\)"
  }

  It 'consumes the three stable foundation identities without creating replacements' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    (@($script:allResources | Where-Object type -eq 'Microsoft.ManagedIdentity/userAssignedIdentities')).Count |
      Should -Be 0
    $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
    $apps.Count | Should -Be 3
    foreach ($app in $apps) {
      $app.identity.type | Should -Be 'UserAssigned'
      (@($app.identity.userAssignedIdentities.PSObject.Properties)).Count | Should -Be 1
    }
    $script:templateJson | Should -Match "parameters\('webIdentityResourceId'\)"
    $script:templateJson | Should -Match "parameters\('bffIdentityResourceId'\)"
    $script:templateJson | Should -Match "parameters\('phase5IdentityResourceId'\)"
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
    $roleAssignments.Count | Should -BeGreaterOrEqual 10

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
    $script:templateJson | Should -Not -Match 'ALTER ROLE db_datareader ADD MEMBER'
    $script:templateJson | Should -Not -Match 'ALTER ROLE db_datawriter ADD MEMBER'
    $script:templateJson | Should -Not -Match 'GRANT EXECUTE TO'
    $script:templateJson | Should -Match 'GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.demo_scenario_projection'
    $script:templateJson | Should -Match 'GRANT SELECT ON OBJECT::dbo.approved_model_route_evidence'
  }

  It 'scopes Blob and Service Bus data-plane roles to the approved container and queue' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $script:templateJson | Should -Match 'Microsoft.Storage/storageAccounts/blobServices/containers'
    $script:templateJson | Should -Match 'containerName'
    $script:templateJson | Should -Match 'serviceBusQueueName'
    $script:templateJson | Should -Match 'Microsoft.ServiceBus/namespaces/queues'
  }

  It 'routes diagnostics to the supplied workspace' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $diagnosticSettings = @($script:allResources | Where-Object type -eq 'Microsoft.Insights/diagnosticSettings')
    $diagnosticSettings.Count | Should -BeGreaterOrEqual 1
    foreach ($diagnosticSetting in $diagnosticSettings) {
      ($diagnosticSetting.properties.workspaceId | Out-String) | Should -Match 'logAnalyticsWorkspaceId'
    }
  }

  It 'does not attach unsupported diagnostic settings directly to Container Apps' {
    foreach ($relativePath in @(
        'infra\modules\demo-apps\main.bicep',
        'infra\standalone\modules\phase5\main.bicep'
      )) {
      $source = Get-Content -Path (Join-Path $script:repoRoot $relativePath) -Raw
      $source | Should -Not -Match "Microsoft\.Insights/diagnosticSettings"
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

  It 'keeps the SPA public for client-directed sign-in and locks the BFF to the web public client' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $authConfigs = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps/authConfigs')
    $authConfigs.Count | Should -Be 3
    $phase5Auth = $authConfigs | Where-Object { $_.name -match 'phase5AppName' }
    $webAuth = $authConfigs | Where-Object { $_.name -match 'webAppName' }
    $bffAuth = $authConfigs | Where-Object { $_.name -match 'bffAppName' }

    $webAuth.properties.platform.enabled | Should -BeFalse
    $webAuth.properties.globalValidation.unauthenticatedClientAction | Should -Be 'AllowAnonymous'
    $bffAuth.properties.platform.enabled | Should -BeTrue
    $bffAuth.properties.globalValidation.unauthenticatedClientAction | Should -Be 'Return401'
    @($bffAuth.properties.identityProviders.azureActiveDirectory.validation.allowedAudiences).Count |
      Should -Be 1
    ($bffAuth.properties.identityProviders.azureActiveDirectory.validation.allowedAudiences[0] | Out-String) |
      Should -Match 'bffEntraClientId'
    @($bffAuth.properties.identityProviders.azureActiveDirectory.validation.defaultAuthorizationPolicy.allowedApplications).Count |
      Should -Be 1
    ($bffAuth.properties.identityProviders.azureActiveDirectory.validation.defaultAuthorizationPolicy.allowedApplications[0] | Out-String) |
      Should -Match 'webEntraClientId'
    @($phase5Auth.properties.identityProviders.azureActiveDirectory.validation.allowedAudiences).Count |
      Should -Be 1
    ($phase5Auth.properties.identityProviders.azureActiveDirectory.validation.allowedAudiences[0] | Out-String) |
      Should -Match 'phase5ApplicationId'
    @($phase5Auth.properties.identityProviders.azureActiveDirectory.validation.defaultAuthorizationPolicy.allowedApplications).Count |
      Should -Be 2
    ($phase5Auth.properties.identityProviders.azureActiveDirectory.validation.defaultAuthorizationPolicy.allowedApplications | ConvertTo-Json) |
      Should -Match 'bffEntraClientId'
    ($phase5Auth.properties.identityProviders.azureActiveDirectory.validation.defaultAuthorizationPolicy.allowedApplications | ConvertTo-Json) |
      Should -Match 'bffIdentityClientId'
    ($authConfigs | ConvertTo-Json -Depth 100) | Should -Not -Match 'tokenStore|sasUrl|clientSecret'
    @($phase5Auth.properties.globalValidation.excludedPaths) | Should -Contain '/health'
    @($phase5Auth.properties.globalValidation.excludedPaths) | Should -Not -Contain '/healthz'
  }

  It 'wires the production web proxy to the private BFF with delegated token authority' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
    $webApp = $apps | Where-Object { $_.name -match "webAppName" }
    $bffApp = $apps | Where-Object { $_.name -match "bffAppName" }
    $webEnvText = $webApp.properties.template.containers[0].env | ConvertTo-Json -Depth 20
    $bffEnvText = $bffApp.properties.template.containers[0].env | ConvertTo-Json -Depth 20

    $webEnvText | Should -Match 'BFF_INTERNAL_BASE_URL'
    $webEnvText | Should -Match 'DEMO_MODE'
    $webEnvText | Should -Match 'DEMO_TENANT_ID'
    $webEnvText | Should -Match 'WEB_ENTRA_CLIENT_ID'
    $webEnvText | Should -Match 'WEB_BFF_DELEGATED_SCOPE'
    $webEnvText | Should -Not -Match 'BFF_TOKEN_SCOPE'
    $webEnvText | Should -Not -Match 'AZURE_MANAGED_IDENTITY_CLIENT_ID'
    $bffEnvText | Should -Match 'PHASE5_DELEGATED_SCOPE'
    $bffEnvText | Should -Match 'BFF_DELEGATED_AUDIENCE'
    $bffEnvText | Should -Match 'BFF_REQUIRED_DELEGATED_SCOPE'
    $bffEnvText | Should -Match 'BFF_ENTRA_CLIENT_ID'
    $bffEnvText | Should -Match 'BFF_ALLOWED_CLIENT_APPLICATION_ID'
    $bffEnvText | Should -Match 'ENTRA_TOKEN_ENDPOINT'
    $bffEnvText | Should -Match 'DEMO_TENANT_ID'
    $bffEnvText | Should -Not -Match 'TRUSTED_WEB_PROXY_PRINCIPAL_ID'
    $bffEnvText | Should -Not -Match 'DEMO_AUTHORITY_COMPLETION_CLIENT_ID'
    $bffEnvText | Should -Match 'AZURE_OPENAI_LUNA_RESOURCE_ID'
    $bffEnvText | Should -Match 'AZURE_OPENAI_LUNA_ROUTE_EVIDENCE_VERSION'
    $bffEnvText | Should -Match 'AZURE_OPENAI_TERRA_REGION'
    $bffEnvText | Should -Match 'AZURE_OPENAI_TERRA_ROUTE_EVIDENCE_VERSION'
    $bffEnvText | Should -Match 'AZURE_OPENAI_SOL_RESOURCE_ID'
    $bffEnvText | Should -Match 'AZURE_OPENAI_SOL_ROUTE_EVIDENCE_VERSION'
    $script:templateJson | Should -Match 'https://'
    $script:templateJson | Should -Match 'bffApp.*ingress.*fqdn'
    $script:templateJson | Should -Not -Match 'PHASE5_TOKEN_SCOPE'
  }

  It 'requires explicit client-directed and OBO authentication inputs' {
    foreach ($parameterName in @(
      'webDelegatedScope'
      'bffRequiredDelegatedScope'
      'phase5ApplicationId'
      'phase5DelegatedScope'
      'webEntraClientId'
      'bffEntraClientId'
    )) {
      $parameter = $script:template.parameters.$parameterName
      $parameter | Should -Not -BeNullOrEmpty
      @($parameter.PSObject.Properties.Name) | Should -Not -Contain 'defaultValue'
    }

    $script:template.parameters.PSObject.Properties.Name | Should -Not -Contain 'phase5TokenScope'
    $script:template.parameters.PSObject.Properties.Name | Should -Not -Contain 'bffDelegatedAudience'
    $script:template.parameters.PSObject.Properties.Name | Should -Not -Contain 'demoAuthorityCompletionClientId'
  }

  It 'constrains the Microsoft Entra tenant ID to GUID length' {
    $tenantParameter = $script:template.parameters.tenantId
    $tenantParameter.minLength | Should -Be 36
    $tenantParameter.maxLength | Should -Be 36
  }

  It 'uses client-directed PKCE without token-store, SAS, or server-directed web auth wiring' {
    $authConfigs = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps/authConfigs')
    $authConfigs.Count | Should -Be 3
    $authJson = $authConfigs | ConvertTo-Json -Depth 100
    $authJson | Should -Not -Match 'tokenStore|sasUrl|clientSecret|loginParameters'
    $authJson | Should -Match 'bffEntraClientId'
    $authJson | Should -Match 'webEntraClientId'
  }

  It 'sets all Task 3 OBO settings and no stale managed-identity web token wiring' {
    $apps = @($script:allResources | Where-Object type -eq 'Microsoft.App/containerApps')
    $webApp = $apps | Where-Object { $_.name -match 'webAppName' }
    $bffApp = $apps | Where-Object { $_.name -match 'bffAppName' }
    $webEnv = $webApp.properties.template.containers[0].env | ConvertTo-Json -Depth 20
    $bffEnv = $bffApp.properties.template.containers[0].env | ConvertTo-Json -Depth 20

    $webEnv | Should -Not -Match 'BFF_TOKEN_SCOPE'
    $webEnv | Should -Not -Match 'AZURE_MANAGED_IDENTITY_CLIENT_ID'
    foreach ($setting in @(
      'PHASE5_DELEGATED_SCOPE'
      'PHASE5_APPLICATION_ID'
      'BFF_DELEGATED_AUDIENCE'
      'BFF_REQUIRED_DELEGATED_SCOPE'
      'BFF_ENTRA_CLIENT_ID'
      'BFF_ALLOWED_CLIENT_APPLICATION_ID'
      'ENTRA_TOKEN_ENDPOINT'
      'AZURE_MANAGED_IDENTITY_CLIENT_ID'
    )) {
      $bffEnv | Should -Match $setting
    }
    $script:templateJson | Should -Not -Match 'PHASE5_TOKEN_SCOPE'
    $bffEnv | Should -Not -Match 'DEMO_AUTHORITY_COMPLETION_CLIENT_ID'
    $script:templateJson | Should -Not -Match 'clientSecret'
    $script:templateJson | Should -Not -Match 'accountKey'
    $script:templateJson | Should -Not -Match 'sasUrl'
  }

  It 'assigns ARM Reader to the BFF only at each supplied OpenAI account scope' {
    $readerDeployments = @($script:allResources | Where-Object {
      $_.type -eq 'Microsoft.Resources/deployments' -and $_.name -match 'bff-openai-reader'
    })
    $readerDeployments.Count | Should -Be 1
    ($readerDeployments[0].copy.count | Out-String) | Should -Match 'openAiAccountResourceIds'
    ($readerDeployments[0].subscriptionId | Out-String) | Should -Match 'openAiAccountResourceIds'
    ($readerDeployments[0].resourceGroup | Out-String) | Should -Match 'openAiAccountResourceIds'
    ($readerDeployments[0].properties.parameters.accountName.value | Out-String) |
      Should -Match 'openAiAccountResourceIds'
    ($readerDeployments[0].properties.parameters.roleDefinitionGuid.value | Out-String) |
      Should -Match 'reader'
    $script:templateJson | Should -Match 'union'
    $script:templateJson | Should -Match ([Regex]::Escape('acdd72a7-3385-48ef-bd42-f606fba81ae7'))
    foreach ($accountParameter in @(
      'lunaOpenAiAccountResourceId'
      'terraOpenAiAccountResourceId'
      'solOpenAiAccountResourceId'
    )) {
      $script:templateJson | Should -Match $accountParameter
    }
  }

  It 'documents PKCE registration, consent, federated credential, and completion identity semantics' {
    $handoff = Get-Content -Path (Join-Path $script:repoRoot 'infra\ADMIN-HANDOFF.md') -Raw

    $handoff | Should -Match 'authorization code.*PKCE'
    $handoff | Should -Match 'requestedAccessTokenVersion.*2'
    $handoff | Should -Match 'admin consent'
    $handoff | Should -Match 'BFF app registration'
    $handoff | Should -Match 'federated credential'
    $handoff | Should -Match 'BFF managed.identity client ID'
    $handoff | Should -Match 'controlled\s+standalone orchestrator'
    $handoff | Should -Match 'ApproveProviderRegistration'
    $handoff | Should -Match 'deployApplications=false'
    $handoff | Should -Match 'deployApplications=true'
    $handoff | Should -Not -Match 'trusts forwarded human claims|uses the enabled Container Apps token store'
  }

  It 'aligns the Phase 5 API environment with the production runtime contract' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $phase5App = @($script:allResources | Where-Object {
      $_.type -eq 'Microsoft.App/containerApps' -and $_.name -match 'phase5AppName'
    })
    $phase5App.Count | Should -Be 1
    $phase5Env = @($phase5App[0].properties.template.containers[0].env)
    $phase5EnvNames = @($phase5Env | ForEach-Object name)
    foreach ($requiredName in @(
      'MODEL_PROVIDER_EVIDENCE_ID'
      'REGIONAL_DEPLOYMENT_EVIDENCE_ID'
      'PROMPT_GOVERNANCE_EVIDENCE_ID'
      'AZURE_SERVICEBUS_FQDN'
    )) {
      $phase5EnvNames | Should -Contain $requiredName
    }
    foreach ($obsoleteName in @(
      'AZURE_SERVICE_BUS_NAMESPACE'
      'AZURE_SERVICE_BUS_QUEUE_NAME'
      'AZURE_WORK_QUEUE_NAME'
    )) {
      $phase5EnvNames | Should -Not -Contain $obsoleteName
    }

    $phase5EnvText = $phase5Env | ConvertTo-Json -Depth 20
    $phase5EnvText | Should -Match 'modelProviderEvidenceId'
    $phase5EnvText | Should -Match 'regionalDeploymentEvidenceId'
    $phase5EnvText | Should -Match 'promptGovernanceEvidenceId'

    $standaloneSource = Get-Content -Path (Join-Path $script:repoRoot 'infra\standalone\main.bicep') -Raw
    foreach ($evidenceSetting in @{
      modelProviderEvidenceId = 'SEC-EVID-ROUTE-ALLOW-LIST-SNAPSHOT'
      regionalDeploymentEvidenceId = 'SEC-EVID-DEPLOYMENT-ALLOW-LIST-SNAPSHOT'
      promptGovernanceEvidenceId = 'SEC-EVID-PROMPT-TEMPLATE-HASH'
    }.GetEnumerator()) {
      ($script:template.parameters.($evidenceSetting.Key).allowedValues | Out-String) | Should -Match $evidenceSetting.Value
      $standaloneSource | Should -Match ([Regex]::Escape("$($evidenceSetting.Key): '$($evidenceSetting.Value)'"))
    }
  }

  It 'emits the ordered authoritative Phase 5 bootstrap and least-privilege grants' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $dataModuleSource = Get-Content -Path (Join-Path $script:repoRoot 'infra\modules\demo-data\main.bicep') -Raw
    $initialMigrationIndex = $dataModuleSource.IndexOf('${phase5InitialMigrationSql}')
    $authorityMigrationIndex = $dataModuleSource.IndexOf('${phase5AuthorityMigrationSql}')
    $projectionMigrationIndex = $dataModuleSource.IndexOf('${projectionMigrationSql}')
    $initialMigrationIndex | Should -BeGreaterThan 0
    $authorityMigrationIndex | Should -BeGreaterThan $initialMigrationIndex
    $projectionMigrationIndex | Should -BeGreaterThan $authorityMigrationIndex
    $dataModuleSource | Should -Match ([Regex]::Escape("loadTextContent('../../../../5-coding-r4/app/migrations/001_init.sql')"))
    $dataModuleSource | Should -Match ([Regex]::Escape("loadTextContent('../../../../5-coding-r4/app/migrations/002_demo_authority.sql')"))
    $dataModuleSource | Should -Match 'CREATE USER \[\$\{phase5IdentityName\}\] FROM EXTERNAL PROVIDER;'
    $dataModuleSource | Should -Match 'ALTER ROLE workload_api_role ADD MEMBER \[\$\{phase5IdentityName\}\];'
    $dataModuleSource | Should -Match 'GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.demo_scenario_projection TO \[\$\{bffIdentityName\}\];'
    $dataModuleSource | Should -Match 'GRANT SELECT ON OBJECT::dbo.approved_model_route_evidence TO \[\$\{verificationIdentityName\}\];'
    $dataModuleSource | Should -Not -Match 'demo_scenario_projection TO \[\$\{phase5IdentityName\}\]'
    $dataModuleSource | Should -Not -Match 'ALTER ROLE db_datareader ADD MEMBER'
    $dataModuleSource | Should -Not -Match 'ALTER ROLE db_datawriter ADD MEMBER'
    foreach ($outputName in @('sqlPhase5InitialMigrationSql', 'sqlPhase5AuthorityMigrationSql', 'sqlProjectionMigrationSql', 'sqlBootstrapSql')) {
      $script:template.outputs.PSObject.Properties.Name | Should -Contain $outputName
    }
  }

  It 'grants Phase 5 sender access only to its runtime queues and retains BFF analysis sender access' {
    if (-not $script:template) {
      Set-ItResult -Skipped -Because 'Template did not compile.'
      return
    }

    $rbacSource = Get-Content -Path (Join-Path $script:repoRoot 'infra\modules\demo-rbac\main.bicep') -Raw
    $mainSource = Get-Content -Path (Join-Path $script:repoRoot 'infra\main.bicep') -Raw
    foreach ($queueParameter in @('ingestionQueueName', 'extractionQueueName', 'indexingQueueName')) {
      $rbacSource | Should -Match ("  {0}" -f $queueParameter)
      $mainSource | Should -Match ("    {0}: {0}" -f $queueParameter)
    }
    $directParameterSource = Get-Content -Path (Join-Path $script:repoRoot 'infra\parameters\dev.bicepparam') -Raw
    $standaloneDataSource = Get-Content -Path (Join-Path $script:repoRoot 'infra\standalone\modules\data\main.bicep') -Raw
    $standaloneDataSource | Should -Match ([Regex]::Escape("var analysisQueueName = 'analysis-work'"))
    $directParameterSource | Should -Match ([Regex]::Escape("param serviceBusQueueName = 'analysis-work'"))
    foreach ($queueName in @('q-ingestion', 'q-extraction', 'q-indexing')) {
      $standaloneDataSource | Should -Match ([Regex]::Escape("name: '$queueName'"))
      $directParameterSource | Should -Match ([Regex]::Escape("'$queueName'"))
    }

    $rbacSource | Should -Match 'module bffServiceBusDataSender'
    $rbacSource | Should -Match 'queueName: serviceBusQueueName'
    $rbacSource | Should -Match 'module phase5ServiceBusDataSenders'
    $rbacSource | Should -Match 'queueName: queueName'
    $rbacSource | Should -Match 'serviceBusDataSender'
    $rbacSource | Should -Not -Match 'serviceBusDataReceiver'
    $rbacSource | Should -Not -Match '090c5a3c-8e7d-4c64-9b48-2f5785a7a1e6'
    $script:templateJson | Should -Not -Match '090c5a3c-8e7d-4c64-9b48-2f5785a7a1e6'
  }

  It 'reuses one compiled-template harness for all infrastructure assertions' {
    $testSource = Get-Content -Path $PSCommandPath -Raw
    $compileCommand = 'az bicep ' + 'build --file'
    ([Regex]::Matches($testSource, [Regex]::Escape($compileCommand))).Count | Should -Be 1
  }
}
