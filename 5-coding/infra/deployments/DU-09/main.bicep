targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param tenantId string
param settings object
param sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion object
param legalHoldOwner string
param retentionScheduleMapVersion string
param tags object

var regionalBackupConfig = sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion[environment]
var dataConfig = union(settings.dataByEnvironment[environment], {
  sql: union(settings.dataByEnvironment[environment].sql, {
    backupStorageRedundancy: regionalBackupConfig[settings.dataByEnvironment[environment].primaryLocation]
  })
})

module data '../../modules/data/main.bicep' = {
  name: 'du09-data-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.dataResourceGroupByEnvironment[environment])
  params: {
    location: settings.dataByEnvironment[environment].primaryLocation
    tenantId: tenantId
    tags: union(tags, {
      legalHoldOwner: legalHoldOwner
      retentionScheduleMapVersion: retentionScheduleMapVersion
    })
    data: dataConfig
  }
}

output sqlServerId string = data.outputs.sqlServerId
output sqlRecoveryServerId string = data.outputs.sqlRecoveryServerId
output sqlDatabaseId string = data.outputs.sqlDatabaseId
output storageAccountIds array = data.outputs.storageAccountIds

output appConfigurationId string = data.outputs.appConfigurationId

