targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param addressEvidence object
param subscriptionMap object
param approvedPrimaryLocation string
param approvedRecoveryLocation string
param tags object

var workloadSubscriptionId = environment == 'prd' ? subscriptionMap.production : subscriptionMap.nonproduction

module primaryHub '../../modules/network/main.bicep' = {
  name: 'du04-network-hub-primary'
  scope: resourceGroup(subscriptionMap.connectivity, settings.connectivityResourceGroupName)
  params: {
    location: approvedPrimaryLocation
    network: settings.hubPrimaryNetwork
    tags: union(tags, {
      networkRole: 'hub-primary'
      ipamEvidenceVersion: addressEvidence.primaryAndRecoveryHubAddressSpaces.version
    })
    enforceWorkloadBaseline: false
  }
}

module recoveryHub '../../modules/network/main.bicep' = {
  name: 'du04-network-hub-recovery'
  scope: resourceGroup(subscriptionMap.connectivity, settings.connectivityResourceGroupName)
  params: {
    location: approvedRecoveryLocation
    network: settings.hubRecoveryNetwork
    tags: union(tags, {
      networkRole: 'hub-recovery'
      ipamEvidenceVersion: addressEvidence.primaryAndRecoveryHubAddressSpaces.version
    })
    enforceWorkloadBaseline: false
  }
}

module workloadPrimary '../../modules/network/main.bicep' = {
  name: 'du04-network-workload-primary-${environment}'
  scope: resourceGroup(workloadSubscriptionId, settings.workloadPrimaryResourceGroupNameByEnvironment[environment])
  params: {
    location: approvedPrimaryLocation
    network: settings.workloadPrimaryNetworkByEnvironment[environment]
    tags: union(tags, {
      networkRole: 'workload-primary'
      ipamEvidenceVersion: addressEvidence.environmentAddressSpaces.version
    })
    enforceWorkloadBaseline: true
  }
}

module workloadRecovery '../../modules/network/main.bicep' = if (settings.deployRecoveryByEnvironment[environment]) {
  name: 'du04-network-workload-recovery-${environment}'
  scope: resourceGroup(workloadSubscriptionId, settings.workloadRecoveryResourceGroupNameByEnvironment[environment])
  params: {
    location: approvedRecoveryLocation
    network: settings.workloadRecoveryNetworkByEnvironment[environment]
    tags: union(tags, {
      networkRole: 'workload-recovery'
      ipamEvidenceVersion: addressEvidence.environmentAddressSpaces.version
    })
    enforceWorkloadBaseline: true
  }
}

var workloadRecoveryVnetId = settings.deployRecoveryByEnvironment[environment] ? resourceId(workloadSubscriptionId, settings.workloadRecoveryResourceGroupNameByEnvironment[environment], 'Microsoft.Network/virtualNetworks', settings.workloadRecoveryNetworkByEnvironment[environment].name) : ''

output vnetIds object = {
  hubPrimary: primaryHub.outputs.vnetId
  hubRecovery: recoveryHub.outputs.vnetId
  workloadPrimary: workloadPrimary.outputs.vnetId
  workloadRecovery: workloadRecoveryVnetId
}
