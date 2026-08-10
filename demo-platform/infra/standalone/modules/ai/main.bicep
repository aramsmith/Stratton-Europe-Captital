param location string
param openAiLocation string
param tags object
param documentIntelligenceAccountName string
param openAiAccountName string
param lunaModelName string
param lunaModelVersion string
param lunaModelCapacity int
param terraModelName string
param terraModelVersion string
param terraModelCapacity int
param solModelName string
param solModelVersion string
param solModelCapacity int

resource documentIntelligence 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: documentIntelligenceAccountName
  location: location
  tags: tags
  kind: 'FormRecognizer'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: documentIntelligenceAccountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
}

resource openAi 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: openAiAccountName
  location: openAiLocation
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  properties: {
    customSubDomainName: openAiAccountName
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: true
  }
}

resource luna 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: 'luna-evidence-triage'
  sku: {
    name: 'DataZoneStandard'
    capacity: lunaModelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: lunaModelName
      version: lunaModelVersion
    }
  }
}

resource terra 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: 'terra-grounded-analysis'
  dependsOn: [
    luna
  ]
  sku: {
    name: 'DataZoneStandard'
    capacity: terraModelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: terraModelName
      version: terraModelVersion
    }
  }
}

resource sol 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = {
  parent: openAi
  name: 'sol-thesis-challenge'
  dependsOn: [
    terra
  ]
  sku: {
    name: 'DataZoneStandard'
    capacity: solModelCapacity
  }
  properties: {
    model: {
      format: 'OpenAI'
      name: solModelName
      version: solModelVersion
    }
  }
}

output documentIntelligenceEndpoint string = documentIntelligence.properties.endpoint
output documentIntelligenceAccountResourceId string = documentIntelligence.id
output lunaOpenAiEndpoint string = openAi.properties.endpoint
output lunaOpenAiAccountResourceId string = openAi.id
output lunaOpenAiRegion string = openAi.location
output lunaOpenAiDeploymentId string = luna.name
output terraOpenAiEndpoint string = openAi.properties.endpoint
output terraOpenAiAccountResourceId string = openAi.id
output terraOpenAiRegion string = openAi.location
output terraOpenAiDeploymentId string = terra.name
output solOpenAiEndpoint string = openAi.properties.endpoint
output solOpenAiAccountResourceId string = openAi.id
output solOpenAiRegion string = openAi.location
output solOpenAiDeploymentId string = sol.name
