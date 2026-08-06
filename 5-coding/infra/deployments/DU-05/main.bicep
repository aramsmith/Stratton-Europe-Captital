targetScope = 'subscription'

param settings object
param privateDnsForwardingTargetsAndEnterpriseResolverIds object
param approvedPrimaryLocation string
param approvedRecoveryLocation string
param tags object

module dnsResolverAndZones '../../modules/dns/main.bicep' = {
  name: 'du05-dns-central'
  scope: resourceGroup(settings.connectivityResourceGroupName)
  params: {
    location: approvedPrimaryLocation
    resolver: settings.resolver
    privateZones: settings.privateZones
    tags: union(tags, {
      forwardingEvidenceVersion: privateDnsForwardingTargetsAndEnterpriseResolverIds.version
      recoveryLocation: approvedRecoveryLocation
    })
  }
}

output resolverId string = dnsResolverAndZones.outputs.resolverId
output outboundEndpointId string = dnsResolverAndZones.outputs.outboundEndpointId
output dnsZoneIds array = dnsResolverAndZones.outputs.zoneIds