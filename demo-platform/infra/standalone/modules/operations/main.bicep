param location string
param namePrefix string
param tags object
param containerAppsSubnetId string
param registryName string

var logAnalyticsName = '${namePrefix}-log'
var containerAppsEnvironmentName = '${namePrefix}-cae'

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
    policies: {
      retentionPolicy: {
        days: 7
        status: 'enabled'
      }
    }
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    vnetConfiguration: {
      infrastructureSubnetId: containerAppsSubnetId
      internal: false
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

resource webIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-web-mi'
  location: location
  tags: union(tags, { 'stratton.component': 'web' })
}

resource bffIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-bff-mi'
  location: location
  tags: union(tags, { 'stratton.component': 'bff' })
}

resource phase5Identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-phase5-mi'
  location: location
  tags: union(tags, { 'stratton.component': 'phase5' })
}

resource bootstrapIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${namePrefix}-bootstrap-mi'
  location: location
  tags: union(tags, { 'stratton.component': 'bootstrap' })
}

output containerAppsEnvironmentId string = containerAppsEnvironment.id
output containerRegistryId string = registry.id
output containerRegistryServer string = registry.properties.loginServer
output logAnalyticsWorkspaceId string = logAnalytics.id
output webIdentityResourceId string = webIdentity.id
output webIdentityClientId string = webIdentity.properties.clientId
output webIdentityPrincipalId string = webIdentity.properties.principalId
output bffIdentityResourceId string = bffIdentity.id
output bffIdentityClientId string = bffIdentity.properties.clientId
output bffIdentityPrincipalId string = bffIdentity.properties.principalId
output phase5IdentityResourceId string = phase5Identity.id
output phase5IdentityClientId string = phase5Identity.properties.clientId
output phase5IdentityPrincipalId string = phase5Identity.properties.principalId
output bootstrapIdentityResourceId string = bootstrapIdentity.id
output bootstrapIdentityClientId string = bootstrapIdentity.properties.clientId
output bootstrapIdentityPrincipalId string = bootstrapIdentity.properties.principalId
