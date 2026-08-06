[CmdletBinding(DefaultParameterSetName='BicepParam')]
param(
  [Parameter(Mandatory=$true, ParameterSetName='BicepParam')]
  [string]$BicepParamFile,

  [Parameter(Mandatory=$true, ParameterSetName='JsonObject')]
  [string]$ParameterObjectFile,

  [string]$DeploymentUnitId,
  [string]$Environment,
  [string]$RuntimeTenantId,
  [switch]$OutputJson
)

$ErrorActionPreference = 'Stop'

function To-Enumerable {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) { return @($Value) }
  return @($Value)
}

function Get-ObjectValue {
  param($Object,[string]$Path)
  $current = $Object
  foreach($segment in $Path.Split('.')) {
    if ($null -eq $current) { return $null }
    if ($current -is [System.Collections.IDictionary]) {
      if (-not $current.Contains($segment)) { return $null }
      $current = $current[$segment]
      continue
    }
    $prop = $current.PSObject.Properties[$segment]
    if ($null -eq $prop) { return $null }
    $current = $prop.Value
  }
  return $current
}

function Add-SentinelViolations {
  param($Node,[string]$Path,[string]$SelectedEnvironment,[ref]$Violations)
  if ($null -eq $Node) { return }
  if ($Node -is [string]) {
    if ($Node.Trim() -eq '' -or $Node -match 'REQUIRED_OWNER_INPUT') {
      $Violations.Value += $Path
    }
    return
  }
  if ($Node -is [System.Collections.IDictionary]) {
    $hasEnvironmentKeys = $Node.Contains($SelectedEnvironment) -and
      @('dev','tst','prd' | Where-Object { $Node.Contains($_) }).Count -gt 0
    if ($Path -match 'ByEnvironment$' -or $hasEnvironmentKeys) {
      if ($Node.Contains($SelectedEnvironment)) {
        Add-SentinelViolations -Node $Node[$SelectedEnvironment] -Path ("$Path.$SelectedEnvironment") `
          -SelectedEnvironment $SelectedEnvironment -Violations $Violations
      }
      return
    }
    foreach($key in $Node.Keys) {
      Add-SentinelViolations -Node $Node[$key] -Path ("$Path.$key") `
        -SelectedEnvironment $SelectedEnvironment -Violations $Violations
    }
    return
  }
  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
    $items = @($Node)
    for($i=0; $i -lt $items.Count; $i++) {
      Add-SentinelViolations -Node $items[$i] -Path ("$Path[$i]") `
        -SelectedEnvironment $SelectedEnvironment -Violations $Violations
    }
    return
  }
  $propertyNames = @($Node.PSObject.Properties.Name)
  $hasEnvironmentProperties = $propertyNames -contains $SelectedEnvironment -and
    @('dev','tst','prd' | Where-Object { $propertyNames -contains $_ }).Count -gt 0
  if ($Path -match 'ByEnvironment$' -or $hasEnvironmentProperties) {
    $selectedProperty = $Node.PSObject.Properties[$SelectedEnvironment]
    if ($null -ne $selectedProperty) {
      Add-SentinelViolations -Node $selectedProperty.Value -Path ("$Path.$SelectedEnvironment") `
        -SelectedEnvironment $SelectedEnvironment -Violations $Violations
    }
    return
  }
  foreach($prop in $Node.PSObject.Properties) {
    Add-SentinelViolations -Node $prop.Value -Path ("$Path.$($prop.Name)") `
      -SelectedEnvironment $SelectedEnvironment -Violations $Violations
  }
}


function Get-IntOrDefault {
  param($Value,[int]$Default = 0)
  $parsed = 0
  if ([int]::TryParse([string]$Value, [ref]$parsed)) { return $parsed }
  return $Default
}

function Add-Assertion {
  param([string]$Id,[string]$Text,[bool]$Pass,[string]$FailureDetail,[string]$RequiredDu)
  if ($RequiredDu -and $script:activeDeploymentUnits -notcontains $RequiredDu) {
    return
  }
  $script:assertions.Add([pscustomobject]@{ id = $Id; text = $Text; pass = $Pass; failure = $FailureDetail })
  if (-not $Pass) {
    $script:failures.Add("$Id failed: $Text. $FailureDetail")
  }
}

function Get-ParamDocument {
  if ($PSCmdlet.ParameterSetName -eq 'BicepParam') {
    $env:BICEP_CLI_DISABLE_VERSION_CHECK = 'true'
    $output = & az bicep build-params --file $BicepParamFile --stdout 2>&1
    $lines = @($output | ForEach-Object { $_.ToString() } | Where-Object { $_ -notmatch '^WARNING: A new Bicep release is available' })
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to parse bicep params: $($lines -join [Environment]::NewLine)"
    }
    $doc = ($lines -join "`n") | ConvertFrom-Json -Depth 100
    if ($doc.PSObject.Properties.Name -contains 'parametersJson') {
      return ($doc.parametersJson | ConvertFrom-Json -Depth 100)
    }
    return $doc
  }

  return (Get-Content -Raw $ParameterObjectFile | ConvertFrom-Json -Depth 100)
}

$paramDoc = Get-ParamDocument
$params = @{}
if ($paramDoc.parameters) {
  foreach($p in $paramDoc.parameters.PSObject.Properties) {
    if ($p.Value.PSObject.Properties.Name -contains 'value') {
      $params[$p.Name] = $p.Value.value
    }
    else {
      $params[$p.Name] = $p.Value
    }
  }
}
else {
  foreach($p in $paramDoc.PSObject.Properties) {
    $params[$p.Name] = $p.Value
  }
}

if ($DeploymentUnitId) { $params['deploymentUnitId'] = $DeploymentUnitId }
if ($Environment) { $params['environment'] = $Environment }

$failures = New-Object System.Collections.Generic.List[string]
$assertions = New-Object System.Collections.Generic.List[object]

$selectedDu = [string](Get-ObjectValue $params 'deploymentUnitId')
$selectedEnv = [string](Get-ObjectValue $params 'environment')

$duPathById = @{
  'DU-01' = 'du01'; 'DU-02' = 'du02'; 'DU-03' = 'du03'; 'DU-04' = 'du04'; 'DU-05' = 'du05'; 'DU-06' = 'du06'; 'DU-07' = 'du07'; 'DU-08' = 'du08';
  'DU-09' = 'du09'; 'DU-10' = 'du10'; 'DU-11' = 'du11'; 'DU-12' = 'du12'; 'DU-13' = 'du13'; 'DU-14' = 'du14'; 'DU-15' = 'du15'; 'DU-16' = 'du16'; 'DU-17' = 'du17'
}

$dependenciesByDu = @{
  'DU-01' = @()
  'DU-02' = @('DU-01')
  'DU-03' = @('DU-02')
  'DU-04' = @('DU-03')
  'DU-05' = @('DU-04')
  'DU-06' = @('DU-03')
  'DU-07' = @('DU-04','DU-05','DU-06')
  'DU-08' = @('DU-04','DU-05','DU-06')
  'DU-09' = @('DU-05','DU-06','DU-08')
  'DU-10' = @('DU-09')
  'DU-11' = @('DU-07','DU-09')
  'DU-12' = @('DU-06','DU-08','DU-09','DU-10','DU-11')
  'DU-13' = @('DU-05','DU-07','DU-09','DU-10','DU-11','DU-12')
  'DU-14' = @('DU-13')
  'DU-15' = @('DU-12','DU-14')
  'DU-16' = @('DU-05','DU-06','DU-08','DU-09')
  'DU-17' = @('DU-07','DU-08','DU-09','DU-10','DU-11','DU-12','DU-14','DU-15','DU-16')
}

