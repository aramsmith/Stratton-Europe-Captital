[CmdletBinding()]
param(
    [string]$PackageRoot = (Join-Path $PSScriptRoot '..'),
    [string]$ArtifactPrefix = 'stratton'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $PackageRoot).Path
$markdownPath = Join-Path $resolvedRoot "$ArtifactPrefix-build-report.md"
$htmlPath = Join-Path $resolvedRoot "$ArtifactPrefix-build-report.html"
$releasePath = Join-Path $resolvedRoot "$ArtifactPrefix-release-manifest.json"

function Write-Utf8NoBom {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Content)
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

function ConvertTo-HtmlText {
    param([AllowEmptyString()][string]$Value)
    return [Net.WebUtility]::HtmlEncode($Value)
}

if (-not (Test-Path -LiteralPath $releasePath -PathType Leaf)) {
    throw "Release manifest is missing: $releasePath"
}
$release = Get-Content -Raw -LiteralPath $releasePath | ConvertFrom-Json -Depth 100
if (
    $release.azureExecution.authenticated -ne $false -or
    $release.azureExecution.validateExecuted -ne $false -or
    $release.azureExecution.whatIfExecuted -ne $false -or
    $release.azureExecution.deploymentExecuted -ne $false
) {
    throw 'Build report generation refuses release evidence that records an Azure execution.'
}

$validationRecord = Get-ChildItem -LiteralPath (Join-Path $resolvedRoot 'evidence\local-validation') `
        -Filter index.json -Recurse -File -ErrorAction SilentlyContinue |
    ForEach-Object {
        $document = Get-Content -Raw -LiteralPath $_.FullName | ConvertFrom-Json -Depth 100
        if ($document.scope -eq 'All') {
            [pscustomobject]@{ file = $_; document = $document }
        }
    } |
    Sort-Object { $_.file.LastWriteTimeUtc } |
    Select-Object -Last 1
if ($null -eq $validationRecord -or $validationRecord.document.status -ne 'PASS') {
    throw 'The latest full local validation run is absent or not PASS.'
}
$validationRelativePath = Get-NormalizedRelativePath -FullName $validationRecord.file.FullName
if ([string]$release.validation.evidence -cne $validationRelativePath) {
    throw 'Release manifest and build report do not reference the same validation run.'
}

$containerSummaryPath = Join-Path $resolvedRoot ([string]$release.dependencyEvidence.containerSummary)
if (-not (Test-Path -LiteralPath $containerSummaryPath -PathType Leaf)) {
    throw 'Release manifest container summary is missing.'
}
$containerSummary = Get-Content -Raw -LiteralPath $containerSummaryPath | ConvertFrom-Json -Depth 100
if ($containerSummary.status -ne 'PASS') {
    throw 'Release manifest container summary is not PASS.'
}

$sourceSummaryPath = Join-Path $resolvedRoot ([string]$release.dependencyEvidence.sourceSecuritySummary)
if (-not (Test-Path -LiteralPath $sourceSummaryPath -PathType Leaf)) {
    throw 'Release manifest source-security summary is missing.'
}
$sourceSummary = Get-Content -Raw -LiteralPath $sourceSummaryPath | ConvertFrom-Json -Depth 100
if ($sourceSummary.status -ne 'PASS') {
    throw 'Release manifest source-security summary is not PASS.'
}

$generatedAt = (Get-Date).ToUniversalTime().ToString('o')
$inventory = @(
    $release.files |
    Group-Object { ([string]$_.path).Split('/')[0] } |
    Sort-Object Name |
    ForEach-Object {
        [pscustomobject]@{
            area = $_.Name
            count = $_.Count
        }
    }
)
$validationSteps = @($validationRecord.document.steps)
$images = @($containerSummary.images | Sort-Object name)
$authorityConflicts = @($release.authorityConflicts)
$unresolvedControls = @($release.unresolvedControls)
$worktreeStatus = @($release.source.worktreeStatus)

$inventoryMarkdown = ($inventory | ForEach-Object { "- ``$($_.area)/``: $($_.count) files" }) -join "`n"
$validationMarkdown = ($validationSteps | ForEach-Object {
    "- **$($_.stepId):** $($_.status) - [$($_.redactedLog)]($($_.redactedLog))"
}) -join "`n"
$imageMarkdown = ($images | ForEach-Object {
    "- **$($_.name):** ``$($_.digest)`` on ``$($_.platform)``; HIGH $($_.highVulnerabilities), CRITICAL $($_.criticalVulnerabilities), secrets $($_.secretFindings); [SBOM]($($_.sbom)), [scan]($($_.scan))"
}) -join "`n"
$authorityMarkdown = if ($authorityConflicts.Count -eq 0) {
    '- None recorded.'
}
else {
    ($authorityConflicts | ForEach-Object { "- ``$_``" }) -join "`n"
}
$controlsMarkdown = if ($unresolvedControls.Count -eq 0) {
    '- None recorded.'
}
else {
    ($unresolvedControls | ForEach-Object { "- ``$_``" }) -join "`n"
}
$worktreeMarkdown = if ($worktreeStatus.Count -eq 0) {
    '- No status entries recorded.'
}
else {
    ($worktreeStatus | ForEach-Object { "- ``$($_.Replace('`', '``'))``" }) -join "`n"
}

