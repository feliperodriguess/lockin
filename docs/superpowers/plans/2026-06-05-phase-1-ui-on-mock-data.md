# Phase 1 — UI on Mock Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entire lockin UI — shell + all six screens — running on a fake `window.api` bridge with typed fixtures and a dev state switcher, pixel-matched to `lockin-design-handoff/`, with zero LCU/network/persistence.

**Architecture:** One shared `Api` contract (PRD §8 + `declineReadyCheck`) implemented by a renderer-side fake bridge; push state lives in a plain-React `LcuProvider` (two churn-split contexts); invokes wrap in TanStack Query. Components only consume hooks. Scenario state drives the fake bridge; a DEV-only switcher (the prototype's DemoBar) mutates it. See `docs/superpowers/specs/2026-06-05-lockin-v1-implementation-design.md` (D1–D16).

**Tech Stack:** Electron 39 / electron-vite 5, React 19, TS strict, Tailwind v4 (CSS-first), shadcn (existing primitives restyled), TanStack Query v5 + Router v1 (memory history), lucide-react, @fontsource (Poppins, JetBrains Mono, Instrument Serif). Package manager: **pnpm**.

**Working agreement for UI tasks (read this first):**
1. The handoff is the styling source of truth. Each UI task lists **Read first:** handoff file + lines — read them before coding. The code in those tasks is the *structural/data-wiring baseline* (props, hooks, semantic HTML, states); exact paddings/fonts/colors come from the handoff source, expressed with the theme tokens from Task 2.
2. Match **visual output**, not prototype internals (per `lockin-design-handoff/README.md`). Drop prototype-only artifacts: TweaksPanel, FaintClient backdrop, painted traffic-light dots, ItemIcon/ItemRow/items pickers (spec D2), stacked/hero layouts (D3).
3. After every task: `pnpm typecheck && pnpm format`, then for UI tasks verify with Playwright MCP against `pnpm dev` (states listed per task; compare to `lockin-design-handoff/project/screenshots/`).
4. Commits: granular, concise, **no Co-Authored-By trailer** (CLAUDE.md).
5. Phase 1 has **no vitest and no shared/lib engines** (D7). The tiny display-glue derivations inside `useChampSelect` are explicitly marked `// PHASE-1 GLUE — replaced by src/shared/lib/* engines in Phases 5–7` and must stay dumb table-lookups/set-checks.

**Verification quick-reference (Playwright MCP):** `pnpm dev` serves the renderer at the URL printed by electron-vite (`http://localhost:5173` by default). The fake bridge auto-activates because `window.api` has no channels yet; the state switcher renders in DEV. Browser-based verification covers everything except real window chrome (traffic lights) — verify those by eye in the Electron window.

---

## Task 0: Spec amendment + housekeeping

The contract needs `declineReadyCheck` (PRD §6.4 requires manual Accept/**Decline** controls and "respect the decline"; §8 omits the channel — the LCU has `POST /lol-matchmaking/v1/ready-check/decline`). Also: drop Zustand (spec D6) and update CLAUDE.md's state-ownership paragraph.

**Files:**
- Modify: `docs/superpowers/specs/2026-06-05-lockin-v1-implementation-design.md`
- Modify: `CLAUDE.md`
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Amend the spec — add D16 + the Api method**

In the spec's §1 Decisions log table, append after the D15 row:

```markdown
| D16 | Ready-check decline | **Contract addition.** §6.4 requires working manual Accept/Decline and "respect the decline", but §8 lists no decline channel. Add `declineReadyCheck(): Promise<void>` to the Api (LCU: `POST /lol-matchmaking/v1/ready-check/decline`). Fake in Phase 1; real in Phase 3 |
```

In §3.1, after the `acceptReadyCheck` line in the code block, add:

```ts
  declineReadyCheck(): Promise<void>                             // mutation (D16)
```

- [ ] **Step 2: Update CLAUDE.md state ownership (D6)**

Replace the line:

```markdown
- **Zustand** holds the live LCU push state (`lcu:status`, `lcu:phase`, `lcu:readyCheck`, `lcu:champSelect`) — subscribe once in a top-level provider; never poll for these.
```

with:

```markdown
- **`LcuProvider`** (plain React context, `src/renderer/src/providers/lcu-provider.tsx`) holds the live LCU push state (`lcu:status`, `lcu:phase`, `lcu:readyCheck`, `lcu:champSelect`) — it subscribes once and exposes two churn-split contexts; never poll for these, and don't add Zustand unless re-render pressure demands it.
```

- [ ] **Step 3: Remove zustand**

Run: `pnpm remove zustand`
Expected: package.json `dependencies` no longer lists `zustand`.

- [ ] **Step 4: Verify and commit**

Run: `pnpm typecheck && pnpm format`
Expected: both clean (nothing imports zustand).

```bash
git add docs/superpowers/specs/2026-06-05-lockin-v1-implementation-design.md CLAUDE.md package.json pnpm-lock.yaml
git commit -m "docs: add declineReadyCheck ruling (D16), align CLAUDE.md with no-Zustand decision"
```

---

## Task 1: Shared contract — types, channels, Api interface

**Files:**
- Modify: `src/shared/types.ts` (currently empty)
- Modify: `src/shared/constants.ts` (replaces `PING`)
- Create: `src/shared/api.ts`
- Modify: `src/preload/index.ts` (retype to `Partial<Api>`, drop ping)
- Modify: `src/main/ipc.ts` (drop ping handler)
- Modify: `src/main/index.ts` (drop ping listener)
- Modify: `src/renderer/src/pages/home.tsx` (drop ping usage — temporary stub)

- [ ] **Step 1: Write `src/shared/types.ts`** (PRD §7, complete)

```ts
// ---------- Static data (Data Dragon) ----------
export interface ChampionStatic {
	id: string // "Aatrox" (DDragon string key, used in image paths)
	key: number // 266 — numeric id; equals LCU championId
	name: string
	title: string
	tags: string[] // ["Fighter","Tank"] — used for the spell heuristic fallback (Phase 6)
	imageFull: string // "Aatrox.png"
}

export interface SummonerSpellStatic {
	id: string // "SummonerFlash"
	key: number // 4 — equals LCU spell id
	name: string
	imageFull: string
}

export interface DDragonBundle {
	version: string
	championsByKey: Record<number, ChampionStatic>
	spellsByKey: Record<number, SummonerSpellStatic>
}

// ---------- LCU session (subset we consume) ----------
export type GameflowPhase =
	| "None"
	| "Lobby"
	| "Matchmaking"
	| "ReadyCheck"
	| "ChampSelect"
	| "GameStart"
	| "InProgress"
	| "Reconnect"
	| "WaitingForStats"
	| "PreEndOfGame"
	| "EndOfGame"

export interface ChampSelectPlayer {
	cellId: number
	championId: number // 0 if not locked/hidden
	championPickIntent: number // hovered champ
	assignedPosition: string // "top"|"jungle"|"middle"|"bottom"|"utility"|""
	summonerId: number
	puuid: string
	gameName?: string // present in modern LCU payloads; §7 is "subset we consume" — confirm in Phase 4
	spell1Id: number
	spell2Id: number
	team: number
}

export interface ChampSelectAction {
	actorCellId: number
	championId: number
	completed: boolean
	id: number
	isAllyAction: boolean
	isInProgress: boolean
	pickTurn: number
	type: "ban" | "pick" | string
}

export interface ChampSelectSession {
	actions: ChampSelectAction[][]
	bans: { myTeamBans: number[]; theirTeamBans: number[]; numBans: number }
	localPlayerCellId: number
	myTeam: ChampSelectPlayer[]
	theirTeam: ChampSelectPlayer[]
	timer: {
		adjustedTimeLeftInPhase: number // ms
		totalTimeInPhase: number // ms
		phase: string // "PLANNING"|"BAN_PICK"|"FINALIZATION"
		isInfinite: boolean
	}
}

export interface ReadyCheck {
	state: "Invalid" | "InProgress"
	playerResponse: "None" | "Accepted" | "Declined"
	timer: number // seconds elapsed since the check appeared
	declinerIds: number[]
}

export interface RankInfo {
	tier: string // "GOLD" (uppercase, LCU style)
	division: string // "II"
	lp: number
	queueType: string // "RANKED_SOLO_5x5"
}

// ---------- App domain (local) ----------
export interface MatchupNote {
	id: string // uuid
	championId: number // champ you play
	opponentChampionId: number | null // optional lane opponent
	body: string
	pinnedSpells?: [number, number] // override summoner-spell keys
	createdAt: string // ISO
	updatedAt: string // ISO
}

export interface BanListEntry {
	championId: number
	priority: number // 1 = highest
	reason?: string
}

export interface AppSettings {
	autoAccept: boolean // default false
	autoAcceptDelayMs: number // default 0
	spellSlotLayout: "DF" | "FD" // default "DF"
	rankDiffThreshold: number // division-steps delta to flag; default 8 (= 2 tiers)
}

export const DEFAULT_SETTINGS: AppSettings = {
	autoAccept: false,
	autoAcceptDelayMs: 0,
	spellSlotLayout: "DF",
	rankDiffThreshold: 8,
}
```

- [ ] **Step 2: Write `src/shared/constants.ts`** (replace entire file)

```ts
export const IPC = {
	// Renderer → Main (invoke)
	ACCEPT_READY_CHECK: "lcu:acceptReadyCheck",
	DECLINE_READY_CHECK: "lcu:declineReadyCheck",
	DDRAGON_GET_BUNDLE: "ddragon:getBundle",
	SETTINGS_GET: "settings:get",
	SETTINGS_SET: "settings:set",
	NOTES_LIST: "notes:list",
	NOTES_UPSERT: "notes:upsert",
	NOTES_DELETE: "notes:delete",
	BANLIST_GET: "banlist:get",
	BANLIST_SET: "banlist:set",
	RANK_GET_FOR_PUUIDS: "rank:getForPuuids",
	// Main → Renderer (push)
	LCU_STATUS: "lcu:status",
	LCU_PHASE: "lcu:phase",
	LCU_READY_CHECK: "lcu:readyCheck",
	LCU_CHAMP_SELECT: "lcu:champSelect",
} as const
```

- [ ] **Step 3: Write `src/shared/api.ts`**

```ts
import type {
	AppSettings,
	BanListEntry,
	ChampSelectSession,
	DDragonBundle,
	GameflowPhase,
	MatchupNote,
	RankInfo,
	ReadyCheck,
} from "./types"

export type Unsubscribe = () => void

/**
 * THE contract between renderer and main (PRD §8 + spec D16).
 * The real preload bridge implements it channel-by-channel across Phases 2–7;
 * the fake bridge (renderer, DEV-only) implements all of it from fixtures.
 * getApi() merges them: real channels win key-by-key (spec §3.2).
 */
export interface Api {
	// invokes → TanStack Query
	acceptReadyCheck(): Promise<void>
	declineReadyCheck(): Promise<void>
	getDDragonBundle(): Promise<DDragonBundle>
	getSettings(): Promise<AppSettings>
	setSettings(partial: Partial<AppSettings>): Promise<AppSettings>
	listNotes(): Promise<MatchupNote[]>
	upsertNote(note: Partial<MatchupNote>): Promise<MatchupNote>
	deleteNote(id: string): Promise<void>
	getBanList(): Promise<BanListEntry[]>
	setBanList(entries: BanListEntry[]): Promise<BanListEntry[]>
	getRanksForPuuids(puuids: string[]): Promise<Record<string, RankInfo | null>>
	// pushes → LcuProvider context (never into the Query cache)
	onLcuStatus(cb: (s: { connected: boolean }) => void): Unsubscribe
	onGameflowPhase(cb: (p: { phase: GameflowPhase }) => void): Unsubscribe
	onReadyCheck(cb: (r: ReadyCheck | null) => void): Unsubscribe
	onChampSelect(cb: (s: ChampSelectSession | null) => void): Unsubscribe
}
```

- [ ] **Step 4: Rewrite `src/preload/index.ts`** (real bridge starts empty; grows in Phases 2–7)

```ts
import { contextBridge } from "electron"

import type { Api } from "@/shared/api"

declare global {
	interface Window {
		api?: Partial<Api>
	}
}

// Real channels land here phase-by-phase (Phase 2: pushes for status/phase, …).
// getApi() in the renderer merges this over the fake bridge — real keys win.
const api: Partial<Api> = {}

if (process.contextIsolated) {
	try {
		contextBridge.exposeInMainWorld("api", api)
	} catch (error) {
		console.error(error)
	}
} else {
	window.api = api
}
```

- [ ] **Step 5: Rewrite `src/main/ipc.ts`** (handlers land in later phases)

```ts
// IPC invoke handlers register here. Phase 1 has none — the renderer runs on
// its fake bridge (src/renderer/src/api/fake/). Channel names: @/shared/constants.
export {}
```

Also in `src/main/index.ts`, delete the two lines:

```ts
	// IPC test
	ipcMain.on("ping", () => console.log("pong"))
```

and remove `ipcMain` from the electron import (keep the rest of the import list unchanged).

- [ ] **Step 6: Stub `src/renderer/src/pages/home.tsx`** (real content in Task 11)

```tsx
export function HomePage(): React.JSX.Element {
	return <main className="h-full" />
}
```

- [ ] **Step 7: Verify and commit**

Run: `pnpm typecheck && pnpm format`
Expected: clean. (`window.api.ping` is gone everywhere; nothing references `IPC.PING`.)

```bash
git add src/shared src/preload/index.ts src/main/ipc.ts src/main/index.ts src/renderer/src/pages/home.tsx
git commit -m "feat: define shared Api contract, IPC channels, and PRD data types"
```

---

## Task 2: Theme — tokens, fonts, CSP

**Read first:** `lockin-design-handoff/project/tokens.css` (all), `Lockin - Prototype.html:11-67` (crimson accent set + animations + scrollbars + body), `app.jsx:686-721` (ACCENTS map — crimson entry is the locked one).

**Files:**
- Modify: `src/renderer/src/global.css` (full rewrite)
- Modify: `src/renderer/src/main.tsx` (font imports)
- Modify: `src/renderer/index.html` (CSP, drop Google Fonts)
- Modify: `package.json` (via pnpm)

- [ ] **Step 1: Install bundled fonts (D13)**

Run: `pnpm add @fontsource/poppins @fontsource/jetbrains-mono @fontsource/instrument-serif`

(Geist is NOT installed — the prototype overrides `--font-ui` to Poppins, so Geist is unused.)

- [ ] **Step 2: Import font weights in `src/renderer/src/main.tsx`** (top of file, before `./global.css`)

```ts
import "@fontsource/poppins/300.css"
import "@fontsource/poppins/400.css"
import "@fontsource/poppins/500.css"
import "@fontsource/poppins/600.css"
import "@fontsource/poppins/700.css"
import "@fontsource/jetbrains-mono/400.css"
import "@fontsource/jetbrains-mono/500.css"
import "@fontsource/jetbrains-mono/600.css"
import "@fontsource/jetbrains-mono/700.css"
import "@fontsource/instrument-serif/400.css"
import "@fontsource/instrument-serif/400-italic.css"
```

- [ ] **Step 3: Rewrite `src/renderer/src/global.css`**

Structure (port values **exactly** from `tokens.css` + prototype HTML — the listing below is complete for structure; fill every `…` group with the corresponding token values from the handoff, they are 1:1 copies):

```css
@import "tailwindcss";
@plugin "tailwind-scrollbar";

@theme {
	/* fonts (prototype overrides --font-ui to Poppins; display = Instrument Serif) */
	--font-ui: "Poppins", ui-sans-serif, system-ui, sans-serif;
	--font-display: "Instrument Serif", "Iowan Old Style", Georgia, serif;
	--font-mono: "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;

	/* ink scale (tokens.css:21-28) — exposes bg-ink-950 etc. */
	--color-ink-1000: #08090a;
	--color-ink-950: #0c0d0e;
	--color-ink-900: #111315;
	--color-ink-850: #161819;
	--color-ink-800: #1c1e20;
	--color-ink-750: #232527;
	--color-ink-700: #2a2c2f;
	--color-ink-600: #3a3d40;

	/* parchment scale (tokens.css:33-37) — text-paper-100 etc. */
	--color-paper-100: #f4f1ea;
	--color-paper-200: #d9d6cf;
	--color-paper-300: #a8a59f;
	--color-paper-400: #6e6c67;
	--color-paper-500: #4a4845;

	/* crimson accent set (Prototype.html:29-37 — LOCKED, D14) */
	--color-accent: #f5003d;
	--color-accent-strong: #ff2e5f;
	--color-accent-press: #cc0034;
	--color-accent-fg: #ffffff;

	/* semantic states (tokens.css:50-57) */
	--color-pass: #c8ff3d;
	--color-fail: #ff6b5e;
	--color-warn: #f5b740;
	--color-info: #7aa2ff;
	--color-online: #3fd07a; /* champ-art.jsx:511 ONLINE_GREEN */

	/* radius (tokens.css:127-133) */
	--radius-xs: 3px;
	--radius-sm: 5px;
	--radius-md: 8px;
	--radius-lg: 12px;
	--radius-xl: 16px;
	--radius-2xl: 24px;
}

:root {
	/* alpha tokens & shadows that Tailwind colors can't hold (tokens.css:46,51-57,69-78) */
	--accent-bg: rgba(245, 0, 61, 0.12);
	--accent-glow: rgba(245, 0, 61, 0.32);
	--pass-bg: rgba(200, 255, 61, 0.08);
	--fail-bg: rgba(255, 107, 94, 0.1);
	--warn-bg: rgba(245, 183, 64, 0.1);
	--info-bg: rgba(122, 162, 255, 0.1);
	--stroke-subtle: rgba(244, 241, 234, 0.06);
	--stroke-default: rgba(244, 241, 234, 0.1);
	--stroke-strong: rgba(244, 241, 234, 0.18);
	--shadow-lg: 0 24px 48px -16px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--stroke-default);

	/* semantic aliases used throughout (tokens.css:145-167) */
	--bg-canvas: var(--color-ink-950);
	--bg-surface: var(--color-ink-900);
	--bg-raised: var(--color-ink-850);
	--bg-hover: var(--color-ink-800);
	--fg-1: var(--color-paper-100);
	--fg-2: var(--color-paper-200);
	--fg-3: var(--color-paper-300);
	--fg-4: var(--color-paper-400);

	/* motion (tokens.css:136-141) */
	--ease-standard: cubic-bezier(0.2, 0, 0, 1);
	--ease-emphasized: cubic-bezier(0.3, 0, 0, 1);
	--ease-soft: cubic-bezier(0.4, 0, 0.6, 1);
	--dur-fast: 120ms;
	--dur-base: 200ms;
	--dur-slow: 360ms;

	/* shadcn semantic vars → handoff tokens (single dark theme, no .dark block) */
	--radius: 0.5rem;
	--background: var(--color-ink-950);
	--foreground: var(--color-paper-100);
	--card: var(--color-ink-850);
	--card-foreground: var(--color-paper-100);
	--popover: var(--color-ink-900);
	--popover-foreground: var(--color-paper-100);
	--primary: var(--color-accent);
	--primary-foreground: var(--color-accent-fg);
	--secondary: var(--color-ink-850);
	--secondary-foreground: var(--color-paper-100);
	--muted: var(--color-ink-800);
	--muted-foreground: var(--color-paper-300);
	--accent: var(--color-ink-800); /* shadcn "accent" = hover surface, NOT brand accent */
	--accent-foreground: var(--color-paper-100);
	--destructive: var(--color-fail);
	--border: var(--stroke-default);
	--input: var(--stroke-default);
	--ring: var(--color-accent);
}

@theme inline {
	/* keep shadcn-style utilities working against the aliases above */
	--color-background: var(--background);
	--color-foreground: var(--foreground);
	--color-card: var(--card);
	--color-card-foreground: var(--card-foreground);
	--color-popover: var(--popover);
	--color-popover-foreground: var(--popover-foreground);
	--color-primary: var(--primary);
	--color-primary-foreground: var(--primary-foreground);
	--color-secondary: var(--secondary);
	--color-secondary-foreground: var(--secondary-foreground);
	--color-muted: var(--muted);
	--color-muted-foreground: var(--muted-foreground);
	--color-border: var(--border);
	--color-input: var(--input);
	--color-ring: var(--ring);
	--color-destructive: var(--destructive);
	--radius-DEFAULT: var(--radius);
}

@layer base {
	* {
		@apply border-border outline-ring/50;
	}
	html {
		overflow: hidden;
	}
	body {
		background: var(--bg-canvas);
		color: var(--fg-1);
		font-family: var(--font-ui);
		-webkit-font-smoothing: antialiased;
	}
	::selection {
		background: var(--accent-bg);
	}
	/* quiet scrollbars (Prototype.html:23-26) */
	::-webkit-scrollbar {
		width: 9px;
		height: 9px;
	}
	::-webkit-scrollbar-thumb {
		background: var(--color-ink-700);
		border-radius: 999px;
		border: 2px solid transparent;
		background-clip: content-box;
	}
	::-webkit-scrollbar-thumb:hover {
		background: var(--color-ink-600);
		background-clip: content-box;
	}
	::-webkit-scrollbar-track {
		background: transparent;
	}
}

/* window drag regions (Electron) */
.region-drag {
	-webkit-app-region: drag;
}
.region-no-drag {
	-webkit-app-region: no-drag;
}

/* prototype animations (Prototype.html:39-66) — copy all keyframes verbatim:
   acBlink/.ac-blink, ccpBreathe/.ccp-breathe, ccpPing/.ccp-ping,
   ccpHalo/.ccp-halo/.ccp-halo-2, ccpFade/.ccp-fade, ccpDrawer/.ccp-drawer,
   ccpScreenIn/.ccp-screen, ccpRise — plus the prefers-reduced-motion block. */
```

(The final file must contain the real keyframes copied from `Prototype.html:39-66`, not the comment.)

- [ ] **Step 4: Update `src/renderer/index.html`**

Remove the three Google Fonts `<link>` tags and the two preconnect tags. Replace the CSP meta with:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https://ddragon.leagueoflegends.com"
/>
```

(`img-src https://ddragon.leagueoflegends.com` is what lets champion/spell icons hotlink — D15.)

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck && pnpm format`, then `pnpm dev` + Playwright MCP: page background is `#0c0d0e`, text renders in Poppins (inspect `font-family` on body), no console CSP/font errors.

```bash
git add package.json pnpm-lock.yaml src/renderer/src/global.css src/renderer/src/main.tsx src/renderer/index.html
git commit -m "feat: port design-handoff theme to Tailwind v4 tokens, bundle fonts locally"
```

---

## Task 3: Typed fixtures

**Read first:** `lockin-design-handoff/project/data.js` (all — this is the content being retyped to PRD shapes).

**Files:**
- Create: `src/renderer/src/api/fake/fixtures.ts`

- [ ] **Step 1: Write `src/renderer/src/api/fake/fixtures.ts`** (complete)

```ts
import type {
	AppSettings,
	BanListEntry,
	ChampionStatic,
	DDragonBundle,
	MatchupNote,
	RankInfo,
	SummonerSpellStatic,
} from "@/shared/types"
import { DEFAULT_SETTINGS } from "@/shared/types"

/* data.js content RETYPED to PRD §7 shapes (spec §2) — real DDragon numeric keys. */

const CHAMPIONS: ChampionStatic[] = [
	{ id: "Aatrox", key: 266, name: "Aatrox", title: "the Darkin Blade", tags: ["Fighter", "Tank"], imageFull: "Aatrox.png" },
	{ id: "Fiora", key: 114, name: "Fiora", title: "the Grand Duelist", tags: ["Fighter", "Assassin"], imageFull: "Fiora.png" },
	{ id: "Darius", key: 122, name: "Darius", title: "the Hand of Noxus", tags: ["Fighter", "Tank"], imageFull: "Darius.png" },
	{ id: "Quinn", key: 133, name: "Quinn", title: "Demacia's Wings", tags: ["Marksman", "Assassin"], imageFull: "Quinn.png" },
	{ id: "Camille", key: 164, name: "Camille", title: "the Steel Shadow", tags: ["Fighter", "Tank"], imageFull: "Camille.png" },
	{ id: "Renekton", key: 58, name: "Renekton", title: "the Butcher", tags: ["Fighter", "Tank"], imageFull: "Renekton.png" },
	{ id: "Sett", key: 875, name: "Sett", title: "the Boss", tags: ["Fighter", "Tank"], imageFull: "Sett.png" },
	{ id: "Garen", key: 86, name: "Garen", title: "the Might of Demacia", tags: ["Fighter", "Tank"], imageFull: "Garen.png" },
	{ id: "Ahri", key: 103, name: "Ahri", title: "the Nine-Tailed Fox", tags: ["Mage", "Assassin"], imageFull: "Ahri.png" },
	{ id: "Yasuo", key: 157, name: "Yasuo", title: "the Unforgiven", tags: ["Fighter", "Assassin"], imageFull: "Yasuo.png" },
	{ id: "LeeSin", key: 64, name: "Lee Sin", title: "the Blind Monk", tags: ["Fighter", "Assassin"], imageFull: "LeeSin.png" },
	{ id: "Khazix", key: 121, name: "Kha'Zix", title: "the Voidreaver", tags: ["Assassin"], imageFull: "Khazix.png" },
	{ id: "Jinx", key: 222, name: "Jinx", title: "the Loose Cannon", tags: ["Marksman"], imageFull: "Jinx.png" },
	{ id: "Caitlyn", key: 51, name: "Caitlyn", title: "the Sheriff", tags: ["Marksman"], imageFull: "Caitlyn.png" },
	{ id: "Thresh", key: 412, name: "Thresh", title: "the Chain Warden", tags: ["Support", "Fighter"], imageFull: "Thresh.png" },
	{ id: "Lulu", key: 117, name: "Lulu", title: "the Fae Sorceress", tags: ["Support", "Mage"], imageFull: "Lulu.png" },
]

const SPELLS: SummonerSpellStatic[] = [
	{ id: "SummonerBoost", key: 1, name: "Cleanse", imageFull: "SummonerBoost.png" },
	{ id: "SummonerExhaust", key: 3, name: "Exhaust", imageFull: "SummonerExhaust.png" },
	{ id: "SummonerFlash", key: 4, name: "Flash", imageFull: "SummonerFlash.png" },
	{ id: "SummonerHaste", key: 6, name: "Ghost", imageFull: "SummonerHaste.png" },
	{ id: "SummonerHeal", key: 7, name: "Heal", imageFull: "SummonerHeal.png" },
	{ id: "SummonerSmite", key: 11, name: "Smite", imageFull: "SummonerSmite.png" },
	{ id: "SummonerTeleport", key: 12, name: "Teleport", imageFull: "SummonerTeleport.png" },
	{ id: "SummonerDot", key: 14, name: "Ignite", imageFull: "SummonerDot.png" },
	{ id: "SummonerBarrier", key: 21, name: "Barrier", imageFull: "SummonerBarrier.png" },
]

export const FIXTURE_BUNDLE: DDragonBundle = {
	version: "14.10.1", // pinned mock version (data.js:6); real version resolved in Phase 4
	championsByKey: Object.fromEntries(CHAMPIONS.map((c) => [c.key, c])),
	spellsByKey: Object.fromEntries(SPELLS.map((s) => [s.key, s])),
}

/* champion key shorthands */
export const C = {
	aatrox: 266, fiora: 114, darius: 122, quinn: 133, camille: 164, renekton: 58,
	sett: 875, garen: 86, ahri: 103, yasuo: 157, leesin: 64, khazix: 121,
	jinx: 222, caitlyn: 51, thresh: 412, lulu: 117,
} as const

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

export const FIXTURE_NOTES: MatchupNote[] = [
	{
		id: "n1", championId: C.aatrox, opponentChampionId: C.fiora,
		body: "Respect her Riposte on your Q3. Freeze near tower early, all-in after she uses Parry. Don't waste your sweetspot into her W — bait it first.",
		pinnedSpells: [4, 12], createdAt: daysAgo(9), updatedAt: daysAgo(2),
	},
	{
		id: "n2", championId: C.aatrox, opponentChampionId: C.darius,
		body: "Short trades only. Your Q outranges his pull — poke and disengage. Don't get greedy at 5 stacks; back off if he lands his E.",
		pinnedSpells: [4, 14], createdAt: daysAgo(12), updatedAt: daysAgo(5),
	},
	{
		id: "n3", championId: C.ahri, opponentChampionId: C.yasuo,
		body: "Charm is everything — hold it for when his Windwall is down. Roam mid-to-bot on your first back; he can't follow fast.",
		pinnedSpells: [4, 12], createdAt: daysAgo(14), updatedAt: daysAgo(7),
	},
	{
		id: "n4", championId: C.leesin, opponentChampionId: null,
		body: "Red-side full clear into gank topside. Ward your own raptors at 3:00 — enemy jungler loves the invade here.",
		pinnedSpells: [4, 11], createdAt: daysAgo(20), updatedAt: daysAgo(7),
	},
	{
		id: "n5", championId: C.thresh, opponentChampionId: C.lulu,
		body: "Hook priority on the enchanter, not the ADC. Lantern timing wins the 2v2 — don't flay the wrong target.",
		pinnedSpells: [4, 14], createdAt: daysAgo(21), updatedAt: daysAgo(14),
	},
	{
		id: "n6", championId: C.jinx, opponentChampionId: C.caitlyn,
		body: "Lose level 1-2, scale past it. Hold rockets for when she steps up to trap. Don't walk into the bush she warded.",
		pinnedSpells: [4, 7], createdAt: daysAgo(28), updatedAt: daysAgo(21),
	},
]

export const FIXTURE_BANLIST: BanListEntry[] = [
	{ championId: C.fiora, priority: 1, reason: "Lane bully, hard to itemize against" },
	{ championId: C.darius, priority: 2, reason: "Snowballs the lane on a single kill" },
	{ championId: C.camille, priority: 3, reason: "Outscales, hooks me to tower" },
	{ championId: C.quinn, priority: 4, reason: "Ranged top — miserable matchup" },
	{ championId: C.yasuo, priority: 5, reason: "Roams mid, ints my jungler" },
]

export const FIXTURE_SETTINGS: AppSettings = { ...DEFAULT_SETTINGS }

/* my team — cellIds 0-4, me = cell 2 (PRD §17 appendix) */
export const ME_CELL_ID = 2
export interface FixturePlayer {
	cellId: number
	championId: number
	position: string
	puuid: string
	summonerId: number
	gameName: string
}
export const MY_TEAM: FixturePlayer[] = [
	{ cellId: 0, championId: C.leesin, position: "jungle", puuid: "p-wardenz", summonerId: 101, gameName: "wardenz" },
	{ cellId: 1, championId: C.ahri, position: "middle", puuid: "p-foxfire", summonerId: 102, gameName: "foxfire" },
	{ cellId: 2, championId: C.aatrox, position: "top", puuid: "p-me", summonerId: 103, gameName: "lategame andy" },
	{ cellId: 3, championId: C.jinx, position: "bottom", puuid: "p-zapzap", summonerId: 104, gameName: "zap zap" },
	{ cellId: 4, championId: C.thresh, position: "utility", puuid: "p-hook", summonerId: 105, gameName: "hook or feed" },
]
export const THEIR_TEAM: FixturePlayer[] = [
	{ cellId: 5, championId: C.fiora, position: "top", puuid: "", summonerId: 0, gameName: "" },
	{ cellId: 6, championId: C.khazix, position: "jungle", puuid: "", summonerId: 0, gameName: "" },
	{ cellId: 7, championId: C.yasuo, position: "middle", puuid: "", summonerId: 0, gameName: "" },
	{ cellId: 8, championId: C.caitlyn, position: "bottom", puuid: "", summonerId: 0, gameName: "" },
	{ cellId: 9, championId: C.lulu, position: "utility", puuid: "", summonerId: 0, gameName: "" },
]

/* ranks — 4 around Gold/Plat, one Diamond so the mismatch flag has a reason (data.js:91) */
export const FIXTURE_RANKS: Record<string, RankInfo | null> = {
	"p-me": { tier: "EMERALD", division: "IV", lp: 12, queueType: "RANKED_SOLO_5x5" },
	"p-wardenz": { tier: "PLATINUM", division: "III", lp: 41, queueType: "RANKED_SOLO_5x5" },
	"p-foxfire": { tier: "GOLD", division: "II", lp: 67, queueType: "RANKED_SOLO_5x5" },
	"p-zapzap": { tier: "DIAMOND", division: "IV", lp: 8, queueType: "RANKED_SOLO_5x5" },
	"p-hook": { tier: "GOLD", division: "IV", lp: 23, queueType: "RANKED_SOLO_5x5" },
}
```

- [ ] **Step 2: Verify and commit**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

```bash
git add src/renderer/src/api/fake/fixtures.ts
git commit -m "feat: add typed mock fixtures (PRD shapes, data.js content)"
```

---

## Task 4: Scenario store + fake bridge + getApi()

**Files:**
- Create: `src/renderer/src/api/fake/scenario.ts`
- Create: `src/renderer/src/api/fake/bridge.ts`
- Create: `src/renderer/src/api/index.ts`

- [ ] **Step 1: Write `src/renderer/src/api/fake/scenario.ts`**

```ts
import type { ChampSelectSession, GameflowPhase, ReadyCheck } from "@/shared/types"
import { ME_CELL_ID, MY_TEAM, THEIR_TEAM } from "./fixtures"

/* The dev switcher's state — mirrors the prototype DemoBar (app.jsx:505-684). */
export interface ScenarioState {
	phase: "disconnected" | "idle" | "ready" | "select"
	csSubPhase: "ban" | "pick" | null // null = auto-cycle ban→pick on timer expiry
	enemyHidden: boolean | null // null = auto (hidden during ban)
	ranksAvailable: boolean
	hasNote: boolean
	roleAssigned: boolean
	autoAcceptFired: boolean
}

export const INITIAL_SCENARIO: ScenarioState = {
	phase: "select",
	csSubPhase: null,
	enemyHidden: null,
	ranksAvailable: true,
	hasNote: true,
	roleAssigned: true,
	autoAcceptFired: false,
}

export const GAMEFLOW_BY_SCENARIO: Record<ScenarioState["phase"], GameflowPhase> = {
	disconnected: "None",
	idle: "Lobby",
	ready: "ReadyCheck",
	select: "ChampSelect",
}

/* prototype PHASE_LEN (champ-select.jsx:9), in ms */
export const PHASE_LEN_MS = { ban: 27_000, pick: 31_000 } as const
export const READY_CHECK_TOTAL_S = 12

export function buildReadyCheck(s: ScenarioState, elapsedSeconds: number): ReadyCheck {
	return {
		state: "InProgress",
		playerResponse: s.autoAcceptFired ? "Accepted" : "None",
		timer: elapsedSeconds,
		declinerIds: [],
	}
}

export function buildSession(
	s: ScenarioState,
	subPhase: "ban" | "pick",
	msLeft: number,
): ChampSelectSession {
	const enemyHidden = s.enemyHidden ?? subPhase === "ban"
	return {
		localPlayerCellId: ME_CELL_ID,
		timer: {
			adjustedTimeLeftInPhase: msLeft,
			totalTimeInPhase: PHASE_LEN_MS[subPhase],
			phase: "BAN_PICK",
			isInfinite: false,
		},
		bans: { myTeamBans: [164], theirTeamBans: [], numBans: 10 }, // Camille banned
		myTeam: MY_TEAM.map((p) => ({
			cellId: p.cellId,
			championId: p.championId,
			championPickIntent: 0,
			assignedPosition: p.cellId === ME_CELL_ID && !s.roleAssigned ? "" : p.position,
			summonerId: p.summonerId,
			puuid: p.puuid,
			gameName: p.gameName,
			spell1Id: 4,
			spell2Id: 12,
			team: 1,
		})),
		theirTeam: THEIR_TEAM.map((p) => ({
			cellId: p.cellId,
			championId: enemyHidden ? 0 : p.championId,
			championPickIntent: 0,
			assignedPosition: enemyHidden ? "" : p.position,
			summonerId: 0,
			puuid: "",
			spell1Id: 0,
			spell2Id: 0,
			team: 2,
		})),
		actions: [
			[
				{
					actorCellId: ME_CELL_ID,
					championId: 0,
					completed: subPhase !== "ban",
					id: 10,
					isAllyAction: true,
					isInProgress: subPhase === "ban",
					pickTurn: 1,
					type: "ban",
				},
			],
			[
				{
					actorCellId: ME_CELL_ID,
					championId: subPhase === "pick" ? 266 : 0,
					completed: false,
					id: 20,
					isAllyAction: true,
					isInProgress: subPhase === "pick",
					pickTurn: 2,
					type: "pick",
				},
			],
		],
	}
}
```

- [ ] **Step 2: Write `src/renderer/src/api/fake/bridge.ts`**

```ts
import type { Api, Unsubscribe } from "@/shared/api"
import type {
	AppSettings,
	BanListEntry,
	ChampSelectSession,
	GameflowPhase,
	MatchupNote,
	RankInfo,
	ReadyCheck,
} from "@/shared/types"
import {
	C,
	FIXTURE_BANLIST,
	FIXTURE_BUNDLE,
	FIXTURE_NOTES,
	FIXTURE_RANKS,
	FIXTURE_SETTINGS,
} from "./fixtures"
import {
	buildReadyCheck,
	buildSession,
	GAMEFLOW_BY_SCENARIO,
	INITIAL_SCENARIO,
	PHASE_LEN_MS,
	READY_CHECK_TOTAL_S,
	type ScenarioState,
} from "./scenario"

/* ---------------------------------------------------------------- emitter */
type Listener<T> = (payload: T) => void
function channel<T>() {
	const listeners = new Set<Listener<T>>()
	return {
		emit(payload: T) {
			for (const l of listeners) l(payload)
		},
		on(cb: Listener<T>): Unsubscribe {
			listeners.add(cb)
			return () => listeners.delete(cb)
		},
	}
}

const statusCh = channel<{ connected: boolean }>()
const phaseCh = channel<{ phase: GameflowPhase }>()
const readyCh = channel<ReadyCheck | null>()
const champCh = channel<ChampSelectSession | null>()

/* ----------------------------------------------------------- mutable state */
let scenario: ScenarioState = { ...INITIAL_SCENARIO }
let settings: AppSettings = { ...FIXTURE_SETTINGS }
let notes: MatchupNote[] = FIXTURE_NOTES.map((n) => ({ ...n }))
let banlist: BanListEntry[] = FIXTURE_BANLIST.map((b) => ({ ...b }))

/* live tickers */
let subPhase: "ban" | "pick" = "ban"
let csMsLeft: number = PHASE_LEN_MS.ban
let readyElapsedS = 0
let readyResponse: ReadyCheck["playerResponse"] = "None"
let tick: ReturnType<typeof setInterval> | undefined

function emitAll() {
	const connected = scenario.phase !== "disconnected"
	statusCh.emit({ connected })
	phaseCh.emit({ phase: GAMEFLOW_BY_SCENARIO[scenario.phase] })
	readyCh.emit(
		scenario.phase === "ready"
			? { ...buildReadyCheck(scenario, readyElapsedS), playerResponse: effectiveReadyResponse() }
			: null,
	)
	champCh.emit(scenario.phase === "select" ? buildSession(scenario, subPhase, csMsLeft) : null)
}

function effectiveReadyResponse(): ReadyCheck["playerResponse"] {
	if (scenario.autoAcceptFired) return "Accepted"
	return readyResponse
}

function startTicker() {
	stopTicker()
	tick = setInterval(() => {
		if (scenario.phase === "select") {
			csMsLeft -= 1000
			if (csMsLeft <= 0) {
				if (scenario.csSubPhase == null) subPhase = subPhase === "ban" ? "pick" : "ban"
				csMsLeft = PHASE_LEN_MS[subPhase]
			}
			champCh.emit(buildSession(scenario, subPhase, csMsLeft))
		} else if (scenario.phase === "ready" && effectiveReadyResponse() === "None") {
			readyElapsedS += 1
			if (readyElapsedS >= READY_CHECK_TOTAL_S) {
				// missed — LCU flips state to Invalid
				readyCh.emit({ state: "Invalid", playerResponse: "None", timer: readyElapsedS, declinerIds: [] })
				return
			}
			readyCh.emit({ ...buildReadyCheck(scenario, readyElapsedS), playerResponse: "None" })
		}
	}, 1000)
}
function stopTicker() {
	if (tick) clearInterval(tick)
}

/* --------------------------------------------------------- switcher contract */
export function getScenario(): ScenarioState {
	return scenario
}
export function setScenario(next: Partial<ScenarioState>): void {
	const prevPhase = scenario.phase
	scenario = { ...scenario, ...next }
	if (scenario.phase !== prevPhase) {
		// entering a phase resets its ticker state
		readyElapsedS = 0
		readyResponse = "None"
		subPhase = scenario.csSubPhase ?? "ban"
		csMsLeft = PHASE_LEN_MS[subPhase]
	}
	if (next.csSubPhase != null) {
		subPhase = next.csSubPhase
		csMsLeft = PHASE_LEN_MS[subPhase]
	}
	emitAll()
}

/* ------------------------------------------------------------------- the Api */
export const fakeBridge: Api = {
	async acceptReadyCheck() {
		readyResponse = "Accepted"
		emitAll()
	},
	async declineReadyCheck() {
		readyResponse = "Declined"
		emitAll()
	},
	async getDDragonBundle() {
		return FIXTURE_BUNDLE
	},
	async getSettings() {
		return { ...settings }
	},
	async setSettings(partial) {
		settings = { ...settings, ...partial }
		return { ...settings }
	},
	async listNotes() {
		// "Note: none" scenario hides the Aatrox-vs-Fiora note (the live matchup)
		const visible = scenario.hasNote
			? notes
			: notes.filter((n) => !(n.championId === C.aatrox && n.opponentChampionId === C.fiora))
		return visible.map((n) => ({ ...n })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
	},
	async upsertNote(partial) {
		const now = new Date().toISOString()
		if (partial.id) {
			notes = notes.map((n) => (n.id === partial.id ? { ...n, ...partial, updatedAt: now } : n))
			const updated = notes.find((n) => n.id === partial.id)
			if (!updated) throw new Error(`note not found: ${partial.id}`)
			return { ...updated }
		}
		const created: MatchupNote = {
			id: `n-${crypto.randomUUID()}`,
			championId: partial.championId ?? 0,
			opponentChampionId: partial.opponentChampionId ?? null,
			body: partial.body ?? "",
			pinnedSpells: partial.pinnedSpells,
			createdAt: now,
			updatedAt: now,
		}
		notes = [created, ...notes]
		return { ...created }
	},
	async deleteNote(id) {
		notes = notes.filter((n) => n.id !== id)
	},
	async getBanList() {
		return banlist.map((b) => ({ ...b }))
	},
	async setBanList(entries) {
		banlist = entries.map((e, i) => ({ ...e, priority: i + 1 }))
		return banlist.map((b) => ({ ...b }))
	},
	async getRanksForPuuids(puuids) {
		// "Ranks N/A" still keeps YOUR rank — the prototype always shows the local player's
		// rank (champ-select-parts.jsx:517 showRank = ranksAvailable || p.you)
		const out: Record<string, RankInfo | null> = {}
		for (const p of puuids)
			out[p] = scenario.ranksAvailable || p === "p-me" ? (FIXTURE_RANKS[p] ?? null) : null
		return out
	},
	onLcuStatus: (cb) => {
		const off = statusCh.on(cb)
		cb({ connected: scenario.phase !== "disconnected" })
		return off
	},
	onGameflowPhase: (cb) => {
		const off = phaseCh.on(cb)
		cb({ phase: GAMEFLOW_BY_SCENARIO[scenario.phase] })
		return off
	},
	onReadyCheck: (cb) => {
		const off = readyCh.on(cb)
		cb(
			scenario.phase === "ready"
				? { ...buildReadyCheck(scenario, readyElapsedS), playerResponse: effectiveReadyResponse() }
				: null,
		)
		return off
	},
	onChampSelect: (cb) => {
		const off = champCh.on(cb)
		cb(scenario.phase === "select" ? buildSession(scenario, subPhase, csMsLeft) : null)
		return off
	},
}

startTicker()
```

- [ ] **Step 3: Write `src/renderer/src/api/index.ts`** (progressive override merge, spec §3.2)

```ts
import type { Api } from "@/shared/api"

export const FORCE_FAKE_KEY = "lockin:forceFake"

/* DEV: load the fake bridge (tree-shaken from production builds).
   Top-level await is fine — Vite renderer targets modern Chromium. */
const fake = import.meta.env.DEV ? (await import("./fake/bridge")).fakeBridge : undefined

const forceFake = import.meta.env.DEV && window.localStorage.getItem(FORCE_FAKE_KEY) === "1"

/* Real preload channels win key-by-key; unimplemented ones answer from the fake.
   NOTE: production builds need the real bridge complete (Phase 7) — until then
   prod is not a shipping target (packaging is Phase 8). */
export const api: Api =
	forceFake && fake ? fake : ({ ...fake, ...window.api } as Api)
```

- [ ] **Step 4: Verify and commit**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

```bash
git add src/renderer/src/api
git commit -m "feat: add fake api bridge with scenario store and progressive merge"
```

---

## Task 5: Providers + data hooks

**Files:**
- Create: `src/renderer/src/providers/lcu-provider.tsx`
- Create: `src/renderer/src/hooks/use-lcu.ts`
- Create: `src/renderer/src/hooks/use-data.ts`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Write `src/renderer/src/providers/lcu-provider.tsx`** (spec §3.3 — two churn-split contexts)

```tsx
import { createContext, useEffect, useReducer } from "react"

import type { ChampSelectSession, GameflowPhase, ReadyCheck } from "@/shared/types"
import { api } from "@renderer/api"

export interface LcuStatusState {
	connected: boolean
	phase: GameflowPhase
}
export interface LcuLiveState {
	readyCheck: ReadyCheck | null
	champSelect: ChampSelectSession | null
}

export const LcuStatusContext = createContext<LcuStatusState>({ connected: false, phase: "None" })
export const LcuLiveContext = createContext<LcuLiveState>({ readyCheck: null, champSelect: null })

type LcuState = LcuStatusState & LcuLiveState
type LcuEvent =
	| { type: "status"; connected: boolean }
	| { type: "phase"; phase: GameflowPhase }
	| { type: "readyCheck"; readyCheck: ReadyCheck | null }
	| { type: "champSelect"; champSelect: ChampSelectSession | null }

function reducer(state: LcuState, e: LcuEvent): LcuState {
	switch (e.type) {
		case "status":
			return { ...state, connected: e.connected }
		case "phase":
			return { ...state, phase: e.phase }
		case "readyCheck":
			return { ...state, readyCheck: e.readyCheck }
		case "champSelect":
			return { ...state, champSelect: e.champSelect }
	}
}

export function LcuProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
	const [state, dispatch] = useReducer(reducer, {
		connected: false,
		phase: "None",
		readyCheck: null,
		champSelect: null,
	})

	// subscribe exactly once (spec §3.3)
	useEffect(() => {
		const offs = [
			api.onLcuStatus(({ connected }) => dispatch({ type: "status", connected })),
			api.onGameflowPhase(({ phase }) => dispatch({ type: "phase", phase })),
			api.onReadyCheck((readyCheck) => dispatch({ type: "readyCheck", readyCheck })),
			api.onChampSelect((champSelect) => dispatch({ type: "champSelect", champSelect })),
		]
		return () => {
			for (const off of offs) off()
		}
	}, [])

	return (
		<LcuStatusContext.Provider value={{ connected: state.connected, phase: state.phase }}>
			<LcuLiveContext.Provider value={{ readyCheck: state.readyCheck, champSelect: state.champSelect }}>
				{children}
			</LcuLiveContext.Provider>
		</LcuStatusContext.Provider>
	)
}
```

Note: the two context values are re-created on any reducer change; the churn split still pays off because `LcuStatusContext` consumers (sidebar/frame) only re-render when React sees a *new value object* — to make that true, memoize both values:

```tsx
	const statusValue = useMemo(
		() => ({ connected: state.connected, phase: state.phase }),
		[state.connected, state.phase],
	)
	const liveValue = useMemo(
		() => ({ readyCheck: state.readyCheck, champSelect: state.champSelect }),
		[state.readyCheck, state.champSelect],
	)
```

(import `useMemo`; use `statusValue`/`liveValue` in the providers.)

- [ ] **Step 2: Write `src/renderer/src/hooks/use-lcu.ts`**

```ts
import { useContext } from "react"

import type { ChampSelectSession, GameflowPhase, ReadyCheck } from "@/shared/types"
import { LcuLiveContext, LcuStatusContext } from "@renderer/providers/lcu-provider"

export function useLcuStatus(): { connected: boolean } {
	const { connected } = useContext(LcuStatusContext)
	return { connected }
}

export function usePhase(): GameflowPhase {
	return useContext(LcuStatusContext).phase
}

export function useReadyCheck(): ReadyCheck | null {
	return useContext(LcuLiveContext).readyCheck
}

export function useChampSelectSession(): ChampSelectSession | null {
	return useContext(LcuLiveContext).champSelect
}
```

- [ ] **Step 3: Write `src/renderer/src/hooks/use-data.ts`** (Query wrappers — keys per spec §3.1)

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { AppSettings, BanListEntry, MatchupNote } from "@/shared/types"
import { api } from "@renderer/api"

export function useDDragon() {
	return useQuery({ queryKey: ["ddragon"], queryFn: api.getDDragonBundle, staleTime: Infinity, gcTime: Infinity })
}

export function useSettings() {
	return useQuery({ queryKey: ["settings"], queryFn: api.getSettings, staleTime: Infinity })
}
export function useSetSettings() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (partial: Partial<AppSettings>) => api.setSettings(partial),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
	})
}

