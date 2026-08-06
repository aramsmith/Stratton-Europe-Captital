[CmdletBinding()]
param(
    [ValidateSet('All', 'Prerequisites', 'Bicep', 'Security', 'Database', 'Application', 'Containers', 'Release')]
    [string]$Scope = 'All',
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$evidenceRoot = Join-Path $resolvedRoot "evidence\local-validation\$runId"
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

$stepRecords = [Collections.Generic.List[object]]::new()

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory)]
        [string]$Path,
        [Parameter(Mandatory)]
        [AllowEmptyString()]
        [string]$Content
    )

    [IO.File]::WriteAllText(
        [IO.Path]::GetFullPath($Path),
        $Content,
        [Text.UTF8Encoding]::new($false)
    )
}

function ConvertTo-RedactedText {
    param([object[]]$InputObject)

    $text = ($InputObject | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
    $text = $text.Replace($resolvedRoot, '<PACKAGE_ROOT>', [StringComparison]::OrdinalIgnoreCase)
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $text = $text.Replace($env:USERPROFILE, '<USER_HOME>', [StringComparison]::OrdinalIgnoreCase)
    }
    $text = $text -replace '(?i)(authorization\s*:\s*bearer\s+)\S+', '$1<REDACTED>'
    $text = $text -replace '(?i)(client[_-]?secret|password|access[_-]?token)\s*[:=]\s*\S+', '$1=<REDACTED>'
    $text = $text -replace '(?i)(AccountKey|SharedAccessKey|sig)=([^;&\s]+)', '$1=<REDACTED>'
    return $text
}

function Invoke-NativeChecked {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$WorkingDirectory = $resolvedRoot
    )

    Push-Location -LiteralPath $WorkingDirectory
    try {
        & $FilePath @ArgumentList
        if ($LASTEXITCODE -ne 0) {
            throw "$FilePath exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Get-ModuleVersion {
    param([Parameter(Mandatory)][string]$Name)

    $module = Get-Module -ListAvailable -Name $Name |
        Sort-Object Version -Descending |
        Select-Object -First 1
    if ($null -eq $module) {
        throw "Required PowerShell module is not installed: $Name"
    }
    return $module.Version.ToString()
}

function Get-NativeVersion {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,
        [string[]]$ArgumentList,
        [Parameter(Mandatory)]
        [string]$Pattern
    )

    $output = @(& $FilePath @ArgumentList 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read version from $FilePath."
    }
    $text = $output -join "`n"
    $match = [regex]::Match($text, $Pattern)
    if (-not $match.Success) {
        throw "Unable to parse version from $FilePath output."
    }
    return $match.Groups['version'].Value
}

