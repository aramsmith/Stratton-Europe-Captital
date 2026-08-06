targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param supportActionGroupReceivers array
param tags object

var monitoringConfig = union(settings.monitoringByEnvironment[environment], {
  emailReceivers: supportActionGroupReceivers
})

module monitoring '../../modules/monitoring/main.bicep' = {
  name: 'du08-assurance-monitoring-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.monitoringResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    tags: union(tags, {
      telemetryOwner: 'internal-audit'
    })
    monitoring: monitoringConfig
  }
}

output workspaceId string = monitoring.outputs.workspaceId
output appInsightsId string = monitoring.outputs.appInsightsId
output actionGroupId string = monitoring.outputs.actionGroupId