export function useNotes() {
	return useQuery({ queryKey: ["notes"], queryFn: api.listNotes, staleTime: Infinity })
}
export function useUpsertNote() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (note: Partial<MatchupNote>) => api.upsertNote(note),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
	})
}
export function useDeleteNote() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (id: string) => api.deleteNote(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
	})
}

export function useBanList() {
	return useQuery({ queryKey: ["banlist"], queryFn: api.getBanList, staleTime: Infinity })
}
export function useSetBanList() {
	const qc = useQueryClient()
	return useMutation({
		mutationFn: (entries: BanListEntry[]) => api.setBanList(entries),
		onSuccess: () => qc.invalidateQueries({ queryKey: ["banlist"] }),
	})
}

export function useTeamRanks(puuids: string[]) {
	return useQuery({
		queryKey: ["ranks", ...puuids],
		queryFn: () => api.getRanksForPuuids(puuids),
		enabled: puuids.length > 0,
		staleTime: Infinity,
	})
}

export function useAcceptReadyCheck() {
	return useMutation({ mutationFn: () => api.acceptReadyCheck() })
}
export function useDeclineReadyCheck() {
	return useMutation({ mutationFn: () => api.declineReadyCheck() })
}
```

- [ ] **Step 4: Rewrite `src/renderer/src/App.tsx`** (providers + Electron-local Query defaults)

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"

import { LcuProvider } from "./providers/lcu-provider"
import { router } from "./routes"

/* Local-IPC data source: no flaky network — don't retry, don't refetch on focus. */
const queryClient = new QueryClient({
	defaultOptions: {
		queries: { retry: false, refetchOnWindowFocus: false },
	},
})

function App(): React.JSX.Element {
	return (
		<QueryClientProvider client={queryClient}>
			<LcuProvider>
				<RouterProvider router={router} />
			</LcuProvider>
		</QueryClientProvider>
	)
}

export default App
```

