targetScope = 'resourceGroup'

param namePrefix string
param sqlDatabaseResourceId string
param logAnalyticsWorkspaceId string
param sqlServerFqdn string
param sqlDatabaseName string
@minLength(36)
@maxLength(36)
param tenantId string
param caseId string
param bffIdentityName string
param phase5IdentityName string

var sqlDatabaseIdParts = split(sqlDatabaseResourceId, '/')
var sqlServerName = sqlDatabaseIdParts[8]
var sqlDatabaseResourceName = sqlDatabaseIdParts[10]
var projectionMigrationSql = loadTextContent('../../../apps/bff/migrations/001_demo_projection.sql')
var bootstrapSql = '''
-- Run once in the approved ${sqlDatabaseName} database using a Microsoft Entra admin after infrastructure deployment.
${projectionMigrationSql}

CREATE USER [${bffIdentityName}] FROM EXTERNAL PROVIDER;
GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.demo_scenario_projection TO [${bffIdentityName}];

CREATE USER [${phase5IdentityName}] FROM EXTERNAL PROVIDER;
GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.demo_scenario_projection TO [${phase5IdentityName}];
'''

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' existing = {
  name: sqlServerName
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' existing = {
  parent: sqlServer
  name: sqlDatabaseResourceName
}

resource sqlDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${namePrefix}-sql-diagnostics'
  scope: sqlDatabase
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output projectionMigrationSql string = projectionMigrationSql
output bootstrapSql string = bootstrapSql
output sessionIsolationNotes object = {
  sqlServerFqdn: sqlServerFqdn
  sqlDatabaseName: sqlDatabaseName
  tenantId: tenantId
  caseId: caseId
  identityName: bffIdentityName
  phase5IdentityName: phase5IdentityName
  sessionContextKeys: [
    'tenant_id'
    'case_id'
  ]
  telemetryMode: 'redacted'
}
