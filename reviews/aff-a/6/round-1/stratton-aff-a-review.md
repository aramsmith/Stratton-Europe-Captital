# Stratton AFF-A review — Phase 6 — C-level Presentation round 1

**Verdict:** DIVERGES  
**Review time:** 2026-08-03T10:37:42.957+02:00  
**Reviewer runtime:** gpt-5.5; Phase 6 author runtime: gpt-5.6-sol  
**Independence:** VERIFIED_DIFFERENT_ACTUAL_MODEL_IDS  
**Subject modification performed:** false  
**Final round for manifest:** true, but the manifest is not gate-opening because it diverges

## Summary
The subject is hash-integrity valid and largely evidence-disciplined, but the canonical browser deck export is not portable/self-contained because its production index uses root-absolute asset paths. That unresolved MAJOR finding is material to the Phase 6 presentation package and requires DIVERGES. Two MINOR findings also require cleanup in the next candidate.

## Independent verification
- Manifest: `cases/Stratton-Europe-Captital/6-presentation/stratton-phase-6-hashes.json`
- Expected SHA-256: `b714ba7860570b4cc166dc6741a0f1ef3825a679b3790c6337dae7e05f748951` — MATCH.
- Pre-review SHA-256: `b714ba7860570b4cc166dc6741a0f1ef3825a679b3790c6337dae7e05f748951`.
- Post-review SHA-256: `b714ba7860570b4cc166dc6741a0f1ef3825a679b3790c6337dae7e05f748951` — UNCHANGED.
- Artifact count: 83; recomputed file hashes: 83/83 matched.
- Manifest integrity: duplicate paths 0; ordinal sorted true; roles present; UTF-8 BOM absent; no trailing newline.
- Reviewed-subject snapshot: `reviews/aff-a/6/round-1/reviewed-subject/stratton-phase-6-hashes.json` / `b714ba7860570b4cc166dc6741a0f1ef3825a679b3790c6337dae7e05f748951`; byte-identical true.
- Hash receipt: `reviews/aff-a/6/round-1/reviewed-subject/stratton-phase-6-hash-verification-receipt.json` / `5cdce6cc515ee35b74a6dcad0b106223bdaf47081dadfe2dfe1ba9d25ee77118`.
- Model receipt: `reviews/aff-a/6/round-1/stratton-aff-a-model-receipt.json` / `2b34070231a5df9152e8d5e9a445da54352691976e0674a07d04509a7149c5eb`.
- Boundary: AFF-A did not rebuild, export, repair, deploy, test Azure, invoke AFF-B, approve, waive or modify the subject.

## Findings
| ID | Severity | Title | Status |
| --- | --- | --- | --- |
| AFFA-P6-R1-MAJ-001 | MAJOR | Browser deck export is not portable from a nested path or file open because dist/index.html uses root-absolute asset URLs | OPEN |
| AFFA-P6-R1-MIN-001 | MINOR | Slide S01 subtitle weakens the approved endorse/approve distinction | OPEN |
| AFFA-P6-R1-MIN-002 | MINOR | PDF export log names a non-manifest, non-existent PDF path while the manifest binds deck/deck.pdf | OPEN |

### AFFA-P6-R1-MAJ-001 — MAJOR — Browser deck export is not portable from a nested path or file open because dist/index.html uses root-absolute asset URLs

**Owner:** AFF-6  
**Status:** OPEN

