targetScope = 'resourceGroup'

@allowed([
  'Registered'
])
param featureRegistrationEvidenceState string
param featureRegistrationEvidenceId string
param featureRegistrationEvidenceHash string

param location string
param tags object
param ingress object

resource applicationGateway 'Microsoft.Network/applicationGateways@2023-09-01' = {
  name: ingress.name
  location: location
  tags: tags
  properties: {
    sku: {
      name: ingress.skuName
      tier: ingress.skuTier
    }
    autoscaleConfiguration: {
      minCapacity: ingress.autoscale.minCapacity
      maxCapacity: ingress.autoscale.maxCapacity
    }
    gatewayIPConfigurations: [
      {
        name: 'gw-ipconfig'
        properties: {
          subnet: {
            id: ingress.subnetId
          }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'private-frontend'
        properties: {
          privateIPAllocationMethod: ingress.frontend.privateIpAllocationMethod
          privateIPAddress: ingress.frontend.privateIpAddress
          subnet: {
            id: ingress.subnetId
          }
        }
      }
    ]
    frontendPorts: [
      {
        name: 'https-443'
        properties: {
          port: 443
        }
      }
    ]
    sslCertificates: [
      {
        name: 'tls-cert'
        properties: {
          keyVaultSecretId: ingress.tlsCertificateKeyVaultSecretId
        }
      }
    ]
    backendAddressPools: [
      {
        name: 'apim-backend-pool'
        properties: {
          backendAddresses: [
            {
              fqdn: ingress.apimPrivateFqdn
            }
          ]
        }
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: 'apim-https-settings'
        properties: {
          protocol: 'Https'
          port: 443
          pickHostNameFromBackendAddress: true
          requestTimeout: ingress.requestTimeoutSeconds
          probe: {
            id: resourceId('Microsoft.Network/applicationGateways/probes', ingress.name, 'apim-health-probe')
          }
          cookieBasedAffinity: 'Disabled'
          trustedRootCertificates: ingress.trustedRootCertificates
        }
      }
    ]
    probes: [
      {
        name: 'apim-health-probe'
        properties: {
          protocol: 'Https'
          host: ingress.apimPrivateFqdn
          path: ingress.healthProbePath
          interval: ingress.healthProbeIntervalSeconds
          timeout: ingress.healthProbeTimeoutSeconds
          unhealthyThreshold: ingress.healthProbeUnhealthyThreshold
          pickHostNameFromBackendHttpSettings: false
          match: {
            statusCodes: ingress.healthProbeStatusCodes
          }
        }
      }
    ]
    httpListeners: [
      {
        name: 'https-listener'
        properties: {
          frontendIPConfiguration: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendIPConfigurations', ingress.name, 'private-frontend')
          }
          frontendPort: {
            id: resourceId('Microsoft.Network/applicationGateways/frontendPorts', ingress.name, 'https-443')
          }
          protocol: 'Https'
          sslCertificate: {
            id: resourceId('Microsoft.Network/applicationGateways/sslCertificates', ingress.name, 'tls-cert')
          }
          requireServerNameIndication: false
        }
      }
    ]
    requestRoutingRules: [
      {
        name: 'apim-route-rule'
        properties: {
          ruleType: 'Basic'
          priority: ingress.rulePriority
          httpListener: {
            id: resourceId('Microsoft.Network/applicationGateways/httpListeners', ingress.name, 'https-listener')
          }
          backendAddressPool: {
            id: resourceId('Microsoft.Network/applicationGateways/backendAddressPools', ingress.name, 'apim-backend-pool')
          }
          backendHttpSettings: {
            id: resourceId('Microsoft.Network/applicationGateways/backendHttpSettingsCollection', ingress.name, 'apim-https-settings')
          }
        }
      }
    ]
    sslPolicy: {
      policyType: 'Predefined'
      policyName: ingress.sslPolicyName
    }
    firewallPolicy: {
      id: ingress.wafPolicyId
    }
    enableHttp2: true
  }
}

output applicationGatewayId string = applicationGateway.id
output featureGatePassed bool = featureRegistrationEvidenceState == 'Registered' && !empty(featureRegistrationEvidenceId) && !empty(featureRegistrationEvidenceHash)