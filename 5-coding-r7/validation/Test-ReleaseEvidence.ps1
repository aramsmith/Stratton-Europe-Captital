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
$validationEvidenceModule = Join-Path $resolvedRoot 'validation\ValidationEvidence.psm1'
Import-Module -Name $validationEvidenceModule -Force -ErrorAction Stop

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
foreach ($azureBoundaryField in @(
    'authenticated',
    'subscriptionProviderAliasQueryExecuted',
    'validateExecuted',
    'whatIfExecuted',
    'deploymentExecuted',
    'inferenceExecuted',
    'promotionExecuted',
    'retentionFinalizationExecuted',
    'azureNetworkCallExecuted',
    'azureRuntimeTestExecuted'
)) {
    if ($release.azureExecution.$azureBoundaryField -ne $false) {
        throw "Release evidence records prohibited Azure activity: $azureBoundaryField"
    }
}
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
    [string]$release.canonicalization.hashRoot -cne '5-coding-r7' -or
    [string]$release.canonicalization.canonicalManifestPath -cne
        '5-coding-r7/stratton-phase-5-hashes.json'
) {
    throw 'Release manifest does not preserve the revisioned candidate release-evidence boundary.'
}
$phase5ModelPlanPath = Assert-AuthorityHash -Record $release.upstream.phase5ModelPlan `
    -Name 'Phase 5 model plan'
$phase5ModelPlan = Get-Content -Raw -LiteralPath $phase5ModelPlanPath | ConvertFrom-Json -Depth 100
if (
    [string]$phase5ModelPlan.planRevision -cne [string]$release.upstream.modelPlanRevision -or
    [string]$phase5ModelPlan.planRevision -cne '111' -or
    [string]$phase5ModelPlan.caseName -cne 'Stratton-Europe-Captital' -or
    [string]$phase5ModelPlan.artifactPrefix -cne $ArtifactPrefix
) {
    throw 'Active model-plan revision 111 binding is invalid.'
}
if (
    [string]$release.upstream.phase5ModelPlan.path -cne
        '0-coordination/stratton-model-plan-revision-111.json' -or
    [string]$release.upstream.phase5ModelPlan.sha256 -cne
        '64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7'
) {
    throw 'Release manifest does not bind active model-plan revision 111 path and hash.'
}
if (
    ($release.source.worktreeTracked -eq $true -and
        [string]$release.source.commitScope -cne 'PACKAGE_TRACKED_IN_COMMIT') -or
    ($release.source.worktreeTracked -eq $false -and
        [string]$release.source.commitScope -cne 'FRAMEWORK_REPOSITORY_ANCHOR_ONLY_CASE_PACKAGE_HASHED_SEPARATELY')
) {
    throw 'Release manifest source commit scope does not match package tracking state.'
}
$expectedAuthorityConflicts = @(
    'Assurance verdict issuance is not deployable in DU-12',
    'Analysis execution interface remains authority-blocked',
    'Audit evidence export interface remains authority-blocked'
)
$expectedOwnerBoundResidualControls = @(
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
$expectedRetainedMinorGaps = @(
    'AFFB-CC001-R2-MIN-001',
    'AFFB-CC001-R3-MIN-002'
)
$expectedCurrentOwnerBoundGaps = @(
    'Exact Azure region pair, resources and deployment IDs remain REQUIRED_OWNER_INPUT.',
    'Regional model capability and quota evidence, positive capacities and live policy-alias verification remain REQUIRED_OWNER_INPUT.',
    'Embedding version, dimensions, chunking parameters and index-rebuild evidence remain REQUIRED_OWNER_INPUT.',
    'Recovery, failover and security-gate operating evidence remains absent and owner-bound.',
    'Provider terms, licences, source permissions and time-sensitive official-source evidence remain owner-bound.',
    'Retention, legal hold, privacy lifecycle and deletion evidence remains owner-bound and fail closed.',
    'GDPR detail, EU AI Act role/use-case classification and DORA applicability require accountable-human confirmation.',
    'Observed benchmark latency, representative-case, pack-time, token and cost evidence remains absent.',
    'Production inference and benchmark promotion require later explicit authority and remain blocked.'
)
if (
    [string]$release.candidateStatus -cne 'READY_FOR_ASSURANCE' -or
    [string]::Join("`n", @($release.authorityConflicts)) -cne
        [string]::Join("`n", $expectedAuthorityConflicts) -or
    [string]::Join("`n", @($release.unresolvedControls)) -cne
        [string]::Join("`n", $expectedOwnerBoundResidualControls) -or
    [string]::Join("`n", @($release.retainedMinorGaps)) -cne
        [string]::Join("`n", $expectedRetainedMinorGaps) -or
    [string]::Join("`n", @($release.currentOwnerBoundGaps)) -cne
        [string]::Join("`n", $expectedCurrentOwnerBoundGaps) -or
    [string]$release.authorityChangeControl.status -cne
        'APPROVED_FOR_PHASE5_AUTHORITY_INTERFACE_FINALISATION' -or
    [string]$release.implementationReceipt.agent -cne 'AFF-5' -or
    [string]$release.implementationReceipt.authorModel -cne 'gpt-5.6-sol' -or
    [string]$release.implementationReceipt.recordType -cne 'IMPLEMENTATION_AUTHOR_RECEIPT' -or
    $release.implementationReceipt.approval -ne $false -or
    $release.modelPortfolioControls.callerCanSelectDeploymentOrModel -ne $false -or
    [string]$release.modelPortfolioControls.allowedSku -cne 'DataZoneStandard' -or
    [string]$release.modelPortfolioControls.rejectedSku -cne 'GlobalStandard' -or
    [string]$release.modelPortfolioControls.modelVersion -cne '2026-07-09' -or
    [string]$release.modelPortfolioControls.versionUpgradeOption -cne 'NoAutoUpgrade' -or
    [string]$release.modelPortfolioControls.routing -cne
        'DETERMINISTIC_APPLICATION_OWNED_FAIL_CLOSED' -or
    [string]$release.modelPortfolioControls.productionInference -cne 'BLOCKED' -or
    [string]$release.modelPortfolioControls.benchmarkPromotion -cne
        'BLOCKED_PENDING_OBSERVED_EVIDENCE' -or
    [string]$release.modelPortfolioControls.benchmarkObservations -cne
        'NULL_TEMPLATE_VALUES_ONLY' -or
    [string]$release.modelPortfolioControls.autonomousDecisionAuthority -cne 'NONE'
) {
    throw 'Release manifest does not faithfully disclose authority, model-portfolio and owner-bound controls.'
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

$modelPortfolio = $release.modelPortfolioChangeControl
if (
    [string]$modelPortfolio.changeControlId -cne 'STRATTON-CC-002' -or
    [string]$modelPortfolio.status -cne
        'CANDIDATE_AWAITING_AFF_A_AFF_B_AND_HUMAN_APPROVAL' -or
    [string]$modelPortfolio.supersessionScope -cne
        'CC002_MODEL_PORTFOLIO_PHASE5_SIBLING_ONLY_CC001_AUTHORITY_CONTROLS_RETAINED' -or
    [string]$modelPortfolio.candidate.packageRoot -cne '5-coding-r7' -or
    [string]$modelPortfolio.candidate.canonicalManifestPath -cne
        '5-coding-r7/stratton-phase-5-hashes.json' -or
    [string]$modelPortfolio.candidate.authorModel -cne 'gpt-5.6-sol' -or
    $modelPortfolio.candidate.approvalClaimed -ne $false -or
    [string]$modelPortfolio.supersededApprovedPhase5Baseline.status -cne
        'SUPERSEDED_FOR_CC002_MODEL_PORTFOLIO_CANDIDATE_ONLY' -or
    [string]$modelPortfolio.supersededReviewedPhase5Candidate.status -cne
        'SUPERSEDED_BY_R7_OPERATIONAL_REFERENCE_REMEDIATION' -or
    [string]$modelPortfolio.supersededReviewedPhase5Candidate.openFinding -cne
        'AFFA-P5-R6-MAJ-001'
) {
    throw 'STRATTON-CC-002 sibling-candidate identity or truthful non-approval status is invalid.'
}

$expectedModelPortfolioBindings = @(
    [pscustomobject]@{
        name = 'Active model plan revision 111'
        record = $modelPortfolio.modelPlan
        path = '0-coordination/stratton-model-plan-revision-111.json'
        sha256 = '64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7'
    },
    [pscustomobject]@{
        name = 'Active STRATTON-CC-002 approval sequence 2'
        record = $modelPortfolio.changeControlApproval
        path = 'approvals/change-control/stratton-cc-002-approval-2.json'
        sha256 = 'fa8f8ccea8d044cc253fceb54adb74727cf9852fbf73325e45633bc362d04117'
    },
    [pscustomobject]@{
        name = 'Active Phase 3 CC-002 approval sequence 2'
        record = $modelPortfolio.phase3Approval
        path = 'approvals/3/stratton-phase-3-cc-002-approval-2.json'
        sha256 = 'c0d51c1e2478371c452f068361ca857b2afeb49f295dd2fd5880c58e895a96a5'
    },
    [pscustomobject]@{
        name = 'Active Phase 3 CC-002 subject'
        record = $modelPortfolio.phase3Subject
        path = '3-azure-design/stratton-phase-3-hashes-cc-002-r2-proposed.json'
        sha256 = '357368d1820d252d19daf65cc0910df5aa5b594ab1d59f92bf7951913918661e'
    },
    [pscustomobject]@{
        name = 'Active Phase 4 CC-002 approval sequence 1'
        record = $modelPortfolio.phase4Approval
        path = 'approvals/4/stratton-phase-4-cc-002-approval-1.json'
        sha256 = '71d6b0c306ddff4f58b5b29868ac2ec895d554609e6243a4d95b8e910b14b373'
    },
    [pscustomobject]@{
        name = 'Active Phase 4 CC-002 subject'
        record = $modelPortfolio.phase4Subject
        path = '4-implementation-plan/stratton-phase-4-hashes-cc-002-r4-proposed.json'
        sha256 = '5ab254e33ee9460c56026809071a3315b5fce7de887e99c65bf6d100a0140c0b'
    },
    [pscustomobject]@{
        name = 'Superseded approved Phase 5 r4 manifest'
        record = $modelPortfolio.supersededApprovedPhase5Baseline.manifest
        path = '5-coding-r4/stratton-phase-5-hashes.json'
        sha256 = 'bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626'
    },
    [pscustomobject]@{
        name = 'Approved Phase 5 r4 approval'
        record = $modelPortfolio.supersededApprovedPhase5Baseline.approval
        path = 'approvals/5/stratton-phase-5-approval-1.json'
        sha256 = 'f39fbd68d4574f77e7d31d5fb7608739a1e472fa808fc91b14969009a27b1cd4'
    },
    [pscustomobject]@{
        name = 'Reviewed Phase 5 r6 manifest'
        record = $modelPortfolio.supersededReviewedPhase5Candidate.manifest
        path = '5-coding-r6/stratton-phase-5-hashes.json'
        sha256 = 'da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33'
    },
    [pscustomobject]@{
        name = 'AFF-A Phase 5 r6 round-6 review'
        record = $modelPortfolio.supersededReviewedPhase5Candidate.affAReview
        path = 'reviews/aff-a/5/round-6/stratton-aff-a-review.json'
        sha256 = '0198a83f90c2690db1e175c6f4e31aeb8bcefb22309a6e6960c24ce29e3b828f'
    },
    [pscustomobject]@{
        name = 'AFF-B Phase 5 r6 round-4 review'
        record = $modelPortfolio.supersededReviewedPhase5Candidate.affBReview
        path = 'reviews/aff-b/5/round-4/stratton-aff-b-review.json'
        sha256 = '4ce5050a03a45cddce9d4d0615b7db4cb484251b314f8c6b55c9771d7b2cf72e'
    },
    [pscustomobject]@{
        name = 'AFF-B compliance coverage 019'
        record = $modelPortfolio.supersededReviewedPhase5Candidate.complianceCoverage
        path = 'reviews/aff-b/coverage/stratton-compliance-coverage-019.json'
        sha256 = '4d4511baafaf2db61018cd0b2e604f1db46534409249086e5ac43eb0ac22bc68'
    }
)
foreach ($binding in $expectedModelPortfolioBindings) {
    if (
        [string]$binding.record.path -cne $binding.path -or
        [string]$binding.record.sha256 -cne $binding.sha256
    ) {
        throw "$($binding.name) release binding is not exact."
    }
    [void](Assert-AuthorityHash -Record $binding.record -Name $binding.name)
}
$r6AffA = Get-Content -Raw -LiteralPath (
    Resolve-CaseRelativePath -RelativePath (
        [string]$modelPortfolio.supersededReviewedPhase5Candidate.affAReview.path
    )
) | ConvertFrom-Json -Depth 100
$r6AffB = Get-Content -Raw -LiteralPath (
    Resolve-CaseRelativePath -RelativePath (
        [string]$modelPortfolio.supersededReviewedPhase5Candidate.affBReview.path
    )
) | ConvertFrom-Json -Depth 100
if (
    [string]$r6AffA.verdict -cne 'DIVERGES' -or
    [string]$r6AffA.findings[0].id -cne 'AFFA-P5-R6-MAJ-001' -or
    [string]$r6AffA.reviewedSubject.expectedManifestSha256 -cne
        [string]$modelPortfolio.supersededReviewedPhase5Candidate.manifest.sha256 -or
    [string]$r6AffB.verdict -notin @('CONFORMS', 'CONFORMS-WITH-GAPS') -or
    [string]$r6AffB.subject.expectedSha256 -cne
        [string]$modelPortfolio.supersededReviewedPhase5Candidate.manifest.sha256
) {
    throw 'Reviewed r6 remediation provenance is invalid.'
}

$cc002ApprovalDocument = Get-Content -Raw -LiteralPath (
    Resolve-CaseRelativePath -RelativePath ([string]$modelPortfolio.changeControlApproval.path)
) | ConvertFrom-Json -Depth 100
$phase3Cc002ApprovalDocument = Get-Content -Raw -LiteralPath (
    Resolve-CaseRelativePath -RelativePath ([string]$modelPortfolio.phase3Approval.path)
) | ConvertFrom-Json -Depth 100
$phase4Cc002ApprovalDocument = Get-Content -Raw -LiteralPath (
    Resolve-CaseRelativePath -RelativePath ([string]$modelPortfolio.phase4Approval.path)
) | ConvertFrom-Json -Depth 100
$r4ApprovalDocument = Get-Content -Raw -LiteralPath (
    Resolve-CaseRelativePath -RelativePath (
        [string]$modelPortfolio.supersededApprovedPhase5Baseline.approval.path
    )
) | ConvertFrom-Json -Depth 100
if (
    [string]$cc002ApprovalDocument.changeControlId -cne 'STRATTON-CC-002' -or
    [int]$cc002ApprovalDocument.sequence -ne 2 -or
    $cc002ApprovalDocument.activeEvidence -ne $true -or
    [string]$cc002ApprovalDocument.decision -cne 'APPROVED' -or
    [string]$phase3Cc002ApprovalDocument.approvalId -cne
        'STRATTON-PHASE-3-CC-002-APPROVAL-002' -or
    [int]$phase3Cc002ApprovalDocument.sequence -ne 2 -or
    $phase3Cc002ApprovalDocument.activeEvidence -ne $true -or
    [string]$phase4Cc002ApprovalDocument.approvalId -cne
        'STRATTON-PHASE-4-CC-002-APPROVAL-001' -or
    [int]$phase4Cc002ApprovalDocument.sequence -ne 1 -or
    [string]$r4ApprovalDocument.approvalId -cne 'STRATTON-PHASE-5-APPROVAL-001' -or
    [string]$r4ApprovalDocument.subjectHashManifest.sha256 -cne
        'bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626'
) {
    throw 'STRATTON-CC-002 or superseded r4 approval content is invalid.'
}

foreach ($environment in 'dev', 'tst', 'prd') {
    $parameterPath = Join-Path $resolvedRoot "infra\parameters\$environment.bicepparam"
    $parameterText = Get-Content -Raw -LiteralPath $parameterPath
    foreach ($requiredLiteral in @(
        "param modelPortfolioDeploymentEnabled = false",
        "name: 'gpt-5.6-luna'",
        "name: 'gpt-5.6-terra'",
        "name: 'gpt-5.6-sol'",
        "version: '2026-07-09'",
        "skuName: 'DataZoneStandard'",
        "versionUpgradeOption: 'NoAutoUpgrade'"
    )) {
        if (-not $parameterText.Contains($requiredLiteral, [StringComparison]::Ordinal)) {
            throw "$environment parameters omit a required fail-closed model control: $requiredLiteral"
        }
    }
    if ($parameterText.Contains('GlobalStandard', [StringComparison]::OrdinalIgnoreCase)) {
        throw "$environment parameters contain prohibited Global Standard configuration."
    }
}

$workerMainText = Get-Content -Raw -LiteralPath (Join-Path $resolvedRoot 'app\src\worker-main.ts')
$routingPolicyText = Get-Content -Raw -LiteralPath (
    Join-Path $resolvedRoot 'app\src\model-routing-policy.ts'
)
if (
    -not $workerMainText.Contains(
        'const analysisProvider = new BlockedAnalysisProvider(',
        [StringComparison]::Ordinal
    ) -or
    -not $routingPolicyText.Contains(
        'export function selectModelRoute(',
        [StringComparison]::Ordinal
    ) -or
    -not $routingPolicyText.Contains(
        'readonly modelVersion: "2026-07-09";',
        [StringComparison]::Ordinal
    )
) {
    throw 'Production inference blocking or deterministic application routing source is absent.'
}

$benchmarkPath = Join-Path $resolvedRoot `
    'evidence\model-portfolio\model-portfolio-benchmark-template.json'
$benchmark = Get-Content -Raw -LiteralPath $benchmarkPath | ConvertFrom-Json -Depth 30
$expectedRoutes = @('LUNA', 'TERRA', 'SOL')
$observedFields = @(
    'completedEligibleDeals',
    'citationCoveragePct',
    'extractionAccuracyPct',
    'criticalFieldAccuracyPct',
    'criticalUnsupportedClaims',
    'nonCriticalUnsupportedClaimRatePct',
    'seededHighRiskRecallPct',
    'missedCriticalRisk',
    'representativeCaseCount',
    'p95LatencyMilliseconds',
    'typicalPackMinutes',
    'observedInputTokens',
    'observedOutputTokens',
    'observedCostUsd'
)
if (
    [string]::Join(',', @($benchmark.routeBenchmarks.routeId)) -cne
        [string]::Join(',', $expectedRoutes) -or
    @($benchmark.routeBenchmarks).Count -ne 3
) {
    throw 'Benchmark template does not contain exactly LUNA, TERRA and SOL in deterministic order.'
}
foreach ($record in $benchmark.routeBenchmarks) {
    if (
        [string]$record.modelVersion -cne '2026-07-09' -or
        [string]$record.promotionState -cne 'BLOCKED_PENDING_OBSERVED_EVIDENCE'
    ) {
        throw "Benchmark template route is not promotion-blocked: $($record.routeId)"
    }
    foreach ($field in $observedFields) {
        if ($null -ne $record.$field) {
            throw "Benchmark template falsely claims an observation: $($record.routeId).$field"
        }
    }
}

$phaseHashPath = Join-Path $resolvedRoot "$ArtifactPrefix-phase-5-hashes.json"
$phaseHash = Get-Content -Raw -LiteralPath $phaseHashPath | ConvertFrom-Json -Depth 100
Assert-HashEntries -Entries @($phaseHash.files) -Name 'Phase 5 hash set'
if (
    [string]$phaseHash.modelPlanRevision -cne [string]$release.upstream.modelPlanRevision -or
    [string]$phaseHash.modelPlan.path -cne [string]$release.upstream.phase5ModelPlan.path -or
    [string]$phaseHash.modelPlan.sha256 -cne [string]$release.upstream.phase5ModelPlan.sha256 -or
    [string]$phaseHash.canonicalization.hashRoot -cne '5-coding-r7'
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

$evidenceSet = Get-ValidationEvidenceSet -PackageRoot $resolvedRoot `
    -ValidationIndexPath ([string]$release.validation.evidence) `
    -ExpectedRunId ([string]$release.validation.runId)
$latestValidationRecord = [pscustomobject]@{
    file = Get-Item -LiteralPath $evidenceSet.indexFullPath
    document = $evidenceSet.index
}
$validationInputDocument = Get-Content -Raw -LiteralPath (
    Join-Path $resolvedRoot $evidenceSet.validationInput.manifest
) | ConvertFrom-Json -Depth 100
if (@($validationInputDocument.files).Count -ne @($release.files).Count) {
    throw 'Validation input manifest and release source inventory have different file counts.'
}
for ($index = 0; $index -lt @($release.files).Count; $index++) {
    if (
        [string]$validationInputDocument.files[$index].path -cne
            [string]$release.files[$index].path -or
        [string]$validationInputDocument.files[$index].sha256 -cne
            [string]$release.files[$index].sha256 -or
        [long]$validationInputDocument.files[$index].sizeBytes -ne
            [long]$release.files[$index].sizeBytes
    ) {
        throw "Validation input and release source inventory mismatch at index $index."
    }
}
$requiredEvidence = [Collections.Generic.List[string]]::new()
$latestValidationRelativePath = [string]$evidenceSet.indexRelativePath
if ([string]$release.validation.evidence -cne $latestValidationRelativePath) {
    throw 'Release manifest does not reference the exact full PASS validation index.'
}
if (
    [string]$release.validation.input.aggregateSha256 -cne
        [string]$evidenceSet.validationInput.aggregateSha256 -or
    [string]$release.dependencyEvidence.validationInput.aggregateSha256 -cne
        [string]$evidenceSet.validationInput.aggregateSha256
) {
    throw 'Release manifest does not bind the exact recomputed validation input.'
}
$requiredEvidence.Add($latestValidationRelativePath)
$requiredEvidence.Add([string]$evidenceSet.validationInput.manifest)
foreach ($step in $latestValidationRecord.document.steps) {
    if ($step.status -ne 'PASS') {
        throw "Selected full validation has a non-PASS step: $($step.stepId)"
    }
    if ($step.PSObject.Properties['redactedLog']) {
        $requiredEvidence.Add([string]$step.redactedLog)
        $requiredEvidence.Add([IO.Path]::ChangeExtension([string]$step.redactedLog, '.json'))
    }
}
$containerSummaryPath = Get-Item -LiteralPath (
    Join-Path $resolvedRoot $evidenceSet.containerSummaryRelativePath
)
$containerSummary = $evidenceSet.containerSummary
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
    throw 'Release manifest does not reference the exact PASS container summary.'
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

$sourceSecuritySummaryPath = Get-Item -LiteralPath (
    Join-Path $resolvedRoot $evidenceSet.sourceSecuritySummaryRelativePath
)
$sourceSecuritySummary = $evidenceSet.sourceSecuritySummary
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
    throw 'Release manifest does not reference the exact PASS source-security summary.'
}
$requiredEvidence.Add($sourceSecuritySummaryRelativePath)
$requiredEvidence.Add([string]$sourceSecuritySummary.scan)
$requiredEvidence.Add([string]$sourceSecuritySummary.scannerDatabase)
$requiredEvidence.Add('evidence/README.md')
$requiredEvidence.Add('evidence/dependency-evidence.json')
$requiredEvidence.Add('evidence/model-portfolio/model-portfolio-benchmark-template.json')
$requiredEvidence.Add('evidence/model-portfolio/stratton-r4-to-r5-sibling-migration.json')
$requiredEvidence.Add('evidence/model-portfolio/stratton-r5-to-r6-evidence-binding-remediation.json')
$requiredEvidence.Add('evidence/model-portfolio/stratton-r6-to-r7-operational-reference-remediation.json')
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
