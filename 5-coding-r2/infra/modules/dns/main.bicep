targetScope = 'resourceGroup'

param location string
param resolver object
param privateZones array
param tags object

resource dnsResolver 'Microsoft.Network/dnsResolvers@2022-07-01' = {
  name: resolver.name
  location: location
  tags: tags
  properties: {
    virtualNetwork: {
      id: resolver.virtualNetworkId
    }
  }
}

resource inboundEndpoint 'Microsoft.Network/dnsResolvers/inboundEndpoints@2022-07-01' = {
  parent: dnsResolver
  name: resolver.inboundEndpoint.name
  location: location
  properties: {
    ipConfigurations: [
      {
        privateIpAllocationMethod: resolver.inboundEndpoint.privateIpAllocationMethod
        subnet: {
          id: resolver.inboundEndpoint.subnetId
        }
      }
    ]
  }
}

resource outboundEndpoint 'Microsoft.Network/dnsResolvers/outboundEndpoints@2022-07-01' = {
  parent: dnsResolver
  name: resolver.outboundEndpoint.name
  location: location
  properties: {
    subnet: {
      id: resolver.outboundEndpoint.subnetId
    }
  }
}

resource forwardingRulesets 'Microsoft.Network/dnsForwardingRulesets@2022-07-01' = [for ruleset in resolver.forwardingRulesets: {
  name: ruleset.name
  location: location
  tags: tags
  properties: {
    dnsResolverOutboundEndpoints: [
      {
        id: outboundEndpoint.id
      }
    ]
  }
}]

resource forwardingRules 'Microsoft.Network/dnsForwardingRulesets/forwardingRules@2022-07-01' = [for rule in resolver.forwardingRules: {
  parent: forwardingRulesets[rule.rulesetIndex]
  name: rule.name
  properties: {
    domainName: rule.domainName
    targetDnsServers: rule.targetDnsServers
    forwardingRuleState: rule.state
  }
}]

resource forwardingLinks 'Microsoft.Network/dnsForwardingRulesets/virtualNetworkLinks@2022-07-01' = [for link in resolver.forwardingVirtualNetworkLinks: {
  parent: forwardingRulesets[link.rulesetIndex]
  name: link.name
  properties: {
    virtualNetwork: {
      id: link.virtualNetworkId
    }
  }
}]

resource zones 'Microsoft.Network/privateDnsZones@2024-06-01' = [for zone in privateZones: {
  name: zone.name
  location: 'global'
  tags: tags
}]

resource zoneLinks 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [for link in resolver.privateZoneLinks: {
  parent: zones[link.zoneIndex]
  name: link.name
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: link.virtualNetworkId
    }
  }
}]

output resolverId string = dnsResolver.id
output outboundEndpointId string = outboundEndpoint.id
output rulesetIds array = [for (ruleset, index) in resolver.forwardingRulesets: forwardingRulesets[index].id]
output zoneIds array = [for (zone, index) in privateZones: zones[index].id]
