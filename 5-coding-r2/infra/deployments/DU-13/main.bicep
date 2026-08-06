targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param tags object

module privateEndpoints '../../modules/private-endpoints/main.bicep' = {
  name: 'du13-private-endpoints-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.privateEndpointResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    tags: tags
    privateEndpoints: settings.privateEndpointsByEnvironment[environment]
  }
}

output privateEndpointIds array = privateEndpoints.outputs.privateEndpointIds
output privateDnsZoneGroupIds array = privateEndpoints.outputs.privateDnsZoneGroupIds
