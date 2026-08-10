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
param verificationIdentityName string

var sqlDatabaseIdParts = split(sqlDatabaseResourceId, '/')
var sqlServerName = sqlDatabaseIdParts[8]
var sqlDatabaseResourceName = sqlDatabaseIdParts[10]
var phase5InitialMigrationSql = loadTextContent('../../../../5-coding-r4/app/migrations/001_init.sql')
var phase5AuthorityMigrationSql = loadTextContent('../../../../5-coding-r4/app/migrations/002_demo_authority.sql')
var projectionMigrationSql = loadTextContent('../../../apps/bff/migrations/001_demo_projection.sql')
var bootstrapSql = '''
-- Run once in the approved ${sqlDatabaseName} database using a Microsoft Entra admin after infrastructure deployment.
-- Apply the authoritative Phase 5 database contract before the BFF demo projection migration.
${phase5InitialMigrationSql}

${phase5AuthorityMigrationSql}

${projectionMigrationSql}

-- BFF is deliberately limited to the demo projection table.
CREATE USER [${bffIdentityName}] FROM EXTERNAL PROVIDER;
GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.demo_scenario_projection TO [${bffIdentityName}];

-- Phase 5 uses the authoritative least-privilege workload role; no database-wide role is granted.
CREATE USER [${phase5IdentityName}] FROM EXTERNAL PROVIDER;
ALTER ROLE workload_api_role ADD MEMBER [${phase5IdentityName}];

-- The verification job can only read the governed route bindings that it attests.
CREATE USER [${verificationIdentityName}] FROM EXTERNAL PROVIDER;
GRANT SELECT ON OBJECT::dbo.approved_model_route_evidence TO [${verificationIdentityName}];
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

output phase5InitialMigrationSql string = phase5InitialMigrationSql
output phase5AuthorityMigrationSql string = phase5AuthorityMigrationSql
output projectionMigrationSql string = projectionMigrationSql
output bootstrapSql string = bootstrapSql
output sessionIsolationNotes object = {
  sqlServerFqdn: sqlServerFqdn
  sqlDatabaseName: sqlDatabaseName
  tenantId: tenantId
  caseId: caseId
  identityName: bffIdentityName
  phase5IdentityName: phase5IdentityName
  verificationIdentityName: verificationIdentityName
  sessionContextKeys: [
    'tenant_id'
    'case_id'
  ]
  telemetryMode: 'redacted'
}
