# Stratton AFF-B review — Phase 6 — C-level Presentation round 1

**Verdict:** DIVERGES  
**Review time:** 2026-08-03T11:22:00.635440+02:00  
**Reviewer runtime:** `gpt-5.6-sol` — separate AFF-B specialist context/write boundary from AFF-6; same model ID, no model-ID independence claim  
**Subject:** `a9116def3c48fa1c2769d7635178201bdfab35fba5ac92fcf93e5d13d15c8b5f` — 88/88 hashes matched pre/post  
**Final round for manifest:** false

## Summary

The exact revision-2 subject is integrity-valid and accurately preserves claim caveats, financial boundaries, three authority conflicts, fourteen owner-bound controls, two retained minor gaps and the no-deployment/no-certification boundary. One unresolved **MAJOR** browser portability/privacy defect and one **MINOR** local-system metadata disclosure require a new sibling candidate and full re-review.

## Finding summary

| BLOCKER | MAJOR | MINOR |
|---:|---:|---:|
| 0 | 1 | 1 |

### `AFFB-P6-R1-MAJ-001` — Browser package makes an undeclared external Google Fonts request

`deck/dist/assets/index-CKTjebYj.css:1` imports Google Fonts over HTTPS. The current portability evidence checks index-local references and failed requests, but does not enumerate successful external CSS/font requests. Opening the deck can disclose viewer network metadata and the package is not wholly local/offline.

**Owner:** AFF-6, Presentation Engineering.  
**Required remediation:** remove or explicitly govern the remote dependency, use approved local/system or bundled assets, add recursive CSS and complete network-request evidence, then create a new manifest and obtain fresh AFF-A/AFF-B reviews.

### `AFFB-P6-R1-MIN-001` — Export evidence and PDF metadata disclose local-system details

The manifest-bound export log contains a full Windows user/workspace path and is linked from the generated HTML. PDF creator metadata identifies the authoring OS and HeadlessChrome version. No secret, credential or customer logo was found.

**Owner:** AFF-6.  
**Required remediation:** retain case-relative paths only, sanitise unnecessary PDF metadata and add absolute-path/document-metadata scans in the replacement candidate.

## Confirmed coverage

- Manifest and snapshot: `a9116def3c48fa1c2769d7635178201bdfab35fba5ac92fcf93e5d13d15c8b5f`; 88/88 artifacts matched.
- Final AFF-A round 2: `a05394a1edd0362ba4d4523c4ecf2e04830a93c908629be95ca183cb730c1dc4` — CONFORMS on the same exact subject.
- Claims: 32; sources: 66; missing sources: 0.
- No customer/case identity or governed source catalogue in browser source/production JavaScript; no secrets, source maps, source code/IaC or unsafe SVG constructs found.
- No fabricated ROI, Azure price, rate, cost total or realised benefit.
- Three authority conflicts, fourteen owner controls and two retained AFF-B minor gaps remain open, unwaived and fail closed.
- DECKIO favicon/export mechanics are engine mechanics, not presentation claims; no legal licensing conclusion is made.
- No deck/package/Azure execution, rebuild, export or repair was performed.

## Coverage and gate

Coverage 010: `f141e2cbe2d8bad4a46ea28a71a62f3538547147c665f29eb7d3a55dabed4382` — `ACTIVE_PHASE6_REVISION2_AFF_B_ROUND1_DIVERGES_REMEDIATION_REQUIRED`. It preserves coverage 009 `5c25df3283233120e814629dafd742c302ed5d44424bb75e7193c4ef0456e0ad` and all existing confirmed/inferred applicability and residual statuses. Presentation evidence does not establish runtime operating effectiveness.

The human gate **may not be presented** while the MAJOR remains unresolved. AFF-B provides no approval, waiver, certification, legal advice, attestation, Azure authorisation, deployment authorisation or runtime conclusion.

**Review JSON:** `5db090b60e348014ed8365399a106587fd68d26f80c04a25240a13e46877d27d`
