targetScope = 'resourceGroup'

param location string
param tags object
param privateEndpoints array

resource endpoints 'Microsoft.Network/privateEndpoints@2023-09-01' = [for endpoint in privateEndpoints: {
  name: endpoint.name
  location: location
  tags: tags
  properties: {
    subnet: {
      id: endpoint.subnetId
    }
    privateLinkServiceConnections: [
      {
        name: endpoint.connectionName
        properties: {
          privateLinkServiceId: endpoint.targetResourceId
          groupIds: endpoint.groupIds
          requestMessage: endpoint.requestMessage
        }
      }
    ]
    customNetworkInterfaceName: endpoint.networkInterfaceName
  }
}]

resource zoneGroups 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2023-09-01' = [for (endpoint, index) in privateEndpoints: {
  parent: endpoints[index]
  name: endpoint.privateDnsZoneGroup.name
  properties: {
    privateDnsZoneConfigs: endpoint.privateDnsZoneGroup.configs
  }
}]

output privateEndpointIds array = [for (endpoint, index) in privateEndpoints: endpoints[index].id]
output privateDnsZoneGroupIds array = [for (endpoint, index) in privateEndpoints: zoneGroups[index].id]

