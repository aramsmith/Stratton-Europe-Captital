[CmdletBinding()]
param(
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..'),
    [string]$ArtifactPrefix = 'stratton'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$outputPath = Join-Path $resolvedRoot "$ArtifactPrefix-phase-5-hashes.json"

function Get-NormalizedRelativePath {
    param([Parameter(Mandatory)][string]$FullName)
    return [IO.Path]::GetRelativePath($resolvedRoot, $FullName).Replace('\', '/')
}

function Get-ArtifactRole {
    param([Parameter(Mandatory)][string]$RelativePath)

    switch -Regex ($RelativePath) {
        '^README\.md$' { return 'PACKAGE_DOCUMENTATION' }
        "^$([regex]::Escape($ArtifactPrefix))-release-manifest\.json$" { return 'RELEASE_MANIFEST' }
        "^$([regex]::Escape($ArtifactPrefix))-build-report\.md$" { return 'PHASE_REPORT_MARKDOWN' }
        "^$([regex]::Escape($ArtifactPrefix))-build-report\.html$" { return 'PHASE_REPORT_HTML' }
        '^app/' { return 'APPLICATION_SOURCE' }
        '^infra/' { return 'INFRASTRUCTURE_AS_CODE' }
        '^tests/' { return 'TEST_SOURCE' }
        '^validation/' { return 'VALIDATION_TOOLING' }
        '^deploy/' { return 'DEPLOYMENT_PROCEDURE' }
        '^release/' { return 'RELEASE_SCHEMA' }
        '^tooling/' { return 'TOOLCHAIN_LOCK' }
        '^evidence/' { return 'VALIDATION_EVIDENCE' }
        default { throw "No artifact role is defined for Phase 5 path: $RelativePath" }
    }
}

$requiredOutputs = @(
    "$ArtifactPrefix-release-manifest.json",
    "$ArtifactPrefix-build-report.md",
    "$ArtifactPrefix-build-report.html"
)
$missing = $requiredOutputs |
    Where-Object { -not (Test-Path -LiteralPath (Join-Path $resolvedRoot $_) -PathType Leaf) }
if ($missing) {
    throw "Phase 5 hash generation requires final outputs: $($missing -join ', ')"
}

$latestValidationRecord = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\local-validation') `
        -Filter index.json -Recurse -File -ErrorAction SilentlyContinue |
    ForEach-Object {
        $document = Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json -Depth 100
        if ($document.scope -eq 'All') {
            [pscustomobject]@{
                file = $_
                document = $document
            }
        }
    } |
    Sort-Object { $_.file.LastWriteTimeUtc } |
    Select-Object -Last 1
if ($null -eq $latestValidationRecord -or $latestValidationRecord.document.status -ne 'PASS') {
    throw 'The latest full local validation run is absent or not PASS.'
}

$latestContainerRecord = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\containers') `
        -Filter summary.json -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc |
    Select-Object -Last 1
if ($null -eq $latestContainerRecord) {
    throw 'Container summary evidence is missing.'
}
$containerSummary = Get-Content -Raw -LiteralPath $latestContainerRecord.FullName | ConvertFrom-Json -Depth 100
if ($containerSummary.status -ne 'PASS') {
    throw 'The latest container summary is not PASS.'
}

$requiredEvidencePaths = [Collections.Generic.List[string]]::new()
$requiredEvidencePaths.Add((Get-NormalizedRelativePath -FullName $latestValidationRecord.file.FullName))
foreach ($step in $latestValidationRecord.document.steps) {
    if ($step.status -ne 'PASS') {
        throw "Full validation contains a non-PASS step: $($step.stepId)"
    }
    if ($step.PSObject.Properties['redactedLog']) {
        $requiredEvidencePaths.Add([string]$step.redactedLog)
        $recordPath = [IO.Path]::ChangeExtension([string]$step.redactedLog, '.json')
        $requiredEvidencePaths.Add($recordPath)
    }
}
$requiredEvidencePaths.Add((Get-NormalizedRelativePath -FullName $latestContainerRecord.FullName))
foreach ($image in $containerSummary.images) {
    $requiredEvidencePaths.Add([string]$image.sbom)
    $requiredEvidencePaths.Add([string]$image.scan)
}
$requiredEvidencePaths.Add([string]$containerSummary.signing.statement)
$requiredEvidencePaths.Add([string]$containerSummary.signing.signature)
$requiredEvidencePaths.Add([string]$containerSummary.signing.publicKey)
$requiredEvidencePaths.Add([string]$containerSummary.baseImage.evidence)
$requiredEvidencePaths.Add([string]$containerSummary.scannerDatabase)

$latestSourceSecurityRecord = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\source-security') `
        -Filter summary.json -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc |
    Select-Object -Last 1
if ($null -eq $latestSourceSecurityRecord) {
    throw 'Source-security summary evidence is missing.'
}
$sourceSecuritySummary = Get-Content -Raw -LiteralPath $latestSourceSecurityRecord.FullName |
    ConvertFrom-Json -Depth 100
if ($sourceSecuritySummary.status -ne 'PASS') {
    throw 'The latest source-security summary is not PASS.'
}
$requiredEvidencePaths.Add((Get-NormalizedRelativePath -FullName $latestSourceSecurityRecord.FullName))
$requiredEvidencePaths.Add([string]$sourceSecuritySummary.scan)
$requiredEvidencePaths.Add([string]$sourceSecuritySummary.scannerDatabase)
$requiredEvidencePaths.Add('evidence/README.md')
$requiredEvidencePaths.Add('evidence/dependency-evidence.json')
foreach ($requiredEvidencePath in $requiredEvidencePaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot $requiredEvidencePath) -PathType Leaf)) {
        throw "Required Phase 5 evidence is missing: $requiredEvidencePath"
    }
}

