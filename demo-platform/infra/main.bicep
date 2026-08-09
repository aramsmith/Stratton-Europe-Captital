targetScope = 'resourceGroup'

@description('Azure region for demo-owned resources.')
param location string

@description('Microsoft Entra tenant ID for tenant-isolated demo execution.')
@minLength(36)
@maxLength(36)
param tenantId string

@description('Fixed demo case identifier used for case-isolated outputs and SQL bootstrap guidance.')
param caseId string = 'project-danube'

@description('Name prefix for demo-owned resources in this resource group.')
param namePrefix string = 'stratton-demo'

@description('Tags applied to demo-owned resources.')
param tags object = {}

@description('Existing Container Apps managed environment resource ID.')
param containerAppsEnvironmentId string

@description('Existing Azure Container Registry resource ID.')
param containerRegistryId string

@description('Existing Azure Container Registry login server, for example contoso.azurecr.io.')
param containerRegistryServer string

@description('Existing Log Analytics workspace resource ID for diagnostics.')
param logAnalyticsWorkspaceId string

@description('Existing Azure SQL server FQDN for the BFF application.')
param sqlServerFqdn string

@description('Existing Azure SQL database name for the BFF application.')
param sqlDatabaseName string

@description('Existing Azure SQL database resource ID used for RBAC and diagnostics.')
param sqlDatabaseResourceId string

@description('Existing Blob storage account name used to derive the approved account URL.')
param blobStorageAccountName string

@description('Existing Blob storage account resource ID used for RBAC.')
param blobStorageAccountResourceId string

@description('Existing Blob container name that stores admitted evidence.')
param blobContainerName string

@description('Existing Service Bus namespace FQDN, for example contoso.servicebus.windows.net.')
param serviceBusFqdn string

@description('Existing Service Bus namespace resource ID used for RBAC.')
param serviceBusNamespaceResourceId string

@description('Existing Service Bus queue name for analysis workflow events.')
param serviceBusQueueName string

@description('Existing Azure AI Search endpoint.')
param searchEndpoint string

@description('Existing Azure AI Search service resource ID used for RBAC.')
param searchServiceResourceId string

@description('Existing Azure AI Search index name for admitted evidence retrieval.')
param searchIndexName string

@description('Existing Document Intelligence endpoint.')
param documentIntelligenceEndpoint string

@description('Existing Document Intelligence resource ID used for RBAC.')
param documentIntelligenceAccountResourceId string

@description('Approved Luna Azure OpenAI endpoint.')
param lunaOpenAiEndpoint string

@description('Existing Luna Azure OpenAI account resource ID used for RBAC.')
param lunaOpenAiAccountResourceId string

@description('Approved EU Azure region for Luna.')
param lunaOpenAiRegion string

@description('Approved Luna deployment identifier.')
param lunaOpenAiDeploymentId string

@description('Approved Luna API version.')
param lunaOpenAiApiVersion string

@description('Evidence identifier that authorizes the Luna route.')
param lunaOpenAiEvidenceId string

@description('Expected Phase 5 evidence version that authorizes the Luna route.')
param lunaOpenAiRouteEvidenceVersion string

@description('Approved Terra Azure OpenAI endpoint.')
param terraOpenAiEndpoint string

@description('Existing Terra Azure OpenAI account resource ID used for RBAC.')
param terraOpenAiAccountResourceId string

@description('Approved EU Azure region for Terra.')
param terraOpenAiRegion string

@description('Approved Terra deployment identifier.')
param terraOpenAiDeploymentId string

@description('Approved Terra API version.')
param terraOpenAiApiVersion string

@description('Evidence identifier that authorizes the Terra route.')
param terraOpenAiEvidenceId string

@description('Expected Phase 5 evidence version that authorizes the Terra route.')
param terraOpenAiRouteEvidenceVersion string

@description('Approved Sol Azure OpenAI endpoint.')
param solOpenAiEndpoint string

