targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param internalAuditSubscriptionIdAndAdminGroup object

module identityRbac '../../modules/identity-rbac/main.bicep' = {
  name: 'du06-identities-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.identityResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    tags: settings.tags
    identities: settings.identities
    roleAssignments: settings.resourceGroupRoleAssignments
  }
}

output identityNames array = identityRbac.outputs.identityNames
output identityResourceIds array = identityRbac.outputs.identityResourceIds
output identityPrincipalIds array = identityRbac.outputs.identityPrincipalIds
output assuranceAuthority object = internalAuditSubscriptionIdAndAdminGroup

