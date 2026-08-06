targetScope = 'resourceGroup'

param location string
param tags object
param monitoring object

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: monitoring.workspaceName
  location: location
  tags: union(tags, {
    contentBoundary: 'platformTelemetryOnly'
  })
  properties: {
    retentionInDays: monitoring.retentionInDays
    workspaceCapping: {
      dailyQuotaGb: monitoring.dailyQuotaGb
    }
    publicNetworkAccessForIngestion: 'Disabled'
    publicNetworkAccessForQuery: 'Disabled'
    features: {
      disableLocalAuth: true
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: monitoring.applicationInsightsName
  location: location
  kind: 'web'
  tags: tags
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: workspace.id
    DisableIpMasking: false
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Disabled'
    publicNetworkAccessForQuery: 'Disabled'
  }
}

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: monitoring.actionGroupName
  location: 'global'
  tags: tags
  properties: {
    groupShortName: monitoring.actionGroupShortName
    enabled: true
    emailReceivers: monitoring.emailReceivers
  }
}

resource scheduledAlerts 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = [for alert in monitoring.alerts: {
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
    muteActionsDuration: alert.muteActionsDuration
    autoMitigate: true
  }
}]

output workspaceId string = workspace.id
output appInsightsId string = appInsights.id
output actionGroupId string = actionGroup.id
output alertIds array = [for (alert, index) in monitoring.alerts: scheduledAlerts[index].id]
