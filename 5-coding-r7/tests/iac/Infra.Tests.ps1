$ErrorActionPreference = 'Stop'

$ExpectedAssertions = @(
  'environment is exactly dev, tst or prd',
  'prd location is present in the signed approvedLocation list',
  'primary and recovery regions are present, distinct and in the same signed approvedLocation evidence',
  'Azure AI deployments use EU Data Zone Standard and reject Global Standard or regional-only deployment SKUs',
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
  'data admission stays blocked until separately authorised observed immutability-lock and legal-hold evidence is bound',
  'AI fine-tuning is disabled; approved model names, versions, NoAutoUpgrade and target-bound capability/quota evidence are pinned',
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
      return ($r.Text | ConvertFrom-Json -AsHashtable -Depth 100)
    }

    function Build-ParameterObject {
      param([string]$File)
      $r = Assert-Clean -CommandArgs @('build-params','--file',$File,'--stdout') -Context $File
      $document = $r.Text | ConvertFrom-Json -AsHashtable -Depth 100
      if ($document.Contains('parametersJson')) {
        return ($document.parametersJson | ConvertFrom-Json -AsHashtable -Depth 100)
      }
      return $document
    }

    function Get-ResourceArray {
      param($Template)
      if ($Template.resources -is [System.Collections.IDictionary]) { return @($Template.resources.Values) }
      return @($Template.resources)
    }

    function Get-ResourceEntries {
      param($Template)
      if ($Template.resources -is [System.Collections.IDictionary]) {
        return @(
          $Template.resources.GetEnumerator() |
            ForEach-Object {
              [pscustomobject]@{
                Symbol = [string]$_.Key
                Resource = $_.Value
              }
            }
        )
      }
      return @(
        $Template.resources |
          ForEach-Object {
            [pscustomobject]@{
              Symbol = $null
              Resource = $_
            }
          }
      )
    }

    function Get-ObjectPropertyNames {
      param($Object)
      if ($null -eq $Object) { return @() }
      if ($Object -is [System.Collections.IDictionary]) { return @($Object.Keys) }
      return @($Object.PSObject.Properties.Name)
    }

    function Find-NestedObjects {
      param($Node,[scriptblock]$Predicate)
      $results = [Collections.Generic.List[object]]::new()

      function Visit-NestedObject {
        param($Value)
        if ($null -eq $Value -or $Value -is [string]) { return }
        if ($Value -is [System.Collections.IDictionary]) {
          if (& $Predicate $Value) { $results.Add($Value) }
          foreach($child in $Value.Values) { Visit-NestedObject -Value $child }
          return
        }
        if ($Value -is [System.Collections.IEnumerable]) {
          foreach($child in $Value) { Visit-NestedObject -Value $child }
          return
        }
        if (& $Predicate $Value) { $results.Add($Value) }
        foreach($property in $Value.PSObject.Properties) {
          Visit-NestedObject -Value $property.Value
        }
      }

      Visit-NestedObject -Value $Node
      return @($results)
    }

    function Normalize-ArmExpression {
      param($Expression)
      $value = [string]$Expression
      $normalized = [Text.StringBuilder]::new($value.Length)
      $quoted = $false
      for($index = 0; $index -lt $value.Length; $index++) {
        $character = $value[$index]
        if ($character -eq "'") {
          [void]$normalized.Append($character)
          if ($quoted -and $index + 1 -lt $value.Length -and $value[$index + 1] -eq "'") {
            [void]$normalized.Append($value[++$index])
          }
          else {
            $quoted = -not $quoted
          }
          continue
        }
        if ($quoted -or -not [char]::IsWhiteSpace($character)) {
          [void]$normalized.Append($character)
        }
      }
      return $normalized.ToString()
    }

    function Split-ArmArguments {
      param([string]$Arguments)
      $values = [Collections.Generic.List[string]]::new()
      $start = 0
      $depth = 0
      $quoted = $false
      for($index = 0; $index -lt $Arguments.Length; $index++) {
        $character = $Arguments[$index]
        if ($quoted) {
          if ($character -eq "'" -and $index + 1 -lt $Arguments.Length -and $Arguments[$index + 1] -eq "'") {
            $index++
          }
          elseif ($character -eq "'") {
            $quoted = $false
          }
          continue
        }
        if ($character -eq "'") {
          $quoted = $true
          continue
        }
        if ($character -eq '(') {
          $depth++
          continue
        }
        if ($character -eq ')') {
          $depth--
          continue
        }
        if ($character -eq ',' -and $depth -eq 0) {
          $values.Add($Arguments.Substring($start, $index - $start))
          $start = $index + 1
        }
      }
      $values.Add($Arguments.Substring($start))
      return @($values)
    }

    function Get-ArmFunctionCall {
      param([string]$Expression)
      $normalized = Normalize-ArmExpression $Expression
      $match = [regex]::Match($normalized, '^\[(?<name>[A-Za-z][A-Za-z0-9]*)\((?<arguments>.*)\)\]$')
      if (-not $match.Success) { return $null }
      return [pscustomobject]@{
        Name = $match.Groups['name'].Value
        Arguments = @(Split-ArmArguments $match.Groups['arguments'].Value)
      }
    }

    function Test-ExactPolicyDefinitionReference {
      param(
        [string]$Reference,
        [string]$PolicyName = 'stratton-require-eu-data-zone-ai',
        [string[]]$PolicySymbols = @('enforceEuDataZoneAiPolicy')
      )
      $normalized = Normalize-ArmExpression $Reference
      if (@($PolicySymbols | Where-Object { $normalized -ceq "[resourceInfo('$($_)').id]" }).Count -gt 0) {
        return $true
      }

      $call = Get-ArmFunctionCall $normalized
      if ($null -eq $call -or $call.Name -cne 'extensionResourceId') {
        return $false
      }
      return $call.Arguments.Count -eq 3 -and
        $call.Arguments[0] -ceq 'managementGroup().id' -and
        $call.Arguments[1] -ceq "'Microsoft.Authorization/policyDefinitions'" -and
        $call.Arguments[2] -ceq "'$PolicyName'"
    }

    function Test-DeploymentCollectionCountExpression {
      param([string]$Expression)
      $call = Get-ArmFunctionCall $Expression
      return $null -ne $call -and
        $call.Name -ceq 'length' -and
        $call.Arguments.Count -eq 1 -and
        $call.Arguments[0] -ceq "variables('openAiConfig').deployments"
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

    function Set-ReboundPortfolioBinding {
      param(
        $Fixture,
        [ValidateSet('dev','tst','prd')]
        [string]$Environment
      )

      $evidence = $Fixture.modelCapabilityAndQuotaEvidenceByEnvironment.$Environment
      $lines = [Collections.Generic.List[string]]::new()
      $lines.Add('STRATTON-AI-CAPABILITY-QUOTA-BINDING-V1')
      $lines.Add("environment=$Environment")
      $lines.Add("subscriptionId=$($Fixture.du11.subscriptionIdByEnvironment.$Environment)")
      $lines.Add("resourceGroupName=$($Fixture.du11.aiResourceGroupByEnvironment.$Environment)")
      $lines.Add("location=$($Fixture.du11.locationByEnvironment.$Environment)")
      $lines.Add("accountName=$($Fixture.du11.aiByEnvironment.$Environment.openAi.accountName)")
      $lines.Add("approvalState=$($evidence.approvalState)")
      $lines.Add("capabilityEvidenceId=$($evidence.capabilityEvidenceId)")
      $lines.Add("capabilityEvidenceSha256=$($evidence.capabilityEvidenceSha256)")
      $lines.Add("quotaEvidenceId=$($evidence.quotaEvidenceId)")
      $lines.Add("quotaEvidenceSha256=$($evidence.quotaEvidenceSha256)")
      foreach($modelKey in @('luna','terra','sol','embedding')) {
        $deployment = @(
          $Fixture.du11.aiByEnvironment.$Environment.deployments |
            Where-Object { $_.modelKey -ceq $modelKey } |
            Select-Object -First 1
        )[0]
        $model = $Fixture.modelNameVersionAndQuota.$modelKey
        $fineTuning = if ($deployment.fineTuningEnabled -is [bool]) {
          $deployment.fineTuningEnabled.ToString().ToLowerInvariant()
        }
        else {
          [string]$deployment.fineTuningEnabled
        }
        $lines.Add("modelKey=$modelKey")
        $lines.Add("deploymentName=$($deployment.name)")
        $lines.Add("modelName=$($model.name)")
        $lines.Add("modelVersion=$($model.version)")
        $lines.Add("capacity=$($model.capacity)")
        $lines.Add("skuName=$($deployment.skuName)")
        $lines.Add("versionUpgradeOption=$($deployment.versionUpgradeOption)")
        $lines.Add("fineTuningEnabled=$fineTuning")
      }
      $sha256 = [Security.Cryptography.SHA256]::Create()
      try {
        $evidence.portfolioBindingSha256 = (
          [BitConverter]::ToString(
            $sha256.ComputeHash([Text.Encoding]::UTF8.GetBytes(($lines -join "`n")))
          )
        ).Replace('-', '').ToLowerInvariant()
      }
      finally {
        $sha256.Dispose()
      }
    }

    function Invoke-MutatedPreflight {
      param(
        [scriptblock]$Mutator,
        [string]$DeploymentUnitId,
        [string]$Environment = 'dev'
      )

      $fixturePath = Join-Path ([IO.Path]::GetTempPath()) ("stratton-preflight-mutated-" + [guid]::NewGuid().ToString('N') + '.json')
      try {
        $fixture = Get-Content -Raw -LiteralPath $fixtureValid | ConvertFrom-Json -Depth 100
        & $Mutator $fixture
        [IO.File]::WriteAllText(
          $fixturePath,
          ($fixture | ConvertTo-Json -Depth 100),
          [Text.UTF8Encoding]::new($false)
        )
        return Invoke-Preflight -FixturePath $fixturePath -DeploymentUnitId $DeploymentUnitId -Environment $Environment
      }
      finally {
        Remove-Item -LiteralPath $fixturePath -Force -ErrorAction SilentlyContinue
      }
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
    $du11Template = Build-Template -File (Join-Path $infraRoot 'deployments\DU-11\main.bicep')
    $governanceModuleTemplate = Build-Template -File (Join-Path $infraRoot 'modules\governance\main.bicep')
    $regionalAiTemplate = Build-Template -File (Join-Path $infraRoot 'modules\regional-ai\main.bicep')
    $du12Template = Build-Template -File (Join-Path $infraRoot 'deployments\DU-12\main.bicep')
    $du14Template = Build-Template -File (Join-Path $infraRoot 'modules\apim-lockdown\main.bicep')
    $du15Template = Build-Template -File (Join-Path $infraRoot 'modules\ingress\main.bicep')
    $du16Template = Build-Template -File (Join-Path $infraRoot 'deployments\DU-16\main.bicep')
    $du17Template = Build-Template -File (Join-Path $infraRoot 'modules\diagnostics\main.bicep')
    $networkModuleTemplate = Build-Template -File (Join-Path $infraRoot 'modules\network\main.bicep')
    $integrationModuleTemplate = Build-Template -File (Join-Path $infraRoot 'modules\integration\main.bicep')
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
    $preflightValid.Json.assertionCount | Should -Be 16
    $preflightValid.Json.failedAssertionCount | Should -Be 0
  }

  It 'preflight rejects all model portfolio contract mutations' {
    $mutationCases = @(
      @{
        Name = 'Global Standard SKU'
        Expected = 'ASR-04'
        Mutator = { param($fixture) $fixture.du11.aiByEnvironment.dev.deployments[0].skuName = 'GlobalStandard' }
      },
      @{
        Name = 'regional Standard SKU'
        Expected = 'ASR-04'
        Mutator = { param($fixture) $fixture.du11.aiByEnvironment.dev.deployments[0].skuName = 'Standard' }
      },
      @{
        Name = 'changed Luna version'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelNameVersionAndQuota.luna.version = '2026-08-01' }
      },
      @{
        Name = 'omitted Sol deployment'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.du11.aiByEnvironment.dev.deployments = @(
            $fixture.du11.aiByEnvironment.dev.deployments |
              Where-Object { $_.modelKey -cne 'sol' }
          )
        }
      },
      @{
        Name = 'automatic version upgrade'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.du11.aiByEnvironment.dev.deployments[0].versionUpgradeOption = 'OnceNewDefaultVersionAvailable' }
      },
      @{
        Name = 'fine-tuning enabled'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.du11.aiByEnvironment.dev.deployments[0].fineTuningEnabled = $true }
      },
      @{
        Name = 'enabled portfolio with zero capacity'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelNameVersionAndQuota.luna.capacity = 0 }
      },
      @{
        Name = 'missing enabled capability and quota evidence'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.PSObject.Properties.Remove('modelCapabilityAndQuotaEvidenceByEnvironment') }
      },
      @{
        Name = 'blank enabled capability evidence ID'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.dev.capabilityEvidenceId = '  ' }
      },
      @{
        Name = 'malformed enabled quota evidence hash'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.tst.quotaEvidenceSha256 = 'not-a-sha256' }
      },
      @{
        Name = 'newline-terminated enabled capability evidence ID with rebound binding'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.dev.capabilityEvidenceId += "`n"
          Set-ReboundPortfolioBinding -Fixture $fixture -Environment dev
        }
      },
      @{
        Name = 'CRLF-terminated enabled quota evidence ID with rebound binding'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.tst.quotaEvidenceId += "`r`n"
          Set-ReboundPortfolioBinding -Fixture $fixture -Environment tst
        }
      },
      @{
        Name = 'leading-whitespace enabled capability evidence ID with rebound binding'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.prd.capabilityEvidenceId = " $($fixture.modelCapabilityAndQuotaEvidenceByEnvironment.prd.capabilityEvidenceId)"
          Set-ReboundPortfolioBinding -Fixture $fixture -Environment prd
        }
      },
      @{
        Name = 'trailing-whitespace enabled quota evidence ID with rebound binding'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.dev.quotaEvidenceId += ' '
          Set-ReboundPortfolioBinding -Fixture $fixture -Environment dev
        }
      },
      @{
        Name = 'Unicode-line-separator enabled capability evidence ID with rebound binding'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.tst.capabilityEvidenceId += [char]0x2028
          Set-ReboundPortfolioBinding -Fixture $fixture -Environment tst
        }
      },
      @{
        Name = 'hidden-character enabled quota evidence ID with rebound binding'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.prd.quotaEvidenceId += [char]0x200B
          Set-ReboundPortfolioBinding -Fixture $fixture -Environment prd
        }
      },
      @{
        Name = 'newline-terminated enabled capability evidence hash with rebound binding'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.dev.capabilityEvidenceSha256 += "`n"
          Set-ReboundPortfolioBinding -Fixture $fixture -Environment dev
        }
      },
      @{
        Name = 'newline-terminated enabled quota evidence hash with rebound binding'
        Expected = 'ASR-20'
        Mutator = {
          param($fixture)
          $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.tst.quotaEvidenceSha256 += "`n"
          Set-ReboundPortfolioBinding -Fixture $fixture -Environment tst
        }
      },
      @{
        Name = 'newline-terminated enabled portfolio binding hash'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.prd.portfolioBindingSha256 += "`n" }
      },
      @{
        Name = 'changed enabled capability evidence hash without binding refresh'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.dev.capabilityEvidenceSha256 = ('0' * 64) }
      },
      @{
        Name = 'mismatched enabled evidence target'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.prd.target.accountName = 'aoai-wrong-target' }
      },
      @{
        Name = 'stale enabled portfolio binding hash'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelCapabilityAndQuotaEvidenceByEnvironment.dev.portfolioBindingSha256 = ('0' * 64) }
      },
      @{
        Name = 'unbound positive enabled capacity change'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelNameVersionAndQuota.luna.capacity = 11 }
      },
      @{
        Name = 'missing deployment SKU'
        Expected = 'ASR-04'
        Mutator = { param($fixture) $fixture.du11.aiByEnvironment.dev.deployments[0].PSObject.Properties.Remove('skuName') }
      },
      @{
        Name = 'missing deployment-enabled flag'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.PSObject.Properties.Remove('modelPortfolioDeploymentEnabled') }
      },
      @{
        Name = 'non-Boolean deployment-enabled flag (string)'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelPortfolioDeploymentEnabled = 'false' }
      },
      @{
        Name = 'non-Boolean deployment-enabled flag (numeric)'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelPortfolioDeploymentEnabled = 0 }
      },
      @{
        Name = 'non-Boolean deployment-enabled flag (null)'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.modelPortfolioDeploymentEnabled = $null }
      },
      @{
        Name = 'non-Boolean fine-tuning flag'
        Expected = 'ASR-20'
        Mutator = { param($fixture) $fixture.du11.aiByEnvironment.dev.deployments[0].fineTuningEnabled = 0 }
      }
    )

    foreach($case in $mutationCases) {
      $result = Invoke-MutatedPreflight -DeploymentUnitId 'DU-11' -Mutator $case.Mutator
      $result.ExitCode | Should -Not -Be 0 -Because $case.Name
      $result.Text | Should -Match $case.Expected -Because $case.Name
    }
  }

  It 'requires an explicit disabled-by-default portfolio gate in root and DU-11' {
    $rootTemplate.parameters.modelPortfolioDeploymentEnabled.type | Should -Be 'bool'
    $rootTemplate.parameters.modelPortfolioDeploymentEnabled.defaultValue | Should -BeFalse
    $rootDu11 = @(
      (Get-ResourceArray -Template $rootTemplate) |
        Where-Object { $_.type -eq 'Microsoft.Resources/deployments' -and $_.name -eq 'DU-11' }
    )
    $rootDu11.Count | Should -Be 1
    $rootDu11[0].properties.parameters.modelPortfolioDeploymentEnabled.value |
      Should -Be "[parameters('modelPortfolioDeploymentEnabled')]"

    $du11Template.parameters.modelPortfolioDeploymentEnabled.type | Should -Be 'bool'
    (Normalize-ArmExpression $du11Template.variables.gatedDeployments) |
      Should -Be (Normalize-ArmExpression "[if(parameters('modelPortfolioDeploymentEnabled'), variables('resolvedDeployments'), createArray())]")
    (Normalize-ArmExpression $du11Template.variables.aiConfig) | Should -Be (Normalize-ArmExpression (
      "[union(parameters('settings').aiByEnvironment[parameters('environment')], " +
      "createObject('openAi', union(parameters('settings').aiByEnvironment[parameters('environment')].openAi, " +
      "createObject('deployments', variables('gatedDeployments'))), 'deployments', variables('gatedDeployments')))]"
    ))

    $regionalAiDeployment = @(
      (Get-ResourceArray -Template $du11Template) |
        Where-Object {
          $_.type -eq 'Microsoft.Resources/deployments' -and
          [string]$_.name -match 'du11-regional-ai-'
        }
    )
    $regionalAiDeployment.Count | Should -Be 1
    (Normalize-ArmExpression $regionalAiDeployment[0].properties.parameters.ai.value) |
      Should -Be (Normalize-ArmExpression "[variables('aiConfig')]")
  }

  It 'requires four pinned Data Zone deployments in every environment parameter contract' {
    foreach($file in $allParamFiles) {
      $parameters = Build-ParameterObject -File $file.FullName
      $parameters.parameters.modelPortfolioDeploymentEnabled.value | Should -BeFalse
      $modelMap = $parameters.parameters.modelNameVersionAndQuota.value
      $modelMap.luna.name | Should -Be 'gpt-5.6-luna'
      $modelMap.luna.version | Should -Be '2026-07-09'
      $modelMap.terra.name | Should -Be 'gpt-5.6-terra'
      $modelMap.terra.version | Should -Be '2026-07-09'
      $modelMap.sol.name | Should -Be 'gpt-5.6-sol'
      $modelMap.sol.version | Should -Be '2026-07-09'
      $modelMap.embedding.name | Should -Be 'text-embedding-3-large'
      foreach($environment in @('dev','tst','prd')) {
        $deployments = @($parameters.parameters.du11.value.aiByEnvironment.$environment.deployments)
        $deployments.Count | Should -Be 4
        (@($deployments.modelKey | Sort-Object) -join ',') | Should -Be 'embedding,luna,sol,terra'
        @($deployments | Where-Object { $_.skuName -cne 'DataZoneStandard' }).Count | Should -Be 0
        @($deployments | Where-Object { $_.versionUpgradeOption -cne 'NoAutoUpgrade' }).Count | Should -Be 0
        @($deployments | Where-Object { $_.fineTuningEnabled }).Count | Should -Be 0
      }
    }
  }

  It 'enforces EU Data Zone deployment SKU with exact policy linkage and regional iteration semantics' {
    Test-ExactPolicyDefinitionReference `
      "[extensionResourceId(managementGroup().id, 'Microsoft.Authorization/policyDefinitions', 'stratton-require-eu-data-zone-ai')]" |
      Should -BeTrue
    Test-ExactPolicyDefinitionReference `
      "[resourceId('Microsoft.Authorization/policyDefinitions', 'stratton-require-eu-data-zone-ai')]" |
      Should -BeFalse
    Test-ExactPolicyDefinitionReference "[resourceInfo('enforceEuDataZoneAiPolicy').id]" |
      Should -BeTrue
    Test-ExactPolicyDefinitionReference `
      "[extensionResourceId(subscription().id, 'Microsoft.Authorization/policyDefinitions', 'stratton-require-eu-data-zone-ai')]" |
      Should -BeFalse
    Test-ExactPolicyDefinitionReference `
      "[resourceId('Microsoft.Authorization/policyDefinitions', 'stratton-require-eu-data-zone-ai-shadow')]" |
      Should -BeFalse
    Test-ExactPolicyDefinitionReference `
      "[extensionResourceId(managementGroup().id, 'Microsoft.Authorization/policyDefinitions', 'stratton-require-eu-data-zone-ai ')]" |
      Should -BeFalse
    Test-ExactPolicyDefinitionReference "[resourceInfo('enforceEuDataZoneAiPolicyShadow').id]" |
      Should -BeFalse

    Test-DeploymentCollectionCountExpression `
      "[length(variables('openAiConfig').deployments)]" |
      Should -BeTrue
    Test-DeploymentCollectionCountExpression `
      "[length(variables('openAiConfig').roleAssignments)]" |
      Should -BeFalse
    Test-DeploymentCollectionCountExpression `
      "[if(equals(variables('openAiConfig').name, 'decoy'), length(parameters('ai').deployments), 0)]" |
      Should -BeFalse

    $governanceEntries = Get-ResourceEntries -Template $governanceModuleTemplate
    $governanceResources = @($governanceEntries.Resource)
    $policyEntries = @(
      $governanceEntries |
        Where-Object {
          $_.Resource.type -eq 'Microsoft.Authorization/policyDefinitions' -and
          $_.Resource.name -eq 'stratton-require-eu-data-zone-ai'
        }
    )
    $policy = @($policyEntries | ForEach-Object { $_.Resource })
    $policySymbols = @($policyEntries | ForEach-Object { $_.Symbol } | Where-Object { $_ })
    $policy.Count | Should -Be 1
    $conditions = @($policy[0].properties.policyRule.if.allOf)
    $typeCondition = @(
      $conditions |
        Where-Object {
          $_.field -eq 'type' -and
          $_.equals -eq 'Microsoft.CognitiveServices/accounts/deployments'
        }
    )
    $skuCondition = @(
      $conditions |
        Where-Object {
          $_.field -eq 'Microsoft.CognitiveServices/accounts/deployments/sku.name' -and
          $_.notEquals -eq 'DataZoneStandard'
        }
    )
    $typeCondition.Count | Should -Be 1
    $skuCondition.Count | Should -Be 1
    $policy[0].properties.policyRule.then.effect | Should -Be 'deny'

    $initiative = @(
      $governanceResources |
        Where-Object {
          $_.type -eq 'Microsoft.Authorization/policySetDefinitions' -and
          $_.name -eq 'stratton-sovereign-guardrails'
        }
    )
    $initiative.Count | Should -Be 1
    $policyReferences = @($initiative[0].properties.policyDefinitions.policyDefinitionId)
    @(
      $policyReferences |
        Where-Object {
          Test-ExactPolicyDefinitionReference -Reference $_ -PolicySymbols $policySymbols
        }
    ).Count |
      Should -Be 1
    @($governanceResources | Where-Object { $_.name -eq 'stratton-deny-global-and-datazone-ai' }).Count |
      Should -Be 0
    $namePatternConditions = @(
      $governanceResources |
        Where-Object { $_.type -eq 'Microsoft.Authorization/policyDefinitions' } |
        ForEach-Object {
          Find-NestedObjects -Node $_.properties.policyRule -Predicate {
            param($node)
            $field = if ($node -is [System.Collections.IDictionary]) { $node['field'] } else { $node.field }
            $like = if ($node -is [System.Collections.IDictionary]) { $node['like'] } else { $node.like }
            $field -ceq 'name' -and [string]$like -match '(?i)global|datazone'
          }
        }
    )
    $namePatternConditions.Count | Should -Be 0

    $regionalAiDeployments = @(
      (Get-ResourceEntries -Template $regionalAiTemplate) |
        Where-Object {
          $_.Resource.type -eq 'Microsoft.CognitiveServices/accounts/deployments'
        }
    )
    $regionalAiDeployments.Count | Should -Be 1
    Test-DeploymentCollectionCountExpression $regionalAiDeployments[0].Resource.copy.count |
      Should -BeTrue
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
      $altCodingRoot = Join-Path $altRoot (Split-Path -Leaf (Split-Path -Parent $infraRoot))
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
      $obj.assertionCount | Should -Be 16
      $obj.failedAssertionCount | Should -Be 0
    }
    finally {
      Remove-Item -Path $altRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
  }

  It 'selected templates encode required gates and outputs' {
    Get-ObjectPropertyNames $du12Template.outputs | Should -Contain 'workerJobIds'
    Get-ObjectPropertyNames $du14Template.parameters | Should -Contain 'privateEndpointEvidenceHash'
    Get-ObjectPropertyNames $du14Template.outputs | Should -Contain 'lockdownComplete'
    Get-ObjectPropertyNames $du15Template.parameters | Should -Contain 'featureRegistrationEvidenceHash'
    $du16Template.parameters.environment.allowedValues | Should -Contain 'prd'
    Get-ObjectPropertyNames $du17Template.outputs | Should -Contain 'diagnosticSettingCount'
  }

  It 'enforces workload NSG, firewall-route and private-endpoint policy controls while exempting Azure-reserved subnets' {
    (@($networkModuleTemplate.variables.azureReservedSubnetNames) -join ',') | Should -Be (
      @('AzureFirewallSubnet','AzureFirewallManagementSubnet','AzureBastionSubnet','GatewaySubnet','RouteServerSubnet') -join ','
    )
    $resources = Get-ResourceArray -Template $networkModuleTemplate
    $nsg = @($resources | Where-Object { $_.type -eq 'Microsoft.Network/networkSecurityGroups' })
    $routeTable = @($resources | Where-Object { $_.type -eq 'Microsoft.Network/routeTables' })
    $subnet = @($resources | Where-Object { $_.type -eq 'Microsoft.Network/virtualNetworks/subnets' })
    $nsg.Count | Should -Be 1
    $routeTable.Count | Should -Be 1
    $subnet.Count | Should -Be 1
    [string]$nsg[0].condition | Should -Match "azureReservedSubnetNames"
    [string]$routeTable[0].condition | Should -Match "azureReservedSubnetNames"
    [string]$subnet[0].properties | Should -Match "privateEndpointNetworkPolicies"
    [string]$subnet[0].properties | Should -Match "networkSecurityGroup"
    [string]$subnet[0].properties | Should -Match "routeTable"
  }

  It 'preflight rejects missing deny rules, incorrect firewall routes and disabled private-endpoint policies' {
    $missingRules = Invoke-MutatedPreflight -DeploymentUnitId 'DU-04' -Mutator {
      param($fixture)
      $fixture.du04.workloadPrimaryNetworkByEnvironment.dev.subnets[1].nsgRules = @()
    }
    $wrongRoute = Invoke-MutatedPreflight -DeploymentUnitId 'DU-04' -Mutator {
      param($fixture)
      $fixture.du04.workloadPrimaryNetworkByEnvironment.dev.subnets[1].routeEntries[0].properties.nextHopIpAddress = '10.0.0.99'
    }
    $disabledPolicies = Invoke-MutatedPreflight -DeploymentUnitId 'DU-04' -Mutator {
      param($fixture)
      $fixture.du04.workloadPrimaryNetworkByEnvironment.dev.subnets[2].privateEndpointNetworkPolicies = 'Disabled'
    }

    $missingRules.ExitCode | Should -Not -Be 0
    $missingRules.Text | Should -Match 'empty NSG rule set|explicit deny-all'
    $wrongRoute.ExitCode | Should -Not -Be 0
    $wrongRoute.Text | Should -Match 'corresponding regional firewall'
    $disabledPolicies.ExitCode | Should -Not -Be 0
    $disabledPolicies.Text | Should -Match 'Private-endpoint network policies'
  }

  It 'uses the exact queue-scoped Service Bus sender and receiver access map' {
    $accessPaths = @($integrationModuleTemplate.variables.serviceBusAccessPaths)
    $accessPaths.Count | Should -Be 7
    @($accessPaths | Where-Object { $_.queueName -in @('q-analysis','q-audit-export') }).Count | Should -Be 0
    @($accessPaths | Where-Object { $_.identityName -in @('uami-analysis','uami-audit-export') }).Count | Should -Be 0

    $resources = Get-ResourceArray -Template $integrationModuleTemplate
    $roleAssignments = @($resources | Where-Object { $_.type -eq 'Microsoft.Authorization/roleAssignments' })
    $roleAssignments.Count | Should -Be 1
    [string]$roleAssignments[0].scope | Should -Match 'Microsoft.ServiceBus/namespaces/queues'
    [string]$roleAssignments[0].copy.count | Should -Match 'serviceBusAccessPaths'
  }

  It 'preflight rejects widened Service Bus access and deployable authority-blocked jobs' {
    $widenedAccess = Invoke-MutatedPreflight -DeploymentUnitId 'DU-10' -Mutator {
      param($fixture)
      $fixture.du10.integrationByEnvironment.dev.serviceBus.roleAssignments += [pscustomobject]@{
        identityName = 'uami-analysis'
        queueName = 'q-analysis'
        roleDefinitionId = '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
      }
    }
    $deployableBlockedJob = Invoke-MutatedPreflight -DeploymentUnitId 'DU-12' -Mutator {
      param($fixture)
      $fixture.du12.platformByEnvironment.dev.workerJobs[2].deploymentEnabled = $true
    }

    $widenedAccess.ExitCode | Should -Not -Be 0
    $widenedAccess.Text | Should -Match 'queue-scoped RBAC contract mismatch'
    $deployableBlockedJob.ExitCode | Should -Not -Be 0
    $deployableBlockedJob.Text | Should -Match 'Authority-blocked worker job'
  }

  It 'enforces explicit Entra authentication and filters blocked jobs from deployment and ACR access' {
    $resources = Get-ResourceArray -Template $applicationPlatformTemplate
    $authConfig = @($resources | Where-Object { $_.type -eq 'Microsoft.App/containerApps/authConfigs' })
    $jobs = @($resources | Where-Object { $_.type -eq 'Microsoft.App/jobs' })
    $workerAcrPull = @(
      $resources |
        Where-Object {
          $_.type -eq 'Microsoft.Authorization/roleAssignments' -and
          [string]$_.copy.name -eq 'acrPullAssignmentsWorker'
        }
    )

    $authConfig.Count | Should -Be 1
    $authConfig[0].properties.platform.enabled | Should -BeTrue
    $authConfig[0].properties.globalValidation.unauthenticatedClientAction | Should -Be 'Return401'
    $authConfig[0].properties.globalValidation.excludedPaths.Count | Should -Be 0
    $authConfig[0].properties.httpSettings.requireHttps | Should -BeTrue
    $authConfig[0].properties.identityProviders.azureActiveDirectory.enabled | Should -BeTrue
    [string]$authConfig[0].properties.identityProviders.azureActiveDirectory.registration.clientId | Should -Match 'entraAuthentication.clientId'
    [string]$authConfig[0].properties.identityProviders.azureActiveDirectory.registration.openIdIssuer | Should -Match 'entraAuthentication.tenantId'
    [string]$authConfig[0].properties.identityProviders.azureActiveDirectory.validation.allowedAudiences[0] | Should -Match 'entraAuthentication.allowedAudience'
    $jobs.Count | Should -Be 1
    [string]$jobs[0].copy.count | Should -Match 'activeWorkerJobs'
    $workerAcrPull.Count | Should -Be 1
    [string]$workerAcrPull[0].copy.count | Should -Match 'activeWorkerJobs'
    (@($applicationPlatformTemplate.variables.approvedWorkerQueueNames) -join ',') | Should -Be 'q-ingestion,q-extraction,q-indexing'
    [string]$applicationPlatformTemplate.variables.activeWorkerJobs | Should -Match 'deploymentEnabled'
  }

  It 'validates the human bearer token at APIM without replacing it' {
    $apimText = Get-Content -Raw (Join-Path $infraRoot 'modules\apim-lockdown\main.bicep')
    $apimText | Should -Match 'environment\(\)\.authentication\.loginEndpoint'
    $apimText | Should -Match '<validate-jwt header-name="Authorization" require-scheme="Bearer"'
    $apimText | Should -Match '<set-header name="x-ms-client-principal" exists-action="delete"'
    $apimText | Should -Match '<set-backend-service backend-id="\{3\}"'
    $apimText | Should -Not -Match 'api\.policyXml'
    $apimText | Should -Not -Match 'authentication-managed-identity'
    foreach($file in $allParamFiles) {
      (Get-Content -Raw -LiteralPath $file.FullName) | Should -Not -Match 'policyXml'
    }
  }

  It 'preflight rejects incomplete Entra authentication and API access to blocked queues' {
    $invalidTenant = Invoke-MutatedPreflight -DeploymentUnitId 'DU-12' -Mutator {
      param($fixture)
      $fixture.du12.platformByEnvironment.dev.apiApp.entraAuthentication.tenantId = 'not-a-guid'
    }
    $blockedApiQueue = Invoke-MutatedPreflight -DeploymentUnitId 'DU-12' -Mutator {
      param($fixture)
      $fixture.du12.platformByEnvironment.dev.apiApp.environmentVariables += [pscustomobject]@{
        name = 'AZURE_SERVICEBUS_QUEUE_ANALYSIS'
        value = 'q-analysis'
      }
    }

    $invalidTenant.ExitCode | Should -Not -Be 0
    $invalidTenant.Text | Should -Match 'Entra authentication owner inputs'
    $blockedApiQueue.ExitCode | Should -Not -Be 0
    $blockedApiQueue.Text | Should -Match 'API queue allowlist mismatch'
  }

  It 'preflight rejects APIM and Container Apps identity-boundary drift' {
    $identityDrift = Invoke-MutatedPreflight -DeploymentUnitId 'DU-14' -Mutator {
      param($fixture)
      $fixture.du14.apimByEnvironment.dev.apis[0].entraAuthentication.allowedAudience = 'api://33333333-3333-4333-8333-333333333333'
    }

    $identityDrift.ExitCode | Should -Not -Be 0
    $identityDrift.Text | Should -Match 'identity bindings differ'
  }

  It 'keeps authority-blocked queue variables and jobs non-deployable in every parameter contract' {
    foreach($file in $allParamFiles) {
      $content = Get-Content -Raw -LiteralPath $file.FullName
      $content | Should -Not -Match 'AZURE_SERVICEBUS_QUEUE_(ANALYSIS|AUDIT_EXPORT)'
      ([regex]::Matches($content, "(?m)^\s+deploymentEnabled:\s+false\s*$")).Count | Should -Be 6
    }
  }

  It 'enforces Key Vault default-deny ACL in rendered application platform template' {
    $resources = Get-ResourceArray -Template $applicationPlatformTemplate
    $keyVaultResources = @($resources | Where-Object { $_.type -eq 'Microsoft.KeyVault/vaults' })
    $keyVaultResources.Count | Should -Be 1
    $keyVaultResources[0].properties.publicNetworkAccess | Should -Be 'Disabled'
    $keyVaultResources[0].properties.networkAcls.defaultAction | Should -Be 'Deny'
    Get-ObjectPropertyNames $keyVaultResources[0].properties.networkAcls | Should -Contain 'bypass'
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
    $r = Invoke-Preflight -FixturePath $fixtureValid -DeploymentUnitId 'DU-17'
    $r.ExitCode | Should -Be 0
    $record = @($r.Json.assertions | Where-Object { $_.text -eq $assertionText })
    $record.Count | Should -Be 1
    $record[0].pass | Should -BeTrue
  }
}