- [ ] **Step 5: Verify and commit**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

```bash
git add src/renderer/src/providers src/renderer/src/hooks src/renderer/src/App.tsx
git commit -m "feat: add LcuProvider and TanStack Query data hooks over the api bridge"
```

---

## Task 6: View-model libs + `useChampSelect`

**Files:**
- Create: `src/renderer/src/lib/ddragon-urls.ts`
- Create: `src/renderer/src/lib/roles.ts`
- Create: `src/renderer/src/lib/time.ts`
- Create: `src/renderer/src/lib/rank-format.ts`
- Create: `src/renderer/src/hooks/use-champ-select.ts`

- [ ] **Step 1: Write `src/renderer/src/lib/ddragon-urls.ts`**

```ts
const CDN = "https://ddragon.leagueoflegends.com/cdn"

export const champIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/champion/${imageFull}`

export const spellIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/spell/${imageFull}`

/* deterministic on-brand fallback tint per champion (replaces data.js per-champ colors) */
export function championFallbackColor(key: number): string {
	const hue = Math.round((key * 137.508) % 360) // golden-angle spread
	return `hsl(${hue} 32% 30%)`
}
```

- [ ] **Step 2: Write `src/renderer/src/lib/roles.ts`**

```ts
/* LCU assignedPosition → display role (prototype uses Top/Jungle/Mid/Bot/Support) */
export type DisplayRole = "Top" | "Jungle" | "Mid" | "Bot" | "Support"

const BY_POSITION: Record<string, DisplayRole> = {
	top: "Top",
	jungle: "Jungle",
	middle: "Mid",
	bottom: "Bot",
	utility: "Support",
}

export function displayRole(assignedPosition: string): DisplayRole | null {
	return BY_POSITION[assignedPosition] ?? null
}

export const ROLE_ABBR: Record<DisplayRole, string> = {
	Top: "TOP",
	Jungle: "JNG",
	Mid: "MID",
	Bot: "BOT",
	Support: "SUP",
}

/* role-glyph dot positions on the diagonal (champ-art.jsx:468) */
export const ROLE_GLYPH_POS: Record<DisplayRole, [number, number]> = {
	Top: [6, 6],
	Jungle: [9, 14],
	Mid: [12, 12],
	Bot: [18, 18],
	Support: [15, 19],
}
```

