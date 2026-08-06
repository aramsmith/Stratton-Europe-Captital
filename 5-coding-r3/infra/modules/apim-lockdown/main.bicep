targetScope = 'resourceGroup'

@allowed([
  'APPROVED'
])
param privateEndpointEvidenceState string

@allowed([
  'APPROVED'
])
param dnsEvidenceState string

@allowed([
  'APPROVED'
])
param apiAdmissionEvidenceState string

param privateEndpointEvidenceId string
param privateEndpointEvidenceHash string
param dnsEvidenceId string
param dnsEvidenceHash string
param apiAdmissionEvidenceId string
param apiAdmissionEvidenceHash string

param apim object

var lockdownGatePassed = privateEndpointEvidenceState == 'APPROVED' && dnsEvidenceState == 'APPROVED' && apiAdmissionEvidenceState == 'APPROVED' && !empty(privateEndpointEvidenceId) && !empty(privateEndpointEvidenceHash) && !empty(dnsEvidenceId) && !empty(dnsEvidenceHash) && !empty(apiAdmissionEvidenceId) && !empty(apiAdmissionEvidenceHash) && apim.publicNetworkAccess == 'Disabled'

resource apimService 'Microsoft.ApiManagement/service@2023-05-01-preview' existing = {
  name: apim.name
}

resource apimBackends 'Microsoft.ApiManagement/service/backends@2023-05-01-preview' = [for backend in apim.backends: if (lockdownGatePassed) {
  parent: apimService
  name: backend.name
  properties: {
    protocol: backend.protocol
    url: backend.url
    tls: backend.tls
    credentials: backend.credentials
    proxy: backend.proxy
  }
}]

resource apimApis 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = [for api in apim.apis: if (lockdownGatePassed) {
  parent: apimService
  name: api.name
  properties: {
    displayName: api.displayName
    path: api.path
    protocols: api.protocols
    serviceUrl: api.serviceUrl
    subscriptionRequired: api.subscriptionRequired
    isCurrent: true
    apiType: api.apiType
    apiRevision: api.apiRevision
    format: api.format
    value: api.definitionValue
  }
}]

resource apimApiPolicies 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = [for (api, index) in apim.apis: if (lockdownGatePassed) {
  parent: apimApis[index]
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: api.policyXml
  }
}]

output lockdownComplete bool = lockdownGatePassed
output apimServiceId string = apimService.id
output admittedApiCount int = lockdownGatePassed ? length(apim.apis) : 0


