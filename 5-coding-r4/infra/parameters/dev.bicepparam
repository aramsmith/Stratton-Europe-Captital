using '../main.bicep'

var apimNsgRules = [
  {
    name: 'allow-approved-apim-inbound'
    properties: {
      priority: 100
      access: 'Allow'
      direction: 'Inbound'
      protocol: 'Tcp'
      sourcePortRange: '*'
      destinationPortRange: 'REQUIRED_OWNER_INPUT'
      sourceAddressPrefix: 'REQUIRED_OWNER_INPUT'
      destinationAddressPrefix: 'REQUIRED_OWNER_INPUT'
    }
  }
  {
    name: 'allow-approved-apim-outbound'
    properties: {
      priority: 100
      access: 'Allow'
      direction: 'Outbound'
      protocol: 'Tcp'
      sourcePortRange: '*'
      destinationPortRange: 'REQUIRED_OWNER_INPUT'
      sourceAddressPrefix: 'REQUIRED_OWNER_INPUT'
      destinationAddressPrefix: 'REQUIRED_OWNER_INPUT'
    }
  }
]

var appNsgRules = [
  {
    name: 'allow-approved-app-inbound'
    properties: {
      priority: 100
      access: 'Allow'
      direction: 'Inbound'
      protocol: 'Tcp'
      sourcePortRange: '*'
      destinationPortRange: 'REQUIRED_OWNER_INPUT'
      sourceAddressPrefix: 'REQUIRED_OWNER_INPUT'
      destinationAddressPrefix: 'REQUIRED_OWNER_INPUT'
    }
  }
  {
    name: 'allow-approved-app-outbound'
    properties: {
      priority: 100
      access: 'Allow'
      direction: 'Outbound'
      protocol: 'Tcp'
      sourcePortRange: '*'
      destinationPortRange: 'REQUIRED_OWNER_INPUT'
      sourceAddressPrefix: 'REQUIRED_OWNER_INPUT'
      destinationAddressPrefix: 'REQUIRED_OWNER_INPUT'
    }
  }
]

var privateEndpointNsgRules = [
  {
    name: 'allow-approved-private-endpoint-inbound'
    properties: {
      priority: 100
      access: 'Allow'
      direction: 'Inbound'
      protocol: 'Tcp'
      sourcePortRange: '*'
      destinationPortRange: 'REQUIRED_OWNER_INPUT'
      sourceAddressPrefix: 'REQUIRED_OWNER_INPUT'
      destinationAddressPrefix: 'REQUIRED_OWNER_INPUT'
    }
  }
  {
    name: 'allow-approved-private-endpoint-outbound'
    properties: {
      priority: 100
      access: 'Allow'
      direction: 'Outbound'
      protocol: 'Tcp'
      sourcePortRange: '*'
      destinationPortRange: 'REQUIRED_OWNER_INPUT'
      sourceAddressPrefix: 'REQUIRED_OWNER_INPUT'
      destinationAddressPrefix: 'REQUIRED_OWNER_INPUT'
    }
  }
]

var denyAllNsgRules = [
  {
    name: 'deny-all-inbound'
    properties: {
      priority: 4095
      access: 'Deny'
      direction: 'Inbound'
      protocol: '*'
      sourcePortRange: '*'
      destinationPortRange: '*'
      sourceAddressPrefix: '*'
      destinationAddressPrefix: '*'
    }
  }
  {
    name: 'deny-all-outbound'
    properties: {
      priority: 4096
      access: 'Deny'
      direction: 'Outbound'
      protocol: '*'
      sourcePortRange: '*'
      destinationPortRange: '*'
      sourceAddressPrefix: '*'
      destinationAddressPrefix: '*'
    }
  }
]

var primaryFirewallRouteEntries = [
  {
    name: 'default-egress-via-primary-firewall'
    properties: {
      addressPrefix: '0.0.0.0/0'
      nextHopType: 'VirtualAppliance'
      nextHopIpAddress: 'REQUIRED_OWNER_INPUT'
    }
  }
]

var recoveryFirewallRouteEntries = [
  {
    name: 'default-egress-via-recovery-firewall'
    properties: {
      addressPrefix: '0.0.0.0/0'
      nextHopType: 'VirtualAppliance'
      nextHopIpAddress: 'REQUIRED_OWNER_INPUT'
    }
  }
]

param environment = 'dev'
param deploymentUnitId = 'DU-03'

param tenantId = 'REQUIRED_OWNER_INPUT'
param citadelParentManagementGroupId = 'REQUIRED_OWNER_INPUT'
param citadelManagementSubscriptionId = 'REQUIRED_OWNER_INPUT'
param citadelConnectivitySubscriptionId = 'REQUIRED_OWNER_INPUT'
param citadelAiGovernanceSubscriptionId = 'REQUIRED_OWNER_INPUT'
param strattonNonproductionSubscriptionId = 'REQUIRED_OWNER_INPUT'
param strattonProductionSubscriptionId = 'REQUIRED_OWNER_INPUT'
param strattonAssuranceProductionSubscriptionId = 'REQUIRED_OWNER_INPUT'

param applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription = {
  REQUIRED_OWNER_INPUT: 'REQUIRED_OWNER_INPUT'
}

param sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion = {
  dev: {
    REQUIRED_OWNER_INPUT: 'REQUIRED_OWNER_INPUT'
  }
  tst: {
    REQUIRED_OWNER_INPUT: 'REQUIRED_OWNER_INPUT'
  }
  prd: {
    REQUIRED_OWNER_INPUT: 'REQUIRED_OWNER_INPUT'
  }
}

param approvedPrimaryLocation = 'REQUIRED_OWNER_INPUT'
param approvedRecoveryLocation = 'REQUIRED_OWNER_INPUT'
param approvedLocationEvidenceId = 'REQUIRED_OWNER_INPUT'

param locationCodeMap = {
  REQUIRED_OWNER_INPUT: 'REQUIRED_OWNER_INPUT'
}

param environmentAddressSpaces = {
  version: 'REQUIRED_OWNER_INPUT'
  dev: {
    primary: 'REQUIRED_OWNER_INPUT'
  }
  tst: {
    primary: 'REQUIRED_OWNER_INPUT'
  }
  prd: {
    primary: 'REQUIRED_OWNER_INPUT'
    recovery: 'REQUIRED_OWNER_INPUT'
  }
}

param primaryAndRecoveryHubAddressSpaces = {
  version: 'REQUIRED_OWNER_INPUT'
  primary: 'REQUIRED_OWNER_INPUT'
  recovery: 'REQUIRED_OWNER_INPUT'
}

param primaryAndRecoveryEnterpriseWanConnectionIds = {
  version: 'REQUIRED_OWNER_INPUT'
  primary: 'REQUIRED_OWNER_INPUT'
  recovery: 'REQUIRED_OWNER_INPUT'
}

param privateDnsForwardingTargetsAndEnterpriseResolverIds = {
  version: 'REQUIRED_OWNER_INPUT'
  inboundEndpointId: 'REQUIRED_OWNER_INPUT'
  outboundEndpointId: 'REQUIRED_OWNER_INPUT'
  rulesetId: 'REQUIRED_OWNER_INPUT'
  enterpriseForwarderTargets: [
    'REQUIRED_OWNER_INPUT'
  ]
}

param ownerTag = 'REQUIRED_OWNER_INPUT'
param costCenterTag = 'REQUIRED_OWNER_INPUT'
param productionDataClassificationTag = 'REQUIRED_OWNER_INPUT'
param criticalityTag = 'REQUIRED_OWNER_INPUT'

param supportActionGroupReceivers = [
  {
    name: 'REQUIRED_OWNER_INPUT'
    emailAddress: 'REQUIRED_OWNER_INPUT'
    useCommonAlertSchema: true
  }
]

param businessHoursDefinitionId = 'REQUIRED_OWNER_INPUT'
param criticalAlertDefinitionId = 'REQUIRED_OWNER_INPUT'
param sourceRegisterVersion = 'REQUIRED_OWNER_INPUT'
param retentionScheduleMapVersion = 'REQUIRED_OWNER_INPUT'
param legalHoldOwner = 'REQUIRED_OWNER_INPUT'
param workloadProfileVersion = 'REQUIRED_OWNER_INPUT'

param modelNameVersionAndQuota = {
  REQUIRED_OWNER_INPUT: {
    name: 'REQUIRED_OWNER_INPUT'
    version: 'REQUIRED_OWNER_INPUT'
    capacity: 0
  }
}

param providerDataUseEvidenceId = 'REQUIRED_OWNER_INPUT'
param aiActClassificationEvidenceId = 'REQUIRED_OWNER_INPUT'
param regulatoryEvidenceRegisterVersion = 'REQUIRED_OWNER_INPUT'

param internalAuditSubscriptionIdAndAdminGroup = {
  subscriptionId: 'REQUIRED_OWNER_INPUT'
  internalAuditAdminGroupObjectId: 'REQUIRED_OWNER_INPUT'
  adminGroupObjectId: 'REQUIRED_OWNER_INPUT'
}

