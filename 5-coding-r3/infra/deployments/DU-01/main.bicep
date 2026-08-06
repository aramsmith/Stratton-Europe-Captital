targetScope = 'tenant'

param tenantId string
param citadelParentManagementGroupId string
param citadelManagementSubscriptionId string
param citadelConnectivitySubscriptionId string
param citadelAiGovernanceSubscriptionId string
param strattonNonproductionSubscriptionId string
param strattonProductionSubscriptionId string
param strattonAssuranceProductionSubscriptionId string
param settings object

var platformManagementGroupName = settings.platformManagementGroupName
var landingZonesManagementGroupName = settings.landingZonesManagementGroupName
var assuranceManagementGroupName = settings.assuranceManagementGroupName

resource platformMg 'Microsoft.Management/managementGroups@2023-04-01' = if (settings.mode == 'manage') {
  name: platformManagementGroupName
  properties: {
    details: {
      parent: {
        id: tenantResourceId('Microsoft.Management/managementGroups', citadelParentManagementGroupId)
      }
    }
  }
}

resource landingZonesMg 'Microsoft.Management/managementGroups@2023-04-01' = if (settings.mode == 'manage') {
  name: landingZonesManagementGroupName
  properties: {
    details: {
      parent: {
        id: tenantResourceId('Microsoft.Management/managementGroups', citadelParentManagementGroupId)
      }
    }
  }
}

resource assuranceMg 'Microsoft.Management/managementGroups@2023-04-01' = if (settings.mode == 'manage') {
  name: assuranceManagementGroupName
  properties: {
    details: {
      parent: {
        id: tenantResourceId('Microsoft.Management/managementGroups', citadelParentManagementGroupId)
      }
    }
  }
}

resource managementPlacement 'Microsoft.Management/managementGroups/subscriptions@2020-05-01' = if (settings.mode == 'manage') {
  parent: platformMg
  name: citadelManagementSubscriptionId
}

resource connectivityPlacement 'Microsoft.Management/managementGroups/subscriptions@2020-05-01' = if (settings.mode == 'manage') {
  parent: platformMg
  name: citadelConnectivitySubscriptionId
}

resource aiGovernancePlacement 'Microsoft.Management/managementGroups/subscriptions@2020-05-01' = if (settings.mode == 'manage') {
  parent: platformMg
  name: citadelAiGovernanceSubscriptionId
}

resource nonprodPlacement 'Microsoft.Management/managementGroups/subscriptions@2020-05-01' = if (settings.mode == 'manage') {
  parent: landingZonesMg
  name: strattonNonproductionSubscriptionId
}

resource prodPlacement 'Microsoft.Management/managementGroups/subscriptions@2020-05-01' = if (settings.mode == 'manage') {
  parent: landingZonesMg
  name: strattonProductionSubscriptionId
}

resource assurancePlacement 'Microsoft.Management/managementGroups/subscriptions@2020-05-01' = if (settings.mode == 'manage') {
  parent: assuranceMg
  name: strattonAssuranceProductionSubscriptionId
}

resource platformMgExisting 'Microsoft.Management/managementGroups@2023-04-01' existing = if (settings.mode == 'preprovisioned') {
  name: platformManagementGroupName
}

resource landingZonesMgExisting 'Microsoft.Management/managementGroups@2023-04-01' existing = if (settings.mode == 'preprovisioned') {
  name: landingZonesManagementGroupName
}

resource assuranceMgExisting 'Microsoft.Management/managementGroups@2023-04-01' existing = if (settings.mode == 'preprovisioned') {
  name: assuranceManagementGroupName
}

output tenantBinding object = {
  declaredTenantId: tenantId
  runtimeTenantId: tenant().tenantId
}

output managementGroupMode string = settings.mode
output managementGroups object = {
  platform: settings.mode == 'manage' ? platformMg.name : platformMgExisting.name
  landingzones: settings.mode == 'manage' ? landingZonesMg.name : landingZonesMgExisting.name
  assurance: settings.mode == 'manage' ? assuranceMg.name : assuranceMgExisting.name
}

output subscriptionPlacement object = {
  management: {
    subscriptionId: citadelManagementSubscriptionId
    managementGroup: platformManagementGroupName
  }
  connectivity: {
    subscriptionId: citadelConnectivitySubscriptionId
    managementGroup: platformManagementGroupName
  }
  aiGovernance: {
    subscriptionId: citadelAiGovernanceSubscriptionId
    managementGroup: platformManagementGroupName
  }
  nonproduction: {
    subscriptionId: strattonNonproductionSubscriptionId
    managementGroup: landingZonesManagementGroupName
  }
  production: {
    subscriptionId: strattonProductionSubscriptionId
    managementGroup: landingZonesManagementGroupName
  }
  assuranceProduction: {
    subscriptionId: strattonAssuranceProductionSubscriptionId
    managementGroup: assuranceManagementGroupName
  }
}
