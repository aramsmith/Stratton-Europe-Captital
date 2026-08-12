Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-NormalizedRelativePath {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$FullName
    )

    return [IO.Path]::GetRelativePath($Root, $FullName).Replace('\', '/')
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][AllowEmptyString()][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    [IO.File]::WriteAllText(
        [IO.Path]::GetFullPath($Path),
        $Content,
        [Text.UTF8Encoding]::new($false)
    )
}

function Get-ValidationInputFiles {
    param([Parameter(Mandatory)][string]$PackageRoot)

    $resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
    $relativePaths = [Collections.Generic.List[string]]::new()
    foreach ($directory in @('app', 'infra', 'tests', 'validation', 'deploy', 'tooling', 'release')) {
        $directoryPath = Join-Path $resolvedRoot $directory
        if (-not (Test-Path -LiteralPath $directoryPath -PathType Container)) {
            continue
        }
        foreach ($file in Get-ChildItem -LiteralPath $directoryPath -Recurse -File) {
            $relativePath = Get-NormalizedRelativePath -Root $resolvedRoot -FullName $file.FullName
            if ($relativePath -notmatch '(^|/)(node_modules|dist|out)(/|$)') {
                $relativePaths.Add($relativePath)
            }
        }
    }
    if (Test-Path -LiteralPath (Join-Path $resolvedRoot 'README.md') -PathType Leaf) {
        $relativePaths.Add('README.md')
    }

    $paths = $relativePaths.ToArray()
    [Array]::Sort($paths, [StringComparer]::Ordinal)
    return $paths
}

function Get-ValidationInputDocument {
    param(
        [Parameter(Mandatory)][string]$PackageRoot,
        [Parameter(Mandatory)][string]$RunId
    )

    $resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
    $files = @(
        foreach ($relativePath in Get-ValidationInputFiles -PackageRoot $resolvedRoot) {
            $fullPath = Join-Path $resolvedRoot $relativePath
            [ordered]@{
                path = $relativePath
                sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
                sizeBytes = (Get-Item -LiteralPath $fullPath).Length
            }
        }
    )

    $canonical = (
        $files |
        ForEach-Object { "$($_.path)`t$($_.sha256)`t$($_.sizeBytes)`n" }
    ) -join ''
    $aggregateSha256 = [Convert]::ToHexString(
        [Security.Cryptography.SHA256]::HashData(
            [Text.UTF8Encoding]::new($false).GetBytes($canonical)
        )
    ).ToLowerInvariant()

    $document = [ordered]@{
        schemaVersion = '1.0.0'
        recordType = 'PHASE5_VALIDATION_INPUT_MANIFEST'
        runId = $RunId
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        packageRoot = '<PACKAGE_ROOT>'
        aggregateAlgorithm = 'SHA256_UTF8_PATH_TAB_SHA256_TAB_SIZE_LF_V1'
        aggregateSha256 = $aggregateSha256
        fileCount = $files.Count
        files = $files
    }
    return $document
}

function New-ValidationInputManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PackageRoot,
        [Parameter(Mandatory)][string]$RunId,
        [Parameter(Mandatory)][string]$OutputPath
    )

    $document = Get-ValidationInputDocument -PackageRoot $PackageRoot -RunId $RunId
    Write-Utf8NoBom -Path $OutputPath -Content ($document | ConvertTo-Json -Depth 8)
    return [pscustomobject]$document
}