$releaseManifestPath = Join-Path $resolvedRoot "$ArtifactPrefix-release-manifest.json"
$releaseManifest = Get-Content -Raw -LiteralPath $releaseManifestPath | ConvertFrom-Json -Depth 100
$latestValidationRelativePath = Get-NormalizedRelativePath -FullName $latestValidationRecord.file.FullName
$latestContainerRelativePath = Get-NormalizedRelativePath -FullName $latestContainerRecord.FullName
$latestSourceSecurityRelativePath = Get-NormalizedRelativePath -FullName $latestSourceSecurityRecord.FullName
if ([string]$releaseManifest.validation.evidence -cne $latestValidationRelativePath) {
    throw 'Release manifest does not reference the latest full PASS validation index.'
}
if ([string]$releaseManifest.dependencyEvidence.containerSummary -cne $latestContainerRelativePath) {
    throw 'Release manifest does not reference the latest PASS container summary.'
}
if ([string]$releaseManifest.dependencyEvidence.sourceSecuritySummary -cne $latestSourceSecurityRelativePath) {
    throw 'Release manifest does not reference the latest PASS source-security summary.'
}
if (
    [int]$releaseManifest.upstream.modelPlanRevision -ne 13 -or
    [string]$releaseManifest.upstream.phase5ModelPlan.path -cne
        '0-coordination/stratton-model-plan-revision-13.json' -or
    [string]$releaseManifest.upstream.phase5ModelPlan.sha256 -cne
        '9c18ca9fadea478470a2f23e7bd50a68b276b55f3fe9accdc299b82c7ad0284a' -or
    [string]$releaseManifest.canonicalization.hashRoot -cne '5-coding-r2' -or
    [string]$releaseManifest.canonicalization.canonicalManifestPath -cne
        '5-coding-r2/stratton-phase-5-hashes.json'
) {
    throw 'Release manifest does not bind revisioned Phase 5 candidate model-plan revision 13.'
}

$relativePaths = @(
    Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File |
        ForEach-Object {
            $relativePath = Get-NormalizedRelativePath -FullName $_.FullName
            $topLevelSegment = $relativePath.Split('/')[0]
            $isPackageSource = $topLevelSegment -in @(
                'app',
                'infra',
                'tests',
                'validation',
                'deploy',
                'release',
                'tooling'
            )
            $isRequiredRootArtifact = $relativePath -in @(
                'README.md',
                "$ArtifactPrefix-release-manifest.json",
                "$ArtifactPrefix-build-report.md",
                "$ArtifactPrefix-build-report.html"
            )
            $isRequiredEvidence = (
                $relativePath -match '^evidence/' -and
                $requiredEvidencePaths.Contains($relativePath)
            )
            if (
                $relativePath -ne "$ArtifactPrefix-phase-5-hashes.json" -and
                $relativePath -notmatch '(^|/)(node_modules|dist|out)(/|$)' -and
                ($isPackageSource -or $isRequiredRootArtifact -or $isRequiredEvidence)
            ) {
                $relativePath
            }
        }
)
[Array]::Sort($relativePaths, [StringComparer]::Ordinal)
foreach ($requiredEvidencePath in $requiredEvidencePaths) {
    if ($requiredEvidencePath -notin $relativePaths) {
        throw "Required evidence would be omitted from the Phase 5 hash set: $requiredEvidencePath"
    }
}

$files = @(
    foreach ($relativePath in $relativePaths) {
        [ordered]@{
            path = $relativePath
            sha256 = (Get-FileHash -LiteralPath (Join-Path $resolvedRoot $relativePath) -Algorithm SHA256).Hash.ToLowerInvariant()
            artifactRole = Get-ArtifactRole -RelativePath $relativePath
        }
    }
)
$document = [ordered]@{
    schemaVersion = '1.0.0'
    artifactPrefix = $ArtifactPrefix
    phase = 5
    modelPlanRevision = [string]$releaseManifest.upstream.modelPlanRevision
    modelPlan = [ordered]@{
        path = [string]$releaseManifest.upstream.phase5ModelPlan.path
        sha256 = [string]$releaseManifest.upstream.phase5ModelPlan.sha256
    }
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    canonicalization = [ordered]@{
        hashRoot = '5-coding-r2'
        pathSeparator = '/'
        sort = 'ordinal'
        encoding = 'UTF-8 without BOM'
        trailingNewline = $false
        exclusions = @(
            "$ArtifactPrefix-phase-5-hashes.json",
            'node_modules',
            'dist',
            'out',
            'unreferenced historical evidence'
        )
    }
    fileCount = $files.Count
    files = $files
}
$json = $document | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText(
    [IO.Path]::GetFullPath($outputPath),
    $json,
    [Text.UTF8Encoding]::new($false)
)
Write-Host "Phase 5 hashes written: $outputPath"
