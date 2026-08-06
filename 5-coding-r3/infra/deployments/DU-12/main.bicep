targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param workloadProfileVersion string
param tags object

module applicationPlatform '../../modules/application-platform/main.bicep' = {
  name: 'du12-app-platform-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.applicationResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    tags: union(tags, {
      workloadProfileVersion: workloadProfileVersion
    })
    platform: settings.platformByEnvironment[environment]
  }
}

output keyVaultId string = applicationPlatform.outputs.keyVaultId
output acrId string = applicationPlatform.outputs.acrId
output managedEnvironmentId string = applicationPlatform.outputs.managedEnvironmentId
output containerAppId string = applicationPlatform.outputs.containerAppId
output workerJobIds array = applicationPlatform.outputs.workerJobIds

