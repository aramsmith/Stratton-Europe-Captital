param containerRegistryId string
param sqlDatabaseResourceId string
param blobStorageAccountResourceId string
param serviceBusNamespaceResourceId string
param searchServiceResourceId string
param documentIntelligenceAccountResourceId string
param openAiAccountResourceIds array
param webPrincipalId string
param bffPrincipalId string

var roleDefinitionGuids = {
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  storageBlobDataContributor: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
  serviceBusDataSender: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
  searchIndexDataReader: '1407120a-92aa-4202-b7e9-c0e197c71c8f'
  cognitiveServicesUser: 'a97b65f3-24c7-4388-baec-2e87135dc908'
  cognitiveServicesOpenAiUser: '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'
  sqlDbContributor: '9b7fa17d-e63e-47b0-bb0a-15c516ac86ec'
}

var containerRegistryName = split(containerRegistryId, '/')[8]
var sqlServerName = split(sqlDatabaseResourceId, '/')[8]
var sqlDatabaseName = split(sqlDatabaseResourceId, '/')[10]
var blobStorageAccountName = split(blobStorageAccountResourceId, '/')[8]
var serviceBusNamespaceName = split(serviceBusNamespaceResourceId, '/')[8]
var searchServiceName = split(searchServiceResourceId, '/')[8]
var documentIntelligenceAccountName = split(documentIntelligenceAccountResourceId, '/')[8]
var uniqueOpenAiAccountResourceIds = union(openAiAccountResourceIds, [])
var openAiAccountNames = [for id in uniqueOpenAiAccountResourceIds: split(id, '/')[8]]

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' existing = {
  name: containerRegistryName
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' existing = {
  name: sqlServerName
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' existing = {
  parent: sqlServer
  name: sqlDatabaseName
}

resource blobStorage 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: blobStorageAccountName
}

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2024-01-01' existing = {
  name: serviceBusNamespaceName
}

resource searchService 'Microsoft.Search/searchServices@2023-11-01' existing = {
  name: searchServiceName
}

resource documentIntelligenceAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: documentIntelligenceAccountName
}

resource openAiAccounts 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = [for accountName in openAiAccountNames: {
  name: accountName
}]

resource webAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, webPrincipalId, roleDefinitionGuids.acrPull)
  scope: containerRegistry
  properties: {
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionGuids.acrPull)
  }
}

resource bffAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, bffPrincipalId, roleDefinitionGuids.acrPull)
  scope: containerRegistry
  properties: {
    principalId: bffPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionGuids.acrPull)
  }
}

resource bffSqlDbContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sqlDatabase.id, bffPrincipalId, roleDefinitionGuids.sqlDbContributor)
  scope: sqlDatabase
  properties: {
    principalId: bffPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionGuids.sqlDbContributor)
  }
}

resource bffBlobDataContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(blobStorage.id, bffPrincipalId, roleDefinitionGuids.storageBlobDataContributor)
  scope: blobStorage
  properties: {
    principalId: bffPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionGuids.storageBlobDataContributor)
  }
}

resource bffServiceBusDataSender 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(serviceBusNamespace.id, bffPrincipalId, roleDefinitionGuids.serviceBusDataSender)
  scope: serviceBusNamespace
  properties: {
    principalId: bffPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionGuids.serviceBusDataSender)
  }
}

resource bffSearchIndexDataReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(searchService.id, bffPrincipalId, roleDefinitionGuids.searchIndexDataReader)
  scope: searchService
  properties: {
    principalId: bffPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionGuids.searchIndexDataReader)
  }
}

resource bffDocumentIntelligenceUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(documentIntelligenceAccount.id, bffPrincipalId, roleDefinitionGuids.cognitiveServicesUser)
  scope: documentIntelligenceAccount
  properties: {
    principalId: bffPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionGuids.cognitiveServicesUser)
  }
}

resource bffOpenAiUsers 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for i in range(0, length(openAiAccountNames)): {
  name: guid(openAiAccounts[i].id, bffPrincipalId, roleDefinitionGuids.cognitiveServicesOpenAiUser)
  scope: openAiAccounts[i]
  properties: {
    principalId: bffPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionGuids.cognitiveServicesOpenAiUser)
  }
}]

output roleAssignmentIds array = [
  webAcrPull.id
  bffAcrPull.id
  bffSqlDbContributor.id
  bffBlobDataContributor.id
  bffServiceBusDataSender.id
  bffSearchIndexDataReader.id
  bffDocumentIntelligenceUser.id
]
