[CmdletBinding()]
param(
  [string] $CaseRoot = 'C:\Users\arsmith\Projects\Agentic-Architecture-v2\cases\Stratton-Europe-Captital'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$demoPlatformRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$sourceRoot = Join-Path $demoPlatformRoot 'docs'
$packageRoot = Join-Path $CaseRoot 'stratton-demo-package'
$guideNames = @(
  'Stratton-Demo-Guide.html',
  'Stratton-Demo-Guide-SharePoint.html'
)

foreach ($guideName in $guideNames) {
  $sourcePath = Join-Path $sourceRoot $guideName
  if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "GUIDE_SOURCE_MISSING:$sourcePath"
  }

  # These are the only destinations this script is allowed to change.
  $destinations = @(
    (Join-Path $CaseRoot $guideName),
    (Join-Path $packageRoot $guideName)
  )

  foreach ($destinationPath in $destinations) {
    $destinationDirectory = Split-Path -Parent $destinationPath
    if (-not (Test-Path -LiteralPath $destinationDirectory -PathType Container)) {
      throw "GUIDE_DESTINATION_DIRECTORY_MISSING:$destinationDirectory"
    }

    Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force

    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $destinationPath -Algorithm SHA256).Hash
    if ($sourceHash -cne $destinationHash) {
      throw "GUIDE_HASH_MISMATCH:${guideName}:$destinationPath"
    }

    Write-Host "GUIDE_SYNCED:${guideName}:${destinationHash}:$destinationPath"
  }
}
