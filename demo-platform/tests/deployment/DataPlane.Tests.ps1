Set-StrictMode -Version Latest

Describe 'Stratton data-plane bootstrap' {
  BeforeAll {
    $script:repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $modulePath = Join-Path $script:repoRoot 'scripts\deployment\Stratton.Deployment.psm1'
    $script:routeEvidencePath = Join-Path $script:repoRoot 'scripts\deployment\route-evidence.json'
    $script:bootstrapScriptPath = Join-Path $script:repoRoot 'scripts\deployment\Initialize-StrattonDataPlane.ps1'
    $script:bootstrapMainPath = Join-Path $script:repoRoot '..\5-coding-r4\app\src\bootstrap-main.ts'

    Import-Module $modulePath -Force
    . $script:bootstrapScriptPath -LoadOnly
  }

  It 'orders Phase 5 migrations before demo projection bootstrap' {
    (Get-StrattonMigrationFiles -RepositoryRoot $script:repoRoot).Name |
      Should -Be @('001_init.sql', '002_demo_authority.sql', 'demo-projection.sql')
  }

  It 'binds image migrations to the current repository instead of stale deployment outputs' {
    $script = Get-Content -LiteralPath $script:bootstrapScriptPath -Raw

    $script | Should -Match 'Get-StrattonMigrationFiles'
    $script | Should -Not -Match "Get-RequiredDeploymentOutput\s+-Outputs\s+\`$outputs\s+-Name\s+'sqlPhase5InitialMigrationSql'"
    $script | Should -Not -Match "Get-RequiredDeploymentOutput\s+-Outputs\s+\`$outputs\s+-Name\s+'sqlPhase5AuthorityMigrationSql'"
  }

  It 'defines exactly one approved record for each governed route' {
    $routes = Get-Content $script:routeEvidencePath -Raw | ConvertFrom-Json

    { Assert-StrattonRouteSequence -RouteDefinitions $routes } | Should -Not -Throw
    @($routes | Where-Object tenantId -ne '27140306-eea5-4e7f-91e9-4c9e86864b3a').Count |
      Should -Be 0
    @($routes | Where-Object caseId -ne 'project-danube').Count | Should -Be 0
    @($routes | Where-Object approvalStatus -ne 'APPROVED').Count | Should -Be 0
    @($routes | Where-Object { $_.validityDays -lt 1 -or $_.validityDays -gt 90 }).Count |
      Should -Be 0
    @($routes | Where-Object {
        [string]::IsNullOrWhiteSpace($_.accountResourceId) -or
        [string]::IsNullOrWhiteSpace($_.deploymentId) -or
        $_.accountResourceId -notmatch '^\$\{[A-Za-z][A-Za-z0-9]*\}$' -or
        $_.deploymentId -notmatch '^\$\{[A-Za-z][A-Za-z0-9]*\}$'
      }).Count | Should -Be 0
  }

  It 'evaluates the bootstrap route timestamp before parameter binding' {
    $script = Get-Content -LiteralPath $script:bootstrapScriptPath -Raw

    $script | Should -Match '-Now\s+\(\[datetimeoffset\]::UtcNow\)'
    $script | Should -Not -Match '-Now\s+\[datetimeoffset\]::UtcNow'
  }

  It 'preserves hash-bound projection SQL whitespace in the bootstrap image' {
    $bootstrapMain = Get-Content -LiteralPath $script:bootstrapMainPath -Raw

    $bootstrapMain | Should -Match 'const projection = requiredRaw\("BOOTSTRAP_PROJECTION_MIGRATION_SQL"\)'
  }

  It 'rejects any route definition sequence other than exact ordered LUNA TERRA SOL' {
    $invalidSequences = @(
      @('TERRA', 'LUNA', 'SOL'),
      @('LUNA', 'TERRA', 'TERRA'),
      @('LUNA', 'TERRA'),
      @('LUNA', 'TERRA', 'SOL', 'SOL')
    )

    foreach ($sequence in $invalidSequences) {
      $definitions = @($sequence | ForEach-Object { [pscustomobject]@{ route = $_ } })
      { Assert-StrattonRouteSequence -RouteDefinitions $definitions } |
        Should -Throw -ExpectedMessage 'ROUTE_EVIDENCE_DEFINITION_INVALID'
    }
  }

  It 'builds and appends only the immutable bootstrap image digest' {
    $artifactPath = Join-Path $TestDrive 'images.json'
    Write-DeploymentArtifact -Path $artifactPath -InputObject ([pscustomobject]@{
        registryName = 'strattondemoacr'
        images = @(
          [pscustomobject]@{
            repository = 'stratton/phase5-api'
            buildId = 'phase5-run'
            digest = "sha256:$('a' * 64)"
          }
        )
      })

    $buildTags = [System.Collections.Generic.List[string]]::new()
    $artifact = Invoke-StrattonBootstrapImageBuild `
      -RegistryName 'strattondemoacr' `
      -CommitSha '0123456789abcdef0123456789abcdef01234567' `
      -OutFile $artifactPath `
      -BuildInvoker {
        param($Definition, $RegistryName, $BuildTag)

        $Definition.repository | Should -Be 'stratton/bootstrap'
        $Definition.dockerfileRelativePath | Should -Be 'Dockerfile.bootstrap'
        $buildTags.Add($BuildTag)
        [pscustomobject]@{ runId = 'bootstrap-run' }
      } `
      -RunStatusInvoker {
        param($RegistryName, $BuildId, $Definition)

        $BuildId | Should -Be 'bootstrap-run'
        [pscustomobject]@{ status = 'Succeeded' }
      } `
      -DigestInvoker {
        param($RegistryName, $Repository, $BuildTag, $Definition)

        $Repository | Should -Be 'stratton/bootstrap'
        $BuildTag | Should -Be $buildTags[0]
        "sha256:$('b' * 64)"
      }

    @($artifact.images.repository) | Should -Be @('stratton/phase5-api', 'stratton/bootstrap')
    @($artifact.images.digest) | Should -Be @(
      "sha256:$('a' * 64)",
      "sha256:$('b' * 64)"
    )
    $stored = Get-Content $artifactPath -Raw | ConvertFrom-Json
    @($stored.images.repository) | Should -Be @('stratton/phase5-api', 'stratton/bootstrap')
    ($stored | ConvertTo-Json -Depth 10) | Should -Not -Match [regex]::Escape($buildTags[0])
  }

  It 'splits create and update commands and excludes create-only flags from update' {
    $commonParameters = @{
      JobName = 'stratton-bootstrap'
      ResourceGroupName = 'stratton-demo-rg'
      Image = 'stratton.azurecr.io/stratton/bootstrap@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      EnvironmentVariables = @(
        'BOOTSTRAP_TENANT_ID=27140306-eea5-4e7f-91e9-4c9e86864b3a',
        'AZURE_SQL_SERVER_FQDN=stratton.database.windows.net'
      )
    }
    $createArguments = New-StrattonBootstrapJobCreateArguments `
      @commonParameters `
      -ContainerAppsEnvironmentId '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/cae' `
      -RegistryServer 'stratton.azurecr.io' `
      -BootstrapIdentityResourceId '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/bootstrap'
    $updateArguments = New-StrattonBootstrapJobUpdateArguments @commonParameters

    $createArguments[0..2] | Should -Be @('containerapp', 'job', 'create')
    $createArguments | Should -Contain '--trigger-type'
    ($createArguments[([array]::IndexOf($createArguments, '--trigger-type') + 1)]) | Should -Be 'Manual'
    $createArguments | Should -Contain '--mi-user-assigned'
    ($createArguments[([array]::IndexOf($createArguments, '--mi-user-assigned') + 1)]) |
      Should -Be '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/bootstrap'
    $createArguments | Should -Contain '--registry-server'
    ($createArguments[([array]::IndexOf($createArguments, '--registry-server') + 1)]) |
      Should -Be 'stratton.azurecr.io'

    $updateArguments[0..2] | Should -Be @('containerapp', 'job', 'update')
    $updateArguments | Should -Contain '--replace-env-vars'
    foreach ($createOnlyFlag in @(
        '--environment',
        '--trigger-type',
        '--mi-user-assigned',
        '--registry-server',
        '--registry-identity',
        '--env-vars'
      )) {
      $updateArguments | Should -Not -Contain $createOnlyFlag
    }
    (($createArguments + $updateArguments) -join ' ') |
      Should -Not -Match '(?i)(password|connection.string|client.secret|api.key)'
  }

  It 'reconciles identity and registry with supported idempotent commands' {
    $identityResourceId = '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/bootstrap'
    $identityArguments = New-StrattonBootstrapJobIdentityArguments `
      -JobName 'stratton-bootstrap' `
      -ResourceGroupName 'stratton-demo-rg' `
      -BootstrapIdentityResourceId $identityResourceId
    $registryArguments = New-StrattonBootstrapJobRegistryArguments `
      -JobName 'stratton-bootstrap' `
      -ResourceGroupName 'stratton-demo-rg' `
      -RegistryServer 'stratton.azurecr.io' `
      -BootstrapIdentityResourceId $identityResourceId

    $identityArguments | Should -Be @(
      'containerapp', 'job', 'identity', 'assign',
      '--name', 'stratton-bootstrap',
      '--resource-group', 'stratton-demo-rg',
      '--user-assigned', $identityResourceId
    )
    $registryArguments | Should -Be @(
      'containerapp', 'job', 'registry', 'set',
      '--name', 'stratton-bootstrap',
      '--resource-group', 'stratton-demo-rg',
      '--server', 'stratton.azurecr.io',
      '--identity', $identityResourceId
    )
  }

  It 'uses the deterministic bootstrap container name for job changes and log retrieval' {
    $environmentVariables = @('BOOTSTRAP_TENANT_ID=27140306-eea5-4e7f-91e9-4c9e86864b3a')
    $updateArguments = New-StrattonBootstrapJobUpdateArguments `
      -JobName 'stratton-bootstrap' `
      -ResourceGroupName 'stratton-demo-rg' `
      -Image 'stratton.azurecr.io/stratton/bootstrap@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' `
      -EnvironmentVariables $environmentVariables
    $logArguments = New-StrattonBootstrapJobLogArguments `
      -JobName 'stratton-bootstrap' `
      -ResourceGroupName 'stratton-demo-rg' `
      -ExecutionName 'stratton-bootstrap-abc123'

    ($updateArguments[([array]::IndexOf($updateArguments, '--container-name') + 1)]) |
      Should -Be 'bootstrap'
    ($logArguments[([array]::IndexOf($logArguments, '--container') + 1)]) |
      Should -Be 'bootstrap'
    ($logArguments[([array]::IndexOf($logArguments, '--format') + 1)]) |
      Should -Be 'text'
  }

  It 'parses text bootstrap logs and rejects the Azure CLI default JSON framing' {
    $receipt = [ordered]@{
      migrationHashes = @(
        [ordered]@{ name = '001_init.sql'; sha256 = ('a' * 64) }
        [ordered]@{ name = '002_demo_authority.sql'; sha256 = ('b' * 64) }
        [ordered]@{ name = 'demo-projection.sql'; sha256 = ('c' * 64) }
      )
      searchIndexEtag = 'etag-123'
      routeEvidence = @()
    }
    $entry = [ordered]@{
      timestamp = '2026-08-10T03:00:10Z'
      level = 'INFO'
      service = 'stratton-bootstrap'
      message = 'bootstrap-receipt'
      context = [ordered]@{
        correlationId = 'bootstrap'
        receipt = $receipt
      }
    }
    $entryJson = $entry | ConvertTo-Json -Depth 30 -Compress
    $textOutput = "2026-08-10T03:00:10Z $entryJson"
    $jsonFramedOutput = [ordered]@{
      TimeStamp = '2026-08-10T03:00:10Z'
      Log = $entryJson
    } | ConvertTo-Json -Compress

    $entries = Get-RedactedBootstrapLogEntries -RawLog $textOutput
    (Get-BootstrapReceipt -LogEntries $entries).searchIndexEtag | Should -Be 'etag-123'
    {
      Get-RedactedBootstrapLogEntries -RawLog $jsonFramedOutput
    } | Should -Throw 'BOOTSTRAP_JOB_LOG_FORMAT_INVALID'
  }

  It 'fails promptly for every real non-success bootstrap terminal state' {
    foreach ($terminalStatus in @(
        'Failed',
        'Canceled',
        'Cancelled',
        'Degraded',
        'Stopped'
      )) {
      $script:bootstrapTerminalPollCount = 0
      $script:requestedBootstrapTerminalStatus = $terminalStatus
      {
        Wait-StrattonBootstrapJobExecution `
          -JobName 'stratton-bootstrap' `
          -ResourceGroupName 'stratton-demo-rg' `
          -ExecutionName 'stratton-bootstrap-exec-123' `
          -PollIntervalSeconds 0 `
          -MaxPollAttempts 3 `
          -JobInvoker {
            param([string[]] $Arguments)
            $script:bootstrapTerminalPollCount++
            [pscustomobject]@{
              properties = [pscustomobject]@{
                status = $script:requestedBootstrapTerminalStatus
              }
            }
          }
      } | Should -Throw "BOOTSTRAP_JOB_FAILED:stratton-bootstrap-exec-123:$terminalStatus"
      $script:bootstrapTerminalPollCount | Should -Be 1
    }
  }

  It 'treats Unknown bootstrap status as indeterminate and keeps polling' {
    $script:bootstrapUnknownPollCount = 0
    {
      Wait-StrattonBootstrapJobExecution `
        -JobName 'stratton-bootstrap' `
        -ResourceGroupName 'stratton-demo-rg' `
        -ExecutionName 'stratton-bootstrap-exec-123' `
        -PollIntervalSeconds 0 `
        -MaxPollAttempts 4 `
        -JobInvoker {
          param([string[]] $Arguments)
          $script:bootstrapUnknownPollCount++
          [pscustomobject]@{ properties = [pscustomobject]@{ status = 'Unknown' } }
        }
    } | Should -Throw 'BOOTSTRAP_JOB_NOT_TERMINAL:stratton-bootstrap-exec-123:Unknown'
    $script:bootstrapUnknownPollCount | Should -Be 4

    $script:bootstrapRecoveryPollCount = 0
    Wait-StrattonBootstrapJobExecution `
      -JobName 'stratton-bootstrap' `
      -ResourceGroupName 'stratton-demo-rg' `
      -ExecutionName 'stratton-bootstrap-exec-123' `
      -PollIntervalSeconds 0 `
      -MaxPollAttempts 4 `
      -JobInvoker {
        param([string[]] $Arguments)
        $script:bootstrapRecoveryPollCount++
        $status = if ($script:bootstrapRecoveryPollCount -lt 3) { 'Unknown' } else { 'Succeeded' }
        [pscustomobject]@{ properties = [pscustomobject]@{ status = $status } }
      } | Should -Be 'Succeeded'
    $script:bootstrapRecoveryPollCount | Should -Be 3
  }

  It 'requires exactly one bootstrap receipt' {
    $receipt = [pscustomobject]@{ searchIndexEtag = 'etag-123' }
    $entry = [pscustomobject]@{
      message = 'bootstrap-receipt'
      context = [pscustomobject]@{ receipt = $receipt }
    }

    { Get-BootstrapReceipt -LogEntries @() } | Should -Throw 'BOOTSTRAP_RECEIPT_MISSING'
    { Get-BootstrapReceipt -LogEntries @($entry, $entry) } |
      Should -Throw 'BOOTSTRAP_RECEIPT_AMBIGUOUS'
    (Get-BootstrapReceipt -LogEntries @($entry)).searchIndexEtag | Should -Be 'etag-123'
  }

  It 'retries bootstrap live logs then falls back to the Log Analytics REST query' {
    $startedAt = [datetimeoffset] '2026-08-10T03:00:00Z'
    $now = [datetimeoffset] '2026-08-10T03:00:20Z'
    $workspaceResourceId = '/subscriptions/8364fb4d-2d36-4da5-908b-36cb8b808b8c/resourceGroups/stratton-demo-rg/providers/Microsoft.OperationalInsights/workspaces/stratton-demo-log'
    $temporaryDirectory = Join-Path $TestDrive 'bootstrap-log-analytics'
    $entry = [ordered]@{
      timestamp = '2026-08-10T03:00:10Z'
      level = 'INFO'
      service = 'stratton-bootstrap'
      message = 'bootstrap-receipt'
      context = [ordered]@{
        correlationId = 'bootstrap'
        receipt = [ordered]@{
          migrationHashes = @()
          searchIndexEtag = 'etag-123'
          routeEvidence = @()
        }
      }
    }
    $entryJson = $entry | ConvertTo-Json -Depth 30 -Compress
    $script:bootstrapLiveLogAttempts = 0
    $capturedArguments = [System.Collections.Generic.List[object]]::new()
    $observedBodies = [System.Collections.Generic.List[object]]::new()
    $bodyPaths = [System.Collections.Generic.List[string]]::new()

    $result = Get-StrattonBootstrapJobReceipt `
      -JobName 'stratton-bootstrap' `
      -ResourceGroupName 'stratton-demo-rg' `
      -ExecutionName 'stratton-bootstrap-exec-123' `
      -WorkspaceResourceId $workspaceResourceId `
      -InvocationStartedAt $startedAt `
      -LiveLogMaxAttempts 2 `
      -LogAnalyticsMaxAttempts 1 `
      -RetryIntervalSeconds 0 `
      -TemporaryDirectory $temporaryDirectory `
      -NowProvider { $now } `
      -LogInvoker {
        param([string[]] $Arguments)
        $script:bootstrapLiveLogAttempts++
        throw 'BOOTSTRAP_LOG_RETRIEVAL_FAILED'
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
        $bodyPath = $Arguments[[array]::IndexOf($Arguments, '--body') + 1].Substring(1)
        $bodyPaths.Add($bodyPath)
        $observedBodies.Add((Get-Content -LiteralPath $bodyPath -Raw | ConvertFrom-Json))
        return [pscustomobject]@{
          tables = @(
            [pscustomobject]@{
              name = 'PrimaryResult'
              columns = @(
                [pscustomobject]@{ name = 'TimeGenerated'; type = 'datetime' }
                [pscustomobject]@{ name = 'Log'; type = 'string' }
              )
              rows = @(, @('2026-08-10T03:00:10Z', $entryJson))
            }
          )
        }
      }

    $script:bootstrapLiveLogAttempts | Should -Be 2
    $result.receipt.searchIndexEtag | Should -Be 'etag-123'
    @($result.entries).Count | Should -Be 1
    $capturedArguments[0][0] | Should -Be 'rest'
    $capturedArguments[1][0] | Should -Be 'rest'
    $observedBodies[0].query | Should -Match "StrattonJob == 'stratton-bootstrap'"
    $observedBodies[0].query | Should -Match "StrattonExecution == 'stratton-bootstrap-exec-123'"
    $observedBodies[0].query | Should -Match "StrattonContainer == 'bootstrap'"
    $observedBodies[0].query | Should -Match "StrattonLog contains 'bootstrap-receipt'"
    $observedBodies[0].timespan |
      Should -Be '2026-08-10T02:59:00.0000000Z/2026-08-10T03:01:20.0000000Z'
    foreach ($arguments in $capturedArguments) {
      foreach ($argument in $arguments) {
        $argument | Should -Not -Match '[\r\n"'']'
        $argument | Should -Not -Match '(?i)(union isfuzzy|column_ifexists|\| where)'
      }
    }
    foreach ($bodyPath in $bodyPaths) {
      Test-Path -LiteralPath $bodyPath | Should -BeFalse
    }
    @(Get-ChildItem -Path $temporaryDirectory -Force -File).Count | Should -Be 0
  }

  It 'fails predictably when job execution responses omit optional properties' {
    { Get-UniqueExecutionValue -InputObject ([pscustomobject]@{}) -Kind 'EXECUTION_NAME' } |
      Should -Throw -ExpectedMessage 'AMBIGUOUS_JOB_EXECUTION_NAME'
    { Get-StrattonJobExecutionStatus -Execution ([pscustomobject]@{}) } |
      Should -Throw -ExpectedMessage 'AMBIGUOUS_JOB_EXECUTION_STATUS'
    { Get-StrattonJobExecutionStatus -Execution ([pscustomobject]@{ properties = [pscustomobject]@{} }) } |
      Should -Throw -ExpectedMessage 'AMBIGUOUS_JOB_EXECUTION_STATUS'
  }

  It 'requires a pinned non-root bootstrap image without a package manager' {
    $dockerfilePath = Join-Path $script:repoRoot '..\5-coding-r4\app\Dockerfile.bootstrap'
    $dockerfile = Get-Content $dockerfilePath -Raw

    $dockerfile | Should -Match '@sha256:[a-f0-9]{64}'
    $dockerfile | Should -Match '(?im)^USER 65532:65532\r?$'
    $dockerfile | Should -Not -Match '(?i)(tdnf|apt-get|apk\s+add|yum\s+)'
  }
}