- [ ] **Step 3: Write `src/renderer/src/lib/time.ts`**

```ts
/* "2d ago"-style labels for note timestamps (prototype data.js `updated`) */
export function timeAgo(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime()
	const m = Math.floor(ms / 60_000)
	if (m < 1) return "just now"
	if (m < 60) return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h ago`
	const d = Math.floor(h / 24)
	if (d < 7) return `${d}d ago`
	const w = Math.floor(d / 7)
	return `${w}w ago`
}
```

- [ ] **Step 4: Write `src/renderer/src/lib/rank-format.ts`** (display + PHASE-1 GLUE spread math)

```ts
import type { RankInfo } from "@/shared/types"

/* tier metadata — tint colors from data.js:59-70, LCU-uppercase keys */
export const TIERS: Record<string, { idx: number; color: string; label: string }> = {
	IRON: { idx: 0, color: "#6b6258", label: "Iron" },
	BRONZE: { idx: 1, color: "#9c6b43", label: "Bronze" },
	SILVER: { idx: 2, color: "#9aa6ad", label: "Silver" },
	GOLD: { idx: 3, color: "#e0b441", label: "Gold" },
	PLATINUM: { idx: 4, color: "#4fb6a6", label: "Platinum" },
	EMERALD: { idx: 5, color: "#46c279", label: "Emerald" },
	DIAMOND: { idx: 6, color: "#7aa2ff", label: "Diamond" },
	MASTER: { idx: 7, color: "#c77dff", label: "Master" },
	GRANDMASTER: { idx: 8, color: "#ff6b5e", label: "Grandmaster" },
	CHALLENGER: { idx: 9, color: "#d6ff66", label: "Challenger" },
}

