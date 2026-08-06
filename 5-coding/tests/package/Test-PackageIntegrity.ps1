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
