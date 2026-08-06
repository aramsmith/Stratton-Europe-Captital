targetScope = 'resourceGroup'

param location string
param tags object
param integration object
param workloadIdentityPrincipalIds object

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: integration.serviceBus.namespaceName
  location: location
  tags: tags
  sku: {
    name: integration.serviceBus.skuName
    tier: integration.serviceBus.tier
    capacity: integration.serviceBus.capacity
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    minimumTlsVersion: integration.serviceBus.minimumTlsVersion
    disableLocalAuth: true
    zoneRedundant: integration.serviceBus.zoneRedundant
  }
}

resource serviceBusQueues 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = [for queue in integration.serviceBus.queues: {
  parent: serviceBusNamespace
  name: queue.name
  properties: {
    requiresSession: queue.requiresSession
    requiresDuplicateDetection: queue.requiresDuplicateDetection
    duplicateDetectionHistoryTimeWindow: queue.duplicateDetectionHistoryTimeWindow
    defaultMessageTimeToLive: queue.defaultMessageTimeToLive
    maxDeliveryCount: queue.maxDeliveryCount
    deadLetteringOnMessageExpiration: queue.deadLetteringOnMessageExpiration
    lockDuration: queue.lockDuration
    maxSizeInMegabytes: queue.maxSizeInMegabytes
    enablePartitioning: false
  }
}]

resource serviceBusRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for assignment in integration.serviceBus.roleAssignments: {
  name: guid(serviceBusNamespace.id, assignment.identityName, assignment.roleDefinitionId)
  scope: serviceBusNamespace
  properties: {
    principalId: workloadIdentityPrincipalIds[assignment.identityName]
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assignment.roleDefinitionId)
  }
}]

resource apimService 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: integration.apim.name
  location: location
  tags: tags
  sku: {
    name: integration.apim.skuName
    capacity: integration.apim.capacity
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: integration.apim.publisherEmail
    publisherName: integration.apim.publisherName
    publicNetworkAccess: integration.apim.publicNetworkAccess
    virtualNetworkType: integration.apim.virtualNetworkType
    virtualNetworkConfiguration: integration.apim.virtualNetworkConfiguration
    disableGateway: false
    customProperties: integration.apim.customProperties
  }
}

output serviceBusNamespaceId string = serviceBusNamespace.id
output serviceBusQueueIds array = [for (queue, index) in integration.serviceBus.queues: serviceBusQueues[index].id]
output apimServiceId string = apimService.id

