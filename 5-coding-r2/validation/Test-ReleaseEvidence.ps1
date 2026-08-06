[CmdletBinding()]
param(
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..'),
    [string]$ArtifactPrefix = 'stratton',
    [string]$WslDistribution = 'Ubuntu-26.04'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$caseRoot = Split-Path -Parent $resolvedRoot
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $caseRoot '..\..')).Path
$changeControlApprovalSchemaPath = Join-Path $repositoryRoot '.github\schemas\aff-change-control-approval.schema.json'

function Convert-ToWslPath {
    param([Parameter(Mandatory)][string]$Path)

    $match = [regex]::Match([IO.Path]::GetFullPath($Path), '^(?<drive>[A-Za-z]):\\(?<rest>.*)$')
    if (-not $match.Success) {
        throw "Unable to translate Windows path for WSL: $Path"
    }

    return "/mnt/$($match.Groups['drive'].Value.ToLowerInvariant())/$($match.Groups['rest'].Value.Replace('\', '/'))"
}

function Resolve-CaseRelativePath {
    param([Parameter(Mandatory)][string]$RelativePath)

    if ([string]::IsNullOrWhiteSpace($RelativePath) -or
        [IO.Path]::IsPathRooted($RelativePath) -or
        $RelativePath.Contains('\')) {
        throw "Authority record path is not normalized: $RelativePath"
    }
    $fullPath = [IO.Path]::GetFullPath((Join-Path $caseRoot $RelativePath))
    $casePrefix = $caseRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($casePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Authority record path escapes the case root: $RelativePath"
    }
    return $fullPath
}

function Assert-AuthorityHash {
    param([Parameter(Mandatory)][object]$Record, [Parameter(Mandatory)][string]$Name)

    $fullPath = Resolve-CaseRelativePath -RelativePath ([string]$Record.path)
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "$Name is missing: $($Record.path)"
    }
    $actual = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -cne [string]$Record.sha256) {
        throw "$Name hash mismatch: $($Record.path)"
    }
    return $fullPath
}

function Assert-HashEntries {
    param(
        [Parameter(Mandatory)]
        [object[]]$Entries,
        [Parameter(Mandatory)]
        [string]$Name
    )

    $paths = @($Entries | ForEach-Object { [string]$_.path })
    $sorted = @($paths)
    [Array]::Sort($sorted, [StringComparer]::Ordinal)
    if ([string]::Join("`n", $paths) -cne [string]::Join("`n", $sorted)) {
        throw "$Name paths are not ordinal-sorted."
    }
    if (@($paths | Group-Object | Where-Object Count -gt 1).Count -gt 0) {
        throw "$Name contains duplicate paths."
    }
    foreach ($entry in $Entries) {
        $relativePath = [string]$entry.path
        if ($relativePath.Contains('\') -or [IO.Path]::IsPathRooted($relativePath)) {
            throw "$Name contains a non-normalized path: $relativePath"
        }
        $fullPath = Join-Path $resolvedRoot $relativePath
        if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
            throw "$Name references a missing file: $relativePath"
        }
        $actual = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -cne [string]$entry.sha256) {
            throw "$Name hash mismatch: $relativePath"
        }
    }
}

