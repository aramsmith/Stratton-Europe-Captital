targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object

module apimLockdown '../../modules/apim-lockdown/main.bicep' = {
  name: 'du14-apim-lockdown-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.apimResourceGroupByEnvironment[environment])
  params: {
    privateEndpointEvidenceState: settings.privateEndpointEvidenceStateByEnvironment[environment]
    dnsEvidenceState: settings.dnsEvidenceStateByEnvironment[environment]
    apiAdmissionEvidenceState: settings.apiAdmissionEvidenceStateByEnvironment[environment]
    privateEndpointEvidenceId: settings.privateEndpointEvidenceIdByEnvironment[environment]
    privateEndpointEvidenceHash: settings.privateEndpointEvidenceHashByEnvironment[environment]
    dnsEvidenceId: settings.dnsEvidenceIdByEnvironment[environment]
    dnsEvidenceHash: settings.dnsEvidenceHashByEnvironment[environment]
    apiAdmissionEvidenceId: settings.apiAdmissionEvidenceIdByEnvironment[environment]
    apiAdmissionEvidenceHash: settings.apiAdmissionEvidenceHashByEnvironment[environment]
    apim: settings.apimByEnvironment[environment]
  }
}

output lockdownComplete bool = apimLockdown.outputs.lockdownComplete
output apimServiceId string = apimLockdown.outputs.apimServiceId




