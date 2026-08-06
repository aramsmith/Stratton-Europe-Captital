[CmdletBinding()]
param(
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..'),
    [string]$WslDistribution = 'Ubuntu-26.04'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$runId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ')
$outputRoot = Join-Path $resolvedRoot "out\containers\$runId"
$evidenceRoot = Join-Path $resolvedRoot "evidence\containers\$runId"
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

function Write-Utf8NoBom {
    param([string]$Path, [string]$Content)
    [IO.File]::WriteAllText(
        [IO.Path]::GetFullPath($Path),
        $Content,
        [Text.UTF8Encoding]::new($false)
    )
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
    if (@($lines | Where-Object { $_.Trim() -eq $sentinel }).Count -ne 1) {
        throw "WSL command did not complete. Exit code: $exitCode."
    }
    if ($exitCode -ne 0) {
        throw "WSL command returned exit code $exitCode."
    }
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
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to translate path for WSL: $Path"
    }
    $translated = $output |
        ForEach-Object { $_.ToString().Trim() } |
        Where-Object { $_.StartsWith('/') } |
        Select-Object -Last 1
    if ([string]::IsNullOrWhiteSpace($translated)) {
        throw "WSL did not return a translated path for: $Path"
    }
    return $translated
}

$appRoot = Join-Path $resolvedRoot 'app'
$wslAppRoot = Convert-ToWslPath -Path $appRoot
$wslOutputRoot = Convert-ToWslPath -Path $outputRoot
$wslEvidenceRoot = Convert-ToWslPath -Path $evidenceRoot

Invoke-WslChecked -Command @"
set -eu
trivy image --download-db-only --quiet
test -s /root/.cache/trivy/db/metadata.json
cp /root/.cache/trivy/db/metadata.json $(ConvertTo-ShLiteral -Value "$wslEvidenceRoot/trivy-db-metadata.json")
"@

$baseReferences = @(
    'Dockerfile.api',
    'Dockerfile.worker'
) | ForEach-Object {
    $content = Get-Content -Raw -LiteralPath (Join-Path $appRoot $_)
    $match = [regex]::Match(
        $content,
        'ARG NODE_BASE_IMAGE=(?<repository>[a-zA-Z0-9./-]+):(?<tag>[a-zA-Z0-9.-]+)@(?<digest>sha256:[a-f0-9]{64})'
    )
    if (-not $match.Success) {
        throw "Pinned Node base image reference is missing from $_."
    }
    [pscustomobject]@{
        file = $_
        repository = $match.Groups['repository'].Value
        tag = $match.Groups['tag'].Value
        digest = $match.Groups['digest'].Value
    }
}
$baseDigests = @($baseReferences.digest | Sort-Object -Unique)
if ($baseDigests.Count -ne 1) {
    throw 'API and worker Dockerfiles do not use the same pinned Node base image digest.'
}
$baseRepositories = @($baseReferences.repository | Sort-Object -Unique)
if ($baseRepositories.Count -ne 1) {
    throw 'API and worker Dockerfiles do not use the same Node base image repository.'
}
$baseDigest = $baseDigests[0]
$baseRepository = $baseRepositories[0]
$baseManifestPath = "$wslEvidenceRoot/node-base-index.json"
Invoke-WslChecked -Command @"
set -eu
skopeo inspect --raw docker://$baseRepository@$baseDigest > $(ConvertTo-ShLiteral -Value $baseManifestPath)
"@
$baseManifest = Get-Content -Raw -LiteralPath (Join-Path $evidenceRoot 'node-base-index.json') |
    ConvertFrom-Json -Depth 100
$amd64Manifest = @(
    $baseManifest.manifests |
    Where-Object {
        $_.platform.os -eq 'linux' -and
        $_.platform.architecture -eq 'amd64'
    }
)
if ($amd64Manifest.Count -ne 1) {
    throw 'Pinned Node base image index does not contain exactly one linux/amd64 manifest.'
}

$definitions = @(
    [pscustomobject]@{
        name = 'api'
        dockerfile = 'Dockerfile.api'
        image = "localhost/stratton-api:$runId"
    },
    [pscustomobject]@{
        name = 'worker'
        dockerfile = 'Dockerfile.worker'
        image = "localhost/stratton-worker:$runId"
    }
)

