targetScope = 'resourceGroup'

param accountName string
param principalId string

var readerRoleDefinitionGuid = 'acdd72a7-3385-48ef-bd42-f606fba81ae7'

resource account 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  name: accountName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(account.id, principalId, readerRoleDefinitionGuid)
  scope: account
  properties: {
    principalId: principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', readerRoleDefinitionGuid)
  }
}

output roleAssignmentId string = roleAssignment.id