$markdown = @"
# Stratton Phase 5 build report

Generated: $generatedAt

## Outcome

- Candidate status: **$($release.candidateStatus)**
- Deployment ready: **$($release.deploymentReady)**
- Full local validation: **$($validationRecord.document.status)** (run $($validationRecord.document.runId))
- Azure authenticated, validated, what-if, or deployed: **No**
- Release manifest: [$ArtifactPrefix-release-manifest.json]($ArtifactPrefix-release-manifest.json)

The package is implementation and assurance evidence only. It does not authorise Azure access,
what-if, deployment, production signing, runtime testing, compliance certification, or owner-value
substitution.

## Inventory

$inventoryMarkdown

The release manifest binds $($release.files.Count) deployable source files and all 17 implementation
units. The final Phase 5 hash manifest is generated after this report and binds the report, release
manifest, package source, and only the evidence referenced by this candidate.

## Validation

$validationMarkdown

Validation index: [$validationRelativePath]($validationRelativePath)

## Security and supply chain

$imageMarkdown

- Source scan: **$($sourceSummary.status)**; HIGH vulnerabilities $($sourceSummary.highVulnerabilities), CRITICAL vulnerabilities $($sourceSummary.criticalVulnerabilities), HIGH misconfigurations $($sourceSummary.highMisconfigurations), CRITICAL misconfigurations $($sourceSummary.criticalMisconfigurations), secrets $($sourceSummary.secretFindings). [Summary]($($release.dependencyEvidence.sourceSecuritySummary))
- Container digest statement: [$($containerSummary.signing.statement)]($($containerSummary.signing.statement))
- Signing boundary: $($containerSummary.signing.limitation)
- Transparency-log upload: **$($containerSummary.signing.transparencyLogUploaded)**

## Traceability and release integrity

- Approved Phase 4 manifest: ``$($release.upstream.phase4ManifestSha256)``
- Phase 4 approval: ``$($release.upstream.phase4ApprovalId)``
- Phase 5 model-plan revision: ``$($release.upstream.modelPlanRevision)``
- Phase 5 model plan: ``$($release.upstream.phase5ModelPlan.path)`` / ``$($release.upstream.phase5ModelPlan.sha256)``
- Authority change control: ``$($release.authorityChangeControl.changeControlId)`` / ``$($release.authorityChangeControl.status)``
- Authority approval: ``$($release.authorityChangeControl.approval.path)`` / ``$($release.authorityChangeControl.approval.sha256)``
- Authority model plan: ``$($release.authorityChangeControl.modelPlan.path)`` / ``$($release.authorityChangeControl.modelPlan.sha256)``
- Source commit: ``$($release.source.commit)``
- Commit scope: ``$($release.source.commitScope)``
- Case package tracked by Git: **$($release.source.worktreeTracked)**
- Case package dirty or locally generated: **$($release.source.worktreeDirty)**

$worktreeMarkdown

## Authority gates

