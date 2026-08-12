[CmdletBinding()]
param(
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..\..')
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $PackageRoot).Path
$requiredDirectories = 'infra', 'app', 'tests', 'validation', 'deploy', 'evidence', 'tooling', 'release'
$missing = $requiredDirectories | Where-Object { -not (Test-Path -LiteralPath (Join-Path $root $_) -PathType Container) }
if ($missing) {
    throw "Missing package directories: $($missing -join ', ')"
}

$toolVersionsPath = Join-Path $root 'tooling\tool-versions.json'
$toolVersions = Get-Content -Raw -LiteralPath $toolVersionsPath | ConvertFrom-Json -Depth 20
if ([string]$toolVersions.status -cne 'FROZEN_FOR_ASSURANCE') {
    throw "Tool-version lock is stale. Expected FROZEN_FOR_ASSURANCE, found $($toolVersions.status)."
}
foreach($property in $toolVersions.required.PSObject.Properties) {
    if ([string]$toolVersions.observedAtStart.($property.Name) -cne [string]$property.Value) {
        throw "Tool-version lock differs from its captured observation: $($property.Name)"
    }
}

$caseRoot = Split-Path -Parent $root
if ([IO.Path]::GetFileName($root) -cne '5-coding-r7') {
    throw 'Package integrity must run against the 5-coding-r7 remediation candidate.'
}
$revision111Path = Join-Path $caseRoot '0-coordination\stratton-model-plan-revision-111.json'
$revision111Hash = (Get-FileHash -LiteralPath $revision111Path -Algorithm SHA256).Hash.ToLowerInvariant()
if ($revision111Hash -cne '64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7') {
    throw 'Model-plan revision 111 hash mismatch.'
}
$revision111 = Get-Content -Raw -LiteralPath $revision111Path | ConvertFrom-Json -Depth 100
if (
    [string]$revision111.planRevision -cne '111' -or
    [string]$revision111.caseName -cne 'Stratton-Europe-Captital' -or
    [string]$revision111.artifactPrefix -cne 'stratton'
) {
    throw 'Model-plan revision 111 identity is invalid.'
}

$requiredGovernanceBindings = [ordered]@{
    '5-coding-r4\stratton-phase-5-hashes.json' =
        'bcdf37557f2d78d0675c8907beda6ec61dad4a25faffcca5270473a15e821626'
    'approvals\5\stratton-phase-5-approval-1.json' =
        'f39fbd68d4574f77e7d31d5fb7608739a1e472fa808fc91b14969009a27b1cd4'
    'approvals\change-control\stratton-cc-002-approval-2.json' =
        'fa8f8ccea8d044cc253fceb54adb74727cf9852fbf73325e45633bc362d04117'
    'approvals\3\stratton-phase-3-cc-002-approval-2.json' =
        'c0d51c1e2478371c452f068361ca857b2afeb49f295dd2fd5880c58e895a96a5'
    'approvals\4\stratton-phase-4-cc-002-approval-1.json' =
        '71d6b0c306ddff4f58b5b29868ac2ec895d554609e6243a4d95b8e910b14b373'
    '4-implementation-plan\stratton-phase-4-hashes-cc-002-r4-proposed.json' =
        '5ab254e33ee9460c56026809071a3315b5fce7de887e99c65bf6d100a0140c0b'
    '5-coding-r5\stratton-phase-5-hashes.json' =
        'e73132030070a39fbf6cf121fc8fe2988ac7a944368aa2894527bf51d506fc0f'
    'reviews\aff-a\5\round-5\stratton-aff-a-review.json' =
        'f614574bcc42529b26f32b1590ab690c121cfb15ec1aad10e7ace4bb367abfbe'
    'reviews\aff-b\5\round-3\stratton-aff-b-review.json' =
        '63e422fa708fce1c30f1739b9d0a539d2b435110b7be9cb724dc5a799a1525a7'
    'reviews\aff-b\coverage\stratton-compliance-coverage-018.json' =
        'abe9b88504d5ca91dbd6297c6b1d09a35c346c87f9ec6295920d490076b1ae11'
    '5-coding-r6\stratton-phase-5-hashes.json' =
        'da59dc23d3a4db79db32d1ee25ed67d67e7ed6af82be6547adf0228b027fcc33'
    'reviews\aff-a\5\round-6\stratton-aff-a-review.json' =
        '0198a83f90c2690db1e175c6f4e31aeb8bcefb22309a6e6960c24ce29e3b828f'
    'reviews\aff-b\5\round-4\stratton-aff-b-review.json' =
        '4ce5050a03a45cddce9d4d0615b7db4cb484251b314f8c6b55c9771d7b2cf72e'
    'reviews\aff-b\coverage\stratton-compliance-coverage-019.json' =
        '4d4511baafaf2db61018cd0b2e604f1db46534409249086e5ac43eb0ac22bc68'
}
foreach ($binding in $requiredGovernanceBindings.GetEnumerator()) {
    $bindingPath = Join-Path $caseRoot $binding.Key
    if (-not (Test-Path -LiteralPath $bindingPath -PathType Leaf)) {
        throw "Required governance binding is missing: $($binding.Key)"
    }
    $actual = (Get-FileHash -LiteralPath $bindingPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -cne $binding.Value) {
        throw "Required governance binding hash mismatch: $($binding.Key)"
    }
}

