Set-StrictMode -Version Latest

Describe 'Stratton data-plane bootstrap' {
  BeforeAll {
    $script:repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $modulePath = Join-Path $script:repoRoot 'scripts\deployment\Stratton.Deployment.psm1'
    $script:routeEvidencePath = Join-Path $script:repoRoot 'scripts\deployment\route-evidence.json'
    $script:bootstrapScriptPath = Join-Path $script:repoRoot 'scripts\deployment\Initialize-StrattonDataPlane.ps1'

    Import-Module $modulePath -Force
  }

  It 'orders Phase 5 migrations before demo projection bootstrap' {
    (Get-StrattonMigrationFiles -RepositoryRoot $script:repoRoot).Name |
      Should -Be @('001_init.sql', '002_demo_authority.sql', 'demo-projection.sql')
  }

  It 'defines exactly one approved record for each governed route' {
    $routes = Get-Content $script:routeEvidencePath -Raw | ConvertFrom-Json

    @($routes.route) | Should -Be @('LUNA', 'TERRA', 'SOL')
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

  It 'creates a manual VNet job using the bootstrap identity and non-secret environment values' {
    . $script:bootstrapScriptPath -LoadOnly

    $arguments = New-StrattonBootstrapJobArguments `
      -JobName 'stratton-bootstrap' `
      -ResourceGroupName 'stratton-demo-rg' `
      -ContainerAppsEnvironmentId '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.App/managedEnvironments/cae' `
      -Image 'stratton.azurecr.io/stratton/bootstrap@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' `
      -RegistryServer 'stratton.azurecr.io' `
      -BootstrapIdentityResourceId '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/bootstrap' `
      -EnvironmentVariables @(
        'BOOTSTRAP_TENANT_ID=27140306-eea5-4e7f-91e9-4c9e86864b3a',
        'AZURE_SQL_SERVER_FQDN=stratton.database.windows.net'
      )

    $arguments | Should -Contain '--trigger-type'
    ($arguments[([array]::IndexOf($arguments, '--trigger-type') + 1)]) | Should -Be 'Manual'
    $arguments | Should -Contain '--mi-user-assigned'
    ($arguments[([array]::IndexOf($arguments, '--mi-user-assigned') + 1)]) |
      Should -Be '/subscriptions/sub/resourceGroups/rg/providers/Microsoft.ManagedIdentity/userAssignedIdentities/bootstrap'
    $arguments | Should -Contain '--registry-server'
    ($arguments[([array]::IndexOf($arguments, '--registry-server') + 1)]) | Should -Be 'stratton.azurecr.io'
    ($arguments -join ' ') | Should -Not -Match '(?i)(password|connection.string|client.secret|api.key)'
  }

  It 'requires a pinned non-root bootstrap image without a package manager' {
    $dockerfilePath = Join-Path $script:repoRoot '..\5-coding-r4\app\Dockerfile.bootstrap'
    $dockerfile = Get-Content $dockerfilePath -Raw

    $dockerfile | Should -Match '@sha256:[a-f0-9]{64}'
    $dockerfile | Should -Match '(?im)^USER 65532:65532\r?$'
    $dockerfile | Should -Not -Match '(?i)(tdnf|apt-get|apk\s+add|yum\s+)'
  }
}
