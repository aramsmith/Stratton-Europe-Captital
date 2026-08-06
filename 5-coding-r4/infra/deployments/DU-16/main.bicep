targetScope = 'subscription'

@allowed([
  'prd'
])
param environment string
param settings object
param internalAuditSubscriptionIdAndAdminGroup object
param retentionScheduleMapVersion string
param legalHoldOwner string
param tags object

var assuranceConfig = union(settings.assuranceByEnvironment[environment], {
  auditPrincipalId: internalAuditSubscriptionIdAndAdminGroup.internalAuditAdminGroupObjectId
})

module assurance '../../modules/assurance/main.bicep' = {
  name: 'du16-assurance-${environment}'
  scope: resourceGroup(settings.assuranceResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    tags: union(tags, {
      retentionScheduleMapVersion: retentionScheduleMapVersion
      legalHoldOwner: legalHoldOwner
      authority: 'internal-audit'
    })
    assurance: assuranceConfig
  }
}

output evidenceStorageId string = assurance.outputs.evidenceStorageId
output verdictStorageId string = assurance.outputs.verdictStorageId
output evidenceContainerId string = assurance.outputs.evidenceContainerId
output verdictContainerId string = assurance.outputs.verdictContainerId
output retentionActivationState string = assurance.outputs.retentionActivationState
output dataAdmissionEnabled bool = assurance.outputs.dataAdmissionEnabled
