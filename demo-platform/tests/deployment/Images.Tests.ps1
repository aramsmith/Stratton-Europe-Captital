Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$modulePath = Join-Path $repoRoot 'scripts\deployment\Stratton.Deployment.psm1'

Import-Module $modulePath -Force

Describe 'Stratton image build orchestration' {
  It 'accepts only sha256 image digests' {
    Test-ImageDigest 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' |
      Should -BeTrue
    Test-ImageDigest 'latest' | Should -BeFalse
  }

  It 'builds only the approved repositories with unique temporary tags and writes a non-secret artifact' {
    $buildCalls = [System.Collections.Generic.List[object]]::new()
    $statusCalls = [System.Collections.Generic.List[object]]::new()
    $digestCalls = [System.Collections.Generic.List[object]]::new()
    $artifactPath = Join-Path $TestDrive 'images.json'

    $artifact = Invoke-StrattonImageBuilds `
      -RegistryName 'strattondemoacr' `
      -CommitSha '0123456789abcdef0123456789abcdef01234567' `
      -OutFile $artifactPath `
      -BuildInvoker {
        param($Definition, $RegistryName, $BuildTag)

        $buildCalls.Add([pscustomobject]@{
            repository = $Definition.repository
            dockerfile = $Definition.dockerfileRelativePath
            context = $Definition.sourceContextPath
            registryName = $RegistryName
            buildTag = $BuildTag
          })

        [pscustomobject]@{
          runId = "run-$($Definition.repository.Split('/')[1])"
          status = 'Queued'
        }
      } `
      -RunStatusInvoker {
        param($RegistryName, $BuildId, $Definition)

        $statusCalls.Add([pscustomobject]@{
            repository = $Definition.repository
            registryName = $RegistryName
            buildId = $BuildId
          })

        [pscustomobject]@{
          runId = $BuildId
          status = 'Succeeded'
        }
      } `
      -DigestInvoker {
        param($RegistryName, $Repository, $BuildTag, $Definition)

        $digestCalls.Add([pscustomobject]@{
            repository = $Repository
            registryName = $RegistryName
            buildTag = $BuildTag
            dockerfile = $Definition.dockerfileRelativePath
          })

        switch ($Repository) {
          'stratton/demo-web' { return "sha256:$('a' * 64)" }
          'stratton/demo-bff' { return "sha256:$('b' * 64)" }
          default { return "sha256:$('c' * 64)" }
        }
      }

    @($buildCalls.repository) | Should -Be @(
      'stratton/demo-web',
      'stratton/demo-bff',
      'stratton/phase5-api'
    )
    @($buildCalls.dockerfile) | Should -Be @(
      'apps\web\Dockerfile',
      'apps\bff\Dockerfile',
      'Dockerfile.api'
    )
    @($buildCalls.context | ForEach-Object { Test-Path $_ }) | Should -Not -Contain $false
    (@($buildCalls.buildTag | Select-Object -Unique)).Count | Should -Be 3
    @($statusCalls.buildId) | Should -Be @('run-demo-web', 'run-demo-bff', 'run-phase5-api')
    @($digestCalls.buildTag) | Should -Be @($buildCalls.buildTag)

    Test-Path $artifactPath | Should -BeTrue
    $storedArtifact = Get-Content -Path $artifactPath -Raw | ConvertFrom-Json

    $storedArtifact.registryName | Should -Be 'strattondemoacr'
    @($storedArtifact.images.repository) | Should -Be @(
      'stratton/demo-web',
      'stratton/demo-bff',
      'stratton/phase5-api'
    )
    @($storedArtifact.images.buildId) | Should -Be @('run-demo-web', 'run-demo-bff', 'run-phase5-api')
    @($storedArtifact.images.digest) | Should -Be @(
      "sha256:$('a' * 64)",
      "sha256:$('b' * 64)",
      "sha256:$('c' * 64)"
    )

    foreach ($image in @($storedArtifact.images)) {
      $image.PSObject.Properties.Name | Should -Be @('repository', 'buildId', 'digest')
    }

    foreach ($temporaryTag in @($buildCalls.buildTag)) {
      ($storedArtifact | ConvertTo-Json -Depth 20) | Should -Not -Match ([Regex]::Escape($temporaryTag))
    }
  }

  It 'fails closed when a build result is ambiguous' {
    {
      Invoke-StrattonImageBuilds `
        -RegistryName 'strattondemoacr' `
        -CommitSha '0123456789abcdef0123456789abcdef01234567' `
        -OutFile (Join-Path $TestDrive 'ambiguous-build.json') `
        -BuildInvoker {
          @(
            [pscustomobject]@{ runId = 'run-one' }
            [pscustomobject]@{ runId = 'run-two' }
          )
        } `
        -RunStatusInvoker {
          throw 'Run status should not be queried when the build ID is ambiguous.'
        } `
        -DigestInvoker {
          throw 'Digest should not be queried when the build ID is ambiguous.'
        }
    } | Should -Throw 'AMBIGUOUS_IMAGE_BUILD_ID:stratton/demo-web'
  }

  It 'fails closed when digest lookup is ambiguous' {
    {
      Invoke-StrattonImageBuilds `
        -RegistryName 'strattondemoacr' `
        -CommitSha '0123456789abcdef0123456789abcdef01234567' `
        -OutFile (Join-Path $TestDrive 'ambiguous-digest.json') `
        -BuildInvoker {
          param($Definition, $RegistryName, $BuildTag)

          [pscustomobject]@{
            runId = "run-$($Definition.repository.Split('/')[1])"
          }
        } `
        -RunStatusInvoker {
          param($RegistryName, $BuildId, $Definition)

          [pscustomobject]@{
            runId = $BuildId
            status = 'Succeeded'
          }
        } `
        -DigestInvoker {
          @(
            "sha256:$('a' * 64)"
            "sha256:$('b' * 64)"
          )
        }
    } | Should -Throw 'AMBIGUOUS_IMAGE_DIGEST:stratton/demo-web'
  }
}

