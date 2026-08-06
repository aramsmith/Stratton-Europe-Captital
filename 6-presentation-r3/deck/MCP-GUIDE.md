# MCP Authoring Guide

This deck is pre-configured for **MCP-powered component authoring** — the fastest way to
expand your presentation with new UI components using AI.

## What is MCP?

[Model Context Protocol (MCP)](https://modelcontextprotocol.io) lets AI assistants like GitHub Copilot
interact with external tools and registries. The **shadcn MCP server** gives Copilot direct
access to the shadcn/ui and ReactBits component registries, so you can add components by
describing what you need in plain language.

## Setup

**Already done.** This project ships with `.vscode/mcp.json` pre-configured:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"]
    }
  }
}
```

Open this project in VS Code or GitHub Codespaces and MCP is active immediately.

## Registry Architecture

This project uses **two component registries** that coexist in `components.json`:

| Registry | Prefix | What it provides |
|----------|--------|-----------------|
| **shadcn/ui** | *(none)* | UI primitives — Dialog, Tabs, Table, Input, Select, Accordion, etc. |
| **ReactBits** | `@react-bits/` | Animation & effect components — backgrounds, text effects, cards |

Both registries resolve components to `src/components/ui/` using the `@/` path alias.
They share infrastructure (`cn()` utility, Tailwind CSS, Radix primitives) and never conflict.

## Example Prompts — shadcn/ui Components

### Layout & structure
- *"Add the Dialog component from shadcn"*
- *"Add Sheet and Tabs from shadcn for a tabbed content slide"*
- *"Add Accordion from shadcn to build a collapsible FAQ section"*
- *"I need a data table — add the Table component from shadcn"*

### Form elements
- *"Add Input, Select, and Textarea from shadcn"*
- *"Add the Form component from shadcn for a contact slide"*
- *"Add Checkbox and Switch from shadcn"*

### Feedback & overlay
- *"Add Tooltip from shadcn for hover hints on my metrics"*
- *"Add Alert Dialog from shadcn for a confirmation overlay"*
- *"Add Toast from shadcn for notification examples"*
- *"Add Progress from shadcn for a loading bar demo"*

### Navigation & display
- *"Add Avatar from shadcn for team member photos"*
- *"Add Breadcrumb from shadcn for a navigation example"*
- *"Add Collapsible from shadcn for expandable sections"*

### Composite tasks
- *"What shadcn components would work best for a pricing comparison slide?"*
- *"Create a slide that uses Cards and Badges to compare three product tiers"*
- *"Build a team slide with Avatar, Card, and Badge components"*
- *"Add the components I need for an interactive demo slide with tabs and code blocks"*

## Example Prompts — ReactBits Components

### Backgrounds & effects
- *"Add Hyperspeed from React Bits for a dramatic section divider"*
- *"Show me all available backgrounds from React Bits"*
- *"Add Particles from React Bits for an ambient background effect"*

### Text animations
- *"Add LetterSwapForward from React Bits for an animated title"*
- *"Show me all text animations available in React Bits"*
- *"Add CountUp from React Bits for animated metric numbers"*

### Card & content effects
- *"Add TiltCard from React Bits for interactive team cards"*
- *"Add AnimatedContent from React Bits for scroll-triggered reveals"*
- *"Add a code block component from React Bits"*

## How Components Are Installed

When you ask Copilot to add a component (or run the CLI manually), this happens:

1. The shadcn CLI reads `components.json` for project configuration
2. It fetches the component source from the appropriate registry
3. The component file is written to `src/components/ui/`
4. Dependencies (if any) are added to `package.json` and installed

The component is now **yours** — it's a source file in your project, not an opaque dependency.
Modify it freely to match your presentation style.

## CLI Reference

The CLI equivalent of any MCP prompt:

```bash
# Add shadcn/ui components
npx shadcn@latest add dialog
npx shadcn@latest add sheet tooltip tabs
npx shadcn@latest add accordion table avatar

# Add ReactBits components
npx shadcn@latest add @react-bits/code-block
npx shadcn@latest add @react-bits/animated-content
npx shadcn@latest add @react-bits/hyperspeed

# List what's available
npx shadcn@latest add
```

## After Adding a Component

Import it in your slide:

```jsx
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
```

The `@/` alias resolves to `src/` — configured in `vite.config.js` and `jsconfig.json`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| MCP not responding in VS Code | Reload window (`Cmd+Shift+P` → "Reload Window") |
| Component not found | Check registry prefix: shadcn components have no prefix, ReactBits use `@react-bits/` |
| Import path error | All components go to `src/components/ui/` — use `@/components/ui/<name>` |
| Style conflicts | Components use the same Tailwind + CSS variable system — conflicts are rare; check for duplicate class names |
| Other editors | Run `npx shadcn@latest mcp init --client <your-client>` to configure for your editor |

## Preinstalled Components

These are already in your project — no need to add them:

**shadcn/ui:** Button, Card (7 sub-components), Badge, Separator, Alert
**ReactBits:** Aurora, BlurText, ShinyText, DecryptedText, SpotlightCard
**Wrappers:** MetricCard, SectionBadge, CalloutAlert (in `src/components/presentation/`)