const DIV_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }

/* PHASE-1 GLUE — replaced by src/shared/lib/rank.ts in Phase 7 */
export function rankScore(rank: RankInfo | null): number {
	if (!rank || !TIERS[rank.tier]) return -1
	return TIERS[rank.tier].idx * 4 + (4 - (DIV_NUM[rank.division] ?? 4))
}

export function formatRank(rank: RankInfo | null): string {
	if (!rank || !TIERS[rank.tier]) return "Unranked"
	return `${TIERS[rank.tier].label} ${rank.division}`
}
```

- [ ] **Step 5: Write `src/renderer/src/hooks/use-champ-select.ts`**

The one composite hook (spec §3.4). Complete code:

```ts
import { useMemo } from "react"

import type {
	BanListEntry,
	ChampionStatic,
	MatchupNote,
	RankInfo,
	SummonerSpellStatic,
} from "@/shared/types"
import { rankScore } from "@renderer/lib/rank-format"
import { type DisplayRole, displayRole } from "@renderer/lib/roles"
import { useBanList, useDDragon, useNotes, useSettings, useTeamRanks } from "./use-data"
import { useChampSelectSession } from "./use-lcu"

export interface SpellRec {
	pair: [SummonerSpellStatic, SummonerSpellStatic] | null
	source: "pinned" | "default"
	rolePending: boolean
}
export interface BanRowVM {
	championId: number
	champion: ChampionStatic | null
	reason?: string
	status: "open" | "banned" | "picked"
	threat: boolean
}
export interface TeamRowVM {
	cellId: number
	champion: ChampionStatic | null
	role: DisplayRole | null
	name: string
	rank: RankInfo | null
	you: boolean
}
export interface ChampSelectVM {
	subPhase: "ban" | "pick"
	secondsLeft: number
	phaseTotal: number
	timerVisible: boolean
	enemyHidden: boolean
	me: {
		champion: ChampionStatic | null
		role: DisplayRole | null
		rolePending: boolean
		name: string
	}
	opponent: ChampionStatic | null // visible enemy in my lane (matchup target)
	spells: SpellRec
	note: MatchupNote | null
	banRows: BanRowVM[]
	goneCount: number
	team: TeamRowVM[]
	ranksAvailable: boolean
	mismatch: boolean
}

/* PHASE-1 GLUE — replaced by src/shared/lib/spells.ts in Phase 6 */
const DEFAULT_SECOND_SPELL: Record<string, number> = {
	jungle: 11, // Smite
	top: 12, // Teleport
	middle: 12, // Teleport
	bottom: 7, // Heal
	utility: 14, // Ignite
	"": 14, // Ignite
}
const FLASH = 4

