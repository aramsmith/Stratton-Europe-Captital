targetScope = 'subscription'

param internalAuditSubscriptionIdAndAdminGroup object
param retentionScheduleMapVersion string
param legalHoldOwner string
param ownerTag string
param costCenterTag string
param productionDataClassificationTag string
param criticalityTag string
param du16 object

module DU16 './deployments/DU-16/main.bicep' = {
  name: 'DU-16-assurance-authority'
  params: {
    environment: 'prd'
    settings: du16
    internalAuditSubscriptionIdAndAdminGroup: internalAuditSubscriptionIdAndAdminGroup
    retentionScheduleMapVersion: retentionScheduleMapVersion
    legalHoldOwner: legalHoldOwner
    tags: {
      owner: ownerTag
      costCenter: costCenterTag
      managedBy: 'bicep'
      environment: 'prd'
      workload: 'stratton-release-1'
      dataClassification: productionDataClassificationTag
      criticality: criticalityTag
    }
  }
}

output selectedDeploymentUnit string = 'DU-16'
output authorityBoundary string = 'assurance-authority-only'
output evidenceStorageId string = DU16.outputs.evidenceStorageId
output verdictStorageId string = DU16.outputs.verdictStorageId

