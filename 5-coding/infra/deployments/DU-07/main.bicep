targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param supportActionGroupReceivers array
param retentionScheduleMapVersion string
param sourceRegisterVersion string
param tags object

var monitoringConfig = union(settings.monitoringByEnvironment[environment], {
  emailReceivers: supportActionGroupReceivers
})

module monitoring '../../modules/monitoring/main.bicep' = {
  name: 'du07-monitoring-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.monitoringResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    tags: union(tags, {
      retentionScheduleMapVersion: retentionScheduleMapVersion
      sourceRegisterVersion: sourceRegisterVersion
    })
    monitoring: monitoringConfig
  }
}

output workspaceId string = monitoring.outputs.workspaceId
output actionGroupId string = monitoring.outputs.actionGroupId
output alertIds array = monitoring.outputs.alertIds
