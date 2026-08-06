targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription object
param tags object

var workloadSubscriptionId = settings.subscriptionIdByEnvironment[environment]

module ingress '../../modules/ingress/main.bicep' = {
  name: 'du15-ingress-${environment}'
  scope: resourceGroup(workloadSubscriptionId, settings.ingressResourceGroupByEnvironment[environment])
  params: {
    featureRegistrationEvidenceState: applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription[workloadSubscriptionId]
    featureRegistrationEvidenceId: settings.featureRegistrationEvidenceIdByEnvironment[environment]
    featureRegistrationEvidenceHash: settings.featureRegistrationEvidenceHashByEnvironment[environment]
    location: settings.locationByEnvironment[environment]
    tags: tags
    ingress: settings.ingressByEnvironment[environment]
  }
}

output applicationGatewayId string = ingress.outputs.applicationGatewayId
output featureGatePassed bool = ingress.outputs.featureGatePassed
