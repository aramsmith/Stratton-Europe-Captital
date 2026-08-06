targetScope = 'resourceGroup'

param location string
param tags object
param ai object
param workloadIdentityPrincipalIds object

var openAiConfig = !empty(ai.?openAi) ? ai.openAi : {
  accountName: ai.accountName
  kind: ai.kind
  skuName: ai.skuName
  customSubDomainName: ai.customSubDomainName
  virtualNetworkRules: ai.virtualNetworkRules
  ipRules: ai.ipRules
  roleAssignments: ai.roleAssignments
  deployments: ai.deployments
}

resource openAiAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: openAiConfig.accountName
  location: location
  tags: tags
  kind: openAiConfig.kind
  sku: {
    name: openAiConfig.skuName
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: openAiConfig.customSubDomainName
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
    networkAcls: {
      defaultAction: 'Deny'
      virtualNetworkRules: openAiConfig.virtualNetworkRules
      ipRules: openAiConfig.ipRules
    }
  }
}

resource openAiDeployments 'Microsoft.CognitiveServices/accounts/deployments@2023-05-01' = [for deployment in openAiConfig.deployments: {
  parent: openAiAccount
  name: deployment.name
  sku: {
    name: deployment.skuName
    capacity: deployment.capacity
  }
  properties: {
    versionUpgradeOption: deployment.versionUpgradeOption
    raiPolicyName: deployment.raiPolicyName
    model: {
      format: deployment.modelFormat
      name: deployment.modelName
      version: deployment.modelVersion
    }
  }
}]

resource openAiRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for assignment in openAiConfig.roleAssignments: {
  name: guid(openAiAccount.id, assignment.identityName, assignment.roleDefinitionId)
  scope: openAiAccount
  properties: {
    principalId: workloadIdentityPrincipalIds[assignment.identityName]
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assignment.roleDefinitionId)
  }
}]

resource documentIntelligenceAccount 'Microsoft.CognitiveServices/accounts@2023-05-01' = if (contains(ai, 'documentIntelligence')) {
  name: ai.documentIntelligence.accountName
  location: location
  tags: tags
  kind: ai.documentIntelligence.kind
  sku: {
    name: ai.documentIntelligence.skuName
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    customSubDomainName: ai.documentIntelligence.customSubDomainName
    publicNetworkAccess: 'Disabled'
    disableLocalAuth: true
    networkAcls: {
      defaultAction: 'Deny'
      virtualNetworkRules: ai.documentIntelligence.virtualNetworkRules
      ipRules: ai.documentIntelligence.ipRules
    }
  }
}

resource documentIntelligenceRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for assignment in (contains(ai, 'documentIntelligence') ? ai.documentIntelligence.roleAssignments : []): {
  name: guid(documentIntelligenceAccount.id, assignment.identityName, assignment.roleDefinitionId)
  scope: documentIntelligenceAccount
  properties: {
    principalId: workloadIdentityPrincipalIds[assignment.identityName]
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assignment.roleDefinitionId)
  }
}]

resource aiSearchService 'Microsoft.Search/searchServices@2023-11-01' = if (contains(ai, 'search')) {
  name: ai.search.name
  location: location
  tags: tags
  sku: {
    name: ai.search.skuName
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publicNetworkAccess: 'disabled'
    disableLocalAuth: true
    replicaCount: ai.search.replicaCount
    partitionCount: ai.search.partitionCount
    hostingMode: ai.search.hostingMode
    networkRuleSet: {
      ipRules: ai.search.ipRules
    }
  }
}

resource aiSearchRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for assignment in (contains(ai, 'search') ? ai.search.roleAssignments : []): {
  name: guid(aiSearchService.id, assignment.identityName, assignment.roleDefinitionId)
  scope: aiSearchService
  properties: {
    principalId: workloadIdentityPrincipalIds[assignment.identityName]
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assignment.roleDefinitionId)
  }
}]

output aiAccountId string = openAiAccount.id
output aiDeploymentIds array = [for (deployment, index) in openAiConfig.deployments: openAiDeployments[index].id]
output documentIntelligenceAccountId string = contains(ai, 'documentIntelligence') ? documentIntelligenceAccount.id : ''
output searchServiceId string = contains(ai, 'search') ? aiSearchService.id : ''