param du01 = {
  mode: 'REQUIRED_OWNER_INPUT'
  platformManagementGroupName: 'REQUIRED_OWNER_INPUT'
  landingZonesManagementGroupName: 'REQUIRED_OWNER_INPUT'
  assuranceManagementGroupName: 'REQUIRED_OWNER_INPUT'
  placementEvidenceId: 'REQUIRED_OWNER_INPUT'
  placementEvidenceHash: 'REQUIRED_OWNER_INPUT'
}

param du02 = {
  requiredTagKeys: [
    'environment'
    'workload'
    'owner'
    'costCenter'
    'dataClassification'
    'criticality'
    'managedBy'
  ]
  approvedLocationList: [
    'REQUIRED_OWNER_INPUT'
  ]
  approvedFirewallPublicIpResourceIds: [
    'REQUIRED_OWNER_INPUT'
  ]
  exemptions: [
    {
      name: 'REQUIRED_OWNER_INPUT'
      category: 'Waiver'
      displayName: 'REQUIRED_OWNER_INPUT'
      description: 'REQUIRED_OWNER_INPUT'
      policyDefinitionReferenceIds: []
      expiresOn: 'REQUIRED_OWNER_INPUT'
      metadata: {
        evidenceId: 'REQUIRED_OWNER_INPUT'
      }
    }
  ]
}

param du03 = {
  managementGroups: [
    {
      name: 'rg-citadel-mgmt-core'
      location: 'REQUIRED_OWNER_INPUT'
      tags: {
        dataClassification: 'synthetic'
      }
    }
  ]
  connectivityGroups: [
    {
      name: 'rg-citadel-connectivity-core'
      location: 'REQUIRED_OWNER_INPUT'
      tags: {
        dataClassification: 'synthetic'
      }
    }
  ]
  aiGovernanceGroups: [
    {
      name: 'rg-citadel-aigov-core'
      location: 'REQUIRED_OWNER_INPUT'
      tags: {
        dataClassification: 'synthetic'
      }
    }
  ]
  workloadGroupsByEnvironment: {
    dev: [
      {
        name: 'rg-stratton-dev-core'
        location: 'REQUIRED_OWNER_INPUT'
        tags: {
          dataClassification: 'synthetic'
        }
      }
    ]
    tst: [
      {
        name: 'rg-stratton-tst-core'
        location: 'REQUIRED_OWNER_INPUT'
        tags: {
          dataClassification: 'synthetic'
        }
      }
    ]
    prd: [
      {
        name: 'rg-stratton-prd-core'
        location: 'REQUIRED_OWNER_INPUT'
        tags: {
          dataClassification: 'confidential'
        }
      }
    ]
  }
  assuranceGroups: [
    {
      name: 'rg-stratton-assurance-prd'
      location: 'REQUIRED_OWNER_INPUT'
      tags: {
        dataClassification: 'confidential'
      }
    }
  ]
}