$script:activeDeploymentUnits = @()
function Add-DeploymentUnitClosure {
  param([string]$DeploymentUnit)
  if ($script:activeDeploymentUnits -contains $DeploymentUnit) { return }
  foreach($dependency in @($dependenciesByDu[$DeploymentUnit])) {
    Add-DeploymentUnitClosure -DeploymentUnit $dependency
  }
  $script:activeDeploymentUnits += $DeploymentUnit
}

if (-not $duPathById.ContainsKey($selectedDu)) {
  $failures.Add("deploymentUnitId is invalid: $selectedDu")
}
else {
  Add-DeploymentUnitClosure -DeploymentUnit $selectedDu
  $obj = Get-ObjectValue $params $duPathById[$selectedDu]
  if ($null -eq $obj) {
    $failures.Add("Missing selected DU object: $($duPathById[$selectedDu])")
  }
}

if ($selectedEnv -notin @('dev','tst','prd')) {
  $failures.Add("environment is invalid: $selectedEnv")
}

if ($selectedDu -eq 'DU-16' -and $selectedEnv -ne 'prd') {
  $failures.Add('DU-16 assurance authority is production-only; non-prd is invalid')
}

$cc001Seam = Get-ObjectValue $params 'du16.pendingAuthorityAmendment'
if ($null -ne $cc001Seam) {
  $expectedApprovalId = 'STRATTON-CC-001-APPROVAL-001'
  $expectedApprovalHash = 'ec2ddad8bc9c38993d5266985db5c9e9f12358034ba3aad9c61cd93465d8b21d'
  $changeId = [string](Get-ObjectValue $params 'du16.pendingAuthorityAmendment.changeId')
  $approvalState = [string](Get-ObjectValue $params 'du16.pendingAuthorityAmendment.approvalState')
  $approvalEvidenceId = [string](Get-ObjectValue $params 'du16.pendingAuthorityAmendment.approvalEvidenceId')
  $approvalEvidenceHash = [string](Get-ObjectValue $params 'du16.pendingAuthorityAmendment.approvalEvidenceHash')
  $enableVerdictApi = [bool](Get-ObjectValue $params 'du16.pendingAuthorityAmendment.enableVerdictApiComputeBoundaryProvisioning')
  $enableGovernedAnalysis = [bool](Get-ObjectValue $params 'du16.pendingAuthorityAmendment.enableGovernedAnalysisVectorizationProvisioning')
  $enableAuditExportPush = [bool](Get-ObjectValue $params 'du16.pendingAuthorityAmendment.enableAuditExportPushEndpointQueueProvisioning')

  if ($changeId -ne 'STRATTON-CC-001') {
    $failures.Add("DU-16 pending authority amendment seam must reference STRATTON-CC-001. changeId=$changeId")
  }

  if ($approvalState -notin @('PENDING_HUMAN_APPROVAL','APPROVED')) {
    $failures.Add("DU-16 pending authority amendment seam has invalid approvalState=$approvalState")
  }

  if ($approvalState -eq 'APPROVED' -and (
      $approvalEvidenceId -cne $expectedApprovalId -or
      $approvalEvidenceHash -cne $expectedApprovalHash
    )) {
    $failures.Add('DU-16 STRATTON-CC-001 approved seam does not bind the canonical immutable approval evidence')
  }

  if ($approvalState -ne 'APPROVED' -and ($enableVerdictApi -or $enableGovernedAnalysis -or $enableAuditExportPush)) {
    $failures.Add('DU-16 STRATTON-CC-001 seam is pending human approval; all authority provisioning flags must remain false')
  }

  if ($enableVerdictApi -or $enableGovernedAnalysis -or $enableAuditExportPush) {
    if ($approvalEvidenceId -eq '' -or $approvalEvidenceHash -eq '') {
      $failures.Add('DU-16 STRATTON-CC-001 seam requires immutable approval evidence id/hash before any authority provisioning can be enabled')
    }

    $failures.Add('DU-16 STRATTON-CC-001 authority resources are blocked until the amended baseline is human-approved and implemented')
  }
}

$mandatoryByDu = @{
  'DU-01' = @('du01')
  'DU-02' = @('du02.requiredTagKeys','du02.approvedLocationList','du02.approvedFirewallPublicIpResourceIds')
  'DU-03' = @('du03.managementGroups','du03.connectivityGroups','du03.aiGovernanceGroups',"du03.workloadGroupsByEnvironment.$selectedEnv")
  'DU-04' = @(
    'du04.hubPrimaryNetwork.subnets',
    'du04.hubPrimaryNetwork.firewallPrivateIpAddress',
    'du04.hubRecoveryNetwork.subnets',
    'du04.hubRecoveryNetwork.firewallPrivateIpAddress',
    "du04.workloadPrimaryNetworkByEnvironment.$selectedEnv.subnets"
  )
  'DU-05' = @('du05.privateZones','du05.resolver.forwardingRulesets','du05.resolver.forwardingRules','du05.resolver.forwardingVirtualNetworkLinks')
  'DU-06' = @('du06.identities','du06.resourceGroupRoleAssignments')
  'DU-07' = @('du07')
  'DU-08' = @('du08')
  'DU-09' = @("du09.dataByEnvironment.$selectedEnv.storageAccounts", "du09.dataByEnvironment.$selectedEnv.storageContainers")
  'DU-10' = @(
    "du10.integrationByEnvironment.$selectedEnv.serviceBus.queues",
    "du10.integrationByEnvironment.$selectedEnv.serviceBus.roleAssignments"
  )
  'DU-11' = @("du11.aiByEnvironment.$selectedEnv.deployments")
  'DU-12' = @(
    "du12.platformByEnvironment.$selectedEnv.workerJobs",
    "du12.platformByEnvironment.$selectedEnv.apiApp.entraAuthentication"
  )
  'DU-13' = @("du13.privateEndpointsByEnvironment.$selectedEnv")
  'DU-14' = @("du14.apimByEnvironment.$selectedEnv.backends", "du14.apimByEnvironment.$selectedEnv.apis")
  'DU-15' = @("du15.ingressByEnvironment.$selectedEnv")
  'DU-16' = @(
    'du16.assuranceByEnvironment.prd.legalHoldTags',
    'du16.assuranceByEnvironment.prd.evidenceStorage',
    'du16.assuranceByEnvironment.prd.verdictStorage',
    'du16.assuranceByEnvironment.prd.evidenceReaderCopierPrincipalId',
    'du16.assuranceByEnvironment.prd.evidenceReaderCopierAuthority',
    'du16.assuranceByEnvironment.prd.evidenceReaderCopierRoleDefinitionId',
    'du16.assuranceByEnvironment.prd.auditEvidenceReadRoleDefinitionId',
    'du16.assuranceByEnvironment.prd.auditRoleDefinitionId',
    'du16.assuranceByEnvironment.prd.retentionFinalization.state',
    'du16.assuranceByEnvironment.prd.retentionFinalization.immutabilityLockRequired',
    'du16.assuranceByEnvironment.prd.retentionFinalization.legalHoldRequired'
  )
  'DU-17' = @("du17.diagnosticsByEnvironment.$selectedEnv.assuranceAlerts")
}