function Test-ValidationInputManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PackageRoot,
        [Parameter(Mandatory)][string]$ManifestPath,
        [Parameter(Mandatory)][string]$ExpectedRunId
    )

    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        throw "Validation input manifest is missing: $ManifestPath"
    }
    $recorded = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json -Depth 100
    if (
        [string]$recorded.recordType -cne 'PHASE5_VALIDATION_INPUT_MANIFEST' -or
        [string]$recorded.runId -cne $ExpectedRunId -or
        [string]$recorded.aggregateAlgorithm -cne
            'SHA256_UTF8_PATH_TAB_SHA256_TAB_SIZE_LF_V1'
    ) {
        throw 'Validation input manifest identity or algorithm is invalid.'
    }

    $current = Get-ValidationInputDocument -PackageRoot $PackageRoot -RunId $ExpectedRunId
    if ([string]$recorded.aggregateSha256 -cne [string]$current.aggregateSha256) {
        throw (
            'Validation input aggregate mismatch. Expected {0}, observed {1}.' -f
            $recorded.aggregateSha256,
            $current.aggregateSha256
        )
    }
    if (
        [int]$recorded.fileCount -ne [int]$current.fileCount -or
        @($recorded.files).Count -ne @($current.files).Count
    ) {
        throw 'Validation input file count mismatch.'
    }
    for ($index = 0; $index -lt @($current.files).Count; $index++) {
        $expected = $recorded.files[$index]
        $actual = $current.files[$index]
        if (
            [string]$expected.path -cne [string]$actual.path -or
            [string]$expected.sha256 -cne [string]$actual.sha256 -or
            [long]$expected.sizeBytes -ne [long]$actual.sizeBytes
        ) {
            throw "Validation input file binding mismatch: $($actual.path)"
        }
    }
    return [pscustomobject]@{
        runId = [string]$recorded.runId
        manifestPath = [IO.Path]::GetFullPath($ManifestPath)
        aggregateAlgorithm = [string]$recorded.aggregateAlgorithm
        aggregateSha256 = [string]$recorded.aggregateSha256
        fileCount = [int]$recorded.fileCount
    }
}

function Resolve-PackageRelativePath {
    param(
        [Parameter(Mandatory)][string]$PackageRoot,
        [Parameter(Mandatory)][string]$RelativePath
    )

    if (
        [string]::IsNullOrWhiteSpace($RelativePath) -or
        [IO.Path]::IsPathRooted($RelativePath) -or
        $RelativePath.Contains('\') -or
        $RelativePath -match '(^|/)\.\.(/|$)'
    ) {
        throw "Validation evidence path is not normalized: $RelativePath"
    }
    $resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
    $fullPath = [IO.Path]::GetFullPath((Join-Path $resolvedRoot $RelativePath))
    $rootPrefix = $resolvedRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Validation evidence path escapes the package root: $RelativePath"
    }
    return $fullPath
}

function Assert-ValidationInputBinding {
    param(
        [Parameter(Mandatory)][object]$Actual,
        [Parameter(Mandatory)][object]$Expected,
        [Parameter(Mandatory)][string]$RecordName
    )

    if (
        [string]$Actual.manifest -cne [string]$Expected.manifest -or
        [string]$Actual.aggregateAlgorithm -cne [string]$Expected.aggregateAlgorithm -or
        [string]$Actual.aggregateSha256 -cne [string]$Expected.aggregateSha256 -or
        [int]$Actual.fileCount -ne [int]$Expected.fileCount
    ) {
        throw "$RecordName validation input binding mismatch."
    }
}