@description('Existing Sol Azure OpenAI account resource ID used for RBAC.')
param solOpenAiAccountResourceId string

@description('Approved EU Azure region for Sol.')
param solOpenAiRegion string

@description('Approved Sol deployment identifier.')
param solOpenAiDeploymentId string

@description('Approved Sol API version.')
param solOpenAiApiVersion string

@description('Evidence identifier that authorizes the Sol route.')
param solOpenAiEvidenceId string

@description('Expected Phase 5 evidence version that authorizes the Sol route.')
param solOpenAiRouteEvidenceVersion string

@description('Explicit Phase 5 base URL required by the current BFF configuration contract.')
param phase5ApiBaseUrl string

@description('Full delegated BFF App ID URI scope requested by MSAL Browser authorization-code + PKCE.')
param webDelegatedScope string

@description('Delegated user scope required by the BFF.')
param bffRequiredDelegatedScope string

@description('Application ID of the immutable Phase 5 API authority.')
param phase5ApplicationId string

@description('Delegated OAuth scope requested by the BFF OBO exchange for Phase 5.')
param phase5DelegatedScope string

@description('Repository path within the approved container registry for the web image.')
param webImageRepository string

@description('Immutable SHA-256 digest for the web image, for example sha256:abc123...')
param webImageDigest string

@description('Repository path within the approved container registry for the BFF image.')
param bffImageRepository string

@description('Immutable SHA-256 digest for the BFF image, for example sha256:def456...')
param bffImageDigest string

@description('Container port exposed by the web image.')
param webContainerPort int

@description('Container port exposed by the BFF image.')
param bffContainerPort int

@description('Web application Microsoft Entra client ID.')
@minLength(36)
@maxLength(36)
param webEntraClientId string

@description('BFF application Microsoft Entra client ID.')
@minLength(36)
@maxLength(36)
param bffEntraClientId string

var blobAccountUrl = 'https://${blobStorageAccountName}.blob.${environment().suffixes.storage}'
var sqlDatabaseResourceIdParts = split(sqlDatabaseResourceId, '/')

module demoApps './modules/demo-apps/main.bicep' = {
  name: '${namePrefix}-apps'
  params: {
    location: location
    tenantId: tenantId
    namePrefix: namePrefix
    tags: tags
    containerAppsEnvironmentId: containerAppsEnvironmentId
    containerRegistryServer: containerRegistryServer
    logAnalyticsWorkspaceId: logAnalyticsWorkspaceId
    webImageRepository: webImageRepository
    webImageDigest: webImageDigest
    bffImageRepository: bffImageRepository
    bffImageDigest: bffImageDigest
    webContainerPort: webContainerPort
    bffContainerPort: bffContainerPort
    phase5ApiBaseUrl: phase5ApiBaseUrl
    webDelegatedScope: webDelegatedScope
    bffRequiredDelegatedScope: bffRequiredDelegatedScope
    phase5ApplicationId: phase5ApplicationId
    phase5DelegatedScope: phase5DelegatedScope
    sqlServerFqdn: sqlServerFqdn
    sqlDatabaseName: sqlDatabaseName
    blobAccountUrl: blobAccountUrl
    blobContainerName: blobContainerName
    serviceBusFqdn: serviceBusFqdn
    serviceBusQueueName: serviceBusQueueName
    searchEndpoint: searchEndpoint
    searchIndexName: searchIndexName
    documentIntelligenceEndpoint: documentIntelligenceEndpoint
    lunaOpenAiEndpoint: lunaOpenAiEndpoint
    lunaOpenAiResourceId: lunaOpenAiAccountResourceId
    lunaOpenAiRegion: lunaOpenAiRegion
    lunaOpenAiDeploymentId: lunaOpenAiDeploymentId
    lunaOpenAiApiVersion: lunaOpenAiApiVersion
    lunaOpenAiEvidenceId: lunaOpenAiEvidenceId
    lunaOpenAiRouteEvidenceVersion: lunaOpenAiRouteEvidenceVersion
    terraOpenAiEndpoint: terraOpenAiEndpoint
    terraOpenAiResourceId: terraOpenAiAccountResourceId
    terraOpenAiRegion: terraOpenAiRegion
    terraOpenAiDeploymentId: terraOpenAiDeploymentId
    terraOpenAiApiVersion: terraOpenAiApiVersion
    terraOpenAiEvidenceId: terraOpenAiEvidenceId
    terraOpenAiRouteEvidenceVersion: terraOpenAiRouteEvidenceVersion
    solOpenAiEndpoint: solOpenAiEndpoint
    solOpenAiResourceId: solOpenAiAccountResourceId
    solOpenAiRegion: solOpenAiRegion
    solOpenAiDeploymentId: solOpenAiDeploymentId
    solOpenAiApiVersion: solOpenAiApiVersion
    solOpenAiEvidenceId: solOpenAiEvidenceId
    solOpenAiRouteEvidenceVersion: solOpenAiRouteEvidenceVersion
    webEntraClientId: webEntraClientId
    bffEntraClientId: bffEntraClientId
  }
}

