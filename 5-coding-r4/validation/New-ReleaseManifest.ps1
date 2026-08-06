[CmdletBinding()]
param(
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..'),
    [string]$ArtifactPrefix = 'stratton',
    [string]$ValidationRunId,
    [string]$Phase5ModelPlanRevision = '15'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$caseRoot = Split-Path -Parent $resolvedRoot
$repositoryRoot = (Resolve-Path -LiteralPath (Join-Path $caseRoot '..\..')).Path
$manifestPath = Join-Path $resolvedRoot "$ArtifactPrefix-release-manifest.json"
$schemaPath = Join-Path $resolvedRoot 'release\release-manifest.schema.json'
$changeControlApprovalSchemaPath = Join-Path $repositoryRoot '.github\schemas\aff-change-control-approval.schema.json'

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    [IO.File]::WriteAllText(
        [IO.Path]::GetFullPath($Path),
        $Content,
        [Text.UTF8Encoding]::new($false)
    )
}

function Get-NormalizedRelativePath {
    param([Parameter(Mandatory)][string]$FullName)
    return [IO.Path]::GetRelativePath($resolvedRoot, $FullName).Replace('\', '/')
}

function Resolve-CaseRelativePath {
    param([Parameter(Mandatory)][string]$RelativePath)

    if ([string]::IsNullOrWhiteSpace($RelativePath) -or
        [IO.Path]::IsPathRooted($RelativePath) -or
        $RelativePath.Contains('\')) {
        throw "Change-control record path is not normalized: $RelativePath"
    }
    $fullPath = [IO.Path]::GetFullPath((Join-Path $caseRoot $RelativePath))
    $casePrefix = $caseRoot.TrimEnd('\') + '\'
    if (-not $fullPath.StartsWith($casePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Change-control record path escapes the case root: $RelativePath"
    }
    return $fullPath
}

function Assert-HashedCaseRecord {
    param(
        [Parameter(Mandatory)][object]$Record,
        [Parameter(Mandatory)][string]$ExpectedPath,
        [Parameter(Mandatory)][string]$RecordName
    )

    if ([string]$Record.path -cne $ExpectedPath) {
        throw "$RecordName path mismatch. Expected $ExpectedPath."
    }
    $fullPath = Resolve-CaseRelativePath -RelativePath ([string]$Record.path)
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
        throw "$RecordName is missing: $($Record.path)"
    }
    $actualSha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha256 -cne [string]$Record.sha256) {
        throw "$RecordName hash mismatch: $($Record.path)"
    }
    return [pscustomobject]@{
        path = [string]$Record.path
        sha256 = $actualSha256
        fullPath = $fullPath
    }
}

function Get-PhaseRecord {
    param(
        [Parameter(Mandatory)][object[]]$Records,
        [Parameter(Mandatory)][string]$PhaseId,
        [Parameter(Mandatory)][string]$RecordName
    )

    $record = @($Records | Where-Object { [string]$_.phaseId -ceq $PhaseId })
    if ($record.Count -ne 1) {
        throw "$RecordName must contain exactly one Phase $PhaseId record."
    }
    return $record[0]
}

function Assert-FormalReview {
    param(
        [Parameter(Mandatory)][object]$ApprovalRecord,
        [Parameter(Mandatory)][string]$ExpectedPath,
        [Parameter(Mandatory)][string]$Reviewer,
        [Parameter(Mandatory)][string]$PhaseId,
        [Parameter(Mandatory)][int]$Round,
        [Parameter(Mandatory)][string]$SubjectSha256
    )

    $verified = Assert-HashedCaseRecord -Record $ApprovalRecord -ExpectedPath $ExpectedPath `
        -RecordName "$Reviewer Phase $PhaseId review"
    if ([int]$ApprovalRecord.round -ne $Round) {
        throw "$Reviewer Phase $PhaseId review round mismatch."
    }
    $review = Get-Content -Raw -LiteralPath $verified.fullPath | ConvertFrom-Json -Depth 100
    if (
        [string]$review.verdict -notin @('CONFORMS', 'CONFORMS-WITH-GAPS') -or
        [int]$review.findingSummary.BLOCKER -ne 0 -or
        [int]$review.findingSummary.MAJOR -ne 0
    ) {
        throw "$Reviewer Phase $PhaseId review has a blocking verdict or finding."
    }
    if ([string]$ApprovalRecord.verdict -cne [string]$review.verdict) {
        throw "$Reviewer Phase $PhaseId approval binding has a verdict mismatch."
    }
    $subject = if ($Reviewer -ceq 'AFF-A') {
        $review.canonicalProposedManifest
    }
    else {
        $review.canonicalSubject
    }
    if ([string]$subject.computedSha256 -cne $SubjectSha256) {
        throw "$Reviewer Phase $PhaseId review does not bind the approved subject."
    }
    return [ordered]@{
        phaseId = $PhaseId
        round = $Round
        verdict = [string]$review.verdict
        path = [string]$verified.path
        sha256 = [string]$verified.sha256
    }
}

function Test-IsBuildOutput {
    param([Parameter(Mandatory)][string]$RelativePath)
    return $RelativePath -match '(^|/)(node_modules|dist|out)(/|$)'
}

$excludedRootFiles = @(
    "$ArtifactPrefix-release-manifest.json",
    "$ArtifactPrefix-phase-5-hashes.json",
    "$ArtifactPrefix-build-report.md",
    "$ArtifactPrefix-build-report.html"
)
$deployableRoots = @('app', 'infra', 'tests', 'validation', 'deploy', 'tooling', 'release')
$relativePaths = @(
    foreach ($directory in $deployableRoots) {
        $root = Join-Path $resolvedRoot $directory
        if (-not (Test-Path -LiteralPath $root -PathType Container)) {
            continue
        }
        foreach ($file in Get-ChildItem -LiteralPath $root -Recurse -File) {
            $relativePath = Get-NormalizedRelativePath -FullName $file.FullName
            if (-not (Test-IsBuildOutput -RelativePath $relativePath) -and
                $relativePath -notin $excludedRootFiles) {
                $relativePath
            }
        }
    }
    'README.md'
)
[Array]::Sort($relativePaths, [StringComparer]::Ordinal)

$files = @(
    foreach ($relativePath in $relativePaths) {
        $fullPath = Join-Path $resolvedRoot $relativePath
        [ordered]@{
            path = $relativePath
            sha256 = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash.ToLowerInvariant()
            sizeBytes = (Get-Item -LiteralPath $fullPath).Length
        }
    }
)

$validationFiles = @(
    Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\local-validation') `
        -Filter index.json -Recurse -File -ErrorAction SilentlyContinue
)
if ([string]::IsNullOrWhiteSpace($ValidationRunId)) {
    $latestValidationRecord = $validationFiles |
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
}
else {
    $expectedIndexPath = Join-Path $resolvedRoot "evidence\local-validation\$ValidationRunId\index.json"
    if (Test-Path -LiteralPath $expectedIndexPath -PathType Leaf) {
        $file = Get-Item -LiteralPath $expectedIndexPath
        $latestValidationRecord = [pscustomobject]@{
            file = $file
            document = Get-Content -Raw -LiteralPath $file.FullName | ConvertFrom-Json -Depth 100
        }
    }
}
if ($null -eq $latestValidationRecord) {
    throw 'No full local validation index exists.'
}
$latestValidationIndex = $latestValidationRecord.file
$validation = $latestValidationRecord.document
if ($validation.scope -ne 'All' -or $validation.status -ne 'PASS') {
    throw "The selected full local validation run is not PASS: $($validation.runId)"
}
$expectedFreezeSequence = @(
    'validation/New-BuildReport.ps1',
    'validation/New-Phase5Hashes.ps1',
    'validation/Test-ReleaseEvidence.ps1'
)
if (
    [string]$validation.releaseEvidenceBoundary.localValidationReleaseStep -cne
        'RELEASE_MANIFEST_ONLY' -or
    $validation.releaseEvidenceBoundary.finalFreezeOutsideValidationRun -ne $true -or
    [string]::Join(
        "`n",
        @($validation.releaseEvidenceBoundary.freezeSequence)
    ) -cne [string]::Join("`n", $expectedFreezeSequence)
) {
    throw 'Full validation evidence does not preserve the release-manifest-only boundary and external freeze sequence.'
}
$requiredValidationSteps = @(
    'prerequisites',
    'iac-validation',
    'module-digest-evidence',
    'package-integrity',
    'source-security-scan',
    'database-validation',
    'application-dependencies',
    'application-validation',
    'container-validation'
)
foreach ($stepId in $requiredValidationSteps) {
    $step = @($validation.steps | Where-Object { $_.stepId -eq $stepId })
    if ($step.Count -ne 1 -or $step[0].status -ne 'PASS') {
        throw "Required validation step is absent or not PASS: $stepId"
    }
}

$latestContainerSummary = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\containers') `
        -Filter summary.json -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc |
    Select-Object -Last 1
if ($null -eq $latestContainerSummary) {
    throw 'No container validation summary exists.'
}
$containerSummary = Get-Content -Raw -LiteralPath $latestContainerSummary.FullName | ConvertFrom-Json -Depth 100
if ($containerSummary.status -ne 'PASS') {
    throw 'The latest container validation did not pass.'
}
$imageNames = @($containerSummary.images | ForEach-Object { [string]$_.name } | Sort-Object)
if ([string]::Join(',', $imageNames) -cne 'api,worker') {
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
    foreach ($evidencePath in @($image.sbom, $image.scan)) {
        if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot $evidencePath) -PathType Leaf)) {
            throw "Container evidence referenced by the summary is missing: $evidencePath"
        }
    }
}
foreach ($signingPath in @(
    $containerSummary.signing.statement,
    $containerSummary.signing.signature,
    $containerSummary.signing.publicKey
)) {
    if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot $signingPath) -PathType Leaf)) {
        throw "Signing evidence referenced by the summary is missing: $signingPath"
    }
}
if (
    $containerSummary.signing.identityBacked -ne $false -or
    $containerSummary.signing.transparencyLogUploaded -ne $false
) {
    throw 'Phase 5 container evidence must use the declared local-only, non-transparency-log signing boundary.'
}
if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot $containerSummary.baseImage.evidence) -PathType Leaf)) {
    throw "Base-image evidence referenced by the summary is missing: $($containerSummary.baseImage.evidence)"
}
if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot $containerSummary.scannerDatabase) -PathType Leaf)) {
    throw "Scanner database evidence referenced by the summary is missing: $($containerSummary.scannerDatabase)"
}