function Test-Prerequisites {
    $toolFile = Join-Path $resolvedRoot 'tooling\tool-versions.json'
    $tools = Get-Content -Raw -LiteralPath $toolFile | ConvertFrom-Json
    $required = $tools.required

    $azVersionOutput = @(& az version --output json 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to read Azure CLI version.'
    }
    $azVersion = (($azVersionOutput -join "`n") | ConvertFrom-Json).'azure-cli'

    $observed = [ordered]@{
        azureCli = $azVersion
        bicepCli = Get-NativeVersion -FilePath 'az' -ArgumentList @('bicep', 'version') -Pattern 'Bicep CLI version (?<version>\d+\.\d+\.\d+)'
        powerShell = $PSVersionTable.PSVersion.ToString()
        node = Get-NativeVersion -FilePath 'node' -ArgumentList @('--version') -Pattern 'v(?<version>\d+\.\d+\.\d+)'
        npm = Get-NativeVersion -FilePath 'npm' -ArgumentList @('--version') -Pattern '(?<version>\d+\.\d+\.\d+)'
        git = Get-NativeVersion -FilePath 'git' -ArgumentList @('--version') -Pattern 'git version (?<version>\S+)'
        pester = Get-ModuleVersion -Name 'Pester'
        psRule = Get-ModuleVersion -Name 'PSRule'
        psRuleRulesAzure = Get-ModuleVersion -Name 'PSRule.Rules.Azure'
    }

    foreach ($property in $observed.Keys) {
        $expected = [string]$required.$property
        $actual = [string]$observed[$property]
        if ($actual -cne $expected) {
            throw "Tool version mismatch for $property. Expected $expected, observed $actual."
        }
    }

    $distro = [string]$required.wslDistribution
    $wslCommand = @'
set -eu
printf 'podman=%s\n' "$(podman --version | awk '{print $3}')"
printf 'buildah=%s\n' "$(buildah --version | awk '{print $3}')"
printf 'skopeo=%s\n' "$(skopeo --version | awk '{print $3}')"
printf 'jq=%s\n' "$(jq --version | sed 's/^jq-//')"
printf 'cosignPackage=%s\n' "$(dpkg-query -W cosign | awk '{print $2}')"
printf 'syft=%s\n' "$(syft version | awk '/^Version:/ {print $2; exit}')"
printf 'trivy=%s\n' "$(trivy --version | awk '/^Version:/ {print $2; exit}')"
printf 'qemuUser=%s\n' "$(qemu-x86_64 --version | awk 'NR==1 {print $3}')"
printf 'validationComplete=true\n'
'@
    $wslCommand = $wslCommand.Replace("`r", '')
    $wslOutput = @(& wsl -d $distro -u root -- sh -lc $wslCommand 2>&1)
    $wslExitCode = $LASTEXITCODE
    $wslLines = @($wslOutput | ForEach-Object { $_.ToString().Trim() })
    if ($wslLines -notcontains 'validationComplete=true') {
        throw "Unable to verify WSL supply-chain tools in $distro. Exit code: $wslExitCode. Output: $($wslLines -join ' | ')"
    }
    if ($wslExitCode -ne 0) {
        throw "WSL tool verification returned exit code $wslExitCode."
    }
    $wslObserved = @{}
    foreach ($line in $wslLines) {
        if ($line -match '^(?<name>[A-Za-z]+)=(?<version>\S+)$') {
            $wslObserved[$Matches.name] = $Matches.version
        }
    }
    foreach ($property in 'podman', 'buildah', 'skopeo', 'jq', 'cosignPackage', 'syft', 'trivy', 'qemuUser') {
        if (-not $wslObserved.ContainsKey($property)) {
            throw "Unable to parse WSL tool version: $property"
        }
        $expected = [string]$required.$property
        $actual = [string]$wslObserved[$property]
        if ($actual -cne $expected) {
            throw "Tool version mismatch for $property. Expected $expected, observed $actual."
        }
    }

    $requiredPaths = @(
        'app\package-lock.json',
        'app\Dockerfile.api',
        'app\Dockerfile.worker',
        'infra\main.bicep',
        'infra\parameters\dev.bicepparam',
        'infra\parameters\tst.bicepparam',
        'infra\parameters\prd.bicepparam',
        'tests\iac\Invoke-IaCTests.ps1',
        'tests\package\Test-PackageIntegrity.ps1',
        'validation\Build-ContainerEvidence.ps1',
        'validation\Scan-SourceSecurity.ps1',
        'validation\New-ReleaseManifest.ps1',
        'validation\New-BuildReport.ps1',
        'validation\New-Phase5Hashes.ps1'
    )
    $missing = $requiredPaths |
        Where-Object { -not (Test-Path -LiteralPath (Join-Path $resolvedRoot $_) -PathType Leaf) }
    if ($missing) {
        throw "Required Phase 5 files are missing: $($missing -join ', ')"
    }

    [pscustomobject]@{
        status = 'PASS'
        tools = $observed
        wslTools = $wslObserved
        gitStatus = @(& git -C $resolvedRoot --no-pager status --short -- .)
    }
}

