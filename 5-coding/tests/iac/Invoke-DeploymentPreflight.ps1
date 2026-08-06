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
  param($Node,[string]$Path,[ref]$Violations)
  if ($null -eq $Node) { return }
  if ($Node -is [string]) {
    if ($Node.Trim() -eq '' -or $Node -match 'REQUIRED_OWNER_INPUT') {
      $Violations.Value += $Path
    }
    return
  }
  if ($Node -is [System.Collections.IDictionary]) {
    if ($Node.Keys.Count -eq 0) {
      $Violations.Value += "$Path{}"
      return
    }
    foreach($key in $Node.Keys) {
      Add-SentinelViolations -Node $Node[$key] -Path ("$Path.$key") -Violations $Violations
    }
    return
  }
  if ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) {
    $items = @($Node)
    if ($items.Count -eq 0) {
      $Violations.Value += "$Path[]"
      return
    }
    for($i=0; $i -lt $items.Count; $i++) {
      Add-SentinelViolations -Node $items[$i] -Path ("$Path[$i]") -Violations $Violations
    }
    return
  }
  foreach($prop in $Node.PSObject.Properties) {
    Add-SentinelViolations -Node $prop.Value -Path ("$Path.$($prop.Name)") -Violations $Violations
  }
}


function Get-IntOrDefault {
  param($Value,[int]$Default = 0)
  $parsed = 0
  if ([int]::TryParse([string]$Value, [ref]$parsed)) { return $parsed }
  return $Default
}

function Add-Assertion {
  param([string]$Id,[string]$Text,[bool]$Pass,[string]$FailureDetail)
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

$sentinelViolations = @()
Add-SentinelViolations -Node $params -Path 'parameters' -Violations ([ref]$sentinelViolations)
if ($sentinelViolations.Count -gt 0) {
  $failures.Add("Sentinel/empty values detected: $($sentinelViolations -join ', ')")
}

$duPathById = @{
  'DU-01' = 'du01'; 'DU-02' = 'du02'; 'DU-03' = 'du03'; 'DU-04' = 'du04'; 'DU-05' = 'du05'; 'DU-06' = 'du06'; 'DU-07' = 'du07'; 'DU-08' = 'du08';
  'DU-09' = 'du09'; 'DU-10' = 'du10'; 'DU-11' = 'du11'; 'DU-12' = 'du12'; 'DU-13' = 'du13'; 'DU-14' = 'du14'; 'DU-15' = 'du15'; 'DU-16' = 'du16'; 'DU-17' = 'du17'
}
if ($duPathById.ContainsKey($selectedDu)) {
  $obj = Get-ObjectValue $params $duPathById[$selectedDu]
  if ($null -eq $obj) {
    $failures.Add("Missing selected DU object: $($duPathById[$selectedDu])")
  }
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
  'DU-02' = @('du02.requiredTagKeys','du02.approvedLocationList','du02.approvedFirewallPublicIpResourceIds')
  'DU-03' = @('du03.managementGroups','du03.connectivityGroups','du03.aiGovernanceGroups',"du03.workloadGroupsByEnvironment.$selectedEnv")
  'DU-04' = @('du04.hubPrimaryNetwork.subnets','du04.hubRecoveryNetwork.subnets',"du04.workloadPrimaryNetworkByEnvironment.$selectedEnv.subnets")
  'DU-05' = @('du05.privateZones','du05.resolver.forwardingRulesets','du05.resolver.forwardingRules','du05.resolver.forwardingVirtualNetworkLinks')
  'DU-06' = @('du06.identities','du06.resourceGroupRoleAssignments')
  'DU-09' = @("du09.dataByEnvironment.$selectedEnv.storageAccounts", "du09.dataByEnvironment.$selectedEnv.storageContainers")
  'DU-10' = @("du10.integrationByEnvironment.$selectedEnv.serviceBus.queues")
  'DU-11' = @("du11.aiByEnvironment.$selectedEnv.deployments")
  'DU-12' = @("du12.platformByEnvironment.$selectedEnv.workerJobs")
  'DU-13' = @("du13.privateEndpointsByEnvironment.$selectedEnv")
  'DU-14' = @("du14.apimByEnvironment.$selectedEnv.backends", "du14.apimByEnvironment.$selectedEnv.apis")
  'DU-15' = @("du15.ingressByEnvironment.$selectedEnv")
  'DU-16' = @('du16.assuranceByEnvironment.prd')
  'DU-17' = @("du17.diagnosticsByEnvironment.$selectedEnv.assuranceAlerts")
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

  $jobQueueNames = @(To-Enumerable (Get-ObjectValue $params "du12.platformByEnvironment.$envName.workerJobs") | ForEach-Object { [string]$_.queueName })
  $actualJobQueues = (($jobQueueNames | Sort-Object -Unique) -join ',')
  if ($actualJobQueues -ne $expectedQueues) {
    $failures.Add("Worker queue binding contract mismatch for $envName. Found=$($jobQueueNames -join ',')")
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
) "approvedPrimaryLocation=$primaryLocation"

Add-Assertion 'ASR-03' 'primary and recovery regions are present, distinct and in the same signed approvedLocation evidence' (
  $primaryLocation -ne '' -and $recoveryLocation -ne '' -and $primaryLocation -ne $recoveryLocation -and ($approvedLocations -contains $primaryLocation) -and ($approvedLocations -contains $recoveryLocation) -and ([string](Get-ObjectValue $params 'approvedLocationEvidenceId')) -ne ''
) "primary=$primaryLocation recovery=$recoveryLocation evidenceId=$([string](Get-ObjectValue $params 'approvedLocationEvidenceId'))"

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
) "deploymentTypes=$($deploymentTypeValues -join ',')"

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
) "subscriptionIds=$($subIds -join ',')"