$latestSourceSecuritySummary = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\source-security') `
        -Filter summary.json -Recurse -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc |
    Select-Object -Last 1
if ($null -eq $latestSourceSecuritySummary) {
    throw 'No source-security summary exists.'
}
$sourceSecuritySummary = Get-Content -Raw -LiteralPath $latestSourceSecuritySummary.FullName |
    ConvertFrom-Json -Depth 100
if ($sourceSecuritySummary.status -ne 'PASS') {
    throw 'The latest source-security scan did not pass.'
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
foreach ($sourceSecurityPath in @($sourceSecuritySummary.scan, $sourceSecuritySummary.scannerDatabase)) {
    if (-not (Test-Path -LiteralPath (Join-Path $resolvedRoot $sourceSecurityPath) -PathType Leaf)) {
        throw "Source-security evidence referenced by the summary is missing: $sourceSecurityPath"
    }
}

$phase5ModelPlanRelativePath = "0-coordination/stratton-model-plan-revision-$Phase5ModelPlanRevision.json"
$phase5ModelPlanPath = Resolve-CaseRelativePath -RelativePath $phase5ModelPlanRelativePath
if (-not (Test-Path -LiteralPath $phase5ModelPlanPath -PathType Leaf)) {
    throw "Phase 5 model plan is missing: $phase5ModelPlanRelativePath"
}
$phase5ModelPlan = Get-Content -Raw -LiteralPath $phase5ModelPlanPath | ConvertFrom-Json -Depth 100
if (
    [string]$phase5ModelPlan.planRevision -cne $Phase5ModelPlanRevision -or
    [string]$phase5ModelPlan.phase5Assignment.agent -cne 'AFF-5' -or
    [string]$phase5ModelPlan.phase5Assignment.runScopedOverrideDecision -cne 'APPROVED_IN_REVISION_12' -or
    [string]$phase5ModelPlan.phase5Assignment.finalisationActualRuntimeModelId -cne 'gpt-5.6-sol' -or
    [string]$phase5ModelPlan.revisionedCandidate.packageRoot -cne '5-coding-r4' -or
    [string]$phase5ModelPlan.revisionedCandidate.manifestPath -cne
        '5-coding-r4/stratton-phase-5-hashes.json' -or
    [string]$phase5ModelPlan.reviewAssignments.affA.requiredActualRuntimeModelId -cne 'gpt-5.5' -or
    [string]$phase5ModelPlan.reviewAssignments.affB.requiredActualRuntimeModelId -cne 'gpt-5.6-sol'
) {
    throw 'Phase 5 model plan does not contain the approved finalisation and reviewer bindings.'
}
$phase5ModelPlanSha256 = (Get-FileHash -LiteralPath $phase5ModelPlanPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($phase5ModelPlanSha256 -cne '7ce3ff77d47384ceaf3e0515b3350578831b5a2fedfcbeba4e586399dc9f6fb4') {
    throw 'Phase 5 model-plan revision 15 hash mismatch.'
}

$approvalRelativePath = 'approvals/change-control/stratton-cc-001-approval-1.json'
$approvalPath = Resolve-CaseRelativePath -RelativePath $approvalRelativePath
if (-not (Test-Path -LiteralPath $approvalPath -PathType Leaf)) {
    throw "STRATTON-CC-001 explicit human approval is required before Phase 5 release finalisation: $approvalRelativePath"
}
$approvalJson = Get-Content -Raw -LiteralPath $approvalPath
if (-not (Test-Json -Json $approvalJson -SchemaFile $changeControlApprovalSchemaPath -ErrorAction Stop)) {
    throw 'STRATTON-CC-001 approval failed schema validation.'
}
$approval = $approvalJson | ConvertFrom-Json -Depth 100
if (
    [string]$approval.changeControlId -cne 'STRATTON-CC-001' -or
    [string]$approval.caseName -cne 'Stratton-Europe-Captital' -or
    [string]$approval.artifactPrefix -cne $ArtifactPrefix -or
    [string]$approval.decision -cne 'APPROVED'
) {
    throw 'STRATTON-CC-001 approval identity or decision is invalid.'
}
$approvalModelPlan = Assert-HashedCaseRecord -Record $approval.modelPlan `
    -ExpectedPath "0-coordination/stratton-model-plan-revision-$($approval.modelPlanRevision).json" `
    -RecordName 'Approved change-control model plan'
$approvalModelPlanDocument = Get-Content -Raw -LiteralPath $approvalModelPlan.fullPath |
    ConvertFrom-Json -Depth 100
if (
    [string]$approvalModelPlanDocument.planRevision -cne [string]$approval.modelPlanRevision -or
    [string]$approvalModelPlanDocument.changeControl.changeControlId -cne 'STRATTON-CC-001'
) {
    throw 'Approved change-control model plan identity is invalid.'
}

$phase3ApprovalSubject = Get-PhaseRecord -Records @($approval.subjects) -PhaseId '3' `
    -RecordName 'Change-control subjects'
$phase4ApprovalSubject = Get-PhaseRecord -Records @($approval.subjects) -PhaseId '4' `
    -RecordName 'Change-control subjects'
$phase3Subject = Assert-HashedCaseRecord -Record $phase3ApprovalSubject `
    -ExpectedPath '3-azure-design/stratton-phase-3-hashes-cc-001-r2-proposed.json' `
    -RecordName 'Approved Phase 3 amendment subject'
$phase4Subject = Assert-HashedCaseRecord -Record $phase4ApprovalSubject `
    -ExpectedPath '4-implementation-plan/stratton-phase-4-hashes-cc-001-r3-proposed.json' `
    -RecordName 'Approved Phase 4 amendment subject'

$affAPhase3Approval = Get-PhaseRecord -Records @($approval.affAReviews) -PhaseId '3' `
    -RecordName 'AFF-A approvals'
$affAPhase4Approval = Get-PhaseRecord -Records @($approval.affAReviews) -PhaseId '4' `
    -RecordName 'AFF-A approvals'
$affBPhase3Approval = Get-PhaseRecord -Records @($approval.affBReviews) -PhaseId '3' `
    -RecordName 'AFF-B approvals'
$affBPhase4Approval = Get-PhaseRecord -Records @($approval.affBReviews) -PhaseId '4' `
    -RecordName 'AFF-B approvals'
$affAReviews = @(
    Assert-FormalReview -ApprovalRecord $affAPhase3Approval `
        -ExpectedPath 'reviews/aff-a/3/round-5/stratton-aff-a-review.json' `
        -Reviewer 'AFF-A' -PhaseId '3' -Round 5 -SubjectSha256 $phase3Subject.sha256
    Assert-FormalReview -ApprovalRecord $affAPhase4Approval `
        -ExpectedPath 'reviews/aff-a/4/round-6/stratton-aff-a-review.json' `
        -Reviewer 'AFF-A' -PhaseId '4' -Round 6 -SubjectSha256 $phase4Subject.sha256
)
$affBReviews = @(
    Assert-FormalReview -ApprovalRecord $affBPhase3Approval `
        -ExpectedPath 'reviews/aff-b/3/round-4/stratton-aff-b-review.json' `
        -Reviewer 'AFF-B' -PhaseId '3' -Round 4 -SubjectSha256 $phase3Subject.sha256
    Assert-FormalReview -ApprovalRecord $affBPhase4Approval `
        -ExpectedPath 'reviews/aff-b/4/round-3/stratton-aff-b-review.json' `
        -Reviewer 'AFF-B' -PhaseId '4' -Round 3 -SubjectSha256 $phase4Subject.sha256
)

$coverage = Assert-HashedCaseRecord -Record $approval.complianceCoverage `
    -ExpectedPath 'reviews/aff-b/coverage/stratton-compliance-coverage-007.json' `
    -RecordName 'Compliance coverage 007'
$coverageDocument = Get-Content -Raw -LiteralPath $coverage.fullPath | ConvertFrom-Json -Depth 100
if ([string]$coverageDocument.coverageSequence -cne '007') {
    throw 'Compliance coverage sequence is not 007.'
}
foreach ($phaseBinding in @(
    [pscustomobject]@{
        phaseId = '3'
        subjectSha256 = [string]$phase3Subject.sha256
        affASha256 = [string]$affAReviews[0].sha256
        affBSha256 = [string]$affBReviews[0].sha256
    },
    [pscustomobject]@{
        phaseId = '4'
        subjectSha256 = [string]$phase4Subject.sha256
        affASha256 = [string]$affAReviews[1].sha256
        affBSha256 = [string]$affBReviews[1].sha256
    }
)) {
    $coverageBinding = @(
        $coverageDocument.canonicalSubjectBindings |
        Where-Object { [string]$_.phaseId -ceq $phaseBinding.phaseId }
    )
    if (
        $coverageBinding.Count -ne 1 -or
        [string]$coverageBinding[0].manifestSha256 -cne $phaseBinding.subjectSha256 -or
        [string]$coverageBinding[0].finalAffASha256 -cne $phaseBinding.affASha256
    ) {
        throw "Coverage 007 does not bind the final Phase $($phaseBinding.phaseId) subject and AFF-A review."
    }
    $affBPath = Resolve-CaseRelativePath -RelativePath (
        @($affBReviews | Where-Object { $_.phaseId -ceq $phaseBinding.phaseId })[0].path
    )
    $affBDocument = Get-Content -Raw -LiteralPath $affBPath | ConvertFrom-Json -Depth 100
    $affBFinalAffASha256 = if ($affBDocument.finalAffARecord.PSObject.Properties['sha256']) {
        [string]$affBDocument.finalAffARecord.sha256
    }
    else {
        [string]$affBDocument.finalAffARecord.computedSha256
    }
    if (
        [string]$affBDocument.activeCoverage.sha256 -cne [string]$coverage.sha256 -or
        $affBFinalAffASha256 -cne $phaseBinding.affASha256
    ) {
        throw "AFF-B Phase $($phaseBinding.phaseId) does not bind coverage 007 and the final AFF-A review."
    }
}
$approvalSha256 = (Get-FileHash -LiteralPath $approvalPath -Algorithm SHA256).Hash.ToLowerInvariant()
$authorityChangeControl = [ordered]@{
    changeControlId = 'STRATTON-CC-001'
    status = 'APPROVED_FOR_PHASE5_AUTHORITY_INTERFACE_FINALISATION'
    modelPlanRevision = [string]$approval.modelPlanRevision
    modelPlan = [ordered]@{
        path = [string]$approvalModelPlan.path
        sha256 = [string]$approvalModelPlan.sha256
    }
    approval = [ordered]@{
        path = $approvalRelativePath
        sha256 = $approvalSha256
    }
    subjects = @(
        [ordered]@{
            phaseId = '3'
            path = [string]$phase3Subject.path
            sha256 = [string]$phase3Subject.sha256
        },
        [ordered]@{
            phaseId = '4'
            path = [string]$phase4Subject.path
            sha256 = [string]$phase4Subject.sha256
        }
    )
    affAReviews = $affAReviews
    affBReviews = $affBReviews
    complianceCoverage = [ordered]@{
        path = [string]$coverage.path
        sha256 = [string]$coverage.sha256
    }
}

$sourceCommitOutput = @(& git -C $resolvedRoot rev-parse HEAD 2>&1)
if ($LASTEXITCODE -ne 0) {
    throw 'Unable to resolve the source commit.'
}
$sourceCommit = ($sourceCommitOutput | Select-Object -Last 1).ToString().Trim()
$worktreeStatus = @(& git -C $resolvedRoot --no-pager status --short --untracked-files=all --ignored=matching -- .)
& git -C $resolvedRoot check-ignore --quiet -- $resolvedRoot
$worktreeTracked = $LASTEXITCODE -ne 0

$authorityConflicts = @(
    'Assurance verdict issuance is not deployable in DU-12',
    'Analysis execution interface remains authority-blocked',
    'Audit evidence export interface remains authority-blocked'
)
$authorityConflictNotePath = Join-Path $resolvedRoot 'app\authority-boundary-conflict-note.md'
$authorityConflictNote = Get-Content -Raw -LiteralPath $authorityConflictNotePath
foreach ($authorityConflict in $authorityConflicts) {
    if ($authorityConflictNote -notmatch [regex]::Escape($authorityConflict)) {
        throw "Authority conflict note does not contain the required disclosure: $authorityConflict"
    }
}
$ownerBoundResidualControls = @(
    'VAL-001',
    'VAL-002',
    'VAL-003',
    'VAL-004',
    'VAL-005',
    'AFFB-RES-001',
    'AFFB-RES-002',
    'CC1-OWN-001',
    'CC1-OWN-002',
    'CC1-OWN-003',
    'CC1-OWN-004',
    'CC1-OWN-005',
    'CC1-OWN-006',
    'CC1-OWN-007'
)
$retainedMinorGaps = @(
    'AFFB-CC001-R2-MIN-001',
    'AFFB-CC001-R3-MIN-002'
)

$manifest = [ordered]@{
    schemaVersion = '1.0.0'
    artifactPrefix = $ArtifactPrefix
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    phase = 5
    candidateStatus = 'READY_FOR_ASSURANCE'
    deploymentReady = $false
    upstream = [ordered]@{
        phase4ManifestSha256 = '87ff470043fce913e6dd3e2121430072552443ae5cacaaa1454cb8396a9265c4'
        phase4ApprovalId = 'STRATTON-PHASE-4-APPROVAL-001'
        modelPlanRevision = [int]$Phase5ModelPlanRevision
        phase5ModelPlan = [ordered]@{
            path = $phase5ModelPlanRelativePath
            sha256 = $phase5ModelPlanSha256
        }
    }
    source = [ordered]@{
        commit = $sourceCommit
        commitScope = if ($worktreeTracked) {
            'PACKAGE_TRACKED_IN_COMMIT'
        }
        else {
            'FRAMEWORK_REPOSITORY_ANCHOR_ONLY_CASE_PACKAGE_HASHED_SEPARATELY'
        }
        worktreeTracked = $worktreeTracked
        worktreeDirty = -not $worktreeTracked -or $worktreeStatus.Count -gt 0
        worktreeStatus = @($worktreeStatus)
    }
    environments = @('dev', 'tst', 'prd')
    deploymentUnits = @(1..17 | ForEach-Object { 'DU-{0:d2}' -f $_ })
    validation = [ordered]@{
        status = $validation.status
        runId = $validation.runId
        evidence = Get-NormalizedRelativePath -FullName $latestValidationIndex.FullName
        evidenceBoundary = $validation.releaseEvidenceBoundary
    }
    images = @($containerSummary.images | ForEach-Object {
        [ordered]@{
            name = $_.name
            digest = $_.digest
            platform = $_.platform
            sbom = $_.sbom
            scan = $_.scan
        }
    })
    signing = $containerSummary.signing
    dependencyEvidence = [ordered]@{
        avmModuleDigests = 'evidence/dependency-evidence.json'
        toolVersions = 'tooling/tool-versions.json'
        containerSummary = Get-NormalizedRelativePath -FullName $latestContainerSummary.FullName
        baseImage = $containerSummary.baseImage
        scannerDatabase = $containerSummary.scannerDatabase
        sourceSecuritySummary = Get-NormalizedRelativePath -FullName $latestSourceSecuritySummary.FullName
        sourceSecurityScan = $sourceSecuritySummary.scan
        sourceSecurityDatabase = $sourceSecuritySummary.scannerDatabase
    }
    authorityChangeControl = $authorityChangeControl
    unresolvedControls = $ownerBoundResidualControls
    retainedMinorGaps = $retainedMinorGaps
    authorityConflicts = $authorityConflicts
    azureExecution = [ordered]@{
        authenticated = $false
        validateExecuted = $false
        whatIfExecuted = $false
        deploymentExecuted = $false
    }
    canonicalization = [ordered]@{
        hashRoot = '5-coding-r4'
        canonicalManifestPath = '5-coding-r4/stratton-phase-5-hashes.json'
        pathSeparator = '/'
        sort = 'ordinal'
        encoding = 'UTF-8 without BOM'
        trailingNewline = $false
        excluded = @('node_modules', 'dist', 'out', 'generated release outputs')
    }
    files = $files
}

$json = $manifest | ConvertTo-Json -Depth 16 -Compress
if (-not (Test-Json -Json $json -SchemaFile $schemaPath -ErrorAction Stop)) {
    throw 'Release manifest failed schema validation.'
}
Write-Utf8NoBom -Path $manifestPath -Content $json
Write-Host "Release manifest written: $manifestPath"
