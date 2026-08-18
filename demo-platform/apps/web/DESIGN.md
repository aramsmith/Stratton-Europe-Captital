---
name: Stratton Europe Capital
description: A European investment committee ledger for governed evidence-to-decision work.
colors:
  institutional-navy: "#0b223b"
  institutional-navy-deep: "#081a2d"
  institutional-navy-hover: "#123452"
  rail-active: "#112f4d"
  antique-gold: "#9a7932"
  antique-gold-light: "#c7b27d"
  paper: "#ffffff"
  paper-warm: "#f7f6f2"
  paper-field: "#efeee9"
  paper-muted: "#f5f3ee"
  ink: "#17202b"
  slate: "#495463"
  rule: "#d3d0c7"
  success: "#17633a"
  success-tint: "#e8f3ec"
  danger: "#a12b2b"
  danger-tint: "#f8e9e8"
  warning: "#725610"
  warning-tint: "#f6f0dd"
  severe: "#8c4c18"
  severe-tint: "#f6eadf"
typography:
  display:
    fontFamily: '"Source Serif 4", Georgia, serif'
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.01em"
  headline:
    fontFamily: '"Source Serif 4", Georgia, serif'
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.333
    letterSpacing: "-0.015em"
  title:
    fontFamily: '"Source Serif 4", Georgia, serif'
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: '"Aptos", "Segoe UI", Calibri, Arial, sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.428
    letterSpacing: "normal"
  label:
    fontFamily: '"Aptos", "Segoe UI", Calibri, Arial, sans-serif'
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "0.08em"
  mono:
    fontFamily: 'Consolas, "Courier New", monospace'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.35
    letterSpacing: "0.04em"
rounded:
  precise: "2px"
  control: "4px"
  surface: "8px"
  large-surface: "10px"
  frame: "12px"
  round: "999px"
spacing:
  hairline: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  section: "48px"
  access-frame: "64px"
components:
  button-primary:
    backgroundColor: "{colors.institutional-navy}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.institutional-navy-hover}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.institutional-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
    height: "32px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
    height: "32px"
  status-badge:
    typography: "{typography.label}"
    rounded: "{rounded.precise}"
    padding: "2px 6px"
    height: "22px"
  surface-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "16px"
  navigation-current:
    backgroundColor: "{colors.rail-active}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "13px 14px"
    height: "62px"
  case-ledger:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "26px 28px"
---

# Design System: Stratton Europe Capital

## Overview

**Creative North Star: "European Investment Committee Ledger"**

The interface is a formal operating ledger rather than generic SaaS chrome. Deep navy architecture establishes institutional continuity; antique-gold rules mark authority sparingly; warm paper surfaces hold dense evidence, review, lineage, and assurance data with the calm precision of a committee book.

Brand expression remains concentrated in the supplied Stratton emblem and wordmark, the persistent rail, serif headings, and exact rules. The working field is deliberately restrained so decision-critical state, provenance, human authority, and fail-closed conditions remain immediately legible across desktop, tablet, and mobile layouts.

**Key Characteristics:**
- Deep navy institutional architecture with antique-gold authority marks.
- Warm paper surfaces separated by precise rules and low, structural shadows.
- Source Serif 4 headings paired with compact Aptos/Segoe UI operational text.
- A persistent desktop rail that becomes horizontal workflow navigation at tablet widths.
- A case ledger summary that preserves mandate and workflow context above every workspace.
- Restrained semantic status tints with explicit non-color labels.

**The Ledger, Not Dashboard Rule.** Compose screens as ordered records, evidence tables, review controls, and committee preparation—not decorative analytics.

## Colors

The palette is an institutional navy-and-paper system in which antique gold signifies authority and semantic color is reserved for operational state.

### Primary
- **Institutional Navy** (`#0b223b`): Primary actions, authority text, avatars, selection color, and the central brand anchor.
- **Cathedral Navy** (`#081a2d`): The persistent rail and secure-access brand field.
- **Navy Hover** (`#123452`): Interactive emphasis for primary controls.
- **Active Rail Navy** (`#112f4d`): Current-workspace navigation state.

### Secondary
- **Antique Gold** (`#9a7932`): Case-ledger top rules, state-card authority rules, and formal brand strokes.
- **Pale Antique Gold** (`#c7b27d`): Focus outlines and restrained rules on dark navy surfaces.

