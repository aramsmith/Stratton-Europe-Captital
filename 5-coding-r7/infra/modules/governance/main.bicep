targetScope = 'managementGroup'

param approvedLocationList array
param approvedLocationEvidenceId string
param regulatoryEvidenceRegisterVersion string
param tags object
param settings object

resource allowedLocationsPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-allowed-locations'
  properties: {
    displayName: 'Stratton allowed locations with global and locationless exclusions'
    policyType: 'Custom'
    mode: 'Indexed'
    metadata: {
      approvedLocationEvidenceId: approvedLocationEvidenceId
      regulatoryEvidenceRegisterVersion: regulatoryEvidenceRegisterVersion
      tags: tags
    }
    policyRule: {
      if: {
        allOf: [
          {
            field: 'location'
            notIn: approvedLocationList
          }
          {
            field: 'location'
            notEquals: 'global'
          }
          {
            field: 'location'
            notEquals: ''
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denyPublicIpPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-workload-public-ip'
  properties: {
    displayName: 'Deny public IP except approved Citadel firewall egress IDs'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.Network/publicIPAddresses'
          }
          {
            field: 'id'
            notIn: settings.approvedFirewallPublicIpResourceIds
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denySqlPublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-sql-public-network'
  properties: {
    displayName: 'Deny SQL public network access'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.Sql/servers'
          }
          {
            field: 'Microsoft.Sql/servers/publicNetworkAccess'
            notEquals: 'Disabled'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denyStoragePublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-storage-public-network'
  properties: {
    displayName: 'Deny storage public network and blob public access'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        anyOf: [
          {
            allOf: [
              {
                field: 'type'
                equals: 'Microsoft.Storage/storageAccounts'
              }
              {
                field: 'Microsoft.Storage/storageAccounts/publicNetworkAccess'
                notEquals: 'Disabled'
              }
            ]
          }
          {
            allOf: [
              {
                field: 'type'
                equals: 'Microsoft.Storage/storageAccounts'
              }
              {
                field: 'Microsoft.Storage/storageAccounts/allowBlobPublicAccess'
                notEquals: false
              }
            ]
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denyAppConfigPublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-appconfig-public-network'
  properties: {
    displayName: 'Deny App Configuration public network access'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.AppConfiguration/configurationStores'
          }
          {
            field: 'Microsoft.AppConfiguration/configurationStores/publicNetworkAccess'
            notEquals: 'Disabled'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denyKeyVaultPublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-keyvault-public-network'
  properties: {
    displayName: 'Deny Key Vault public network access'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.KeyVault/vaults'
          }
          {
            field: 'Microsoft.KeyVault/vaults/publicNetworkAccess'
            notEquals: 'Disabled'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denyAcrPublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-acr-public-network'
  properties: {
    displayName: 'Deny ACR public network access'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.ContainerRegistry/registries'
          }
          {
            field: 'Microsoft.ContainerRegistry/registries/publicNetworkAccess'
            notEquals: 'Disabled'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denyServiceBusPublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-servicebus-public-network'
  properties: {
    displayName: 'Deny Service Bus public network access'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.ServiceBus/namespaces'
          }
          {
            field: 'Microsoft.ServiceBus/namespaces/publicNetworkAccess'
            notEquals: 'Disabled'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denyApimPublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-apim-public-network'
  properties: {
    displayName: 'Deny APIM public network access'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.ApiManagement/service'
          }
          {
            field: 'Microsoft.ApiManagement/service/publicNetworkAccess'
            notEquals: 'Disabled'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denyCognitivePublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-cognitive-public-network'
  properties: {
    displayName: 'Deny Cognitive Services public access and local auth'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        anyOf: [
          {
            allOf: [
              {
                field: 'type'
                equals: 'Microsoft.CognitiveServices/accounts'
              }
              {
                field: 'Microsoft.CognitiveServices/accounts/publicNetworkAccess'
                notEquals: 'Disabled'
              }
            ]
          }
          {
            allOf: [
              {
                field: 'type'
                equals: 'Microsoft.CognitiveServices/accounts'
              }
              {
                field: 'Microsoft.CognitiveServices/accounts/disableLocalAuth'
                notEquals: true
              }
            ]
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource denySearchPublicPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-deny-search-public-network'
  properties: {
    displayName: 'Deny Search public network access'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.Search/searchServices'
          }
          {
            field: 'Microsoft.Search/searchServices/publicNetworkAccess'
            notEquals: 'Disabled'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource enforceEuDataZoneAiPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-require-eu-data-zone-ai'
  properties: {
    displayName: 'Require EU Data Zone Standard Azure AI deployments'
    policyType: 'Custom'
    mode: 'All'
    policyRule: {
      if: {
        allOf: [
          {
            field: 'type'
            equals: 'Microsoft.CognitiveServices/accounts/deployments'
          }
          {
            field: 'Microsoft.CognitiveServices/accounts/deployments/sku.name'
            notEquals: 'DataZoneStandard'
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource requireTagsPolicy 'Microsoft.Authorization/policyDefinitions@2023-04-01' = {
  name: 'stratton-require-tags'
  properties: {
    displayName: 'Require approved Stratton tags'
    policyType: 'Custom'
    mode: 'Indexed'
    policyRule: {
      if: {
        anyOf: [
          {
            field: 'tags[environment]'
            exists: false
          }
          {
            field: 'tags[workload]'
            exists: false
          }
          {
            field: 'tags[owner]'
            exists: false
          }
          {
            field: 'tags[costCenter]'
            exists: false
          }
          {
            field: 'tags[dataClassification]'
            exists: false
          }
          {
            field: 'tags[criticality]'
            exists: false
          }
          {
            field: 'tags[managedBy]'
            exists: false
          }
        ]
      }
      then: {
        effect: 'deny'
      }
    }
  }
}

resource initiative 'Microsoft.Authorization/policySetDefinitions@2023-04-01' = {
  name: 'stratton-sovereign-guardrails'
  properties: {
    policyType: 'Custom'
    displayName: 'Stratton sovereign and private guardrails'
    policyDefinitions: [
      {
        policyDefinitionId: allowedLocationsPolicy.id
      }
      {
        policyDefinitionId: denyPublicIpPolicy.id
      }
      {
        policyDefinitionId: denySqlPublicPolicy.id
      }
      {
        policyDefinitionId: denyStoragePublicPolicy.id
      }
      {
        policyDefinitionId: denyAppConfigPublicPolicy.id
      }
      {
        policyDefinitionId: denyKeyVaultPublicPolicy.id
      }
      {
        policyDefinitionId: denyAcrPublicPolicy.id
      }
      {
        policyDefinitionId: denyServiceBusPublicPolicy.id
      }
      {
        policyDefinitionId: denyApimPublicPolicy.id
      }
      {
        policyDefinitionId: denyCognitivePublicPolicy.id
      }
      {
        policyDefinitionId: denySearchPublicPolicy.id
      }
      {
        policyDefinitionId: enforceEuDataZoneAiPolicy.id
      }
      {
        policyDefinitionId: requireTagsPolicy.id
      }
    ]
  }
}

resource assignment 'Microsoft.Authorization/policyAssignments@2024-04-01' = {
  name: 'stratton-sovereign-guardrails-assignment'
  properties: {
    displayName: 'Stratton sovereign and private guardrails assignment'
    policyDefinitionId: initiative.id
    metadata: {
      approvedLocationEvidenceId: approvedLocationEvidenceId
      regulatoryEvidenceRegisterVersion: regulatoryEvidenceRegisterVersion
    }
  }
}

resource exemptions 'Microsoft.Authorization/policyExemptions@2024-12-01-preview' = [for exemption in settings.exemptions: {
  name: exemption.name
  properties: {
    exemptionCategory: exemption.category
    displayName: exemption.displayName
    description: exemption.description
    policyAssignmentId: assignment.id
    policyDefinitionReferenceIds: exemption.policyDefinitionReferenceIds
    expiresOn: exemption.expiresOn
    metadata: exemption.metadata
  }
}]

output assignmentId string = assignment.id
output exemptionCount int = length(exemptions)
