param location string
param namePrefix string
param tags object
param tenantId string
param entraAdministratorObjectId string
param entraAdministratorLogin string
param privateEndpointsSubnetId string
param sqlPrivateDnsZoneId string
param sqlServerName string
param storageAccountName string
param serviceBusNamespaceName string
param searchServiceName string

var sqlDatabaseName = '${namePrefix}-db'
var blobContainerName = 'admitted-evidence'
var analysisQueueName = 'analysis-work'

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Disabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      login: entraAdministratorLogin
      sid: entraAdministratorObjectId
      tenantId: tenantId
      azureADOnlyAuthentication: true
    }
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  tags: tags
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 1
  }
  properties: {
    createMode: 'Default'
    minCapacity: json('0.5')
    autoPauseDelay: 60
    requestedBackupStorageRedundancy: 'Local'
  }
}

resource sqlPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: '${namePrefix}-sql-pe'
  location: location
  tags: tags
  properties: {
    subnet: {
      id: privateEndpointsSubnetId
    }
    privateLinkServiceConnections: [
      {
        name: 'sqlServer'
        properties: {
          privateLinkServiceId: sqlServer.id
          groupIds: [
            'sqlServer'
          ]
        }
      }
    ]
  }
}

resource sqlPrivateDnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: sqlPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'sql'
        properties: {
          privateDnsZoneId: sqlPrivateDnsZoneId
        }
      }
    ]
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource admittedEvidenceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: blobContainerName
  properties: {
    publicAccess: 'None'
  }
}

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: serviceBusNamespaceName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

resource analysisQueue 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = {
  parent: serviceBusNamespace
  name: analysisQueueName
  properties: {
    enablePartitioning: false
  }
}

resource ingestionQueue 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = {
  parent: serviceBusNamespace
  name: 'q-ingestion'
  properties: {
    enablePartitioning: false
  }
}

resource extractionQueue 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = {
  parent: serviceBusNamespace
  name: 'q-extraction'
  properties: {
    enablePartitioning: false
  }
}

resource indexingQueue 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = {
  parent: serviceBusNamespace
  name: 'q-indexing'
  properties: {
    enablePartitioning: false
  }
}

resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: searchServiceName
  location: location
  tags: tags
  sku: {
    name: 'basic'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
  }
}

output sqlServerResourceId string = sqlServer.id
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabase.name
output sqlDatabaseResourceId string = sqlDatabase.id
output blobStorageAccountName string = storageAccount.name
output blobStorageAccountResourceId string = storageAccount.id
output blobStorageAccountUrl string = storageAccount.properties.primaryEndpoints.blob
output blobContainerName string = admittedEvidenceContainer.name
output serviceBusFqdn string = '${serviceBusNamespace.name}.servicebus.windows.net'
output serviceBusNamespaceResourceId string = serviceBusNamespace.id
output serviceBusQueueName string = analysisQueue.name
output ingestionQueueName string = ingestionQueue.name
output extractionQueueName string = extractionQueue.name
output indexingQueueName string = indexingQueue.name
output searchEndpoint string = 'https://${searchService.name}.search.windows.net'
output searchServiceResourceId string = searchService.id
output searchIndexName string = 'governed-evidence'