$validationScript = Get-Content -Raw -LiteralPath (
    Join-Path $root 'validation\Invoke-LocalValidation.ps1'
)
if (
    $validationScript -notmatch "localValidationReleaseStep\s*=\s*'RELEASE_MANIFEST_ONLY'" -or
    $validationScript -notmatch 'finalFreezeOutsideValidationRun\s*=\s*\$true' -or
    $validationScript -match "Invoke-NativeChecked[\s\S]{0,500}New-Phase5Hashes\.ps1" -or
    $validationScript -match "Invoke-NativeChecked[\s\S]{0,500}Test-ReleaseEvidence\.ps1"
) {
    throw 'Local validation does not preserve the release-manifest-only evidence boundary.'
}

$infraRoot = Join-Path $root 'infra'
$compiledBesideSource = @(
    Get-ChildItem -LiteralPath $infraRoot -Recurse -File -Filter '*.json' |
    Where-Object {
        $_.FullName -notmatch '\\out\\' -and
        (Test-Path -LiteralPath ([IO.Path]::ChangeExtension($_.FullName, '.bicep')) -PathType Leaf)
    }
)
if ($compiledBesideSource.Count -gt 0) {
    $paths = $compiledBesideSource |
        ForEach-Object { [IO.Path]::GetRelativePath($root, $_.FullName).Replace('\', '/') }
    throw "Compiled Bicep artifacts must be written only under infra/out: $($paths -join ', ')"
}

$forbiddenPatterns = @(
    [pscustomobject]@{
        pattern = '(?im)(?:^|[\s,{])["'']?(?:client[_-]?secret|password|api[_-]?key|access[_-]?token|refresh[_-]?token)["'']?\s*[:=]\s*(?:["''](?<quoted>[^"'']+)["'']|(?<bare>[^\s,}\]]+))'
        permitsPlaceholder = $true
    },
    [pscustomobject]@{
        pattern = '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'
        permitsPlaceholder = $false
    },
    [pscustomobject]@{
        pattern = '(?i)DefaultEndpointsProtocol=https;AccountName='
        permitsPlaceholder = $false
    }
)
$allowedPlaceholders = @(
    'pw',
    'token',
    '[REDACTED]',
    '<REDACTED>',
    'example',
    'test',
    'dummy',
    'REQUIRED_OWNER_INPUT'
)
$textFiles = Get-ChildItem -LiteralPath $root -Recurse -File |
    Where-Object {
        (
            $_.Extension -in '.bicep', '.bicepparam', '.json', '.yaml', '.yml', '.ts', '.js', '.sql', '.ps1', '.md' -or
            $_.Name -like '.env*'
        ) -and
        $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\out\\' -and
        $_.FullName -cne $PSCommandPath
    }
foreach ($file in $textFiles) {
    $content = Get-Content -Raw -LiteralPath $file.FullName
    foreach ($rule in $forbiddenPatterns) {
        foreach ($match in [regex]::Matches($content, $rule.pattern)) {
            $candidateValue = if ($match.Groups['quoted'].Success) {
                $match.Groups['quoted'].Value
            }
            elseif ($match.Groups['bare'].Success) {
                $match.Groups['bare'].Value
            }
            else {
                $null
            }
            if (
                $rule.permitsPlaceholder -and
                $null -ne $candidateValue -and
                $candidateValue -in $allowedPlaceholders
            ) {
                continue
            }
            throw "Potential secret material detected in $($file.FullName)"
        }
    }
}

$secretPattern = $forbiddenPatterns[0].pattern
foreach ($sample in @(
    '"password": "not-a-placeholder"',
    "client_secret: 'not-a-placeholder'",
    'apiKey=not-a-placeholder'
)) {
    if (-not [regex]::IsMatch($sample, $secretPattern)) {
        throw "Secret scanner regression: expected sample was not detected."
    }
}

$modelPlanPath = Join-Path $caseRoot '0-coordination\stratton-model-plan-revision-6.json'
$modelPlan = Get-Content -Raw -LiteralPath $modelPlanPath | ConvertFrom-Json -Depth 20
$upstreamBindings = @(
    [pscustomobject]@{
        path = [string]$modelPlan.upstreamGateBinding.phase4ApprovalPath
        expectedSha256 = [string]$modelPlan.upstreamGateBinding.phase4ApprovalSha256
    },
    [pscustomobject]@{
        path = [string]$modelPlan.upstreamGateBinding.phase4CanonicalManifestPath
        expectedSha256 = [string]$modelPlan.upstreamGateBinding.phase4CanonicalManifestSha256
    }
)
foreach ($binding in $upstreamBindings) {
    $upstreamPath = Join-Path $caseRoot $binding.path
    if (-not (Test-Path -LiteralPath $upstreamPath -PathType Leaf)) {
        throw "Required upstream artifact is missing: $($binding.path)"
    }
    $actualSha256 = (Get-FileHash -LiteralPath $upstreamPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualSha256 -cne $binding.expectedSha256) {
        throw "Upstream hash mismatch: $($binding.path)"
    }
}

[pscustomobject]@{
    status = 'PASS'
    packageRoot = $root
    scannedFiles = @($textFiles).Count
    upstreamBindings = $upstreamBindings.Count
}
