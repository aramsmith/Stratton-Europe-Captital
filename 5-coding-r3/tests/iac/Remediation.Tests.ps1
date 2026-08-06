$ErrorActionPreference = 'Stop'

Describe 'Stratton Phase 5 remediation regressions' {
  BeforeAll {
    $testsRoot = (Resolve-Path $PSScriptRoot).Path
    $infraRoot = (Resolve-Path (Join-Path $testsRoot '..\..\infra')).Path
    $preflightScript = Join-Path $testsRoot 'Invoke-DeploymentPreflight.ps1'
    $fixtureValid = Join-Path $testsRoot 'fixtures\preflight-valid.json'
    $testWorkRoot = Join-Path $testsRoot 'out\remediation'
    New-Item -ItemType Directory -Path $testWorkRoot -Force | Out-Null

    function Copy-Document {
      param($Document)
      return (($Document | ConvertTo-Json -Depth 100) | ConvertFrom-Json -Depth 100)
    }

    function Write-ArmParameterDocument {
      param($Values,[string]$Path)
      $parameters = [ordered]@{}
      foreach($property in $Values.PSObject.Properties) {
        $parameters[$property.Name] = [ordered]@{ value = $property.Value }
      }
      $document = [ordered]@{
        '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
        contentVersion = '1.0.0.0'
        parameters = $parameters
      }
      [IO.File]::WriteAllText(
        $Path,
        ($document | ConvertTo-Json -Depth 100),
        [Text.UTF8Encoding]::new($false)
      )
    }

    function Invoke-AzBicep {
      param([string[]]$CommandArgs)
      $env:BICEP_CLI_DISABLE_VERSION_CHECK = 'true'
      $output = & az bicep @CommandArgs 2>&1
      $lines = @(
        $output |
          ForEach-Object { $_.ToString() } |
          Where-Object { $_ -notmatch '^WARNING: A new Bicep release is available' }
      )
      [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Lines = $lines
        Text = $lines -join "`n"
      }
    }

    function Build-Template {
      param([string]$Path)
      $result = Invoke-AzBicep -CommandArgs @('build','--file',$Path,'--stdout')
      $result.ExitCode | Should -Be 0 -Because "$Path must compile"
      @($result.Lines | Where-Object { $_ -match '(?i)\bwarning\b|BCP\d{3}' }).Count |
        Should -Be 0 -Because "$Path must compile warning-free"
      return ($result.Text | ConvertFrom-Json -Depth 100)
    }

    function Get-CompiledParameterValues {
      param([string]$Path)
      $result = Invoke-AzBicep -CommandArgs @('build-params','--file',$Path,'--stdout')
      $result.ExitCode | Should -Be 0 -Because "$Path must compile"
      @($result.Lines | Where-Object { $_ -match '(?i)\bwarning\b|BCP\d{3}' }).Count |
        Should -Be 0 -Because "$Path must compile warning-free"
      $document = $result.Text | ConvertFrom-Json -Depth 100
      $parametersJson = $document.parametersJson | ConvertFrom-Json -Depth 100
      $values = [ordered]@{}
      foreach($property in $parametersJson.parameters.PSObject.Properties) {
        $values[$property.Name] = $property.Value.value
      }
      return [pscustomobject]$values
    }

    function Invoke-Preflight {
      param([string]$ParameterPath,[string]$DeploymentUnitId)
      $raw = & pwsh -NoProfile -File $preflightScript `
        -ParameterObjectFile $ParameterPath `
        -DeploymentUnitId $DeploymentUnitId `
        -Environment dev `
        -OutputJson 2>&1
      $text = ($raw | ForEach-Object { $_.ToString() } | Out-String).Trim()
      [pscustomobject]@{
        ExitCode = $LASTEXITCODE
        Text = $text
        Json = if ($text.StartsWith('{')) { $text | ConvertFrom-Json -Depth 100 } else { $null }
      }
    }

    function Get-TemplateParameterErrors {
      param($Template,[string]$ParameterPath)
      $document = Get-Content -Raw -LiteralPath $ParameterPath | ConvertFrom-Json -Depth 100
      $errors = [Collections.Generic.List[string]]::new()
      foreach($templateParameter in $Template.parameters.PSObject.Properties) {
        $supplied = $document.parameters.PSObject.Properties[$templateParameter.Name]
        if ($null -eq $supplied) {
          $errors.Add("Missing parameter: $($templateParameter.Name)")
          continue
        }
        $value = $supplied.Value.value
        $type = [string]$templateParameter.Value.type
        $validType = switch ($type) {
          'string' { $value -is [string] }
          'int' { $value -is [int] -or $value -is [long] }
          'bool' { $value -is [bool] }
          'array' { $value -is [System.Collections.IEnumerable] -and -not ($value -is [string]) }
          'object' { $value -is [pscustomobject] -or $value -is [System.Collections.IDictionary] }
          default { $false }
        }
        if (-not $validType) {
          $errors.Add("Type mismatch: $($templateParameter.Name) expected=$type")
        }
        if (
          $templateParameter.Value.PSObject.Properties['allowedValues'] -and
          $templateParameter.Value.allowedValues -notcontains $value
        ) {
          $errors.Add("Allowed-value mismatch: $($templateParameter.Name)")
        }
      }
      return @($errors)
    }

    $baseValues = Get-Content -Raw -LiteralPath $fixtureValid | ConvertFrom-Json -Depth 100
    $compiledValues = Get-CompiledParameterValues -Path (Join-Path $infraRoot 'parameters\dev.bicepparam')
    foreach($property in $baseValues.PSObject.Properties) {
      if ($compiledValues.PSObject.Properties[$property.Name]) {
        $compiledValues.PSObject.Properties[$property.Name].Value = $property.Value
      }
      else {
        $compiledValues | Add-Member -NotePropertyName $property.Name -NotePropertyValue $property.Value
      }
    }
    $compiledValues.ownerTag = 'test-owner'
    $compiledValues.costCenterTag = 'test-cost-centre'
    $compiledValues.criticalityTag = 'test'
    $ingressSubscriptionId = [string]$baseValues.du15.subscriptionIdByEnvironment.dev

    $du15Values = Copy-Document $compiledValues
    $du15Values.deploymentUnitId = 'DU-15'
    $du15Path = Join-Path $testWorkRoot 'du15-registered.parameters.json'
    Write-ArmParameterDocument -Values $du15Values -Path $du15Path

    $du15OtherEnvironmentSentinelValues = Copy-Document $du15Values
    $du15OtherEnvironmentSentinelValues.du15.ingressByEnvironment |
      Add-Member -NotePropertyName tst `
        -NotePropertyValue (Copy-Document $du15OtherEnvironmentSentinelValues.du15.ingressByEnvironment.dev)
    $du15OtherEnvironmentSentinelValues.du15.ingressByEnvironment.tst.subnetId = 'REQUIRED_OWNER_INPUT'
    $du15OtherEnvironmentSentinelPath = Join-Path $testWorkRoot 'du15-other-environment-sentinel.parameters.json'
    Write-ArmParameterDocument -Values $du15OtherEnvironmentSentinelValues -Path $du15OtherEnvironmentSentinelPath

    $laterStageValues = Copy-Document $baseValues
    $laterStageValues.deploymentUnitId = 'DU-03'
    $laterStageValues.du15.ingressByEnvironment.dev.subnetId = 'REQUIRED_OWNER_INPUT'
    $laterStagePath = Join-Path $testWorkRoot 'du03-later-stage-sentinel.parameters.json'
    Write-ArmParameterDocument -Values $laterStageValues -Path $laterStagePath

    $selectedSentinelValues = Copy-Document $baseValues
    $selectedSentinelValues.deploymentUnitId = 'DU-03'
    $selectedSentinelValues.du03.workloadGroupsByEnvironment.dev[0].name = 'REQUIRED_OWNER_INPUT'
    $selectedSentinelPath = Join-Path $testWorkRoot 'du03-selected-sentinel.parameters.json'
    Write-ArmParameterDocument -Values $selectedSentinelValues -Path $selectedSentinelPath

    $unregisteredValues = Copy-Document $du15Values
    $unregisteredValues.applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription.$ingressSubscriptionId = 'Unregistered'
    $unregisteredPath = Join-Path $testWorkRoot 'du15-unregistered.parameters.json'
    Write-ArmParameterDocument -Values $unregisteredValues -Path $unregisteredPath

    $absentValues = Copy-Document $du15Values
    $absentValues.applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription.PSObject.Properties.Remove($ingressSubscriptionId)
    $absentPath = Join-Path $testWorkRoot 'du15-absent.parameters.json'
    Write-ArmParameterDocument -Values $absentValues -Path $absentPath

    $malformedValues = Copy-Document $du15Values
    $malformedValues.applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription.$ingressSubscriptionId = [pscustomobject]@{
      state = 'Registered'
    }
    $malformedPath = Join-Path $testWorkRoot 'du15-malformed.parameters.json'
    Write-ArmParameterDocument -Values $malformedValues -Path $malformedPath

    $rootTemplate = Build-Template -Path (Join-Path $infraRoot 'main.bicep')
    $ingressTemplate = Build-Template -Path (Join-Path $infraRoot 'modules\ingress\main.bicep')
  }

  AfterAll {
    Remove-Item -LiteralPath $testWorkRoot -Recurse -Force -ErrorAction SilentlyContinue
  }

  It 'admits one type-valid DU-15 parameter object with Registered evidence' {
    $result = Invoke-Preflight -ParameterPath $du15Path -DeploymentUnitId 'DU-15'
    $result.ExitCode | Should -Be 0
    $result.Json.passed | Should -BeTrue
    @(Get-TemplateParameterErrors -Template $rootTemplate -ParameterPath $du15Path).Count | Should -Be 0
    $ingressTemplate.parameters.featureRegistrationEvidenceState.allowedValues | Should -Be @('Registered')
    $ingressTemplate.outputs.featureGatePassed.value | Should -Match "'Registered'"
  }

  It 'admits a selected environment while another environment in the same DU remains sentinelled' {
    $result = Invoke-Preflight -ParameterPath $du15OtherEnvironmentSentinelPath -DeploymentUnitId 'DU-15'
    $result.ExitCode | Should -Be 0
    $result.Json.passed | Should -BeTrue
  }

  It 'keeps DU-15 evidence fail closed when absent, unregistered or malformed' {
    foreach($path in @($absentPath,$unregisteredPath,$malformedPath)) {
      $result = Invoke-Preflight -ParameterPath $path -DeploymentUnitId 'DU-15'
      $result.ExitCode | Should -Not -Be 0
      $result.Text | Should -Match 'ASR-12|sentinel/empty'
    }
  }

  It 'admits an earlier selected DU while a later-stage sentinel remains explicit' {
    $result = Invoke-Preflight -ParameterPath $laterStagePath -DeploymentUnitId 'DU-03'
    $result.ExitCode | Should -Be 0
    $result.Json.passed | Should -BeTrue
  }

  It 'rejects the same later-stage sentinel when its own DU is selected' {
    $result = Invoke-Preflight -ParameterPath $laterStagePath -DeploymentUnitId 'DU-15'
    $result.ExitCode | Should -Not -Be 0
    $result.Text | Should -Match 'Selected-stage sentinel/empty values detected'
  }

  It 'rejects a sentinel in a mandatory selected-DU value' {
    $result = Invoke-Preflight -ParameterPath $selectedSentinelPath -DeploymentUnitId 'DU-03'
    $result.ExitCode | Should -Not -Be 0
    $result.Text | Should -Match 'Selected-stage sentinel/empty values detected'
  }
}