$globalPrerequisitesByDu = @{
  'DU-01' = @('tenantId','citadelParentManagementGroupId','citadelManagementSubscriptionId','citadelConnectivitySubscriptionId','citadelAiGovernanceSubscriptionId','strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','strattonAssuranceProductionSubscriptionId')
  'DU-02' = @('citadelParentManagementGroupId','approvedPrimaryLocation','approvedRecoveryLocation','approvedLocationEvidenceId')
  'DU-03' = @('citadelManagementSubscriptionId','citadelConnectivitySubscriptionId','citadelAiGovernanceSubscriptionId','strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','strattonAssuranceProductionSubscriptionId')
  'DU-04' = @('citadelConnectivitySubscriptionId','strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','approvedPrimaryLocation','approvedRecoveryLocation','environmentAddressSpaces','primaryAndRecoveryHubAddressSpaces','primaryAndRecoveryEnterpriseWanConnectionIds')
  'DU-05' = @('citadelConnectivitySubscriptionId','approvedPrimaryLocation','approvedRecoveryLocation','privateDnsForwardingTargetsAndEnterpriseResolverIds')
  'DU-06' = @('citadelManagementSubscriptionId','citadelConnectivitySubscriptionId','citadelAiGovernanceSubscriptionId','strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','strattonAssuranceProductionSubscriptionId','internalAuditSubscriptionIdAndAdminGroup')
  'DU-07' = @('sourceRegisterVersion','retentionScheduleMapVersion')
  'DU-08' = @('supportActionGroupReceivers','businessHoursDefinitionId','criticalAlertDefinitionId','retentionScheduleMapVersion')
  'DU-09' = @('strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','approvedPrimaryLocation','approvedRecoveryLocation','sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion','retentionScheduleMapVersion','legalHoldOwner','workloadProfileVersion')
  'DU-10' = @('strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','workloadProfileVersion')
  'DU-11' = @('strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','modelNameVersionAndQuota','providerDataUseEvidenceId','aiActClassificationEvidenceId')
  'DU-12' = @('strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','workloadProfileVersion')
  'DU-13' = @('strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','privateDnsForwardingTargetsAndEnterpriseResolverIds')
  'DU-14' = @('strattonNonproductionSubscriptionId','strattonProductionSubscriptionId')
  'DU-15' = @('strattonNonproductionSubscriptionId','strattonProductionSubscriptionId')
  'DU-16' = @('strattonAssuranceProductionSubscriptionId','internalAuditSubscriptionIdAndAdminGroup','retentionScheduleMapVersion','legalHoldOwner','approvedPrimaryLocation','approvedRecoveryLocation')
  'DU-17' = @('strattonNonproductionSubscriptionId','strattonProductionSubscriptionId','strattonAssuranceProductionSubscriptionId','supportActionGroupReceivers','businessHoursDefinitionId','criticalAlertDefinitionId','regulatoryEvidenceRegisterVersion')
}

