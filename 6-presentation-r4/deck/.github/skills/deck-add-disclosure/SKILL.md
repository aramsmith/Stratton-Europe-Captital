---
name: deck-add-disclosure
description: Guide for adding progressive disclosure (step-by-step / click-to-reveal builds) to a slide. Use this when asked to make a slide reveal content one step at a time, add build steps, or fix a disclosure slide that exports blank.
---

# Adding Progressive Disclosure to a Slide

Use this when a slide should reveal content in stages as the presenter advances
(→ / Space), or when an existing "click to reveal" slide exports blank.

## Step 0 — Read the contract

Read `.github/instructions/progressive-disclosure.instructions.md` first. It is
the source of truth. The short version: drive every reveal with the engine's
`useDisclosure` hook, and **never** hand-roll step state with your own
`useState` + `keydown` listener — that exports blank.

## Step 1 — Import the hook

```js
import { useDisclosure } from '@deckio/deck-engine'
```

## Step 2 — Wire the step machine

Call it once near the top of the slide component, passing the number of reveal
steps and the slide's own `index`:

```jsx
export default function MySlide({ index = 0, items = SAMPLE_ITEMS }) {
  const { step, isRevealed } = useDisclosure(items.length, { index })
  // ...
}
```

- For a 1:1 list reveal, gate each item on `isRevealed(i)`.
- For a few discrete stages, read `step` directly (`step >= 2`).

## Step 3 — Gate the markup + add reveal CSS

Toggle a class per item; keep the hidden state **dimmed**, not `display:none`,
so the layout doesn't jump:

```jsx
{items.map((item, i) => (
  <li className={`reveal-row ${isRevealed(i) ? 'is-in' : 'is-out'}`}>{item.label}</li>
))}
```

```css
.reveal-row { transition: opacity 300ms ease, transform 300ms ease; }
.reveal-row.is-out { opacity: 0.15; transform: translateY(6px); }
.reveal-row.is-in  { opacity: 1; transform: none; }
```

If the slide also uses `<EditableList>`, reset the step on reorder with
`onReorder={() => setStep(0)}` (see `GenericStepsSlide` for the full pattern).

## Step 4 — Verify it exports

Disclosure must survive PPTX/PDF export. Because `useDisclosure` auto-reveals
during capture, a correctly wired slide exports in its **fully-revealed** state.
Sanity-check:

- No `document.addEventListener('keydown', …)` anywhere in the slide.
- No local `useState` tracking the step.
- Reveal state flows from `useDisclosure` only.

## Reference

`GenericStepsSlide` in the engine is the canonical disclosure slide — copy its
structure (`useDisclosure(steps.length, { index })` + `i < step` gating).
