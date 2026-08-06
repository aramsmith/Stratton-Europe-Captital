targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string

param subscriptionMap object
param settings object
param tags object

var workloadSubscriptionId = environment == 'prd' ? subscriptionMap.production : subscriptionMap.nonproduction

module managementRgs '../../modules/resource-groups/main.bicep' = {
  name: 'du03-management-rgs'
  scope: subscription(subscriptionMap.management)
  params: {
    groups: [for group in settings.managementGroups: {
      name: group.name
      location: group.location
      tags: union(tags, group.tags)
    }]
  }
}

module connectivityRgs '../../modules/resource-groups/main.bicep' = {
  name: 'du03-connectivity-rgs'
  scope: subscription(subscriptionMap.connectivity)
  params: {
    groups: [for group in settings.connectivityGroups: {
      name: group.name
      location: group.location
      tags: union(tags, group.tags)
    }]
  }
}

module aiGovernanceRgs '../../modules/resource-groups/main.bicep' = {
  name: 'du03-aigov-rgs'
  scope: subscription(subscriptionMap.aiGovernance)
  params: {
    groups: [for group in settings.aiGovernanceGroups: {
      name: group.name
      location: group.location
      tags: union(tags, group.tags)
    }]
  }
}

module workloadRgs '../../modules/resource-groups/main.bicep' = {
  name: 'du03-workload-rgs-${environment}'
  scope: subscription(workloadSubscriptionId)
  params: {
    groups: [for group in settings.workloadGroupsByEnvironment[environment]: {
      name: group.name
      location: group.location
      tags: union(tags, group.tags)
    }]
  }
}

module assuranceRgs '../../modules/resource-groups/main.bicep' = {
  name: 'du03-assurance-rgs'
  scope: subscription(subscriptionMap.assurance)
  params: {
    groups: [for group in settings.assuranceGroups: {
      name: group.name
      location: group.location
      tags: union(tags, group.tags)
    }]
  }
}

output declaredResourceGroups object = {
  management: managementRgs.outputs.resourceGroupNames
  connectivity: connectivityRgs.outputs.resourceGroupNames
  aiGovernance: aiGovernanceRgs.outputs.resourceGroupNames
  workload: workloadRgs.outputs.resourceGroupNames
  assurance: assuranceRgs.outputs.resourceGroupNames
}