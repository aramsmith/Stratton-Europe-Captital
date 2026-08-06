$ErrorActionPreference = 'Stop'

$ExpectedAssertions = @(
  'environment is exactly dev, tst or prd',
  'prd location is present in the signed approvedLocation list',
  'primary and recovery regions are present, distinct and in the same signed approvedLocation evidence',
  'Azure AI deployment type is regional and never Global or DataZone',
  'Citadel management, connectivity, AI-governance, nonproduction, production and assurance subscription IDs are distinct',
  'all SQL servers set publicNetworkAccess=Disabled',
  'every SQL database explicitly sets requestedBackupStorageRedundancy; prd accepts only Local or Zone after capability evidence and rejects Geo and GeoZone unless a later approved design proves the paired region is signed-approved',
  'API Management publicNetworkAccess=Disabled is admitted only after approved private endpoint and central private DNS proof; public gateway fallback is prohibited',
  'App Configuration public network access is Disabled in every environment',
  'all storage accounts disallow blob public access and public network access',
  'all supported data and AI services disable public network access',
  'Microsoft.Network/EnableApplicationGatewayNetworkIsolation is Registered in every private-only Application Gateway target subscription before ingress admission',
  'no workload public IP; only Citadel regional Firewall Premium public egress IPs are allowed in the connectivity subscription',
  'nonproduction dataClassification is synthetic',
  'production uses a distinct subscription and VNet from nonproduction',
  'production primary and recovery spokes connect only to their corresponding Citadel regional hub',
  'no environment-to-environment peering',
  'managed identity is enabled and secret-based authentication parameters do not exist',
  'audit and verdict immutability capability is enabled before data admission',
  'AI fine-tuning and Global/DataZone deployment flags are false unless a later approved design change says otherwise',
  'rollout admission maximum remains 20',
  'tags environment, workload, owner, costCenter, dataClassification, criticality and managedBy are present'
)

