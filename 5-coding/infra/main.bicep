targetScope = 'tenant'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string

@allowed([
  'DU-01'
  'DU-02'
  'DU-03'
  'DU-04'
  'DU-05'
  'DU-06'
  'DU-07'
  'DU-08'
  'DU-09'
  'DU-10'
  'DU-11'
  'DU-12'
  'DU-13'
  'DU-14'
  'DU-15'
  'DU-17'
])
param deploymentUnitId string

param tenantId string
param citadelParentManagementGroupId string
param citadelManagementSubscriptionId string
param citadelConnectivitySubscriptionId string
param citadelAiGovernanceSubscriptionId string
param strattonNonproductionSubscriptionId string
param strattonProductionSubscriptionId string
param strattonAssuranceProductionSubscriptionId string
param applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription object
param sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion object
param approvedPrimaryLocation string
param approvedRecoveryLocation string
param approvedLocationEvidenceId string
param locationCodeMap object
param environmentAddressSpaces object
param primaryAndRecoveryHubAddressSpaces object
param primaryAndRecoveryEnterpriseWanConnectionIds object
param privateDnsForwardingTargetsAndEnterpriseResolverIds object
param ownerTag string
param costCenterTag string
param supportActionGroupReceivers array
param businessHoursDefinitionId string
param criticalAlertDefinitionId string
param sourceRegisterVersion string
param retentionScheduleMapVersion string
param legalHoldOwner string
param workloadProfileVersion string
param modelNameVersionAndQuota object
param providerDataUseEvidenceId string
param aiActClassificationEvidenceId string
param regulatoryEvidenceRegisterVersion string
param internalAuditSubscriptionIdAndAdminGroup object

param du01 object
param du02 object
param du03 object
param du04 object
param du05 object
param du06 object
param du07 object
param du08 object
param du09 object
param du10 object
param du11 object
param du12 object
param du13 object
param du14 object
param du15 object
param du16 object
param du17 object
param productionDataClassificationTag string
param criticalityTag string

@minValue(20)
@maxValue(20)
param rolloutAdmissionMaximum int

var selectedWorkloadSubscriptionId = environment == 'prd' ? strattonProductionSubscriptionId : strattonNonproductionSubscriptionId

var commonTags = {
  owner: ownerTag
  costCenter: costCenterTag
  managedBy: 'bicep'
  environment: environment
  workload: 'stratton-release-1'
  dataClassification: environment == 'prd' ? productionDataClassificationTag : 'synthetic'
  criticality: criticalityTag
}

module DU01 './deployments/DU-01/main.bicep' = if (deploymentUnitId == 'DU-01') {
  name: 'DU-01'
  params: {
    tenantId: tenantId
    citadelParentManagementGroupId: citadelParentManagementGroupId
    citadelManagementSubscriptionId: citadelManagementSubscriptionId
    citadelConnectivitySubscriptionId: citadelConnectivitySubscriptionId
    citadelAiGovernanceSubscriptionId: citadelAiGovernanceSubscriptionId
    strattonNonproductionSubscriptionId: strattonNonproductionSubscriptionId
    strattonProductionSubscriptionId: strattonProductionSubscriptionId
    strattonAssuranceProductionSubscriptionId: strattonAssuranceProductionSubscriptionId
    settings: du01
  }
}

module DU02 './deployments/DU-02/main.bicep' = if (deploymentUnitId == 'DU-02') {
  name: 'DU-02'
  scope: managementGroup(citadelParentManagementGroupId)
  params: {
    approvedLocationList: du02.approvedLocationList
    approvedLocationEvidenceId: approvedLocationEvidenceId
    regulatoryEvidenceRegisterVersion: regulatoryEvidenceRegisterVersion
    tags: commonTags
    settings: du02
  }
}