export function useChampSelect(): ChampSelectVM | null {
	const session = useChampSelectSession()
	const { data: bundle } = useDDragon()
	const { data: notes } = useNotes()
	const { data: banlist } = useBanList()
	const { data: settings } = useSettings()
	const myPuuids = useMemo(
		() => (session ? session.myTeam.map((p) => p.puuid).filter(Boolean) : []),
		[session],
	)
	const { data: ranks } = useTeamRanks(myPuuids)

	return useMemo(() => {
		if (!session || !bundle) return null
		const champ = (id: number): ChampionStatic | null => bundle.championsByKey[id] ?? null
		const spell = (id: number): SummonerSpellStatic | null => bundle.spellsByKey[id] ?? null

		const me = session.myTeam.find((p) => p.cellId === session.localPlayerCellId)
		if (!me) return null

		const role = displayRole(me.assignedPosition)
		const rolePending = !role

		// sub-phase from actions: any in-progress ban → ban (PHASE-1 GLUE, Phase 4 refines)
		const flat = session.actions.flat()
		const subPhase: "ban" | "pick" = flat.some((a) => a.type === "ban" && a.isInProgress)
			? "ban"
			: "pick"

		const enemyVisible = session.theirTeam.filter((p) => p.championId > 0)
		const enemyHidden = enemyVisible.length === 0
		// matchup target: same assignedPosition if known, else first visible enemy
		const laneOpponent =
			enemyVisible.find((p) => p.assignedPosition === me.assignedPosition) ?? enemyVisible[0] ?? null
		const opponent = laneOpponent ? champ(laneOpponent.championId) : null

		// PHASE-1 GLUE — replaced by src/shared/lib/notes-match.ts in Phase 5
		const matching = (notes ?? [])
			.filter(
				(n) =>
					n.championId === me.championId &&
					(n.opponentChampionId == null ||
						enemyVisible.some((p) => p.championId === n.opponentChampionId)),
			)
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
		const note = matching[0] ?? null

		// PHASE-1 GLUE — replaced by src/shared/lib/spells.ts in Phase 6
		const pinned = note?.pinnedSpells
		const pairIds: [number, number] =
			pinned && spell(pinned[0]) && spell(pinned[1])
				? pinned
				: [FLASH, DEFAULT_SECOND_SPELL[me.assignedPosition] ?? 14]
		const s0 = spell(pairIds[0])
		const s1 = spell(pairIds[1])
		const spells: SpellRec = {
			pair: s0 && s1 ? [s0, s1] : null,
			source: pinned ? "pinned" : "default",
			rolePending,
		}

		// PHASE-1 GLUE — replaced by src/shared/lib/bans.ts in Phase 6
		const bannedIds = new Set([...session.bans.myTeamBans, ...session.bans.theirTeamBans])
		const pickedIds = new Set(
			[...session.myTeam, ...session.theirTeam].map((p) => p.championId).filter((id) => id > 0),
		)
		const visibleEnemyIds = new Set(enemyVisible.map((p) => p.championId))
		const rows: BanRowVM[] = [...(banlist ?? [])]
			.sort((a, b) => a.priority - b.priority)
			.map((e: BanListEntry) => ({
				championId: e.championId,
				champion: champ(e.championId),
				reason: e.reason,
				status: bannedIds.has(e.championId)
					? ("banned" as const)
					: pickedIds.has(e.championId)
						? ("picked" as const)
						: ("open" as const),
				threat: visibleEnemyIds.has(e.championId),
			}))
			.sort((a, b) => Number(b.threat) - Number(a.threat))

		const team: TeamRowVM[] = session.myTeam.map((p) => ({
			cellId: p.cellId,
			champion: champ(p.championId),
			role: displayRole(p.assignedPosition),
			name: p.gameName ?? `Summoner ${p.summonerId}`,
			rank: ranks?.[p.puuid] ?? null,
			you: p.cellId === session.localPlayerCellId,
		}))
		// teammates only — your own rank is always present, so it can't count as "available"
		const ranksAvailable = team.some((t) => !t.you && t.rank != null)

		// PHASE-1 GLUE — replaced by src/shared/lib/rank.ts in Phase 7
		const scores = team.map((t) => rankScore(t.rank)).filter((s) => s >= 0)
		const spread = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0
		const mismatch = ranksAvailable && spread >= (settings?.rankDiffThreshold ?? 8)

		return {
			subPhase,
			secondsLeft: Math.max(0, Math.ceil(session.timer.adjustedTimeLeftInPhase / 1000)),
			phaseTotal: Math.max(1, Math.round(session.timer.totalTimeInPhase / 1000)),
			timerVisible: !session.timer.isInfinite,
			enemyHidden,
			me: { champion: champ(me.championId), role, rolePending, name: me.gameName ?? "" },
			opponent,
			spells,
			note,
			banRows: rows,
			goneCount: rows.filter((r) => r.status !== "open").length,
			team,
			ranksAvailable,
			mismatch,
		}
	}, [session, bundle, notes, banlist, settings, ranks])
}
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

```bash
git add src/renderer/src/lib src/renderer/src/hooks/use-champ-select.ts
git commit -m "feat: add champ-select view-model hook and display libs"
```

---

## Task 7: App shell — window frame, sidebar, root layout

**Read first:** `app.jsx:7-79` (AppMark/Wordmark), `app.jsx:223-349` (Sidebar + PHASE_SUB), `app.jsx:351-449` (WindowFrame), `app.jsx:857-928` (composition), `champ-art.jsx:510-545` (ConnectionIndicator). Screenshot: `screenshots/idle.png`, `screenshots/disconnected.png`.

**Files:**
- Create: `src/renderer/src/components/app/wordmark.tsx` (AppMark gem SVG + wordmark — port the SVG verbatim from `app.jsx:9-79`)
- Create: `src/renderer/src/components/app/connection-indicator.tsx`
- Create: `src/renderer/src/components/app/window-frame.tsx`
- Create: `src/renderer/src/components/app/sidebar.tsx`
- Modify: `src/renderer/src/routes.tsx` (RootLayout rewrite)
- Modify: `src/main/index.ts` (window size to design: 1080×740)

Structural notes (the handoff carries the exact styling):

1. **Real chrome replaces painted chrome.** No `FaintClient`, no painted traffic-light dots. The titlebar is a `header.region-drag` strip, **36px tall** (`app.jsx:377`), with a left spacer `w-[120px]` clearing the real `hiddenInset` traffic lights (`trafficLightPosition x:20,y:20` in `src/main/index.ts`); center = wordmark (`mark={false}`) + `·` + phase sub-label in mono; right = compact `ConnectionIndicator` + clock (15s interval). Interactive children get `region-no-drag`.
2. **Sidebar** is an `aside` 198px wide (`app.jsx:240`), bg `--bg-surface`, right border. Nav items: Live (with phase sub-label + connection dot), Notes, Settings — `nav > button` list, active item gets `bg-hover` + left accent bar (2.5×18px, `app.jsx:281-294`). Footer: `ConnectionIndicator` + "LCU · 127.0.0.1" / "retrying every 2s…" mono caption. Navigation uses TanStack Router `useNavigate()`/`useMatchRoute()` instead of prototype's `setNav`.
3. **PHASE_SUB mapping** lives in the sidebar module and maps from `GameflowPhase` (not prototype strings):

```ts
import type { GameflowPhase } from "@/shared/types"

export function phaseSub(connected: boolean, phase: GameflowPhase): string {
	if (!connected) return "Disconnected"
	if (phase === "ReadyCheck") return "Ready Check"
	if (phase === "ChampSelect") return "Champ Selection"
	return "Idle"
}
```

4. **RootLayout** (in `routes.tsx`) becomes:

```tsx
function RootLayout(): React.JSX.Element {
	const { connected } = useLcuStatus()
	const phase = usePhase()
	return (
		<WindowFrame connected={connected} phase={phase}>
			<div className="flex min-h-0 flex-1">
				<Sidebar connected={connected} phase={phase} />
				<main className="relative min-w-0 flex-1 overflow-hidden bg-ink-950">
					<div className="ccp-screen absolute inset-0 p-4">
						<Outlet />
					</div>
				</main>
			</div>
			{import.meta.env.DEV ? <StateSwitcher /> : null}
		</WindowFrame>
	)
}
```

(`StateSwitcher` is created in Task 8 — add the import then; in this task render without it and add a `{/* dev switcher mounts here (Task 8) */}` placeholder comment instead.)

5. **Window size** in `src/main/index.ts`: change `width: 1320, height: 700` → `width: 1080, height: 740` (prototype frame, `app.jsx:894-899`); keep min 850×500.

- [ ] **Step 1: Build wordmark.tsx, connection-indicator.tsx** (port SVG/styles from handoff)
- [ ] **Step 2: Build window-frame.tsx, sidebar.tsx** (structure above, styling from handoff)
- [ ] **Step 3: Rewrite RootLayout in routes.tsx; resize window in main/index.ts**
- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm format`, then `pnpm dev` + Playwright MCP.
Expected: sidebar + titlebar render per `screenshots/idle.png` chrome (content area still stubbed); fake bridge default scenario = champ select, so sidebar Live sub-label reads "Champ Selection"; connection dot green-ish (online).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/app src/renderer/src/routes.tsx src/main/index.ts
git commit -m "feat: build app shell — window frame, sidebar, root layout"
```

---

## Task 8: Dev state switcher

**Read first:** `app.jsx:451-503` (Seg/DemoLabel), `app.jsx:505-684` (DemoBar contents).

**Files:**
- Create: `src/renderer/src/components/dev/state-switcher.tsx`
- Modify: `src/renderer/src/routes.tsx` (mount it)

Structural notes:
1. DEV-only (`import.meta.env.DEV` guard at the mount site; the module imports from `@renderer/api/fake/bridge`, which only exists in dev bundles).
2. It's an in-window **collapsible bottom bar** (`footer` element, fixed to the bottom of the content area, above screens, styled like `app.jsx:508-520`: `rgba(14,16,18,0.9)` bg, border, 12px radius, small "Prototype / Drive the client state" label block). Collapsed state = a small pill bottom-right with a `play` icon; clicking expands.
3. Controls (all `Seg`-style segmented buttons, labels from DemoBar):
   - **Client:** Disconnected · Idle · Ready Check · Champ Selection → `setScenario({ phase })`
   - phase `ready`: **Auto-accept** toggle → `useSetSettings().mutate({ autoAccept })`; **Show fired** toggle → `setScenario({ autoAcceptFired })`
   - phase `select`: **Phase** Live/Ban/Pick → `setScenario({ csSubPhase: null | "ban" | "pick" })`; **Enemy** Auto/Hidden/Shown → `enemyHidden: null|true|false`; **Ranks** OK/N-A → `ranksAvailable`; **Note** Has/None → `hasNote`; **Role** Set/Pending → `roleAssigned`
   - **Force fake** toggle: flips `localStorage["lockin:forceFake"]` between `"1"`/removed, then `window.location.reload()` (api source is resolved at module init).
4. After every `setScenario` call, invalidate fixture-backed queries:

```ts
const qc = useQueryClient()
const drive = (next: Partial<ScenarioState>) => {
	setScenario(next)
	qc.invalidateQueries({ queryKey: ["notes"] })
	qc.invalidateQueries({ queryKey: ["ranks"] })
}
```

5. Local `useState` for collapse + a `useState(getScenario())` snapshot updated on every `drive()` call (the switcher is the only writer, so no subscription is needed).

- [ ] **Step 1: Build state-switcher.tsx per the structure above**
- [ ] **Step 2: Mount in RootLayout (replace the Task 7 placeholder), guard with `import.meta.env.DEV`**
- [ ] **Step 3: Verify**

`pnpm dev` + Playwright MCP: switch Client through all 4 phases — sidebar sub-label + connection dot + titlebar react accordingly (screens themselves still stubs). Toggle Note/Ranks/Role and confirm no errors.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/dev src/renderer/src/routes.tsx
git commit -m "feat: add dev state switcher driving the fake bridge"
```

---

## Task 9: Shared UI primitives

**Read first:** `primitives.jsx` (all — Button kinds/sizes, Input, SearchField, Toggle, Pill, Card, AfterLine, Eyebrow, EmptyState).

**Files:**
- Modify: `src/renderer/src/components/ui/button.tsx` (restyle variants: `default`→primary accent, `secondary`, `ghost`, `destructive`→danger outline; sizes sm/md/lg = 28/34/42px per `primitives.jsx:215-219`)
- Modify: `src/renderer/src/components/ui/switch.tsx` (restyle to 38×22 accent toggle, `primitives.jsx:385-418`)
- Create: `src/renderer/src/components/app/card.tsx` (bg-raised + border + r-md; `hover` and `emphasis` (accent ring + glow) props — `primitives.jsx:455-476`)
- Create: `src/renderer/src/components/app/eyebrow.tsx` (Eyebrow + AfterLine accent dash — `primitives.jsx:479-512`)
- Create: `src/renderer/src/components/app/pill.tsx` (tones: neutral/accent/info/warn/fail, optional dot/icon — `primitives.jsx:421-452`)
- Create: `src/renderer/src/components/app/empty-state.tsx` (`primitives.jsx:516-564`)
- Create: `src/renderer/src/components/app/search-field.tsx` (`primitives.jsx:330-382`)
- Create: `src/renderer/src/components/app/text-input.tsx` (Input/textarea with accent focus ring — `primitives.jsx:299-327`)
- Create: `src/renderer/src/components/app/segmented.tsx` (`settings.jsx:43-78`)

Structural notes:
- Icons: use **lucide-react** (CLAUDE.md). Mapping from prototype names: activity→`Activity`, book→`BookOpen`, settings→`Settings`, wifioff→`WifiOff`, plus→`Plus`, search→`Search`, x→`X`, check→`Check`, chevup/chevdown/chevright→`ChevronUp/ChevronDown/ChevronRight`, alert→`TriangleAlert`, trash→`Trash2`, edit→`SquarePen`, pin→`Pin`, shield→`Shield`, eyeoff→`EyeOff`, help→`CircleHelp`, sparkle→`Sparkles`, play→`Play`, grip→`GripVertical`.
- Every component typed props, semantic elements (`button`, `label`, `input`), Tailwind tokens from Task 2 (e.g. `bg-ink-850 border-[var(--stroke-default)] rounded-md`).
- Keep each file well under 300 lines.

- [ ] **Step 1: Restyle button.tsx + switch.tsx**
- [ ] **Step 2: Build card, eyebrow, pill, empty-state, search-field, text-input, segmented**
- [ ] **Step 3: Verify**

`pnpm typecheck && pnpm format` clean. (Visual verification happens as screens consume these in Tasks 11–15.)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/ui src/renderer/src/components/app
git commit -m "feat: add shared UI primitives styled to the design system"
```

