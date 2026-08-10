targetScope = 'subscription'

@description('Subscription that owns the standalone foundation and supplies globally unique name entropy.')
@minLength(36)
@maxLength(36)
param subscriptionId string

@description('Microsoft Entra tenant ID for Entra-only Azure SQL authentication.')
@minLength(36)
@maxLength(36)
param tenantId string

@description('Azure region for standalone foundation resources.')
param location string

@description('Resource group created by this subscription-scoped deployment.')
param resourceGroupName string

@description('Environment label applied to all foundation resources.')
param environmentName string

@description('Deploy application Container Apps and their runtime role assignments.')
param deployApplications bool = true

@description('Azure OpenAI region validated by the deployment preflight.')
param openAiLocation string

@description('Luna model selected by the deployment preflight.')
param lunaModelName string
param lunaModelVersion string
@minValue(1)
param lunaModelCapacity int

@description('Terra model selected by the deployment preflight.')
param terraModelName string
param terraModelVersion string
@minValue(1)
param terraModelCapacity int

@description('Sol model selected by the deployment preflight.')
param solModelName string
param solModelVersion string
@minValue(1)
param solModelCapacity int

@description('Full delegated BFF App ID URI scope requested by the web PKCE client.')
param webDelegatedScope string
param bffRequiredDelegatedScope string
@minLength(36)
@maxLength(36)
param phase5ApplicationId string
param phase5DelegatedScope string
param webImageRepository string
param webImageDigest string
param bffImageRepository string
param bffImageDigest string
param phase5ImageRepository string
param phase5ImageDigest string
param webContainerPort int
param bffContainerPort int
@minLength(36)
@maxLength(36)
param webEntraClientId string
@minLength(36)
@maxLength(36)
param bffEntraClientId string

param namePrefix string = 'stratton-demo'
param tags object = {}

var effectiveTags = union(tags, {
  'stratton.environment': environmentName
  'stratton.workload': 'demo-platform'
})
var uniqueSuffix = uniqueString(subscriptionId, resourceGroupName)
var registryName = toLower(take('${replace(namePrefix, '-', '')}acr${uniqueSuffix}', 50))
var sqlServerName = toLower(take('${replace(namePrefix, '-', '')}sql${uniqueSuffix}', 63))
var storageAccountName = toLower(take('${replace(namePrefix, '-', '')}st${uniqueSuffix}', 24))
var serviceBusNamespaceName = toLower(take('${namePrefix}-sb-${uniqueSuffix}', 50))
var searchServiceName = toLower(take('${namePrefix}-search-${uniqueSuffix}', 60))
var documentIntelligenceAccountName = toLower(take('${namePrefix}-docint-${uniqueSuffix}', 64))
var openAiAccountName = toLower(take('${namePrefix}-openai-${uniqueSuffix}', 64))

resource deploymentResourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: effectiveTags
}

module network './modules/network/main.bicep' = {
  name: '${namePrefix}-network'
  scope: deploymentResourceGroup
  params: {
    location: location
    namePrefix: namePrefix
    tags: effectiveTags
  }
}

module operations './modules/operations/main.bicep' = {
  name: '${namePrefix}-operations'
  scope: deploymentResourceGroup
  params: {
    location: location
    namePrefix: namePrefix
    tags: effectiveTags
    containerAppsSubnetId: network.outputs.containerAppsSubnetId
    registryName: registryName
  }
}

module data './modules/data/main.bicep' = {
  name: '${namePrefix}-data'
  scope: deploymentResourceGroup
  params: {
    location: location
    namePrefix: namePrefix
    tags: effectiveTags
    tenantId: tenantId
    bootstrapIdentityPrincipalId: operations.outputs.bootstrapIdentityPrincipalId
    privateEndpointsSubnetId: network.outputs.privateEndpointsSubnetId
    sqlPrivateDnsZoneId: network.outputs.sqlPrivateDnsZoneId
    sqlServerName: sqlServerName
    storageAccountName: storageAccountName
    serviceBusNamespaceName: serviceBusNamespaceName
    searchServiceName: searchServiceName
  }
}

module ai './modules/ai/main.bicep' = {
  name: '${namePrefix}-ai'
  scope: deploymentResourceGroup
  params: {
    location: location
    openAiLocation: openAiLocation
    tags: effectiveTags
    documentIntelligenceAccountName: documentIntelligenceAccountName
    openAiAccountName: openAiAccountName
    lunaModelName: lunaModelName
    lunaModelVersion: lunaModelVersion
    lunaModelCapacity: lunaModelCapacity
    terraModelName: terraModelName
    terraModelVersion: terraModelVersion
    terraModelCapacity: terraModelCapacity
    solModelName: solModelName
    solModelVersion: solModelVersion
    solModelCapacity: solModelCapacity
  }
}

