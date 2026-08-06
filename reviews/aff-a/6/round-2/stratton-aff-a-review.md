# AFF-A formal review — Phase 6 round 2

**Verdict:** CONFORMS  
**Subject:** cases/Stratton-Europe-Captital/6-presentation-r2/stratton-phase-6-hashes.json  
**Manifest SHA-256:** 9116def3c48fa1c2769d7635178201bdfab35fba5ac92fcf93e5d13d15c8b5f  
**Artifact count:** 88  
**Model separation:** AFF-A gpt-5.5; Phase 6 author gpt-5.6-sol — verified different.  
**Reviewed at:** 2026-08-03T11:08:48.4701246+02:00

## Rationale

The revision-2 subject is hash-integrity valid, evidence-bounded and complete. All 88 artifacts exist and match the manifest. The revision-1 subject and round-1 AFF-A record remain byte-identical to the expected hashes. No BLOCKER, MAJOR or MINOR finding remains.

## Prior finding dispositions

| Finding | Prior severity | Round-2 disposition |
|---|---:|---|
| AFFA-P6-R1-MAJ-001 | MAJOR | Resolved: deck/dist/index.html uses relative ./... references only; targets exist and hash-match; retained build command is 
pm run build -- --base=./; nested browser inspection is credible and portable. |
| AFFA-P6-R1-MIN-001 | MINOR | Resolved: S01 consistently asks for endorsement/controlled-reference acceptance and explicitly excludes deployment approval. |
| AFFA-P6-R1-MIN-002 | MINOR | Resolved: export log and receipt bind the exporter intermediate filename, canonicalisation to deck/deck.pdf, final hash/bytes/pages and intermediate absence. |

## Finding summary

- BLOCKER: 0
- MAJOR: 0
- MINOR: 0

## Confirmed items

- Manifest matched before and after review; 88/88 artifact hashes matched.
- Manifest has no UTF-8 BOM or trailing newline; paths are safe, duplicate-free and ordinal sorted.
- Claim catalogue has 32 claims and 66 source references with no missing source path.
- Ten slides, speaker notes, Markdown, HTML, browser output and PDF are consistent.
- No invented ROI, prices, legal certification, deployment, runtime or operating-effectiveness claim was found.
- Visual evidence reports 10 slides at 1280×720 without overflow; independent browser/PDF inspection corroborated the retained evidence.

## Residual gaps

Upstream residuals remain disclosed and unwaived: three authority conflicts, fourteen owner-bound controls and two retained AFF-B minor gaps. AFF-B round 1 and human Phase 6 approval have not occurred.

## Required action

AFF-B round 1 may proceed only against this exact unchanged manifest. Any later material change requires a new sibling candidate, new manifest and full re-review. AFF-A provides no approval, waiver, certification or Azure authorisation.