param du04 = {
  connectivityResourceGroupName: 'REQUIRED_OWNER_INPUT'
  workloadPrimaryResourceGroupNameByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  workloadRecoveryResourceGroupNameByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  deployRecoveryByEnvironment: {
    dev: false
    tst: false
    prd: true
  }
  hubPrimaryNetwork: {
    name: 'vnet-citadel-hub-primary'
    addressPrefixes: ['REQUIRED_OWNER_INPUT']
    firewallPrivateIpAddress: 'REQUIRED_OWNER_INPUT'
    subnets: [
      {
        name: 'AzureFirewallSubnet'
        addressPrefix: 'REQUIRED_OWNER_INPUT'
        nsgRules: []
        routeEntries: []
        disableBgpRoutePropagation: false
      }
      {
        name: 'AzureFirewallManagementSubnet'
        addressPrefix: 'REQUIRED_OWNER_INPUT'
        nsgRules: []
        routeEntries: []
        disableBgpRoutePropagation: false
      }
      {
        name: 'snet-dnsresolver-inbound'
        addressPrefix: 'REQUIRED_OWNER_INPUT'
        nsgRules: []
        routeEntries: []
        disableBgpRoutePropagation: false
      }
      {
        name: 'snet-dnsresolver-outbound'
        addressPrefix: 'REQUIRED_OWNER_INPUT'
        nsgRules: []
        routeEntries: []
        disableBgpRoutePropagation: false
      }
    ]
    firewall: {
      name: 'azfw-stratton-primary'
      policyName: 'afwp-stratton-primary'
      threatIntelMode: 'Alert'
      insights: {
        isEnabled: true
        logAnalyticsResources: {
          defaultWorkspaceId: {
            id: 'REQUIRED_OWNER_INPUT'
          }
        }
      }
      ipConfigurations: [
        {
          name: 'azureFirewallIpConfig'
          properties: {
            subnet: {
              id: 'REQUIRED_OWNER_INPUT'
            }
            publicIPAddress: {
              id: 'REQUIRED_OWNER_INPUT'
            }
          }
        }
      ]
      managementIpConfiguration: {
        name: 'azureFirewallMgmtIpConfig'
        properties: {
          subnet: {
            id: 'REQUIRED_OWNER_INPUT'
          }
          publicIPAddress: {
            id: 'REQUIRED_OWNER_INPUT'
          }
        }
      }
    }
  }
  hubRecoveryNetwork: {
    name: 'vnet-citadel-hub-recovery'
    addressPrefixes: ['REQUIRED_OWNER_INPUT']
    firewallPrivateIpAddress: 'REQUIRED_OWNER_INPUT'
    subnets: [
      {
        name: 'AzureFirewallSubnet'
        addressPrefix: 'REQUIRED_OWNER_INPUT'
        nsgRules: []
        routeEntries: []
        disableBgpRoutePropagation: false
      }
      {
        name: 'AzureFirewallManagementSubnet'
        addressPrefix: 'REQUIRED_OWNER_INPUT'
        nsgRules: []
        routeEntries: []
        disableBgpRoutePropagation: false
      }
    ]
  }
  workloadPrimaryNetworkByEnvironment: {
    dev: {
      name: 'vnet-stratton-dev-primary'
      addressPrefixes: ['REQUIRED_OWNER_INPUT']
      subnets: [
        {
          name: 'snet-apim'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(apimNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
        }
        {
          name: 'snet-app'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(appNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
          delegations: [
            {
              name: 'aca-delegation'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
        {
          name: 'snet-private-endpoints'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(privateEndpointNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
          privateEndpointNetworkPolicies: 'Enabled'
        }
      ]
    }
    tst: {
      name: 'vnet-stratton-tst-primary'
      addressPrefixes: ['REQUIRED_OWNER_INPUT']
      subnets: [
        {
          name: 'snet-apim'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(apimNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
        }
        {
          name: 'snet-app'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(appNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
          delegations: [
            {
              name: 'aca-delegation'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
        {
          name: 'snet-private-endpoints'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(privateEndpointNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
          privateEndpointNetworkPolicies: 'Enabled'
        }
      ]
    }
    prd: {
      name: 'vnet-stratton-prd-primary'
      addressPrefixes: ['REQUIRED_OWNER_INPUT']
      subnets: [
        {
          name: 'snet-apim'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(apimNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
        }
        {
          name: 'snet-app'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(appNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
          delegations: [
            {
              name: 'aca-delegation'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
        {
          name: 'snet-private-endpoints'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(privateEndpointNsgRules, denyAllNsgRules)
          routeEntries: primaryFirewallRouteEntries
          disableBgpRoutePropagation: false
          privateEndpointNetworkPolicies: 'Enabled'
        }
      ]
    }
  }
  workloadRecoveryNetworkByEnvironment: {
    dev: {
      name: 'vnet-stratton-dev-recovery'
      addressPrefixes: ['REQUIRED_OWNER_INPUT']
      subnets: [
        {
          name: 'snet-private-endpoints'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(privateEndpointNsgRules, denyAllNsgRules)
          routeEntries: recoveryFirewallRouteEntries
          disableBgpRoutePropagation: false
          privateEndpointNetworkPolicies: 'Enabled'
        }
      ]
    }
    tst: {
      name: 'vnet-stratton-tst-recovery'
      addressPrefixes: ['REQUIRED_OWNER_INPUT']
      subnets: [
        {
          name: 'snet-private-endpoints'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(privateEndpointNsgRules, denyAllNsgRules)
          routeEntries: recoveryFirewallRouteEntries
          disableBgpRoutePropagation: false
          privateEndpointNetworkPolicies: 'Enabled'
        }
      ]
    }
    prd: {
      name: 'vnet-stratton-prd-recovery'
      addressPrefixes: ['REQUIRED_OWNER_INPUT']
      subnets: [
        {
          name: 'snet-private-endpoints'
          addressPrefix: 'REQUIRED_OWNER_INPUT'
          nsgRules: concat(privateEndpointNsgRules, denyAllNsgRules)
          routeEntries: recoveryFirewallRouteEntries
          disableBgpRoutePropagation: false
          privateEndpointNetworkPolicies: 'Enabled'
        }
      ]
    }
  }
  peeringContractByEnvironment: {
    dev: {
      correspondingHubOnly: true
      allowEnvironmentPeering: false
      workloadPublicIpAllowed: false
    }
    tst: {
      correspondingHubOnly: true
      allowEnvironmentPeering: false
      workloadPublicIpAllowed: false
    }
    prd: {
      correspondingHubOnly: true
      allowEnvironmentPeering: false
      workloadPublicIpAllowed: false
    }
  }
}

param du05 = {
  connectivityResourceGroupName: 'REQUIRED_OWNER_INPUT'
  resolver: {
    name: 'dnspr-stratton-central'
    virtualNetworkId: 'REQUIRED_OWNER_INPUT'
    inboundEndpoint: {
      name: 'inbound-primary'
      privateIpAllocationMethod: 'Dynamic'
      subnetId: 'REQUIRED_OWNER_INPUT'
    }
    outboundEndpoint: {
      name: 'outbound-primary'
      subnetId: 'REQUIRED_OWNER_INPUT'
    }
    forwardingRulesets: [
      {
        name: 'frs-stratton-enterprise'
      }
    ]
    forwardingRules: [
      {
        rulesetIndex: 0
        name: 'fr-enterprise-root'
        domainName: '.'
        targetDnsServers: [
          {
            ipAddress: 'REQUIRED_OWNER_INPUT'
            port: 53
          }
        ]
        state: 'Enabled'
      }
    ]
    forwardingVirtualNetworkLinks: [
      {
        rulesetIndex: 0
        name: 'link-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        rulesetIndex: 0
        name: 'link-hub-recovery'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        rulesetIndex: 0
        name: 'link-spoke-dev-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        rulesetIndex: 0
        name: 'link-spoke-tst-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        rulesetIndex: 0
        name: 'link-spoke-prd-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        rulesetIndex: 0
        name: 'link-spoke-prd-recovery'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
    ]
    privateZoneLinks: [
      {
        zoneIndex: 0
        name: 'lnk-sql-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 1
        name: 'lnk-storage-blob-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 2
        name: 'lnk-storage-file-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 3
        name: 'lnk-storage-queue-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 4
        name: 'lnk-storage-table-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 5
        name: 'lnk-storage-dfs-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 6
        name: 'lnk-keyvault-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 7
        name: 'lnk-servicebus-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 8
        name: 'lnk-appconfig-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 9
        name: 'lnk-search-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 10
        name: 'lnk-openai-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 11
        name: 'lnk-cognitiveservices-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 12
        name: 'lnk-acr-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 13
        name: 'lnk-apim-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
      {
        zoneIndex: 14
        name: 'lnk-monitor-hub-primary'
        virtualNetworkId: 'REQUIRED_OWNER_INPUT'
      }
    ]
  }
  privateZones: [
    {
      name: 'privatelink.database.windows.net'
    }
    {
      name: 'privatelink.blob.core.windows.net'
    }
    {
      name: 'privatelink.file.core.windows.net'
    }
    {
      name: 'privatelink.queue.core.windows.net'
    }
    {
      name: 'privatelink.table.core.windows.net'
    }
    {
      name: 'privatelink.dfs.core.windows.net'
    }
    {
      name: 'privatelink.vaultcore.azure.net'
    }
    {
      name: 'privatelink.servicebus.windows.net'
    }
    {
      name: 'privatelink.azconfig.io'
    }
    {
      name: 'privatelink.search.windows.net'
    }
    {
      name: 'privatelink.openai.azure.com'
    }
    {
      name: 'privatelink.cognitiveservices.azure.com'
    }
    {
      name: 'privatelink.azurecr.io'
    }
    {
      name: 'privatelink.azure-api.net'
    }
    {
      name: 'privatelink.monitor.azure.com'
    }
  ]
}

param du06 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  identityResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  tags: {
    identityContract: 'required'
  }
  identities: [
    {
      name: 'uami-api'
    }
    {
      name: 'uami-ingest'
    }
    {
      name: 'uami-extraction'
    }
    {
      name: 'uami-analysis'
    }
    {
      name: 'uami-indexer'
    }
    {
      name: 'uami-audit-export'
    }
    {
      name: 'uami-deploy'
    }
    {
      name: 'uami-monitor'
    }
    {
      name: 'uami-role-assignment-executor'
    }
    {
      name: 'uami-assurance-authority'
    }
  ]
  resourceGroupRoleAssignments: [
    {
      identityIndex: 0
      roleDefinitionId: 'acdd72a7-3385-48ef-bd42-f606fba81ae7'
    }
  ]
}

param du07 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  monitoringResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  monitoringByEnvironment: {
    dev: {
      workspaceName: 'law-stratton-dev'
      retentionInDays: 'REQUIRED_OWNER_INPUT'
      dailyQuotaGb: 'REQUIRED_OWNER_INPUT'
      applicationInsightsName: 'appi-stratton-dev'
      actionGroupName: 'ag-stratton-dev'
      actionGroupShortName: 'strd'
      alerts: [
        {
          name: 'alt-dev-platform-availability'
          intentId: 'ALT-001'
          displayName: 'Platform availability baseline'
          description: 'Owner-defined query threshold for platform availability.'
          severity: 2
          evaluationFrequency: 'PT5M'
          windowSize: 'PT15M'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'PT30M'
        }
      ]
    }
    tst: {
      workspaceName: 'law-stratton-tst'
      retentionInDays: 'REQUIRED_OWNER_INPUT'
      dailyQuotaGb: 'REQUIRED_OWNER_INPUT'
      applicationInsightsName: 'appi-stratton-tst'
      actionGroupName: 'ag-stratton-tst'
      actionGroupShortName: 'strt'
      alerts: [
        {
          name: 'alt-tst-platform-availability'
          intentId: 'ALT-001'
          displayName: 'Platform availability baseline'
          description: 'Owner-defined query threshold for platform availability.'
          severity: 2
          evaluationFrequency: 'PT5M'
          windowSize: 'PT15M'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'PT30M'
        }
      ]
    }
    prd: {
      workspaceName: 'law-stratton-prd'
      retentionInDays: 'REQUIRED_OWNER_INPUT'
      dailyQuotaGb: 'REQUIRED_OWNER_INPUT'
      applicationInsightsName: 'appi-stratton-prd'
      actionGroupName: 'ag-stratton-prd'
      actionGroupShortName: 'strp'
      alerts: [
        {
          name: 'alt-prd-platform-availability'
          intentId: 'ALT-001'
          displayName: 'Platform availability baseline'
          description: 'Owner-defined query threshold for platform availability.'
          severity: 1
          evaluationFrequency: 'PT5M'
          windowSize: 'PT15M'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'PT15M'
        }
      ]
    }
  }
}

param du08 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  monitoringResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  monitoringByEnvironment: {
    dev: {
      workspaceName: 'law-stratton-assurance-dev'
      retentionInDays: 'REQUIRED_OWNER_INPUT'
      dailyQuotaGb: 'REQUIRED_OWNER_INPUT'
      applicationInsightsName: 'appi-stratton-assurance-dev'
      actionGroupName: 'ag-stratton-assurance-dev'
      actionGroupShortName: 'sad'
      alerts: []
    }
    tst: {
      workspaceName: 'law-stratton-assurance-tst'
      retentionInDays: 'REQUIRED_OWNER_INPUT'
      dailyQuotaGb: 'REQUIRED_OWNER_INPUT'
      applicationInsightsName: 'appi-stratton-assurance-tst'
      actionGroupName: 'ag-stratton-assurance-tst'
      actionGroupShortName: 'sat'
      alerts: []
    }
    prd: {
      workspaceName: 'law-stratton-assurance-prd'
      retentionInDays: 'REQUIRED_OWNER_INPUT'
      dailyQuotaGb: 'REQUIRED_OWNER_INPUT'
      applicationInsightsName: 'appi-stratton-assurance-prd'
      actionGroupName: 'ag-stratton-assurance-prd'
      actionGroupShortName: 'sap'
      alerts: []
    }
  }
}

param du09 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  dataResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  dataByEnvironment: {
    dev: {
      primaryLocation: 'REQUIRED_OWNER_INPUT'
      sql: {
        primaryLocation: 'REQUIRED_OWNER_INPUT'
        recoveryLocation: 'REQUIRED_OWNER_INPUT'
        primaryServerName: 'sql-stratton-dev-pri'
        recoveryServerName: 'sql-stratton-dev-rec'
        minimalTlsVersion: '1.2'
        entraAdmin: {
          displayName: 'REQUIRED_OWNER_INPUT'
          objectId: 'REQUIRED_OWNER_INPUT'
        }
        databaseName: 'sqldb-stratton'
        databaseSku: {
          name: 'REQUIRED_OWNER_INPUT'
          tier: 'REQUIRED_OWNER_INPUT'
          capacity: 'REQUIRED_OWNER_INPUT'
        }
        zoneRedundant: false
        readScale: 'Disabled'
        backupStorageRedundancy: 'Local'
        failoverGroupName: 'fg-stratton'
        failoverPolicy: 'Automatic'
        failoverGraceMinutes: 60
        securityAlertEmails: [
          'REQUIRED_OWNER_INPUT'
        ]
        securityAlertRetentionDays: 'REQUIRED_OWNER_INPUT'
        auditingRetentionDays: 'REQUIRED_OWNER_INPUT'
        auditingStorageEndpoint: 'REQUIRED_OWNER_INPUT'
        publicNetworkAccess: 'Disabled'
      }
      appConfiguration: {
        name: 'appcs-stratton-dev'
        skuName: 'standard'
        softDeleteRetentionInDays: 'REQUIRED_OWNER_INPUT'
        keyVaultProperties: {
          identityClientId: 'REQUIRED_OWNER_INPUT'
          keyIdentifier: 'REQUIRED_OWNER_INPUT'
        }
        roleAssignments: [
          {
            principalId: 'REQUIRED_OWNER_INPUT'
            principalType: 'ServicePrincipal'
            roleDefinitionId: '516239f1-63e1-4d78-a4de-a74fb236a071'
          }
        ]
        publicNetworkAccess: 'Disabled'
      }
      storageAccounts: [
        {
          name: 'ststrdvquar01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'quarantine'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrdvadm01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'admitted-evidence'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrdvtmp01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'temporary-work'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrdvaud01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'audit'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
      ]
      storageContainers: [
        {
          storageIndex: 0
          name: 'quarantine'
          immutableStorageWithVersioningEnabled: true
        }
        {
          storageIndex: 1
          name: 'admitted-evidence'
          immutableStorageWithVersioningEnabled: true
        }
        {
          storageIndex: 2
          name: 'temporary-work'
          immutableStorageWithVersioningEnabled: false
        }
        {
          storageIndex: 3
          name: 'audit-export'
          immutableStorageWithVersioningEnabled: true
        }
      ]
    }
    tst: {
      primaryLocation: 'REQUIRED_OWNER_INPUT'
      sql: {
        primaryLocation: 'REQUIRED_OWNER_INPUT'
        recoveryLocation: 'REQUIRED_OWNER_INPUT'
        primaryServerName: 'sql-stratton-tst-pri'
        recoveryServerName: 'sql-stratton-tst-rec'
        minimalTlsVersion: '1.2'
        entraAdmin: {
          displayName: 'REQUIRED_OWNER_INPUT'
          objectId: 'REQUIRED_OWNER_INPUT'
        }
        databaseName: 'sqldb-stratton'
        databaseSku: {
          name: 'REQUIRED_OWNER_INPUT'
          tier: 'REQUIRED_OWNER_INPUT'
          capacity: 'REQUIRED_OWNER_INPUT'
        }
        zoneRedundant: false
        readScale: 'Disabled'
        backupStorageRedundancy: 'Local'
        failoverGroupName: 'fg-stratton'
        failoverPolicy: 'Automatic'
        failoverGraceMinutes: 60
        securityAlertEmails: [
          'REQUIRED_OWNER_INPUT'
        ]
        securityAlertRetentionDays: 'REQUIRED_OWNER_INPUT'
        auditingRetentionDays: 'REQUIRED_OWNER_INPUT'
        auditingStorageEndpoint: 'REQUIRED_OWNER_INPUT'
        publicNetworkAccess: 'Disabled'
      }
      appConfiguration: {
        name: 'appcs-stratton-tst'
        skuName: 'standard'
        softDeleteRetentionInDays: 'REQUIRED_OWNER_INPUT'
        keyVaultProperties: {
          identityClientId: 'REQUIRED_OWNER_INPUT'
          keyIdentifier: 'REQUIRED_OWNER_INPUT'
        }
        roleAssignments: [
          {
            principalId: 'REQUIRED_OWNER_INPUT'
            principalType: 'ServicePrincipal'
            roleDefinitionId: '516239f1-63e1-4d78-a4de-a74fb236a071'
          }
        ]
        publicNetworkAccess: 'Disabled'
      }
      storageAccounts: [
        {
          name: 'ststrtvquar01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'quarantine'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrtvadm01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'admitted-evidence'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrtvtmp01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'temporary-work'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrtvaud01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'audit'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
      ]
      storageContainers: [
        {
          storageIndex: 0
          name: 'quarantine'
          immutableStorageWithVersioningEnabled: true
        }
        {
          storageIndex: 1
          name: 'admitted-evidence'
          immutableStorageWithVersioningEnabled: true
        }
        {
          storageIndex: 2
          name: 'temporary-work'
          immutableStorageWithVersioningEnabled: false
        }
        {
          storageIndex: 3
          name: 'audit-export'
          immutableStorageWithVersioningEnabled: true
        }
      ]
    }
    prd: {
      primaryLocation: 'REQUIRED_OWNER_INPUT'
      sql: {
        primaryLocation: 'REQUIRED_OWNER_INPUT'
        recoveryLocation: 'REQUIRED_OWNER_INPUT'
        primaryServerName: 'sql-stratton-prd-pri'
        recoveryServerName: 'sql-stratton-prd-rec'
        minimalTlsVersion: '1.2'
        entraAdmin: {
          displayName: 'REQUIRED_OWNER_INPUT'
          objectId: 'REQUIRED_OWNER_INPUT'
        }
        databaseName: 'sqldb-stratton'
        databaseSku: {
          name: 'REQUIRED_OWNER_INPUT'
          tier: 'REQUIRED_OWNER_INPUT'
          capacity: 'REQUIRED_OWNER_INPUT'
        }
        zoneRedundant: 'REQUIRED_OWNER_INPUT'
        readScale: 'REQUIRED_OWNER_INPUT'
        backupStorageRedundancy: 'Zone'
        failoverGroupName: 'fg-stratton'
        failoverPolicy: 'Automatic'
        failoverGraceMinutes: 60
        securityAlertEmails: [
          'REQUIRED_OWNER_INPUT'
        ]
        securityAlertRetentionDays: 'REQUIRED_OWNER_INPUT'
        auditingRetentionDays: 'REQUIRED_OWNER_INPUT'
        auditingStorageEndpoint: 'REQUIRED_OWNER_INPUT'
        publicNetworkAccess: 'Disabled'
      }
      appConfiguration: {
        name: 'appcs-stratton-prd'
        skuName: 'standard'
        softDeleteRetentionInDays: 'REQUIRED_OWNER_INPUT'
        keyVaultProperties: {
          identityClientId: 'REQUIRED_OWNER_INPUT'
          keyIdentifier: 'REQUIRED_OWNER_INPUT'
        }
        roleAssignments: [
          {
            principalId: 'REQUIRED_OWNER_INPUT'
            principalType: 'ServicePrincipal'
            roleDefinitionId: '516239f1-63e1-4d78-a4de-a74fb236a071'
          }
        ]
        publicNetworkAccess: 'Disabled'
      }
      storageAccounts: [
        {
          name: 'ststrpvquar01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'quarantine'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrpvadm01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'admitted-evidence'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrpvtmp01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'temporary-work'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
        {
          name: 'ststrpvaud01'
          location: 'REQUIRED_OWNER_INPUT'
          tags: {
            storagePurpose: 'audit'
          }
          skuName: 'REQUIRED_OWNER_INPUT'
          minimumTlsVersion: 'TLS1_2'
          networkBypass: 'REQUIRED_OWNER_INPUT'
          virtualNetworkRules: []
          ipRules: []
          accessTier: 'Hot'
          blobVersioningEnabled: true
          deleteRetentionEnabled: true
          deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          containerDeleteRetentionEnabled: true
          containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
          publicNetworkAccess: 'Disabled'
          allowBlobPublicAccess: false
        }
      ]
      storageContainers: [
        {
          storageIndex: 0
          name: 'quarantine'
          immutableStorageWithVersioningEnabled: true
        }
        {
          storageIndex: 1
          name: 'admitted-evidence'
          immutableStorageWithVersioningEnabled: true
        }
        {
          storageIndex: 2
          name: 'temporary-work'
          immutableStorageWithVersioningEnabled: false
        }
        {
          storageIndex: 3
          name: 'audit-export'
          immutableStorageWithVersioningEnabled: true
        }
      ]
    }
  }
}

param du10 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  integrationResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  workloadIdentityPrincipalIds: {
    'uami-api': 'REQUIRED_OWNER_INPUT'
    'uami-ingest': 'REQUIRED_OWNER_INPUT'
    'uami-extraction': 'REQUIRED_OWNER_INPUT'
    'uami-analysis': 'REQUIRED_OWNER_INPUT'
    'uami-indexer': 'REQUIRED_OWNER_INPUT'
    'uami-audit-export': 'REQUIRED_OWNER_INPUT'
  }
  integrationByEnvironment: {
    dev: {
      serviceBus: {
        namespaceName: 'sb-stratton-dev'
        skuName: 'Premium'
        tier: 'Premium'
        capacity: 1
        minimumTlsVersion: '1.2'
        zoneRedundant: false
        queues: [
          {
            name: 'q-ingestion'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-extraction'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-analysis'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-indexing'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-audit-export'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
        ]
        roleAssignments: [
          {
            identityName: 'uami-api'
            queueName: 'q-ingestion'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-api'
            queueName: 'q-extraction'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-api'
            queueName: 'q-indexing'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-ingest'
            queueName: 'q-ingestion'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
          {
            identityName: 'uami-extraction'
            queueName: 'q-extraction'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
          {
            identityName: 'uami-extraction'
            queueName: 'q-indexing'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-indexer'
            queueName: 'q-indexing'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
        ]
      }
      apim: {
        name: 'apim-stratton-dev'
        skuName: 'PremiumV2'
        capacity: 1
        publisherEmail: 'REQUIRED_OWNER_INPUT'
        publisherName: 'REQUIRED_OWNER_INPUT'
        publicNetworkAccess: 'Disabled'
        virtualNetworkType: 'Internal'
        virtualNetworkConfiguration: {
          subnetResourceId: 'REQUIRED_OWNER_INPUT'
        }
        customProperties: {}
      }
    }
    tst: {
      serviceBus: {
        namespaceName: 'sb-stratton-tst'
        skuName: 'Premium'
        tier: 'Premium'
        capacity: 1
        minimumTlsVersion: '1.2'
        zoneRedundant: false
        queues: [
          {
            name: 'q-ingestion'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-extraction'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-analysis'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-indexing'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-audit-export'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
        ]
        roleAssignments: [
          {
            identityName: 'uami-api'
            queueName: 'q-ingestion'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-api'
            queueName: 'q-extraction'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-api'
            queueName: 'q-indexing'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-ingest'
            queueName: 'q-ingestion'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
          {
            identityName: 'uami-extraction'
            queueName: 'q-extraction'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
          {
            identityName: 'uami-extraction'
            queueName: 'q-indexing'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-indexer'
            queueName: 'q-indexing'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
        ]
      }
      apim: {
        name: 'apim-stratton-tst'
        skuName: 'PremiumV2'
        capacity: 1
        publisherEmail: 'REQUIRED_OWNER_INPUT'
        publisherName: 'REQUIRED_OWNER_INPUT'
        publicNetworkAccess: 'Disabled'
        virtualNetworkType: 'Internal'
        virtualNetworkConfiguration: {
          subnetResourceId: 'REQUIRED_OWNER_INPUT'
        }
        customProperties: {}
      }
    }
    prd: {
      serviceBus: {
        namespaceName: 'sb-stratton-prd'
        skuName: 'Premium'
        tier: 'Premium'
        capacity: 1
        minimumTlsVersion: '1.2'
        zoneRedundant: true
        queues: [
          {
            name: 'q-ingestion'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-extraction'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-analysis'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-indexing'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
          {
            name: 'q-audit-export'
            requiresSession: true
            requiresDuplicateDetection: true
            duplicateDetectionHistoryTimeWindow: 'PT10M'
            defaultMessageTimeToLive: 'P1D'
            maxDeliveryCount: 10
            deadLetteringOnMessageExpiration: true
            lockDuration: 'PT5M'
            maxSizeInMegabytes: 1024
          }
        ]
        roleAssignments: [
          {
            identityName: 'uami-api'
            queueName: 'q-ingestion'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-api'
            queueName: 'q-extraction'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-api'
            queueName: 'q-indexing'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-ingest'
            queueName: 'q-ingestion'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
          {
            identityName: 'uami-extraction'
            queueName: 'q-extraction'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
          {
            identityName: 'uami-extraction'
            queueName: 'q-indexing'
            roleDefinitionId: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
          }
          {
            identityName: 'uami-indexer'
            queueName: 'q-indexing'
            roleDefinitionId: '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
          }
        ]
      }
      apim: {
        name: 'apim-stratton-prd'
        skuName: 'PremiumV2'
        capacity: 1
        publisherEmail: 'REQUIRED_OWNER_INPUT'
        publisherName: 'REQUIRED_OWNER_INPUT'
        publicNetworkAccess: 'Disabled'
        virtualNetworkType: 'Internal'
        virtualNetworkConfiguration: {
          subnetResourceId: 'REQUIRED_OWNER_INPUT'
        }
        customProperties: {}
      }
    }
  }
}

param du11 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  aiResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  workloadIdentityPrincipalIds: {
    'uami-analysis': 'REQUIRED_OWNER_INPUT'
    'uami-indexer': 'REQUIRED_OWNER_INPUT'
    'uami-audit-export': 'REQUIRED_OWNER_INPUT'
  }
  aiByEnvironment: {
    dev: {
      openAi: {
        accountName: 'aoai-stratton-dev'
        kind: 'OpenAI'
        skuName: 'S0'
        customSubDomainName: 'REQUIRED_OWNER_INPUT'
        virtualNetworkRules: []
        ipRules: []
        roleAssignments: [
          {
            identityName: 'uami-analysis'
            roleDefinitionId: 'a001fd3d-188f-4b5d-821b-7da978bf7442'
          }
        ]
        deployments: [
          {
            modelKey: 'REQUIRED_OWNER_INPUT'
            name: 'chat-primary'
            skuName: 'Standard'
            versionUpgradeOption: 'NoAutoUpgrade'
            raiPolicyName: 'Microsoft.Default'
            modelFormat: 'OpenAI'
            deploymentType: 'Regional'
            fineTuningEnabled: false
          }
        ]
      }
      documentIntelligence: {
        accountName: 'docai-stratton-dev'
        kind: 'FormRecognizer'
        skuName: 'S0'
        customSubDomainName: 'REQUIRED_OWNER_INPUT'
        virtualNetworkRules: []
        ipRules: []
        roleAssignments: [
          {
            identityName: 'uami-analysis'
            roleDefinitionId: 'a001fd3d-188f-4b5d-821b-7da978bf7442'
          }
        ]
      }
      search: {
        name: 'srch-stratton-dev'
        skuName: 'REQUIRED_OWNER_INPUT'
        replicaCount: 'REQUIRED_OWNER_INPUT'
        partitionCount: 'REQUIRED_OWNER_INPUT'
        hostingMode: 'default'
        ipRules: []
        networkBypass: 'None'
        roleAssignments: [
          {
            identityName: 'uami-indexer'
            roleDefinitionId: '1407120a-92aa-4202-b7e9-c0e197c71c8f'
          }
        ]
      }
      deployments: [
        {
          modelKey: 'REQUIRED_OWNER_INPUT'
          name: 'chat-primary'
          skuName: 'Standard'
          versionUpgradeOption: 'NoAutoUpgrade'
          raiPolicyName: 'Microsoft.Default'
          modelFormat: 'OpenAI'
          deploymentType: 'Regional'
          fineTuningEnabled: false
        }
      ]
      serviceInventory: {
        openAi: true
        documentIntelligence: true
        aiSearch: true
        deploymentType: 'Regional'
        fineTuningEnabled: false
      }
      publicNetworkAccess: 'Disabled'
    }
    tst: {
      openAi: {
        accountName: 'aoai-stratton-tst'
        kind: 'OpenAI'
        skuName: 'S0'
        customSubDomainName: 'REQUIRED_OWNER_INPUT'
        virtualNetworkRules: []
        ipRules: []
        roleAssignments: [
          {
            identityName: 'uami-analysis'
            roleDefinitionId: 'a001fd3d-188f-4b5d-821b-7da978bf7442'
          }
        ]
        deployments: [
          {
            modelKey: 'REQUIRED_OWNER_INPUT'
            name: 'chat-primary'
            skuName: 'Standard'
            versionUpgradeOption: 'NoAutoUpgrade'
            raiPolicyName: 'Microsoft.Default'
            modelFormat: 'OpenAI'
            deploymentType: 'Regional'
            fineTuningEnabled: false
          }
        ]
      }
      documentIntelligence: {
        accountName: 'docai-stratton-tst'
        kind: 'FormRecognizer'
        skuName: 'S0'
        customSubDomainName: 'REQUIRED_OWNER_INPUT'
        virtualNetworkRules: []
        ipRules: []
        roleAssignments: [
          {
            identityName: 'uami-analysis'
            roleDefinitionId: 'a001fd3d-188f-4b5d-821b-7da978bf7442'
          }
        ]
      }
      search: {
        name: 'srch-stratton-tst'
        skuName: 'REQUIRED_OWNER_INPUT'
        replicaCount: 'REQUIRED_OWNER_INPUT'
        partitionCount: 'REQUIRED_OWNER_INPUT'
        hostingMode: 'default'
        ipRules: []
        networkBypass: 'None'
        roleAssignments: [
          {
            identityName: 'uami-indexer'
            roleDefinitionId: '1407120a-92aa-4202-b7e9-c0e197c71c8f'
          }
        ]
      }
      deployments: [
        {
          modelKey: 'REQUIRED_OWNER_INPUT'
          name: 'chat-primary'
          skuName: 'Standard'
          versionUpgradeOption: 'NoAutoUpgrade'
          raiPolicyName: 'Microsoft.Default'
          modelFormat: 'OpenAI'
          deploymentType: 'Regional'
          fineTuningEnabled: false
        }
      ]
      serviceInventory: {
        openAi: true
        documentIntelligence: true
        aiSearch: true
        deploymentType: 'Regional'
        fineTuningEnabled: false
      }
      publicNetworkAccess: 'Disabled'
    }
    prd: {
      openAi: {
        accountName: 'aoai-stratton-prd'
        kind: 'OpenAI'
        skuName: 'S0'
        customSubDomainName: 'REQUIRED_OWNER_INPUT'
        virtualNetworkRules: []
        ipRules: []
        roleAssignments: [
          {
            identityName: 'uami-analysis'
            roleDefinitionId: 'a001fd3d-188f-4b5d-821b-7da978bf7442'
          }
        ]
        deployments: [
          {
            modelKey: 'REQUIRED_OWNER_INPUT'
            name: 'chat-primary'
            skuName: 'Standard'
            versionUpgradeOption: 'NoAutoUpgrade'
            raiPolicyName: 'Microsoft.Default'
            modelFormat: 'OpenAI'
            deploymentType: 'Regional'
            fineTuningEnabled: false
          }
        ]
      }
      documentIntelligence: {
        accountName: 'docai-stratton-prd'
        kind: 'FormRecognizer'
        skuName: 'S0'
        customSubDomainName: 'REQUIRED_OWNER_INPUT'
        virtualNetworkRules: []
        ipRules: []
        roleAssignments: [
          {
            identityName: 'uami-analysis'
            roleDefinitionId: 'a001fd3d-188f-4b5d-821b-7da978bf7442'
          }
        ]
      }
      search: {
        name: 'srch-stratton-prd'
        skuName: 'REQUIRED_OWNER_INPUT'
        replicaCount: 'REQUIRED_OWNER_INPUT'
        partitionCount: 'REQUIRED_OWNER_INPUT'
        hostingMode: 'default'
        ipRules: []
        networkBypass: 'None'
        roleAssignments: [
          {
            identityName: 'uami-indexer'
            roleDefinitionId: '1407120a-92aa-4202-b7e9-c0e197c71c8f'
          }
        ]
      }
      deployments: [
        {
          modelKey: 'REQUIRED_OWNER_INPUT'
          name: 'chat-primary'
          skuName: 'Standard'
          versionUpgradeOption: 'NoAutoUpgrade'
          raiPolicyName: 'Microsoft.Default'
          modelFormat: 'OpenAI'
          deploymentType: 'Regional'
          fineTuningEnabled: false
        }
      ]
      serviceInventory: {
        openAi: true
        documentIntelligence: true
        aiSearch: true
        deploymentType: 'Regional'
        fineTuningEnabled: false
      }
      publicNetworkAccess: 'Disabled'
    }
  }
}

param du12 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  applicationResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  platformByEnvironment: {
    dev: {
      managedEnvironment: {
        infrastructureSubnetId: 'REQUIRED_OWNER_INPUT'
      }
      apiApp: {
        name: 'ca-stratton-api-dev'
        targetPort: 'REQUIRED_OWNER_INPUT'
        minReplicas: 1
        userAssignedIdentities: {
          REQUIRED_OWNER_INPUT: {}
        }
        identityPrincipalIds: [
          'REQUIRED_OWNER_INPUT'
        ]
        imageDigest: 'REQUIRED_OWNER_INPUT'
        entraAuthentication: {
          tenantId: 'REQUIRED_OWNER_INPUT'
          clientId: 'REQUIRED_OWNER_INPUT'
          allowedAudience: 'REQUIRED_OWNER_INPUT'
        }
        environmentVariables: [
          {
            name: 'AZURE_SERVICEBUS_QUEUE_INGESTION'
            value: 'q-ingestion'
          }
          {
            name: 'AZURE_SERVICEBUS_QUEUE_EXTRACTION'
            value: 'q-extraction'
          }
          {
            name: 'AZURE_SERVICEBUS_QUEUE_INDEXING'
            value: 'q-indexing'
          }
        ]
      }
      workerJobs: [
        {
          name: 'job-stratton-ingest-dev'
          queueName: 'q-ingestion'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-extraction-dev'
          queueName: 'q-extraction'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-analysis-dev'
          queueName: 'q-analysis'
          deploymentEnabled: false
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-indexer-dev'
          queueName: 'q-indexing'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-audit-export-dev'
          queueName: 'q-audit-export'
          deploymentEnabled: false
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
      ]
    }
    tst: {
      managedEnvironment: {
        infrastructureSubnetId: 'REQUIRED_OWNER_INPUT'
      }
      apiApp: {
        name: 'ca-stratton-api-tst'
        targetPort: 'REQUIRED_OWNER_INPUT'
        minReplicas: 1
        userAssignedIdentities: {
          REQUIRED_OWNER_INPUT: {}
        }
        identityPrincipalIds: [
          'REQUIRED_OWNER_INPUT'
        ]
        imageDigest: 'REQUIRED_OWNER_INPUT'
        entraAuthentication: {
          tenantId: 'REQUIRED_OWNER_INPUT'
          clientId: 'REQUIRED_OWNER_INPUT'
          allowedAudience: 'REQUIRED_OWNER_INPUT'
        }
        environmentVariables: [
          {
            name: 'AZURE_SERVICEBUS_QUEUE_INGESTION'
            value: 'q-ingestion'
          }
          {
            name: 'AZURE_SERVICEBUS_QUEUE_EXTRACTION'
            value: 'q-extraction'
          }
          {
            name: 'AZURE_SERVICEBUS_QUEUE_INDEXING'
            value: 'q-indexing'
          }
        ]
      }
      workerJobs: [
        {
          name: 'job-stratton-ingest-tst'
          queueName: 'q-ingestion'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-extraction-tst'
          queueName: 'q-extraction'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-analysis-tst'
          queueName: 'q-analysis'
          deploymentEnabled: false
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-indexer-tst'
          queueName: 'q-indexing'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-audit-export-tst'
          queueName: 'q-audit-export'
          deploymentEnabled: false
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
      ]
    }
    prd: {
      managedEnvironment: {
        infrastructureSubnetId: 'REQUIRED_OWNER_INPUT'
      }
      apiApp: {
        name: 'ca-stratton-api-prd'
        targetPort: 'REQUIRED_OWNER_INPUT'
        minReplicas: 2
        userAssignedIdentities: {
          REQUIRED_OWNER_INPUT: {}
        }
        identityPrincipalIds: [
          'REQUIRED_OWNER_INPUT'
        ]
        imageDigest: 'REQUIRED_OWNER_INPUT'
        entraAuthentication: {
          tenantId: 'REQUIRED_OWNER_INPUT'
          clientId: 'REQUIRED_OWNER_INPUT'
          allowedAudience: 'REQUIRED_OWNER_INPUT'
        }
        environmentVariables: [
          {
            name: 'AZURE_SERVICEBUS_QUEUE_INGESTION'
            value: 'q-ingestion'
          }
          {
            name: 'AZURE_SERVICEBUS_QUEUE_EXTRACTION'
            value: 'q-extraction'
          }
          {
            name: 'AZURE_SERVICEBUS_QUEUE_INDEXING'
            value: 'q-indexing'
          }
        ]
      }
      workerJobs: [
        {
          name: 'job-stratton-ingest-prd'
          queueName: 'q-ingestion'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-extraction-prd'
          queueName: 'q-extraction'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-analysis-prd'
          queueName: 'q-analysis'
          deploymentEnabled: false
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-indexer-prd'
          queueName: 'q-indexing'
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'job-stratton-audit-export-prd'
          queueName: 'q-audit-export'
          deploymentEnabled: false
          identityPrincipalId: 'REQUIRED_OWNER_INPUT'
        }
      ]
    }
  }
}

param du13 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  privateEndpointResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  privateEndpointsByEnvironment: {
    dev: [
      {
        serviceType: 'sql-primary'
        name: 'pe-sql-primary-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-sql-primary-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'sqlServer'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-sql-primary-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'sql'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'servicebus'
        name: 'pe-servicebus-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-servicebus-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'namespace'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-servicebus-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'sb'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'keyvault'
        name: 'pe-keyvault-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-keyvault-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'vault'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-keyvault-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'kv'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'appconfig'
        name: 'pe-appconfig-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-appconfig-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'configurationStores'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-appconfig-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'appcs'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'search'
        name: 'pe-search-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-search-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'searchService'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-search-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'search'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'openai'
        name: 'pe-openai-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-openai-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'account'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-openai-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'openai'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'documentintelligence'
        name: 'pe-documentintelligence-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-documentintelligence-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'account'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-documentintelligence-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'docai'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'acr'
        name: 'pe-acr-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-acr-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'registry'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-acr-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'acr'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'apim'
        name: 'pe-apim-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-apim-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'gateway'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-apim-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'apim'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'monitor'
        name: 'pe-monitor-dev'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-monitor-dev'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'azuremonitor'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-monitor-dev'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'monitor'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
    ]
    tst: [
      {
        serviceType: 'sql-primary'
        name: 'pe-sql-primary-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-sql-primary-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'sqlServer'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-sql-primary-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'sql'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'servicebus'
        name: 'pe-servicebus-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-servicebus-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'namespace'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-servicebus-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'sb'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'keyvault'
        name: 'pe-keyvault-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-keyvault-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'vault'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-keyvault-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'kv'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'appconfig'
        name: 'pe-appconfig-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-appconfig-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'configurationStores'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-appconfig-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'appcs'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'search'
        name: 'pe-search-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-search-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'searchService'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-search-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'search'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'openai'
        name: 'pe-openai-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-openai-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'account'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-openai-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'openai'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'documentintelligence'
        name: 'pe-documentintelligence-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-documentintelligence-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'account'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-documentintelligence-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'docai'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'acr'
        name: 'pe-acr-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-acr-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'registry'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-acr-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'acr'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'apim'
        name: 'pe-apim-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-apim-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'gateway'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-apim-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'apim'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'monitor'
        name: 'pe-monitor-tst'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-monitor-tst'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'azuremonitor'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-monitor-tst'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'monitor'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
    ]
    prd: [
      {
        serviceType: 'sql-primary'
        name: 'pe-sql-primary-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-sql-primary-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'sqlServer'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-sql-primary-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'sql'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'sql-recovery'
        name: 'pe-sql-recovery-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-sql-recovery-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'sqlServer'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-sql-recovery-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'sql'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'servicebus'
        name: 'pe-servicebus-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-servicebus-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'namespace'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-servicebus-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'sb'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'keyvault'
        name: 'pe-keyvault-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-keyvault-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'vault'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-keyvault-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'kv'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'appconfig'
        name: 'pe-appconfig-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-appconfig-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'configurationStores'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-appconfig-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'appcs'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'search'
        name: 'pe-search-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-search-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'searchService'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-search-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'search'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'openai'
        name: 'pe-openai-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-openai-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'account'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-openai-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'openai'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'documentintelligence'
        name: 'pe-documentintelligence-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-documentintelligence-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'account'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-documentintelligence-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'docai'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'acr'
        name: 'pe-acr-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-acr-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'registry'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-acr-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'acr'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'apim-primary'
        name: 'pe-apim-primary-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-apim-primary-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'gateway'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-apim-primary-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'apim'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'apim-recovery'
        name: 'pe-apim-recovery-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-apim-recovery-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'gateway'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-apim-recovery-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'apim'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
      {
        serviceType: 'monitor'
        name: 'pe-monitor-prd'
        subnetId: 'REQUIRED_OWNER_INPUT'
        connectionName: 'conn-pe-monitor-prd'
        targetResourceId: 'REQUIRED_OWNER_INPUT'
        groupIds: [
          'azuremonitor'
        ]
        requestMessage: 'REQUIRED_OWNER_INPUT'
        networkInterfaceName: 'nic-pe-monitor-prd'
        privateDnsZoneGroup: {
          name: 'default'
          configs: [
            {
              name: 'monitor'
              properties: {
                privateDnsZoneId: 'REQUIRED_OWNER_INPUT'
              }
            }
          ]
        }
      }
    ]
  }
}

param du14 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  apimResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  privateEndpointEvidenceStateByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  privateEndpointEvidenceIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  privateEndpointEvidenceHashByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  dnsEvidenceStateByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  dnsEvidenceIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  dnsEvidenceHashByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  apiAdmissionEvidenceStateByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  apiAdmissionEvidenceIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  apiAdmissionEvidenceHashByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  apimByEnvironment: {
    dev: {
      name: 'apim-stratton-dev'
      publicNetworkAccess: 'Disabled'
      backends: [
        {
          name: 'api-backend'
          protocol: 'http'
          url: 'REQUIRED_OWNER_INPUT'
          tls: {}
          credentials: {}
          proxy: {}
        }
      ]
      apis: [
        {
          name: 'stratton-api'
          displayName: 'Stratton API'
          path: 'stratton'
          protocols: ['https']
          serviceUrl: 'REQUIRED_OWNER_INPUT'
          subscriptionRequired: true
          apiType: 'http'
          apiRevision: '1'
          format: 'openapi+json'
          definitionValue: 'REQUIRED_OWNER_INPUT'
          backendId: 'api-backend'
          entraAuthentication: {
            tenantId: 'REQUIRED_OWNER_INPUT'
            clientId: 'REQUIRED_OWNER_INPUT'
            allowedAudience: 'REQUIRED_OWNER_INPUT'
          }
        }
      ]
    }
    tst: {
      name: 'apim-stratton-tst'
      publicNetworkAccess: 'Disabled'
      backends: [
        {
          name: 'api-backend'
          protocol: 'http'
          url: 'REQUIRED_OWNER_INPUT'
          tls: {}
          credentials: {}
          proxy: {}
        }
      ]
      apis: [
        {
          name: 'stratton-api'
          displayName: 'Stratton API'
          path: 'stratton'
          protocols: ['https']
          serviceUrl: 'REQUIRED_OWNER_INPUT'
          subscriptionRequired: true
          apiType: 'http'
          apiRevision: '1'
          format: 'openapi+json'
          definitionValue: 'REQUIRED_OWNER_INPUT'
          backendId: 'api-backend'
          entraAuthentication: {
            tenantId: 'REQUIRED_OWNER_INPUT'
            clientId: 'REQUIRED_OWNER_INPUT'
            allowedAudience: 'REQUIRED_OWNER_INPUT'
          }
        }
      ]
    }
    prd: {
      name: 'apim-stratton-prd'
      publicNetworkAccess: 'Disabled'
      backends: [
        {
          name: 'api-backend'
          protocol: 'http'
          url: 'REQUIRED_OWNER_INPUT'
          tls: {}
          credentials: {}
          proxy: {}
        }
      ]
      apis: [
        {
          name: 'stratton-api'
          displayName: 'Stratton API'
          path: 'stratton'
          protocols: ['https']
          serviceUrl: 'REQUIRED_OWNER_INPUT'
          subscriptionRequired: true
          apiType: 'http'
          apiRevision: '1'
          format: 'openapi+json'
          definitionValue: 'REQUIRED_OWNER_INPUT'
          backendId: 'api-backend'
          entraAuthentication: {
            tenantId: 'REQUIRED_OWNER_INPUT'
            clientId: 'REQUIRED_OWNER_INPUT'
            allowedAudience: 'REQUIRED_OWNER_INPUT'
          }
        }
      ]
    }
  }
}

param du15 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  ingressResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  featureRegistrationEvidenceIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  featureRegistrationEvidenceHashByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  ingressByEnvironment: {
    dev: {
      name: 'agw-stratton-dev'
      skuName: 'WAF_v2'
      skuTier: 'WAF_v2'
      autoscale: {
        minCapacity: 1
        maxCapacity: 'REQUIRED_OWNER_INPUT'
      }
      subnetId: 'REQUIRED_OWNER_INPUT'
      frontend: {
        privateIpAllocationMethod: 'Static'
        privateIpAddress: 'REQUIRED_OWNER_INPUT'
      }
      tlsCertificateKeyVaultSecretId: 'REQUIRED_OWNER_INPUT'
      apimPrivateFqdn: 'REQUIRED_OWNER_INPUT'
      requestTimeoutSeconds: 'REQUIRED_OWNER_INPUT'
      trustedRootCertificates: []
      healthProbePath: '/status-0123456789abcdef'
      healthProbeIntervalSeconds: 30
      healthProbeTimeoutSeconds: 30
      healthProbeUnhealthyThreshold: 3
      healthProbeStatusCodes: ['200-399']
      rulePriority: 100
      sslPolicyName: 'AppGwSslPolicy20220101'
      wafPolicyId: 'REQUIRED_OWNER_INPUT'
    }
    tst: {
      name: 'agw-stratton-tst'
      skuName: 'WAF_v2'
      skuTier: 'WAF_v2'
      autoscale: {
        minCapacity: 1
        maxCapacity: 'REQUIRED_OWNER_INPUT'
      }
      subnetId: 'REQUIRED_OWNER_INPUT'
      frontend: {
        privateIpAllocationMethod: 'Static'
        privateIpAddress: 'REQUIRED_OWNER_INPUT'
      }
      tlsCertificateKeyVaultSecretId: 'REQUIRED_OWNER_INPUT'
      apimPrivateFqdn: 'REQUIRED_OWNER_INPUT'
      requestTimeoutSeconds: 'REQUIRED_OWNER_INPUT'
      trustedRootCertificates: []
      healthProbePath: '/status-0123456789abcdef'
      healthProbeIntervalSeconds: 30
      healthProbeTimeoutSeconds: 30
      healthProbeUnhealthyThreshold: 3
      healthProbeStatusCodes: ['200-399']
      rulePriority: 100
      sslPolicyName: 'AppGwSslPolicy20220101'
      wafPolicyId: 'REQUIRED_OWNER_INPUT'
    }
    prd: {
      name: 'agw-stratton-prd'
      skuName: 'WAF_v2'
      skuTier: 'WAF_v2'
      autoscale: {
        minCapacity: 2
        maxCapacity: 'REQUIRED_OWNER_INPUT'
      }
      subnetId: 'REQUIRED_OWNER_INPUT'
      frontend: {
        privateIpAllocationMethod: 'Static'
        privateIpAddress: 'REQUIRED_OWNER_INPUT'
      }
      tlsCertificateKeyVaultSecretId: 'REQUIRED_OWNER_INPUT'
      apimPrivateFqdn: 'REQUIRED_OWNER_INPUT'
      requestTimeoutSeconds: 'REQUIRED_OWNER_INPUT'
      trustedRootCertificates: []
      healthProbePath: '/status-0123456789abcdef'
      healthProbeIntervalSeconds: 30
      healthProbeTimeoutSeconds: 30
      healthProbeUnhealthyThreshold: 3
      healthProbeStatusCodes: ['200-399']
      rulePriority: 100
      sslPolicyName: 'AppGwSslPolicy20220101'
      wafPolicyId: 'REQUIRED_OWNER_INPUT'
    }
  }
}

param du16 = {
  assuranceResourceGroupByEnvironment: {
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    prd: 'REQUIRED_OWNER_INPUT'
  }
  assuranceByEnvironment: {
    prd: {
      retentionFinalization: {
        state: 'BLOCKED_PENDING_SEPARATELY_AUTHORISED_LOCK_AND_LEGAL_HOLD_EVIDENCE'
        dataAdmissionEnabled: false
        immutabilityLockRequired: true
        legalHoldRequired: true
        immutabilityLockEvidenceId: ''
        immutabilityLockEvidenceSha256: ''
        legalHoldEvidenceId: ''
        legalHoldEvidenceSha256: ''
      }
      legalHoldTags: [
        'REQUIRED_OWNER_INPUT'
      ]
      evidenceStorage: {
        name: 'ststrpaevid01'
        skuName: 'REQUIRED_OWNER_INPUT'
        minimumTlsVersion: 'TLS1_2'
        networkBypass: 'REQUIRED_OWNER_INPUT'
        virtualNetworkRules: []
        ipRules: []
        versioningEnabled: true
        deleteRetentionEnabled: true
        deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
        containerDeleteRetentionEnabled: true
        containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
        immutabilityDays: 'REQUIRED_OWNER_INPUT'
        containerName: 'evidence-drop'
        tags: {
          assurancePurpose: 'evidence-drop'
        }
      }
      verdictStorage: {
        name: 'ststrpaverd01'
        skuName: 'REQUIRED_OWNER_INPUT'
        minimumTlsVersion: 'TLS1_2'
        networkBypass: 'REQUIRED_OWNER_INPUT'
        virtualNetworkRules: []
        ipRules: []
        versioningEnabled: true
        deleteRetentionEnabled: true
        deleteRetentionDays: 'REQUIRED_OWNER_INPUT'
        containerDeleteRetentionEnabled: true
        containerDeleteRetentionDays: 'REQUIRED_OWNER_INPUT'
        immutabilityDays: 'REQUIRED_OWNER_INPUT'
        containerName: 'verdict'
        tags: {
          assurancePurpose: 'verdict'
        }
      }
      evidenceReaderCopierPrincipalId: 'REQUIRED_OWNER_INPUT'
      evidenceReaderCopierAuthority: 'Internal Audit'
      evidenceReaderCopierRoleDefinitionId: 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
      auditEvidenceReadRoleDefinitionId: '2a2b9908-6ea1-4ae2-8e65-a410df84e7d1'
      auditRoleDefinitionId: '17d1049b-9a84-46fb-8f53-869881c3d3ab'
    }
  }
  pendingAuthorityAmendment: {
    changeId: 'STRATTON-CC-001'
    approvalState: 'APPROVED'
    approvalEvidenceId: 'STRATTON-CC-001-APPROVAL-001'
    approvalEvidenceHash: 'ec2ddad8bc9c38993d5266985db5c9e9f12358034ba3aad9c61cd93465d8b21d'
    enableVerdictApiComputeBoundaryProvisioning: false
    enableGovernedAnalysisVectorizationProvisioning: false
    enableAuditExportPushEndpointQueueProvisioning: false
  }
}

param du17 = {
  subscriptionIdByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  diagnosticsResourceGroupByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  locationByEnvironment: {
    dev: 'REQUIRED_OWNER_INPUT'
    tst: 'REQUIRED_OWNER_INPUT'
    prd: 'REQUIRED_OWNER_INPUT'
  }
  diagnosticsByEnvironment: {
    dev: {
      assuranceAlerts: [
        {
          name: 'alt-001-dev'
          intentId: 'ALT-001'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-002-dev'
          intentId: 'ALT-002'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-003-dev'
          intentId: 'ALT-003'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-004-dev'
          intentId: 'ALT-004'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-005-dev'
          intentId: 'ALT-005'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-006-dev'
          intentId: 'ALT-006'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-007-dev'
          intentId: 'ALT-007'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-008-dev'
          intentId: 'ALT-008'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-009-dev'
          intentId: 'ALT-009'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-010-dev'
          intentId: 'ALT-010'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
      ]
      targets: {
        storageAccounts: [
          {
            resourceId: 'REQUIRED_OWNER_INPUT'
            diagnosticSettingName: 'diag-storage-dev'
            logs: [
              {
                categoryGroup: 'allLogs'
                enabled: true
              }
            ]
            metrics: [
              {
                category: 'AllMetrics'
                enabled: true
              }
            ]
          }
        ]
      }
      workspaceResourceId: 'REQUIRED_OWNER_INPUT'
      actionGroupResourceId: 'REQUIRED_OWNER_INPUT'
    }
    tst: {
      assuranceAlerts: [
        {
          name: 'alt-001-tst'
          intentId: 'ALT-001'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-002-tst'
          intentId: 'ALT-002'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-003-tst'
          intentId: 'ALT-003'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-004-tst'
          intentId: 'ALT-004'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-005-tst'
          intentId: 'ALT-005'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-006-tst'
          intentId: 'ALT-006'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-007-tst'
          intentId: 'ALT-007'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-008-tst'
          intentId: 'ALT-008'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-009-tst'
          intentId: 'ALT-009'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-010-tst'
          intentId: 'ALT-010'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
      ]
      targets: {
        storageAccounts: [
          {
            resourceId: 'REQUIRED_OWNER_INPUT'
            diagnosticSettingName: 'diag-storage-tst'
            logs: [
              {
                categoryGroup: 'allLogs'
                enabled: true
              }
            ]
            metrics: [
              {
                category: 'AllMetrics'
                enabled: true
              }
            ]
          }
        ]
      }
      workspaceResourceId: 'REQUIRED_OWNER_INPUT'
      actionGroupResourceId: 'REQUIRED_OWNER_INPUT'
    }
    prd: {
      assuranceAlerts: [
        {
          name: 'alt-001-prd'
          intentId: 'ALT-001'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-002-prd'
          intentId: 'ALT-002'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-003-prd'
          intentId: 'ALT-003'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-004-prd'
          intentId: 'ALT-004'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-005-prd'
          intentId: 'ALT-005'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-006-prd'
          intentId: 'ALT-006'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-007-prd'
          intentId: 'ALT-007'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-008-prd'
          intentId: 'ALT-008'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-009-prd'
          intentId: 'ALT-009'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
        {
          name: 'alt-010-prd'
          intentId: 'ALT-010'
          displayName: 'REQUIRED_OWNER_INPUT'
          description: 'REQUIRED_OWNER_INPUT'
          severity: 'REQUIRED_OWNER_INPUT'
          evaluationFrequency: 'REQUIRED_OWNER_INPUT'
          windowSize: 'REQUIRED_OWNER_INPUT'
          query: 'REQUIRED_OWNER_INPUT'
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 'REQUIRED_OWNER_INPUT'
          numberOfEvaluationPeriods: 1
          minFailingPeriodsToAlert: 1
          muteActionsDuration: 'REQUIRED_OWNER_INPUT'
        }
      ]
      targets: {
        storageAccounts: [
          {
            resourceId: 'REQUIRED_OWNER_INPUT'
            diagnosticSettingName: 'diag-storage-prd'
            logs: [
              {
                categoryGroup: 'allLogs'
                enabled: true
              }
            ]
            metrics: [
              {
                category: 'AllMetrics'
                enabled: true
              }
            ]
          }
        ]
      }
      workspaceResourceId: 'REQUIRED_OWNER_INPUT'
      actionGroupResourceId: 'REQUIRED_OWNER_INPUT'
    }
  }
}

param rolloutAdmissionMaximum = 20