$results = [Collections.Generic.List[object]]::new()
foreach ($definition in $definitions) {
    $app = ConvertTo-ShLiteral -Value $wslAppRoot
    $archive = "$wslOutputRoot/$($definition.name).docker.tar"
    $archiveLiteral = ConvertTo-ShLiteral -Value $archive
    $imageLiteral = ConvertTo-ShLiteral -Value $definition.image
    $dockerfileLiteral = ConvertTo-ShLiteral -Value $definition.dockerfile
    $sbom = "$wslEvidenceRoot/$($definition.name).sbom.cdx.json"
    $scan = "$wslEvidenceRoot/$($definition.name).trivy.json"

    Invoke-WslChecked -Command @"
set -eu
cd $app
podman build --pull=missing --timestamp=0 --platform linux/amd64 \
  --file $dockerfileLiteral --tag $imageLiteral .
podman save --format docker-archive --output $archiveLiteral $imageLiteral
syft "docker-archive:$archive" --output "cyclonedx-json=$sbom"
trivy image --input $archiveLiteral --scanners vuln,secret,license \
  --format json --output $(ConvertTo-ShLiteral -Value $scan) --timeout 15m --skip-db-update
"@

    $digestOutput = @(& wsl -d $WslDistribution -u root -- sh -lc `
        "skopeo inspect --format '{{.Os}}/{{.Architecture}} {{.Digest}}' containers-storage:$($definition.image)" 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to inspect image digest for $($definition.name)."
    }
    $imageInspection = ($digestOutput | ForEach-Object { $_.ToString().Trim() } |
        Where-Object { $_ -match '^linux/amd64 sha256:[a-f0-9]{64}$' } | Select-Object -Last 1)
    if ([string]::IsNullOrWhiteSpace($imageInspection)) {
        throw "No linux/amd64 immutable image digest was returned for $($definition.name)."
    }
    $digest = $imageInspection.Split(' ', 2)[1]

    $scanPath = Join-Path $evidenceRoot "$($definition.name).trivy.json"
    $sbomPath = Join-Path $evidenceRoot "$($definition.name).sbom.cdx.json"
    foreach ($requiredEvidence in $scanPath, $sbomPath) {
        if (-not (Test-Path -LiteralPath $requiredEvidence -PathType Leaf) -or
            (Get-Item -LiteralPath $requiredEvidence).Length -eq 0) {
            throw "Container evidence is missing or empty: $requiredEvidence"
        }
    }
    $scanDocument = Get-Content -Raw -LiteralPath $scanPath | ConvertFrom-Json -Depth 100
    $vulnerabilities = @(
        $scanDocument.Results |
        ForEach-Object {
            $property = $_.PSObject.Properties['Vulnerabilities']
            if ($null -ne $property) {
                @($property.Value)
            }
        } |
        Where-Object { $null -ne $_ -and $_.Severity -in 'HIGH', 'CRITICAL' }
    )
    $secrets = @(
        $scanDocument.Results |
        ForEach-Object {
            $property = $_.PSObject.Properties['Secrets']
            if ($null -ne $property) {
                @($property.Value)
            }
        } |
        Where-Object { $null -ne $_ }
    )
    $licenses = @(
        $scanDocument.Results |
        ForEach-Object {
            $property = $_.PSObject.Properties['Licenses']
            if ($null -ne $property) {
                @($property.Value)
            }
        } |
        Where-Object { $null -ne $_ }
    )

    $results.Add([pscustomobject][ordered]@{
        name = $definition.name
        image = $definition.image
        digest = $digest
        platform = 'linux/amd64'
        archive = "out/containers/$runId/$($definition.name).docker.tar"
        sbom = "evidence/containers/$runId/$($definition.name).sbom.cdx.json"
        scan = "evidence/containers/$runId/$($definition.name).trivy.json"
        highVulnerabilities = @($vulnerabilities | Where-Object Severity -eq 'HIGH').Count
        criticalVulnerabilities = @($vulnerabilities | Where-Object Severity -eq 'CRITICAL').Count
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
    })
}

$failed = @(
    $results |
    Where-Object {
        $_.highVulnerabilities -gt 0 -or
        $_.criticalVulnerabilities -gt 0 -or
        $_.secretFindings -gt 0
    }
)
$baseImageSummary = [ordered]@{
    reference = "$($baseReferences[0].repository):$($baseReferences[0].tag)@$baseDigest"
    indexDigest = $baseDigest
    amd64ManifestDigest = [string]$amd64Manifest[0].digest
    evidence = "evidence/containers/$runId/node-base-index.json"
}
$summaryPath = Join-Path $evidenceRoot 'summary.json'
if ($failed.Count -gt 0) {
    $failureSummary = [ordered]@{
        schemaVersion = '1.0.0'
        runId = $runId
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        status = 'FAIL'
        signing = [ordered]@{
            method = 'NOT_SIGNED'
            identityBacked = $false
            transparencyLogUploaded = $false
            reason = 'The vulnerability and secret gate failed before signing.'
        }
        baseImage = $baseImageSummary
        scannerDatabase = "evidence/containers/$runId/trivy-db-metadata.json"
        images = @($results)
    }
    Write-Utf8NoBom -Path $summaryPath -Content ($failureSummary | ConvertTo-Json -Depth 10)
    throw 'Container validation found HIGH/CRITICAL vulnerabilities or secret findings.'
}

$digestStatement = [ordered]@{
    schemaVersion = '1.0.0'
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    images = @($results | ForEach-Object {
        [ordered]@{
            name = $_.name
            digest = $_.digest
            platform = $_.platform
        }
    })
}
$digestStatementPath = Join-Path $evidenceRoot 'container-digests.json'
Write-Utf8NoBom -Path $digestStatementPath -Content ($digestStatement | ConvertTo-Json -Depth 6 -Compress)

$wslDigestStatement = Convert-ToWslPath -Path $digestStatementPath
$wslSignature = "$wslEvidenceRoot/container-digests.sig"
$wslPublicKey = "$wslEvidenceRoot/container-digests.pub"
$wslKeyDirectory = "/tmp/stratton-phase5-signing-$runId"
Invoke-WslChecked -Command @"
set -eu
rm -rf $(ConvertTo-ShLiteral -Value $wslKeyDirectory)
mkdir -p $(ConvertTo-ShLiteral -Value $wslKeyDirectory)
trap 'rm -rf $(ConvertTo-ShLiteral -Value $wslKeyDirectory)' EXIT
export COSIGN_PASSWORD=`$(head -c 48 /dev/urandom | base64 | tr -d '\n')
cosign generate-key-pair --output-key-prefix $(ConvertTo-ShLiteral -Value "$wslKeyDirectory/phase5") >/dev/null
cosign sign-blob --yes --tlog-upload=false --key $(ConvertTo-ShLiteral -Value "$wslKeyDirectory/phase5.key") \
  --output-signature $(ConvertTo-ShLiteral -Value $wslSignature) \
  $(ConvertTo-ShLiteral -Value $wslDigestStatement)
cp $(ConvertTo-ShLiteral -Value "$wslKeyDirectory/phase5.pub") $(ConvertTo-ShLiteral -Value $wslPublicKey)
cosign verify-blob --key $(ConvertTo-ShLiteral -Value $wslPublicKey) \
  --insecure-ignore-tlog \
  --signature $(ConvertTo-ShLiteral -Value $wslSignature) \
  $(ConvertTo-ShLiteral -Value $wslDigestStatement)
"@

$summary = [ordered]@{
    schemaVersion = '1.0.0'
    runId = $runId
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    status = 'PASS'
    signing = [ordered]@{
        method = 'ephemeral-local-cosign-key'
        identityBacked = $false
        transparencyLogUploaded = $false
        statement = "evidence/containers/$runId/container-digests.json"
        signature = "evidence/containers/$runId/container-digests.sig"
        publicKey = "evidence/containers/$runId/container-digests.pub"
        limitation = 'Local integrity evidence only; an approved release identity must sign any deployable registry artifact.'
    }
    baseImage = $baseImageSummary
    scannerDatabase = "evidence/containers/$runId/trivy-db-metadata.json"
    images = @($results)
}
Write-Utf8NoBom -Path $summaryPath -Content ($summary | ConvertTo-Json -Depth 10)

Write-Host "Container validation passed. Evidence: $summaryPath"