$authorityMarkdown

## Residual owner controls

$controlsMarkdown

## Limitations

- No Azure login, target validation, what-if, deployment, or cloud runtime test was executed.
- Local Cosign evidence uses an ephemeral non-production key; an authorised release identity must sign any registry artifact.
- Production tenant, subscription, region, network, identity, retention, model, quota, source, legal, and regulatory values remain fail-closed owner inputs.
- The seven approved residual controls remain open unless separate accountable-owner evidence resolves them.
"@

$inventoryRows = ($inventory | ForEach-Object {
    "<tr><td><code>$(ConvertTo-HtmlText -Value ($_.area + '/'))</code></td><td>$($_.count)</td></tr>"
}) -join "`n"
$validationRows = ($validationSteps | ForEach-Object {
    $stepId = ConvertTo-HtmlText -Value ([string]$_.stepId)
    $status = ConvertTo-HtmlText -Value ([string]$_.status)
    $log = ConvertTo-HtmlText -Value ([string]$_.redactedLog)
    "<tr><td><code>$stepId</code></td><td class=""success"">$status</td><td><a href=""$log"">redacted evidence</a></td></tr>"
}) -join "`n"
$imageRows = ($images | ForEach-Object {
    $name = ConvertTo-HtmlText -Value ([string]$_.name)
    $digest = ConvertTo-HtmlText -Value ([string]$_.digest)
    $platform = ConvertTo-HtmlText -Value ([string]$_.platform)
    $sbom = ConvertTo-HtmlText -Value ([string]$_.sbom)
    $scan = ConvertTo-HtmlText -Value ([string]$_.scan)
    "<tr><td>$name</td><td><code>$digest</code></td><td><code>$platform</code></td><td>$($_.highVulnerabilities) / $($_.criticalVulnerabilities) / $($_.secretFindings)</td><td><a href=""$sbom"">SBOM</a> &middot; <a href=""$scan"">scan</a></td></tr>"
}) -join "`n"
$authorityItems = if ($authorityConflicts.Count -eq 0) {
    '<li>None recorded.</li>'
}
else {
    ($authorityConflicts | ForEach-Object { "<li><code>$(ConvertTo-HtmlText -Value ([string]$_))</code></li>" }) -join "`n"
}
$controlItems = if ($unresolvedControls.Count -eq 0) {
    '<li>None recorded.</li>'
}
else {
    ($unresolvedControls | ForEach-Object { "<li><code>$(ConvertTo-HtmlText -Value ([string]$_))</code></li>" }) -join "`n"
}
$worktreeItems = if ($worktreeStatus.Count -eq 0) {
    '<li>No status entries recorded.</li>'
}
else {
    ($worktreeStatus | ForEach-Object { "<li><code>$(ConvertTo-HtmlText -Value ([string]$_))</code></li>" }) -join "`n"
}