Describe 'Stratton IaC validation' {
  BeforeAll {
    $testsRoot = (Resolve-Path $PSScriptRoot).Path
    $infraRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\infra')).Path
    $preflightScript = Join-Path $testsRoot 'Invoke-DeploymentPreflight.ps1'

    $fixtureValid = Join-Path $testsRoot 'fixtures\preflight-valid.json'
    $fixtureInvalidSentinel = Join-Path $testsRoot 'fixtures\preflight-invalid-sentinel.json'
    $fixtureInvalidAssertion = Join-Path $testsRoot 'fixtures\preflight-invalid-assertion.json'
    $fixtureInvalidCc001PendingEnable = Join-Path $testsRoot 'fixtures\preflight-invalid-cc001-pending-enable.json'
    $fixtureInvalidCc001ApprovedEvidence = Join-Path ([IO.Path]::GetTempPath()) ("stratton-cc001-invalid-" + [guid]::NewGuid().ToString('N') + '.json')

    function Invoke-AzBicep {
      param([string[]]$CommandArgs)
      $env:BICEP_CLI_DISABLE_VERSION_CHECK = 'true'
      $o = & az bicep @CommandArgs 2>&1
      $lines = @($o | ForEach-Object { $_.ToString() } | Where-Object { $_ -notmatch '^WARNING: A new Bicep release is available' })
      [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $lines; Text = ($lines -join "`n") }
    }

    function Assert-Clean {
      param([string[]]$CommandArgs,[string]$Context)
      $r = Invoke-AzBicep -CommandArgs $CommandArgs
      $warnings = @($r.Output | Where-Object { $_ -match '(?i)\bwarning\b|BCP\d{3}' })
      $r.ExitCode | Should -Be 0 -Because "$Context must compile/lint"
      $warnings.Count | Should -Be 0 -Because "$Context must be warning-free"
      return $r
    }

    function Build-Template {
      param([string]$File)
      $r = Assert-Clean -CommandArgs @('build','--file',$File,'--stdout') -Context $File
      return ($r.Text | ConvertFrom-Json -Depth 100)
    }

    function Get-ResourceArray {
      param($Template)
      if ($Template.resources -is [System.Collections.IDictionary]) { return @($Template.resources.Values) }
      return @($Template.resources)
    }

    function Invoke-Preflight {
      param(
        [string]$FixturePath,
        [string]$BicepParamPath,
        [string]$DeploymentUnitId,
        [string]$Environment,
        [string]$RuntimeTenantId
      )

      $args = @('-NoProfile','-File',$preflightScript,'-OutputJson')
      if ($FixturePath) {
        $args += @('-ParameterObjectFile',$FixturePath)
      }
      if ($BicepParamPath) {
        $args += @('-BicepParamFile',$BicepParamPath)
      }
      if ($DeploymentUnitId) { $args += @('-DeploymentUnitId',$DeploymentUnitId) }
      if ($Environment) { $args += @('-Environment',$Environment) }
      if ($RuntimeTenantId) { $args += @('-RuntimeTenantId',$RuntimeTenantId) }

      $raw = & pwsh @args 2>&1
      $text = ($raw | ForEach-Object { $_.ToString() } | Out-String).Trim()
      $obj = $null
      if ($text.StartsWith('{')) {
        $obj = $text | ConvertFrom-Json -Depth 100
      }
      [pscustomobject]@{ ExitCode=$LASTEXITCODE; Text=$text; Json=$obj }
    }

    $invalidApprovedEvidence = Get-Content -Raw -LiteralPath $fixtureValid | ConvertFrom-Json -Depth 100
    $invalidApprovedEvidence.du16.pendingAuthorityAmendment.approvalEvidenceHash = ('0' * 64)
    [IO.File]::WriteAllText(
      $fixtureInvalidCc001ApprovedEvidence,
      ($invalidApprovedEvidence | ConvertTo-Json -Depth 100),
      [Text.UTF8Encoding]::new($false)
    )

    $preflightValid = Invoke-Preflight -FixturePath $fixtureValid
    $preflightInvalidSentinel = Invoke-Preflight -FixturePath $fixtureInvalidSentinel
    $preflightInvalidAssertion = Invoke-Preflight -FixturePath $fixtureInvalidAssertion
    $preflightInvalidCc001PendingEnable = Invoke-Preflight -FixturePath $fixtureInvalidCc001PendingEnable
    $preflightInvalidCc001ApprovedEvidence = Invoke-Preflight -FixturePath $fixtureInvalidCc001ApprovedEvidence

    $script:PreflightAssertions = @()
    if ($preflightValid.ExitCode -eq 0 -and $preflightValid.Json) {
      $script:PreflightAssertions = @($preflightValid.Json.assertions)
    }

    $rootTemplate = Build-Template -File (Join-Path $infraRoot 'main.bicep')
    $du12Template = Build-Template -File (Join-Path $infraRoot 'deployments\DU-12\main.bicep')
    $du14Template = Build-Template -File (Join-Path $infraRoot 'modules\apim-lockdown\main.bicep')
    $du15Template = Build-Template -File (Join-Path $infraRoot 'modules\ingress\main.bicep')
    $du16Template = Build-Template -File (Join-Path $infraRoot 'deployments\DU-16\main.bicep')
    $du17Template = Build-Template -File (Join-Path $infraRoot 'modules\diagnostics\main.bicep')
    $applicationPlatformTemplate = Build-Template -File (Join-Path $infraRoot 'modules\application-platform\main.bicep')
    $assuranceModuleTemplate = Build-Template -File (Join-Path $infraRoot 'modules\assurance\main.bicep')
    $dataModuleTemplate = Build-Template -File (Join-Path $infraRoot 'modules\data\main.bicep')

    $allBicepFiles = Get-ChildItem -Path $infraRoot -Recurse -Filter '*.bicep'
    $allParamFiles = Get-ChildItem -Path (Join-Path $infraRoot 'parameters') -Filter '*.bicepparam'
  }

  AfterAll {
    Remove-Item -LiteralPath $fixtureInvalidCc001ApprovedEvidence -Force -ErrorAction SilentlyContinue
  }

  It 'builds every bicep file warning-free' {
    $allBicepFiles | ForEach-Object {
      Assert-Clean -CommandArgs @('build','--file',$_.FullName,'--stdout') -Context $_.FullName | Out-Null
    }
  }

  It 'lints every bicep file warning-free' {
    $allBicepFiles | ForEach-Object {
      Assert-Clean -CommandArgs @('lint','--file',$_.FullName) -Context $_.FullName | Out-Null
    }
  }

  It 'builds every bicepparam file warning-free' {
    $allParamFiles | ForEach-Object {
      Assert-Clean -CommandArgs @('build-params','--file',$_.FullName,'--stdout') -Context $_.FullName | Out-Null
    }
  }

  It 'keeps DU-16 out of root allowed deploymentUnitId values and uses separate assurance entrypoint' {
    $rootTemplate.parameters.deploymentUnitId.allowedValues | Should -Not -Contain 'DU-16'
    Test-Path (Join-Path $infraRoot 'assurance-main.bicep') | Should -BeTrue
  }

  It 'uses exact authority scopes across DU entrypoints' {
    $scopeMap = @{}
    Get-ChildItem -Path (Join-Path $infraRoot 'deployments') -Directory | ForEach-Object {
      $t = Build-Template -File (Join-Path $_.FullName 'main.bicep')
      $scopeMap[$_.Name] = $t.'$schema'
      $t.parameters | Should -Not -BeNullOrEmpty
    }
    (Get-Content (Join-Path $infraRoot 'deployments\DU-01\main.bicep') -TotalCount 1) | Should -Match "targetScope = 'tenant'"
    (Get-Content (Join-Path $infraRoot 'deployments\DU-02\main.bicep') -TotalCount 1) | Should -Match "targetScope = 'managementGroup'"
    (Get-Content (Join-Path $infraRoot 'deployments\DU-03\main.bicep') -TotalCount 1) | Should -Match "targetScope = 'subscription'"
    (Get-Content (Join-Path $infraRoot 'deployments\DU-16\main.bicep') -TotalCount 1) | Should -Match "targetScope = 'subscription'"
  }

  It 'renders deterministic root template bytes' {
    $a = Assert-Clean -CommandArgs @('build','--file',(Join-Path $infraRoot 'main.bicep'),'--stdout') -Context 'root-build-a'
    $b = Assert-Clean -CommandArgs @('build','--file',(Join-Path $infraRoot 'main.bicep'),'--stdout') -Context 'root-build-b'
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $h1 = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($a.Text)))
    $h2 = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($b.Text)))
    $h1 | Should -Be $h2
  }

  It 'preflight fails invalid fixtures and passes complete fixture' {
    $preflightInvalidSentinel.ExitCode | Should -Not -Be 0
    $preflightInvalidAssertion.ExitCode | Should -Not -Be 0
    $preflightInvalidCc001PendingEnable.ExitCode | Should -Not -Be 0
    $preflightInvalidCc001ApprovedEvidence.ExitCode | Should -Not -Be 0
    $preflightValid.ExitCode | Should -Be 0
    $preflightValid.Json.assertionCount | Should -Be 22
    $preflightValid.Json.failedAssertionCount | Should -Be 0
  }

  It 'preflight rejects DU-16 when selected environment is non-production' {
    $r = Invoke-Preflight -FixturePath $fixtureValid -DeploymentUnitId 'DU-16' -Environment 'dev'
    $r.ExitCode | Should -Not -Be 0
  }

  It 'preflight rejects sentinel-bearing env parameter files' {
    foreach($file in $allParamFiles) {
      $r = Invoke-Preflight -BicepParamPath $file.FullName -DeploymentUnitId 'DU-10' -Environment 'dev'
      $r.ExitCode | Should -Not -Be 0
    }
  }

  It 'preflight blocks STRATTON-CC-001 authority provisioning while amendment is pending' {
    $preflightInvalidCc001PendingEnable.ExitCode | Should -Not -Be 0
    $preflightInvalidCc001PendingEnable.Text | Should -Match 'STRATTON-CC-001'
  }

  It 'preflight rejects non-canonical STRATTON-CC-001 approval evidence' {
    $preflightInvalidCc001ApprovedEvidence.ExitCode | Should -Not -Be 0
    $preflightInvalidCc001ApprovedEvidence.Text | Should -Match 'canonical immutable approval evidence'
  }

  It 'preflight remains checkout-location independent from an alternate root copy' {
    $altRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("stratton-iac-alt-" + [guid]::NewGuid().ToString('N'))
    try {
      $altCodingRoot = Join-Path $altRoot '5-coding'
      New-Item -ItemType Directory -Path $altCodingRoot -Force | Out-Null
      New-Item -ItemType Directory -Path (Join-Path $altCodingRoot 'tests') -Force | Out-Null

      Copy-Item -Path $infraRoot -Destination $altCodingRoot -Recurse -Force
      Copy-Item -Path $testsRoot -Destination (Join-Path $altCodingRoot 'tests') -Recurse -Force

      $altPreflightScript = Join-Path $altCodingRoot 'tests\iac\Invoke-DeploymentPreflight.ps1'
      $altFixtureValid = Join-Path $altCodingRoot 'tests\iac\fixtures\preflight-valid.json'

      $raw = & pwsh -NoProfile -File $altPreflightScript -ParameterObjectFile $altFixtureValid -OutputJson 2>&1
      $text = ($raw | ForEach-Object { $_.ToString() } | Out-String).Trim()
      $LASTEXITCODE | Should -Be 0
      $obj = $text | ConvertFrom-Json -Depth 100
      $obj.passed | Should -BeTrue
      $obj.assertionCount | Should -Be 22
      $obj.failedAssertionCount | Should -Be 0
    }
    finally {
      Remove-Item -Path $altRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  It 'selected templates encode required gates and outputs' {
    $du12Template.outputs.PSObject.Properties.Name | Should -Contain 'workerJobIds'
    $du14Template.parameters.PSObject.Properties.Name | Should -Contain 'privateEndpointEvidenceHash'
    $du14Template.outputs.PSObject.Properties.Name | Should -Contain 'lockdownComplete'
    $du15Template.parameters.PSObject.Properties.Name | Should -Contain 'featureRegistrationEvidenceHash'
    $du16Template.parameters.environment.allowedValues | Should -Contain 'prd'
    $du17Template.outputs.PSObject.Properties.Name | Should -Contain 'diagnosticSettingCount'
  }

  It 'enforces Key Vault default-deny ACL in rendered application platform template' {
    $resources = Get-ResourceArray -Template $applicationPlatformTemplate
    $keyVaultResources = @($resources | Where-Object { $_.type -eq 'Microsoft.KeyVault/vaults' })
    $keyVaultResources.Count | Should -Be 1
    $keyVaultResources[0].properties.publicNetworkAccess | Should -Be 'Disabled'
    $keyVaultResources[0].properties.networkAcls.defaultAction | Should -Be 'Deny'
    $keyVaultResources[0].properties.networkAcls.PSObject.Properties.Name | Should -Contain 'bypass'
  }

  It 'enforces TLS1_2 and HTTPS-only on rendered storage accounts' {
    $resources = @()
    $resources += (Get-ResourceArray -Template $assuranceModuleTemplate)
    $resources += (Get-ResourceArray -Template $dataModuleTemplate)
    $storageResources = @($resources | Where-Object { $_.type -eq 'Microsoft.Storage/storageAccounts' })
    $storageResources.Count | Should -BeGreaterThan 0
    foreach($storage in $storageResources) {
      $storage.properties.minimumTlsVersion | Should -Be 'TLS1_2'
      $storage.properties.supportsHttpsTrafficOnly | Should -BeTrue
    }
  }

  It 'keeps compiled main.json artifacts out of source trees (infra/out only)' {
    $sidecarMainJson = @(
      Get-ChildItem -Path $infraRoot -Recurse -Filter 'main.json' |
        Where-Object { $_.FullName -notlike '*\infra\out\*' }
    )
    $sidecarMainJson.Count | Should -Be 0
  }
  $assertionCases = $ExpectedAssertions | ForEach-Object { @{ assertionText = $_ } }
  It 'preflight exact assertion passes: <assertionText>' -TestCases $assertionCases {
    param($assertionText)
    $r = Invoke-Preflight -FixturePath $fixtureValid
    $r.ExitCode | Should -Be 0
    $record = @($r.Json.assertions | Where-Object { $_.text -eq $assertionText })
    $record.Count | Should -Be 1
    $record[0].pass | Should -BeTrue
  }
}