---

## Task 10: Game-art components

**Read first:** `champ-art.jsx` (all). **Omit** ItemIcon/ItemRow entirely (spec D2).

**Files:**
- Create: `src/renderer/src/components/game/champion-portrait.tsx`
- Create: `src/renderer/src/components/game/spell-icon.tsx`
- Create: `src/renderer/src/components/game/spell-pair.tsx`
- Create: `src/renderer/src/components/game/countdown-ring.tsx`
- Create: `src/renderer/src/components/game/rank-badge.tsx`
- Create: `src/renderer/src/components/game/role.tsx`
- Create: `src/renderer/src/components/game/badges.tsx`

Structural notes (props bind to PRD types — these components never fetch):

```tsx
// champion-portrait.tsx — hidden/unknown variant = dashed "?" tile (champ-art.jsx:15-43)
export interface ChampionPortraitProps {
	champion: ChampionStatic | null // null → hidden/unknown variant
	version: string // bundle.version for the icon URL
	size?: number
	hidden?: boolean
	dim?: boolean
	ring?: boolean // accent ring (your champion)
	className?: string
}
// img onError → fallback tile: championFallbackColor(champion.key) bg + initials (champ-art.jsx:44-95)
```

```tsx
// spell-icon.tsx — keyHint chip bottom-right (champ-art.jsx:100-158)
export interface SpellIconProps {
	spell: SummonerSpellStatic | null
	version: string
	size?: number
	keyHint?: "D" | "F"
}

// spell-pair.tsx — D/F order from AppSettings["spellSlotLayout"]:
// "DF" → pair[0] gets D, pair[1] gets F; "FD" → swapped render order (champ-art.jsx:161-174)
export interface SpellPairProps {
	pair: [SummonerSpellStatic, SummonerSpellStatic] | null
	version: string
	layout: "DF" | "FD"
	size?: number
	showKeys?: boolean
	gap?: number
}
```

- `countdown-ring.tsx`: port the SVG ring exactly (`champ-art.jsx:243-326`) — props `{ progress, size, stroke, tone: "accent"|"warn"|"fail", value?: React.ReactNode, label?, sub?, pulsing? }`, 980ms linear dashoffset transition, display-serif value.
- `rank-badge.tsx`: `RankEmblem` (diamond SVG tinted by `TIERS[tier].color`) + `RankBadge` `{ rank: RankInfo | null, size?: "sm" | "md" }` using `formatRank`/`TIERS` from `lib/rank-format.ts`; unranked = dashed box + "Unranked"; md shows LP line (`champ-art.jsx:329-393`).
- `role.tsx`: `RoleGlyph` (diagonal + dot via `ROLE_GLYPH_POS`) + `RoleTag` `{ role: DisplayRole, active? }` (`champ-art.jsx:467-508`).
- `badges.tsx`: `YourPickBadge` (pin icon, accent pill, "Your pick"), `ThreatBadge` (alert icon, fail pill, "Threat"), `MismatchFlag` (alert icon + "Rank spread", warn — never color-only) (`champ-art.jsx:395-465`).

- [ ] **Step 1: Build all seven files per the props above, styling from champ-art.jsx**
- [ ] **Step 2: Verify**

`pnpm typecheck && pnpm format` clean.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/game
git commit -m "feat: add game-art components (portraits, spells, ring, ranks, roles, badges)"
```

---

## Task 11: Live switchboard + Disconnected + Idle

**Read first:** `live-view.jsx:8-91` (Disconnected), `live-view.jsx:93-161` (Idle), `live-view.jsx:307-349` (switch). Screenshots: `disconnected.png`, `idle.png`.

**Files:**
- Modify: `src/renderer/src/pages/home.tsx` (the `/` live switchboard)
- Create: `src/renderer/src/components/live/disconnected.tsx`
- Create: `src/renderer/src/components/live/idle.tsx`
- Modify: `src/renderer/src/routes.tsx` (notes route gets editor search params — see step 2)

- [ ] **Step 1: Rewrite `pages/home.tsx`** (PRD §12 phase → view)

```tsx
import { ChampSelectScreen } from "@renderer/components/champ-select/champ-select-screen"
import { Disconnected } from "@renderer/components/live/disconnected"
import { Idle } from "@renderer/components/live/idle"
import { ReadyCheckScreen } from "@renderer/components/ready-check/ready-check-screen"
import { useLcuStatus, usePhase } from "@renderer/hooks/use-lcu"

export function HomePage(): React.JSX.Element {
	const { connected } = useLcuStatus()
	const phase = usePhase()
	if (!connected) return <Disconnected />
	if (phase === "ReadyCheck") return <ReadyCheckScreen />
	if (phase === "ChampSelect") return <ChampSelectScreen />
	return <Idle />
}
```

(Until Tasks 12–13 land, stub `ReadyCheckScreen`/`ChampSelectScreen` imports by creating the two files with `return <main className="h-full" />` placeholders inside their final paths — they get real content in their tasks.)

- [ ] **Step 2: Add editor deep-link search params to the notes route in `routes.tsx`**

```tsx
const notesRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/notes",
	component: NotesPage,
	validateSearch: (search: Record<string, unknown>): { new?: boolean; edit?: string } => ({
		new: search.new === true || search.new === "true" ? true : undefined,
		edit: typeof search.edit === "string" ? search.edit : undefined,
	}),
})
```

- [ ] **Step 3: Build `disconnected.tsx`** — pure presentational `section`: halo rings (`ccp-halo`, `ccp-halo-2`) around breathing `WifiOff` tile, display-serif headline "Waiting for the League client…", body copy, "Listening on 127.0.0.1" mono caption (`live-view.jsx:9-91`).

- [ ] **Step 4: Build `idle.tsx`** — hero `Card` ("Connected · standing by" eyebrow, display-serif headline, copy, primary "New note" button → `navigate({ to: "/notes", search: { new: true } })`); "Recent notes" eyebrow row with "Manage ban list" link-button → `/settings`; 2-col grid of the 4 most-recent `NoteCard`s (full variant — Task 14 component; until then render a simple bordered placeholder card with name+body and a `{/* NoteCard lands in Task 14 */}` comment, then swap during Task 14).

- [ ] **Step 5: Verify**

`pnpm dev` + Playwright MCP: switcher → Disconnected matches `disconnected.png` (halo animation, copy); switcher → Idle matches `idle.png` layout (hero + recent grid). Navigation: New note → `/notes?new=true`; Manage ban list → `/settings`.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/pages/home.tsx src/renderer/src/components/live src/renderer/src/components/champ-select src/renderer/src/components/ready-check src/renderer/src/routes.tsx
git commit -m "feat: add live switchboard with disconnected and idle screens"
```

---

## Task 12: Ready-check screen

**Read first:** `live-view.jsx:163-305`. Screenshots: `ready.png`, `ready-waiting.png`.

**Files:**
- Modify: `src/renderer/src/components/ready-check/ready-check-screen.tsx` (replace Task 11 stub)

Structural notes:
1. Data: `useReadyCheck()` (push), `useSettings()`, `useAcceptReadyCheck()`/`useDeclineReadyCheck()` mutations. **No local countdown state** — remaining seconds derive from the payload: `READY_CHECK_TOTAL = 12`, `left = Math.max(0, 12 - readyCheck.timer)`.
2. View states map from the payload (not local state machine):
   - `playerResponse === "Accepted"` → accepted view (ring `progress={1}`, check icon, "Match accepted", sub-copy switches on `settings.autoAccept` — `live-view.jsx:190-221`)
   - `playerResponse === "Declined"` → declined view ("Declined" / "Back to the queue.")
   - `state === "Invalid"` → missed view ("Missed")
   - else waiting: big `CountdownRing` (size 188, stroke 9, `tone={left <= 3 ? "warn" : "accent"}`, pulsing at ≤3), headline `settings.autoAccept ? "Auto-accepting…" : "Match found — accept?"`, mono sub-line, Accept (primary, check) / Decline (danger, x) buttons calling the mutations (`live-view.jsx:249-303`).
3. `readyCheck == null` → render nothing (`null`) — the switchboard only routes here during ReadyCheck, but pushes can race (PRD §6.4 edge: vanish cleanly).
4. Semantic structure: `section` with `h1` for the headline.

- [ ] **Step 1: Implement the screen per above; styling from live-view.jsx**
- [ ] **Step 2: Verify**

