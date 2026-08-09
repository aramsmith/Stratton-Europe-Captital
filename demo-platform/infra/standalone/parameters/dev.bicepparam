using '../main.bicep'

param subscriptionId = '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
param tenantId = '27140306-eea5-4e7f-91e9-4c9e86864b3a'
param location = 'westeurope'
param resourceGroupName = 'stratton-demo-rg'
param environmentName = 'dev'
param entraAdministratorObjectId = '89177235-561c-45ff-87cd-f63f0f5b8710'
param entraAdministratorLogin = 'aram@azurelab.nl'
param openAiLocation = 'westeurope'
param lunaModelName = 'gpt-5.6-luna'
param lunaModelVersion = '2026-07-09'
param lunaModelCapacity = 1
param terraModelName = 'gpt-5.6-terra'
param terraModelVersion = '2026-07-09'
param terraModelCapacity = 1
param solModelName = 'gpt-5.6-sol'
param solModelVersion = '2026-07-09'
param solModelCapacity = 1

param webDelegatedScope = 'api://44444444-4444-4444-4444-444444444444/access_as_user'
param bffRequiredDelegatedScope = 'access_as_user'
param phase5ApplicationId = '55555555-5555-5555-5555-555555555555'
param phase5DelegatedScope = 'api://55555555-5555-5555-5555-555555555555/access_as_user'
param webImageRepository = 'stratton/demo-web'
param webImageDigest = 'sha256:1111111111111111111111111111111111111111111111111111111111111111'
param bffImageRepository = 'stratton/demo-bff'
param bffImageDigest = 'sha256:2222222222222222222222222222222222222222222222222222222222222222'
param phase5ImageRepository = 'stratton/phase5-api'
param phase5ImageDigest = 'sha256:3333333333333333333333333333333333333333333333333333333333333333'
param webContainerPort = 8080
param bffContainerPort = 3001
param webEntraClientId = '33333333-3333-3333-3333-333333333333'
param bffEntraClientId = '44444444-4444-4444-4444-444444444444'
