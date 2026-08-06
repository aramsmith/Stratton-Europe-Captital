---
description: "Use when a slide reveals content step by step (click / arrow to advance) — a.k.a. progressive disclosure or build animations. Explains the one export-safe way to do it with the useDisclosure hook, and the anti-pattern that breaks PPTX/PDF export."
applyTo: "**/slides/**/*.jsx"
---

# Progressive Disclosure — Step-by-Step Reveals

Some slides reveal their content in stages: the presenter presses → / Space to
unveil the next bullet, column, or phase. This is "progressive disclosure" (also
called build steps or click-to-reveal).

There is exactly **one** blessed way to build it: the engine's `useDisclosure`
hook. It keeps the tricky parts (key handling, navigation hand-off, reset on
exit) in the engine **and** guarantees the slide exports correctly.

## The rule

- ✅ **Always** drive reveals with `useDisclosure(total, { index })`.
- ❌ **Never** hand-roll step state with your own `useState` + a `keydown`
  listener. It will export **blank** — the PPTX/PDF capture grabs the slide at
  step 0 (nothing revealed) because a hand-rolled handler has no idea an export
  is running.

`useDisclosure` solves the export problem automatically: while a capture is in
flight it reports the **fully-revealed** state and detaches its key listener, so
the exported still always shows the slide's final state. No per-deck wiring.

## API

```js
import { useDisclosure } from '@deckio/deck-engine'

const {
  step,        // current step (0..total). During export this is `total`.
  total,       // number of reveal steps
  isRevealed,  // (i) => boolean — true when item i should be shown
  atStart, atEnd,
  next, prev, setStep,
} = useDisclosure(total, { index })   // `index` = this slide's index prop
```

- `index` ties the hook to this slide: it only listens for keys while the slide
  is active, and resets to the start when the slide is left. Always pass it.
- Forward keys (→ / Space / PageDown / Enter) advance; ← / PageUp step back.
  Once every step is revealed, the next → bubbles up and navigates to the next
  slide — disclosure and navigation compose cleanly. You do not wire any of this.

## Pattern A — reveal a list one item at a time

```jsx
const { step, isRevealed } = useDisclosure(items.length, { index })

items.map((item, i) => (
  <div className={`reveal-row ${isRevealed(i) ? 'is-in' : 'is-out'}`}>
    {item.label}
  </div>
))
```

Pair it with CSS that animates the `out → in` transition (opacity / transform).
Keep the hidden state **dimmed**, not `display:none`, so layout is stable:

```css
.reveal-row { opacity: 1; transition: opacity 300ms ease, transform 300ms ease; }
.reveal-row.is-out { opacity: 0.15; transform: translateY(6px); }
.reveal-row.is-in  { opacity: 1; transform: none; }
```

## Pattern B — threshold / staged layout

When the slide changes between a few discrete states (not a 1:1 item list),
read `step` directly:

```jsx
const { step } = useDisclosure(3, { index })  // 3 reveal stages

<section data-stage={step}>
  <Col className={step >= 1 ? 'on' : 'off'} />
  <Col className={step >= 2 ? 'on' : 'off'} />
  <Col className={step >= 3 ? 'on' : 'off'} />
</section>
```

## Reference implementation

`GenericStepsSlide` (engine) is the canonical example — it reveals a timeline of
steps with `useDisclosure(steps.length, { index })` and gates each row on
`i < step`. Mirror its structure for new disclosure slides.

## Export checklist

- [ ] Reveal state comes from `useDisclosure`, not local `useState`.
- [ ] Hidden items are dimmed (opacity/transform), not removed from layout.
- [ ] No custom `document.addEventListener('keydown', …)` for stepping.
- [ ] Verified the exported slide shows the fully-revealed state.