$sqlPublicFlags = @()
foreach($envName in @('dev','tst','prd')) {
  $sqlPublicFlags += [string](Get-ObjectValue $params "du09.dataByEnvironment.$envName.sql.publicNetworkAccess")
}
Add-Assertion 'ASR-06' 'all SQL servers set publicNetworkAccess=Disabled' (
  $sqlPublicFlags.Count -eq 3 -and (@($sqlPublicFlags | Where-Object { $_ -ne 'Disabled' }).Count -eq 0)
) "sqlPublicNetworkAccess=$($sqlPublicFlags -join ',')"

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
) "sqlBackupValues=$($sqlBackups -join ',')"

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
) "apimChecks=$($apimChecks | ConvertTo-Json -Compress)"

$appConfigFlags = @()
foreach($envName in @('dev','tst','prd')) {
  $appConfigFlags += [string](Get-ObjectValue $params "du09.dataByEnvironment.$envName.appConfiguration.publicNetworkAccess")
}
Add-Assertion 'ASR-09' 'App Configuration public network access is Disabled in every environment' (
  @($appConfigFlags | Where-Object { $_ -ne 'Disabled' }).Count -eq 0
) "appConfigurationFlags=$($appConfigFlags -join ',')"

$storageCompliance = @()
foreach($envName in @('dev','tst','prd')) {
  foreach($st in To-Enumerable (Get-ObjectValue $params "du09.dataByEnvironment.$envName.storageAccounts")) {
    $storageCompliance += ($st.publicNetworkAccess -eq 'Disabled' -and [bool]$st.allowBlobPublicAccess -eq $false)
  }
}
Add-Assertion 'ASR-10' 'all storage accounts disallow blob public access and public network access' (
  $storageCompliance.Count -gt 0 -and @($storageCompliance | Where-Object { -not $_ }).Count -eq 0
) "storageCompliance=$($storageCompliance -join ',')"

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
) "servicePublicNetworkAccess=$($supportedPna -join ',')"

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
) "featureRegistrations=$($appGwEvidenceValues -join ',')"

