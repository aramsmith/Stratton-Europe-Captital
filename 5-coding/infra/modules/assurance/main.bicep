targetScope = 'resourceGroup'

param location string
param tags object
param assurance object

resource evidenceStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: assurance.evidenceStorage.name
  location: location
  tags: union(tags, assurance.evidenceStorage.tags)
  kind: 'StorageV2'
  sku: {
    name: assurance.evidenceStorage.skuName
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: assurance.evidenceStorage.networkBypass
      defaultAction: 'Deny'
      virtualNetworkRules: assurance.evidenceStorage.virtualNetworkRules
      ipRules: assurance.evidenceStorage.ipRules
    }
  }
}

resource verdictStorage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: assurance.verdictStorage.name
  location: location
  tags: union(tags, assurance.verdictStorage.tags)
  kind: 'StorageV2'
  sku: {
    name: assurance.verdictStorage.skuName
  }
  properties: {
    publicNetworkAccess: 'Disabled'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      bypass: assurance.verdictStorage.networkBypass
      defaultAction: 'Deny'
      virtualNetworkRules: assurance.verdictStorage.virtualNetworkRules
      ipRules: assurance.verdictStorage.ipRules
    }
  }
}

resource evidenceBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: evidenceStorage
  name: 'default'
  properties: {
    isVersioningEnabled: assurance.evidenceStorage.versioningEnabled
    deleteRetentionPolicy: {
      enabled: assurance.evidenceStorage.deleteRetentionEnabled
      days: assurance.evidenceStorage.deleteRetentionDays
    }
    containerDeleteRetentionPolicy: {
      enabled: assurance.evidenceStorage.containerDeleteRetentionEnabled
      days: assurance.evidenceStorage.containerDeleteRetentionDays
    }
  }
}

resource verdictBlobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: verdictStorage
  name: 'default'
  properties: {
    isVersioningEnabled: assurance.verdictStorage.versioningEnabled
    deleteRetentionPolicy: {
      enabled: assurance.verdictStorage.deleteRetentionEnabled
      days: assurance.verdictStorage.deleteRetentionDays
    }
    containerDeleteRetentionPolicy: {
      enabled: assurance.verdictStorage.containerDeleteRetentionEnabled
      days: assurance.verdictStorage.containerDeleteRetentionDays
    }
  }
}

resource evidenceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: evidenceBlobService
  name: assurance.evidenceStorage.containerName
  properties: {
    publicAccess: 'None'
    immutableStorageWithVersioning: {
      enabled: true
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
  }
}

resource verdictContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: verdictBlobService
  name: assurance.verdictStorage.containerName
  properties: {
    publicAccess: 'None'
    immutableStorageWithVersioning: {
      enabled: true
    }
    defaultEncryptionScope: '$account-encryption-key'
    denyEncryptionScopeOverride: false
  }
}

resource evidenceImmutabilityPolicy 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = {
  parent: evidenceContainer
  name: 'default'
  properties: {
    immutabilityPeriodSinceCreationInDays: assurance.evidenceStorage.immutabilityDays
    allowProtectedAppendWrites: true
    allowProtectedAppendWritesAll: false
  }
}

resource verdictImmutabilityPolicy 'Microsoft.Storage/storageAccounts/blobServices/containers/immutabilityPolicies@2023-05-01' = {
  parent: verdictContainer
  name: 'default'
  properties: {
    immutabilityPeriodSinceCreationInDays: assurance.verdictStorage.immutabilityDays
    allowProtectedAppendWrites: false
    allowProtectedAppendWritesAll: false
  }
}


resource deliveryEvidenceAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(evidenceContainer.id, assurance.deliveryPrincipalId, assurance.deliveryRoleDefinitionId)
  scope: evidenceContainer
  properties: {
    principalId: assurance.deliveryPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assurance.deliveryRoleDefinitionId)
  }
}

resource auditEvidenceReadAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(evidenceContainer.id, assurance.auditPrincipalId, assurance.auditEvidenceReadRoleDefinitionId)
  scope: evidenceContainer
  properties: {
    principalId: assurance.auditPrincipalId
    principalType: 'Group'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assurance.auditEvidenceReadRoleDefinitionId)
  }
}

resource auditVerdictAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(verdictContainer.id, assurance.auditPrincipalId, assurance.auditRoleDefinitionId)
  scope: verdictContainer
  properties: {
    principalId: assurance.auditPrincipalId
    principalType: 'Group'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assurance.auditRoleDefinitionId)
  }
}

output evidenceStorageId string = evidenceStorage.id
output verdictStorageId string = verdictStorage.id
output evidenceContainerId string = evidenceContainer.id
output verdictContainerId string = verdictContainer.id