**Evidence**
- 6-presentation/deck/dist/index.html contains href="/deckio.png", src="/assets/index-CTXLykoI.js", href="/assets/rolldown-runtime-BHe-jwch.js" and href="/assets/index-CKTjebYj.css".
- The referenced files exist under 6-presentation/deck/dist/deckio.png and 6-presentation/deck/dist/assets/*, but root-absolute URLs resolve to the web-server or file-system root rather than the deck/dist folder.
- Model-plan revision 16 requires a self-contained browser build, and stratton-presentation.md links the browser output as deck/dist/index.html.

**Impact:** The governed browser artifact is represented as preserved and self-contained, but it can fail when opened via the linked nested path, copied as a folder, or opened from file:// without a root-mounted server. That is material for a C-level presentation package and invalidates the self-contained/browser-portability claim.

**Remediation:** Create a new sibling Phase 6 candidate with relative asset URLs (for example Vite base "./" or equivalent), regenerate the browser build/PDF/evidence/manifest, and run a full new AFF-A/AFF-B review on the new manifest.

### AFFA-P6-R1-MIN-001 — MINOR — Slide S01 subtitle weakens the approved endorse/approve distinction

**Owner:** AFF-6  
**Status:** OPEN

**Evidence**
- 6-presentation/deck/src/slides/DecisionSummarySlide.jsx renders S01 subtitle text: "Approve the evidence-backed architecture and coding baseline as the controlled reference, with a gated roadmap for owner evidence and future validation."
- Model-plan revision 16 presentationSetup.decisionGoal is ENDORSE_APPROVED_BASELINE_AND_CONTROLLED_NEXT_STEP_ROADMAP.
- The same slide title and alert correctly say "Endorse the baseline — not deployment" and "Endorse the approved baseline and controlled next-step roadmap. Do not authorise Azure activity."

**Impact:** The deck mostly preserves the boundary, but the subtitle can invite a board-level approval interpretation where the governed request is endorsement and Phase 6 approval remains a separate human gate.

**Remediation:** In the next candidate, replace the S01 subtitle verb with endorse/accept-as-reference language and keep approval reserved for formal AFF human-gate records.

### AFFA-P6-R1-MIN-002 — MINOR — PDF export log names a non-manifest, non-existent PDF path while the manifest binds deck/deck.pdf

**Owner:** AFF-6  
**Status:** OPEN

**Evidence**
- 6-presentation/evidence/pdf-export.log records: PDF saved to ...\6-presentation\deck\architecture-decision-executive-brief-slides.pdf.
- That logged file is absent from the candidate and absent from the canonical manifest.
- The manifest instead binds 6-presentation/deck/deck.pdf with SHA-256 923eaa0938f4300dd23bc55b84c5634f78a5bc34860daf78afe9ee8e85c1a837; AFF-A verified that deck/deck.pdf is a valid PDF header/EOF file with 10 /Page entries.

**Impact:** The reviewed PDF itself is valid, but the retained export evidence is inconsistent with the canonical PDF path and weakens artifact/evidence traceability.

**Remediation:** Regenerate or correct export evidence in a new candidate so the log and validation receipt bind the exact canonical PDF path and hash.

## Review area results
| Area | Status | Evidence |
| --- | --- | --- |
| Canonical subject integrity | CONFORMS | Manifest hash matched expected pre/post; 83/83 listed artifact hashes matched; duplicate path count 0; roles present; ordinal path order verified by byte/Unicode sorting; snapshot byte-identical. |
| Model independence | CONFORMS | AFF-A approved/selected/actual gpt-5.5 differs from Phase 6 author actual gpt-5.6-sol recorded in model-plan revision 16. |
| Evidence boundary | CONFORMS | Presentation uses approved evidence through Phase 5 and repeatedly discloses no Azure target validation, what-if, deployment, runtime testing or operating-effectiveness evidence. |
| Claims and sources | CONFORMS | 32 claims and 66 source references verified structurally; all source paths exist; classifications match the model-plan claim classes. |
| Narrative correctness and audience fit | CONFORMS-WITH-GAPS | Executive story is concise and board-facing, but S01 subtitle uses approve language inconsistent with the governed endorsement request. |
| High-risk metrics and residual disclosures | CONFORMS | No ROI, price, cost total or realised benefit is presented; the three authority conflicts, fourteen owner-bound controls and two retained AFF-B minor gaps are disclosed as open, unwaived and fail closed. |
| Deck anonymity and source/IaC boundary | CONFORMS | Deck source and dist scan found no case/repository/review/approval path strings; source code/IaC is linked only through governed evidence and not embedded in the executive deck. |
| Browser portability and self-containment | DIVERGES | deck/dist/index.html uses root-absolute /deckio.png and /assets/* URLs, so the linked nested/file browser artifact is not portable as represented. |
| PDF validity and export evidence | CONFORMS-WITH-GAPS | deck/deck.pdf is valid and 10 pages, but pdf-export.log records a non-existent non-manifest PDF path. |
| Visual/readability | CONFORMS | Visual measurements report 10/10 slides found with no viewport overflow at 1280x720; slide density is appropriate for an executive deck. |
| Reviewer boundary | CONFORMS | AFF-A wrote only beneath reviews/aff-a/6/round-1 and did not rebuild, export, repair, deploy, test Azure, invoke AFF-B, waive, approve or modify the subject. |


## Confirmed items
- Canonical Phase 6 manifest SHA-256 matched the expected b714ba7860570b4cc166dc6741a0f1ef3825a679b3790c6337dae7e05f748951 before and after review.
- All 83 listed artifacts existed and recomputed SHA-256 values matched; no subject file was modified by AFF-A.
- Reviewed-subject manifest snapshot is byte-identical to the subject manifest.
- Model separation is verified: AFF-A actual gpt-5.5 differs from Phase 6 author actual gpt-5.6-sol.
- Claim catalogue contains 32 claims, 66 source references, and all referenced source paths exist inside the case boundary.
- Ten slides are registered in deck.config.js and mapped to S01-S10 claim IDs.
- Authoritative Markdown and rendered HTML disclose no deployment approval, no Azure sign-in/what-if/deployment/runtime test, no legal certification, and no approved numeric business case.
- Deck source and production bundle scans found no case name, repository path, review path or approval path strings in the deck surface.
- The canonical PDF deck/deck.pdf is structurally valid as a PDF with 10 page objects and the manifest-bound hash.
- Visual measurement evidence reports all 10 slides at 1280x720 with no DOM overflow.
- No Azure command, deployment, what-if, runtime test, rebuild, repair or export was executed by AFF-A.

## Residual gaps
- AFFA-P6-R1-MAJ-001 remains open and blocks this manifest.
- AFFA-P6-R1-MIN-001 remains open.
- AFFA-P6-R1-MIN-002 remains open.
- Approved upstream residuals remain open and unwaived: three authority conflicts, fourteen owner-bound controls and two retained AFF-B minor gaps.

## Required action
Do not send this manifest to AFF-B or the human gate as final. Because the subject diverges, AFF-6 must create a new sibling Phase 6 candidate, regenerate affected artifacts and a new canonical manifest, preserve this reviewed subject byte-identically, and obtain full new AFF-A and AFF-B reviews on the new manifest before any human Phase 6 decision.

## Non-approval statement
AFF-A does not approve Phase 6, waive any residual gap, certify compliance, authorise Azure activity, authorise deployment or runtime testing, invoke AFF-B, or provide human approval.
