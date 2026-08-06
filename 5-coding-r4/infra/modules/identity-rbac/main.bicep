targetScope = 'resourceGroup'

param location string
param tags object
param identities array
param roleAssignments array

resource uamis 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = [for identity in identities: {
  name: identity.name
  location: location
  tags: tags
}]

resource rgRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for assignment in roleAssignments: {
  name: guid(resourceGroup().id, string(assignment.identityIndex), assignment.roleDefinitionId)
  scope: resourceGroup()
  properties: {
    principalId: uamis[assignment.identityIndex].properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', assignment.roleDefinitionId)
  }
}]

output identityNames array = [for identity in identities: identity.name]
output identityResourceIds array = [for (identity, index) in identities: uamis[index].id]
output identityPrincipalIds array = [for (identity, index) in identities: uamis[index].properties.principalId]
