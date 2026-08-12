Describe 'Phase 5 candidate operational references' {
    BeforeAll {
        $script:packageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
        $script:candidateName = Split-Path -Leaf $script:packageRoot
        $script:revision = [regex]::Match($script:candidateName, '^5-coding-(r\d+)$').Groups[1].Value

        $script:rootReadme = Get-Content -Raw -LiteralPath (
            Join-Path $script:packageRoot 'README.md'
        )
        $script:deployReadme = Get-Content -Raw -LiteralPath (
            Join-Path $script:packageRoot 'deploy\README.md'
        )
        $script:iacReadme = Get-Content -Raw -LiteralPath (
            Join-Path $script:packageRoot 'tests\iac\README.md'
        )
    }

    It 'identifies the current candidate in package and approval guidance' {
        $script:revision | Should -Not -BeNullOrEmpty
        $script:rootReadme |
            Should -Match "This $([regex]::Escape($script:revision)) package is an AFF-5 candidate"
        $script:deployReadme |
            Should -Match "exact $([regex]::Escape($script:revision)) Phase 5 hash manifest"
    }

    It 'targets the current candidate in executable guidance' {
        $rootOperational = (
            $script:rootReadme -split "\r?\n" |
                Where-Object {
                    $_ -notmatch 'reviewed `5-coding-r\d+`' -and
                    $_ -notmatch 'remain byte-for-byte frozen'
                }
        ) -join "`n"
        $operationalGuides = @($rootOperational, $script:deployReadme, $script:iacReadme)

        foreach ($guide in $operationalGuides) {
            $candidatePaths = @(
                [regex]::Matches($guide, '5-coding-r\d+') |
                    ForEach-Object { $_.Value } |
                    Sort-Object -Unique
            )
            $candidatePaths | Should -Be @($script:candidateName)
        }
    }
}
