targetScope = 'resourceGroup'

param location string
param tags object
param platform object

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: platform.keyVault.name
  location: location
  tags: tags
  properties: {
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    sku: {
      family: 'A'
      name: platform.keyVault.skuName
    }
    publicNetworkAccess: 'Disabled'
    networkAcls: {
      bypass: platform.keyVault.networkBypass
      defaultAction: 'Deny'
      ipRules: platform.keyVault.ipRules
      virtualNetworkRules: platform.keyVault.virtualNetworkRules
    }
    softDeleteRetentionInDays: platform.keyVault.softDeleteRetentionInDays
    enablePurgeProtection: platform.keyVault.enablePurgeProtection
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: platform.acr.name
  location: location
  tags: tags
  sku: {
    name: platform.acr.skuName
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Disabled'
    dataEndpointEnabled: false
    zoneRedundancy: platform.acr.zoneRedundancy
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: platform.managedEnvironment.name
  location: location
  tags: tags
  properties: {
    vnetConfiguration: {
      infrastructureSubnetId: platform.managedEnvironment.infrastructureSubnetId
      internal: true
    }
    appLogsConfiguration: platform.managedEnvironment.appLogsConfiguration
    workloadProfiles: platform.managedEnvironment.workloadProfiles
    zoneRedundant: platform.managedEnvironment.zoneRedundant
  }
}

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: platform.apiApp.name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: platform.apiApp.userAssignedIdentities
  }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: false
        targetPort: platform.apiApp.targetPort
        transport: platform.apiApp.transport
        allowInsecure: false
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
      }
      registries: [
        {
          server: platform.apiApp.registry.server
          identity: platform.apiApp.registry.identityResourceId
        }
      ]
      secrets: platform.apiApp.secrets
    }
    template: {
      containers: [
        {
          name: platform.apiApp.containerName
          image: platform.apiApp.imageDigest
          env: platform.apiApp.environmentVariables
          probes: platform.apiApp.probes
          resources: platform.apiApp.resources
        }
      ]
      scale: {
        minReplicas: platform.apiApp.minReplicas
        maxReplicas: platform.apiApp.maxReplicas
        rules: platform.apiApp.scaleRules
      }
    }
  }
}

resource containerAppAuth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  parent: containerApp
  name: 'current'
  properties: platform.apiApp.authConfig
}

resource workerJobs 'Microsoft.App/jobs@2024-03-01' = [for workerJob in platform.workerJobs: {
  name: workerJob.name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: workerJob.userAssignedIdentities
  }
  properties: {
    environmentId: managedEnvironment.id
    configuration: {
      triggerType: 'Event'
      replicaRetryLimit: workerJob.replicaRetryLimit
      replicaTimeout: workerJob.replicaTimeout
      eventTriggerConfig: {
        scale: {
          minExecutions: workerJob.minExecutions
          maxExecutions: workerJob.maxExecutions
          pollingInterval: workerJob.pollingInterval
          rules: workerJob.scaleRules
        }
      }
      registries: [
        {
          server: workerJob.registry.server
          identity: workerJob.registry.identityResourceId
        }
      ]
      secrets: workerJob.secrets
    }
    template: {
      containers: [
        {
          name: workerJob.containerName
          image: workerJob.imageDigest
          env: workerJob.environmentVariables
          resources: workerJob.resources
        }
      ]
    }
  }
}]

resource acrPullAssignmentsApi 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for principal in platform.apiApp.identityPrincipalIds: {
  name: guid(acr.id, principal, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    principalId: principal
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}]

resource acrPullAssignmentsWorker 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for workerJob in platform.workerJobs: {
  name: guid(acr.id, workerJob.identityPrincipalId, workerJob.name, '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  scope: acr
  properties: {
    principalId: workerJob.identityPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}]

output keyVaultId string = keyVault.id
output acrId string = acr.id
output managedEnvironmentId string = managedEnvironment.id
output containerAppId string = containerApp.id
output workerJobIds array = [for (workerJob, index) in platform.workerJobs: workerJobs[index].id]
