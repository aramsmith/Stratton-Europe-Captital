Describe 'Phase 5 validation input binding' {
    BeforeAll {
        $script:packageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
        $script:modulePath = Join-Path $script:packageRoot 'validation\ValidationEvidence.psm1'
        $script:fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) (
            'stratton-validation-binding-{0}' -f [guid]::NewGuid().ToString('N')
        )
        New-Item -ItemType Directory -Path $script:fixtureRoot | Out-Null
        New-Item -ItemType Directory -Path (Join-Path $script:fixtureRoot 'app\node_modules') -Force |
            Out-Null
        New-Item -ItemType Directory -Path (Join-Path $script:fixtureRoot 'validation') -Force |
            Out-Null
        New-Item -ItemType Directory -Path (
            Join-Path $script:fixtureRoot 'evidence\local-validation\run-a'
        ) -Force | Out-Null

        $utf8 = [Text.UTF8Encoding]::new($false)
        [IO.File]::WriteAllText((Join-Path $script:fixtureRoot 'README.md'), 'root', $utf8)
        [IO.File]::WriteAllText((Join-Path $script:fixtureRoot 'app\main.txt'), 'alpha', $utf8)
        [IO.File]::WriteAllText(
            (Join-Path $script:fixtureRoot 'validation\tool.ps1'),
            "Write-Host 'ok'",
            $utf8
        )
        [IO.File]::WriteAllText(
            (Join-Path $script:fixtureRoot 'app\node_modules\ignored.txt'),
            'ignored dependency',
            $utf8
        )
        [IO.File]::WriteAllText(
            (Join-Path $script:fixtureRoot 'evidence\historical.json'),
            '{}',
            $utf8
        )
        [IO.File]::WriteAllText(
            (Join-Path $script:fixtureRoot 'stratton-release-manifest.json'),
            '{}',
            $utf8
        )
    }

    AfterAll {
        Remove-Module ValidationEvidence -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $script:fixtureRoot) {
            Remove-Item -LiteralPath $script:fixtureRoot -Recurse -Force
        }
    }

    It 'hashes the exact deterministic validation input and excludes generated evidence' {
        { Import-Module -Name $script:modulePath -Force -ErrorAction Stop } |
            Should -Not -Throw

        $manifestPath = Join-Path $script:fixtureRoot (
            'evidence\local-validation\run-a\validation-input.json'
        )
        $manifest = New-ValidationInputManifest -PackageRoot $script:fixtureRoot `
            -RunId 'run-a' -OutputPath $manifestPath

        $manifest.aggregateAlgorithm | Should -Be 'SHA256_UTF8_PATH_TAB_SHA256_TAB_SIZE_LF_V1'
        $manifest.aggregateSha256 |
            Should -Be 'fc1eb3de717c471f2635fe2a95a6b1160d936c51ec07f8018c1c8eb7563c7994'
        $manifest.fileCount | Should -Be 3
        @($manifest.files.path) | Should -Be @(
            'README.md',
            'app/main.txt',
            'validation/tool.ps1'
        )

        [IO.File]::WriteAllText(
            (Join-Path $script:fixtureRoot 'evidence\later.json'),
            '{"changed":true}',
            [Text.UTF8Encoding]::new($false)
        )
        $secondManifest = New-ValidationInputManifest -PackageRoot $script:fixtureRoot `
            -RunId 'run-b' -OutputPath (
                Join-Path $script:fixtureRoot 'evidence\local-validation\run-b\validation-input.json'
            )

        $secondManifest.aggregateSha256 | Should -Be $manifest.aggregateSha256
        @($secondManifest.files.path) | Should -Be @($manifest.files.path)
    }

    It 'rejects evidence after any validation input byte changes' {
        Import-Module -Name $script:modulePath -Force -ErrorAction Stop
        $manifestPath = Join-Path $script:fixtureRoot (
            'evidence\local-validation\run-c\validation-input.json'
        )
        New-ValidationInputManifest -PackageRoot $script:fixtureRoot `
            -RunId 'run-c' -OutputPath $manifestPath | Out-Null

        try {
            [IO.File]::WriteAllText(
                (Join-Path $script:fixtureRoot 'app\main.txt'),
                'beta',
                [Text.UTF8Encoding]::new($false)
            )

            {
                Test-ValidationInputManifest -PackageRoot $script:fixtureRoot `
                    -ManifestPath $manifestPath -ExpectedRunId 'run-c'
            } | Should -Throw '*Validation input aggregate mismatch*'
        }
        finally {
            [IO.File]::WriteAllText(
                (Join-Path $script:fixtureRoot 'app\main.txt'),
                'alpha',
                [Text.UTF8Encoding]::new($false)
            )
        }
    }

    It 'resolves the explicitly referenced run even when a different run has newer timestamps' {
        Import-Module -Name $script:modulePath -Force -ErrorAction Stop
        $manifestRelativePath = 'evidence/local-validation/run-a/validation-input.json'
        $manifestPath = Join-Path $script:fixtureRoot $manifestRelativePath
        $manifest = New-ValidationInputManifest -PackageRoot $script:fixtureRoot `
            -RunId 'run-a' -OutputPath $manifestPath
        $binding = [ordered]@{
            manifest = $manifestRelativePath
            aggregateAlgorithm = $manifest.aggregateAlgorithm
            aggregateSha256 = $manifest.aggregateSha256
            fileCount = $manifest.fileCount
        }
        $utf8 = [Text.UTF8Encoding]::new($false)
        $step = [ordered]@{
            schemaVersion = '1.0.0'
            stepId = 'prerequisites'
            scope = 'Prerequisites'
            status = 'PASS'
            redactedLog = 'evidence/local-validation/run-a/prerequisites.log'
            validationInput = $binding
        }
        [IO.File]::WriteAllText(
            (Join-Path $script:fixtureRoot 'evidence\local-validation\run-a\prerequisites.json'),
            ($step | ConvertTo-Json -Depth 8),
            $utf8
        )
        foreach ($record in @(
            [pscustomobject]@{
                path = 'evidence/dependency-evidence.json'
                value = [ordered]@{
                    schemaVersion = '1.0.0'
                    validationInput = $binding
                }
            },
            [pscustomobject]@{
                path = 'evidence/source-security/run-a/summary.json'
                value = [ordered]@{
                    schemaVersion = '1.0.0'
                    runId = 'run-a'
                    status = 'PASS'
                    validationInput = $binding
                }
            },
            [pscustomobject]@{
                path = 'evidence/containers/run-a/summary.json'
                value = [ordered]@{
                    schemaVersion = '1.0.0'
                    runId = 'run-a'
                    status = 'PASS'
                    validationInput = $binding
                }
            }
        )) {
            $fullPath = Join-Path $script:fixtureRoot $record.path
            New-Item -ItemType Directory -Path (Split-Path -Parent $fullPath) -Force |
                Out-Null
            [IO.File]::WriteAllText(
                $fullPath,
                ($record.value | ConvertTo-Json -Depth 8),
                $utf8
            )
        }
        $index = [ordered]@{
            schemaVersion = '1.0.0'
            runId = 'run-a'
            scope = 'All'
            status = 'PASS'
            validationInput = $binding
            evidenceReferences = [ordered]@{
                dependencyEvidence = 'evidence/dependency-evidence.json'
                sourceSecuritySummary = 'evidence/source-security/run-a/summary.json'
                containerSummary = 'evidence/containers/run-a/summary.json'
            }
            steps = @($step)
        }
        [IO.File]::WriteAllText(
            (Join-Path $script:fixtureRoot 'evidence\local-validation\run-a\index.json'),
            ($index | ConvertTo-Json -Depth 12),
            $utf8
        )

        $decoyPath = Join-Path $script:fixtureRoot 'evidence\local-validation\run-b\index.json'
        New-Item -ItemType Directory -Path (Split-Path -Parent $decoyPath) -Force |
            Out-Null
        [IO.File]::WriteAllText(
            $decoyPath,
            '{"runId":"run-b","scope":"All","status":"PASS"}',
            $utf8
        )
        (Get-Item -LiteralPath $decoyPath).LastWriteTimeUtc = (Get-Date).ToUniversalTime().AddMinutes(5)

        $resolved = Get-ValidationEvidenceSet -PackageRoot $script:fixtureRoot `
            -ValidationIndexPath 'evidence/local-validation/run-a/index.json' `
            -ExpectedRunId 'run-a'

        $resolved.runId | Should -Be 'run-a'
        $resolved.indexRelativePath |
            Should -Be 'evidence/local-validation/run-a/index.json'
        $resolved.containerSummaryRelativePath |
            Should -Be 'evidence/containers/run-a/summary.json'
        $resolved.sourceSecuritySummaryRelativePath |
            Should -Be 'evidence/source-security/run-a/summary.json'
        $resolved.validationInput.aggregateSha256 | Should -Be $manifest.aggregateSha256
    }

    It 'rejects a dependency record bound to a different validation input' {
        Import-Module -Name $script:modulePath -Force -ErrorAction Stop
        $dependencyPath = Join-Path $script:fixtureRoot 'evidence\dependency-evidence.json'
        $dependency = Get-Content -Raw -LiteralPath $dependencyPath |
            ConvertFrom-Json -Depth 20
        $originalAggregate = [string]$dependency.validationInput.aggregateSha256

        try {
            $dependency.validationInput.aggregateSha256 = '0' * 64
            [IO.File]::WriteAllText(
                $dependencyPath,
                ($dependency | ConvertTo-Json -Depth 20),
                [Text.UTF8Encoding]::new($false)
            )

            {
                Get-ValidationEvidenceSet -PackageRoot $script:fixtureRoot `
                    -ValidationIndexPath 'evidence/local-validation/run-a/index.json' `
                    -ExpectedRunId 'run-a'
            } | Should -Throw '*dependencyEvidence validation input binding mismatch*'
        }
        finally {
            $dependency.validationInput.aggregateSha256 = $originalAggregate
            [IO.File]::WriteAllText(
                $dependencyPath,
                ($dependency | ConvertTo-Json -Depth 20),
                [Text.UTF8Encoding]::new($false)
            )
        }
    }
}