module DU03 './deployments/DU-03/main.bicep' = if (deploymentUnitId == 'DU-03') {
  name: 'DU-03'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    subscriptionMap: {
      management: citadelManagementSubscriptionId
      connectivity: citadelConnectivitySubscriptionId
      aiGovernance: citadelAiGovernanceSubscriptionId
      nonproduction: strattonNonproductionSubscriptionId
      production: strattonProductionSubscriptionId
      assurance: strattonAssuranceProductionSubscriptionId
    }
    settings: du03
    tags: commonTags
  }
}

module DU04 './deployments/DU-04/main.bicep' = if (deploymentUnitId == 'DU-04') {
  name: 'DU-04'
  scope: subscription(citadelConnectivitySubscriptionId)
  params: {
    environment: environment
    settings: du04
    addressEvidence: {
      environmentAddressSpaces: environmentAddressSpaces
      primaryAndRecoveryHubAddressSpaces: primaryAndRecoveryHubAddressSpaces
      primaryAndRecoveryEnterpriseWanConnectionIds: primaryAndRecoveryEnterpriseWanConnectionIds
    }
    subscriptionMap: {
      connectivity: citadelConnectivitySubscriptionId
      nonproduction: strattonNonproductionSubscriptionId
      production: strattonProductionSubscriptionId
    }
    approvedPrimaryLocation: approvedPrimaryLocation
    approvedRecoveryLocation: approvedRecoveryLocation
    tags: commonTags
  }
}

module DU05 './deployments/DU-05/main.bicep' = if (deploymentUnitId == 'DU-05') {
  name: 'DU-05'
  scope: subscription(citadelConnectivitySubscriptionId)
  params: {
    settings: du05
    privateDnsForwardingTargetsAndEnterpriseResolverIds: privateDnsForwardingTargetsAndEnterpriseResolverIds
    approvedPrimaryLocation: approvedPrimaryLocation
    approvedRecoveryLocation: approvedRecoveryLocation
    tags: commonTags
  }
}

module DU06 './deployments/DU-06/main.bicep' = if (deploymentUnitId == 'DU-06') {
  name: 'DU-06'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du06
    internalAuditSubscriptionIdAndAdminGroup: internalAuditSubscriptionIdAndAdminGroup
  }
}

module DU07 './deployments/DU-07/main.bicep' = if (deploymentUnitId == 'DU-07') {
  name: 'DU-07'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du07
    supportActionGroupReceivers: supportActionGroupReceivers
    retentionScheduleMapVersion: retentionScheduleMapVersion
    sourceRegisterVersion: sourceRegisterVersion
    tags: commonTags
  }
}

module DU08 './deployments/DU-08/main.bicep' = if (deploymentUnitId == 'DU-08') {
  name: 'DU-08'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du08
    supportActionGroupReceivers: supportActionGroupReceivers
    tags: commonTags
  }
}

module DU09 './deployments/DU-09/main.bicep' = if (deploymentUnitId == 'DU-09') {
  name: 'DU-09'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    tenantId: tenantId
    settings: du09
    sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion: sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion
    legalHoldOwner: legalHoldOwner
    retentionScheduleMapVersion: retentionScheduleMapVersion
    tags: commonTags
  }
}

module DU10 './deployments/DU-10/main.bicep' = if (deploymentUnitId == 'DU-10') {
  name: 'DU-10'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du10
    tags: commonTags
  }
}

module DU11 './deployments/DU-11/main.bicep' = if (deploymentUnitId == 'DU-11') {
  name: 'DU-11'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du11
    modelNameVersionAndQuota: modelNameVersionAndQuota
    aiActClassificationEvidenceId: aiActClassificationEvidenceId
    providerDataUseEvidenceId: providerDataUseEvidenceId
    tags: commonTags
  }
}

module DU12 './deployments/DU-12/main.bicep' = if (deploymentUnitId == 'DU-12') {
  name: 'DU-12'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du12
    workloadProfileVersion: workloadProfileVersion
    tags: commonTags
  }
}

