param location string
@minLength(36)
@maxLength(36)
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
param webDelegatedScope string
param bffRequiredDelegatedScope string
param phase5ApplicationId string
param phase5DelegatedScope string
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
param lunaOpenAiResourceId string
param lunaOpenAiRegion string
param lunaOpenAiDeploymentId string
param lunaOpenAiApiVersion string
param lunaOpenAiEvidenceId string
param lunaOpenAiRouteEvidenceVersion string
param terraOpenAiEndpoint string
param terraOpenAiResourceId string
param terraOpenAiRegion string
param terraOpenAiDeploymentId string
param terraOpenAiApiVersion string
param terraOpenAiEvidenceId string
param terraOpenAiRouteEvidenceVersion string
param solOpenAiEndpoint string
param solOpenAiResourceId string
param solOpenAiRegion string
param solOpenAiDeploymentId string
param solOpenAiApiVersion string
param solOpenAiEvidenceId string
param solOpenAiRouteEvidenceVersion string
param webEntraClientId string
param bffEntraClientId string
param webIdentityResourceId string
@minLength(36)
@maxLength(36)
param webIdentityClientId string
@minLength(36)
@maxLength(36)
param webIdentityPrincipalId string
param bffIdentityResourceId string
@minLength(36)
@maxLength(36)
param bffIdentityClientId string
@minLength(36)
@maxLength(36)
param bffIdentityPrincipalId string

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: last(split(containerAppsEnvironmentId, '/'))
}

var webIdentityName = split(webIdentityResourceId, '/')[8]
var bffIdentityName = split(bffIdentityResourceId, '/')[8]
var webAppName = '${namePrefix}-web'
var bffAppName = '${namePrefix}-bff'
var phase5ApiBaseUrl = 'https://${namePrefix}-phase5.${containerAppsEnvironment.properties.defaultDomain}'
var entraIssuer = '${environment().authentication.loginEndpoint}${tenantId}/v2.0'
var webImage = '${containerRegistryServer}/${webImageRepository}@${webImageDigest}'
var bffImage = '${containerRegistryServer}/${bffImageRepository}@${bffImageDigest}'
var bffInternalBaseUrl = 'https://${bffApp.properties.configuration.ingress.fqdn}'
var webScale = {
  minReplicas: 0
  maxReplicas: 1
}
var backendScale = {
  // Retain a warm BFF until web-proxy cold-start retry coverage has been demonstrated.
  minReplicas: 1
  maxReplicas: 1
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
      '${webIdentityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: containerRegistryServer
          identity: webIdentityResourceId
        }
      ]
      ingress: {
        external: true
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
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: string(webContainerPort)
            }
            {
              name: 'BFF_INTERNAL_BASE_URL'
              value: bffInternalBaseUrl
            }
            {
              name: 'DEMO_MODE'
              value: 'AZURE'
            }
            {
              name: 'DEMO_TENANT_ID'
              value: tenantId
            }
            {
              name: 'WEB_ENTRA_CLIENT_ID'
              value: webEntraClientId
            }
            {
              name: 'WEB_BFF_DELEGATED_SCOPE'
              value: webDelegatedScope
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: webScale
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
      '${bffIdentityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: containerRegistryServer
          identity: bffIdentityResourceId
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
              name: 'PHASE5_DELEGATED_SCOPE'
              value: phase5DelegatedScope
            }
            {
              name: 'PHASE5_APPLICATION_ID'
              value: phase5ApplicationId
            }
            {
              name: 'BFF_DELEGATED_AUDIENCE'
              value: bffEntraClientId
            }
            {
              name: 'BFF_REQUIRED_DELEGATED_SCOPE'
              value: bffRequiredDelegatedScope
            }
            {
              name: 'BFF_ENTRA_CLIENT_ID'
              value: bffEntraClientId
            }
            {
              name: 'BFF_ALLOWED_CLIENT_APPLICATION_ID'
              value: webEntraClientId
            }
            {
              name: 'ENTRA_TOKEN_ENDPOINT'
              value: '${environment().authentication.loginEndpoint}${tenantId}/oauth2/v2.0/token'
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
              value: bffIdentityClientId
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
              name: 'AZURE_OPENAI_LUNA_RESOURCE_ID'
              value: lunaOpenAiResourceId
            }
            {
              name: 'AZURE_OPENAI_LUNA_REGION'
              value: lunaOpenAiRegion
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
              name: 'AZURE_OPENAI_LUNA_ROUTE_EVIDENCE_VERSION'
              value: lunaOpenAiRouteEvidenceVersion
            }
            {
              name: 'AZURE_OPENAI_TERRA_ENDPOINT'
              value: terraOpenAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_TERRA_RESOURCE_ID'
              value: terraOpenAiResourceId
            }
            {
              name: 'AZURE_OPENAI_TERRA_REGION'
              value: terraOpenAiRegion
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
              name: 'AZURE_OPENAI_TERRA_ROUTE_EVIDENCE_VERSION'
              value: terraOpenAiRouteEvidenceVersion
            }
            {
              name: 'AZURE_OPENAI_SOL_ENDPOINT'
              value: solOpenAiEndpoint
            }
            {
              name: 'AZURE_OPENAI_SOL_RESOURCE_ID'
              value: solOpenAiResourceId
            }
            {
              name: 'AZURE_OPENAI_SOL_REGION'
              value: solOpenAiRegion
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
            {
              name: 'AZURE_OPENAI_SOL_ROUTE_EVIDENCE_VERSION'
              value: solOpenAiRouteEvidenceVersion
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: backendScale
    }
  }
}

resource webAuthConfig 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  name: 'current'
  parent: webApp
  properties: {
    platform: {
      enabled: false
      runtimeVersion: '~1'
    }
    globalValidation: {
      unauthenticatedClientAction: 'AllowAnonymous'
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
          allowedAudiences: [
            bffEntraClientId
          ]
          defaultAuthorizationPolicy: {
            allowedApplications: [
              webEntraClientId
            ]
          }
        }
      }
    }
  }
}

resource webDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${webAppName}-diagnostics'
  scope: webApp
  properties: {
    workspaceId: logAnalyticsWorkspaceId
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
    workspaceId: logAnalyticsWorkspaceId
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
output webIdentityName string = webIdentityName
output webIdentityResourceId string = webIdentityResourceId
output webIdentityClientId string = webIdentityClientId
output webIdentityPrincipalId string = webIdentityPrincipalId
output bffAppName string = bffApp.name
output bffAppId string = bffApp.id
output bffAppFqdn string = bffApp.properties.configuration.ingress.fqdn
output bffIdentityName string = bffIdentityName
output bffIdentityResourceId string = bffIdentityResourceId
output bffIdentityClientId string = bffIdentityClientId
output bffIdentityPrincipalId string = bffIdentityPrincipalId
