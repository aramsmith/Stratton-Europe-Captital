[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory)]
    [string]$SubscriptionId,

    [Parameter(Mandatory)]
    [string]$TenantId,

    [Parameter(Mandatory)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory)]
    [string]$EvidenceStorageAccountName,

    [Parameter(Mandatory)]
    [string]$EvidenceContainerName,

    [Parameter(Mandatory)]
    [string]$VerdictStorageAccountName,

    [Parameter(Mandatory)]
    [string]$VerdictContainerName,

    [Parameter(Mandatory)]
    [ValidateCount(1, 10)]
    [ValidatePattern('^[A-Za-z0-9]{3,23}$')]
    [string[]]$LegalHoldTags,

    [Parameter(Mandatory)]
    [string]$HumanAuthorisationPath,

    [Parameter(Mandatory)]
    [ValidatePattern('^[a-f0-9]{64}$')]
    [string]$HumanAuthorisationSha256,

    [Parameter(Mandatory)]
    [string]$EvidenceOutputDirectory,

    [switch]$Execute
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-AzJson {
    param([Parameter(Mandatory)][string[]]$Arguments)

    $output = @(& az @Arguments 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Azure CLI command failed: az $($Arguments -join ' ')`n$($output -join [Environment]::NewLine)"
    }
    return (($output -join "`n") | ConvertFrom-Json -Depth 100)
}

function Get-ObservedValue {
    param(
        [Parameter(Mandatory)][object]$Document,
        [Parameter(Mandatory)][string]$Name
    )

    $direct = $Document.PSObject.Properties[$Name]
    if ($null -ne $direct) {
        return $direct.Value
    }
    $properties = $Document.PSObject.Properties['properties']
    if ($null -ne $properties) {
        $nested = $properties.Value.PSObject.Properties[$Name]
        if ($null -ne $nested) {
            return $nested.Value
        }
    }
    return $null
}

if (-not $Execute) {
    throw 'Retention finalization is irreversible and requires -Execute plus a separately approved Phase 7 human-authorisation record.'
}
if (-not (Test-Path -LiteralPath $HumanAuthorisationPath -PathType Leaf)) {
    throw "Human authorisation record is missing: $HumanAuthorisationPath"
}
$actualAuthorisationHash =
    (Get-FileHash -LiteralPath $HumanAuthorisationPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualAuthorisationHash -cne $HumanAuthorisationSha256) {
    throw 'Human authorisation record hash mismatch.'
}

$context = Invoke-AzJson -Arguments @(
    'account', 'show',
    '--subscription', $SubscriptionId,
    '--output', 'json'
)
if ([string]$context.id -cne $SubscriptionId -or [string]$context.tenantId -cne $TenantId) {
    throw 'Azure context does not match the authorised subscription and tenant.'
}

$targets = @(
    [pscustomobject]@{
        purpose = 'evidence'
        accountName = $EvidenceStorageAccountName
        containerName = $EvidenceContainerName
    },
    [pscustomobject]@{
        purpose = 'verdict'
        accountName = $VerdictStorageAccountName
        containerName = $VerdictContainerName
    }
)

New-Item -ItemType Directory -Path $EvidenceOutputDirectory -Force | Out-Null
$observations = [Collections.Generic.List[object]]::new()

foreach ($target in $targets) {
    $etagOutput = @(
        & az storage container immutability-policy show `
            --subscription $SubscriptionId `
            --resource-group $ResourceGroupName `
            --account-name $target.accountName `
            --container-name $target.containerName `
            --query etag `
            --output tsv 2>&1
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read immutability-policy ETag for $($target.purpose): $($etagOutput -join [Environment]::NewLine)"
    }
    $etag = ($etagOutput | Select-Object -Last 1).ToString().Trim()
    if ([string]::IsNullOrWhiteSpace($etag)) {
        throw "Immutability-policy ETag is absent for $($target.purpose)."
    }

    $operation = "$($target.accountName)/$($target.containerName)"
    if (-not $PSCmdlet.ShouldProcess($operation, 'Permanently lock the immutability policy and set the legal hold')) {
        throw "Retention finalization was not confirmed for $operation."
    }

    [void](Invoke-AzJson -Arguments @(
        'storage', 'container', 'immutability-policy', 'lock',
        '--subscription', $SubscriptionId,
        '--resource-group', $ResourceGroupName,
        '--account-name', $target.accountName,
        '--container-name', $target.containerName,
        '--if-match', $etag,
        '--output', 'json'
    ))
    [void](Invoke-AzJson -Arguments (@(
        'storage', 'container', 'legal-hold', 'set',
        '--subscription', $SubscriptionId,
        '--resource-group', $ResourceGroupName,
        '--account-name', $target.accountName,
        '--container-name', $target.containerName,
        '--tags'
    ) + $LegalHoldTags + @('--output', 'json')))

    $policy = Invoke-AzJson -Arguments @(
        'storage', 'container', 'immutability-policy', 'show',
        '--subscription', $SubscriptionId,
        '--resource-group', $ResourceGroupName,
        '--account-name', $target.accountName,
        '--container-name', $target.containerName,
        '--output', 'json'
    )
    $legalHold = Invoke-AzJson -Arguments @(
        'storage', 'container', 'legal-hold', 'show',
        '--subscription', $SubscriptionId,
        '--resource-group', $ResourceGroupName,
        '--account-name', $target.accountName,
        '--container-name', $target.containerName,
        '--output', 'json'
    )
    $state = [string](Get-ObservedValue -Document $policy -Name 'state')
    $hasLegalHold = [bool](Get-ObservedValue -Document $legalHold -Name 'hasLegalHold')
    $observedTags = @(
        Get-ObservedValue -Document $legalHold -Name 'tags' |
        ForEach-Object { ([string]$_).ToLowerInvariant() }
    )
    $expectedTags = @($LegalHoldTags | ForEach-Object { $_.ToLowerInvariant() })
    if ($state -cne 'Locked') {
        throw "Observed immutability-policy state is not Locked for $operation. state=$state"
    }
    $missingTags = @($expectedTags | Where-Object { $observedTags -notcontains $_ })
    if (-not $hasLegalHold -or $missingTags.Count -gt 0) {
        throw "Observed legal hold is incomplete for $operation. missingTags=$($missingTags -join ',')"
    }

    $observations.Add([ordered]@{
        purpose = $target.purpose
        storageAccountName = $target.accountName
        containerName = $target.containerName
        immutabilityPolicy = $policy
        legalHold = $legalHold
    })
}

$evidence = [ordered]@{
    schemaVersion = '1.0.0'
    operation = 'ASSURANCE_RETENTION_FINALIZATION'
    observedAt = (Get-Date).ToUniversalTime().ToString('o')
    subscriptionId = $SubscriptionId
    tenantId = $TenantId
    humanAuthorisation = [ordered]@{
        path = [IO.Path]::GetFullPath($HumanAuthorisationPath)
        sha256 = $actualAuthorisationHash
    }
    state = 'ACTIVE_OBSERVED_LOCK_AND_LEGAL_HOLD_EVIDENCE_VERIFIED'
    dataAdmissionMayBeSeparatelyAuthorised = $true
    observations = @($observations)
}
$evidencePath = Join-Path $EvidenceOutputDirectory 'assurance-retention-finalization.json'
[IO.File]::WriteAllText(
    [IO.Path]::GetFullPath($evidencePath),
    ($evidence | ConvertTo-Json -Depth 100),
    [Text.UTF8Encoding]::new($false)
)
$evidenceHash = (Get-FileHash -LiteralPath $evidencePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(
    [IO.Path]::GetFullPath((Join-Path $EvidenceOutputDirectory 'assurance-retention-finalization.sha256')),
    $evidenceHash,
    [Text.UTF8Encoding]::new($false)
)

Write-Host "Observed retention evidence: $evidencePath"
Write-Host "Observed retention evidence SHA-256: $evidenceHash"
