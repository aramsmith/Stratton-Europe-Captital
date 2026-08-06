targetScope = 'resourceGroup'

param location string
param tags object
param tenantId string
param data object

resource sqlPrimary 'Microsoft.Sql/servers@2023-08-01' = {
  name: data.sql.primaryServerName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    version: '12.0'
    minimalTlsVersion: data.sql.minimalTlsVersion
    publicNetworkAccess: 'Disabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      login: data.sql.entraAdmin.displayName
      sid: data.sql.entraAdmin.objectId
      tenantId: tenantId
      azureADOnlyAuthentication: true
    }
  }
}

resource sqlRecovery 'Microsoft.Sql/servers@2023-08-01' = {
  name: data.sql.recoveryServerName
  location: data.sql.recoveryLocation
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    version: '12.0'
    minimalTlsVersion: data.sql.minimalTlsVersion
    publicNetworkAccess: 'Disabled'
    administrators: {
      administratorType: 'ActiveDirectory'
      login: data.sql.entraAdmin.displayName
      sid: data.sql.entraAdmin.objectId
      tenantId: tenantId
      azureADOnlyAuthentication: true
    }
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: sqlPrimary
  name: data.sql.databaseName
  location: location
  sku: data.sql.databaseSku
  properties: {
    zoneRedundant: data.sql.zoneRedundant
    readScale: data.sql.readScale
    requestedBackupStorageRedundancy: data.sql.backupStorageRedundancy
  }
}

resource failoverGroup 'Microsoft.Sql/servers/failoverGroups@2023-08-01' = {
  parent: sqlPrimary
  name: data.sql.failoverGroupName
  properties: {
    readWriteEndpoint: {
      failoverPolicy: data.sql.failoverPolicy
      failoverWithDataLossGracePeriodMinutes: data.sql.failoverGraceMinutes
    }
    readOnlyEndpoint: {
      failoverPolicy: 'Disabled'
    }
    partnerServers: [
      {
        id: sqlRecovery.id
      }
    ]
    databases: [
      sqlDatabase.id
    ]
  }
}

resource sqlSecurityAlertPolicies 'Microsoft.Sql/servers/securityAlertPolicies@2023-08-01' = {
  parent: sqlPrimary
  name: 'default'
  properties: {
    state: 'Enabled'
    emailAccountAdmins: false
    emailAddresses: data.sql.securityAlertEmails
    disabledAlerts: []
    retentionDays: data.sql.securityAlertRetentionDays
  }
}


resource sqlExtendedAuditing 'Microsoft.Sql/servers/extendedAuditingSettings@2023-08-01' = {
  parent: sqlPrimary
  name: 'default'
  properties: {
    state: 'Enabled'
    isAzureMonitorTargetEnabled: true
    retentionDays: data.sql.auditingRetentionDays
    storageEndpoint: data.sql.auditingStorageEndpoint
  }
}

resource appConfiguration 'Microsoft.AppConfiguration/configurationStores@2024-05-01' = {
  name: data.appConfiguration.name
  location: location
  tags: tags
  sku: {
    name: data.appConfiguration.skuName
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
    softDeleteRetentionInDays: data.appConfiguration.softDeleteRetentionInDays
    encryption: {
      keyVaultProperties: data.appConfiguration.keyVaultProperties
    }
  }
}

resource appConfigurationRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for assignment in data.appConfiguration.roleAssignments: {
  name: guid(appConfiguration.id, assignment.principalId, assignment.roleDefinitionId)
  scope: appConfiguration
  properties: {
    principalId: assignment.principalId
    principalType: assignment.principalType
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assignment.roleDefinitionId)
  }
}]

resource storageAccounts 'Microsoft.Storage/storageAccounts@2023-05-01' = [for storage in data.storageAccounts: {
  name: storage.name
  location: storage.location
  tags: union(tags, storage.tags)
  kind: 'StorageV2'
  sku: {
    name: storage.skuName
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: storage.networkBypass
      defaultAction: 'Deny'
      virtualNetworkRules: storage.virtualNetworkRules
      ipRules: storage.ipRules
    }
    accessTier: storage.accessTier
  }
}]

resource storageBlobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = [for (storage, index) in data.storageAccounts: {
  parent: storageAccounts[index]
  name: 'default'
  properties: {
    isVersioningEnabled: storage.blobVersioningEnabled
    deleteRetentionPolicy: {
      enabled: storage.deleteRetentionEnabled
      days: storage.deleteRetentionDays
    }
    containerDeleteRetentionPolicy: {
      enabled: storage.containerDeleteRetentionEnabled
      days: storage.containerDeleteRetentionDays
    }
  }
}]

resource storageContainers 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = [for container in data.storageContainers: {
  parent: storageBlobServices[container.storageIndex]
  name: container.name
  properties: {
    publicAccess: 'None'
    immutableStorageWithVersioning: {
      enabled: container.immutableStorageWithVersioningEnabled
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
  }
}]

output sqlServerId string = sqlPrimary.id
output sqlDatabaseId string = sqlDatabase.id
output sqlRecoveryServerId string = sqlRecovery.id
output sqlFailoverGroupId string = failoverGroup.id
output storageAccountIds array = [for (storage, index) in data.storageAccounts: storageAccounts[index].id]
output appConfigurationId string = appConfiguration.id