$releasePath = Join-Path $resolvedRoot "$ArtifactPrefix-release-manifest.json"
$releaseJson = Get-Content -Raw -LiteralPath $releasePath
$schemaPath = Join-Path $resolvedRoot 'release\release-manifest.schema.json'
if (-not (Test-Json -Json $releaseJson -SchemaFile $schemaPath -ErrorAction Stop)) {
    throw 'Release manifest failed schema validation.'
}
$release = $releaseJson | ConvertFrom-Json -Depth 100
Assert-HashEntries -Entries @($release.files) -Name 'Release manifest'
$expectedFreezeSequence = @(
    'validation/New-BuildReport.ps1',
    'validation/New-Phase5Hashes.ps1',
    'validation/Test-ReleaseEvidence.ps1'
)
if (
    [string]$release.validation.evidenceBoundary.localValidationReleaseStep -cne
        'RELEASE_MANIFEST_ONLY' -or
    $release.validation.evidenceBoundary.finalFreezeOutsideValidationRun -ne $true -or
    [string]::Join(
        "`n",
        @($release.validation.evidenceBoundary.freezeSequence)
    ) -cne [string]::Join("`n", $expectedFreezeSequence) -or
    [string]$release.canonicalization.hashRoot -cne '5-coding-r2' -or
    [string]$release.canonicalization.canonicalManifestPath -cne
        '5-coding-r2/stratton-phase-5-hashes.json'
) {
    throw 'Release manifest does not preserve the revisioned candidate release-evidence boundary.'
}
$phase5ModelPlanPath = Assert-AuthorityHash -Record $release.upstream.phase5ModelPlan `
    -Name 'Phase 5 model plan'
$phase5ModelPlan = Get-Content -Raw -LiteralPath $phase5ModelPlanPath | ConvertFrom-Json -Depth 100
if (
    [string]$phase5ModelPlan.planRevision -cne [string]$release.upstream.modelPlanRevision -or
    [string]$phase5ModelPlan.planRevision -cne '13' -or
    [string]$phase5ModelPlan.phase5Assignment.runScopedOverrideDecision -cne 'APPROVED_IN_REVISION_12' -or
    [string]$phase5ModelPlan.phase5Assignment.finalisationActualRuntimeModelId -cne 'gpt-5.6-sol' -or
    [string]$phase5ModelPlan.revisionedCandidate.packageRoot -cne '5-coding-r2' -or
    [string]$phase5ModelPlan.revisionedCandidate.manifestPath -cne
        '5-coding-r2/stratton-phase-5-hashes.json' -or
    [string]$phase5ModelPlan.reviewAssignments.affA.requiredActualRuntimeModelId -cne 'gpt-5.5' -or
    [string]$phase5ModelPlan.reviewAssignments.affB.requiredActualRuntimeModelId -cne 'gpt-5.6-sol'
) {
    throw 'Phase 5 model plan binding is invalid.'
}
if (
    [string]$release.upstream.phase5ModelPlan.path -cne
        '0-coordination/stratton-model-plan-revision-13.json' -or
    [string]$release.upstream.phase5ModelPlan.sha256 -cne
        '9c18ca9fadea478470a2f23e7bd50a68b276b55f3fe9accdc299b82c7ad0284a'
) {
    throw 'Release manifest does not bind the approved model-plan revision 13 path and hash.'
}
if (
    ($release.source.worktreeTracked -eq $true -and
        [string]$release.source.commitScope -cne 'PACKAGE_TRACKED_IN_COMMIT') -or
    ($release.source.worktreeTracked -eq $false -and
        [string]$release.source.commitScope -cne 'FRAMEWORK_REPOSITORY_ANCHOR_ONLY_CASE_PACKAGE_HASHED_SEPARATELY')
) {
    throw 'Release manifest source commit scope does not match package tracking state.'
}
if (
    [string]$release.candidateStatus -cne 'READY_FOR_ASSURANCE' -or
    @($release.authorityConflicts).Count -ne 0 -or
    [string]$release.authorityChangeControl.status -cne 'APPROVED_FOR_PHASE5_AUTHORITY_INTERFACE_FINALISATION'
) {
    throw 'Release manifest has not cleared the approved authority change-control gate.'
}
$authorityApprovalPath = Assert-AuthorityHash -Record $release.authorityChangeControl.approval `
    -Name 'STRATTON-CC-001 approval'
