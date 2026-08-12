targetScope = 'resourceGroup'

param location string
@minLength(36)
@maxLength(36)
param tenantId string
param namePrefix string
param tags object
param containerAppsEnvironmentId string
param containerRegistryServer string
param logAnalyticsWorkspaceId string
param phase5IdentityResourceId string
@minLength(36)
@maxLength(36)
param phase5IdentityClientId string
@minLength(36)
@maxLength(36)
param bffIdentityClientId string
@minLength(36)
@maxLength(36)
param bffEntraClientId string
@minLength(36)
@maxLength(36)
param phase5ApplicationId string
param modelProviderEvidenceId string
param regionalDeploymentEvidenceId string
param promptGovernanceEvidenceId string
param phase5ImageRepository string
param phase5ImageDigest string
param sqlServerFqdn string
param sqlDatabaseName string
param serviceBusFqdn string

var phase5AppName = '${namePrefix}-phase5'
var phase5Image = '${containerRegistryServer}/${phase5ImageRepository}@${phase5ImageDigest}'
var entraIssuer = '${environment().authentication.loginEndpoint}${tenantId}/v2.0'

resource phase5App 'Microsoft.App/containerApps@2024-03-01' = {
  name: phase5AppName
  location: location
  tags: union(tags, {
    'stratton.caseId': 'project-danube'
    'stratton.component': 'phase5'
    'stratton.telemetry': 'redacted'
  })
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${phase5IdentityResourceId}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: containerRegistryServer
          identity: phase5IdentityResourceId
        }
      ]
      ingress: {
        external: false
        allowInsecure: false
        targetPort: 3000
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'phase5-api'
          image: phase5Image
          env: [
            { name: 'APP_ENV', value: 'dev' }
            { name: 'API_PORT', value: '3000' }
            { name: 'API_RUNTIME_MODE', value: 'production' }
            { name: 'ROLLOUT_ADMISSION_MAX', value: '1' }
            { name: 'LOG_LEVEL', value: 'INFO' }
            { name: 'ANALYSIS_CAPABILITY_ENABLED', value: 'false' }
            { name: 'AUDIT_EXPORT_CAPABILITY_ENABLED', value: 'false' }
            { name: 'DEMO_AUTHORITY_COMPLETION_CLIENT_ID', value: bffIdentityClientId }
            { name: 'AZURE_MANAGED_IDENTITY_CLIENT_ID', value: phase5IdentityClientId }
            { name: 'AZURE_SQL_SERVER_FQDN', value: sqlServerFqdn }
            { name: 'MODEL_PROVIDER_EVIDENCE_ID', value: modelProviderEvidenceId }
            { name: 'REGIONAL_DEPLOYMENT_EVIDENCE_ID', value: regionalDeploymentEvidenceId }
            { name: 'PROMPT_GOVERNANCE_EVIDENCE_ID', value: promptGovernanceEvidenceId }
            { name: 'AZURE_SQL_DATABASE_NAME', value: sqlDatabaseName }
            { name: 'AZURE_SERVICEBUS_FQDN', value: serviceBusFqdn }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      // Retain one replica until web-proxy cold-start retry coverage includes the BFF and Phase 5 API.
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

resource phase5AuthConfig 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  name: 'current'
  parent: phase5App
  properties: {
    platform: {
      enabled: true
      runtimeVersion: '~1'
    }
    globalValidation: {
      unauthenticatedClientAction: 'Return401'
      redirectToProvider: 'azureactivedirectory'
      excludedPaths: [
        '/health'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: phase5ApplicationId
          openIdIssuer: entraIssuer
        }
        validation: {
          allowedAudiences: [
            phase5ApplicationId
            'api://${phase5ApplicationId}'
          ]
          defaultAuthorizationPolicy: {
            allowedApplications: [
              bffEntraClientId
              bffIdentityClientId
            ]
          }
        }
      }
    }
  }
}

output phase5AppName string = phase5App.name
output phase5AppId string = phase5App.id
output phase5ApiFqdn string = phase5App.properties.configuration.ingress.fqdn
