targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param tags object

module integration '../../modules/integration/main.bicep' = {
  name: 'du10-integration-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.integrationResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    tags: tags
    integration: settings.integrationByEnvironment[environment]
    workloadIdentityPrincipalIds: settings.workloadIdentityPrincipalIds
  }
}

output serviceBusNamespaceId string = integration.outputs.serviceBusNamespaceId
output serviceBusQueueIds array = integration.outputs.serviceBusQueueIds
output apimServiceId string = integration.outputs.apimServiceId
