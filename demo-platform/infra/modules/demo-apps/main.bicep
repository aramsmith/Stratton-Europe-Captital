param location string
param tenantId string
param namePrefix string
param tags object
param containerAppsEnvironmentId string
param containerRegistryServer string
param logAnalyticsWorkspaceId string
param webImageRepository string
param webImageDigest string
param bffImageRepository string
param bffImageDigest string
param webContainerPort int
param bffContainerPort int
param phase5ApiBaseUrl string
param sqlServerFqdn string
param sqlDatabaseName string
param blobAccountUrl string
param blobContainerName string
param serviceBusFqdn string
param serviceBusQueueName string
param searchEndpoint string
param searchIndexName string
param documentIntelligenceEndpoint string
param lunaOpenAiEndpoint string
param lunaOpenAiDeploymentId string
param lunaOpenAiApiVersion string
param lunaOpenAiEvidenceId string
param terraOpenAiEndpoint string
param terraOpenAiDeploymentId string
param terraOpenAiApiVersion string
param terraOpenAiEvidenceId string
param solOpenAiEndpoint string
param solOpenAiDeploymentId string
param solOpenAiApiVersion string
param solOpenAiEvidenceId string
param webEntraClientId string
param webAllowedAudiences array
param bffEntraClientId string
param bffAllowedAudiences array

var managedEnvironmentIdParts = split(containerAppsEnvironmentId, '/')
var managedEnvironmentName = managedEnvironmentIdParts[8]
var workspaceIdParts = split(logAnalyticsWorkspaceId, '/')
var workspaceName = workspaceIdParts[8]
var webIdentityName = '${namePrefix}-web-mi'
var bffIdentityName = '${namePrefix}-bff-mi'
var webAppName = '${namePrefix}-web'
var bffAppName = '${namePrefix}-bff'
var entraIssuer = '${environment().authentication.loginEndpoint}${tenantId}/v2.0'
var webImage = '${containerRegistryServer}/${webImageRepository}@${webImageDigest}'
var bffImage = '${containerRegistryServer}/${bffImageRepository}@${bffImageDigest}'
var defaultScale = {
  minReplicas: 1
  maxReplicas: 1
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: managedEnvironmentName
}

resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: workspaceName
}

resource webIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: webIdentityName
  location: location
  tags: union(tags, {
    'stratton.caseId': 'project-danube'
    'stratton.component': 'web'
  })
}

resource bffIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: bffIdentityName
  location: location
  tags: union(tags, {
    'stratton.caseId': 'project-danube'
    'stratton.component': 'bff'
  })
}

resource webApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: webAppName
  location: location
  tags: union(tags, {
    'stratton.caseId': 'project-danube'
    'stratton.component': 'web'
    'stratton.telemetry': 'redacted'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${webIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: containerRegistryServer
          identity: webIdentity.id
        }
      ]
      ingress: {
        external: false
        allowInsecure: false
        targetPort: webContainerPort
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'web'
          image: webImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: defaultScale
    }
  }
}