Playwright MCP, switcher → Ready Check: waiting view counts 12→0 then flips to Missed; Accept button → accepted view; Decline → declined; "Show fired" toggle → accepted view with auto-accept copy; auto-accept toggle changes headline copy. Compare `ready.png` / `ready-waiting.png`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/ready-check
git commit -m "feat: add ready-check screen with payload-driven countdown"
```

---

## Task 13: Champ select — regions

**Read first:** `champ-select-parts.jsx` (all), `champ-select.jsx:169-199` (rail branch ONLY). Screenshots: `v3-rail.png`, `rail-ban.png`, `cs-stacked-ban2.png` (region details), `cs-check.png`.

**Files:**
- Create: `src/renderer/src/components/champ-select/section.tsx`
- Create: `src/renderer/src/components/champ-select/header-strip.tsx`
- Create: `src/renderer/src/components/champ-select/notes-region.tsx`
- Create: `src/renderer/src/components/champ-select/bans-region.tsx`
- Create: `src/renderer/src/components/champ-select/team-region.tsx`
- Modify: `src/renderer/src/components/champ-select/champ-select-screen.tsx` (replace stub)

All regions consume the `ChampSelectVM` from Task 6 — props are slices of it, never raw session. The rail layout always uses the **compact** header (`champ-select.jsx:104`).

Structural notes per file:

1. **section.tsx** — Card + eyebrow header + optional `right` slot + scrollable body (`champ-select-parts.jsx:20-61`). Props `{ label, right?, emphasis?, grow?, scroll?, children }`.

2. **header-strip.tsx** — compact variant only: portrait (46px, accent ring) + name + role (`RoleTag` or warn "Role pending" chip `champ-select-parts.jsx:115-135`) + summoner name; divider; `SpellPair` (32px, showKeys, layout from settings) **with `YourPickBadge` beside the spells when `vm.spells.source === "pinned"`** (PRD §6.1: pinned values labeled "Your pick"; rail has no Loadout card so the label lives here); right side: phase label ("Ban phase"/"Pick phase", warn at ≤10s) over `CountdownRing` (54px, value=secondsLeft, `progress = secondsLeft / phaseTotal`, warn tone + pulsing when ≤10) — `champ-select-parts.jsx:64-228` minus the demo `onAdvance` button (timer auto-cycles via the fake). Hide the ring when `!vm.timerVisible` (isInfinite edge).
   Props: `{ me: VM["me"], spells: VM["spells"], layout: "DF"|"FD", version: string, subPhase, secondsLeft, phaseTotal, timerVisible }`.

3. **notes-region.tsx** — three bodies (`champ-select-parts.jsx:231-320`): enemyHidden → EyeOff + "Enemy laner not revealed yet" + champion-name copy; note → compact editable `NoteCard` (inline textarea on Edit toggle; `onChangeBody` debounce-saves via `useUpsertNote` — fire mutation on Done click, not per keystroke); no note → "No note yet for X vs Y" + primary "Add a note" → `navigate({ to: "/notes", search: { new: true } })`. Section `emphasis` when a note shows; `right` shows `timeAgo(note.updatedAt)`.

4. **bans-region.tsx** — `BanRow` per `BanRowVM`: portrait (dim when gone) + name (strikethrough when gone) + `ThreatBadge` when `threat && !enemyHidden` + reason line + status caption Open/Banned/Picked, fail-tinted row bg for visible threats (`champ-select-parts.jsx:399-458`); header right "N/M gone". Collapsed variant (pick phase): clickable Card row "Ban phase complete · N of your targets gone" with chevron (`champ-select-parts.jsx:468-492`); local `collapsed` state initialized/flipped on `subPhase` change (`useEffect` on `vm.subPhase`: pick → collapsed true). Empty ban list → `EmptyState` "Your ban list is empty" + ghost button "Manage ban list" → `/settings` (PRD §6.3 edge).

5. **team-region.tsx** — `TeamRow` per `TeamRowVM`: `RoleGlyph` + portrait (ring when you) + name (+" (you)", accent) + champion caption + `RankBadge` sm or "—" (`champ-select-parts.jsx:516-547`); header right: `MismatchFlag` when `vm.mismatch`, else neutral "Ranks unavailable" pill (WifiOff icon) when `!vm.ranksAvailable` (`champ-select-parts.jsx:563-571`).

6. **champ-select-screen.tsx** — rail grid `grid-cols-[1fr_314px]` (`champ-select.jsx:171-199`): left column = header + NotesRegion (grow); right column = ban phase ? (TeamRegion fixed + BansRegion grow) : (TeamRegion grow + BansRegion fixed/collapsed). `useChampSelect()`; `vm == null` → `null`. Gap/padding: cozy density (`gap 14 / pad 16`, `champ-select-parts.jsx:9-17` — D14 fixes cozy; no density prop anywhere).

- [ ] **Step 1: Build section.tsx + header-strip.tsx; verify header against `v3-rail.png` top-left**
- [ ] **Step 2: Build notes-region.tsx, bans-region.tsx, team-region.tsx**
- [ ] **Step 3: Assemble champ-select-screen.tsx rail grid**
- [ ] **Step 4: Verify the full state matrix (Playwright MCP)**

| Switcher state | Expected |
|---|---|
| Select + Phase Ban | bans expanded in right rail, enemy auto-hidden, notes region shows "not revealed", threat badges hidden, Camille row "Banned" struck |
| Select + Phase Pick | bans collapse to "Ban phase complete" row; enemy visible; Fiora threat badge + fail tint, Yasuo "Picked"; notes region shows the Aatrox-vs-Fiora note with accent emphasis |
| Enemy Shown (ban) | threat badge visible during ban |
| Note None | "No note yet for Aatrox vs Fiora" + Add a note CTA |
| Role Pending | warn "Role pending" chip; spells fall back to Flash+Ignite ("default" source — no Your pick badge) |
| Ranks N/A | all "—" except you; "Ranks unavailable" pill; no mismatch flag |
| Ranks OK | Diamond-vs-Gold spread (12) ≥ 8 → MismatchFlag shows |
| Timer | counts down each second; ring warns ≤10s; phase auto-cycles on Live |

Compare against `v3-rail.png` (pick) and `rail-ban.png` (ban).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/champ-select
git commit -m "feat: build champ-select rail screen (header, notes, bans, team regions)"
```

---

## Task 14: Notes library + editor

**Read first:** `components.jsx:8-253` (NoteTitle/NoteCard), `components.jsx:256-451` (ChampionPicker), `notes.jsx` (all). Screenshots: `notes.png`, `notes-taller.png`, `note-editor.png`.

**Files:**
- Create: `src/renderer/src/components/notes/note-card.tsx` (NoteTitle + full/compact/empty variants — compact already consumed by Task 13; build both here and update Task 13's import if a temporary inline version was used)
- Create: `src/renderer/src/components/app/champion-picker.tsx` (combobox: trigger w/ portrait, dropdown w/ search + role abbr; champions list = `Object.values(bundle.championsByKey)` sorted by name)
- Create: `src/renderer/src/components/notes/note-editor.tsx` (right drawer)
- Modify: `src/renderer/src/pages/notes.tsx`

Structural notes:
1. **note-card.tsx**: props bind to `MatchupNote` + `DDragonBundle` (resolve champions internally via `bundle.championsByKey`). Full variant: title row + 3-line-clamped body + footer `SpellPair` (20px, from `pinnedSpells`) + `timeAgo(updatedAt)` (`components.jsx:176-253`). **No items anywhere** (D2).
2. **note-editor.tsx**: overlay (`ccp-fade` backdrop) + 392px right drawer (`ccp-drawer`, `notes.jsx:38-65`), `form` semantics. Fields (`notes.jsx:101-164`): Champion (required, ChampionPicker), Opponent (optional, allowClear), Note textarea (7 rows, autofocus), **Pinned spells** chip-toggle row — all 9 fixture spells, max 2, selection order = D/F per `spellSlotLayout` ("Overrides the suggestion in the header" hint; chip shows D/F key letter when selected, `notes.jsx:130-164`). Footer: Delete (danger, edit-mode only) / Cancel / Create-Save (primary, disabled until champion + non-empty body). Draft state is local `useState<Partial<MatchupNote>>`; Save → `useUpsertNote().mutateAsync(draft)` then close; Delete → `useDeleteNote()`.
3. **pages/notes.tsx**: header (`h1` "Notes" + "N matchups" mono caption) + `SearchField` (248px) + primary "New note"; filtered 2-col grid (min row 186px); empty states per `notes.jsx:282-303` (no notes at all vs no search match). Search filter (renderer-side, D9): body + champion name + opponent name, case-insensitive. Editor opens from: card click (edit), New note button, or **route search params** (`?new=true` / `?edit=<id>` from Task 11) — on mount, consume params then clear them via `navigate({ search: {} })`.
4. Update `components/live/idle.tsx` to import and render the real `NoteCard` (replacing the Task 11 placeholder).

- [ ] **Step 1: Build note-card.tsx + champion-picker.tsx**
- [ ] **Step 2: Build note-editor.tsx + rewrite pages/notes.tsx; swap Idle's placeholder card**
- [ ] **Step 3: Verify (Playwright MCP)**

Library matches `notes.png` (6 cards, spells + age in footers). Search "fiora" → 1 card; "zzz" → "Nothing matches". New note: save disabled until champ+body; create → appears first (most recent); edit body → "just now"; delete → gone; pin 2 spells → chips show D/F, card footer shows pair. Idle recent-notes grid uses the real card. `/notes?new=true` (via Idle CTA) opens the editor pre-cleared.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/notes src/renderer/src/components/app/champion-picker.tsx src/renderer/src/pages/notes.tsx src/renderer/src/components/live/idle.tsx
git commit -m "feat: build notes library and editor drawer"
```

---

## Task 15: Settings screen

**Read first:** `settings.jsx` (all). Screenshots: `settings.png`, `v2-settings.png`.

**Files:**
- Create: `src/renderer/src/components/settings/settings-rows.tsx` (Group eyebrow+Card wrapper, Row title/desc/control — `settings.jsx:7-40`)
- Create: `src/renderer/src/components/settings/ban-editor.tsx`
- Modify: `src/renderer/src/pages/settings.tsx`

Structural notes:
1. **Match group** (`settings.jsx:265-291`): "Auto-accept ready check" `Switch` ↔ `settings.autoAccept`; "Auto-accept delay" `Segmented` Instant/2s/4s ↔ `autoAcceptDelayMs` 0/2000/4000 (desc copy switches on autoAccept). All writes via `useSetSettings().mutate({ … })`.
2. **Champ select group** (`settings.jsx:293-330`): "Summoner-spell keys" — two `SpellIcon`s (Flash, Teleport from the bundle, keyHints reflecting layout) + `Segmented` "D left"/"F left" ↔ `spellSlotLayout` "DF"/"FD"; "Rank-mismatch sensitivity" `Segmented` Relaxed/Balanced/Strict ↔ `rankDiffThreshold` 12/8/5.
3. **ban-editor.tsx** (`settings.jsx:81-239`): header eyebrow "Ban list · priority order" + "N champions"; rows: chevron up/down move buttons (disabled at ends) + index + portrait + name + inline reason input + trash remove; footer `ChampionPicker` (sm, "Add champion to ban list", excludes already-listed). All operations build the new array and call `useSetBanList().mutate(next)` (priorities renumber server-side per Task 4). Reason edits: local row state, mutate on blur. Empty state copy `settings.jsx:105-116`.
4. **pages/settings.tsx**: `h1` "Settings" + "Preferences · ban list" caption; scrollable column: Match group, Champ select group, BanEditor (`settings.jsx:242-335`). Loading: `useSettings().data` undefined → render nothing (data is local; resolves in one tick).

- [ ] **Step 1: Build settings-rows.tsx + pages/settings.tsx groups**
- [ ] **Step 2: Build ban-editor.tsx**
- [ ] **Step 3: Verify (Playwright MCP)**

Matches `settings.png`. Toggling auto-accept flips ready-check headline (switch scenario to Ready Check to confirm — settings flow through the fake). D/F segmented flips keyHints here AND spell order in champ-select header. Threshold Relaxed (12) → mismatch flag still shows (spread is exactly 12); Strict shows it; verify via switcher → Select. Ban editor: reorder Fiora below Darius → champ-select ban rail order follows (threat sort still lifts visible Fiora first in pick phase); add Renekton; remove Quinn; reason edit persists across navigation.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/components/settings src/renderer/src/pages/settings.tsx
git commit -m "feat: build settings screen with ban-list editor"
```

---

## Task 16: Full-matrix visual pass + Phase 1 exit

**Files:**
- Possibly small fixes across `src/renderer/src/**` (whatever the pass surfaces)

- [ ] **Step 1: Run the complete scenario matrix (Playwright MCP)**

Walk every switcher state × every route and compare against the handoff screenshots:

| # | State | Screenshot |
|---|---|---|
| 1 | Disconnected (Notes/Settings still navigable) | `disconnected.png` |
| 2 | Idle | `idle.png` |
| 3 | Ready Check waiting / auto-accept on / fired / declined / missed | `ready.png`, `ready-waiting.png` |
| 4 | Champ Select ban / pick / enemy shown / note none / role pending / ranks N-A / mismatch | `v3-rail.png`, `rail-ban.png` |
| 5 | Notes library / search / editor new / editor edit | `notes.png`, `note-editor.png` |
| 6 | Settings + ban editor | `settings.png` |

Also verify in the real Electron window (not just browser): traffic lights sit inside the titlebar, drag works on the titlebar, nav/buttons don't drag.

- [ ] **Step 2: Spec exit-criteria check (spec §7, Plan 1 row)**

- Looks/navigates like the design on fake data ✓/✗
- Every switcher state renders ✓/✗
- `pnpm typecheck` clean ✓/✗
- `pnpm format` clean ✓/✗

Fix anything that fails; re-run.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "polish: phase 1 visual pass fixes"
```

(Skip the commit if the pass surfaced nothing.)

---

## Self-review checklist (run after writing, before execution)

- **Spec coverage:** D2 (no items: editor, cards, champ select) Task 14/13 ✓ · D3 (rail only) Task 13 ✓ · D6 (LcuProvider, no Zustand, CLAUDE.md) Tasks 0/5 ✓ · D7 (no engines/vitest; glue marked) Task 6 ✓ · D8 (routes `/`,`/notes`,`/settings`) unchanged ✓ · D9 (renderer-side search) Task 14 ✓ · D13 (bundled fonts) Task 2 ✓ · D14 (crimson/cozy locked, no tweaks UI) Tasks 2/13 ✓ · D15 (hotlink + fallback + CSP) Tasks 2/10 ✓ · D16 (decline) Tasks 0/1/4/12 ✓ · dev switcher (spec §5.3) Task 8 ✓ · fake bridge/progressive merge (§3.2) Task 4 ✓
- **Type consistency:** `Api` names (Task 1) = fake bridge methods (Task 4) = hook calls (Task 5/6) · `ChampSelectVM` fields (Task 6) = region props (Task 13) · `ScenarioState` (Task 4) = switcher controls (Task 8)
- **Placeholders:** UI tasks intentionally defer pixel styling to named handoff lines (working agreement #1) — every step still names exact files, props, states, and verification.