Describe 'Write-DeploymentArtifact' {
  It 'replaces existing JSON without leaving temporary files behind' {
    $artifactDirectory = Join-Path $TestDrive 'artifacts'
    $artifactPath = Join-Path $artifactDirectory 'images.json'
    New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
    '{"stale":true,"images":[]}' | Set-Content -Path $artifactPath -Encoding utf8

    Write-DeploymentArtifact -Path $artifactPath -InputObject ([pscustomobject]@{
        registryName = 'strattondemoacr'
        images = @(
          [pscustomobject]@{
            repository = 'stratton/demo-web'
            buildId = 'run-demo-web'
            digest = "sha256:$('a' * 64)"
          }
        )
      })

    $storedArtifact = Get-Content -Path $artifactPath -Raw | ConvertFrom-Json

    $storedArtifact.PSObject.Properties.Name | Should -Not -Contain 'stale'
    $storedArtifact.registryName | Should -Be 'strattondemoacr'
    (Get-ChildItem -Path $artifactDirectory -Force | Select-Object -ExpandProperty Name | Sort-Object) |
      Should -Be @('images.json')
  }

  It 'does not write directly to the final artifact path before replacement' {
    $artifactDirectory = Join-Path $TestDrive 'atomic-artifacts'
    $artifactPath = Join-Path $artifactDirectory 'images.json'
    New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
    '{"version":"old","images":[]}' | Set-Content -Path $artifactPath -Encoding utf8
    $script:directWriteTarget = $artifactPath

    Mock Set-Content -ModuleName Stratton.Deployment {
      throw 'DIRECT_FINAL_WRITE'
    } -ParameterFilter { $Path -ceq $script:directWriteTarget }

    {
      Write-DeploymentArtifact -Path $artifactPath -InputObject ([pscustomobject]@{
          version = 'new'
          images = @()
        })
    } | Should -Not -Throw

    (Get-Content -Path $artifactPath -Raw | ConvertFrom-Json).version | Should -Be 'new'
  }

  It 'preserves the previous artifact and cleans up temporary files when replacement fails' {
    $artifactDirectory = Join-Path $TestDrive 'locked-artifacts'
    $artifactPath = Join-Path $artifactDirectory 'images.json'
    New-Item -ItemType Directory -Path $artifactDirectory -Force | Out-Null
    '{"version":"old","images":[]}' | Set-Content -Path $artifactPath -Encoding utf8

    $lockStream = [System.IO.File]::Open(
      $artifactPath,
      [System.IO.FileMode]::Open,
      [System.IO.FileAccess]::Read,
      [System.IO.FileShare]::None
    )

    try {
      {
        Write-DeploymentArtifact -Path $artifactPath -InputObject ([pscustomobject]@{
            version = 'new'
            images = @()
          })
      } | Should -Throw
    }
    finally {
      $lockStream.Dispose()
    }

    (Get-Content -Path $artifactPath -Raw | ConvertFrom-Json).version | Should -Be 'old'
    (Get-ChildItem -Path $artifactDirectory -Force | Select-Object -ExpandProperty Name | Sort-Object) |
      Should -Be @('images.json')
  }
}