$html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Stratton Phase 5 Build Report</title>
  <script>
    (() => {
      const param = new URLSearchParams(window.location.search).get("scoutTheme");
      const theme =
        param || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", theme);
    })();
  </script>
  <style>
    :root {
      color-scheme: light;
      --cp-bg: #f7f4ef;
      --cp-bg-elevated: #fcfbf8;
      --cp-surface: #ffffff;
      --cp-surface-soft: #f5f5f5;
      --cp-border: #dedede;
      --cp-border-strong: #919191;
      --cp-text: #242424;
      --cp-text-muted: #5c5c5c;
      --cp-text-soft: #6f6f6f;
      --cp-accent: #b11f4b;
      --cp-accent-hover: #9a1a41;
      --cp-accent-soft: rgba(177, 31, 75, 0.08);
      --cp-accent-fg: #ffffff;
      --cp-success: #16a34a;
      --cp-danger: #dc2626;
      --cp-warning: #f59e0b;
      --cp-link: #0078d4;
      --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.12);
      --cp-overlay: rgba(255, 255, 255, 0.8);
      --cp-panel: rgba(255, 255, 255, 0.86);
      --cp-panel-strong: rgba(255, 255, 255, 0.96);
      --cp-sheen: rgba(255, 255, 255, 0.55);
      --cp-highlight: rgba(177, 31, 75, 0.12);
    }
    html[data-theme="dark"] {
      color-scheme: dark;
      --cp-bg: #3d3b3a;
      --cp-bg-elevated: #343231;
      --cp-surface: #292929;
      --cp-surface-soft: #2e2e2e;
      --cp-border: #474747;
      --cp-border-strong: #5f5f5f;
      --cp-text: #dedede;
      --cp-text-muted: #919191;
      --cp-text-soft: #b0b0b0;
      --cp-accent: #fd8ea1;
      --cp-accent-hover: #fb7b91;
      --cp-accent-soft: rgba(253, 142, 161, 0.14);
      --cp-accent-fg: #1a1a1a;
      --cp-success: #4ade80;
      --cp-danger: #f87171;
      --cp-warning: #fbbf24;
      --cp-link: #4da6ff;
      --cp-shadow: 0 18px 48px rgba(0, 0, 0, 0.32);
      --cp-overlay: rgba(41, 41, 41, 0.88);
      --cp-panel: rgba(41, 41, 41, 0.72);
      --cp-panel-strong: rgba(41, 41, 41, 0.96);
      --cp-sheen: rgba(255, 255, 255, 0.04);
      --cp-highlight: rgba(253, 142, 161, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--cp-bg);
      color: var(--cp-text);
      font-family: "Segoe UI", Aptos, Calibri, -apple-system, BlinkMacSystemFont, sans-serif;
    }
    main { width: min(1120px, calc(100% - 32px)); margin: 0 auto; padding: 32px 0 48px; }
    h1, h2, p { margin-top: 0; }
    h1 { margin-bottom: 8px; }
    h2 { margin-bottom: 12px; font-size: 1.15rem; }
    a { color: var(--cp-link); }
    code { font-family: Consolas, "Courier New", Courier, monospace; overflow-wrap: anywhere; }
    .muted { color: var(--cp-text-muted); }
    .eyebrow { color: var(--cp-accent); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
    .card {
      background: var(--cp-surface);
      border: 1px solid var(--cp-border);
      border-radius: 16px;
      box-shadow: var(--cp-shadow);
      padding: 20px;
    }
    .wide { grid-column: 1 / -1; }
    .metric { color: var(--cp-accent); font-size: 1.5rem; font-weight: 750; }
    .success { color: var(--cp-success); font-weight: 700; }
    .warning { color: var(--cp-warning); font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px 8px; border-bottom: 1px solid var(--cp-border); text-align: left; vertical-align: top; }
    th { color: var(--cp-text-muted); font-size: 0.78rem; text-transform: uppercase; }
    ul { margin: 0; padding-left: 20px; }
    li + li { margin-top: 6px; }
    @media (max-width: 760px) {
      .grid { grid-template-columns: 1fr; }
      .wide { grid-column: auto; }
      .table-wrap { overflow-x: auto; }
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Agentic Architecture Factory &middot; Phase 5</div>
    <h1>Stratton build report</h1>
    <p class="muted">Generated $(ConvertTo-HtmlText -Value $generatedAt). Local implementation and assurance evidence only.</p>

    <section class="grid">
      <article class="card">
        <h2>Outcome</h2>
        <div class="metric">$(ConvertTo-HtmlText -Value ([string]$release.candidateStatus))</div>
        <p>Full local validation: <span class="success">$(ConvertTo-HtmlText -Value ([string]$validationRecord.document.status))</span></p>
        <p>Deployment ready: <strong>$(ConvertTo-HtmlText -Value ([string]$release.deploymentReady))</strong></p>
        <p><a href="$ArtifactPrefix-release-manifest.json">Release manifest</a> &middot; <a href="$(ConvertTo-HtmlText -Value $validationRelativePath)">Validation index</a></p>
      </article>
      <article class="card">
        <h2>Release boundary</h2>
        <p>No Azure login, target validation, what-if, deployment, production signing, or cloud runtime test was executed.</p>
        <p class="warning">Owner values and human approvals remain fail-closed.</p>
      </article>

      <article class="card">
        <h2>Inventory</h2>
        <table><thead><tr><th>Area</th><th>Files</th></tr></thead><tbody>$inventoryRows</tbody></table>
        <p class="muted">$($release.files.Count) deployable source files; 17 implementation units.</p>
      </article>
      <article class="card">
        <h2>Traceability</h2>
        <p>Phase 4 manifest: <code>$(ConvertTo-HtmlText -Value ([string]$release.upstream.phase4ManifestSha256))</code></p>
        <p>Approval: <code>$(ConvertTo-HtmlText -Value ([string]$release.upstream.phase4ApprovalId))</code></p>
        <p>Model plan: revision <code>$($release.upstream.modelPlanRevision)</code></p>
        <p>Phase 5 model plan: <code>$(ConvertTo-HtmlText -Value ([string]$release.upstream.phase5ModelPlan.sha256))</code></p>
        <p>Authority change control: <code>$(ConvertTo-HtmlText -Value ([string]$release.authorityChangeControl.changeControlId))</code></p>
        <p>Authority approval: <code>$(ConvertTo-HtmlText -Value ([string]$release.authorityChangeControl.approval.sha256))</code></p>
        <p>Authority model plan: <code>$(ConvertTo-HtmlText -Value ([string]$release.authorityChangeControl.modelPlan.sha256))</code></p>
        <p>Source commit: <code>$(ConvertTo-HtmlText -Value ([string]$release.source.commit))</code></p>
        <p>Commit scope: <code>$(ConvertTo-HtmlText -Value ([string]$release.source.commitScope))</code></p>
      </article>

      <article class="card wide">
        <h2>Validation</h2>
        <div class="table-wrap"><table><thead><tr><th>Step</th><th>Status</th><th>Evidence</th></tr></thead><tbody>$validationRows</tbody></table></div>
      </article>

      <article class="card wide">
        <h2>Container security and supply chain</h2>
        <div class="table-wrap"><table><thead><tr><th>Image</th><th>Digest</th><th>Platform</th><th>HIGH / CRITICAL / secrets</th><th>Evidence</th></tr></thead><tbody>$imageRows</tbody></table></div>
        <p>Local signing: $(ConvertTo-HtmlText -Value ([string]$containerSummary.signing.limitation))</p>
      </article>

      <article class="card">
        <h2>Source security</h2>
        <p class="success">PASS</p>
        <p>HIGH vulnerabilities $($sourceSummary.highVulnerabilities); CRITICAL vulnerabilities $($sourceSummary.criticalVulnerabilities); HIGH misconfigurations $($sourceSummary.highMisconfigurations); CRITICAL misconfigurations $($sourceSummary.criticalMisconfigurations); secrets $($sourceSummary.secretFindings).</p>
        <p><a href="$(ConvertTo-HtmlText -Value ([string]$release.dependencyEvidence.sourceSecuritySummary))">Source-security summary</a></p>
      </article>
      <article class="card">
        <h2>Source state</h2>
        <p>Tracked by Git: <strong>$($release.source.worktreeTracked)</strong></p>
        <p>Dirty or locally generated: <strong>$($release.source.worktreeDirty)</strong></p>
        <ul>$worktreeItems</ul>
      </article>

      <article class="card">
        <h2>Authority gates</h2>
        <ul>$authorityItems</ul>
      </article>
      <article class="card">
        <h2>Residual owner controls</h2>
        <ul>$controlItems</ul>
      </article>

      <article class="card wide">
        <h2>Limitations</h2>
        <ul>
          <li>No Azure operation or cloud runtime test is evidenced.</li>
          <li>Local Cosign evidence is non-production; registry signing requires an authorised release identity.</li>
          <li>Production configuration and legal or regulatory claims require accountable-owner evidence.</li>
          <li>The final self-excluding Phase 5 hash manifest is generated after this report and binds it.</li>
        </ul>
      </article>
    </section>
  </main>
</body>
</html>
"@

Write-Utf8NoBom -Path $markdownPath -Content $markdown.TrimEnd()
Write-Utf8NoBom -Path $htmlPath -Content $html.TrimEnd()
Write-Host "Build reports written: $markdownPath and $htmlPath"