function Invoke-RecordedStep {
    param(
        [Parameter(Mandatory)]
        [string]$Id,
        [Parameter(Mandatory)]
        [string]$ValidationScope,
        [Parameter(Mandatory)]
        [string]$Command,
        [Parameter(Mandatory)]
        [scriptblock]$Action
    )

    $started = (Get-Date).ToUniversalTime()
    $status = 'PASS'
    $exitCode = 0
    $output = @()
    try {
        $output = @(& $Action *>&1)
    }
    catch {
        $status = 'FAIL'
        $exitCode = 1
        $output += $_
        if ($_.ScriptStackTrace) {
            $output += $_.ScriptStackTrace
        }
    }
    $ended = (Get-Date).ToUniversalTime()
    $redactedOutput = ConvertTo-RedactedText -InputObject $output

    $logPath = Join-Path $evidenceRoot "$Id.log"
    Write-Utf8NoBom -Path $logPath -Content $redactedOutput

    $record = [ordered]@{
        schemaVersion = '1.0.0'
        stepId = $Id
        scope = $ValidationScope
        status = $status
        command = $Command
        workingDirectory = '<PACKAGE_ROOT>'
        startedAt = $started.ToString('o')
        endedAt = $ended.ToString('o')
        durationMilliseconds = [math]::Round(($ended - $started).TotalMilliseconds)
        exitCode = $exitCode
        redactedLog = "evidence/local-validation/$runId/$Id.log"
    }
    $recordPath = Join-Path $evidenceRoot "$Id.json"
    Write-Utf8NoBom -Path $recordPath -Content ($record | ConvertTo-Json -Depth 8)
    $stepRecords.Add([pscustomobject]$record)
}

