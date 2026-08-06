targetScope = 'resourceGroup'

param containerRegistryId string
param blobStorageAccountResourceId string
param blobContainerName string
param serviceBusNamespaceResourceId string
param serviceBusQueueName string
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
}

var uniqueOpenAiAccountResourceIds = union(openAiAccountResourceIds, [])

module webAcrPull './role-assignments/acr-role-assignment.bicep' = {
  name: 'web-acr-pull'
  scope: resourceGroup(split(containerRegistryId, '/')[2], split(containerRegistryId, '/')[4])
  params: {
    registryName: split(containerRegistryId, '/')[8]
    principalId: webPrincipalId
    roleDefinitionGuid: roleDefinitionGuids.acrPull
  }
}

module bffAcrPull './role-assignments/acr-role-assignment.bicep' = {
  name: 'bff-acr-pull'
  scope: resourceGroup(split(containerRegistryId, '/')[2], split(containerRegistryId, '/')[4])
  params: {
    registryName: split(containerRegistryId, '/')[8]
    principalId: bffPrincipalId
    roleDefinitionGuid: roleDefinitionGuids.acrPull
  }
}

module bffBlobDataContributor './role-assignments/storage-account-role-assignment.bicep' = {
  name: 'bff-blob-data-contributor'
  scope: resourceGroup(split(blobStorageAccountResourceId, '/')[2], split(blobStorageAccountResourceId, '/')[4])
  params: {
    storageAccountName: split(blobStorageAccountResourceId, '/')[8]
    containerName: blobContainerName
    principalId: bffPrincipalId
    roleDefinitionGuid: roleDefinitionGuids.storageBlobDataContributor
  }
}

module bffServiceBusDataSender './role-assignments/service-bus-role-assignment.bicep' = {
  name: 'bff-servicebus-data-sender'
  scope: resourceGroup(split(serviceBusNamespaceResourceId, '/')[2], split(serviceBusNamespaceResourceId, '/')[4])
  params: {
    namespaceName: split(serviceBusNamespaceResourceId, '/')[8]
    queueName: serviceBusQueueName
    principalId: bffPrincipalId
    roleDefinitionGuid: roleDefinitionGuids.serviceBusDataSender
  }
}

module bffSearchIndexDataReader './role-assignments/search-role-assignment.bicep' = {
  name: 'bff-search-index-data-reader'
  scope: resourceGroup(split(searchServiceResourceId, '/')[2], split(searchServiceResourceId, '/')[4])
  params: {
    searchServiceName: split(searchServiceResourceId, '/')[8]
    principalId: bffPrincipalId
    roleDefinitionGuid: roleDefinitionGuids.searchIndexDataReader
  }
}

module bffDocumentIntelligenceUser './role-assignments/cognitive-account-role-assignment.bicep' = {
  name: 'bff-document-intelligence-user'
  scope: resourceGroup(split(documentIntelligenceAccountResourceId, '/')[2], split(documentIntelligenceAccountResourceId, '/')[4])
  params: {
    accountName: split(documentIntelligenceAccountResourceId, '/')[8]
    principalId: bffPrincipalId
    roleDefinitionGuid: roleDefinitionGuids.cognitiveServicesUser
  }
}

module bffOpenAiUsers './role-assignments/cognitive-account-role-assignment.bicep' = [for (accountResourceId, index) in uniqueOpenAiAccountResourceIds: {
  name: 'bff-openai-user-${index}'
  scope: resourceGroup(split(accountResourceId, '/')[2], split(accountResourceId, '/')[4])
  params: {
    accountName: split(accountResourceId, '/')[8]
    principalId: bffPrincipalId
    roleDefinitionGuid: roleDefinitionGuids.cognitiveServicesOpenAiUser
  }
}]

output roleAssignmentIds array = [
  webAcrPull.outputs.roleAssignmentId
  bffAcrPull.outputs.roleAssignmentId
  bffBlobDataContributor.outputs.roleAssignmentId
  bffServiceBusDataSender.outputs.roleAssignmentId
  bffSearchIndexDataReader.outputs.roleAssignmentId
  bffDocumentIntelligenceUser.outputs.roleAssignmentId
]

output openAiRoleAssignmentIds array = [for i in range(0, length(uniqueOpenAiAccountResourceIds)): bffOpenAiUsers[i].outputs.roleAssignmentId]