function Get-ValidationEvidenceSet {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$PackageRoot,
        [Parameter(Mandatory)][string]$ValidationIndexPath,
        [Parameter(Mandatory)][string]$ExpectedRunId
    )

    $expectedIndexPath = "evidence/local-validation/$ExpectedRunId/index.json"
    if ([string]$ValidationIndexPath -cne $expectedIndexPath) {
        throw "Validation index path does not match run ID $ExpectedRunId."
    }
    $indexFullPath = Resolve-PackageRelativePath -PackageRoot $PackageRoot `
        -RelativePath $ValidationIndexPath
    if (-not (Test-Path -LiteralPath $indexFullPath -PathType Leaf)) {
        throw "Validation index is missing: $ValidationIndexPath"
    }
    $index = Get-Content -Raw -LiteralPath $indexFullPath | ConvertFrom-Json -Depth 100
    if (
        [string]$index.runId -cne $ExpectedRunId -or
        [string]$index.scope -cne 'All' -or
        [string]$index.status -cne 'PASS'
    ) {
        throw "Validation index identity or status is invalid: $ValidationIndexPath"
    }

    $manifestRelativePath = "evidence/local-validation/$ExpectedRunId/validation-input.json"
    $manifestFullPath = Resolve-PackageRelativePath -PackageRoot $PackageRoot `
        -RelativePath $manifestRelativePath
    $verifiedInput = Test-ValidationInputManifest -PackageRoot $PackageRoot `
        -ManifestPath $manifestFullPath -ExpectedRunId $ExpectedRunId
    $expectedBinding = [pscustomobject]@{
        manifest = $manifestRelativePath
        aggregateAlgorithm = [string]$verifiedInput.aggregateAlgorithm
        aggregateSha256 = [string]$verifiedInput.aggregateSha256
        fileCount = [int]$verifiedInput.fileCount
    }
    Assert-ValidationInputBinding -Actual $index.validationInput -Expected $expectedBinding `
        -RecordName 'Validation index'

    foreach ($step in @($index.steps)) {
        if ([string]$step.status -cne 'PASS') {
            throw "Validation step is not PASS: $($step.stepId)"
        }
        Assert-ValidationInputBinding -Actual $step.validationInput -Expected $expectedBinding `
            -RecordName "Validation index step $($step.stepId)"
        if ($step.PSObject.Properties['redactedLog']) {
            $stepRecordRelativePath = [IO.Path]::ChangeExtension(
                [string]$step.redactedLog,
                '.json'
            ).Replace('\', '/')
            $stepRecordFullPath = Resolve-PackageRelativePath -PackageRoot $PackageRoot `
                -RelativePath $stepRecordRelativePath
            if (-not (Test-Path -LiteralPath $stepRecordFullPath -PathType Leaf)) {
                throw "Validation step record is missing: $stepRecordRelativePath"
            }
            $stepRecord = Get-Content -Raw -LiteralPath $stepRecordFullPath |
                ConvertFrom-Json -Depth 100
            Assert-ValidationInputBinding -Actual $stepRecord.validationInput `
                -Expected $expectedBinding -RecordName "Validation step record $($step.stepId)"
        }
    }

    $referenceNames = @(
        'dependencyEvidence',
        'sourceSecuritySummary',
        'containerSummary'
    )
    $records = @{}
    foreach ($referenceName in $referenceNames) {
        $relativePath = [string]$index.evidenceReferences.$referenceName
        $fullPath = Resolve-PackageRelativePath -PackageRoot $PackageRoot `
            -RelativePath $relativePath
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            throw "Referenced validation evidence is missing: $relativePath"
        }
        $record = Get-Content -Raw -LiteralPath $fullPath | ConvertFrom-Json -Depth 100
        Assert-ValidationInputBinding -Actual $record.validationInput -Expected $expectedBinding `
            -RecordName $referenceName
        if (
            $referenceName -ne 'dependencyEvidence' -and
            (
                [string]$record.runId -cne $ExpectedRunId -or
                [string]$record.status -cne 'PASS'
            )
        ) {
            throw "$referenceName identity or status is invalid."
        }
        $records[$referenceName] = [pscustomobject]@{
            relativePath = $relativePath
            fullPath = $fullPath
            document = $record
        }
    }

    return [pscustomobject]@{
        runId = $ExpectedRunId
        indexRelativePath = $ValidationIndexPath
        indexFullPath = $indexFullPath
        index = $index
        validationInput = $expectedBinding
        validationInputManifestFullPath = $manifestFullPath
        dependencyEvidenceRelativePath = $records.dependencyEvidence.relativePath
        dependencyEvidence = $records.dependencyEvidence.document
        containerSummaryRelativePath = $records.containerSummary.relativePath
        containerSummary = $records.containerSummary.document
        sourceSecuritySummaryRelativePath = $records.sourceSecuritySummary.relativePath
        sourceSecuritySummary = $records.sourceSecuritySummary.document
    }
}

Export-ModuleMember -Function @(
    'New-ValidationInputManifest',
    'Test-ValidationInputManifest',
    'Get-ValidationEvidenceSet'
)