function Write-ValidationIndex {
    param([Parameter(Mandatory)][string]$Status)

    $index = [ordered]@{
        schemaVersion = '1.0.0'
        runId = $runId
        scope = $Scope
        status = $Status
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        packageRoot = '<PACKAGE_ROOT>'
        steps = @($stepRecords)
    }
    Write-Utf8NoBom -Path (Join-Path $evidenceRoot 'index.json') `
        -Content ($index | ConvertTo-Json -Depth 12)
}

$selectedScopes = if ($Scope -eq 'All') {
    @('Prerequisites', 'Bicep', 'Security', 'Database', 'Application', 'Containers', 'Release')
}
else {
    @($Scope)
}

foreach ($selectedScope in $selectedScopes) {
    switch ($selectedScope) {
        'Prerequisites' {
            Invoke-RecordedStep -Id 'prerequisites' -ValidationScope $selectedScope `
                -Command 'Verify exact tool versions and required package inputs' `
                -Action { Test-Prerequisites }
        }
        'Bicep' {
            Invoke-RecordedStep -Id 'iac-validation' -ValidationScope $selectedScope `
                -Command 'pwsh -NoProfile -File tests/iac/Invoke-IaCTests.ps1' `
                -Action {
                    Invoke-NativeChecked -FilePath 'pwsh' `
                        -ArgumentList @('-NoProfile', '-File', (Join-Path $resolvedRoot 'tests\iac\Invoke-IaCTests.ps1')) `
                        -WorkingDirectory $resolvedRoot
                }
            Invoke-RecordedStep -Id 'module-digest-evidence' -ValidationScope $selectedScope `
                -Command 'pwsh -NoProfile -File validation/Capture-OciDigestEvidence.ps1' `
                -Action {
                    Invoke-NativeChecked -FilePath 'pwsh' `
                        -ArgumentList @('-NoProfile', '-File', (Join-Path $resolvedRoot 'validation\Capture-OciDigestEvidence.ps1')) `
                        -WorkingDirectory $resolvedRoot
                }
        }
        'Security' {
            Invoke-RecordedStep -Id 'package-integrity' -ValidationScope $selectedScope `
                -Command 'pwsh -NoProfile -File tests/package/Test-PackageIntegrity.ps1' `
                -Action {
                    Invoke-NativeChecked -FilePath 'pwsh' `
                        -ArgumentList @('-NoProfile', '-File', (Join-Path $resolvedRoot 'tests\package\Test-PackageIntegrity.ps1')) `
                        -WorkingDirectory $resolvedRoot
                }
            Invoke-RecordedStep -Id 'source-security-scan' -ValidationScope $selectedScope `
                -Command 'pwsh -NoProfile -File validation/Scan-SourceSecurity.ps1' `
                -Action {
                    Invoke-NativeChecked -FilePath 'pwsh' `
                        -ArgumentList @('-NoProfile', '-File', (Join-Path $resolvedRoot 'validation\Scan-SourceSecurity.ps1')) `
                        -WorkingDirectory $resolvedRoot
                }
        }
        'Database' {
            Invoke-RecordedStep -Id 'database-validation' -ValidationScope $selectedScope `
                -Command 'npm run check:migrations' `
                -Action {
                    Invoke-NativeChecked -FilePath 'npm' -ArgumentList @('run', 'check:migrations') `
                        -WorkingDirectory (Join-Path $resolvedRoot 'app')
                }
        }
        'Application' {
            Invoke-RecordedStep -Id 'application-dependencies' -ValidationScope $selectedScope `
                -Command 'npm ci --offline --ignore-scripts' `
                -Action {
                    Invoke-NativeChecked -FilePath 'npm' -ArgumentList @('ci', '--offline', '--ignore-scripts') `
                        -WorkingDirectory (Join-Path $resolvedRoot 'app')
                }
            Invoke-RecordedStep -Id 'application-validation' -ValidationScope $selectedScope `
                -Command 'npm run validate' `
                -Action {
                    Invoke-NativeChecked -FilePath 'npm' -ArgumentList @('run', 'validate') `
                        -WorkingDirectory (Join-Path $resolvedRoot 'app')
                }
        }
        'Containers' {
            Invoke-RecordedStep -Id 'container-validation' -ValidationScope $selectedScope `
                -Command 'pwsh -NoProfile -File validation/Build-ContainerEvidence.ps1' `
                -Action {
                    Invoke-NativeChecked -FilePath 'pwsh' `
                        -ArgumentList @('-NoProfile', '-File', (Join-Path $resolvedRoot 'validation\Build-ContainerEvidence.ps1')) `
                        -WorkingDirectory $resolvedRoot
                }
        }
        'Release' {
            $priorFailures = @($stepRecords | Where-Object { $_.status -ne 'PASS' })
            if ($Scope -eq 'All' -and $priorFailures.Count -gt 0) {
                $stepRecords.Add([pscustomobject][ordered]@{
                    schemaVersion = '1.0.0'
                    stepId = 'release-evidence'
                    scope = $selectedScope
                    status = 'BLOCKED'
                    command = 'pwsh -NoProfile -File validation/New-ReleaseManifest.ps1'
                    workingDirectory = '<PACKAGE_ROOT>'
                    startedAt = (Get-Date).ToUniversalTime().ToString('o')
                    endedAt = (Get-Date).ToUniversalTime().ToString('o')
                    durationMilliseconds = 0
                    exitCode = 1
                    reason = 'One or more mandatory local validation steps failed.'
                })
            }
            else {
                if ($Scope -eq 'All') {
                    Write-ValidationIndex -Status 'PASS'
                }
                Invoke-RecordedStep -Id 'release-evidence' -ValidationScope $selectedScope `
                    -Command 'pwsh -NoProfile -File validation/New-ReleaseManifest.ps1' `
                    -Action {
                        Invoke-NativeChecked -FilePath 'pwsh' `
                            -ArgumentList @(
                                '-NoProfile',
                                '-File',
                                (Join-Path $resolvedRoot 'validation\New-ReleaseManifest.ps1'),
                                '-ValidationRunId',
                                $runId
                            ) `
                            -WorkingDirectory $resolvedRoot
                    }
            }
        }
    }
}

$finalStatus = if (@($stepRecords | Where-Object { $_.status -ne 'PASS' }).Count -eq 0) {
    'PASS'
}
else {
    'FAIL'
}
Write-ValidationIndex -Status $finalStatus

if ($finalStatus -ne 'PASS') {
    $failedIds = @($stepRecords | Where-Object { $_.status -ne 'PASS' } | ForEach-Object { $_.stepId })
    throw "Local validation failed or was blocked: $($failedIds -join ', ')"
}

Write-Host "Local validation passed. Evidence: $evidenceRoot"
