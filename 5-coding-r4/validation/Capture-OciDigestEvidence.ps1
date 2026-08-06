[CmdletBinding()]
param(
    [string]$BicepRoot = (Join-Path $PSScriptRoot '..\infra'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\evidence\dependency-evidence.json')
)

$ErrorActionPreference = 'Stop'
$resolvedRoot = (Resolve-Path -LiteralPath $BicepRoot).Path
$modulePattern = 'br/public:(?<repository>avm/[a-z0-9./-]+):(?<tag>[0-9]+\.[0-9]+\.[0-9]+)'
$references = Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File -Include *.bicep,*.bicepparam |
    ForEach-Object {
        [regex]::Matches((Get-Content -Raw -LiteralPath $_.FullName), $modulePattern) |
            ForEach-Object {
                [pscustomobject]@{
                    module = $_.Value
                    repository = "bicep/$($_.Groups['repository'].Value)"
                    tag = $_.Groups['tag'].Value
                }
            }
    } |
    Sort-Object module -Unique

$accept = 'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json'
$records = foreach ($reference in $references) {
    $endpoint = "https://mcr.microsoft.com/v2/$($reference.repository)/manifests/$($reference.tag)"
    $response = Invoke-WebRequest -Uri $endpoint -Method Get -Headers @{ Accept = $accept } -SkipHttpErrorCheck
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
        throw "MCR manifest lookup failed for $($reference.module): HTTP $($response.StatusCode)"
    }

    $digest = [string]$response.Headers['Docker-Content-Digest']
    if ([string]::IsNullOrWhiteSpace($digest) -or $digest -notmatch '^sha256:[a-f0-9]{64}$') {
        throw "MCR did not return a valid Docker-Content-Digest for $($reference.module)"
    }

    [ordered]@{
        module = $reference.module
        tag = $reference.tag
        dockerContentDigest = $digest
        endpoint = $endpoint
        retrievedAt = (Get-Date).ToString('o')
    }
}

$document = [ordered]@{
    schemaVersion = '1.0.0'
    registry = 'mcr.microsoft.com'
    source = 'MCR Distribution manifest endpoint'
    generatedAt = (Get-Date).ToString('o')
    moduleCount = @($records).Count
    modules = @($records)
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$json = ConvertTo-Json -InputObject $document -Depth 8
[IO.File]::WriteAllText(
    [IO.Path]::GetFullPath($OutputPath),
    $json,
    [Text.UTF8Encoding]::new($false)
)
