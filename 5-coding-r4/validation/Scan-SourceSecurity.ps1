[CmdletBinding()]
param(
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..'),
    [string]$WslDistribution = 'Ubuntu-26.04'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$evidenceRoot = Join-Path $resolvedRoot "evidence\source-security\$runId"
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    [IO.File]::WriteAllText(
        [IO.Path]::GetFullPath($Path),
        $Content,
        [Text.UTF8Encoding]::new($false)
    )
}

function Convert-ToWslPath {
    param([Parameter(Mandatory)][string]$Path)

    $windowsMatch = [regex]::Match($Path, '^(?<drive>[A-Za-z]):\\(?<rest>.*)$')
    if ($windowsMatch.Success) {
        $drive = $windowsMatch.Groups['drive'].Value.ToLowerInvariant()
        $rest = $windowsMatch.Groups['rest'].Value.Replace('\', '/')
        return "/mnt/$drive/$rest"
    }
    $output = @(& wsl -d $WslDistribution -u root -- wslpath -a $Path 2>&1)
    $translated = $output |
        ForEach-Object { $_.ToString().Trim() } |
        Where-Object { $_.StartsWith('/') } |
        Select-Object -Last 1
    if ([string]::IsNullOrWhiteSpace($translated)) {
        throw "Unable to translate path for WSL: $Path"
    }
    return $translated
}

function ConvertTo-ShLiteral {
    param([Parameter(Mandatory)][string]$Value)
    return "'" + $Value.Replace("'", "'`"`"'`"`'") + "'"
}

function Invoke-WslChecked {
    param([Parameter(Mandatory)][string]$Command)

    $sentinel = '__AFF_WSL_COMMAND_COMPLETE__'
    $normalized = $Command.Replace("`r", '') + "`nprintf '$sentinel\n'`n"
    $output = @(& wsl -d $WslDistribution -u root -- sh -lc $normalized 2>&1)
    $exitCode = $LASTEXITCODE
    $lines = @($output | ForEach-Object { $_.ToString() })
    $lines | Where-Object { $_.Trim() -ne $sentinel } | Write-Output
    if (@($lines | Where-Object { $_.Trim() -eq $sentinel }).Count -ne 1 -or $exitCode -ne 0) {
        throw "WSL source-security command failed. Exit code: $exitCode."
    }
}

function Get-ResultItems {
    param(
        [Parameter(Mandatory)]
        [object[]]$Results,
        [Parameter(Mandatory)]
        [string]$Property
    )

    return @(
        $Results |
        ForEach-Object {
            $candidate = $_.PSObject.Properties[$Property]
            if ($null -ne $candidate) {
                @($candidate.Value)
            }
        } |
        Where-Object { $null -ne $_ }
    )
}

$wslRoot = Convert-ToWslPath -Path $resolvedRoot
$wslEvidenceRoot = Convert-ToWslPath -Path $evidenceRoot
$scanPath = Join-Path $evidenceRoot 'trivy-source.json'

Invoke-WslChecked -Command @"
set -eu
trivy image --download-db-only --quiet
test -s /root/.cache/trivy/db/metadata.json
cp /root/.cache/trivy/db/metadata.json $(ConvertTo-ShLiteral -Value "$wslEvidenceRoot/trivy-db-metadata.json")
trivy fs $(ConvertTo-ShLiteral -Value $wslRoot) \
  --scanners vuln,misconfig,secret,license \
  --format json \
  --output $(ConvertTo-ShLiteral -Value "$wslEvidenceRoot/trivy-source.json") \
  --skip-db-update \
  --skip-dirs $(ConvertTo-ShLiteral -Value "$wslRoot/app/node_modules") \
  --skip-dirs $(ConvertTo-ShLiteral -Value "$wslRoot/app/dist") \
  --skip-dirs $(ConvertTo-ShLiteral -Value "$wslRoot/infra/out") \
  --skip-dirs $(ConvertTo-ShLiteral -Value "$wslRoot/out") \
  --skip-dirs $(ConvertTo-ShLiteral -Value "$wslRoot/evidence") \
  --timeout 15m
"@

if (-not (Test-Path -LiteralPath $scanPath -PathType Leaf) -or
    (Get-Item -LiteralPath $scanPath).Length -eq 0) {
    throw 'Trivy source-security output is missing or empty.'
}

$document = Get-Content -Raw -LiteralPath $scanPath | ConvertFrom-Json -Depth 100
$results = @($document.Results)
$vulnerabilities = @(Get-ResultItems -Results $results -Property 'Vulnerabilities')
$secrets = @(Get-ResultItems -Results $results -Property 'Secrets')
$misconfigurations = @(Get-ResultItems -Results $results -Property 'Misconfigurations')
$licenses = @(Get-ResultItems -Results $results -Property 'Licenses')
$blockingVulnerabilities = @($vulnerabilities | Where-Object { $_.Severity -in 'HIGH', 'CRITICAL' })
$blockingMisconfigurations = @(
    $misconfigurations |
    Where-Object {
        $_.Status -ne 'PASS' -and
        $_.Severity -in 'HIGH', 'CRITICAL'
    }
)

$summary = [ordered]@{
    schemaVersion = '1.0.0'
    runId = $runId
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    status = if (
        $blockingVulnerabilities.Count -eq 0 -and
        $blockingMisconfigurations.Count -eq 0 -and
        $secrets.Count -eq 0
    ) {
        'PASS'
    }
    else {
        'FAIL'
    }
    scan = "evidence/source-security/$runId/trivy-source.json"
    scannerDatabase = "evidence/source-security/$runId/trivy-db-metadata.json"
    highVulnerabilities = @($blockingVulnerabilities | Where-Object Severity -eq 'HIGH').Count
    criticalVulnerabilities = @($blockingVulnerabilities | Where-Object Severity -eq 'CRITICAL').Count
    highMisconfigurations = @($blockingMisconfigurations | Where-Object Severity -eq 'HIGH').Count
    criticalMisconfigurations = @($blockingMisconfigurations | Where-Object Severity -eq 'CRITICAL').Count
    secretFindings = $secrets.Count
    licenseFindings = $licenses.Count
    licenseSummary = @(
        $licenses |
        Group-Object Name |
        Sort-Object Name |
        ForEach-Object {
            [ordered]@{
                spdxId = $_.Name
                count = $_.Count
            }
        }
    )
    licenseReviewStatus = 'PENDING_AFF_B_REVIEW'
}
$summaryPath = Join-Path $evidenceRoot 'summary.json'
Write-Utf8NoBom -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 8)

if ($summary.status -ne 'PASS') {
    throw 'Source-security validation found blocking vulnerabilities, misconfigurations, or secrets.'
}

Write-Host "Source-security validation passed. Evidence: $summaryPath"
