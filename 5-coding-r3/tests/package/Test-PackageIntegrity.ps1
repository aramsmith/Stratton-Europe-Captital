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

$revision14Path = Join-Path (Split-Path -Parent $root) `
    '0-coordination\stratton-model-plan-revision-14.json'
$revision14Hash = (Get-FileHash -LiteralPath $revision14Path -Algorithm SHA256).Hash.ToLowerInvariant()
if ($revision14Hash -cne 'a4af30ebc44cb985c1881d2508eb2bdb8680e480c0262682fe34de2ebb40638b') {
    throw 'Model-plan revision 14 hash mismatch.'
}
$revision14 = Get-Content -Raw -LiteralPath $revision14Path | ConvertFrom-Json -Depth 30
if (
    [string]$revision14.planRevision -cne '14' -or
    [string]$revision14.revisionedCandidate.packageRoot -cne '5-coding-r3' -or
    [string]$revision14.revisionedCandidate.manifestPath -cne
        '5-coding-r3/stratton-phase-5-hashes.json'
) {
    throw 'Model-plan revision 14 does not bind the revisioned candidate package.'
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

$caseRoot = Split-Path -Parent $root
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