$sentinelScopePaths = [Collections.Generic.List[string]]::new()
foreach($path in @('environment','deploymentUnitId','ownerTag','costCenterTag','criticalityTag')) {
  $sentinelScopePaths.Add($path)
}
if ($selectedEnv -eq 'prd') {
  $sentinelScopePaths.Add('productionDataClassificationTag')
}
foreach($path in @($globalPrerequisitesByDu[$selectedDu])) {
  $sentinelScopePaths.Add($path)
}
foreach($path in @($mandatoryByDu[$selectedDu])) {
  $sentinelScopePaths.Add($path)
}
if (
  $selectedDu -eq 'DU-16' -and
  [bool](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.dataAdmissionEnabled')
) {
  foreach($path in @(
    'du16.assuranceByEnvironment.prd.retentionFinalization.immutabilityLockEvidenceId',
    'du16.assuranceByEnvironment.prd.retentionFinalization.immutabilityLockEvidenceSha256',
    'du16.assuranceByEnvironment.prd.retentionFinalization.legalHoldEvidenceId',
    'du16.assuranceByEnvironment.prd.retentionFinalization.legalHoldEvidenceSha256'
  )) {
    $sentinelScopePaths.Add($path)
  }
}
if (
  $selectedDu -eq 'DU-04' -and
  [bool](Get-ObjectValue $params "du04.deployRecoveryByEnvironment.$selectedEnv")
) {
  $sentinelScopePaths.Add("du04.workloadRecoveryNetworkByEnvironment.$selectedEnv.subnets")
}
if ($selectedDu -eq 'DU-15') {
  $ingressSubscriptionId = [string](Get-ObjectValue $params "du15.subscriptionIdByEnvironment.$selectedEnv")
  if ($ingressSubscriptionId) {
    $sentinelScopePaths.Add("applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription.$ingressSubscriptionId")
  }
}

$sentinelViolations = @()
foreach($path in $sentinelScopePaths | Select-Object -Unique) {
  $value = Get-ObjectValue $params $path
  if ($null -eq $value) {
    $sentinelViolations += "parameters.$path"
  }
  else {
    Add-SentinelViolations -Node $value -Path "parameters.$path" `
      -SelectedEnvironment $selectedEnv -Violations ([ref]$sentinelViolations)
  }
}
if ($sentinelViolations.Count -gt 0) {
  $failures.Add("Selected-stage sentinel/empty values detected: $($sentinelViolations -join ', ')")
}

if ($mandatoryByDu.ContainsKey($selectedDu)) {
  foreach($path in $mandatoryByDu[$selectedDu]) {
    $value = Get-ObjectValue $params $path
    $items = To-Enumerable $value
    if ($items.Count -eq 0) {
      $failures.Add("Mandatory selected-DU collection/object is empty: $path")
    }
  }
}

# Known constants: queues, jobs, endpoint service inventory, ALT intents
$requiredQueues = @('q-ingestion','q-extraction','q-analysis','q-indexing','q-audit-export')
$approvedRuntimeQueues = @('q-ingestion','q-extraction','q-indexing')
$blockedRuntimeQueues = @('q-analysis','q-audit-export')
$expectedServiceBusAccessPaths = @(
  'uami-api|q-ingestion|69a216fc-b8fb-44d8-bc22-1f3c2cd27a39',
  'uami-api|q-extraction|69a216fc-b8fb-44d8-bc22-1f3c2cd27a39',
  'uami-api|q-indexing|69a216fc-b8fb-44d8-bc22-1f3c2cd27a39',
  'uami-ingest|q-ingestion|4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0',
  'uami-extraction|q-extraction|4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0',
  'uami-extraction|q-indexing|69a216fc-b8fb-44d8-bc22-1f3c2cd27a39',
  'uami-indexer|q-indexing|4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
)

if ($script:activeDeploymentUnits -contains 'DU-04') {
  $reservedSubnetNames = @(
    'AzureFirewallSubnet',
    'AzureFirewallManagementSubnet',
    'AzureBastionSubnet',
    'GatewaySubnet',
    'RouteServerSubnet'
  )
  foreach($envName in @($selectedEnv)) {
    $networkContracts = @(
      [pscustomobject]@{
        role = 'primary'
        network = Get-ObjectValue $params "du04.workloadPrimaryNetworkByEnvironment.$envName"
        expectedFirewallIp = [string](Get-ObjectValue $params 'du04.hubPrimaryNetwork.firewallPrivateIpAddress')
        requiredSubnetNames = @('snet-apim','snet-app','snet-private-endpoints')
      }
    )
    if ([bool](Get-ObjectValue $params "du04.deployRecoveryByEnvironment.$envName")) {
      $networkContracts += [pscustomobject]@{
        role = 'recovery'
        network = Get-ObjectValue $params "du04.workloadRecoveryNetworkByEnvironment.$envName"
        expectedFirewallIp = [string](Get-ObjectValue $params 'du04.hubRecoveryNetwork.firewallPrivateIpAddress')
        requiredSubnetNames = @('snet-private-endpoints')
      }
    }

    foreach($contract in $networkContracts) {
      if ([string]::IsNullOrWhiteSpace($contract.expectedFirewallIp)) {
        $failures.Add("Workload $($contract.role) network for $envName has no corresponding regional firewall private IP")
        continue
      }
      $subnets = @(To-Enumerable $contract.network.subnets)
      $subnetNames = @($subnets | ForEach-Object { [string]$_.name })
      $missingSubnetNames = @($contract.requiredSubnetNames | Where-Object { $subnetNames -notcontains $_ })
      if ($missingSubnetNames.Count -gt 0) {
        $failures.Add("Workload $($contract.role) network for $envName is missing required subnets: $($missingSubnetNames -join ',')")
      }

      foreach($subnet in $subnets) {
        $subnetName = [string]$subnet.name
        if ($reservedSubnetNames -contains $subnetName) {
          continue
        }
        $rules = @(To-Enumerable $subnet.nsgRules)
        $routes = @(To-Enumerable $subnet.routeEntries)
        if ($rules.Count -eq 0) {
          $failures.Add("Workload $($contract.role) subnet $envName/$subnetName has an empty NSG rule set")
        }
        $denyInbound = @(
          $rules | Where-Object {
            [string](Get-ObjectValue $_ 'properties.direction') -ceq 'Inbound' -and
            [string](Get-ObjectValue $_ 'properties.access') -ceq 'Deny' -and
            [string](Get-ObjectValue $_ 'properties.sourceAddressPrefix') -ceq '*' -and
            [string](Get-ObjectValue $_ 'properties.destinationAddressPrefix') -ceq '*'
          }
        )
        $denyOutbound = @(
          $rules | Where-Object {
            [string](Get-ObjectValue $_ 'properties.direction') -ceq 'Outbound' -and
            [string](Get-ObjectValue $_ 'properties.access') -ceq 'Deny' -and
            [string](Get-ObjectValue $_ 'properties.sourceAddressPrefix') -ceq '*' -and
            [string](Get-ObjectValue $_ 'properties.destinationAddressPrefix') -ceq '*'
          }
        )
        if ($denyInbound.Count -ne 1 -or $denyOutbound.Count -ne 1) {
          $failures.Add("Workload $($contract.role) subnet $envName/$subnetName must contain exactly one explicit deny-all rule in each direction")
        }
        $defaultRoutes = @(
          $routes | Where-Object {
            [string](Get-ObjectValue $_ 'properties.addressPrefix') -ceq '0.0.0.0/0' -and
            [string](Get-ObjectValue $_ 'properties.nextHopType') -ceq 'VirtualAppliance'
          }
        )
        if (
          $defaultRoutes.Count -ne 1 -or
          [string](Get-ObjectValue $defaultRoutes[0] 'properties.nextHopIpAddress') -cne $contract.expectedFirewallIp
        ) {
          $actualNextHop = if ($defaultRoutes.Count -eq 1) {
            [string](Get-ObjectValue $defaultRoutes[0] 'properties.nextHopIpAddress')
          }
          else {
            '<missing-or-duplicate>'
          }
          $failures.Add("Workload $($contract.role) subnet $envName/$subnetName must route 0.0.0.0/0 through the corresponding regional firewall. expected=$($contract.expectedFirewallIp) actual=$actualNextHop")
        }
        if (
          $subnetName -ceq 'snet-private-endpoints' -and
          [string]$subnet.privateEndpointNetworkPolicies -cne 'Enabled'
        ) {
          $failures.Add("Private-endpoint network policies must be Enabled for $envName/$($contract.role)/$subnetName")
        }
      }
    }
  }
}

foreach($envName in @('dev','tst','prd')) {
  $sbSku = [string](Get-ObjectValue $params "du10.integrationByEnvironment.$envName.serviceBus.skuName")
  $sbTier = [string](Get-ObjectValue $params "du10.integrationByEnvironment.$envName.serviceBus.tier")
  if ($sbSku -ne 'Premium' -or $sbTier -ne 'Premium') {
    $failures.Add("Service Bus contract mismatch for $envName. skuName=$sbSku tier=$sbTier")
  }

  $queueNames = @(To-Enumerable (Get-ObjectValue $params "du10.integrationByEnvironment.$envName.serviceBus.queues") | ForEach-Object { [string]$_.name })
  $actualQueues = (($queueNames | Sort-Object -Unique) -join ',')
  $expectedQueues = (($requiredQueues | Sort-Object -Unique) -join ',')
  if ($actualQueues -ne $expectedQueues) {
    $failures.Add("Queue contract mismatch for $envName. Found=$($queueNames -join ',')")
  }

  $serviceBusAssignments = @(To-Enumerable (Get-ObjectValue $params "du10.integrationByEnvironment.$envName.serviceBus.roleAssignments"))
  $actualServiceBusAccessPaths = @(
    $serviceBusAssignments | ForEach-Object {
      '{0}|{1}|{2}' -f [string]$_.identityName, [string]$_.queueName, [string]$_.roleDefinitionId
    }
  )
  $actualServiceBusAccessContract = (($actualServiceBusAccessPaths | Sort-Object) -join ',')
  $expectedServiceBusAccessContract = (($expectedServiceBusAccessPaths | Sort-Object) -join ',')
  if (
    $serviceBusAssignments.Count -ne $expectedServiceBusAccessPaths.Count -or
    $actualServiceBusAccessContract -cne $expectedServiceBusAccessContract
  ) {
    $failures.Add("Service Bus queue-scoped RBAC contract mismatch for $envName. Found=$($actualServiceBusAccessPaths -join ',')")
  }

  $workerJobs = @(To-Enumerable (Get-ObjectValue $params "du12.platformByEnvironment.$envName.workerJobs"))
  $jobQueueNames = @($workerJobs | ForEach-Object { [string]$_.queueName })
  $actualJobQueues = (($jobQueueNames | Sort-Object -Unique) -join ',')
  if ($actualJobQueues -ne $expectedQueues) {
    $failures.Add("Worker queue binding contract mismatch for $envName. Found=$($jobQueueNames -join ',')")
  }

  foreach($workerJob in $workerJobs) {
    $queueName = [string]$workerJob.queueName
    $hasDeploymentFlag = $workerJob.PSObject.Properties.Name -contains 'deploymentEnabled'
    $deploymentEnabled = if ($hasDeploymentFlag) { [bool]$workerJob.deploymentEnabled } else { $true }
    if ($blockedRuntimeQueues -contains $queueName -and $deploymentEnabled) {
      $failures.Add("Authority-blocked worker job must not be deployable for $envName. queue=$queueName job=$([string]$workerJob.name)")
    }
    if ($deploymentEnabled -and $approvedRuntimeQueues -notcontains $queueName) {
      $failures.Add("Worker job uses a non-approved runtime queue for $envName. queue=$queueName job=$([string]$workerJob.name)")
    }
  }
  $deployableJobQueues = @(
    $workerJobs |
      Where-Object {
        -not ($_.PSObject.Properties.Name -contains 'deploymentEnabled') -or [bool]$_.deploymentEnabled
      } |
      ForEach-Object { [string]$_.queueName }
  )
  if (
    (($deployableJobQueues | Sort-Object -Unique) -join ',') -cne
    (($approvedRuntimeQueues | Sort-Object -Unique) -join ',')
  ) {
    $failures.Add("Deployable worker queue allowlist mismatch for $envName. Found=$($deployableJobQueues -join ',')")
  }

  $apiApp = Get-ObjectValue $params "du12.platformByEnvironment.$envName.apiApp"
  $entraAuthentication = Get-ObjectValue $apiApp 'entraAuthentication'
  $entraTenantId = [string](Get-ObjectValue $entraAuthentication 'tenantId')
  $entraClientId = [string](Get-ObjectValue $entraAuthentication 'clientId')
  $entraAudience = [string](Get-ObjectValue $entraAuthentication 'allowedAudience')
  $guidPattern = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
  if (($script:activeDeploymentUnits -contains 'DU-12') -and (
    $entraTenantId -notmatch $guidPattern -or
    $entraClientId -notmatch $guidPattern -or
    [string]::IsNullOrWhiteSpace($entraAudience)
  )) {
    $failures.Add("Container Apps Entra authentication owner inputs are incomplete for $envName")
  }

  if ($script:activeDeploymentUnits -contains 'DU-14') {
    $apim = Get-ObjectValue $params "du14.apimByEnvironment.$envName"
    $backendNames = @(
      To-Enumerable (Get-ObjectValue $apim 'backends') |
        ForEach-Object { [string](Get-ObjectValue $_ 'name') }
    )
    foreach($apimApi in To-Enumerable (Get-ObjectValue $apim 'apis')) {
      $apimApiName = [string](Get-ObjectValue $apimApi 'name')
      $apimBackendId = [string](Get-ObjectValue $apimApi 'backendId')
      $apimTenantId = [string](Get-ObjectValue $apimApi 'entraAuthentication.tenantId')
      $apimClientId = [string](Get-ObjectValue $apimApi 'entraAuthentication.clientId')
      $apimAudience = [string](Get-ObjectValue $apimApi 'entraAuthentication.allowedAudience')

      if ($apimBackendId -eq '' -or $apimBackendId -cnotin $backendNames) {
        $failures.Add("APIM API $apimApiName must bind an existing backend for $envName")
      }
      if (
        $apimTenantId -notmatch $guidPattern -or
        $apimClientId -notmatch $guidPattern -or
        [string]::IsNullOrWhiteSpace($apimAudience) -or
        $apimAudience -match '[<>&"'']'
      ) {
        $failures.Add("APIM API $apimApiName Entra authentication owner inputs are invalid for $envName")
      }
      if (
        $apimTenantId -cne $entraTenantId -or
        $apimClientId -cne $entraClientId -or
        $apimAudience -cne $entraAudience
      ) {
        $failures.Add("APIM API $apimApiName and Container Apps identity bindings differ for $envName")
      }
    }
  }

  $apiQueueEnvironmentVariables = @(
    To-Enumerable (Get-ObjectValue $apiApp 'environmentVariables') |
      Where-Object { [string]$_.name -like 'AZURE_SERVICEBUS_QUEUE_*' } |
      ForEach-Object { '{0}|{1}' -f [string]$_.name, [string]$_.value }
  )
  $expectedApiQueueEnvironmentVariables = @(
    'AZURE_SERVICEBUS_QUEUE_INGESTION|q-ingestion',
    'AZURE_SERVICEBUS_QUEUE_EXTRACTION|q-extraction',
    'AZURE_SERVICEBUS_QUEUE_INDEXING|q-indexing'
  )
  if (
    (($apiQueueEnvironmentVariables | Sort-Object) -join ',') -cne
    (($expectedApiQueueEnvironmentVariables | Sort-Object) -join ',')
  ) {
    $failures.Add("Container Apps API queue allowlist mismatch for $envName. Found=$($apiQueueEnvironmentVariables -join ',')")
  }

  $keyVaultBypass = [string](Get-ObjectValue $params "du12.platformByEnvironment.$envName.keyVault.networkBypass")
  if ($keyVaultBypass -notin @('None','AzureServices')) {
    $failures.Add("Key Vault network bypass contract mismatch for $envName. networkBypass=$keyVaultBypass")
  }
  if ($keyVaultBypass -eq 'AzureServices') {
    $bypassEvidenceId = [string](Get-ObjectValue $params "du12.platformByEnvironment.$envName.keyVault.azureServicesBypassEvidenceId")
    $bypassEvidenceHash = [string](Get-ObjectValue $params "du12.platformByEnvironment.$envName.keyVault.azureServicesBypassEvidenceHash")
    if ($bypassEvidenceId -eq '' -or $bypassEvidenceHash -eq '') {
      $failures.Add("Key Vault AzureServices bypass for $envName requires immutable evidence id/hash")
    }
  }

  $intentIds = @(To-Enumerable (Get-ObjectValue $params "du17.diagnosticsByEnvironment.$envName.assuranceAlerts") | ForEach-Object { [string]$_.intentId })
  $requiredIntents = 1..10 | ForEach-Object { 'ALT-{0:d3}' -f $_ }
  $actualIntents = (($intentIds | Sort-Object -Unique) -join ',')
  $expectedIntents = (($requiredIntents | Sort-Object -Unique) -join ',')
  if ($actualIntents -ne $expectedIntents) {
    $failures.Add("Assurance alert intent contract mismatch for $envName. Found=$($intentIds -join ',')")
  }

  $requiredServices = @('sql-primary','servicebus','keyvault','appconfig','search','openai','documentintelligence','acr','apim','monitor')
  $actualServices = @(To-Enumerable (Get-ObjectValue $params "du13.privateEndpointsByEnvironment.$envName") | ForEach-Object { [string]$_.serviceType })
  if ($envName -eq 'prd') {
    $requiredServices += @('sql-recovery','apim-recovery')
  }
  $missing = @($requiredServices | Where-Object { $actualServices -notcontains $_ })
  if ($missing.Count -gt 0) {
    $failures.Add("Private endpoint inventory missing for ${envName}: $($missing -join ',')")
  }
}

$approvedLocations = To-Enumerable (Get-ObjectValue $params 'du02.approvedLocationList')

$environmentValue = [string](Get-ObjectValue $params 'environment')
$primaryLocation = [string](Get-ObjectValue $params 'approvedPrimaryLocation')
$recoveryLocation = [string](Get-ObjectValue $params 'approvedRecoveryLocation')

# exact 22 assertions from stratton-implementation-catalogue.json
Add-Assertion 'ASR-01' 'environment is exactly dev, tst or prd' (
  @('dev','tst','prd') -contains $environmentValue
) "environment=$environmentValue"

Add-Assertion 'ASR-02' 'prd location is present in the signed approvedLocation list' (
  $approvedLocations -contains $primaryLocation
) "approvedPrimaryLocation=$primaryLocation" 'DU-02'

Add-Assertion 'ASR-03' 'primary and recovery regions are present, distinct and in the same signed approvedLocation evidence' (
  $primaryLocation -ne '' -and $recoveryLocation -ne '' -and $primaryLocation -ne $recoveryLocation -and ($approvedLocations -contains $primaryLocation) -and ($approvedLocations -contains $recoveryLocation) -and ([string](Get-ObjectValue $params 'approvedLocationEvidenceId')) -ne ''
) "primary=$primaryLocation recovery=$recoveryLocation evidenceId=$([string](Get-ObjectValue $params 'approvedLocationEvidenceId'))" 'DU-02'

$deploymentTypeValues = @()
foreach($envName in @('dev','tst','prd')) {
  $serviceType = [string](Get-ObjectValue $params "du11.aiByEnvironment.$envName.serviceInventory.deploymentType")
  if ($serviceType) { $deploymentTypeValues += $serviceType }
  foreach($dep in To-Enumerable (Get-ObjectValue $params "du11.aiByEnvironment.$envName.deployments")) {
    if ($dep.deploymentType) { $deploymentTypeValues += [string]$dep.deploymentType }
  }
}
Add-Assertion 'ASR-04' 'Azure AI deployment type is regional and never Global or DataZone' (
  $deploymentTypeValues.Count -gt 0 -and (@($deploymentTypeValues | Where-Object { $_ -notmatch '^(?i)regional$' }).Count -eq 0)
) "deploymentTypes=$($deploymentTypeValues -join ',')" 'DU-11'

$subIds = @(
  [string](Get-ObjectValue $params 'citadelManagementSubscriptionId'),
  [string](Get-ObjectValue $params 'citadelConnectivitySubscriptionId'),
  [string](Get-ObjectValue $params 'citadelAiGovernanceSubscriptionId'),
  [string](Get-ObjectValue $params 'strattonNonproductionSubscriptionId'),
  [string](Get-ObjectValue $params 'strattonProductionSubscriptionId'),
  [string](Get-ObjectValue $params 'strattonAssuranceProductionSubscriptionId')
)
Add-Assertion 'ASR-05' 'Citadel management, connectivity, AI-governance, nonproduction, production and assurance subscription IDs are distinct' (
  ($subIds | Select-Object -Unique).Count -eq 6 -and @($subIds | Where-Object { $_ -eq '' }).Count -eq 0
) "subscriptionIds=$($subIds -join ',')" 'DU-01'

$sqlPublicFlags = @()
foreach($envName in @('dev','tst','prd')) {
  $sqlPublicFlags += [string](Get-ObjectValue $params "du09.dataByEnvironment.$envName.sql.publicNetworkAccess")
}
Add-Assertion 'ASR-06' 'all SQL servers set publicNetworkAccess=Disabled' (
  $sqlPublicFlags.Count -eq 3 -and (@($sqlPublicFlags | Where-Object { $_ -ne 'Disabled' }).Count -eq 0)
) "sqlPublicNetworkAccess=$($sqlPublicFlags -join ',')" 'DU-09'

$sqlBackups = @()
foreach($envName in @('dev','tst','prd')) {
  $primary = [string](Get-ObjectValue $params "du09.dataByEnvironment.$envName.primaryLocation")
  $fromMap = [string](Get-ObjectValue $params "sqlRequestedBackupStorageRedundancyByEnvironmentAndRegion.$envName.$primary")
  $fromDu = [string](Get-ObjectValue $params "du09.dataByEnvironment.$envName.sql.backupStorageRedundancy")
  $value = if ($fromMap) { $fromMap } else { $fromDu }
  $sqlBackups += $value
}
$prdBackup = $sqlBackups[2]
$prdGeoOverride = [bool](Get-ObjectValue $params 'du09.dataByEnvironment.prd.sql.pairedRegionApproved')
Add-Assertion 'ASR-07' 'every SQL database explicitly sets requestedBackupStorageRedundancy; prd accepts only Local or Zone after capability evidence and rejects Geo and GeoZone unless a later approved design proves the paired region is signed-approved' (
  @($sqlBackups | Where-Object { $_ -eq '' }).Count -eq 0 -and (
    @('Local','Zone') -contains $prdBackup -or ((@('Geo','GeoZone') -contains $prdBackup) -and $prdGeoOverride -and ($approvedLocations -contains $recoveryLocation))
  )
) "sqlBackupValues=$($sqlBackups -join ',')" 'DU-09'

$apimChecks = @()
foreach($envName in @('dev','tst','prd')) {
  $apimChecks += [pscustomobject]@{
    env = $envName
    pe = [string](Get-ObjectValue $params "du14.privateEndpointEvidenceStateByEnvironment.$envName")
    dns = [string](Get-ObjectValue $params "du14.dnsEvidenceStateByEnvironment.$envName")
    api = [string](Get-ObjectValue $params "du14.apiAdmissionEvidenceStateByEnvironment.$envName")
    peId = [string](Get-ObjectValue $params "du14.privateEndpointEvidenceIdByEnvironment.$envName")
    peHash = [string](Get-ObjectValue $params "du14.privateEndpointEvidenceHashByEnvironment.$envName")
    dnsId = [string](Get-ObjectValue $params "du14.dnsEvidenceIdByEnvironment.$envName")
    dnsHash = [string](Get-ObjectValue $params "du14.dnsEvidenceHashByEnvironment.$envName")
    apiId = [string](Get-ObjectValue $params "du14.apiAdmissionEvidenceIdByEnvironment.$envName")
    apiHash = [string](Get-ObjectValue $params "du14.apiAdmissionEvidenceHashByEnvironment.$envName")
    pna = [string](Get-ObjectValue $params "du14.apimByEnvironment.$envName.publicNetworkAccess")
  }
}
Add-Assertion 'ASR-08' 'API Management publicNetworkAccess=Disabled is admitted only after approved private endpoint and central private DNS proof; public gateway fallback is prohibited' (
  @($apimChecks | Where-Object { $_.pe -ne 'APPROVED' -or $_.dns -ne 'APPROVED' -or $_.api -ne 'APPROVED' -or $_.pna -ne 'Disabled' -or $_.peId -eq '' -or $_.peHash -eq '' -or $_.dnsId -eq '' -or $_.dnsHash -eq '' -or $_.apiId -eq '' -or $_.apiHash -eq '' }).Count -eq 0
) "apimChecks=$($apimChecks | ConvertTo-Json -Compress)" 'DU-14'

$appConfigFlags = @()
foreach($envName in @('dev','tst','prd')) {
  $appConfigFlags += [string](Get-ObjectValue $params "du09.dataByEnvironment.$envName.appConfiguration.publicNetworkAccess")
}
Add-Assertion 'ASR-09' 'App Configuration public network access is Disabled in every environment' (
  @($appConfigFlags | Where-Object { $_ -ne 'Disabled' }).Count -eq 0
) "appConfigurationFlags=$($appConfigFlags -join ',')" 'DU-09'

$storageCompliance = @()
foreach($envName in @('dev','tst','prd')) {
  foreach($st in To-Enumerable (Get-ObjectValue $params "du09.dataByEnvironment.$envName.storageAccounts")) {
    $storageCompliance += ($st.publicNetworkAccess -eq 'Disabled' -and [bool]$st.allowBlobPublicAccess -eq $false)
  }
}
Add-Assertion 'ASR-10' 'all storage accounts disallow blob public access and public network access' (
  $storageCompliance.Count -gt 0 -and @($storageCompliance | Where-Object { -not $_ }).Count -eq 0
) "storageCompliance=$($storageCompliance -join ',')" 'DU-09'

$supportedPna = @()
foreach($envName in @('dev','tst','prd')) {
  $supportedPna += [string](Get-ObjectValue $params "du10.integrationByEnvironment.$envName.serviceBus.publicNetworkAccess")
  $supportedPna += [string](Get-ObjectValue $params "du10.integrationByEnvironment.$envName.apim.publicNetworkAccess")
  $supportedPna += [string](Get-ObjectValue $params "du11.aiByEnvironment.$envName.publicNetworkAccess")
  $supportedPna += [string](Get-ObjectValue $params "du09.dataByEnvironment.$envName.appConfiguration.publicNetworkAccess")
  $supportedPna += [string](Get-ObjectValue $params "du09.dataByEnvironment.$envName.sql.publicNetworkAccess")
}
Add-Assertion 'ASR-11' 'all supported data and AI services disable public network access' (
  @($supportedPna | Where-Object { $_ -ne 'Disabled' }).Count -eq 0
) "servicePublicNetworkAccess=$($supportedPna -join ',')" 'DU-11'

$appGwEvidenceValues = @()
$targetIngressSubs = @()
foreach($envName in @('dev','tst','prd')) {
  $sid = [string](Get-ObjectValue $params "du15.subscriptionIdByEnvironment.$envName")
  if ($sid) { $targetIngressSubs += $sid }
}
foreach($sid in ($targetIngressSubs | Select-Object -Unique)) {
  $appGwEvidenceValues += [string](Get-ObjectValue $params "applicationGatewayNetworkIsolationFeatureRegistrationEvidenceBySubscription.$sid")
}
Add-Assertion 'ASR-12' 'Microsoft.Network/EnableApplicationGatewayNetworkIsolation is Registered in every private-only Application Gateway target subscription before ingress admission' (
  $appGwEvidenceValues.Count -gt 0 -and @($appGwEvidenceValues | Where-Object { $_ -ne 'Registered' }).Count -eq 0
) "featureRegistrations=$($appGwEvidenceValues -join ',')" 'DU-15'

$firewallPips = To-Enumerable (Get-ObjectValue $params 'du02.approvedFirewallPublicIpResourceIds')
$workloadPublicIpFlags = @(
  [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.dev.workloadPublicIpAllowed'),
  [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.tst.workloadPublicIpAllowed'),
  [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.prd.workloadPublicIpAllowed')
)
$connectivitySub = [string](Get-ObjectValue $params 'citadelConnectivitySubscriptionId')
Add-Assertion 'ASR-13' 'no workload public IP; only Citadel regional Firewall Premium public egress IPs are allowed in the connectivity subscription' (
  $firewallPips.Count -gt 0 -and @($workloadPublicIpFlags | Where-Object { $_ }).Count -eq 0 -and @($firewallPips | Where-Object { $_ -notmatch "^/subscriptions/$connectivitySub/resourceGroups/.+/providers/Microsoft.Network/publicIPAddresses/.+" }).Count -eq 0
) "firewallPips=$($firewallPips -join ',') workloadPublicIpFlags=$($workloadPublicIpFlags -join ',')" 'DU-04'

$nonProdSynthetic = @()
foreach($envName in @('dev','tst')) {
  foreach($rg in To-Enumerable (Get-ObjectValue $params "du03.workloadGroupsByEnvironment.$envName")) {
    $nonProdSynthetic += [string]$rg.tags.dataClassification
  }
}
Add-Assertion 'ASR-14' 'nonproduction dataClassification is synthetic' (
  $nonProdSynthetic.Count -gt 0 -and @($nonProdSynthetic | Where-Object { $_ -ne 'synthetic' }).Count -eq 0
) "nonprodDataClassification=$($nonProdSynthetic -join ',')" 'DU-03'

$prdVnet = [string](Get-ObjectValue $params 'du04.workloadPrimaryNetworkByEnvironment.prd.name')
$devVnet = [string](Get-ObjectValue $params 'du04.workloadPrimaryNetworkByEnvironment.dev.name')
$tstVnet = [string](Get-ObjectValue $params 'du04.workloadPrimaryNetworkByEnvironment.tst.name')
Add-Assertion 'ASR-15' 'production uses a distinct subscription and VNet from nonproduction' (
  ([string](Get-ObjectValue $params 'strattonProductionSubscriptionId')) -ne ([string](Get-ObjectValue $params 'strattonNonproductionSubscriptionId')) -and $prdVnet -ne $devVnet -and $prdVnet -ne $tstVnet
) "prdVnet=$prdVnet devVnet=$devVnet tstVnet=$tstVnet" 'DU-04'

Add-Assertion 'ASR-16' 'production primary and recovery spokes connect only to their corresponding Citadel regional hub' (
  [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.prd.correspondingHubOnly')
) 'du04.peeringContractByEnvironment.prd.correspondingHubOnly must be true' 'DU-04'

Add-Assertion 'ASR-17' 'no environment-to-environment peering' (
  -not [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.dev.allowEnvironmentPeering') -and -not [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.tst.allowEnvironmentPeering') -and -not [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.prd.allowEnvironmentPeering')
) 'allowEnvironmentPeering must be false in all environments' 'DU-04'

$identityNames = @(To-Enumerable (Get-ObjectValue $params 'du06.identities') | ForEach-Object { [string]$_.name })
$requiredIdentityNames = @('uami-api','uami-ingest','uami-extraction','uami-analysis','uami-indexer','uami-audit-export','uami-deploy','uami-monitor','uami-role-assignment-executor','uami-assurance-authority')
$keysText = ($params.Keys -join ',')
Add-Assertion 'ASR-18' 'managed identity is enabled and secret-based authentication parameters do not exist' (
  @($requiredIdentityNames | Where-Object { $identityNames -contains $_ }).Count -eq $requiredIdentityNames.Count -and ($keysText -notmatch '(?i)password|clientSecret|connectionString')
) "identityNames=$($identityNames -join ',') parameterNames=$keysText" 'DU-06'

$immuEvidenceDays = Get-IntOrDefault (Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.evidenceStorage.immutabilityDays')
$immuVerdictDays = Get-IntOrDefault (Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.verdictStorage.immutabilityDays')
$retentionState = [string](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.state')
$dataAdmissionEnabled = [bool](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.dataAdmissionEnabled')
$lockRequired = [bool](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.immutabilityLockRequired')
$legalHoldRequired = [bool](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.legalHoldRequired')
$lockEvidenceId = [string](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.immutabilityLockEvidenceId')
$lockEvidenceHash = [string](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.immutabilityLockEvidenceSha256')
$legalHoldEvidenceId = [string](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.legalHoldEvidenceId')
$legalHoldEvidenceHash = [string](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.retentionFinalization.legalHoldEvidenceSha256')
$blockedRetentionState = 'BLOCKED_PENDING_SEPARATELY_AUTHORISED_LOCK_AND_LEGAL_HOLD_EVIDENCE'
$activeRetentionState = 'ACTIVE_OBSERVED_LOCK_AND_LEGAL_HOLD_EVIDENCE_VERIFIED'
$observedRetentionEvidenceComplete = (
  $lockEvidenceId -ne '' -and
  $lockEvidenceHash -match '^[a-f0-9]{64}$' -and
  $legalHoldEvidenceId -ne '' -and
  $legalHoldEvidenceHash -match '^[a-f0-9]{64}$'
)
$retentionGatePasses = (
  $lockRequired -and
  $legalHoldRequired -and
  $immuEvidenceDays -gt 0 -and
  $immuVerdictDays -gt 0 -and
  (
    (-not $dataAdmissionEnabled -and $retentionState -ceq $blockedRetentionState) -or
    ($dataAdmissionEnabled -and $retentionState -ceq $activeRetentionState -and $observedRetentionEvidenceComplete)
  )
)
Add-Assertion 'ASR-19' 'data admission stays blocked until separately authorised observed immutability-lock and legal-hold evidence is bound' (
  $retentionGatePasses
) "state=$retentionState dataAdmissionEnabled=$dataAdmissionEnabled lockEvidence=$($lockEvidenceId -ne '') legalHoldEvidence=$($legalHoldEvidenceId -ne '')" 'DU-16'

if ($script:activeDeploymentUnits -contains 'DU-16') {
  $copierAuthority = [string](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.evidenceReaderCopierAuthority')
  $copierRole = [string](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.evidenceReaderCopierRoleDefinitionId')
  $copierPrincipal = [string](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.evidenceReaderCopierPrincipalId')
  $auditPrincipal = [string](Get-ObjectValue $params 'internalAuditSubscriptionIdAndAdminGroup.internalAuditAdminGroupObjectId')
  if ($copierAuthority -cne 'Internal Audit') {
    $failures.Add("DU-16 assurance evidence reader-copier authority must be Internal Audit. authority=$copierAuthority")
  }
  if ($copierRole -cne 'ba92f5b4-2d11-453d-a403-e96b0029c9fe') {
    $failures.Add("DU-16 assurance evidence reader-copier must use Storage Blob Data Contributor at the exact evidence-container scope. role=$copierRole")
  }
  if ($copierPrincipal -eq '' -or $copierPrincipal -ceq $auditPrincipal) {
    $failures.Add('DU-16 assurance evidence reader-copier must be a separately controlled service principal, not the Internal Audit admin group')
  }
  if ($null -ne (Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.deliveryPrincipalId')) {
    $failures.Add('DU-16 deliveryPrincipalId is prohibited; delivery may not write directly to assurance storage')
  }
}

$fineTuningFlags = @()
foreach($envName in @('dev','tst','prd')) {
  foreach($dep in To-Enumerable (Get-ObjectValue $params "du11.aiByEnvironment.$envName.deployments")) {
    if ($dep.PSObject.Properties.Name -contains 'fineTuningEnabled') {
      $fineTuningFlags += (-not [bool]$dep.fineTuningEnabled)
    }
    if ($dep.PSObject.Properties.Name -contains 'deploymentType') {
      $fineTuningFlags += -not ([string]$dep.deploymentType -match '(?i)global|datazone')
    }
  }
}
Add-Assertion 'ASR-20' 'AI fine-tuning and Global/DataZone deployment flags are false unless a later approved design change says otherwise' (
  $fineTuningFlags.Count -gt 0 -and @($fineTuningFlags | Where-Object { -not $_ }).Count -eq 0
) "aiFlags=$($fineTuningFlags -join ',')" 'DU-11'

Add-Assertion 'ASR-21' 'rollout admission maximum remains 20' (
  (Get-IntOrDefault (Get-ObjectValue $params 'rolloutAdmissionMaximum')) -eq 20
) "rolloutAdmissionMaximum=$(Get-ObjectValue $params 'rolloutAdmissionMaximum')"

$tagKeys = To-Enumerable (Get-ObjectValue $params 'du02.requiredTagKeys')
$requiredTagSet = @('environment','workload','owner','costCenter','dataClassification','criticality','managedBy')
Add-Assertion 'ASR-22' 'tags environment, workload, owner, costCenter, dataClassification, criticality and managedBy are present' (
  @($requiredTagSet | Where-Object { $tagKeys -contains $_ }).Count -eq 7
) "requiredTagKeys=$($tagKeys -join ',')" 'DU-02'

if ($selectedDu -eq 'DU-01') {
  if ([string](Get-ObjectValue $params 'du01.mode') -eq 'preprovisioned') {
    if (-not (Get-ObjectValue $params 'du01.placementEvidenceId') -or -not (Get-ObjectValue $params 'du01.placementEvidenceHash')) {
      $failures.Add('DU-01 preprovisioned mode requires immutable placement evidence id/hash')
    }
  }

  if ($RuntimeTenantId) {
    if ([string](Get-ObjectValue $params 'tenantId') -ne $RuntimeTenantId) {
      $failures.Add("DU-01 tenant mismatch. declared=$([string](Get-ObjectValue $params 'tenantId')) runtime=$RuntimeTenantId")
    }
  }
  else {
    $failures.Add('DU-01 preflight requires -RuntimeTenantId to enforce declared/runtime tenant equality')
  }
}

$result = [pscustomobject]@{
  deploymentUnitId = $selectedDu
  environment = $selectedEnv
  assertionCount = $assertions.Count
  failedAssertionCount = @($assertions | Where-Object { -not $_.pass }).Count
  assertions = $assertions
  failures = $failures
  passed = ($failures.Count -eq 0)
}

if ($OutputJson) {
  $result | ConvertTo-Json -Depth 100
}
else {
  if ($result.passed) {
    Write-Host "Preflight passed. Assertions evaluated: $($result.assertionCount)."
  }
  else {
    Write-Host "Preflight failed. Issues: $($result.failures.Count)."
    $result.failures | ForEach-Object { Write-Host " - $_" }
  }
}

if (-not $result.passed) { exit 1 }
exit 0