$authorityApprovalJson = Get-Content -Raw -LiteralPath $authorityApprovalPath
if (-not (Test-Json -Json $authorityApprovalJson -SchemaFile $changeControlApprovalSchemaPath -ErrorAction Stop)) {
    throw 'STRATTON-CC-001 approval failed schema validation.'
}
$authorityApproval = $authorityApprovalJson | ConvertFrom-Json -Depth 100
if (
    [string]$authorityApproval.decision -cne 'APPROVED' -or
    [string]$authorityApproval.changeControlId -cne 'STRATTON-CC-001' -or
    [string]$authorityApproval.modelPlanRevision -cne [string]$release.authorityChangeControl.modelPlanRevision
) {
    throw 'STRATTON-CC-001 approval does not match the release binding.'
}
$authorityModelPlanPath = Assert-AuthorityHash -Record $release.authorityChangeControl.modelPlan `
    -Name 'Approved change-control model plan'
if (
    [string]$authorityApproval.modelPlan.path -cne
        [string]$release.authorityChangeControl.modelPlan.path -or
    [string]$authorityApproval.modelPlan.sha256 -cne
        [string]$release.authorityChangeControl.modelPlan.sha256
) {
    throw 'Release change-control model plan binding does not match the approval.'
}
$authorityModelPlan = Get-Content -Raw -LiteralPath $authorityModelPlanPath |
    ConvertFrom-Json -Depth 100
if (
    [string]$authorityModelPlan.planRevision -cne
        [string]$release.authorityChangeControl.modelPlanRevision -or
    [string]$authorityModelPlan.changeControl.changeControlId -cne 'STRATTON-CC-001'
) {
    throw 'Release change-control model plan identity is invalid.'
}
foreach ($collectionName in @('subjects', 'affAReviews', 'affBReviews')) {
    $releaseRecords = @($release.authorityChangeControl.$collectionName)
    $approvalRecords = @($authorityApproval.$collectionName)
    if ($releaseRecords.Count -ne 2 -or $approvalRecords.Count -ne 2) {
        throw "Authority $collectionName must contain exactly two phase records."
    }
    foreach ($record in $releaseRecords) {
        [void](Assert-AuthorityHash -Record $record -Name "Authority $collectionName Phase $($record.phaseId)")
        $approvalRecord = @(
            $approvalRecords |
            Where-Object {
                [string]$_.phaseId -ceq [string]$record.phaseId -and
                [string]$_.path -ceq [string]$record.path -and
                [string]$_.sha256 -ceq [string]$record.sha256
            }
        )
        if ($approvalRecord.Count -ne 1) {
            throw "Release authority $collectionName does not match the approval for Phase $($record.phaseId)."
        }
        if ($collectionName -ne 'subjects') {
            $reviewPath = Resolve-CaseRelativePath -RelativePath ([string]$record.path)
            $review = Get-Content -Raw -LiteralPath $reviewPath | ConvertFrom-Json -Depth 100
            if (
                [string]$review.verdict -notin @('CONFORMS', 'CONFORMS-WITH-GAPS') -or
                [int]$review.findingSummary.BLOCKER -ne 0 -or
                [int]$review.findingSummary.MAJOR -ne 0
            ) {
                throw "Authority review is not converged: $($record.path)"
            }
        }
    }
}
[void](Assert-AuthorityHash -Record $release.authorityChangeControl.complianceCoverage `
    -Name 'Compliance coverage 007')
if (
    [string]$authorityApproval.complianceCoverage.path -cne
        [string]$release.authorityChangeControl.complianceCoverage.path -or
    [string]$authorityApproval.complianceCoverage.sha256 -cne
        [string]$release.authorityChangeControl.complianceCoverage.sha256
) {
    throw 'Release compliance coverage binding does not match the approval.'
}

$phaseHashPath = Join-Path $resolvedRoot "$ArtifactPrefix-phase-5-hashes.json"
$phaseHash = Get-Content -Raw -LiteralPath $phaseHashPath | ConvertFrom-Json -Depth 100
Assert-HashEntries -Entries @($phaseHash.files) -Name 'Phase 5 hash set'
if (
    [string]$phaseHash.modelPlanRevision -cne [string]$release.upstream.modelPlanRevision -or
    [string]$phaseHash.modelPlan.path -cne [string]$release.upstream.phase5ModelPlan.path -or
    [string]$phaseHash.modelPlan.sha256 -cne [string]$release.upstream.phase5ModelPlan.sha256 -or
    [string]$phaseHash.canonicalization.hashRoot -cne '5-coding-r2'
) {
    throw 'Phase 5 hash set does not bind the release model plan.'
}
foreach ($entry in @($phaseHash.files)) {
    if ([string]::IsNullOrWhiteSpace([string]$entry.artifactRole)) {
        throw "Phase 5 hash entry has no artifact role: $($entry.path)"
    }
}
if ($phaseHash.fileCount -ne @($phaseHash.files).Count) {
    throw 'Phase 5 fileCount does not match the hash entry count.'
}
$phasePaths = @($phaseHash.files | ForEach-Object { [string]$_.path })
if (@($phasePaths | Where-Object { $_ -match '(^|/)(node_modules|dist|out)(/|$)' }).Count -gt 0) {
    throw 'Phase 5 hash set contains excluded build output.'
}
foreach ($requiredRootArtifact in @(
    "$ArtifactPrefix-release-manifest.json",
    "$ArtifactPrefix-build-report.md",
    "$ArtifactPrefix-build-report.html"
)) {
    if ($requiredRootArtifact -notin $phasePaths) {
        throw "Phase 5 hash set omits a required root artifact: $requiredRootArtifact"
    }
}
$unexpectedPackagePaths = @(
    $phasePaths |
    Where-Object {
        $topLevelSegment = $_.Split('/')[0]
        $topLevelSegment -notin @(
            'app',
            'infra',
            'tests',
            'validation',
            'deploy',
            'release',
            'tooling',
            'evidence'
        ) -and
        $_ -notin @(
            'README.md',
            "$ArtifactPrefix-release-manifest.json",
            "$ArtifactPrefix-build-report.md",
            "$ArtifactPrefix-build-report.html"
        )
    }
)
if ($unexpectedPackagePaths.Count -gt 0) {
    throw "Phase 5 hash set contains unexpected package-root files: $($unexpectedPackagePaths -join ', ')"
}