module demoRuntimes '../main.bicep' = {
  name: '${namePrefix}-demo-runtimes'
  scope: deploymentResourceGroup
  params: {
    location: location
    tenantId: tenantId
    namePrefix: namePrefix
    tags: effectiveTags
    deployApplications: deployApplications
    containerAppsEnvironmentId: operations.outputs.containerAppsEnvironmentId
    containerRegistryId: operations.outputs.containerRegistryId
    containerRegistryServer: operations.outputs.containerRegistryServer
    logAnalyticsWorkspaceId: operations.outputs.logAnalyticsWorkspaceId
    sqlServerFqdn: data.outputs.sqlServerFqdn
    sqlDatabaseName: data.outputs.sqlDatabaseName
    sqlDatabaseResourceId: data.outputs.sqlDatabaseResourceId
    blobStorageAccountName: data.outputs.blobStorageAccountName
    blobStorageAccountResourceId: data.outputs.blobStorageAccountResourceId
    blobContainerName: data.outputs.blobContainerName
    serviceBusFqdn: data.outputs.serviceBusFqdn
    serviceBusNamespaceResourceId: data.outputs.serviceBusNamespaceResourceId
    serviceBusQueueName: data.outputs.serviceBusQueueName
    ingestionQueueName: data.outputs.ingestionQueueName
    extractionQueueName: data.outputs.extractionQueueName
    indexingQueueName: data.outputs.indexingQueueName
    searchEndpoint: data.outputs.searchEndpoint
    searchServiceResourceId: data.outputs.searchServiceResourceId
    searchIndexName: data.outputs.searchIndexName
    documentIntelligenceEndpoint: ai.outputs.documentIntelligenceEndpoint
    documentIntelligenceAccountResourceId: ai.outputs.documentIntelligenceAccountResourceId
    lunaOpenAiEndpoint: ai.outputs.lunaOpenAiEndpoint
    lunaOpenAiAccountResourceId: ai.outputs.lunaOpenAiAccountResourceId
    lunaOpenAiRegion: ai.outputs.lunaOpenAiRegion
    lunaOpenAiDeploymentId: ai.outputs.lunaOpenAiDeploymentId
    lunaOpenAiApiVersion: '2025-01-01-preview'
    lunaOpenAiEvidenceId: 'SEC-EVID-LUNA-ROUTE-v1'
    lunaOpenAiRouteEvidenceVersion: 'route-evidence-luna-v1'
    terraOpenAiEndpoint: ai.outputs.terraOpenAiEndpoint
    terraOpenAiAccountResourceId: ai.outputs.terraOpenAiAccountResourceId
    terraOpenAiRegion: ai.outputs.terraOpenAiRegion
    terraOpenAiDeploymentId: ai.outputs.terraOpenAiDeploymentId
    terraOpenAiApiVersion: '2025-01-01-preview'
    terraOpenAiEvidenceId: 'SEC-EVID-TERRA-ROUTE-v1'
    terraOpenAiRouteEvidenceVersion: 'route-evidence-terra-v1'
    solOpenAiEndpoint: ai.outputs.solOpenAiEndpoint
    solOpenAiAccountResourceId: ai.outputs.solOpenAiAccountResourceId
    solOpenAiRegion: ai.outputs.solOpenAiRegion
    solOpenAiDeploymentId: ai.outputs.solOpenAiDeploymentId
    solOpenAiApiVersion: '2025-01-01-preview'
    solOpenAiEvidenceId: 'SEC-EVID-SOL-ROUTE-v1'
    solOpenAiRouteEvidenceVersion: 'route-evidence-sol-v1'
    webDelegatedScope: webDelegatedScope
    bffRequiredDelegatedScope: bffRequiredDelegatedScope
    phase5ApplicationId: phase5ApplicationId
    modelProviderEvidenceId: 'SEC-EVID-ROUTE-ALLOW-LIST-SNAPSHOT'
    regionalDeploymentEvidenceId: 'SEC-EVID-DEPLOYMENT-ALLOW-LIST-SNAPSHOT'
    promptGovernanceEvidenceId: 'SEC-EVID-PROMPT-TEMPLATE-HASH'
    phase5DelegatedScope: phase5DelegatedScope
    webImageRepository: webImageRepository
    webImageDigest: webImageDigest
    bffImageRepository: bffImageRepository
    bffImageDigest: bffImageDigest
    phase5ImageRepository: phase5ImageRepository
    phase5ImageDigest: phase5ImageDigest
    webContainerPort: webContainerPort
    bffContainerPort: bffContainerPort
    webEntraClientId: webEntraClientId
    bffEntraClientId: bffEntraClientId
    webIdentityResourceId: operations.outputs.webIdentityResourceId
    webIdentityClientId: operations.outputs.webIdentityClientId
    webIdentityPrincipalId: operations.outputs.webIdentityPrincipalId
    bffIdentityResourceId: operations.outputs.bffIdentityResourceId
    bffIdentityClientId: operations.outputs.bffIdentityClientId
    bffIdentityPrincipalId: operations.outputs.bffIdentityPrincipalId
    phase5IdentityResourceId: operations.outputs.phase5IdentityResourceId
    phase5IdentityClientId: operations.outputs.phase5IdentityClientId
    phase5IdentityPrincipalId: operations.outputs.phase5IdentityPrincipalId
  }
}

