# Built with [DECKIO](https://deckio.art)

## Design System — shadcn/ui

This deck ships with **[shadcn/ui](https://ui.shadcn.com) components**. The source files live in your project and you own them completely. Modify, extend, or replace
any component to match your presentation's needs.

### Preinstalled components

| Component | Path | What it does |
|-----------|------|-------------|
| **Button** | `src/components/ui/button.jsx` | Variant-driven button (default, destructive, outline, secondary, ghost, link) |
| **Card** | `src/components/ui/card.jsx` | Flexible container (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter) |
| **Badge** | `src/components/ui/badge.jsx` | Inline status / label badge with variants |
| **Separator** | `src/components/ui/separator.jsx` | Horizontal / vertical divider (Radix primitive) |
| **Alert** | `src/components/ui/alert.jsx` | Contextual alert with icon support (default, destructive) |

Plus **ReactBits** animation primitives: Aurora, BlurText, ShinyText, SpotlightCard, DecryptedText.

### Project structure

```
src/
├── components/
│   ├── ui/              ← shadcn/ui + ReactBits components (yours to own)
│   └── presentation/    ← deck-specific wrappers (MetricCard, SectionBadge, etc.)
├── slides/              ← one file per slide
├── lib/
│   └── utils.js         ← cn() helper for class merging
└── App.jsx
deck.config.js           ← slide order, theme, metadata
components.json           ← shadcn CLI + ReactBits registry configuration
jsconfig.json             ← @/ path alias
.vscode/mcp.json          ← shadcn MCP server (pre-configured)
```

## 🤖 Expanding Your Deck with AI (MCP)

This project is pre-configured for **MCP-powered component authoring** — the recommended way
to add new components to your deck. The shadcn MCP server is already wired into
`.vscode/mcp.json`. Just open this project in VS Code or GitHub Codespaces and start prompting.

### Adding shadcn/ui components

Ask Copilot to pull components from the official shadcn/ui registry:

| What you want | Example prompt |
|---------------|---------------|
| Add a single component | *"Add the Dialog component from shadcn"* |
| Add multiple at once | *"Add Sheet, Tooltip, and Tabs from shadcn"* |
| Explore what's available | *"What shadcn components would work for a pricing comparison slide?"* |
| Build with a component | *"Create a slide that uses the Accordion component to show FAQ items"* |
| Add form elements | *"Add Input, Select, and Textarea from shadcn for a feedback form slide"* |
| Add data display | *"Add the Table component from shadcn for a metrics comparison"* |

### Adding ReactBits components

The ReactBits registry is configured in `components.json` alongside shadcn. Ask for animations:

| What you want | Example prompt |
|---------------|---------------|
| Animated backgrounds | *"Add Hyperspeed from React Bits for a dramatic intro slide"* |
| Text effects | *"Show me all available text animations from React Bits"* |
| Card effects | *"Add a TiltCard from React Bits for interactive team member cards"* |
| Content transitions | *"Add AnimatedContent from React Bits for reveal-on-scroll sections"* |

### How the two registries coexist

Both registries are declared in `components.json`. The shadcn CLI resolves them by prefix:

- **No prefix** → shadcn/ui registry (e.g., `npx shadcn@latest add dialog`)
- **`@react-bits/` prefix** → ReactBits registry (e.g., `npx shadcn@latest add @react-bits/code-block`)

They share the same output directory (`src/components/ui/`) and the same `@/` alias.
No configuration conflicts — they were designed to work together.

### CLI fallback

If you prefer the terminal over AI prompts, the CLI works identically:

```bash
# shadcn/ui components
npx shadcn@latest add dialog
npx shadcn@latest add sheet tooltip tabs

# ReactBits components
npx shadcn@latest add @react-bits/code-block
npx shadcn@latest add @react-bits/animated-content
```

New components land in `src/components/ui/`. Import them in your slides:

```jsx
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
```

The `@/` alias maps to `src/` — configured in `vite.config.js` and `jsconfig.json`.

### Other editors

The MCP server is pre-configured for VS Code. For other editors:

```bash
npx shadcn@latest mcp init --client <your-client>
```

See `MCP-GUIDE.md` for the full MCP authoring reference.


## How to edit this deck?

For a smooth ride, use `Dev Containers` locally or use `GitHub Codespaces`. That saves you from installing dependencies yourself. Once the container is up and running, the presentation starts in a simple browser session shared with GitHub Copilot and you can start editing.

If you want to run it directly on your machine:

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

Typical flow after GitHub Copilot is ready and the presentation is visible in Simple Browser:

1. Ask GitHub Copilot to make the change you want.
2. Let GitHub Copilot update the deck files for you.
3. Review what changed.
4. Look at the presentation and see the result immediately in real time, thanks to hot reload.
5. If something feels off, ask GitHub Copilot to refine it and repeat.

## GitHub Copilot in VS Code

Do not make deck changes by editing code directly unless you really need to. This project is set up so GitHub Copilot in VS Code can do most of the work for you.

Use GitHub Copilot Chat in Agent mode and describe the change you want. You can choose the model you like, but we recommend frontier models, `Claude Opus 4.6` or `GPT-5.3+`, for the best experience.

The optimal flow is achieved with `Claude Opus 4.6` in fast mode.

## What Copilot already knows

This repo includes custom instructions and skills. Copilot already knows what files it should touch and what files it should leave alone.

Useful skills:

- `deck-add-slide` for creating a new slide and wiring it into `deck.config.js`
- `deck-delete-slide` for removing a slide cleanly
- `deck-inspect` for visually checking a rendered slide
- `deck-port-powerpoint` for rebuilding a PowerPoint or PDF deck as native DECKIO slides
- `deck-validate-project` for auditing the whole deck for consistency
- `deck-sketch` for turning a rough whiteboard idea into a real slide

## Prompt examples

Use prompts like these instead of editing files yourself:

- `Add a slide that explains the rollout phases for strategic customers.`
- `Make this slide easier to scan and easier to present.`
- `Remove the speaker invite slide.`
- `Review this deck and fix anything that looks inconsistent or broken.`
- `Create a customer case study slide that fits the style of the rest of the presentation.`
- `Create a new slide based on my sketch.`
- `Inspect the current progress, tell me what looks off, and make visual improvements.`

## GitHub Copilot CLI

Open GitHub Copilot CLI in this repo:

Do you prefer TUIs? This works with GitHub Copilot CLI too.

```bash
gh copilot --yolo
```