$latestValidationRecord = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\local-validation') `
        -Filter index.json -Recurse -File |
    ForEach-Object {
        $document = Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json -Depth 100
        if ($document.scope -eq 'All') {
            [pscustomobject]@{ file = $_; document = $document }
        }
    } |
    Sort-Object { $_.file.LastWriteTimeUtc } |
    Select-Object -Last 1
if ($null -eq $latestValidationRecord -or $latestValidationRecord.document.status -ne 'PASS') {
    throw 'Latest full local validation evidence is absent or not PASS.'
}
$requiredEvidence = [Collections.Generic.List[string]]::new()
$latestValidationRelativePath = [IO.Path]::GetRelativePath(
    $resolvedRoot,
    $latestValidationRecord.file.FullName
).Replace('\', '/')
if ([string]$release.validation.evidence -cne $latestValidationRelativePath) {
    throw 'Release manifest does not reference the latest full PASS validation index.'
}
$requiredEvidence.Add($latestValidationRelativePath)
foreach ($step in $latestValidationRecord.document.steps) {
    if ($step.status -ne 'PASS') {
        throw "Latest full validation has a non-PASS step: $($step.stepId)"
    }
    if ($step.PSObject.Properties['redactedLog']) {
        $requiredEvidence.Add([string]$step.redactedLog)
        $requiredEvidence.Add([IO.Path]::ChangeExtension([string]$step.redactedLog, '.json'))
    }
}
$containerSummaryPath = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\containers') `
        -Filter summary.json -Recurse -File |
    Sort-Object LastWriteTimeUtc |
    Select-Object -Last 1
if ($null -eq $containerSummaryPath) {
    throw 'Container summary evidence is missing.'
}
$containerSummary = Get-Content -Raw -LiteralPath $containerSummaryPath.FullName | ConvertFrom-Json -Depth 100
if ($containerSummary.status -ne 'PASS') {
    throw 'Latest container summary is not PASS.'
}
$containerNames = @($containerSummary.images | ForEach-Object { [string]$_.name } | Sort-Object)
if ([string]::Join(',', $containerNames) -cne 'api,worker') {
    throw 'Container evidence must contain exactly the API and worker images.'
}
foreach ($image in $containerSummary.images) {
    if (
        [string]$image.platform -cne 'linux/amd64' -or
        [int]$image.highVulnerabilities -ne 0 -or
        [int]$image.criticalVulnerabilities -ne 0 -or
        [int]$image.secretFindings -ne 0
    ) {
        throw "Container evidence does not satisfy the release gate: $($image.name)"
    }
    $releaseImage = @($release.images | Where-Object { $_.name -ceq $image.name })
    if (
        $releaseImage.Count -ne 1 -or
        [string]$releaseImage[0].digest -cne [string]$image.digest -or
        [string]$releaseImage[0].platform -cne [string]$image.platform -or
        [string]$releaseImage[0].sbom -cne [string]$image.sbom -or
        [string]$releaseImage[0].scan -cne [string]$image.scan
    ) {
        throw "Release manifest image binding does not match container evidence: $($image.name)"
    }
}
if (
    $containerSummary.signing.identityBacked -ne $false -or
    $containerSummary.signing.transparencyLogUploaded -ne $false
) {
    throw 'Container signing evidence does not preserve the declared local-only boundary.'
}
foreach ($property in @(
    'method',
    'identityBacked',
    'transparencyLogUploaded',
    'statement',
    'signature',
    'publicKey',
    'limitation'
)) {
    if ([string]$release.signing.$property -cne [string]$containerSummary.signing.$property) {
        throw "Release manifest signing binding does not match container evidence: $property"
    }
}
$digestStatementPath = Join-Path $resolvedRoot ([string]$containerSummary.signing.statement)
$digestStatement = Get-Content -Raw -LiteralPath $digestStatementPath | ConvertFrom-Json -Depth 20
foreach ($image in $containerSummary.images) {
    $statementImage = @($digestStatement.images | Where-Object { $_.name -ceq $image.name })
    if (
        $statementImage.Count -ne 1 -or
        [string]$statementImage[0].digest -cne [string]$image.digest -or
        [string]$statementImage[0].platform -cne [string]$image.platform
    ) {
        throw "Signed digest statement does not match container evidence: $($image.name)"
    }
}
$signatureVerification = @(
    & wsl -d $WslDistribution -u root -- cosign verify-blob `
        --insecure-ignore-tlog `
        --key (Convert-ToWslPath -Path (Join-Path $resolvedRoot ([string]$containerSummary.signing.publicKey))) `
        --signature (Convert-ToWslPath -Path (Join-Path $resolvedRoot ([string]$containerSummary.signing.signature))) `
        (Convert-ToWslPath -Path $digestStatementPath) 2>&1
)
$signatureExitCode = $LASTEXITCODE
$signatureVerification = @($signatureVerification | ForEach-Object { $_.ToString().Trim() })
if ($signatureExitCode -ne 0 -or $signatureVerification -notcontains 'Verified OK') {
    throw "Container digest signature verification failed: $($signatureVerification -join ' | ')"
}
$containerSummaryRelativePath = [IO.Path]::GetRelativePath(
    $resolvedRoot,
    $containerSummaryPath.FullName
).Replace('\', '/')
if ([string]$release.dependencyEvidence.containerSummary -cne $containerSummaryRelativePath) {
    throw 'Release manifest does not reference the latest PASS container summary.'
}
$requiredEvidence.Add($containerSummaryRelativePath)
foreach ($image in $containerSummary.images) {
    $requiredEvidence.Add([string]$image.sbom)
    $requiredEvidence.Add([string]$image.scan)
}
$requiredEvidence.Add([string]$containerSummary.signing.statement)
$requiredEvidence.Add([string]$containerSummary.signing.signature)
$requiredEvidence.Add([string]$containerSummary.signing.publicKey)
$requiredEvidence.Add([string]$containerSummary.baseImage.evidence)
$requiredEvidence.Add([string]$containerSummary.scannerDatabase)

$sourceSecuritySummaryPath = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\source-security') `
        -Filter summary.json -Recurse -File |
    Sort-Object LastWriteTimeUtc |
    Select-Object -Last 1
if ($null -eq $sourceSecuritySummaryPath) {
    throw 'Source-security summary evidence is missing.'
}
$sourceSecuritySummary = Get-Content -Raw -LiteralPath $sourceSecuritySummaryPath.FullName |
    ConvertFrom-Json -Depth 100
if ($sourceSecuritySummary.status -ne 'PASS') {
    throw 'Latest source-security summary is not PASS.'
}
if (
    [int]$sourceSecuritySummary.highVulnerabilities -ne 0 -or
    [int]$sourceSecuritySummary.criticalVulnerabilities -ne 0 -or
    [int]$sourceSecuritySummary.highMisconfigurations -ne 0 -or
    [int]$sourceSecuritySummary.criticalMisconfigurations -ne 0 -or
    [int]$sourceSecuritySummary.secretFindings -ne 0
) {
    throw 'Source-security evidence does not satisfy the release gate.'
}
$sourceSecuritySummaryRelativePath = [IO.Path]::GetRelativePath(
    $resolvedRoot,
    $sourceSecuritySummaryPath.FullName
).Replace('\', '/')
if ([string]$release.dependencyEvidence.sourceSecuritySummary -cne $sourceSecuritySummaryRelativePath) {
    throw 'Release manifest does not reference the latest PASS source-security summary.'
}
$requiredEvidence.Add($sourceSecuritySummaryRelativePath)
$requiredEvidence.Add([string]$sourceSecuritySummary.scan)
$requiredEvidence.Add([string]$sourceSecuritySummary.scannerDatabase)
$requiredEvidence.Add('evidence/README.md')
$requiredEvidence.Add('evidence/dependency-evidence.json')
foreach ($requiredPath in $requiredEvidence) {
    if ($requiredPath -notin $phasePaths) {
        throw "Required evidence is absent from the Phase 5 hash set: $requiredPath"
    }
}
$unexpectedEvidence = @(
    $phasePaths |
    Where-Object {
        $_ -match '^evidence/' -and
        $_ -notin $requiredEvidence
    }
)
if ($unexpectedEvidence.Count -gt 0) {
    throw "Phase 5 hash set contains unreferenced historical evidence: $($unexpectedEvidence -join ', ')"
}

$bytes = [IO.File]::ReadAllBytes($phaseHashPath)
if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    throw 'Phase 5 hash set contains a UTF-8 BOM.'
}
if ($bytes.Length -gt 0 -and $bytes[-1] -in 0x0A, 0x0D) {
    throw 'Phase 5 hash set has a trailing newline.'
}

Write-Host 'Release evidence is canonical and recomputes successfully.'