output resourceGroupId string = deploymentResourceGroup.id
output containerAppsEnvironmentId string = operations.outputs.containerAppsEnvironmentId
output containerRegistryId string = operations.outputs.containerRegistryId
output containerRegistryServer string = operations.outputs.containerRegistryServer
output logAnalyticsWorkspaceId string = operations.outputs.logAnalyticsWorkspaceId
output sqlServerResourceId string = data.outputs.sqlServerResourceId
output sqlServerFqdn string = data.outputs.sqlServerFqdn
output sqlDatabaseName string = data.outputs.sqlDatabaseName
output sqlDatabaseResourceId string = data.outputs.sqlDatabaseResourceId
output blobStorageAccountName string = data.outputs.blobStorageAccountName
output blobStorageAccountResourceId string = data.outputs.blobStorageAccountResourceId
output blobStorageAccountUrl string = data.outputs.blobStorageAccountUrl
output blobContainerName string = data.outputs.blobContainerName
output serviceBusFqdn string = data.outputs.serviceBusFqdn
output serviceBusNamespaceResourceId string = data.outputs.serviceBusNamespaceResourceId
output serviceBusQueueName string = data.outputs.serviceBusQueueName
output ingestionQueueName string = data.outputs.ingestionQueueName
output extractionQueueName string = data.outputs.extractionQueueName
output indexingQueueName string = data.outputs.indexingQueueName
output searchEndpoint string = data.outputs.searchEndpoint
output searchServiceResourceId string = data.outputs.searchServiceResourceId
output searchIndexName string = data.outputs.searchIndexName
output documentIntelligenceEndpoint string = ai.outputs.documentIntelligenceEndpoint
output documentIntelligenceAccountResourceId string = ai.outputs.documentIntelligenceAccountResourceId
output lunaOpenAiEndpoint string = ai.outputs.lunaOpenAiEndpoint
output lunaOpenAiAccountResourceId string = ai.outputs.lunaOpenAiAccountResourceId
output lunaOpenAiRegion string = ai.outputs.lunaOpenAiRegion
output lunaOpenAiDeploymentId string = ai.outputs.lunaOpenAiDeploymentId
output terraOpenAiEndpoint string = ai.outputs.terraOpenAiEndpoint
output terraOpenAiAccountResourceId string = ai.outputs.terraOpenAiAccountResourceId
output terraOpenAiRegion string = ai.outputs.terraOpenAiRegion
output terraOpenAiDeploymentId string = ai.outputs.terraOpenAiDeploymentId
output solOpenAiEndpoint string = ai.outputs.solOpenAiEndpoint
output solOpenAiAccountResourceId string = ai.outputs.solOpenAiAccountResourceId
output solOpenAiRegion string = ai.outputs.solOpenAiRegion
output solOpenAiDeploymentId string = ai.outputs.solOpenAiDeploymentId
output webIdentityResourceId string = operations.outputs.webIdentityResourceId
output webIdentityClientId string = operations.outputs.webIdentityClientId
output webIdentityPrincipalId string = operations.outputs.webIdentityPrincipalId
output bffIdentityResourceId string = operations.outputs.bffIdentityResourceId
output bffIdentityClientId string = operations.outputs.bffIdentityClientId
output bffIdentityPrincipalId string = operations.outputs.bffIdentityPrincipalId
output phase5IdentityResourceId string = operations.outputs.phase5IdentityResourceId
output phase5IdentityClientId string = operations.outputs.phase5IdentityClientId
output phase5IdentityPrincipalId string = operations.outputs.phase5IdentityPrincipalId
output bootstrapIdentityResourceId string = operations.outputs.bootstrapIdentityResourceId
output bootstrapIdentityClientId string = operations.outputs.bootstrapIdentityClientId
output bootstrapIdentityPrincipalId string = operations.outputs.bootstrapIdentityPrincipalId

output webAppName string = demoRuntimes.outputs.webAppName
output webAppFqdn string = demoRuntimes.outputs.webAppFqdn
output bffAppName string = demoRuntimes.outputs.bffAppName
output bffAppFqdn string = demoRuntimes.outputs.bffAppFqdn
output phase5AppName string = demoRuntimes.outputs.phase5AppName
output phase5ApiFqdn string = demoRuntimes.outputs.phase5ApiFqdn
output roleAssignmentIds array = demoRuntimes.outputs.roleAssignmentIds
output sqlPhase5InitialMigrationSql string = demoRuntimes.outputs.sqlPhase5InitialMigrationSql
output sqlPhase5AuthorityMigrationSql string = demoRuntimes.outputs.sqlPhase5AuthorityMigrationSql
output sqlProjectionMigrationSql string = demoRuntimes.outputs.sqlProjectionMigrationSql
output sqlBootstrapSql string = demoRuntimes.outputs.sqlBootstrapSql