$firewallPips = To-Enumerable (Get-ObjectValue $params 'du02.approvedFirewallPublicIpResourceIds')
$workloadPublicIpFlags = @(
  [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.dev.workloadPublicIpAllowed'),
  [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.tst.workloadPublicIpAllowed'),
  [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.prd.workloadPublicIpAllowed')
)
$connectivitySub = [string](Get-ObjectValue $params 'citadelConnectivitySubscriptionId')
Add-Assertion 'ASR-13' 'no workload public IP; only Citadel regional Firewall Premium public egress IPs are allowed in the connectivity subscription' (
  $firewallPips.Count -gt 0 -and @($workloadPublicIpFlags | Where-Object { $_ }).Count -eq 0 -and @($firewallPips | Where-Object { $_ -notmatch "^/subscriptions/$connectivitySub/resourceGroups/.+/providers/Microsoft.Network/publicIPAddresses/.+" }).Count -eq 0
) "firewallPips=$($firewallPips -join ',') workloadPublicIpFlags=$($workloadPublicIpFlags -join ',')"

$nonProdSynthetic = @()
foreach($envName in @('dev','tst')) {
  foreach($rg in To-Enumerable (Get-ObjectValue $params "du03.workloadGroupsByEnvironment.$envName")) {
    $nonProdSynthetic += [string]$rg.tags.dataClassification
  }
}
Add-Assertion 'ASR-14' 'nonproduction dataClassification is synthetic' (
  $nonProdSynthetic.Count -gt 0 -and @($nonProdSynthetic | Where-Object { $_ -ne 'synthetic' }).Count -eq 0
) "nonprodDataClassification=$($nonProdSynthetic -join ',')"

$prdVnet = [string](Get-ObjectValue $params 'du04.workloadPrimaryNetworkByEnvironment.prd.name')
$devVnet = [string](Get-ObjectValue $params 'du04.workloadPrimaryNetworkByEnvironment.dev.name')
$tstVnet = [string](Get-ObjectValue $params 'du04.workloadPrimaryNetworkByEnvironment.tst.name')
Add-Assertion 'ASR-15' 'production uses a distinct subscription and VNet from nonproduction' (
  ([string](Get-ObjectValue $params 'strattonProductionSubscriptionId')) -ne ([string](Get-ObjectValue $params 'strattonNonproductionSubscriptionId')) -and $prdVnet -ne $devVnet -and $prdVnet -ne $tstVnet
) "prdVnet=$prdVnet devVnet=$devVnet tstVnet=$tstVnet"

Add-Assertion 'ASR-16' 'production primary and recovery spokes connect only to their corresponding Citadel regional hub' (
  [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.prd.correspondingHubOnly')
) 'du04.peeringContractByEnvironment.prd.correspondingHubOnly must be true'

Add-Assertion 'ASR-17' 'no environment-to-environment peering' (
  -not [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.dev.allowEnvironmentPeering') -and -not [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.tst.allowEnvironmentPeering') -and -not [bool](Get-ObjectValue $params 'du04.peeringContractByEnvironment.prd.allowEnvironmentPeering')
) 'allowEnvironmentPeering must be false in all environments'

$identityNames = @(To-Enumerable (Get-ObjectValue $params 'du06.identities') | ForEach-Object { [string]$_.name })
$requiredIdentityNames = @('uami-api','uami-ingest','uami-extraction','uami-analysis','uami-indexer','uami-audit-export','uami-deploy','uami-monitor','uami-role-assignment-executor','uami-assurance-authority')
$keysText = ($params.Keys -join ',')
Add-Assertion 'ASR-18' 'managed identity is enabled and secret-based authentication parameters do not exist' (
  @($requiredIdentityNames | Where-Object { $identityNames -contains $_ }).Count -eq $requiredIdentityNames.Count -and ($keysText -notmatch '(?i)password|clientSecret|connectionString')
) "identityNames=$($identityNames -join ',') parameterNames=$keysText"

$immuEvidenceDays = Get-IntOrDefault (Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.evidenceStorage.immutabilityDays')
$immuVerdictDays = Get-IntOrDefault (Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.verdictStorage.immutabilityDays')
Add-Assertion 'ASR-19' 'audit and verdict immutability capability is enabled before data admission' (
  [bool](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.immutabilityLocked') -and [bool](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.legalHoldEnabled') -and $immuEvidenceDays -gt 0 -and $immuVerdictDays -gt 0
) "immutabilityLocked=$([bool](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.immutabilityLocked')) legalHoldEnabled=$([bool](Get-ObjectValue $params 'du16.assuranceByEnvironment.prd.legalHoldEnabled'))"

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
) "aiFlags=$($fineTuningFlags -join ',')"

Add-Assertion 'ASR-21' 'rollout admission maximum remains 20' (
  (Get-IntOrDefault (Get-ObjectValue $params 'rolloutAdmissionMaximum')) -eq 20
) "rolloutAdmissionMaximum=$(Get-ObjectValue $params 'rolloutAdmissionMaximum')"

$tagKeys = To-Enumerable (Get-ObjectValue $params 'du02.requiredTagKeys')
$requiredTagSet = @('environment','workload','owner','costCenter','dataClassification','criticality','managedBy')
Add-Assertion 'ASR-22' 'tags environment, workload, owner, costCenter, dataClassification, criticality and managedBy are present' (
  @($requiredTagSet | Where-Object { $tagKeys -contains $_ }).Count -eq 7
) "requiredTagKeys=$($tagKeys -join ',')"

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


