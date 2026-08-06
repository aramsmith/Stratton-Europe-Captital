targetScope = 'resourceGroup'

param location string
param workspaceResourceId string
param actionGroupResourceId string
param tags object
param diagnosticTargets object
param assuranceAlerts array

var storageTargetsInput = diagnosticTargets.?storageAccounts ?? []
var sqlServerTargetsInput = diagnosticTargets.?sqlServers ?? []
var sqlDatabaseTargetsInput = diagnosticTargets.?sqlDatabases ?? []
var serviceBusTargetsInput = diagnosticTargets.?serviceBusNamespaces ?? []
var keyVaultTargetsInput = diagnosticTargets.?keyVaults ?? []
var apimTargetsInput = diagnosticTargets.?apimServices ?? []
var aiTargetsInput = diagnosticTargets.?aiAccounts ?? []
var appGatewayTargetsInput = diagnosticTargets.?applicationGateways ?? []
var containerAppTargetsInput = diagnosticTargets.?containerApps ?? []
var containerJobTargetsInput = diagnosticTargets.?containerJobs ?? []

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: split(workspaceResourceId, '/')[8]
}

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' existing = {
  name: split(actionGroupResourceId, '/')[8]
}

resource storageTargets 'Microsoft.Storage/storageAccounts@2023-05-01' existing = [for target in storageTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource sqlServerTargets 'Microsoft.Sql/servers@2023-08-01' existing = [for target in sqlServerTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource sqlDatabaseTargets 'Microsoft.Sql/servers/databases@2023-08-01' existing = [for target in sqlDatabaseTargetsInput: {
  name: '${split(target.resourceId, '/')[8]}/${split(target.resourceId, '/')[10]}'
}]

resource serviceBusTargets 'Microsoft.ServiceBus/namespaces@2024-01-01' existing = [for target in serviceBusTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource keyVaultTargets 'Microsoft.KeyVault/vaults@2023-07-01' existing = [for target in keyVaultTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource apimTargets 'Microsoft.ApiManagement/service@2023-05-01-preview' existing = [for target in apimTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource aiTargets 'Microsoft.CognitiveServices/accounts@2023-05-01' existing = [for target in aiTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource appGatewayTargets 'Microsoft.Network/applicationGateways@2023-09-01' existing = [for target in appGatewayTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource containerAppTargets 'Microsoft.App/containerApps@2024-03-01' existing = [for target in containerAppTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource containerJobTargets 'Microsoft.App/jobs@2024-03-01' existing = [for target in containerJobTargetsInput: {
  name: split(target.resourceId, '/')[8]
}]

resource storageDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in storageTargetsInput: {
  name: target.diagnosticSettingName
  scope: storageTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource sqlServerDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in sqlServerTargetsInput: {
  name: target.diagnosticSettingName
  scope: sqlServerTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource sqlDatabaseDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in sqlDatabaseTargetsInput: {
  name: target.diagnosticSettingName
  scope: sqlDatabaseTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource serviceBusDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in serviceBusTargetsInput: {
  name: target.diagnosticSettingName
  scope: serviceBusTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource keyVaultDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in keyVaultTargetsInput: {
  name: target.diagnosticSettingName
  scope: keyVaultTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource apimDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in apimTargetsInput: {
  name: target.diagnosticSettingName
  scope: apimTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource aiDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in aiTargetsInput: {
  name: target.diagnosticSettingName
  scope: aiTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource appGatewayDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in appGatewayTargetsInput: {
  name: target.diagnosticSettingName
  scope: appGatewayTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource containerAppDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in containerAppTargetsInput: {
  name: target.diagnosticSettingName
  scope: containerAppTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource containerJobDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [for (target, index) in containerJobTargetsInput: {
  name: target.diagnosticSettingName
  scope: containerJobTargets[index]
  properties: {
    workspaceId: workspace.id
    logs: target.logs
    metrics: target.metrics
  }
}]

resource assuranceAlertRules 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = [for alert in assuranceAlerts: {
  name: alert.name
  location: location
  tags: union(tags, {
    alertIntentId: alert.intentId
  })
  properties: {
    enabled: true
    displayName: alert.displayName
    description: alert.description
    severity: alert.severity
    evaluationFrequency: alert.evaluationFrequency
    windowSize: alert.windowSize
    scopes: [
      workspace.id
    ]
    targetResourceTypes: [
      'Microsoft.OperationalInsights/workspaces'
    ]
    criteria: {
      allOf: [
        {
          query: alert.query
          timeAggregation: alert.timeAggregation
          operator: alert.operator
          threshold: alert.threshold
          failingPeriods: {
            numberOfEvaluationPeriods: alert.numberOfEvaluationPeriods
            minFailingPeriodsToAlert: alert.minFailingPeriodsToAlert
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        actionGroup.id
      ]
    }
    autoMitigate: true
    muteActionsDuration: alert.muteActionsDuration
  }
}]

output diagnosticSettingCount int = length(storageDiagnostics) + length(sqlServerDiagnostics) + length(sqlDatabaseDiagnostics) + length(serviceBusDiagnostics) + length(keyVaultDiagnostics) + length(apimDiagnostics) + length(aiDiagnostics) + length(appGatewayDiagnostics) + length(containerAppDiagnostics) + length(containerJobDiagnostics)
output alertCount int = length(assuranceAlertRules)
