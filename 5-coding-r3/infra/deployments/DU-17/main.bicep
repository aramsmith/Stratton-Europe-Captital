targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param supportActionGroupReceivers array
param businessHoursDefinitionId string
param criticalAlertDefinitionId string
param tags object

var diagnosticsConfig = settings.diagnosticsByEnvironment[environment]
var assuranceAlerts = [for alert in diagnosticsConfig.assuranceAlerts: union(alert, {
  notificationReceivers: supportActionGroupReceivers
})]

module diagnostics '../../modules/diagnostics/main.bicep' = {
  name: 'du17-diagnostics-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.diagnosticsResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    workspaceResourceId: diagnosticsConfig.workspaceResourceId
    actionGroupResourceId: diagnosticsConfig.actionGroupResourceId
    tags: union(tags, {
      businessHoursDefinitionId: businessHoursDefinitionId
      criticalAlertDefinitionId: criticalAlertDefinitionId
    })
    diagnosticTargets: diagnosticsConfig.targets
    assuranceAlerts: assuranceAlerts
  }
}

output diagnosticSettingCount int = diagnostics.outputs.diagnosticSettingCount
output alertCount int = diagnostics.outputs.alertCount
