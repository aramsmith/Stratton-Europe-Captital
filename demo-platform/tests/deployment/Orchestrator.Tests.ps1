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
        location = 'swedencentral'
        openAiLocation = 'westeurope'
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
          'ACR_PULL_VERIFICATION',
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
        verificationIdentityPrincipalId = '44444444-4444-4444-4444-444444444444'
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

  It 'fails closed when either split-region deployment location drifts' {
    $state = New-TestDeploymentState

    {
      Assert-DeploymentStateBinding `
        -State $state `
        -SubscriptionId $state.subscriptionId `
        -TenantId $state.tenantId `
        -ExpectedUser $state.expectedUser `
        -CommitSha $state.commitSha `
        -ParameterHash $state.parameterHash `
        -Location 'westeurope' `
        -OpenAiLocation 'westeurope'
    } | Should -Throw 'DEPLOYMENT_STATE_BINDING_MISMATCH'

    {
      Assert-DeploymentStateBinding `
        -State $state `
        -SubscriptionId $state.subscriptionId `
        -TenantId $state.tenantId `
        -ExpectedUser $state.expectedUser `
        -CommitSha $state.commitSha `
        -ParameterHash $state.parameterHash `
        -Location 'swedencentral' `
        -OpenAiLocation 'swedencentral'
    } | Should -Throw 'DEPLOYMENT_STATE_BINDING_MISMATCH'
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

  It 'accepts the expected Azure user regardless of UPN casing' {
    {
      Assert-StrattonDeploymentAzContext `
        -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
        -TenantId '27140306-eea5-4e7f-91e9-4c9e86864b3a' `
        -ExpectedUser 'aram@azurelab.nl' `
        -AzInvoker {
          param([string[]] $Arguments)
          [pscustomobject]@{
            id = '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
            tenantId = '27140306-eea5-4e7f-91e9-4c9e86864b3a'
            user = [pscustomobject]@{ name = 'Aram@AzureLab.nl' }
          }
        }
    } | Should -Not -Throw
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
    $foundation.location | Should -Be 'swedencentral'
    $foundation.openAiLocation | Should -Be 'westeurope'
    $foundation.resourceGroupName | Should -Be 'stratton-demo-rg'
    $foundation.tags.environment | Should -Be 'dev'
    $foundation.tags.workload | Should -Be 'stratton-demo'
    $foundation.tags.case | Should -Be 'project-danube'
    $foundation.tags.owner | Should -Be 'aram@azurelab.nl'
    $foundation.tags.managedBy | Should -Be 'bicep'
    $foundation.tags.'hackathon-team' | Should -Be 'stratton-demo'

    $application = New-StrattonApplicationParameterValues `
      -FoundationParameters $foundation `
      -EntraArtifact ([pscustomobject]@{
        webClientId = '11111111-1111-1111-1111-111111111111'
        bffClientId = '22222222-2222-2222-2222-222222222222'
        phase5ClientId = '33333333-3333-3333-3333-333333333333'
      }) `
      -FoundationOutputs ([pscustomobject]@{
        webIdentityClientId = '44444444-4444-4444-4444-444444444444'
        webIdentityPrincipalId = '55555555-5555-5555-5555-555555555555'
        bffIdentityClientId = '66666666-6666-6666-6666-666666666666'
        bffIdentityPrincipalId = '77777777-7777-7777-7777-777777777777'
        phase5IdentityClientId = '88888888-8888-8888-8888-888888888888'
        phase5IdentityPrincipalId = '99999999-9999-9999-9999-999999999999'
        verificationIdentityClientId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
        verificationIdentityPrincipalId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
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
    $application.webIdentityClientId | Should -Be '44444444-4444-4444-4444-444444444444'
    $application.bffIdentityPrincipalId | Should -Be '77777777-7777-7777-7777-777777777777'
    $application.phase5IdentityClientId | Should -Be '88888888-8888-8888-8888-888888888888'
    $application.verificationIdentityPrincipalId | Should -Be 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    $application.webDelegatedScope | Should -Be 'api://22222222-2222-2222-2222-222222222222/access_as_user'
    $application.phase5DelegatedScope | Should -Be 'api://33333333-3333-3333-3333-333333333333/access_as_user'
    $application.webImageDigest | Should -Be "sha256:$('a' * 64)"
    $application.bffImageDigest | Should -Be "sha256:$('b' * 64)"
    $application.phase5ImageDigest | Should -Be "sha256:$('c' * 64)"

    $document = ConvertTo-StrattonParameterDocument -Values $application
    $serialized = $document | ConvertTo-Json -Depth 50
    $serialized | Should -Not -Match '(?i)"(password|clientSecret|apiKey|connectionString|accessToken|refreshToken)"'
  }

  It 'loads persisted foundation outputs before building application parameters' {
    $source = Get-Content -LiteralPath $script:orchestratorPath -Raw

    $source | Should -Match (
      "if \(\`$Phase -eq 'ApplicationWhatIf'\)[\s\S]*" +
      "Read-StrattonJsonArtifact -Path \`$script:OutputsArtifactPath[\s\S]*" +
      "New-StrattonApplicationParameterValues"
    )
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
        status = 'Succeeded'
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

  It 'fails closed when a what-if result has no changes collection' {
    {
      Assert-StrattonWhatIfSafe -WhatIfResult ([pscustomobject]@{
        status = 'Succeeded'
        properties = [pscustomobject]@{}
      })
    } | Should -Throw 'WHAT_IF_SHAPE_UNRECOGNIZED'
  }

  It 'fails closed when a what-if result did not succeed' {
    {
      Assert-StrattonWhatIfSafe -WhatIfResult ([pscustomobject]@{
        status = 'Failed'
        error = [pscustomobject]@{ code = 'DeploymentWhatIfFailed' }
        properties = [pscustomobject]@{ changes = @() }
      })
    } | Should -Throw 'WHAT_IF_NOT_SUCCEEDED'
  }

  It 'fails closed when Azure short-circuits a nested deployment' {
    {
      Assert-StrattonWhatIfSafe -WhatIfResult ([pscustomobject]@{
        status = 'Succeeded'
        changes = @(
          [pscustomobject]@{
            changeType = 'Create'
            resourceId = '/subscriptions/sub/resourceGroups/stratton-demo-rg'
          }
        )
        diagnostics = @(
          [pscustomobject]@{
            code = 'NestedDeploymentShortCircuited'
            level = 'Warning'
            target = '/subscriptions/sub/resourceGroups/stratton-demo-rg/providers/Microsoft.Resources/deployments/stratton-demo-data'
          }
        )
      })
    } | Should -Throw 'WHAT_IF_INCOMPLETE:NestedDeploymentShortCircuited'
  }

  It 'fails closed when nested what-if diagnostics report a short-circuit' {
    {
      Assert-StrattonWhatIfSafe -WhatIfResult ([pscustomobject]@{
        status = 'Succeeded'
        properties = [pscustomobject]@{
          changes = @()
          diagnostics = @(
            [pscustomobject]@{
              code = 'nesteddeploymentshortcircuited'
              level = 'Warning'
            }
          )
        }
      })
    } | Should -Throw 'WHAT_IF_INCOMPLETE:nesteddeploymentshortcircuited'
  }

  It 'rejects a changed what-if artifact before approval can deploy it' {
    $reviewed = [pscustomobject]@{
      status = 'Succeeded'
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

  It 'reconciles a pinned manual verification job with a dedicated identity' {
    $common = @{
      JobName = 'stratton-verification'
      ResourceGroupName = 'stratton-demo-rg'
      SubscriptionId = '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
      Image = "stratton.azurecr.io/stratton/demo-bff@sha256:$('b' * 64)"
      EnvironmentVariables = @(
        'STRATTON_VERIFICATION_NONCE=nonce-123',
        'STRATTON_BFF_HEALTH_URL=https://bff.internal/healthz',
        'STRATTON_PHASE5_HEALTH_URL=https://phase5.internal/health',
        'AZURE_SQL_SERVER_FQDN=stratton.database.windows.net',
        'AZURE_SQL_DATABASE_NAME=stratton-db',
        'AZURE_MANAGED_IDENTITY_CLIENT_ID=44444444-4444-4444-4444-444444444444',
        'STRATTON_TENANT_ID=27140306-eea5-4e7f-91e9-4c9e86864b3a',
        'STRATTON_CASE_ID=project-danube',
        'STRATTON_EXPECTED_ROUTES_BASE64=W10='
      )
    }
    $identityId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/verification'
    $create = New-StrattonVerificationJobCreateArguments `
      @common `
      -ContainerAppsEnvironmentId '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/cae' `
      -RegistryServer 'stratton.azurecr.io' `
      -VerificationIdentityResourceId $identityId
    $update = New-StrattonVerificationJobUpdateArguments @common
    $identity = New-StrattonVerificationJobIdentityArguments `
      -JobName $common.JobName `
      -ResourceGroupName $common.ResourceGroupName `
      -SubscriptionId $common.SubscriptionId `
      -VerificationIdentityResourceId $identityId
    $registry = New-StrattonVerificationJobRegistryArguments `
      -JobName $common.JobName `
      -ResourceGroupName $common.ResourceGroupName `
      -SubscriptionId $common.SubscriptionId `
      -RegistryServer 'stratton.azurecr.io' `
      -VerificationIdentityResourceId $identityId
    $identityRemoval = New-StrattonVerificationJobIdentityRemovalArguments `
      -JobName $common.JobName `
      -ResourceGroupName $common.ResourceGroupName `
      -SubscriptionId $common.SubscriptionId `
      -RemoveSystemAssigned `
      -UserAssignedIdentityResourceIds @(
        '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/legacy'
      )
    $registryRemoval = New-StrattonVerificationJobRegistryRemovalArguments `
      -JobName $common.JobName `
      -ResourceGroupName $common.ResourceGroupName `
      -SubscriptionId $common.SubscriptionId `
      -RegistryServer 'legacy.azurecr.io'

    $create[0..2] | Should -Be @('containerapp', 'job', 'create')
    $create | Should -Contain '--trigger-type'
    $create[([array]::IndexOf($create, '--trigger-type') + 1)] | Should -Be 'Manual'
    $create[([array]::IndexOf($create, '--mi-user-assigned') + 1)] | Should -Be $identityId
    $create[([array]::IndexOf($create, '--registry-identity') + 1)] | Should -Be $identityId
    $create[([array]::IndexOf($create, '--container-name') + 1)] | Should -Be 'verification'
    $create[([array]::IndexOf($create, '--command') + 1)] | Should -Be 'node'
    $create[([array]::IndexOf($create, '--args') + 1)] |
      Should -Be 'apps/bff/dist/verification-job.js'

    $update[0..2] | Should -Be @('containerapp', 'job', 'update')
    $update | Should -Contain '--replace-env-vars'
    foreach ($createOnlyFlag in @(
        '--environment',
        '--trigger-type',
        '--mi-user-assigned',
        '--registry-server',
        '--registry-identity',
        '--env-vars'
      )) {
      $update | Should -Not -Contain $createOnlyFlag
    }
    $identity | Should -Be @(
      'containerapp', 'job', 'identity', 'assign',
      '--name', 'stratton-verification',
      '--resource-group', 'stratton-demo-rg',
      '--subscription', '8364fb4d-2d36-4da5-908b-36cb8b808b8c',
      '--user-assigned', $identityId
    )
    $registry | Should -Be @(
      'containerapp', 'job', 'registry', 'set',
      '--name', 'stratton-verification',
      '--resource-group', 'stratton-demo-rg',
      '--subscription', '8364fb4d-2d36-4da5-908b-36cb8b808b8c',
      '--server', 'stratton.azurecr.io',
      '--identity', $identityId
    )
    $identityRemoval | Should -Be @(
      'containerapp', 'job', 'identity', 'remove',
      '--name', 'stratton-verification',
      '--resource-group', 'stratton-demo-rg',
      '--subscription', '8364fb4d-2d36-4da5-908b-36cb8b808b8c',
      '--system-assigned',
      '--user-assigned',
      '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/legacy'
    )
    $registryRemoval | Should -Be @(
      'containerapp', 'job', 'registry', 'remove',
      '--name', 'stratton-verification',
      '--resource-group', 'stratton-demo-rg',
      '--subscription', '8364fb4d-2d36-4da5-908b-36cb8b808b8c',
      '--server', 'legacy.azurecr.io'
    )
    (($create + $update + $identity + $registry) -join ' ') |
      Should -Not -Match '(?i)(password|connection.?string|client.?secret|api.?key|access.?token|refresh.?token)'
  }

  It 'rejects mutable verification images and secret-bearing job settings' {
    {
      Assert-StrattonVerificationJobPayload `
        -Image 'stratton.azurecr.io/stratton/demo-bff:latest' `
        -EnvironmentVariables @('STRATTON_VERIFICATION_NONCE=nonce-123')
    } | Should -Throw 'VERIFICATION_IMAGE_DIGEST_INVALID'

    {
      Assert-StrattonVerificationJobPayload `
        -Image "stratton.azurecr.io/stratton/demo-bff@sha256:$('b' * 64)" `
        -EnvironmentVariables @('ACCESS_TOKEN=prohibited')
    } | Should -Throw 'VERIFICATION_SECRET_ENVIRONMENT_VARIABLE_PROHIBITED:ACCESS_TOKEN'
  }

  It 'accepts exactly one fresh nonce-bound verification receipt' {
    $nonce = 'nonce-123'
    $startedAt = [datetimeoffset] '2026-08-10T03:00:00Z'
    $receipt = [ordered]@{
      version = 1
      nonce = $nonce
      generatedAtUtc = '2026-08-10T03:00:10Z'
      checks = [ordered]@{
        bffHealth = $true
        phase5Health = $true
        sqlPrivateDns = $true
        sqlTokenAuthenticatedQuery = $true
      }
      routeBindings = @(
        [ordered]@{ route = 'LUNA'; resourceId = '/luna'; deploymentId = 'luna'; region = 'swedencentral'; apiVersion = '2025-01-01-preview'; evidenceId = 'luna-evidence'; evidenceVersion = 'v1'; status = 'APPROVED'; validFrom = '2026-08-09T03:00:00Z'; validUntil = '2026-08-11T03:00:00Z' }
        [ordered]@{ route = 'TERRA'; resourceId = '/terra'; deploymentId = 'terra'; region = 'francecentral'; apiVersion = '2025-01-01-preview'; evidenceId = 'terra-evidence'; evidenceVersion = 'v1'; status = 'APPROVED'; validFrom = '2026-08-09T03:00:00Z'; validUntil = '2026-08-11T03:00:00Z' }
        [ordered]@{ route = 'SOL'; resourceId = '/sol'; deploymentId = 'sol'; region = 'westeurope'; apiVersion = '2025-01-01-preview'; evidenceId = 'sol-evidence'; evidenceVersion = 'v1'; status = 'APPROVED'; validFrom = '2026-08-09T03:00:00Z'; validUntil = '2026-08-11T03:00:00Z' }
      )
    }
    $encoded = [Convert]::ToBase64String(
      [System.Text.UTF8Encoding]::new($false).GetBytes(
        ($receipt | ConvertTo-Json -Depth 30 -Compress)
      )
    )
    $rawLog = "console prefix`nSTRATTON_VERIFICATION_RECEIPT:$encoded`n"

    $result = ConvertFrom-StrattonVerificationJobLog `
      -RawLog $rawLog `
      -ExpectedNonce $nonce `
      -InvocationStartedAt $startedAt `
      -Now ([datetimeoffset] '2026-08-10T03:00:20Z')

    $result.bffHealth | Should -BeTrue
    $result.phase5Health | Should -BeTrue
    $result.sqlPrivateDns | Should -BeTrue
    $result.sqlTokenAuthenticatedQuery | Should -BeTrue
    @($result.routeBindings.route) | Should -Be @('LUNA', 'TERRA', 'SOL')
  }

  It 'rejects the Azure CLI default JSON log framing and accepts text log output' {
    $nonce = 'nonce-123'
    $startedAt = [datetimeoffset] '2026-08-10T03:00:00Z'
    $receipt = [ordered]@{
      version = 1
      nonce = $nonce
      generatedAtUtc = '2026-08-10T03:00:10Z'
      checks = [ordered]@{
        bffHealth = $true
        phase5Health = $true
        sqlPrivateDns = $true
        sqlTokenAuthenticatedQuery = $true
      }
      routeBindings = @(
        [ordered]@{ route = 'LUNA' }
        [ordered]@{ route = 'TERRA' }
        [ordered]@{ route = 'SOL' }
      )
    }
    $encoded = [Convert]::ToBase64String(
      [System.Text.UTF8Encoding]::new($false).GetBytes(
        ($receipt | ConvertTo-Json -Depth 30 -Compress)
      )
    )
    $textLog = "2026-08-10T03:00:10Z STRATTON_VERIFICATION_RECEIPT:$encoded"
    $jsonFramedLog = [ordered]@{
      TimeStamp = '2026-08-10T03:00:10Z'
      Log = "STRATTON_VERIFICATION_RECEIPT:$encoded"
    } | ConvertTo-Json -Compress

    {
      ConvertFrom-StrattonVerificationJobLog `
        -RawLog $jsonFramedLog `
        -ExpectedNonce $nonce `
        -InvocationStartedAt $startedAt `
        -Now ([datetimeoffset] '2026-08-10T03:00:20Z')
    } | Should -Throw 'VERIFICATION_JOB_LOG_FORMAT_INVALID'
    {
      ConvertFrom-StrattonVerificationJobLog `
        -RawLog $textLog `
        -ExpectedNonce $nonce `
        -InvocationStartedAt $startedAt `
        -Now ([datetimeoffset] '2026-08-10T03:00:20Z')
    } | Should -Not -Throw
  }

  It 'fails closed on stale malformed or ambiguous verification receipts' {
    $startedAt = [datetimeoffset] '2026-08-10T03:00:00Z'
    $stale = [ordered]@{
      version = 1
      nonce = 'nonce-123'
      generatedAtUtc = '2026-08-10T02:59:59Z'
      checks = [ordered]@{
        bffHealth = $true
        phase5Health = $true
        sqlPrivateDns = $true
        sqlTokenAuthenticatedQuery = $true
      }
      routeBindings = @()
    }
    $encoded = [Convert]::ToBase64String(
      [System.Text.UTF8Encoding]::new($false).GetBytes(
        ($stale | ConvertTo-Json -Depth 30 -Compress)
      )
    )

    {
      ConvertFrom-StrattonVerificationJobLog `
        -RawLog "STRATTON_VERIFICATION_RECEIPT:$encoded" `
        -ExpectedNonce 'nonce-123' `
        -InvocationStartedAt $startedAt `
        -Now ([datetimeoffset] '2026-08-10T03:00:20Z')
    } | Should -Throw 'VERIFICATION_JOB_RECEIPT_STALE'
    {
      ConvertFrom-StrattonVerificationJobLog `
        -RawLog 'STRATTON_VERIFICATION_RECEIPT:not-base64!' `
        -ExpectedNonce 'nonce-123' `
        -InvocationStartedAt $startedAt `
        -Now ([datetimeoffset] '2026-08-10T03:00:20Z')
    } | Should -Throw 'VERIFICATION_JOB_RECEIPT_MALFORMED'
    {
      ConvertFrom-StrattonVerificationJobLog `
        -RawLog "STRATTON_VERIFICATION_RECEIPT:$encoded`nSTRATTON_VERIFICATION_RECEIPT:$encoded" `
        -ExpectedNonce 'nonce-123' `
        -InvocationStartedAt $startedAt `
        -Now ([datetimeoffset] '2026-08-10T03:00:20Z')
    } | Should -Throw 'VERIFICATION_JOB_RECEIPT_AMBIGUOUS'
  }

  It 'fails closed unless the exact verification execution succeeds' {
    {
      Assert-StrattonVerificationExecutionSucceeded `
        -ExecutionName 'stratton-verification-exec-123' `
        -TerminalStatus 'Failed'
    } | Should -Throw 'VERIFICATION_JOB_FAILED:stratton-verification-exec-123:Failed'
    {
      Assert-StrattonVerificationExecutionSucceeded `
        -ExecutionName 'stratton-verification-exec-123' `
        -TerminalStatus $null
    } | Should -Throw 'VERIFICATION_JOB_FAILED:stratton-verification-exec-123:'
    {
      Assert-StrattonVerificationExecutionSucceeded `
        -ExecutionName 'stratton-verification-exec-123' `
        -TerminalStatus 'Succeeded'
    } | Should -Not -Throw
  }

  It 'fails promptly for every real non-success terminal job state' {
    foreach ($terminalStatus in @(
        'Failed',
        'Canceled',
        'Cancelled',
        'Degraded',
        'Stopped'
      )) {
      $script:terminalPollCount = 0
      $script:requestedTerminalStatus = $terminalStatus
      {
        Wait-StrattonVerificationJobExecution `
          -JobName 'stratton-verification' `
          -ResourceGroupName 'stratton-demo-rg' `
          -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
          -ExecutionName 'stratton-verification-exec-123' `
          -PollIntervalSeconds 0 `
          -MaxPollAttempts 3 `
          -AzInvoker {
            param([string[]] $Arguments)
            $script:terminalPollCount++
            [pscustomobject]@{
              properties = [pscustomobject]@{ status = $script:requestedTerminalStatus }
            }
          }
      } | Should -Throw "VERIFICATION_JOB_FAILED:stratton-verification-exec-123:$terminalStatus"
      $script:terminalPollCount | Should -Be 1
    }
  }

  It 'treats Unknown as indeterminate and keeps polling until a terminal status' {
    $script:unknownPollCount = 0
    {
      Wait-StrattonVerificationJobExecution `
        -JobName 'stratton-verification' `
        -ResourceGroupName 'stratton-demo-rg' `
        -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
        -ExecutionName 'stratton-verification-exec-123' `
        -PollIntervalSeconds 0 `
        -MaxPollAttempts 4 `
        -AzInvoker {
          param([string[]] $Arguments)
          $script:unknownPollCount++
          [pscustomobject]@{ properties = [pscustomobject]@{ status = 'Unknown' } }
        }
    } | Should -Throw 'VERIFICATION_JOB_NOT_TERMINAL:stratton-verification-exec-123:Unknown'
    $script:unknownPollCount | Should -Be 4

    $script:unknownThenSucceededCount = 0
    Wait-StrattonVerificationJobExecution `
      -JobName 'stratton-verification' `
      -ResourceGroupName 'stratton-demo-rg' `
      -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
      -ExecutionName 'stratton-verification-exec-123' `
      -PollIntervalSeconds 0 `
      -MaxPollAttempts 4 `
      -AzInvoker {
        param([string[]] $Arguments)
        $script:unknownThenSucceededCount++
        $status = if ($script:unknownThenSucceededCount -lt 3) { 'Unknown' } else { 'Succeeded' }
        [pscustomobject]@{ properties = [pscustomobject]@{ status = $status } }
      } | Should -Be 'Succeeded'
    $script:unknownThenSucceededCount | Should -Be 3
  }

  It 'retries live logs then uses an execution-scoped Log Analytics REST fallback' {
    $nonce = 'nonce-123'
    $startedAt = [datetimeoffset] '2026-08-10T03:00:00Z'
    $now = [datetimeoffset] '2026-08-10T03:00:20Z'
    $workspaceResourceId = '/subscriptions/8364fb4d-2d36-4da5-908b-36cb8b808b8c/resourceGroups/stratton-demo-rg/providers/Microsoft.OperationalInsights/workspaces/stratton-demo-log'
    $workspaceCustomerId = '55555555-5555-5555-5555-555555555555'
    $temporaryDirectory = Join-Path $TestDrive 'log-analytics-success'
    $receipt = [ordered]@{
      version = 1
      nonce = $nonce
      generatedAtUtc = '2026-08-10T03:00:10Z'
      checks = [ordered]@{
        bffHealth = $true
        phase5Health = $true
        sqlPrivateDns = $true
        sqlTokenAuthenticatedQuery = $true
      }
      routeBindings = @(
        [ordered]@{ route = 'LUNA' }
        [ordered]@{ route = 'TERRA' }
        [ordered]@{ route = 'SOL' }
      )
    }
    $encoded = [Convert]::ToBase64String(
      [System.Text.UTF8Encoding]::new($false).GetBytes(
        ($receipt | ConvertTo-Json -Depth 30 -Compress)
      )
    )
    $script:liveLogAttempts = 0
    $analyticsCalls = [System.Collections.Generic.List[object]]::new()
    $observedBodies = [System.Collections.Generic.List[object]]::new()

    $result = Get-StrattonVerificationJobReceipt `
      -JobName 'stratton-verification' `
      -ResourceGroupName 'stratton-demo-rg' `
      -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
      -ExecutionName 'stratton-verification-exec-123' `
      -WorkspaceResourceId $workspaceResourceId `
      -ExpectedNonce $nonce `
      -InvocationStartedAt $startedAt `
      -LiveLogMaxAttempts 2 `
      -LogAnalyticsMaxAttempts 1 `
      -RetryIntervalSeconds 0 `
      -TemporaryDirectory $temporaryDirectory `
      -NowProvider { $now } `
      -LogInvoker {
        param([string[]] $Arguments)
        $script:liveLogAttempts++
        throw 'VERIFICATION_JOB_LOG_RETRIEVAL_FAILED'
      } `
      -AzInvoker {
        param([string[]] $Arguments)
        $analyticsCalls.Add($Arguments)
        $command = $Arguments -join ' '
        if ($command -match '(?i)Microsoft\.OperationalInsights/workspaces/') {
          return [pscustomobject]@{
            properties = [pscustomobject]@{ customerId = $workspaceCustomerId }
          }
        }
        if ($command -match '(?i)api\.loganalytics\.io') {
          $bodyPath = $Arguments[[array]::IndexOf($Arguments, '--body') + 1].Substring(1)
          $observedBodies.Add((Get-Content -LiteralPath $bodyPath -Raw | ConvertFrom-Json))
          return [pscustomobject]@{
            tables = @(
              [pscustomobject]@{
                name = 'PrimaryResult'
                columns = @(
                  [pscustomobject]@{ name = 'TimeGenerated'; type = 'datetime' }
                  [pscustomobject]@{ name = 'Log'; type = 'string' }
                )
                rows = @(
                  , @('2026-08-10T03:00:10Z', "STRATTON_VERIFICATION_RECEIPT:$encoded")
                )
              }
            )
          }
        }
        throw "UNEXPECTED_AZ_COMMAND:$command"
      }

    $result.bffHealth | Should -BeTrue
    $script:liveLogAttempts | Should -Be 2
    $analyticsCalls.Count | Should -Be 2
    $analyticsCalls[0] | Should -Be @(
      'rest',
      '--method', 'get',
      '--url', "$($workspaceResourceId)?api-version=2023-09-01",
      '--subscription', '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
    )
    $analyticsCalls[1] | Should -Be @(
      'rest',
      '--method', 'post',
      '--url', "https://api.loganalytics.io/v1/workspaces/$workspaceCustomerId/query",
      '--resource', 'https://api.loganalytics.io',
      '--headers', 'Content-Type=application/json',
      '--body', $analyticsCalls[1][[array]::IndexOf($analyticsCalls[1], '--body') + 1],
      '--subscription', '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
    )
    $observedBodies.Count | Should -Be 1
    $observedBodies[0].query | Should -Match "StrattonJob == 'stratton-verification'"
    $observedBodies[0].query | Should -Match "StrattonExecution == 'stratton-verification-exec-123'"
    $observedBodies[0].query | Should -Match "StrattonContainer == 'verification'"
    $observedBodies[0].query | Should -Match "StrattonLog contains 'STRATTON_VERIFICATION_RECEIPT:'"
    $observedBodies[0].query | Should -Match 'column_ifexists\("ExecutionName", ""\)'
    $observedBodies[0].query | Should -Match 'column_ifexists\("ExecutionName_s", ""\)'
    $observedBodies[0].query | Should -Match 'TimeGenerated between'
    $observedBodies[0].timespan |
      Should -Be '2026-08-10T02:59:00.0000000Z/2026-08-10T03:01:20.0000000Z'
    $observedBodies[0].query |
      Should -Not -Match '(?i)(password|connection.?string|client.?secret|api.?key|access.?token|refresh.?token)'
  }

  It 'keeps Windows az.cmd argument vectors free of embedded KQL and cleans temporary bodies' {
    $temporaryDirectory = Join-Path $TestDrive 'log-analytics-argv'
    $capturedArguments = [System.Collections.Generic.List[object]]::new()
    $bodyPathsDuringCall = [System.Collections.Generic.List[string]]::new()

    {
      Get-StrattonVerificationJobReceipt `
        -JobName 'stratton-verification' `
        -ResourceGroupName 'stratton-demo-rg' `
        -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
        -ExecutionName 'stratton-verification-exec-123' `
        -WorkspaceResourceId '/subscriptions/8364fb4d-2d36-4da5-908b-36cb8b808b8c/resourceGroups/stratton-demo-rg/providers/Microsoft.OperationalInsights/workspaces/stratton-demo-log' `
        -ExpectedNonce 'nonce-123' `
        -InvocationStartedAt ([datetimeoffset] '2026-08-10T03:00:00Z') `
        -LiveLogMaxAttempts 1 `
        -LogAnalyticsMaxAttempts 2 `
        -RetryIntervalSeconds 0 `
        -TemporaryDirectory $temporaryDirectory `
        -NowProvider { [datetimeoffset] '2026-08-10T03:00:20Z' } `
        -LogInvoker {
          param([string[]] $Arguments)
          throw 'VERIFICATION_JOB_LOG_RETRIEVAL_FAILED'
        } `
        -AzInvoker {
          param([string[]] $Arguments)
          $capturedArguments.Add($Arguments)
          $command = $Arguments -join ' '
          if ($command -match '(?i)Microsoft\.OperationalInsights/workspaces/') {
            return [pscustomobject]@{
              properties = [pscustomobject]@{
                customerId = '55555555-5555-5555-5555-555555555555'
              }
            }
          }
          $bodyPathsDuringCall.Add(
            $Arguments[[array]::IndexOf($Arguments, '--body') + 1].Substring(1)
          )
          throw 'AZURE_CLI_FAILED:rest:boom'
        }
    } | Should -Throw 'VERIFICATION_JOB_LOG_ANALYTICS_QUERY_FAILED'

    $bodyPathsDuringCall.Count | Should -Be 2
    foreach ($bodyPath in $bodyPathsDuringCall) {
      (Split-Path -Path $bodyPath -Parent) | Should -Be $temporaryDirectory
      Test-Path -LiteralPath $bodyPath | Should -BeFalse
    }
    @(Get-ChildItem -Path $temporaryDirectory -Force -File).Count | Should -Be 0

    foreach ($arguments in $capturedArguments) {
      foreach ($argument in $arguments) {
        $argument | Should -Not -Match '[\r\n"'']'
        $argument | Should -Not -Match '(?i)(union isfuzzy|column_ifexists|TimeGenerated|\| where)'
      }
    }
    $restArguments = @($capturedArguments)[1]
    $restArguments | Should -Not -Contain '--analytics-query'
    ($restArguments[[array]::IndexOf($restArguments, '--body') + 1]) | Should -Match '^@'
  }

  It 'parses only the Log Analytics REST tables columns and rows envelope' {
    $response = [pscustomobject]@{
      tables = @(
        [pscustomobject]@{
          name = 'PrimaryResult'
          columns = @(
            [pscustomobject]@{ name = 'TimeGenerated'; type = 'datetime' }
            [pscustomobject]@{ name = 'Log'; type = 'string' }
          )
          rows = @(
            @('2026-08-10T03:00:10Z', 'first'),
            @('2026-08-10T03:00:11Z', 'second')
          )
        }
      )
    }

    ConvertFrom-StrattonLogAnalyticsQueryResponse -Response $response |
      Should -Be @('first', 'second')

    $singleRow = [pscustomobject]@{
      tables = @(
        [pscustomobject]@{
          columns = @(
            [pscustomobject]@{ name = 'TimeGenerated' }
            [pscustomobject]@{ name = 'Log' }
          )
          rows = @(, @('2026-08-10T03:00:10Z', 'only'))
        }
      )
    }
    ConvertFrom-StrattonLogAnalyticsQueryResponse -Response $singleRow | Should -Be @('only')

    foreach ($invalid in @(
        $null,
        [pscustomobject]@{ error = [pscustomobject]@{ code = 'BadArgumentError' } },
        [pscustomobject]@{ tables = @([pscustomobject]@{ columns = @(); rows = @() }) },
        [pscustomobject]@{
          tables = @(
            [pscustomobject]@{
              columns = @([pscustomobject]@{ name = 'TimeGenerated' })
              rows = @(, @('2026-08-10T03:00:10Z'))
            }
          )
        }
      )) {
      { ConvertFrom-StrattonLogAnalyticsQueryResponse -Response $invalid } |
        Should -Throw 'LOG_ANALYTICS_RESPONSE_INVALID'
    }

    {
      ConvertFrom-StrattonLogAnalyticsQueryResponse -Response ([pscustomobject]@{
          tables = @(
            [pscustomobject]@{
              columns = @(
                [pscustomobject]@{ name = 'TimeGenerated' }
                [pscustomobject]@{ name = 'Log' }
              )
              rows = @('flat', 'row')
            }
          )
        })
    } | Should -Throw 'LOG_ANALYTICS_RESPONSE_INVALID'
  }

  It 'rejects unsafe Kusto literals instead of escaping them' {
    foreach ($unsafe in @("stratton'", 'stratton or 1==1', "job`nname", 'job name', '')) {
      { Assert-StrattonKustoLiteralSafe -Value $unsafe -Name 'JobName' } |
        Should -Throw 'KUSTO_LITERAL_UNSAFE:JobName'
    }
    Assert-StrattonKustoLiteralSafe -Value 'STRATTON_VERIFICATION_RECEIPT:' -Name 'Marker' |
      Should -Be 'STRATTON_VERIFICATION_RECEIPT:'
  }

  It 'never depends on an Azure CLI extension for log retrieval' {
    $scriptText = @(
      Get-Content $script:verificationPath -Raw
      Get-Content (Join-Path $script:repoRoot 'scripts\deployment\Initialize-StrattonDataPlane.ps1') -Raw
      Get-Content (Join-Path $script:repoRoot 'scripts\deployment\Stratton.Deployment.psm1') -Raw
    ) -join "`n"

    $scriptText | Should -Not -Match '(?i)log-analytics'
    $scriptText | Should -Not -Match '(?i)--analytics-query'
    $scriptText | Should -Not -Match '(?i)az\s+extension\s+add'
    $scriptText | Should -Not -Match "'monitor'"
    $scriptText | Should -Match "'rest',"
  }

  It 'manually starts polls and reads the exact verification execution non-interactively' {
    $calls = [System.Collections.Generic.List[string]]::new()
    $logCalls = [System.Collections.Generic.List[string]]::new()
    $nonce = 'nonce-123'
    $generatedAt = '2026-08-10T03:00:20Z'
    $receipt = [ordered]@{
      version = 1
      nonce = $nonce
      generatedAtUtc = $generatedAt
      checks = [ordered]@{
        bffHealth = $true
        phase5Health = $true
        sqlPrivateDns = $true
        sqlTokenAuthenticatedQuery = $true
      }
      routeBindings = @(
        [ordered]@{ route = 'LUNA' }
        [ordered]@{ route = 'TERRA' }
        [ordered]@{ route = 'SOL' }
      )
    }
    $encoded = [Convert]::ToBase64String(
      [System.Text.UTF8Encoding]::new($false).GetBytes(
        ($receipt | ConvertTo-Json -Depth 30 -Compress)
      )
    )
    $outputs = [pscustomobject]@{
      containerAppsEnvironmentId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/cae'
      containerRegistryServer = 'stratton.azurecr.io'
      verificationIdentityResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/verification'
      verificationIdentityClientId = '44444444-4444-4444-4444-444444444444'
      bffAppFqdn = 'stratton-bff.internal.azurecontainerapps.io'
      phase5ApiFqdn = 'stratton-phase5.internal.azurecontainerapps.io'
      sqlServerFqdn = 'stratton.database.windows.net'
      sqlDatabaseName = 'stratton-db'
      logAnalyticsWorkspaceId = '/subscriptions/sub/resourceGroups/stratton-demo-rg/providers/Microsoft.OperationalInsights/workspaces/stratton-demo-log'
    }
    $script:verificationShowCount = 0
    $script:verificationJobEnvironment = @()
    $script:verificationJobImage = ''

    $result = Invoke-StrattonVerificationJob `
      -Outputs $outputs `
      -Image "stratton.azurecr.io/stratton/demo-bff@sha256:$('b' * 64)" `
      -ExpectedRoutes @(
        [pscustomobject]@{ route = 'LUNA' }
        [pscustomobject]@{ route = 'TERRA' }
        [pscustomobject]@{ route = 'SOL' }
      ) `
      -ResourceGroupName 'stratton-demo-rg' `
      -SubscriptionId '8364fb4d-2d36-4da5-908b-36cb8b808b8c' `
      -PollIntervalSeconds 0 `
      -MaxPollAttempts 1 `
      -NonceProvider { $nonce } `
      -NowProvider { [datetimeoffset] '2026-08-10T03:00:20Z' } `
      -AzInvoker {
        param([string[]] $Arguments)
        $command = $Arguments -join ' '
        $calls.Add($command)
        if ($command -match '^containerapp job show ') {
          $script:verificationShowCount++
          if ($script:verificationShowCount -eq 1) {
            throw 'JOB_NOT_FOUND'
          }
          $identityId = $outputs.verificationIdentityResourceId
          return [pscustomobject]@{
            identity = [pscustomobject]@{
              type = 'UserAssigned'
              userAssignedIdentities = [pscustomobject]@{
                $identityId = [pscustomobject]@{}
              }
            }
            properties = [pscustomobject]@{
              configuration = [pscustomobject]@{
                triggerType = 'Manual'
                registries = @(
                  [pscustomobject]@{
                    server = $outputs.containerRegistryServer
                    identity = $identityId
                  }
                )
              }
              template = [pscustomobject]@{
                containers = @(
                  [pscustomobject]@{
                    name = 'verification'
                    image = $script:verificationJobImage
                    command = @('node')
                    args = @('apps/bff/dist/verification-job.js')
                    env = @(
                      $script:verificationJobEnvironment |
                        ForEach-Object {
                          $separator = $_.IndexOf('=')
                          [pscustomobject]@{
                            name = $_.Substring(0, $separator)
                            value = $_.Substring($separator + 1)
                          }
                        }
                    )
                  }
                )
              }
            }
          }
        }
        if ($command -match '^containerapp job create ') {
          $script:verificationJobImage = $Arguments[
            [array]::IndexOf($Arguments, '--image') + 1
          ]
          $environmentIndex = [array]::IndexOf($Arguments, '--env-vars')
          $script:verificationJobEnvironment = @(
            $Arguments[($environmentIndex + 1)..($Arguments.Count - 1)]
          )
          return $null
        }
        if ($command -match '^containerapp job start ') {
          return [pscustomobject]@{ name = 'stratton-verification-exec-123' }
        }
        if ($command -match '^containerapp job execution show ') {
          return [pscustomobject]@{
            name = 'stratton-verification-exec-123'
            properties = [pscustomobject]@{ status = 'Succeeded' }
          }
        }
        return $null
      } `
      -LogInvoker {
        param([string[]] $Arguments)
        $logCalls.Add(($Arguments -join ' '))
        "STRATTON_VERIFICATION_RECEIPT:$encoded"
      }

    $result.bffHealth | Should -BeTrue
    $calls | Should -Contain (
      'containerapp job start --name stratton-verification --resource-group stratton-demo-rg --subscription 8364fb4d-2d36-4da5-908b-36cb8b808b8c'
    )
    $calls | Should -Contain (
      'containerapp job execution show --name stratton-verification --resource-group stratton-demo-rg --subscription 8364fb4d-2d36-4da5-908b-36cb8b808b8c --job-execution-name stratton-verification-exec-123'
    )
    $logCalls | Should -Be @(
      'containerapp job logs show --name stratton-verification --resource-group stratton-demo-rg --subscription 8364fb4d-2d36-4da5-908b-36cb8b808b8c --execution stratton-verification-exec-123 --container verification --tail 200 --format text --only-show-errors'
    )
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

  It 'never relies on interactive Container Apps exec for verification' {
    $scriptText = Get-Content $script:verificationPath -Raw

    $scriptText | Should -Not -Match '(?i)containerapp\s+exec'
    $scriptText | Should -Match "containerapp', 'job', 'logs', 'show'"
    $scriptText | Should -Match "'--container', 'verification'"
  }
}
