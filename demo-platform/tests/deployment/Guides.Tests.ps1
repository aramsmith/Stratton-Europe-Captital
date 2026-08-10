Set-StrictMode -Version Latest

Describe 'Standalone deployment guides' {
  BeforeAll {
    $demoPlatformRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $docsRoot = Join-Path $demoPlatformRoot 'docs'
    $guide = Get-Content -LiteralPath (Join-Path $docsRoot 'Stratton-Demo-Guide.html') -Raw
    $sharePointGuide = Get-Content -LiteralPath (Join-Path $docsRoot 'Stratton-Demo-Guide-SharePoint.html') -Raw
    $syncScript = Get-Content -LiteralPath (Join-Path $demoPlatformRoot 'scripts\deployment\Sync-StrattonGuides.ps1') -Raw
  }

  It 'preserves the presenter guide content in both editions' {
    foreach ($document in @($guide, $sharePointGuide)) {
      $document | Should -Match 'Project Danube: evidence to draft committee pack'
      $document | Should -Match 'Prompt-injection resistance'
      $document | Should -Match 'Run the complete local verification gate'
      $document | Should -Match 'Controlled Azure deployment'
    }
  }

  It 'documents the approved standalone target, topology, and cost posture in both editions' {
    foreach ($document in @($guide, $sharePointGuide)) {
      $document | Should -Match 'MoA-Sub2'
      $document | Should -Match '8364fb4d-2d36-4da5-908b-36cb8b808b8c'
      $document | Should -Match '27140306-eea5-4e7f-91e9-4c9e86864b3a'
      $document | Should -Match 'westeurope'
      $document | Should -Match 'stratton-demo-rg'
      $document | Should -Match 'Backend for Frontend'
      $document | Should -Match 'public web'
      $document | Should -Match 'internal BFF'
      $document | Should -Match 'internal Phase 5'
      $document | Should -Match 'managed identities'
      $document | Should -Match 'Azure SQL'
      $document | Should -Match 'Luna, Terra, and Sol'
      $document | Should -Match 'minimum-cost development'
    }
  }

  It 'documents all seven controlled stages, what-if gates, and Danube verification in both editions' {
    foreach ($document in @($guide, $sharePointGuide)) {
      foreach ($stage in @(
          'Preflight',
          'Platform foundation',
          'Entra foundation',
          'Image build',
          'Data-plane bootstrap',
          'Application deployment',
          'Verification'
        )) {
        $document | Should -Match $stage
      }

      $document | Should -Match 'Azure what-if'
      $document | Should -Match 'fail closed'
      $document | Should -Match 'Project Danube'
    }
  }

  It 'preserves the Clawpilot theme foundation in both editions' {
    foreach ($document in @($guide, $sharePointGuide)) {
      $document | Should -Match '--cp-bg: #f7f4ef'
      $document | Should -Match 'html\[data-theme="dark"\]'
      $document | Should -Match '"Segoe UI", Aptos'
    }

    $guide | Should -Match 'scoutTheme'
  }

  It 'keeps the SharePoint edition self-contained and sandbox-safe' {
    $sharePointGuide | Should -Not -Match '<script\b'
    $sharePointGuide | Should -Not -Match '<link[^>]+href=|<(?:iframe|object|embed)\b'
    $sharePointGuide | Should -Not -Match '\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\('
    $sharePointGuide | Should -Not -Match '\b(?:localStorage|sessionStorage|indexedDB|navigator\.serviceWorker|window\.(?:location|open|history)|document\.location|history\.)'
    $sharePointGuide | Should -Not -Match '<form\b|<[^>]+\son[a-z]+\s*='
    $sharePointGuide | Should -Not -Match '<(?:img|audio|video|source)\b[^>]*\bsrc='
  }

  It 'synchronizes only the named guides and verifies SHA-256 copies' {
    $syncScript | Should -Match "Stratton-Demo-Guide\.html"
    $syncScript | Should -Match "Stratton-Demo-Guide-SharePoint\.html"
    $syncScript | Should -Match 'Copy-Item'
    $syncScript | Should -Match 'Get-FileHash'
    $syncScript | Should -Match 'GUIDE_HASH_MISMATCH'
    $syncScript | Should -Not -Match 'Get-ChildItem|Copy-Item\s+[^\r\n]*\*'
  }

  It 'parses the synchronization script before it can copy files' {
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseInput(
      $syncScript,
      'Sync-StrattonGuides.ps1',
      [ref] $null,
      [ref] $parseErrors
    ) | Out-Null

    @($parseErrors) | Should -BeNullOrEmpty
  }
}
