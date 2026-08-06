targetScope = 'resourceGroup'

param location string
param network object
param tags object
param enforceWorkloadBaseline bool = false

var hasFirewall = !empty(network.?firewall)
var peerings = network.?peerings ?? []
var azureReservedSubnetNames = [
  'AzureFirewallSubnet'
  'AzureFirewallManagementSubnet'
  'AzureBastionSubnet'
  'GatewaySubnet'
  'RouteServerSubnet'
]
var routeTableIdGroups = [
  for subnet in network.subnets: (!contains(azureReservedSubnetNames, subnet.name) && !empty(subnet.routeEntries))
    ? [resourceId('Microsoft.Network/routeTables', 'rt-${network.name}-${subnet.name}')]
    : []
]
var nsgIdGroups = [
  for subnet in network.subnets: (!contains(azureReservedSubnetNames, subnet.name) && (enforceWorkloadBaseline || !empty(subnet.nsgRules)))
    ? [resourceId('Microsoft.Network/networkSecurityGroups', 'nsg-${network.name}-${subnet.name}')]
    : []
]

resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: network.name
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: network.addressPrefixes
    }
  }
}

resource subnetNsgs 'Microsoft.Network/networkSecurityGroups@2023-09-01' = [for subnet in network.subnets: if (!contains(azureReservedSubnetNames, subnet.name) && (enforceWorkloadBaseline || !empty(subnet.nsgRules))) {
  name: 'nsg-${network.name}-${subnet.name}'
  location: location
  tags: tags
  properties: {
    securityRules: subnet.nsgRules
  }
}]

resource subnetRouteTables 'Microsoft.Network/routeTables@2023-09-01' = [for subnet in network.subnets: if (!contains(azureReservedSubnetNames, subnet.name) && !empty(subnet.routeEntries)) {
  name: 'rt-${network.name}-${subnet.name}'
  location: location
  tags: tags
  properties: {
    disableBgpRoutePropagation: bool(subnet.disableBgpRoutePropagation)
    routes: subnet.routeEntries
  }
}]

resource subnets 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' = [for subnet in network.subnets: {
  parent: vnet
  name: subnet.name
  properties: union(
  {
    addressPrefix: subnet.addressPrefix
  },
  (!contains(azureReservedSubnetNames, subnet.name) && (enforceWorkloadBaseline || !empty(subnet.nsgRules))) ? {
    networkSecurityGroup: {
      id: resourceId('Microsoft.Network/networkSecurityGroups', 'nsg-${network.name}-${subnet.name}')
    }
  }
    : {},
  (!contains(azureReservedSubnetNames, subnet.name) && !empty(subnet.routeEntries)) ? {
    routeTable: {
      id: resourceId('Microsoft.Network/routeTables', 'rt-${network.name}-${subnet.name}')
    }
  }
    : {},
  contains(subnet, 'delegations') ? {
    delegations: subnet.delegations
  } : {}, contains(subnet, 'privateEndpointNetworkPolicies') ? {
    privateEndpointNetworkPolicies: subnet.privateEndpointNetworkPolicies
  } : {}
  )
  dependsOn: [
    subnetNsgs
    subnetRouteTables
  ]
}]


resource firewallPolicy 'Microsoft.Network/firewallPolicies@2023-09-01' = if (hasFirewall) {
  name: network.firewall.policyName
  location: location
  tags: tags
  properties: {
    sku: {
      tier: 'Premium'
    }
    threatIntelMode: network.firewall.threatIntelMode
    insights: network.firewall.insights
  }
}

resource azureFirewall 'Microsoft.Network/azureFirewalls@2023-09-01' = if (hasFirewall) {
  name: network.firewall.name
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'AZFW_VNet'
      tier: 'Premium'
    }
    firewallPolicy: {
      id: firewallPolicy.id
    }
    ipConfigurations: network.firewall.ipConfigurations
    managementIpConfiguration: network.firewall.managementIpConfiguration
    threatIntelMode: network.firewall.threatIntelMode
  }
}

resource vnetPeerings 'Microsoft.Network/virtualNetworks/virtualNetworkPeerings@2023-09-01' = [for peering in peerings: {
  parent: vnet
  name: peering.name
  properties: {
    remoteVirtualNetwork: {
      id: peering.remoteVirtualNetworkId
    }
    allowVirtualNetworkAccess: peering.allowVirtualNetworkAccess
    allowForwardedTraffic: peering.allowForwardedTraffic
    allowGatewayTransit: peering.allowGatewayTransit
    useRemoteGateways: peering.useRemoteGateways
    doNotVerifyRemoteGateways: peering.doNotVerifyRemoteGateways
  }
}]

output vnetId string = vnet.id
output subnetIds array = [for (subnet, index) in network.subnets: subnets[index].id]
output routeTableIds array = flatten(routeTableIdGroups)
output nsgIds array = flatten(nsgIdGroups)
output firewallId string = hasFirewall ? azureFirewall!.id : ''
output firewallPolicyId string = hasFirewall ? firewallPolicy!.id : ''
output peeringIds array = [for (peering, index) in peerings: vnetPeerings[index].id]