### Neutral
- **Clean Paper** (`#ffffff`): Primary cards, command bar, dialogs, and control surfaces.
- **Warm Paper** (`#f7f6f2`): Secondary surface and comparison-card background.
- **Ledger Field** (`#efeee9`): Application canvas behind the operating surfaces.
- **Muted Ledger Paper** (`#f5f3ee`): Case-summary metric field.
- **Ledger Ink** (`#17202b`): Primary body copy.
- **Slate Annotation** (`#495463`): Supporting copy and secondary metadata.
- **Precision Rule** (`#d3d0c7`): Structural borders, separators, and command-bar edge.

### Tertiary
- **Assured Green** (`#17633a`) on **Assured Tint** (`#e8f3ec`): Admitted, approved, current, successful, and verified states.
- **Exception Red** (`#a12b2b`) on **Exception Tint** (`#f8e9e8`): Blocked, denied, expired, failed, missing, rejected, and conflict states.
- **Review Amber** (`#725610`) on **Review Tint** (`#f6f0dd`): Pending, challenged, stale, and medium-severity states.
- **Committee Ochre** (`#8c4c18`) on **Committee Tint** (`#f6eadf`): Severe or committee-preparation emphasis.

**The Authority-Mark Rule.** Antique gold marks institutional authority and focus; it is never a broad decorative fill.

**The Status-Is-Evidence Rule.** Semantic colors always travel with an explicit text label, never as color-only meaning.

## Typography

**Display Font:** Source Serif 4 (with Georgia and serif fallbacks)

**Body Font:** Aptos (with Segoe UI, Calibri, Arial, and sans-serif fallbacks)

**Label/Mono Font:** Aptos for labels; Consolas for case identifiers

**Character:** Source Serif 4 gives mandate, workspace, and case headings measured editorial authority. Aptos/Segoe UI keeps evidence tables, controls, metadata, and status language compact, neutral, and highly scannable.

### Hierarchy
- **Display** (regular, `30px`, `1.15`): Secure-access brand statement only.
- **Headline** (semibold, `24px`, `1.333`): Workspace headings and the case-ledger title.
- **Title** (semibold, `20px`, `1.4`): Major card and workflow section headings.
- **Body** (regular, `14px`, `1.428`): Operational copy, table content, controls, and descriptions; explanatory text is generally constrained to `72–76ch`.
- **Label** (semibold, `11px`, `0.08em`, uppercase where structural): Rail sections, metric labels, and compact operational metadata.
- **Status Label** (bold, `10px`, `0.06em`, uppercase): Non-color state communication inside badges.
- **Monospace Identifier** (regular, `11px`, `0.04em`): Case and technical identifiers.

**The Serif-for-Authority Rule.** Use Source Serif 4 for headings that establish mandate, place, or decision context; keep controls and operational data in the body sans serif.

**The Compact-Data Rule.** Use small uppercase labels only for status, metric, and navigation metadata—not for paragraph copy.

## Layout

Desktop uses a two-column institutional shell: a persistent `276px` rail and a fluid workspace. The sticky command bar preserves mandate, account, and breadcrumb context, while the main field is centered at a maximum width of `1540px` with `32px` horizontal padding and a consistent `24px` section rhythm.

The case ledger precedes every workspace. Its identity area and four metric cells share one white surface with a `3px` gold authority rule. Workspace content uses dense responsive grids: primary operating splits collapse at `1050px`, the rail becomes a horizontal three-column workflow band at `900px`, and navigation stacks at `620px`. Main padding tightens below `700px`; responsive tables become labeled record cards at `620px`.

**The Persistent Context Rule.** The mandate, active workspace, case identity, and ledger summary remain visible before task-specific content.

**The Controlled Collapse Rule.** Tablet and mobile layouts preserve workflow order and labels; they change orientation rather than removing decision context.

## Elevation & Depth

Depth is structural and quiet. Warm tonal layering and one-pixel rules do most of the separation; shadows identify institutional frames, sticky context, and raised operating surfaces without creating floating-card spectacle.