resource bffApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: bffAppName
  location: location
  tags: union(tags, {
    'stratton.caseId': 'project-danube'
    'stratton.component': 'bff'
    'stratton.telemetry': 'redacted'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${bffIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: containerRegistryServer
          identity: bffIdentity.id
        }
      ]
      ingress: {
        external: false
        allowInsecure: false
        targetPort: bffContainerPort
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'bff'
          image: bffImage
          env: [
            {
              name: 'DEMO_MODE'
              value: 'AZURE'
            }
            {
              name: 'PHASE5_API_BASE_URL'
              value: phase5ApiBaseUrl
            }
            {
              name: 'AZURE_SQL_SERVER_FQDN'
              value: sqlServerFqdn
            }
            {
              name: 'AZURE_SQL_DATABASE_NAME'
              value: sqlDatabaseName
            }
            {
              name: 'DEMO_TENANT_ID'
              value: tenantId
            }
            {
              name: 'AZURE_MANAGED_IDENTITY_CLIENT_ID'
              value: bffIdentity.properties.clientId
            }
            {
              name: 'AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT'
              value: documentIntelligenceEndpoint
            }
            {
              name: 'AZURE_SEARCH_ENDPOINT'
              value: searchEndpoint
            }
            {
              name: 'AZURE_SEARCH_INDEX_NAME'
              value: searchIndexName
            }
            {
              name: 'AZURE_BLOB_ACCOUNT_URL'
              value: blobAccountUrl
            }
            {
              name: 'AZURE_BLOB_CONTAINER_NAME'
              value: blobContainerName
            }
            {
              name: 'AZURE_SERVICE_BUS_NAMESPACE'
              value: serviceBusFqdn
            }
            {
              name: 'AZURE_SERVICE_BUS_QUEUE_NAME'
              value: serviceBusQueueName
            }
            {
              name: 'AZURE_OPENAI_LUNA_ENDPOINT'
              value: lunaOpenAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_LUNA_DEPLOYMENT_ID'
              value: lunaOpenAiDeploymentId
            }
            {
              name: 'AZURE_OPENAI_LUNA_API_VERSION'
              value: lunaOpenAiApiVersion
            }
            {
              name: 'AZURE_OPENAI_LUNA_EVIDENCE_ID'
              value: lunaOpenAiEvidenceId
            }
            {
              name: 'AZURE_OPENAI_TERRA_ENDPOINT'
              value: terraOpenAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_TERRA_DEPLOYMENT_ID'
              value: terraOpenAiDeploymentId
            }
            {
              name: 'AZURE_OPENAI_TERRA_API_VERSION'
              value: terraOpenAiApiVersion
            }
            {
              name: 'AZURE_OPENAI_TERRA_EVIDENCE_ID'
              value: terraOpenAiEvidenceId
            }
            {
              name: 'AZURE_OPENAI_SOL_ENDPOINT'
              value: solOpenAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_SOL_DEPLOYMENT_ID'
              value: solOpenAiDeploymentId
            }
            {
              name: 'AZURE_OPENAI_SOL_API_VERSION'
              value: solOpenAiApiVersion
            }
            {
              name: 'AZURE_OPENAI_SOL_EVIDENCE_ID'
              value: solOpenAiEvidenceId
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: defaultScale
    }
  }
}

resource webAuthConfig 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  name: 'current'
  parent: webApp
  properties: {
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
    globalValidation: {
      unauthenticatedClientAction: 'Return401'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: [
        '/healthz'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: webEntraClientId
          openIdIssuer: entraIssuer
        }
        validation: {
          allowedAudiences: webAllowedAudiences
        }
      }
    }
  }
}

resource bffAuthConfig 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  name: 'current'
  parent: bffApp
  properties: {
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
    globalValidation: {
      unauthenticatedClientAction: 'Return401'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: [
        '/healthz'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: bffEntraClientId
          openIdIssuer: entraIssuer
        }
        validation: {
          allowedAudiences: bffAllowedAudiences
        }
      }
    }
  }
}

resource webDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${webAppName}-diagnostics'
  scope: webApp
  properties: {
    workspaceId: workspace.id
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
}

resource bffDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${bffAppName}-diagnostics'
  scope: bffApp
  properties: {
    workspaceId: workspace.id
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
}

output webAppName string = webApp.name
output webAppId string = webApp.id
output webAppFqdn string = webApp.properties.configuration.ingress.fqdn
output webIdentityName string = webIdentity.name
output webIdentityResourceId string = webIdentity.id
output webIdentityClientId string = webIdentity.properties.clientId
output webIdentityPrincipalId string = webIdentity.properties.principalId
output bffAppName string = bffApp.name
output bffAppId string = bffApp.id
output bffAppFqdn string = bffApp.properties.configuration.ingress.fqdn
output bffIdentityName string = bffIdentity.name
output bffIdentityResourceId string = bffIdentity.id
output bffIdentityClientId string = bffIdentity.properties.clientId
output bffIdentityPrincipalId string = bffIdentity.properties.principalId
