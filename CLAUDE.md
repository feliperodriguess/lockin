# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**lockin** — an unofficial Electron companion for the League of Legends client. It reads the local League Client (LCU) API and surfaces matchup-aware help during champion select: spell recommendations, personal matchup notes, ban suggestions, ready-check auto-accept, and team rank diffs. No backend, no login — all user data is local; static data comes from Riot's Data Dragon CDN.

- **`PRD.md`** is the source of truth for behavior, data models, IPC contract, and architecture. Read the relevant section before implementing a feature.
- **Visuals:** the `lockin-design-handoff/` prototype was consumed during Phase 1 and removed. The implemented `src/renderer/` is now the source of truth for the look — theme tokens live in `src/renderer/src/global.css`; match the existing screens/components when extending the UI.

## Commands

Package manager is **pnpm**.

```sh
pnpm dev          # run the app (electron-vite dev, renderer HMR)
pnpm typecheck    # tsc --noEmit
pnpm format       # biome check --write --unsafe . (lint + format + organize imports)
pnpm build        # typecheck + electron-vite build
pnpm build:mac    # package macOS .dmg via electron-builder
```

**Always run `pnpm typecheck` and `pnpm format` after making changes.**

Use the Playwright MCP to debug the UI and verify screens/states look and behave as expected.

## Git commits

- Make **granular commits** — one logical change per commit.
- Concise, well-written messages.
- **Do not** add the `Co-Authored-By: Claude` trailer.

## Architecture

Electron three-process split (electron-vite, configured in `electron.vite.config.ts`):

- **`src/main/`** — Node side. *All* LCU access (`league-connect`), Data Dragon fetching, and persistence (`electron-store`) live here. IPC handlers in `ipc.ts`, persistence in `store.ts`, tray in `tray.ts`.
- **`src/preload/`** — typed `contextBridge` exposing `window.api`. The renderer never imports Node APIs or talks to the LCU/network directly.
- **`src/renderer/`** — pure React 19 UI. Pages in `src/pages/`, routes in `src/routes.tsx` (TanStack Router, memory history: `/`, `/notes`, `/settings`; the live view swaps by gameflow phase).
- **`src/shared/`** — IPC channel names (`constants.ts`) and types shared across processes.

State ownership (PRD §3.1/§8.1 — keep these separate, never mirror data between them):
- **TanStack Query** wraps request/response IPC (`invoke`) — notes, settings, Data Dragon bundle, ranks. Invalidate query keys after mutations.
- **`LcuProvider`** (plain React context, `src/renderer/src/providers/lcu-provider.tsx`) holds the live LCU push state (`lcu:status`, `lcu:phase`, `lcu:readyCheck`, `lcu:champSelect`) — it subscribes once and exposes two churn-split contexts; never poll for these, and don't add Zustand unless re-render pressure demands it.
- Plain `useState` for small local UI state.

Build strategy is **UI-first** (PRD §15): screens consume data through hooks (e.g. `useChampSelect()`, `useNotes()`) that return mock fixtures first and are repointed at real IPC later — keep components agnostic to the data source.

Path aliases (tsconfig + vite): `@renderer/*` → `src/renderer/src/*`, `@/*` → `src/*`, `~/*` → repo root.

## UI conventions

- **Components max ~300 lines.** If a UI component grows past that, break it into smaller components.
- **No inline `style` objects for static values.** Style with Tailwind utility classes only (arbitrary values like `text-[13px]`/`tracking-[0.06em]` where exact values matter); conditional styling via `cn()` (clsx + tailwind-merge). A `style` prop is acceptable only for values computed at runtime from props/data (SVG dash offsets, data-driven colors, dynamic sizes).
- **Use semantic HTML** — prefer `nav`, `main`, `section`, `header`, `button`, `ul`, `time`, `p`, `fieldset`/`legend`, etc. over div/span soup. When a richer accessible tag fits naturally, use it.
- **Text inputs build on `ui/input.tsx`/`ui/textarea.tsx`** (shadcn-based) — don't hand-roll one-off inputs per screen.
- **shadcn/ui** primitives live in `src/renderer/src/components/ui/` (style `base-vega`, lucide icons — see `components.json`). Some are already scaffolded; when you need another, pull it from shadcn (`pnpm dlx shadcn@latest add <component>`) and customize it to match the existing design system.
- Tailwind v4 (CSS-first config in `src/renderer/src/global.css`, `@tailwindcss/vite` plugin). Theme tokens are defined in `global.css` (ported from the original handoff during Phase 1).
- Biome formats with tabs, 100-char lines, no semicolons (`asNeeded`) — let `pnpm format` handle style.

## Compliance constraints (PRD §14)

- Touch the **LCU (client) API only** — never the game process or game memory.
- The only automated write is accepting the ready check, **off by default**. No auto-pick/ban/dodge.
- Ship as unofficial: no Riot logos, wordmarks, or "League of Legends" in the app identity.