module demoData './modules/demo-data/main.bicep' = {
  name: '${namePrefix}-data'
  scope: resourceGroup(sqlDatabaseResourceIdParts[2], sqlDatabaseResourceIdParts[4])
  params: {
    namePrefix: namePrefix
    sqlDatabaseResourceId: sqlDatabaseResourceId
    logAnalyticsWorkspaceId: logAnalyticsWorkspaceId
    sqlServerFqdn: sqlServerFqdn
    sqlDatabaseName: sqlDatabaseName
    tenantId: tenantId
    caseId: caseId
    bffIdentityName: demoApps.outputs.bffIdentityName
  }
}

module demoRbac './modules/demo-rbac/main.bicep' = {
  name: '${namePrefix}-rbac'
  params: {
    containerRegistryId: containerRegistryId
    blobStorageAccountResourceId: blobStorageAccountResourceId
    blobContainerName: blobContainerName
    serviceBusNamespaceResourceId: serviceBusNamespaceResourceId
    serviceBusQueueName: serviceBusQueueName
    searchServiceResourceId: searchServiceResourceId
    documentIntelligenceAccountResourceId: documentIntelligenceAccountResourceId
    lunaOpenAiAccountResourceId: lunaOpenAiAccountResourceId
    terraOpenAiAccountResourceId: terraOpenAiAccountResourceId
    solOpenAiAccountResourceId: solOpenAiAccountResourceId
    webPrincipalId: demoApps.outputs.webIdentityPrincipalId
    bffPrincipalId: demoApps.outputs.bffIdentityPrincipalId
  }
}

output webAppName string = demoApps.outputs.webAppName
output webAppId string = demoApps.outputs.webAppId
output webAppFqdn string = demoApps.outputs.webAppFqdn
output webIdentityResourceId string = demoApps.outputs.webIdentityResourceId
output webIdentityClientId string = demoApps.outputs.webIdentityClientId
output bffAppName string = demoApps.outputs.bffAppName
output bffAppId string = demoApps.outputs.bffAppId
output bffAppFqdn string = demoApps.outputs.bffAppFqdn
output bffIdentityResourceId string = demoApps.outputs.bffIdentityResourceId
output bffIdentityClientId string = demoApps.outputs.bffIdentityClientId
output sqlProjectionMigrationSql string = demoData.outputs.projectionMigrationSql
output sqlBootstrapSql string = demoData.outputs.bootstrapSql
output sqlSessionIsolationNotes object = demoData.outputs.sessionIsolationNotes
output roleAssignmentIds array = concat(
  demoRbac.outputs.roleAssignmentIds,
  demoRbac.outputs.openAiRoleAssignmentIds,
  demoRbac.outputs.openAiReaderRoleAssignmentIds
)
