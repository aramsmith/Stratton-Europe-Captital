targetScope = 'subscription'

@allowed([
  'dev'
  'tst'
  'prd'
])
param environment string
param settings object
param modelPortfolioDeploymentEnabled bool
param modelNameVersionAndQuota object
param modelCapabilityAndQuotaEvidenceByEnvironment object
param aiActClassificationEvidenceId string
param providerDataUseEvidenceId string
param tags object

var resolvedDeployments = [for deployment in settings.aiByEnvironment[environment].deployments: union(deployment, {
  modelName: modelNameVersionAndQuota[deployment.modelKey].name
  modelVersion: modelNameVersionAndQuota[deployment.modelKey].version
  capacity: modelNameVersionAndQuota[deployment.modelKey].capacity
})]

var gatedDeployments = modelPortfolioDeploymentEnabled ? resolvedDeployments : []

var aiConfig = union(settings.aiByEnvironment[environment], {
  openAi: union(settings.aiByEnvironment[environment].openAi, {
    deployments: gatedDeployments
  })
  deployments: gatedDeployments
})

module regionalAi '../../modules/regional-ai/main.bicep' = {
  name: 'du11-regional-ai-${environment}'
  scope: resourceGroup(settings.subscriptionIdByEnvironment[environment], settings.aiResourceGroupByEnvironment[environment])
  params: {
    location: settings.locationByEnvironment[environment]
    tags: union(tags, {
      aiActClassificationEvidenceId: aiActClassificationEvidenceId
      providerDataUseEvidenceId: providerDataUseEvidenceId
      modelCapabilityQuotaEvidenceBinding: modelPortfolioDeploymentEnabled ? modelCapabilityAndQuotaEvidenceByEnvironment[environment].portfolioBindingSha256 : 'MODEL_PORTFOLIO_DISABLED'
    })
    ai: aiConfig
    workloadIdentityPrincipalIds: settings.workloadIdentityPrincipalIds
  }
}

output aiAccountId string = regionalAi.outputs.aiAccountId
output aiDeploymentIds array = regionalAi.outputs.aiDeploymentIds


output documentIntelligenceAccountId string = regionalAi.outputs.documentIntelligenceAccountId
output searchServiceId string = regionalAi.outputs.searchServiceId

