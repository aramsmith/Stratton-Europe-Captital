Set-StrictMode -Version Latest

Describe 'Stratton standalone deployment orchestrator' {
  BeforeAll {
    $script:repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $script:orchestratorPath = Join-Path $script:repoRoot 'scripts\deployment\Deploy-StrattonStandalone.ps1'
    $script:verificationPath = Join-Path $script:repoRoot 'scripts\deployment\Test-StrattonDeployment.ps1'

    . $script:orchestratorPath -LoadOnly
    . $script:verificationPath -LoadOnly

    function New-TestDeploymentState {
      param(
        [string] $Phase = 'PREFLIGHT_COMPLETE',
        [bool] $FoundationWhatIfApproved = $false,
        [bool] $ApplicationWhatIfApproved = $false
      )

      return [pscustomobject]@{
        phase = $Phase
        subscriptionId = '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
        tenantId = '27140306-eea5-4e7f-91e9-4c9e86864b3a'
        expectedUser = 'aram@azurelab.nl'
        commitSha = '0123456789abcdef0123456789abcdef01234567'
        parameterHash = ('a' * 64)
        foundationWhatIfApproved = $FoundationWhatIfApproved
        applicationWhatIfApproved = $ApplicationWhatIfApproved
      }
    }

    function New-ValidVerificationEvidence {
      return [pscustomobject]@{
        resourceHealth = @(
          [pscustomobject]@{ name = 'stratton-demo-web'; provisioningState = 'Succeeded'; availabilityState = 'Available' }
          [pscustomobject]@{ name = 'stratton-demo-bff'; provisioningState = 'Succeeded'; availabilityState = 'Available' }
          [pscustomobject]@{ name = 'stratton-demo-phase5'; provisioningState = 'Succeeded'; availabilityState = 'Available' }
        )
        revisions = @(
          [pscustomobject]@{ app = 'web'; active = $true; healthState = 'Healthy'; runningState = 'Running' }
          [pscustomobject]@{ app = 'bff'; active = $true; healthState = 'Healthy'; runningState = 'Running' }
          [pscustomobject]@{ app = 'phase5'; active = $true; healthState = 'Healthy'; runningState = 'Running' }
        )
        ingress = [pscustomobject]@{
          webExternal = $true
          bffExternal = $false
          phase5External = $false
        }
        health = [pscustomobject]@{
          web = $true
          bff = $true
          phase5 = $true
        }
        entra = [pscustomobject]@{
          applications = $true
          consent = $true
          federatedCredential = $true
          completionRole = $true
        }
        sql = [pscustomobject]@{
          privateDns = $true
          tokenAuthenticatedQuery = $true
        }
        roleAssignments = @(
          'ACR_PULL_WEB',
          'ACR_PULL_BFF',
          'ACR_PULL_PHASE5',
          'STORAGE_BFF',
          'SERVICEBUS_BFF',
          'SERVICEBUS_PHASE5',
          'SEARCH_BFF',
          'DOCUMENT_INTELLIGENCE_BFF',
          'OPENAI_BFF'
        )
        routeBindings = @(
          [pscustomobject]@{ route = 'LUNA'; armMatches = $true; phase5Matches = $true }
          [pscustomobject]@{ route = 'TERRA'; armMatches = $true; phase5Matches = $true }
          [pscustomobject]@{ route = 'SOL'; armMatches = $true; phase5Matches = $true }
        )
        playwright = [pscustomobject]@{
          authenticated = $true
          scenario = 'project-danube'
          passed = $true
        }
      }
    }

    function New-TestRoleAssignmentOutputs {
      return [pscustomobject]@{
        containerRegistryId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ContainerRegistry/registries/acr'
        webIdentityPrincipalId = '11111111-1111-1111-1111-111111111111'
        bffIdentityPrincipalId = '22222222-2222-2222-2222-222222222222'
        phase5IdentityPrincipalId = '33333333-3333-3333-3333-333333333333'
        blobStorageAccountResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/storage'
        blobContainerName = 'evidence'
        serviceBusNamespaceResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ServiceBus/namespaces/bus'
        serviceBusQueueName = 'analysis'
        ingestionQueueName = 'ingestion'
        extractionQueueName = 'extraction'
        indexingQueueName = 'indexing'
        searchServiceResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Search/searchServices/search'
        documentIntelligenceAccountResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/document'
        lunaOpenAiAccountResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/openai'
        terraOpenAiAccountResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/openai'
        solOpenAiAccountResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.CognitiveServices/accounts/openai'
      }
    }
  }

  It 'exposes the exact ordered deployment phases' {
    Get-StrattonDeploymentPhases | Should -Be @(
      'PREFLIGHT_COMPLETE',
      'PROVIDER_REGISTRATION_APPROVED',
      'PROVIDERS_REGISTERED',
      'FOUNDATION_WHAT_IF_READY',
      'PLATFORM_FOUNDATION_DEPLOYED',
      'ENTRA_FOUNDATION_COMPLETE',
      'IMAGES_BUILT',
      'DATA_PLANE_READY',
      'APPLICATION_WHAT_IF_READY',
      'APPLICATIONS_DEPLOYED',
      'ENTRA_REDIRECT_RECONCILED',
      'VERIFIED'
    )
  }

  It 'cannot deploy before approved foundation what-if state' {
    $state = New-TestDeploymentState -Phase 'FOUNDATION_WHAT_IF_READY'

    {
      Assert-DeploymentTransition -State $state -NextPhase 'PLATFORM_FOUNDATION_DEPLOYED'
    } | Should -Throw 'WHAT_IF_APPROVAL_REQUIRED'
  }

  It 'cannot deploy applications before approved application what-if state' {
    $state = New-TestDeploymentState -Phase 'APPLICATION_WHAT_IF_READY'

    {
      Assert-DeploymentTransition -State $state -NextPhase 'APPLICATIONS_DEPLOYED'
    } | Should -Throw 'WHAT_IF_APPROVAL_REQUIRED'
  }

  It 'rejects subscription tenant user commit and parameter drift when resuming' {
    $state = New-TestDeploymentState

    foreach ($binding in @(
        @{ SubscriptionId = 'wrong'; TenantId = $state.tenantId; ExpectedUser = $state.expectedUser; CommitSha = $state.commitSha; ParameterHash = $state.parameterHash }
        @{ SubscriptionId = $state.subscriptionId; TenantId = 'wrong'; ExpectedUser = $state.expectedUser; CommitSha = $state.commitSha; ParameterHash = $state.parameterHash }
        @{ SubscriptionId = $state.subscriptionId; TenantId = $state.tenantId; ExpectedUser = 'wrong@example.invalid'; CommitSha = $state.commitSha; ParameterHash = $state.parameterHash }
        @{ SubscriptionId = $state.subscriptionId; TenantId = $state.tenantId; ExpectedUser = $state.expectedUser; CommitSha = ('f' * 40); ParameterHash = $state.parameterHash }
        @{ SubscriptionId = $state.subscriptionId; TenantId = $state.tenantId; ExpectedUser = $state.expectedUser; CommitSha = $state.commitSha; ParameterHash = ('b' * 64) }
      )) {
      {
        Assert-DeploymentStateBinding -State $state @binding
      } | Should -Throw 'DEPLOYMENT_STATE_BINDING_MISMATCH'
    }
  }

  It 'revalidates the bound Azure context before resumed operations' {
    $calls = [System.Collections.Generic.List[string]]::new()
    {
      Assert-StrattonDeploymentAzContext `
        -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
        -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
        -ExpectedUser 'aram@azurelab.nl' `
        -AzInvoker {
          param([string[]] $Arguments)
          $calls.Add(($Arguments -join ' '))
          [pscustomobject]@{
            id = '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
            tenantId = '27140306-eea5-4e7f-91e9-4c9e86864b3a'
            user = [pscustomobject]@{ name = 'wrong@example.invalid' }
          }
        }
    } | Should -Throw 'AZURE_CONTEXT_MISMATCH'
    $calls | Should -Be @(
      'account show'
    )
  }

  It 'requires separate approval and registers only exact namespaces reported by preflight' {
    $preflight = [pscustomobject]@{
      resourceProviders = @(
        [pscustomobject]@{ namespace = 'Microsoft.ServiceBus'; registrationState = 'NotRegistered' }
        [pscustomobject]@{ namespace = 'Microsoft.Sql'; registrationState = 'Registered' }
      )
      blockingFindings = @('AZURE_PROVIDER_UNREGISTERED:Microsoft.ServiceBus')
    }
    $calls = [System.Collections.Generic.List[string]]::new()
    $invoker = {
      param([string[]] $Arguments)

      $calls.Add(($Arguments -join ' '))
      if ($Arguments[0] -eq 'provider' -and $Arguments[1] -eq 'show') {
        return [pscustomobject]@{
          namespace = 'Microsoft.ServiceBus'
          registrationState = 'Registered'
        }
      }
      return $null
    }

    {
      Invoke-StrattonProviderRegistration -Preflight $preflight -AzInvoker $invoker
    } | Should -Throw 'PROVIDER_REGISTRATION_APPROVAL_REQUIRED'
    $calls.Count | Should -Be 0

    $registered = Invoke-StrattonProviderRegistration `
      -Preflight $preflight `
      -ApproveProviderRegistration `
      -PollIntervalSeconds 0 `
      -AzInvoker $invoker

    $registered | Should -Be @('Microsoft.ServiceBus')
    @($calls | Where-Object { $_ -match '^provider register ' }) | Should -Be @(
      'provider register --namespace Microsoft.ServiceBus --subscription 8364fb4d-2d36-4da5-908b-36cb8b808b8c'
    )
    ($calls -join "`n") | Should -Not -Match 'Microsoft\.Sql.*register|provider register.*Microsoft\.Sql'

    {
      Invoke-StrattonProviderRegistration `
        -Preflight $preflight `
        -ApprovedNamespaces @('Microsoft.Sql') `
        -ApproveProviderRegistration `
        -PollIntervalSeconds 0 `
        -AzInvoker $invoker
    } | Should -Throw 'PROVIDER_APPROVAL_SCOPE_DRIFT'
  }

  It 'matches Azure provider namespace evidence case-insensitively' {
    $preflight = [pscustomobject]@{
      blockingFindings = @('AZURE_PROVIDER_UNREGISTERED:Microsoft.Insights')
      resourceProviders = @(
        [pscustomobject]@{
          namespace = 'microsoft.insights'
          registrationState = 'NotRegistered'
        }
      )
    }

    Get-StrattonUnregisteredProviderNamespaces -Preflight $preflight |
      Should -Be @('Microsoft.Insights')
  }

  It 'builds separate foundation and application parameter values without secrets' {
    $foundation = New-StrattonFoundationParameterValues `
      -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
      -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a'

    $foundation.deployApplications | Should -BeFalse
    $foundation.location | Should -Be 'westeurope'
    $foundation.resourceGroupName | Should -Be 'stratton-demo-rg'
    $foundation.tags.environment | Should -Be 'dev'
    $foundation.tags.workload | Should -Be 'stratton-demo'
    $foundation.tags.case | Should -Be 'project-danube'
    $foundation.tags.owner | Should -Be 'aram@azurelab.nl'
    $foundation.tags.managedBy | Should -Be 'bicep'

    $application = New-StrattonApplicationParameterValues `
      -FoundationParameters $foundation `
      -EntraArtifact ([pscustomobject]@{
        webClientId = '11111111-1111-1111-1111-111111111111'
        bffClientId = '22222222-2222-2222-2222-222222222222'
        phase5ClientId = '33333333-3333-3333-3333-333333333333'
      }) `
      -ImagesArtifact ([pscustomobject]@{
        images = @(
          [pscustomobject]@{ repository = 'stratton/demo-web'; digest = "sha256:$('a' * 64)" }
          [pscustomobject]@{ repository = 'stratton/demo-bff'; digest = "sha256:$('b' * 64)" }
          [pscustomobject]@{ repository = 'stratton/phase5-api'; digest = "sha256:$('c' * 64)" }
        )
      })

    $application.deployApplications | Should -BeTrue
    $application.webEntraClientId | Should -Be '11111111-1111-1111-1111-111111111111'
    $application.bffEntraClientId | Should -Be '22222222-2222-2222-2222-222222222222'
    $application.phase5ApplicationId | Should -Be '33333333-3333-3333-3333-333333333333'
    $application.webDelegatedScope | Should -Be 'api://22222222-2222-2222-2222-222222222222/access_as_user'
    $application.phase5DelegatedScope | Should -Be 'api://33333333-3333-3333-3333-333333333333/access_as_user'
    $application.webImageDigest | Should -Be "sha256:$('a' * 64)"
    $application.bffImageDigest | Should -Be "sha256:$('b' * 64)"
    $application.phase5ImageDigest | Should -Be "sha256:$('c' * 64)"

    $document = ConvertTo-StrattonParameterDocument -Values $application
    $serialized = $document | ConvertTo-Json -Depth 50
    $serialized | Should -Not -Match '(?i)"(password|clientSecret|apiKey|connectionString|accessToken|refreshToken)"'
  }

  It 'uses subscription-scope what-if and deployment commands without destructive mode' {
    $whatIfArguments = New-StrattonSubscriptionWhatIfArguments `
      -DeploymentName 'stratton-foundation-20260810-01234567' `
      -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
      -Location 'westeurope' `
      -TemplateFile 'C:\repo\infra\standalone\main.bicep' `
      -ParametersFile 'C:\repo\artifacts\deployment\foundation.parameters.json'
    $deploymentArguments = New-StrattonSubscriptionDeploymentArguments `
      -DeploymentName 'stratton-foundation-20260810-01234567' `
      -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
      -Location 'westeurope' `
      -TemplateFile 'C:\repo\infra\standalone\main.bicep' `
      -ParametersFile 'C:\repo\artifacts\deployment\foundation.parameters.json'

    $whatIfArguments[0..2] | Should -Be @('deployment', 'sub', 'what-if')
    $whatIfArguments | Should -Contain '--template-file'
    $whatIfArguments | Should -Contain '--parameters'
    $deploymentArguments[0..2] | Should -Be @('deployment', 'sub', 'create')
    $whatIfArguments | Should -Contain '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
    $deploymentArguments | Should -Contain '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
    (($whatIfArguments + $deploymentArguments) -join ' ') |
      Should -Not -Match '(?i)(--mode\s+Complete|group delete|resource delete)'
  }

  It 'fails closed when a what-if contains a delete' {
    {
      Assert-StrattonWhatIfSafe -WhatIfResult ([pscustomobject]@{
        properties = [pscustomobject]@{
          changes = @(
            [pscustomobject]@{
              changeType = 'Delete'
              resourceId = '/subscriptions/sub/resourceGroups/unapproved'
            }
          )
        }
      })
    } | Should -Throw 'WHAT_IF_DELETE_PROHIBITED'
  }

  It 'rejects a changed what-if artifact before approval can deploy it' {
    $reviewed = [pscustomobject]@{
      properties = [pscustomobject]@{
        changes = @(
          [pscustomobject]@{ changeType = 'Create'; resourceId = '/subscriptions/sub/resourceGroups/stratton-demo-rg' }
        )
      }
    }
    $reviewedHash = Get-StrattonObjectHash -InputObject $reviewed

    {
      Assert-StrattonArtifactHash -Artifact $reviewed -ExpectedHash $reviewedHash -Kind 'WHAT_IF'
    } | Should -Not -Throw
    $reviewed.properties.changes[0].changeType = 'Modify'
    {
      Assert-StrattonArtifactHash -Artifact $reviewed -ExpectedHash $reviewedHash -Kind 'WHAT_IF'
    } | Should -Throw 'WHAT_IF_ARTIFACT_DRIFT'
  }

  It 'binds deployment to the exact parameter file and a clean committed worktree' {
    $parameterPath = Join-Path $script:repoRoot '.orchestrator-parameters-probe.json'
    try {
      '{"parameters":{"deployApplications":{"value":false}}}' |
        Set-Content -LiteralPath $parameterPath -Encoding utf8NoBOM
      $hash = Get-StrattonFileHash -Path $parameterPath

      {
        Assert-StrattonFileHash -Path $parameterPath -ExpectedHash $hash -Kind 'PARAMETER'
      } | Should -Not -Throw
      '{"parameters":{"deployApplications":{"value":true}}}' |
        Set-Content -LiteralPath $parameterPath -Encoding utf8NoBOM
      {
        Assert-StrattonFileHash -Path $parameterPath -ExpectedHash $hash -Kind 'PARAMETER'
      } | Should -Throw 'PARAMETER_FILE_DRIFT'
    }
    finally {
      Remove-Item -LiteralPath $parameterPath -Force -ErrorAction SilentlyContinue
    }
  }

  It 'rejects untracked build inputs while allowing only operational deployment artifacts' {
    {
      Assert-StrattonCommittedWorktree `
        -RepositoryRoot 'C:\repo' `
        -GitInvoker {
          [pscustomobject]@{
            exitCode = 0
            lines = @('?? demo-platform/apps/web/src/untracked.ts')
          }
        }
    } | Should -Throw 'GIT_WORKTREE_NOT_CLEAN'

    {
      Assert-StrattonCommittedWorktree `
        -RepositoryRoot 'C:\repo' `
        -GitInvoker {
          [pscustomobject]@{
            exitCode = 0
            lines = @(
              '?? demo-platform/artifacts/deployment/deployment-state.json'
              '?? demo-platform/infra/standalone/main.json'
            )
          }
        }
    } | Should -Not -Throw
  }

  It 'returns only unfinished steps when a deployment command resumes' {
    Get-StrattonFoundationResumeSteps -Phase 'FOUNDATION_WHAT_IF_READY' | Should -Be @(
      'PLATFORM_FOUNDATION_DEPLOYED',
      'ENTRA_FOUNDATION_COMPLETE',
      'IMAGES_BUILT',
      'DATA_PLANE_READY'
    )
    Get-StrattonFoundationResumeSteps -Phase 'ENTRA_FOUNDATION_COMPLETE' | Should -Be @(
      'IMAGES_BUILT',
      'DATA_PLANE_READY'
    )
    Get-StrattonFoundationResumeSteps -Phase 'DATA_PLANE_READY' | Should -BeNullOrEmpty
    Get-StrattonApplicationResumeSteps -Phase 'APPLICATIONS_DEPLOYED' | Should -Be @(
      'REGISTER_DEPLOYED_REDIRECT'
    )
  }

  It 'expects redirect sets that match the persisted reconciliation phase' {
    Get-StrattonExpectedRedirectUris `
      -Phase 'APPLICATIONS_DEPLOYED' `
      -DeployedRedirectUri 'https://stratton.example' |
      Should -Be @('https://stratton.example', 'http://localhost:4173')
    Get-StrattonExpectedRedirectUris `
      -Phase 'ENTRA_REDIRECT_RECONCILED' `
      -DeployedRedirectUri 'https://stratton.example' |
      Should -Be @('https://stratton.example')
  }

  It 'accepts exact redirect reconciliation as a resumable application state' {
    $candidates = @(
      Get-StrattonAcceptedRedirectUriSets `
        -Phase 'APPLICATIONS_DEPLOYED' `
        -DeployedRedirectUri 'https://stratton.example'
    )

    $candidates.Count | Should -Be 2
    @($candidates[0].uris) | Should -Be @('https://stratton.example', 'http://localhost:4173')
    $candidates[0].alreadyReconciled | Should -BeFalse
    @($candidates[1].uris) | Should -Be @('https://stratton.example')
    $candidates[1].alreadyReconciled | Should -BeTrue
  }

  It 'preserves the approved preflight artifact when provider registration is rechecked' {
    $scriptText = Get-Content $script:orchestratorPath -Raw

    $scriptText | Should -Match 'ProviderVerificationArtifactPath'
    $scriptText | Should -Match 'provider-registration-preflight\.json'
    $scriptText | Should -Match 'providerRegistrationVerificationArtifactHash'
  }

  It 'binds verification to the approved deployment target rather than mutable state values' {
    $scriptText = Get-Content $script:verificationPath -Raw

    $scriptText | Should -Match '-SubscriptionId\s+\$script:ApprovedSubscriptionId'
    $scriptText | Should -Match '-TenantId\s+\$script:ApprovedTenantId'
    $scriptText | Should -Match '-ExpectedUser\s+\$script:ApprovedUser'
  }

  It 'recognizes only private SQL addresses as private DNS evidence' {
    Test-StrattonPrivateIpAddress -Address '10.42.2.5' | Should -BeTrue
    Test-StrattonPrivateIpAddress -Address '172.20.1.5' | Should -BeTrue
    Test-StrattonPrivateIpAddress -Address '192.168.10.5' | Should -BeTrue
    Test-StrattonPrivateIpAddress -Address '20.50.10.2' | Should -BeFalse
  }

  It 'validates every runtime boundary before producing verification evidence' {
    $result = ConvertTo-StrattonVerificationResult -Evidence (New-ValidVerificationEvidence)

    $result.status | Should -Be 'PASS'
    @($result.checks | Where-Object status -ne 'PASS').Count | Should -Be 0
    @($result.routeBindings.route) | Should -Be @('LUNA', 'TERRA', 'SOL')
    $result.playwright.scenario | Should -Be 'project-danube'
    $result.playwright.authenticated | Should -BeTrue
  }

  It 'rejects unexpected role assignments for runtime identities' {
    $expected = @(
      [pscustomobject]@{
        principalId = '11111111-1111-1111-1111-111111111111'
        scope = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ContainerRegistry/registries/acr'
        roleDefinitionGuid = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
      }
    )
    $assignments = @(
      [pscustomobject]@{
        principalId = $expected[0].principalId
        scope = $expected[0].scope
        roleDefinitionId = "/subscriptions/sub/providers/Microsoft.Authorization/roleDefinitions/$($expected[0].roleDefinitionGuid)"
      }
      [pscustomobject]@{
        principalId = $expected[0].principalId
        scope = '/subscriptions/sub'
        roleDefinitionId = '/subscriptions/sub/providers/Microsoft.Authorization/roleDefinitions/8e3af657-a8ff-443c-a75c-2fe8c4bcb635'
      }
    )

    {
      Assert-StrattonExactRuntimeRoleAssignments `
        -Assignments $assignments `
        -ExpectedAssignments $expected `
        -RuntimePrincipalIds @($expected[0].principalId)
    } | Should -Throw 'UNEXPECTED_RUNTIME_ROLE_ASSIGNMENT*'
  }

  It 'accepts the exact runtime identity role-assignment tuple set' {
    $outputs = New-TestRoleAssignmentOutputs
    $expected = @(Get-StrattonExpectedRuntimeRoleAssignments -Outputs $outputs)
    $assignments = @(
      foreach ($assignment in $expected) {
        [pscustomobject]@{
          principalId = $assignment.principalId
          scope = $assignment.scope
          roleDefinitionId = "/subscriptions/sub/providers/Microsoft.Authorization/roleDefinitions/$($assignment.roleDefinitionGuid)"
        }
      }
    )

    $checks = @(Get-StrattonRoleAssignmentChecks -Outputs $outputs -Assignments $assignments)

    $checks | Should -Contain 'ACR_PULL_WEB'
    $checks | Should -Contain 'SERVICEBUS_PHASE5'
    $checks | Should -Contain 'OPENAI_BFF'
    (Get-Content $script:verificationPath -Raw) | Should -Match '--include-inherited'
  }

  It 'writes verification evidence before persisting the verified phase' {
    $scriptText = Get-Content $script:verificationPath -Raw
    $evidenceWrite = $scriptText.IndexOf(
      'Write-DeploymentArtifact -Path $script:VerificationArtifactPath'
    )
    $verifiedWrite = $scriptText.IndexOf(
      "Save-StrattonDeploymentState -State `$state -NextPhase 'VERIFIED'"
    )

    $evidenceWrite | Should -BeGreaterThan -1
    $verifiedWrite | Should -BeGreaterThan $evidenceWrite
  }

  It 'rejects verification when an internal ingress or route binding is wrong' {
    $badIngress = New-ValidVerificationEvidence
    $badIngress.ingress.bffExternal = $true
    {
      ConvertTo-StrattonVerificationResult -Evidence $badIngress
    } | Should -Throw 'RUNTIME_INGRESS_BOUNDARY_INVALID'

    $badRoute = New-ValidVerificationEvidence
    $badRoute.routeBindings[1].phase5Matches = $false
    {
      ConvertTo-StrattonVerificationResult -Evidence $badRoute
    } | Should -Throw 'ROUTE_BINDING_VERIFICATION_FAILED:TERRA'

    $badHealth = New-ValidVerificationEvidence
    $badHealth.resourceHealth[0].availabilityState = 'Unavailable'
    {
      ConvertTo-StrattonVerificationResult -Evidence $badHealth
    } | Should -Throw 'RESOURCE_HEALTH_VERIFICATION_FAILED'
  }

  It 'configures authenticated remote Playwright without starting local servers' {
    $previousBaseUrl = $env:STRATTON_E2E_BASE_URL
    $previousStorageState = $env:STRATTON_E2E_STORAGE_STATE
    $previousSessionStorageState = $env:STRATTON_E2E_SESSION_STORAGE_STATE
    $previousProbePath = $env:STRATTON_CONFIG_PROBE
    try {
      $env:STRATTON_E2E_BASE_URL = 'https://stratton.example'
      $env:STRATTON_E2E_STORAGE_STATE = 'C:\secure\playwright-state.json'
      $env:STRATTON_E2E_SESSION_STORAGE_STATE = 'C:\secure\playwright-session.json'
      $env:STRATTON_CONFIG_PROBE = Join-Path $script:repoRoot '.playwright-config-probe.json'
      Push-Location $script:repoRoot
      try {
        $probe = 'import { writeFileSync } from "node:fs"; import config from "./playwright.config.ts"; writeFileSync(process.env.STRATTON_CONFIG_PROBE!, JSON.stringify({ baseURL: config.use?.baseURL, storageState: config.use?.storageState, trace: config.use?.trace, screenshot: config.use?.screenshot, video: config.use?.video, reporterCount: Array.isArray(config.reporter) ? config.reporter.length : 0, webServerEnabled: Boolean(config.webServer) }));'
        & npx tsx -e $probe
        if ($LASTEXITCODE -ne 0) {
          throw 'PLAYWRIGHT_CONFIG_PROBE_FAILED'
        }
      }
      finally {
        Pop-Location
      }
      $resolved = Get-Content $env:STRATTON_CONFIG_PROBE -Raw | ConvertFrom-Json

      $resolved.baseURL | Should -Be 'https://stratton.example'
      $resolved.storageState | Should -Be 'C:\secure\playwright-state.json'
      $resolved.trace | Should -Be 'off'
      $resolved.screenshot | Should -Be 'off'
      $resolved.video | Should -Be 'off'
      $resolved.reporterCount | Should -Be 1
      $resolved.webServerEnabled | Should -BeFalse

      $scenarioText = Get-Content (Join-Path $script:repoRoot 'tests\e2e\evidence-to-decision.spec.ts') -Raw
      $scenarioText | Should -Match 'STRATTON_E2E_SESSION_STORAGE_STATE'
      $scenarioText | Should -Match 'addInitScript'
    }
    finally {
      $env:STRATTON_E2E_BASE_URL = $previousBaseUrl
      $env:STRATTON_E2E_STORAGE_STATE = $previousStorageState
      $env:STRATTON_E2E_SESSION_STORAGE_STATE = $previousSessionStorageState
      if ($env:STRATTON_CONFIG_PROBE -and (Test-Path $env:STRATTON_CONFIG_PROBE)) {
        Remove-Item $env:STRATTON_CONFIG_PROBE -Force
      }
      $env:STRATTON_CONFIG_PROBE = $previousProbePath
    }
  }

  It 'never contains delete or complete-mode deployment commands' {
    $scriptText = @(
      Get-Content $script:orchestratorPath -Raw
      Get-Content $script:verificationPath -Raw
    ) -join "`n"

    $scriptText | Should -Not -Match '(?i)az\s+group\s+delete|az\s+resource\s+delete|--mode\s+Complete'
  }
}