### Shadow Vocabulary
- **Hairline Lift** (`0 1px 2px rgba(13, 31, 49, 0.08)`): Bordered workspace cards and restrained containers.
- **Operational Lift** (`0 2px 8px rgba(13, 31, 49, 0.08)`): Finding cards and interactive operating surfaces.
- **Ledger Lift** (`0 8px 24px rgba(13, 31, 49, 0.10)`): Case ledger and elevated shell moments.
- **Command-Bar Lift** (`0 2px 10px rgba(13, 31, 49, 0.05)`): Sticky workspace context.
- **Access Frame** (`0 24px 70px rgba(11, 34, 59, 0.16)`): Sign-in institutional frame only.

**The Structural-Depth Rule.** Use rules and tonal paper changes first; reserve shadows for hierarchy, stickiness, or explicit containment.

## Shapes

The form language is precise and lightly softened. Small controls and badges use `2–4px` corners, working cards use `8px`, and only the secure-access frame reaches `12px`. Circular geometry is reserved for the supplied emblem seal and account avatar. Borders remain thin and exact; the recurring gold top rule identifies authority-bearing containers.

**The Reserved-Curve Rule.** Rounded forms support touch and grouping but never make the ledger feel playful or pill-heavy.

## Components

### Buttons
- **Shape:** Compact rectangular controls with restrained `4px` corners and standard `8px 16px` padding.
- **Primary:** Institutional navy with white text; used for the single advancing action in a task group.
- **Hover / Focus:** Hover deepens the navy; keyboard focus uses a visible pale-gold outline with offset.
- **Secondary / Subtle:** White or transparent surfaces with navy or slate text for reversible, local, or quiet actions.
- **Disabled:** Preserve the label and reduce action authority without implying success.

### Inputs / Fields
- **Style:** White field surface, dark ledger text, `4px` corners, and a neutral precision stroke.
- **Focus:** A clear navy border shift and visible focus ring.
- **Error / Disabled:** Error copy uses exception red; disabled controls remain legible and visibly unavailable.

### Status Badges
- **Style:** Tinted semantic surface, matching dark foreground, `3px` visual corner, minimum `22px` height, and bold `10px` uppercase text.
- **State:** Success, danger, warning, severe, informative, important, brand, and subtle states remain restrained and always state their meaning in text.

### Cards / Containers
- **Corner Style:** White or warm-paper surfaces with `8px` corners where the component owns its silhouette.
- **Background:** Clean paper for primary work; warm paper for subordinate comparisons and annotations.
- **Shadow Strategy:** Hairline or operational lift only; bordered cards may remain nearly flat.
- **Border:** One-pixel warm gray rules; authority-bearing summary surfaces add a `3px` antique-gold top rule.
- **Internal Padding:** `16–24px`, with larger `26–28px` padding in the case ledger.

### Navigation
- **Style:** Deep navy institutional rail with compact sans-serif labels, muted summaries, and precise separators.
- **Default / Hover / Active:** Default links are cool gray; hover moves to brighter text on navy; active links use Active Rail Navy, a subtle border, and an inset `3px` antique-gold rule.
- **Mobile Treatment:** At tablet widths the rail becomes a horizontal three-column workflow band; below `620px` it stacks vertically and hides summaries, not labels.

### Case Ledger Summary

The signature case ledger is the first operating surface in every workspace. It pairs a serif case identity and explicit workflow badge with four compact metric cells. Its gold top rule, warm metric field, exact dividers, and responsive one-column collapse make it the visual and informational anchor of the built world.

## Do's and Don'ts

### Do:
- **Do** keep the deep navy rail, command context, and case ledger as the persistent institutional frame.
- **Do** use antique gold only for authority rules, focus, and restrained brand strokes.
- **Do** set mandate, workspace, case, and major section headings in Source Serif 4.
- **Do** keep operational data compact, ordered, and separated by exact rules.
- **Do** preserve explicit text labels for every semantic status.
- **Do** retain the supplied Stratton emblem and wordmark as the canonical brand assets.

### Don't:
- **Don't** replace the ledger hierarchy with generic dashboard tiles, decorative charts, or consumer SaaS chrome.
- **Don't** use gold as a large background, gradient, or decorative accent field.
- **Don't** make semantic status color louder than the evidence or decision content it qualifies.
- **Don't** introduce oversized type, excessive whitespace, or rounded pill surfaces that reduce operational density.
- **Don't** hide mandate, case, workflow, provenance, or human-authority context during responsive collapse.
- **Don't** imply automated investment approval; committee submission remains visibly human-only and unavailable.