module DU13 './deployments/DU-13/main.bicep' = if (deploymentUnitId == 'DU-13') {
  name: 'DU-13'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du13
    tags: commonTags
  }
}

module DU14 './deployments/DU-14/main.bicep' = if (deploymentUnitId == 'DU-14') {
  name: 'DU-14'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du14
  }
}

module DU15 './deployments/DU-15/main.bicep' = if (deploymentUnitId == 'DU-15') {
  name: 'DU-15'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du15
    applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription: applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription
    tags: commonTags
  }
}

module DU17 './deployments/DU-17/main.bicep' = if (deploymentUnitId == 'DU-17') {
  name: 'DU-17'
  scope: subscription(selectedWorkloadSubscriptionId)
  params: {
    environment: environment
    settings: du17
    supportActionGroupReceivers: supportActionGroupReceivers
    businessHoursDefinitionId: businessHoursDefinitionId
    criticalAlertDefinitionId: criticalAlertDefinitionId
    tags: commonTags
  }
}

output selectedDeploymentUnit string = deploymentUnitId
output stageOrderDocumentation array = [
  'DU-01'
  'DU-02'
  'DU-03'
  'DU-04'
  'DU-05'
  'DU-06'
  'DU-07|DU-08'
  'DU-09'
  'DU-10|DU-11'
  'DU-12'
  'DU-13'
  'DU-14'
  'DU-15'
  'DU-17'
]

output failClosedInputEcho object = {
  tenantId: tenantId
  citadelParentManagementGroupId: citadelParentManagementGroupId
  citadelManagementSubscriptionId: citadelManagementSubscriptionId
  citadelConnectivitySubscriptionId: citadelConnectivitySubscriptionId
  citadelAiGovernanceSubscriptionId: citadelAiGovernanceSubscriptionId
  strattonNonproductionSubscriptionId: strattonNonproductionSubscriptionId
  strattonProductionSubscriptionId: strattonProductionSubscriptionId
  strattonAssuranceProductionSubscriptionId: strattonAssuranceProductionSubscriptionId
  applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription: applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription
  sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion: sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion
  approvedPrimaryLocation: approvedPrimaryLocation
  approvedRecoveryLocation: approvedRecoveryLocation
  approvedLocationEvidenceId: approvedLocationEvidenceId
  locationCodeMap: locationCodeMap
  environmentAddressSpaces: environmentAddressSpaces
  primaryAndRecoveryHubAddressSpaces: primaryAndRecoveryHubAddressSpaces
  primaryAndRecoveryEnterpriseWanConnectionIds: primaryAndRecoveryEnterpriseWanConnectionIds
  privateDnsForwardingTargetsAndEnterpriseResolverIds: privateDnsForwardingTargetsAndEnterpriseResolverIds
  ownerTag: ownerTag
  costCenterTag: costCenterTag
  supportActionGroupReceivers: supportActionGroupReceivers
  businessHoursDefinitionId: businessHoursDefinitionId
  criticalAlertDefinitionId: criticalAlertDefinitionId
  sourceRegisterVersion: sourceRegisterVersion
  retentionScheduleMapVersion: retentionScheduleMapVersion
  legalHoldOwner: legalHoldOwner
  workloadProfileVersion: workloadProfileVersion
  modelNameVersionAndQuota: modelNameVersionAndQuota
  providerDataUseEvidenceId: providerDataUseEvidenceId
  aiActClassificationEvidenceId: aiActClassificationEvidenceId
  regulatoryEvidenceRegisterVersion: regulatoryEvidenceRegisterVersion
  internalAuditSubscriptionIdAndAdminGroup: internalAuditSubscriptionIdAndAdminGroup
  rolloutAdmissionMaximum: rolloutAdmissionMaximum
}

output assuranceDeploymentEntrypoint string = './assurance-main.bicep'
output du16ConfigurationProvided bool = !empty(du16)
