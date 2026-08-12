# Security and Compliance Reviewer — Phase 3 — Azure Design

**Change:** `STRATTON-CC-002`  
**Verdict:** `DIVERGES`  
**Reviewer selected/actual model:** `gpt-5.6-terra`  
**Author actual model:** `gpt-5.6-sol`  
**Model-plan revision:** `111` (`64861f18c47c3eaa42cbe71af2e4cc158a5abfe02843fcb6784456a6cb2db9e7`)  
**Manifest:** `stratton-phase-3-hashes-cc-002-proposed.json` (`2184986970076bb5317c31459e335d1e9272973411c3e3d14a1886102b07214a`)  
**Coverage:** `reviews/aff-b/coverage/stratton-compliance-coverage-012.json` (`d835b1f6a2d7b0679fa32a04c6237022ce3c320a193cac300b5baf7291ed8458`)

## Scope and evidence

All eleven candidate files were independently hashed before and after review and copied byte-identically
to `reviewed-subject`. The ten declared manifest artifacts, the manifest, governing specification and
revision 111 matched. Receipt:
`reviewed-subject/stratton-phase-3-hash-verification-receipt.json`
(`e0e497e06a1c05bccc8fadb7ae7992681a8e53248a82a9a18f0b2a0f730bc885`).

The candidate correctly specifies an EU Data Zone prompt/output boundary, EU-geography data at rest,
Microsoft-selected processing region and no specific-region promise; fixed version/API routes,
private-path/managed-identity intent, no silent fallback, blocked promotion and human decision
authority are design controls only. No Azure deployment or runtime test was performed.

GDPR applicability remains confirmed only to the existing register boundary; EU AI Act classification
and DORA applicability remain pending accountable-human legal/compliance evidence. This review does
not infer either classification or applicability.

## Findings

| ID | Severity | Finding | Required remediation |
|---|---|---|---|
| `AFFB-CC002-MAJ-001` | MAJOR | Two-region recovery does not bind EU Data Zone deployment, data/log/index/backup failover or missing-evidence deny/queue semantics. | Bind primary/recovery allow-lists, each route’s DataZoneStandard evidence, recovery data handling and fail-closed conditions. |
| `AFFB-CC002-MAJ-002` | MAJOR | Hostile-evidence scenarios are listed but do not have explicit blocking pass criteria. | Make each security scenario an immutable, fail-closed promotion gate. |
| `AFFB-CC002-MAJ-003` | MAJOR | Provider/model, Data Zone, network and no-training assertions have bare URLs rather than claim-bound provenance and licence evidence. | Add source IDs, exact sections, dates, excerpts/hashes, licences, owners and expiry/use disposition. |
| `AFFB-CC002-MAJ-004` | MAJOR | Privacy lifecycle and telemetry integrity are not bound for the new prompt/output, vector, benchmark and route-log data flows. | Bind minimisation, retention, deletion, legal hold, DSR, redaction, immutable storage, recovery and owners. |
| `AFFB-CC002-MIN-001` | MINOR | HTML merges substantive Markdown anomaly-governance rows. | Regenerate parity-complete HTML. |

## Required action and boundary

Do not approve, promote, deploy or test this candidate. Preserve these reviewed bytes and create an
append-only remediation revision with a new manifest, then repeat complete AFF-A/AFF-B review.

This is architecture security and compliance assurance only, not legal advice, certification,
attestation, waiver, approval, deployment authorisation or operating-effectiveness evidence.
