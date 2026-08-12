[CmdletBinding()]
param(
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..'),
    [string]$ArtifactPrefix = 'stratton'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$outputPath = Join-Path $resolvedRoot "$ArtifactPrefix-phase-5-hashes.json"
$validationEvidenceModule = Join-Path $resolvedRoot 'validation\ValidationEvidence.psm1'
Import-Module -Name $validationEvidenceModule -Force -ErrorAction Stop

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

$releaseManifestPath = Join-Path $resolvedRoot "$ArtifactPrefix-release-manifest.json"
$releaseManifest = Get-Content -Raw -LiteralPath $releaseManifestPath | ConvertFrom-Json -Depth 100
$evidenceSet = Get-ValidationEvidenceSet -PackageRoot $resolvedRoot `
    -ValidationIndexPath ([string]$releaseManifest.validation.evidence) `
    -ExpectedRunId ([string]$releaseManifest.validation.runId)
$latestValidationRecord = [pscustomobject]@{
    file = Get-Item -LiteralPath $evidenceSet.indexFullPath
    document = $evidenceSet.index
}
$latestContainerRecord = Get-Item -LiteralPath (
    Join-Path $resolvedRoot $evidenceSet.containerSummaryRelativePath
)
$containerSummary = $evidenceSet.containerSummary

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

$latestSourceSecurityRecord = Get-Item -LiteralPath (
    Join-Path $resolvedRoot $evidenceSet.sourceSecuritySummaryRelativePath
)
$sourceSecuritySummary = $evidenceSet.sourceSecuritySummary
$requiredEvidencePaths.Add((Get-NormalizedRelativePath -FullName $latestSourceSecurityRecord.FullName))
$requiredEvidencePaths.Add([string]$sourceSecuritySummary.scan)
$requiredEvidencePaths.Add([string]$sourceSecuritySummary.scannerDatabase)
$requiredEvidencePaths.Add([string]$evidenceSet.validationInput.manifest)
$requiredEvidencePaths.Add('evidence/README.md')
$requiredEvidencePaths.Add('evidence/dependency-evidence.json')
$requiredEvidencePaths.Add('evidence/model-portfolio/model-portfolio-benchmark-template.json')
$requiredEvidencePaths.Add('evidence/model-portfolio/stratton-r4-to-r5-sibling-migration.json')
$requiredEvidencePaths.Add('evidence/model-portfolio/stratton-r5-to-r6-evidence-binding-remediation.json')
$requiredEvidencePaths.Add('evidence/model-portfolio/stratton-r6-to-r7-operational-reference-remediation.json')
foreach ($requiredEvidencePath in $requiredEvidencePaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot $requiredEvidencePath) -PathType Leaf)) {
        throw "Required Phase 5 evidence is missing: $requiredEvidencePath"
    }
}

$latestValidationRelativePath = Get-NormalizedRelativePath -FullName $latestValidationRecord.file.FullName
$latestContainerRelativePath = Get-NormalizedRelativePath -FullName $latestContainerRecord.FullName
$latestSourceSecurityRelativePath = Get-NormalizedRelativePath -FullName $latestSourceSecurityRecord.FullName
if ([string]$releaseManifest.validation.evidence -cne $latestValidationRelativePath) {
    throw 'Release manifest does not reference the exact full PASS validation index.'
}
if ([string]$releaseManifest.dependencyEvidence.containerSummary -cne $latestContainerRelativePath) {
    throw 'Release manifest does not reference the exact PASS container summary.'
}
if ([string]$releaseManifest.dependencyEvidence.sourceSecuritySummary -cne $latestSourceSecurityRelativePath) {
    throw 'Release manifest does not reference the exact PASS source-security summary.'
}
if (
    [string]$releaseManifest.validation.input.aggregateSha256 -cne
        [string]$evidenceSet.validationInput.aggregateSha256 -or
    [string]$releaseManifest.dependencyEvidence.validationInput.aggregateSha256 -cne
        [string]$evidenceSet.validationInput.aggregateSha256
) {
    throw 'Release manifest validation input binding does not match the frozen package input.'
}
if (
    [int]$releaseManifest.upstream.modelPlanRevision -ne 111 -or
    [string]$releaseManifest.upstream.phase5ModelPlan.path -cne
        '0-coordination/stratton-model-plan-revision-111.json' -or
    [string]$releaseManifest.upstream.phase5ModelPlan.sha256 -cne
        '64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7' -or
    [string]$releaseManifest.canonicalization.hashRoot -cne '5-coding-r7' -or
    [string]$releaseManifest.canonicalization.canonicalManifestPath -cne
        '5-coding-r7/stratton-phase-5-hashes.json'
) {
    throw 'Release manifest does not bind the CC-002 Phase 5 r7 candidate and model-plan revision 111.'
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
        hashRoot = '5-coding-r7'
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
