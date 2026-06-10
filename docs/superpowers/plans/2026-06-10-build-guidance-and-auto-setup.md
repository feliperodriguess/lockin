# Build Guidance, Auto Rune/Spell Setup, In-Game Screen & Tray — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Blitz-style build guidance to lockin — responsive champ-select that reflects hovered champions, opt-in auto-apply of recommended runes/spells, an In-Game build + skill-order screen, a "your mains" section, a sidebar identity, and a rich tray — sourced from the OP.GG feed via the LCU client API only.

**Architecture:** Recommendation data comes from OP.GG's keyless MCP feed behind a swappable `BuildProvider` (main process, disk-cached per patch); all client reads/writes go through the existing `league-connect` LCU service (spells via PATCH my-selection, runes via the perks page API, identity via current-summoner, in-game champion via gameflow session, queue start via lobby+matchmaking). The renderer stays pure UI: TanStack Query for request/response IPC, `LcuProvider` contexts for pushed live state, mock-first hooks so every screen is previewable in force-fake mode.

**Tech Stack:** Electron + electron-vite, React 19 + TypeScript (strict), Tailwind v4 + shadcn/ui, TanStack Query + Router, `league-connect@6.0.0-rc13`, `electron-store`, vitest, Biome.

**Build order:** Phase 1A (shared plumbing) → 1B (LCU writes + OP.GG provider) → 2 (sidebar + copy) → 3 (tray) → 4 (champ-select responsiveness + auto-setup) → 5 (in-game + mains) → 6 (PRD/CLAUDE + final verification).

---

## Phase 1A — Shared contracts, types, IPC, store, DDragon, provider context, fake/hooks/state-switcher

This phase lays down all the pure plumbing the rest of the build-guidance feature depends on: shared types, IPC channel names, the `Api` interface + preload bridge, persistence defaults, DDragon catalog normalizers for runes/items, renderer URL helpers, the live `LcuProvider` contexts, query/live hooks, and the mock fake layer (fixtures, scenario, bridge, dev state-switcher). It deliberately does **not** implement the real main-process LCU writes or the OP.GG provider — those land in Phase 1B — but it defines every type and signature they depend on.

Conventions for this repo (verified): tabs, no semicolons, double quotes, Tailwind-only styling with `cn()` for conditionals, path aliases `@/*` → `src/*` and `@renderer/*` → `src/renderer/src/*`. Tests are colocated `*.test.ts`, run with `pnpm test <file>`, written vitest-style (`import { describe, expect, it } from "vitest"`). After every code change run `pnpm typecheck` then `pnpm format`. Commits are granular and conventional with **no** `Co-Authored-By` trailer.

A note on the `Role` vs `DisplayRole` split: the design spec (§5) and the existing `lib/roles.ts` use `DisplayRole` (`"Top"|"Jungle"|...`), but the SHARED CONTRACT for this implementation pass defines a new lowercase `Role` (`"top"|"jungle"|"middle"|"bottom"|"utility"`) that matches the LCU `assignedPosition` strings. We follow the SHARED CONTRACT: new types use `Role`. The OP.GG position mapping (`top→TOP` etc.) is implemented in Phase 1B; here we only define the `Role` type and the data shapes.

---

### Task 1A.1 — Extend `src/shared/types.ts` with `Role`, build/summoner/in-game types, settings, snapshot, and bundle additions

**Files:**
- Modify: `src/shared/types.ts`

These are pure type declarations plus two `const` defaults (`DEFAULT_SETTINGS`, `DISCONNECTED_SNAPSHOT`) — there is no runtime logic to unit-test, so this task verifies via `pnpm typecheck`. Downstream tasks in this phase consume these types, so they get exercised by the suite as a whole.

- [ ] **Step 1: Add the `Role` type and the new domain interfaces.** Insert the `Role` type and the four new interfaces (`RunePageRec`, `ItemGroup`, `BuildRecommendation`, `SummonerIdentity`, `InGameState`) into `src/shared/types.ts`. Place them in the `// ---------- App domain (local) ----------` section, right after the `MatchupNote`/`BanListEntry` block and before `AppSettings`. Add this exact block immediately after the closing `}` of `BanListEntry` (line 106):

```ts
// ---------- Roles & build recommendation (OP.GG) ----------
export type Role = "top" | "jungle" | "middle" | "bottom" | "utility"

export interface RunePageRec {
	primaryStyleId: number
	subStyleId: number
	// exactly 9 in LCU order:
	// [keystone, p1, p2, p3, s1, s2, shard1, shard2, shard3]
	selectedPerkIds: number[]
	primaryName: string
	secondaryName: string
}

export interface ItemGroup {
	ids: number[]
	winRate?: number
	pickRate?: number
}

export interface BuildRecommendation {
	championKey: number
	role: Role
	patch: string
	winRate: number // 0..1
	sampleSize: number // total games
	runes: RunePageRec | null
	spells: [number, number] | null
	items: {
		starter: ItemGroup
		boots: ItemGroup
		core: ItemGroup // build-order sequence
		situational: ItemGroup // 4th/5th/6th merged + deduped
	}
	skillOrder: ("Q" | "W" | "E" | "R")[] // length 18; ability leveled at each level 1..18
	skillPriority: ("Q" | "W" | "E")[] // max-order priority, e.g. ["Q","E","W"]
}

export interface SummonerIdentity {
	gameName: string
	tagLine: string
	profileIconId: number
	summonerLevel: number
	puuid: string
}

export interface InGameState {
	championId: number
	spell1Id: number
	spell2Id: number
	queueId: number
}
```

- [ ] **Step 2: Extend `AppSettings` and `DEFAULT_SETTINGS`.** In the existing `AppSettings` interface (currently lines 109–114), add the four new fields. Replace:

```ts
export interface AppSettings {
	autoAccept: boolean // default false
	autoAcceptDelayMs: number // default 0
	spellSlotLayout: "DF" | "FD" // default "DF"
	rankDiffThreshold: number // division-steps delta to flag; default 8 (= 2 tiers)
}
```

with:

```ts
export interface AppSettings {
	autoAccept: boolean // default false
	autoAcceptDelayMs: number // default 0
	spellSlotLayout: "DF" | "FD" // default "DF"
	rankDiffThreshold: number // division-steps delta to flag; default 8 (= 2 tiers)
	autoRunes: boolean // default false — opt-in rune apply during champ select
	autoSpells: boolean // default false — opt-in spell apply during champ select
	buildTier: string // default "emerald_plus" — OP.GG tier bucket
	mains: { championId: number; role: Role }[] // default [] — configured main champions
}
```

Then replace the existing `DEFAULT_SETTINGS`:

```ts
export const DEFAULT_SETTINGS: AppSettings = {
	autoAccept: false,
	autoAcceptDelayMs: 0,
	spellSlotLayout: "DF",
	rankDiffThreshold: 8,
}
```

with:

```ts
export const DEFAULT_SETTINGS: AppSettings = {
	autoAccept: false,
	autoAcceptDelayMs: 0,
	spellSlotLayout: "DF",
	rankDiffThreshold: 8,
	autoRunes: false,
	autoSpells: false,
	buildTier: "emerald_plus",
	mains: [],
}
```

- [ ] **Step 3: Extend `LcuSnapshot` and `DISCONNECTED_SNAPSHOT`.** Replace the existing `LcuSnapshot` interface (currently lines 124–129):

```ts
export interface LcuSnapshot {
	connected: boolean
	phase: GameflowPhase
	readyCheck: ReadyCheck | null // stays null until Phase 3
	champSelect: ChampSelectSession | null // stays null until Phase 3 (timer) / 4 (full)
}
```

with:

```ts
export interface LcuSnapshot {
	connected: boolean
	phase: GameflowPhase
	readyCheck: ReadyCheck | null // stays null until Phase 3
	champSelect: ChampSelectSession | null // stays null until Phase 3 (timer) / 4 (full)
	summoner: SummonerIdentity | null // current-summoner identity when connected
	inGame: InGameState | null // populated only during InProgress
}
```

Then replace the existing `DISCONNECTED_SNAPSHOT`:

```ts
export const DISCONNECTED_SNAPSHOT: LcuSnapshot = {
	connected: false,
	phase: "None",
	readyCheck: null,
	champSelect: null,
}
```

with:

```ts
export const DISCONNECTED_SNAPSHOT: LcuSnapshot = {
	connected: false,
	phase: "None",
	readyCheck: null,
	champSelect: null,
	summoner: null,
	inGame: null,
}
```

- [ ] **Step 4: Extend `DDragonBundle` with `runesById` and `itemsById`.** Replace the existing `DDragonBundle` interface (currently lines 18–22):

```ts
export interface DDragonBundle {
	version: string
	championsByKey: Record<number, ChampionStatic>
	spellsByKey: Record<number, SummonerSpellStatic>
}
```

with:

```ts
export interface DDragonBundle {
	version: string
	championsByKey: Record<number, ChampionStatic>
	spellsByKey: Record<number, SummonerSpellStatic>
	runesById: Record<number, { id: number; key: string; name: string; icon: string }>
	itemsById: Record<number, { id: number; name: string; imageFull: string }>
}
```

- [ ] **Step 5: Verify and format.** Run `pnpm typecheck`. Expect it to report errors in `ddragon.ts` (it doesn't yet build `runesById`/`itemsById`), `store.ts` (defaults satisfied via `DEFAULT_SETTINGS`, should be fine), the fake `fixtures.ts` (`FIXTURE_BUNDLE` missing new bundle keys), and the preload snapshot helpers — these are expected and fixed in later tasks of this phase. Confirm there are **no** type errors *within `src/shared/types.ts` itself*. Then run `pnpm format`.

- [ ] **Step 6: Commit.**

```sh
git add src/shared/types.ts
git commit -m "feat(types): add Role, build recommendation, summoner, in-game, and settings types"
```

---

### Task 1A.2 — Add IPC channel constants

**Files:**
- Modify: `src/shared/constants.ts`

- [ ] **Step 1: Add the new channels to the `IPC` object.** Replace the entire contents of `src/shared/constants.ts` with:

```ts
export const IPC = {
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
	LCU_GET_SNAPSHOT: "lcu:getSnapshot",
	LCU_STATUS: "lcu:status",
	LCU_PHASE: "lcu:phase",
	LCU_READY_CHECK: "lcu:readyCheck",
	LCU_CHAMP_SELECT: "lcu:champSelect",
	LCU_SUMMONER: "lcu:summoner",
	LCU_IN_GAME: "lcu:inGame",
	NAV_GO: "nav:go",
	BUILD_GET: "build:get",
	LCU_SET_SPELLS: "lcu:setSpells",
	LCU_APPLY_RUNES: "lcu:applyRunes",
	LCU_START_QUEUE: "lcu:startQueue",
	LCU_STOP_QUEUE: "lcu:stopQueue",
} as const
```

- [ ] **Step 2: Verify and format.** Run `pnpm typecheck` (constants are referenced by later tasks; this file alone has no errors) then `pnpm format`.

- [ ] **Step 3: Commit.**

```sh
git add src/shared/constants.ts
git commit -m "feat(ipc): add channels for summoner, in-game, nav, build, and LCU writes"
```

---

### Task 1A.3 — Extend the `Api` interface

**Files:**
- Modify: `src/shared/api.ts`

- [ ] **Step 1: Import the new types and add the method signatures.** Replace the entire contents of `src/shared/api.ts` with:

```ts
import type {
	AppSettings,
	BanListEntry,
	BuildRecommendation,
	ChampSelectSession,
	DDragonBundle,
	GameflowPhase,
	InGameState,
	MatchupNote,
	RankInfo,
	ReadyCheck,
	RunePageRec,
	SummonerIdentity,
} from "./types"

export type Unsubscribe = () => void

export interface Api {
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
	getBuild(
		championKey: number,
		position: string,
		tier?: string,
	): Promise<BuildRecommendation | null>
	setSpells(spell1Id: number, spell2Id: number): Promise<void>
	applyRunes(page: RunePageRec): Promise<{ ok: boolean; error?: string }>
	startQueue(queueId: number): Promise<{ ok: boolean; error?: string }>
	stopQueue(): Promise<void>
	onLcuStatus(cb: (s: { connected: boolean }) => void): Unsubscribe
	onGameflowPhase(cb: (p: { phase: GameflowPhase }) => void): Unsubscribe
	onReadyCheck(cb: (r: ReadyCheck | null) => void): Unsubscribe
	onChampSelect(cb: (s: ChampSelectSession | null) => void): Unsubscribe
	onSummoner(cb: (s: SummonerIdentity | null) => void): Unsubscribe
	onInGame(cb: (s: InGameState | null) => void): Unsubscribe
	onNav(cb: (n: { to: string; search?: Record<string, unknown> }) => void): Unsubscribe
}
```

- [ ] **Step 2: Verify and format.** Run `pnpm typecheck`. The preload `api` object (typed `Partial<Api>`) stays valid since `Partial` allows missing keys, but the fake `fakeBridge` is typed as the full `Api` and will now error for the missing methods — fixed in Task 1A.12. Run `pnpm format`.

- [ ] **Step 3: Commit.**

```sh
git add src/shared/api.ts
git commit -m "feat(api): add build/summoner/in-game/nav and LCU-write methods to Api"
```

---

### Task 1A.4 — Wire the new methods into the preload bridge

**Files:**
- Modify: `src/preload/index.ts`

The preload `onSummoner`/`onInGame` use the existing `subscribeWithSnapshot` pattern (snapshot field `s.summoner` / `s.inGame`). `onNav` is a plain `ipcRenderer.on` with no snapshot. The invoke wrappers forward args directly. There is no unit test for preload (it needs Electron), so verify via `pnpm typecheck`.

- [ ] **Step 1: Add the invoke wrappers and the three new subscriptions.** In `src/preload/index.ts`, replace the `const api: Partial<Api> = { ... }` object (lines 40–57) with:

```ts
const api: Partial<Api> = {
	acceptReadyCheck: () => ipcRenderer.invoke(IPC.ACCEPT_READY_CHECK),
	declineReadyCheck: () => ipcRenderer.invoke(IPC.DECLINE_READY_CHECK),
	getDDragonBundle: () => ipcRenderer.invoke(IPC.DDRAGON_GET_BUNDLE),
	listNotes: () => ipcRenderer.invoke(IPC.NOTES_LIST),
	upsertNote: (note) => ipcRenderer.invoke(IPC.NOTES_UPSERT, note),
	deleteNote: (id) => ipcRenderer.invoke(IPC.NOTES_DELETE, id),
	getBanList: () => ipcRenderer.invoke(IPC.BANLIST_GET),
	setBanList: (entries) => ipcRenderer.invoke(IPC.BANLIST_SET, entries),
	getRanksForPuuids: (puuids) => ipcRenderer.invoke(IPC.RANK_GET_FOR_PUUIDS, puuids),
	getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
	setSettings: (partial) => ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
	getBuild: (championKey, position, tier) =>
		ipcRenderer.invoke(IPC.BUILD_GET, championKey, position, tier),
	setSpells: (spell1Id, spell2Id) => ipcRenderer.invoke(IPC.LCU_SET_SPELLS, spell1Id, spell2Id),
	applyRunes: (page) => ipcRenderer.invoke(IPC.LCU_APPLY_RUNES, page),
	startQueue: (queueId) => ipcRenderer.invoke(IPC.LCU_START_QUEUE, queueId),
	stopQueue: () => ipcRenderer.invoke(IPC.LCU_STOP_QUEUE),
	onLcuStatus: (cb) =>
		subscribeWithSnapshot(IPC.LCU_STATUS, cb, (s) => ({ connected: s.connected })),
	onGameflowPhase: (cb) => subscribeWithSnapshot(IPC.LCU_PHASE, cb, (s) => ({ phase: s.phase })),
	onReadyCheck: (cb) => subscribeWithSnapshot(IPC.LCU_READY_CHECK, cb, (s) => s.readyCheck),
	onChampSelect: (cb) => subscribeWithSnapshot(IPC.LCU_CHAMP_SELECT, cb, (s) => s.champSelect),
	onSummoner: (cb) => subscribeWithSnapshot(IPC.LCU_SUMMONER, cb, (s) => s.summoner),
	onInGame: (cb) => subscribeWithSnapshot(IPC.LCU_IN_GAME, cb, (s) => s.inGame),
	onNav: (cb) => {
		const listener = (
			_event: Electron.IpcRendererEvent,
			payload: { to: string; search?: Record<string, unknown> },
		): void => cb(payload)
		ipcRenderer.on(IPC.NAV_GO, listener)
		return () => ipcRenderer.removeListener(IPC.NAV_GO, listener)
	},
}
```

- [ ] **Step 2: Verify and format.** Run `pnpm typecheck`. The preload file should now be clean (all `Api` methods present). Run `pnpm format`.

- [ ] **Step 3: Commit.**

```sh
git add src/preload/index.ts
git commit -m "feat(preload): expose build/summoner/in-game/nav and LCU-write bridges"
```

---

### Task 1A.5 — Add `lockinRunePageId` persistence to the store

**Files:**
- Modify: `src/main/store.ts`

Settings defaults (`autoRunes`/`autoSpells`/`buildTier`/`mains`) already flow through `DEFAULT_SETTINGS` (the store spreads `{ ...DEFAULT_SETTINGS, ...store.get("settings") }`), so no change is needed there for defaults. We only add the new `lockinRunePageId` store key and its accessors. This is a thin wrapper over `electron-store` (no unit test — `electron-store` needs the Electron `app`), verified via `pnpm typecheck`.

- [ ] **Step 1: Add the store key and accessors.** In `src/main/store.ts`, replace the `StoreSchema` type and the `store` definition (lines 10–22):

```ts
type StoreSchema = {
	settings: AppSettings
	notes: MatchupNote[]
	banlist: BanListEntry[]
}

export const store = new Store<StoreSchema>({
	defaults: {
		settings: DEFAULT_SETTINGS,
		notes: [],
		banlist: [],
	},
})
```

with:

```ts
type StoreSchema = {
	settings: AppSettings
	notes: MatchupNote[]
	banlist: BanListEntry[]
	lockinRunePageId: number | null
}

export const store = new Store<StoreSchema>({
	defaults: {
		settings: DEFAULT_SETTINGS,
		notes: [],
		banlist: [],
		lockinRunePageId: null,
	},
})
```

- [ ] **Step 2: Add the accessor functions.** Append to the end of `src/main/store.ts`:

```ts
export function getLockinRunePageId(): number | null {
	return store.get("lockinRunePageId")
}

export function setLockinRunePageId(id: number | null): void {
	store.set("lockinRunePageId", id)
}
```

- [ ] **Step 3: Verify and format.** Run `pnpm typecheck` then `pnpm format`.

- [ ] **Step 4: Commit.**

```sh
git add src/main/store.ts
git commit -m "feat(store): persist lockin-owned rune page id for cross-restart cleanup"
```

---

### Task 1A.6 — TDD the DDragon rune/item normalizers

**Files:**
- Create: `src/main/ddragon-normalize.ts`
- Test: `src/main/ddragon-normalize.test.ts`

To make the normalizers unit-testable without Electron's `app` (which `ddragon.ts` imports at module top), extract the two pure normalizer functions into a separate `ddragon-normalize.ts` module, test it, then have `ddragon.ts` import from it (Task 1A.7). This mirrors the existing `shared/lib/*.test.ts` discipline (pure functions, colocated tests).

The `runesReforged.json` shape is an array of styles, each with `slots[].runes[]` where each rune is `{ id, key, name, icon }`. The `item.json` shape is `{ data: Record<string, { name, image: { full } }> }` keyed by the numeric item id as a string.

- [ ] **Step 1: Write the failing test.** Create `src/main/ddragon-normalize.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { normalizeItems, normalizeRunes } from "./ddragon-normalize"

describe("normalizeRunes (runesReforged.json → runesById)", () => {
	const styles = [
		{
			id: 8000,
			key: "Precision",
			name: "Precision",
			icon: "perk-images/Styles/7201_Precision.png",
			slots: [
				{
					runes: [
						{
							id: 8005,
							key: "PressTheAttack",
							name: "Press the Attack",
							icon: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
						},
						{
							id: 8021,
							key: "FleetFootwork",
							name: "Fleet Footwork",
							icon: "perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png",
						},
					],
				},
			],
		},
		{
			id: 8100,
			key: "Domination",
			name: "Domination",
			icon: "perk-images/Styles/7200_Domination.png",
			slots: [
				{
					runes: [
						{
							id: 8112,
							key: "Electrocute",
							name: "Electrocute",
							icon: "perk-images/Styles/Domination/Electrocute/Electrocute.png",
						},
					],
				},
			],
		},
	]

	it("flattens styles + slots + runes into an id-keyed map", () => {
		const byId = normalizeRunes(styles)
		expect(Object.keys(byId)).toHaveLength(3)
		expect(byId[8005]).toEqual({
			id: 8005,
			key: "PressTheAttack",
			name: "Press the Attack",
			icon: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
		})
		expect(byId[8112].name).toBe("Electrocute")
	})

	it("returns an empty map for empty input", () => {
		expect(normalizeRunes([])).toEqual({})
	})
})

describe("normalizeItems (item.json data → itemsById)", () => {
	const data = {
		"1001": { name: "Boots", image: { full: "1001.png" } },
		"3006": { name: "Berserker's Greaves", image: { full: "3006.png" } },
	}

	it("maps numeric ids to {id,name,imageFull}", () => {
		const byId = normalizeItems(data)
		expect(byId[1001]).toEqual({ id: 1001, name: "Boots", imageFull: "1001.png" })
		expect(byId[3006].name).toBe("Berserker's Greaves")
	})

	it("derives imageFull from the id when image.full is missing", () => {
		const byId = normalizeItems({ "2003": { name: "Health Potion" } })
		expect(byId[2003].imageFull).toBe("2003.png")
	})

	it("skips non-numeric keys", () => {
		const byId = normalizeItems({ foo: { name: "Bad" } })
		expect(Object.keys(byId)).toHaveLength(0)
	})
})
```

- [ ] **Step 2: Run the test — expect FAIL.** Run `pnpm test src/main/ddragon-normalize.test.ts`. It must fail because `ddragon-normalize.ts` does not exist yet.

- [ ] **Step 3: Implement the normalizers.** Create `src/main/ddragon-normalize.ts`:

```ts
import type { DDragonBundle } from "@/shared/types"

interface RawRune {
	id?: number
	key?: string
	name?: string
	icon?: string
}
interface RawRuneSlot {
	runes?: RawRune[]
}
export interface RawRuneStyle {
	id?: number
	key?: string
	name?: string
	icon?: string
	slots?: RawRuneSlot[]
}

interface RawItemEntry {
	name?: string
	image?: { full?: string }
}

export function normalizeRunes(styles: RawRuneStyle[]): DDragonBundle["runesById"] {
	const byId: DDragonBundle["runesById"] = {}
	for (const style of styles) {
		for (const slot of style.slots ?? []) {
			for (const rune of slot.runes ?? []) {
				const id = Number(rune.id)
				if (!Number.isFinite(id)) continue
				byId[id] = {
					id,
					key: rune.key ?? "",
					name: rune.name ?? "",
					icon: rune.icon ?? "",
				}
			}
		}
	}
	return byId
}

export function normalizeItems(
	data: Record<string, RawItemEntry>,
): DDragonBundle["itemsById"] {
	const byId: DDragonBundle["itemsById"] = {}
	for (const [rawId, entry] of Object.entries(data)) {
		const id = Number(rawId)
		if (!Number.isFinite(id)) continue
		byId[id] = {
			id,
			name: entry.name ?? "",
			imageFull: entry.image?.full ?? `${id}.png`,
		}
	}
	return byId
}
```

- [ ] **Step 4: Run the test — expect PASS.** Run `pnpm test src/main/ddragon-normalize.test.ts`. All cases must pass.

- [ ] **Step 5: Verify and format.** Run `pnpm typecheck` then `pnpm format`.

- [ ] **Step 6: Commit.**

```sh
git add src/main/ddragon-normalize.ts src/main/ddragon-normalize.test.ts
git commit -m "feat(ddragon): add rune/item normalizers with tests"
```

---

### Task 1A.7 — Fetch `runesReforged.json` + `item.json` in `ddragon.ts` and bump cache validity

**Files:**
- Modify: `src/main/ddragon.ts`

`fetchBundle` now also fetches the runes and items catalogs and runs them through the Task 1A.6 normalizers. The cache-validity check in `readCache` is widened to require the new keys, so stale caches without them are discarded and refetched. This is Electron-coupled (imports `app`), so verify via `pnpm typecheck` plus the dev run in Task 1A.13.

- [ ] **Step 1: Import the normalizers.** In `src/main/ddragon.ts`, replace the import block at the top (lines 1–6):

```ts
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { app } from "electron"

import type { ChampionStatic, DDragonBundle, SummonerSpellStatic } from "@/shared/types"
```

with:

```ts
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { app } from "electron"

import type { ChampionStatic, DDragonBundle, SummonerSpellStatic } from "@/shared/types"

import { normalizeItems, normalizeRunes, type RawRuneStyle } from "./ddragon-normalize"
```

- [ ] **Step 2: Fetch and normalize the new catalogs in `fetchBundle`.** Replace the existing `fetchBundle` function (lines 70–84):

```ts
async function fetchBundle(version: string): Promise<DDragonBundle> {
	const [champions, spells] = await Promise.all([
		fetchJson<{ data: Record<string, RawEntry> }>(
			`${BASE}/cdn/${version}/data/${LOCALE}/champion.json`,
		),
		fetchJson<{ data: Record<string, RawEntry> }>(
			`${BASE}/cdn/${version}/data/${LOCALE}/summoner.json`,
		),
	])
	return {
		version,
		championsByKey: normalizeChampions(champions.data),
		spellsByKey: normalizeSpells(spells.data),
	}
}
```

with:

```ts
async function fetchBundle(version: string): Promise<DDragonBundle> {
	const [champions, spells, runes, items] = await Promise.all([
		fetchJson<{ data: Record<string, RawEntry> }>(
			`${BASE}/cdn/${version}/data/${LOCALE}/champion.json`,
		),
		fetchJson<{ data: Record<string, RawEntry> }>(
			`${BASE}/cdn/${version}/data/${LOCALE}/summoner.json`,
		),
		fetchJson<RawRuneStyle[]>(`${BASE}/cdn/${version}/data/${LOCALE}/runesReforged.json`),
		fetchJson<{ data: Record<string, { name?: string; image?: { full?: string } }> }>(
			`${BASE}/cdn/${version}/data/${LOCALE}/item.json`,
		),
	])
	return {
		version,
		championsByKey: normalizeChampions(champions.data),
		spellsByKey: normalizeSpells(spells.data),
		runesById: normalizeRunes(runes),
		itemsById: normalizeItems(items.data),
	}
}
```

- [ ] **Step 3: Bump the cache-validity check.** Replace the existing `readCache` function (lines 86–93):

```ts
async function readCache(): Promise<DDragonBundle | null> {
	try {
		const bundle = JSON.parse(await readFile(cachePath(), "utf8")) as DDragonBundle
		return bundle.version && bundle.championsByKey && bundle.spellsByKey ? bundle : null
	} catch {
		return null // no cache / corrupt cache — treated as absent
	}
}
```

with:

```ts
async function readCache(): Promise<DDragonBundle | null> {
	try {
		const bundle = JSON.parse(await readFile(cachePath(), "utf8")) as DDragonBundle
		// require the runes/items keys so caches written before this version refetch
		return bundle.version &&
			bundle.championsByKey &&
			bundle.spellsByKey &&
			bundle.runesById &&
			bundle.itemsById
			? bundle
			: null
	} catch {
		return null // no cache / corrupt cache — treated as absent
	}
}
```

- [ ] **Step 4: Verify and format.** Run `pnpm typecheck` (this file should now be clean) then `pnpm format`.

- [ ] **Step 5: Commit.**

```sh
git add src/main/ddragon.ts
git commit -m "feat(ddragon): fetch runesReforged + item catalogs into the bundle"
```

---

### Task 1A.8 — TDD the new DDragon URL helpers

**Files:**
- Modify: `src/renderer/src/lib/ddragon-urls.ts`
- Test: `src/renderer/src/lib/ddragon-urls.test.ts`

Note the asymmetry: `itemIconUrl` and `profileIconUrl` are version-pathed (`.../cdn/<version>/img/...`), but `runeIconUrl` takes a perk `icon` path and is **not** version-pathed — perk icons live at `.../cdn/img/<iconPath>`.

- [ ] **Step 1: Write the failing test.** Create `src/renderer/src/lib/ddragon-urls.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
	champIconUrl,
	itemIconUrl,
	profileIconUrl,
	runeIconUrl,
	spellIconUrl,
} from "./ddragon-urls"

const V = "14.10.1"
const CDN = "https://ddragon.leagueoflegends.com/cdn"

describe("ddragon url helpers", () => {
	it("builds champion + spell urls (existing)", () => {
		expect(champIconUrl(V, "Aatrox.png")).toBe(`${CDN}/${V}/img/champion/Aatrox.png`)
		expect(spellIconUrl(V, "SummonerFlash.png")).toBe(`${CDN}/${V}/img/spell/SummonerFlash.png`)
	})

	it("builds an item icon url from a numeric id (version-pathed)", () => {
		expect(itemIconUrl(V, 3006)).toBe(`${CDN}/${V}/img/item/3006.png`)
	})

	it("builds a profile-icon url from a numeric id (version-pathed)", () => {
		expect(profileIconUrl(V, 4567)).toBe(`${CDN}/${V}/img/profileicon/4567.png`)
	})

	it("builds a rune icon url from a perk icon path (NOT version-pathed)", () => {
		expect(runeIconUrl("perk-images/Styles/Precision/Conqueror/Conqueror.png")).toBe(
			`${CDN}/img/perk-images/Styles/Precision/Conqueror/Conqueror.png`,
		)
	})
})
```

- [ ] **Step 2: Run the test — expect FAIL.** Run `pnpm test src/renderer/src/lib/ddragon-urls.test.ts`. It fails because `itemIconUrl`/`profileIconUrl`/`runeIconUrl` don't exist yet.

- [ ] **Step 3: Implement the helpers.** Replace the entire contents of `src/renderer/src/lib/ddragon-urls.ts`:

```ts
const CDN = "https://ddragon.leagueoflegends.com/cdn"

export const champIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/champion/${imageFull}`

export const spellIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/spell/${imageFull}`

export const itemIconUrl = (version: string, itemId: number) =>
	`${CDN}/${version}/img/item/${itemId}.png`

export const profileIconUrl = (version: string, iconId: number) =>
	`${CDN}/${version}/img/profileicon/${iconId}.png`

/* perk icons are NOT version-pathed — DDragon serves them under /cdn/img/<iconPath> */
export const runeIconUrl = (iconPath: string) => `${CDN}/img/${iconPath}`

/* deterministic on-brand fallback tint per champion (replaces data.js per-champ colors) */
export function championFallbackColor(key: number): string {
	const hue = Math.round((key * 137.508) % 360) // golden-angle spread
	return `hsl(${hue} 32% 30%)`
}
```

- [ ] **Step 4: Run the test — expect PASS.** Run `pnpm test src/renderer/src/lib/ddragon-urls.test.ts`. All cases pass.

- [ ] **Step 5: Verify and format.** Run `pnpm typecheck` then `pnpm format`.

- [ ] **Step 6: Commit.**

```sh
git add src/renderer/src/lib/ddragon-urls.ts src/renderer/src/lib/ddragon-urls.test.ts
git commit -m "feat(ddragon-urls): add item, profile-icon, and rune icon url helpers"
```

---

### Task 1A.9 — Extend `LcuProvider` with `summoner` + `inGame` contexts

**Files:**
- Modify: `src/renderer/src/providers/lcu-provider.tsx`

Keep the churn-split: `summoner` belongs with the status-ish context (it changes rarely, only on connect), `inGame` belongs in the live context (it changes with the gameflow). We add `summoner` to `LcuStatusState` and `inGame` to `LcuLiveState`, subscribe to `api.onSummoner`/`api.onInGame`, and thread both through the reducer + memoized context values. This is React wiring (not unit-tested), verified via `pnpm typecheck`, `pnpm format`, and the dev run in Task 1A.13.

- [ ] **Step 1: Replace the provider file.** Replace the entire contents of `src/renderer/src/providers/lcu-provider.tsx`:

```tsx
import { api } from "@renderer/api"
import { createContext, useEffect, useMemo, useReducer } from "react"

import type {
	ChampSelectSession,
	GameflowPhase,
	InGameState,
	ReadyCheck,
	SummonerIdentity,
} from "@/shared/types"

export interface LcuStatusState {
	connected: boolean
	phase: GameflowPhase
	summoner: SummonerIdentity | null
}
export interface LcuLiveState {
	readyCheck: ReadyCheck | null
	champSelect: ChampSelectSession | null
	inGame: InGameState | null
}

export const LcuStatusContext = createContext<LcuStatusState>({
	connected: false,
	phase: "None",
	summoner: null,
})
export const LcuLiveContext = createContext<LcuLiveState>({
	readyCheck: null,
	champSelect: null,
	inGame: null,
})

type LcuState = LcuStatusState & LcuLiveState
type LcuEvent =
	| { type: "status"; connected: boolean }
	| { type: "phase"; phase: GameflowPhase }
	| { type: "summoner"; summoner: SummonerIdentity | null }
	| { type: "readyCheck"; readyCheck: ReadyCheck | null }
	| { type: "champSelect"; champSelect: ChampSelectSession | null }
	| { type: "inGame"; inGame: InGameState | null }

function reducer(state: LcuState, e: LcuEvent): LcuState {
	switch (e.type) {
		case "status":
			return { ...state, connected: e.connected }
		case "phase":
			return { ...state, phase: e.phase }
		case "summoner":
			return { ...state, summoner: e.summoner }
		case "readyCheck":
			return { ...state, readyCheck: e.readyCheck }
		case "champSelect":
			return { ...state, champSelect: e.champSelect }
		case "inGame":
			return { ...state, inGame: e.inGame }
	}
}

export function LcuProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
	const [state, dispatch] = useReducer(reducer, {
		connected: false,
		phase: "None",
		summoner: null,
		readyCheck: null,
		champSelect: null,
		inGame: null,
	})

	// LOGGING (DEV only)
	useEffect(() => {
		const log = (e: LcuEvent): void => {
			if (import.meta.env.DEV && (e.type === "status" || e.type === "phase")) {
				console.log(`[lcu-provider] ${JSON.stringify(e)}`)
			}
			dispatch(e)
		}
		const offs = [
			api.onLcuStatus(({ connected }) => log({ type: "status", connected })),
			api.onGameflowPhase(({ phase }) => log({ type: "phase", phase })),
			api.onSummoner((summoner) => log({ type: "summoner", summoner })),
			api.onReadyCheck((readyCheck) => log({ type: "readyCheck", readyCheck })),
			api.onChampSelect((champSelect) => log({ type: "champSelect", champSelect })),
			api.onInGame((inGame) => log({ type: "inGame", inGame })),
		]
		return () => {
			for (const off of offs) off()
		}
	}, [])

	const statusValue = useMemo(
		() => ({ connected: state.connected, phase: state.phase, summoner: state.summoner }),
		[state.connected, state.phase, state.summoner],
	)
	const liveValue = useMemo(
		() => ({
			readyCheck: state.readyCheck,
			champSelect: state.champSelect,
			inGame: state.inGame,
		}),
		[state.readyCheck, state.champSelect, state.inGame],
	)

	return (
		<LcuStatusContext.Provider value={statusValue}>
			<LcuLiveContext.Provider value={liveValue}>{children}</LcuLiveContext.Provider>
		</LcuStatusContext.Provider>
	)
}
```

- [ ] **Step 2: Verify and format.** Run `pnpm typecheck` then `pnpm format`.

- [ ] **Step 3: Commit.**

```sh
git add src/renderer/src/providers/lcu-provider.tsx
git commit -m "feat(lcu-provider): track summoner and in-game state in live contexts"
```

---

### Task 1A.10 — Add `useBuild` query hook

**Files:**
- Modify: `src/renderer/src/hooks/use-data.ts`

`useBuild` is enabled only when both `championKey` and `position` are set, keyed `["build", championKey, position]`, with `staleTime: Infinity` (patch-stable data). The `enabled` guard narrows the nullable args before calling `api.getBuild`.

- [ ] **Step 1: Add the `BuildRecommendation` import.** In `src/renderer/src/hooks/use-data.ts`, replace the type import (line 4):

```ts
import type { AppSettings, BanListEntry, MatchupNote } from "@/shared/types"
```

with:

```ts
import type { AppSettings, BanListEntry, BuildRecommendation, MatchupNote } from "@/shared/types"
```

- [ ] **Step 2: Add the `useBuild` hook.** Append to the end of `src/renderer/src/hooks/use-data.ts`:

```ts
export function useBuild(championKey: number | null, position: string | null) {
	return useQuery<BuildRecommendation | null>({
		queryKey: ["build", championKey, position],
		queryFn: () => api.getBuild(championKey as number, position as string),
		enabled: championKey != null && position != null,
		staleTime: Infinity,
	})
}
```

- [ ] **Step 3: Verify and format.** Run `pnpm typecheck` then `pnpm format`.

- [ ] **Step 4: Commit.**

```sh
git add src/renderer/src/hooks/use-data.ts
git commit -m "feat(hooks): add useBuild query for OP.GG recommendations"
```

---

### Task 1A.11 — Add `useSummoner` + `useInGame` live hooks

**Files:**
- Modify: `src/renderer/src/hooks/use-lcu.ts`

These read from the `LcuProvider` contexts extended in Task 1A.9: `summoner` from the status context, `inGame` from the live context.

- [ ] **Step 1: Replace the hooks file.** Replace the entire contents of `src/renderer/src/hooks/use-lcu.ts`:

```ts
import { LcuLiveContext, LcuStatusContext } from "@renderer/providers/lcu-provider"
import { useContext } from "react"

import type {
	ChampSelectSession,
	GameflowPhase,
	InGameState,
	ReadyCheck,
	SummonerIdentity,
} from "@/shared/types"

export function useLcuStatus(): { connected: boolean } {
	const { connected } = useContext(LcuStatusContext)
	return { connected }
}

export function usePhase(): GameflowPhase {
	return useContext(LcuStatusContext).phase
}

export function useSummoner(): SummonerIdentity | null {
	return useContext(LcuStatusContext).summoner
}

export function useReadyCheck(): ReadyCheck | null {
	return useContext(LcuLiveContext).readyCheck
}

export function useChampSelectSession(): ChampSelectSession | null {
	return useContext(LcuLiveContext).champSelect
}

export function useInGame(): InGameState | null {
	return useContext(LcuLiveContext).inGame
}
```

- [ ] **Step 2: Verify and format.** Run `pnpm typecheck` then `pnpm format`.

- [ ] **Step 3: Commit.**

```sh
git add src/renderer/src/hooks/use-lcu.ts
git commit -m "feat(hooks): add useSummoner and useInGame live selectors"
```

---

### Task 1A.12 — Extend the fake layer: fixtures, scenario, bridge

**Files:**
- Modify: `src/renderer/src/api/fake/fixtures.ts`
- Modify: `src/renderer/src/api/fake/scenario.ts`
- Modify: `src/renderer/src/api/fake/bridge.ts`

This makes every new state previewable without a real client. The fixtures add a summoner identity, a complete Aatrox-top build, and minimal `runesById`/`itemsById` entries the build references. The scenario adds a `"game"` phase mapping to `InProgress`. The bridge implements all the new `Api` methods plus the `summoner`/`inGame`/`nav` channels, and `emitAll` covers the two new push channels.

- [ ] **Step 1: Add `FIXTURE_SUMMONER`, `FIXTURE_BUILD`, and bundle runes/items to fixtures.** In `src/renderer/src/api/fake/fixtures.ts`, first replace the type import block (lines 1–10):

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
```

with:

```ts
import type {
	AppSettings,
	BanListEntry,
	BuildRecommendation,
	ChampionStatic,
	DDragonBundle,
	MatchupNote,
	RankInfo,
	SummonerIdentity,
	SummonerSpellStatic,
} from "@/shared/types"
import { DEFAULT_SETTINGS } from "@/shared/types"
```

Then replace the existing `FIXTURE_BUNDLE` definition (lines 157–161):

```ts
export const FIXTURE_BUNDLE: DDragonBundle = {
	version: "14.10.1", // pinned mock version (data.js:6); real version resolved in Phase 4
	championsByKey: Object.fromEntries(CHAMPIONS.map((c) => [c.key, c])),
	spellsByKey: Object.fromEntries(SPELLS.map((s) => [s.key, s])),
}
```

with:

```ts
/* minimal rune catalog covering the runes referenced by FIXTURE_BUILD */
const RUNES: DDragonBundle["runesById"][number][] = [
	{
		id: 8010,
		key: "Conqueror",
		name: "Conqueror",
		icon: "perk-images/Styles/Precision/Conqueror/Conqueror.png",
	},
	{
		id: 9111,
		key: "Triumph",
		name: "Triumph",
		icon: "perk-images/Styles/Precision/Triumph.png",
	},
	{
		id: 9104,
		key: "LegendAlacrity",
		name: "Legend: Alacrity",
		icon: "perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png",
	},
	{
		id: 8014,
		key: "CoupDeGrace",
		name: "Coup de Grace",
		icon: "perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png",
	},
	{
		id: 8473,
		key: "BonePlating",
		name: "Bone Plating",
		icon: "perk-images/Styles/Resolve/BonePlating/BonePlating.png",
	},
	{
		id: 8242,
		key: "Unflinching",
		name: "Unflinching",
		icon: "perk-images/Styles/Resolve/Unflinching/Unflinching.png",
	},
	{ id: 5005, key: "AttackSpeed", name: "Attack Speed", icon: "perk-images/StatMods/StatModsAttackSpeedIcon.png" },
	{
		id: 5008,
		key: "AdaptiveForce",
		name: "Adaptive Force",
		icon: "perk-images/StatMods/StatModsAdaptiveForceIcon.png",
	},
	{ id: 5011, key: "Health", name: "Health", icon: "perk-images/StatMods/StatModsHealthScalingIcon.png" },
]

/* minimal item catalog covering the items referenced by FIXTURE_BUILD */
const ITEMS: DDragonBundle["itemsById"][number][] = [
	{ id: 1054, name: "Doran's Shield", imageFull: "1054.png" },
	{ id: 2003, name: "Health Potion", imageFull: "2003.png" },
	{ id: 3047, name: "Plated Steelcaps", imageFull: "3047.png" },
	{ id: 6630, name: "Goredrinker", imageFull: "6630.png" },
	{ id: 3071, name: "Black Cleaver", imageFull: "3071.png" },
	{ id: 6333, name: "Death's Dance", imageFull: "6333.png" },
	{ id: 3053, name: "Sterak's Gage", imageFull: "3053.png" },
	{ id: 3065, name: "Spirit Visage", imageFull: "3065.png" },
	{ id: 3156, name: "Maw of Malmortius", imageFull: "3156.png" },
]

export const FIXTURE_BUNDLE: DDragonBundle = {
	version: "14.10.1", // pinned mock version (data.js:6); real version resolved in Phase 4
	championsByKey: Object.fromEntries(CHAMPIONS.map((c) => [c.key, c])),
	spellsByKey: Object.fromEntries(SPELLS.map((s) => [s.key, s])),
	runesById: Object.fromEntries(RUNES.map((r) => [r.id, r])),
	itemsById: Object.fromEntries(ITEMS.map((i) => [i.id, i])),
}
```

- [ ] **Step 2: Add `FIXTURE_SUMMONER` and `FIXTURE_BUILD` to fixtures.** Append to the end of `src/renderer/src/api/fake/fixtures.ts`:

```ts
export const FIXTURE_SUMMONER: SummonerIdentity = {
	gameName: "lategame andy",
	tagLine: "EUW",
	profileIconId: 4567,
	summonerLevel: 312,
	puuid: "p-me",
}

/* a complete Aatrox-top build the in-game + champ-select panels render against */
export const FIXTURE_BUILD: BuildRecommendation = {
	championKey: C.aatrox,
	role: "top",
	patch: "14.10",
	winRate: 0.512,
	sampleSize: 84213,
	runes: {
		primaryStyleId: 8000, // Precision
		subStyleId: 8400, // Resolve
		// [keystone, p1, p2, p3, s1, s2, shard1, shard2, shard3]
		selectedPerkIds: [8010, 9111, 9104, 8014, 8473, 8242, 5005, 5008, 5011],
		primaryName: "Precision",
		secondaryName: "Resolve",
	},
	spells: [4, 12], // Flash, Teleport
	items: {
		starter: { ids: [1054, 2003], winRate: 0.515, pickRate: 0.62 },
		boots: { ids: [3047], winRate: 0.518, pickRate: 0.71 },
		core: { ids: [6630, 3071, 6333], winRate: 0.531, pickRate: 0.44 },
		situational: { ids: [3053, 3065, 3156] },
	},
	// 18 entries: Q maxed first, then E, then W; R at 6/11/16
	skillOrder: [
		"Q",
		"E",
		"W",
		"Q",
		"Q",
		"R",
		"Q",
		"E",
		"Q",
		"E",
		"R",
		"E",
		"E",
		"W",
		"W",
		"R",
		"W",
		"W",
	],
	skillPriority: ["Q", "E", "W"],
}
```

- [ ] **Step 3: Add the `"game"` phase to the scenario.** In `src/renderer/src/api/fake/scenario.ts`, replace the `phase` field of `ScenarioState` (line 7):

```ts
	phase: "disconnected" | "idle" | "ready" | "select"
```

with:

```ts
	phase: "disconnected" | "idle" | "ready" | "select" | "game"
```

Then replace the `GAMEFLOW_BY_SCENARIO` map (lines 26–31):

```ts
export const GAMEFLOW_BY_SCENARIO: Record<ScenarioState["phase"], GameflowPhase> = {
	disconnected: "None",
	idle: "Lobby",
	ready: "ReadyCheck",
	select: "ChampSelect",
}
```

with:

```ts
export const GAMEFLOW_BY_SCENARIO: Record<ScenarioState["phase"], GameflowPhase> = {
	disconnected: "None",
	idle: "Lobby",
	ready: "ReadyCheck",
	select: "ChampSelect",
	game: "InProgress",
}
```

- [ ] **Step 4: Wire the new methods + channels into the fake bridge.** In `src/renderer/src/api/fake/bridge.ts`, replace the type import block (lines 1–10):

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
```

with:

```ts
import type { Api, Unsubscribe } from "@/shared/api"
import type {
	AppSettings,
	BanListEntry,
	BuildRecommendation,
	ChampSelectSession,
	GameflowPhase,
	InGameState,
	MatchupNote,
	RankInfo,
	ReadyCheck,
	RunePageRec,
	SummonerIdentity,
} from "@/shared/types"
```

Then replace the fixtures import block (lines 12–19):

```ts
import {
	C,
	FIXTURE_BANLIST,
	FIXTURE_BUNDLE,
	FIXTURE_NOTES,
	FIXTURE_RANKS,
	FIXTURE_SETTINGS,
} from "./fixtures"
```

with:

```ts
import {
	C,
	FIXTURE_BANLIST,
	FIXTURE_BUILD,
	FIXTURE_BUNDLE,
	FIXTURE_NOTES,
	FIXTURE_RANKS,
	FIXTURE_SETTINGS,
	FIXTURE_SUMMONER,
} from "./fixtures"
```

- [ ] **Step 5: Add the new channels and an in-game state builder.** In `src/renderer/src/api/fake/bridge.ts`, replace the channel declarations (lines 45–48):

```ts
const statusCh = channel<{ connected: boolean }>()
const phaseCh = channel<{ phase: GameflowPhase }>()
const readyCh = channel<ReadyCheck | null>()
const champCh = channel<ChampSelectSession | null>()
```

with:

```ts
const statusCh = channel<{ connected: boolean }>()
const phaseCh = channel<{ phase: GameflowPhase }>()
const readyCh = channel<ReadyCheck | null>()
const champCh = channel<ChampSelectSession | null>()
const summonerCh = channel<SummonerIdentity | null>()
const inGameCh = channel<InGameState | null>()

/* the in-game champion mirrors my champ-select pick (Aatrox top, Flash/TP) */
function buildInGame(): InGameState {
	return { championId: C.aatrox, spell1Id: 4, spell2Id: 12, queueId: 420 }
}
```

- [ ] **Step 6: Cover the new pushes in `emitAll`.** Replace the `emitAll` function body (lines 64–74):

```ts
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
```

with:

```ts
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
	summonerCh.emit(connected ? FIXTURE_SUMMONER : null)
	inGameCh.emit(scenario.phase === "game" ? buildInGame() : null)
}
```

- [ ] **Step 7: Implement the new `Api` methods and subscriptions on `fakeBridge`.** In `src/renderer/src/api/fake/bridge.ts`, replace the closing portion of the `fakeBridge` object — from `getRanksForPuuids` through the final `onChampSelect` subscription and the object's closing `}` (lines 196–230):

```ts
	async getRanksForPuuids(puuids) {
		// "Ranks N/A" still keeps YOUR rank — the prototype always shows the local player's
		// rank (champ-select-parts.jsx:517 showRank = ranksAvailable || p.you)
		const out: Record<string, RankInfo | null> = {}
		for (const p of puuids) {
			if (!p) continue // LCU hides enemy identity — blank puuid means unknown player
			out[p] = scenario.ranksAvailable || p === "p-me" ? (FIXTURE_RANKS[p] ?? null) : null
		}
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
```

with:

```ts
	async getRanksForPuuids(puuids) {
		// "Ranks N/A" still keeps YOUR rank — the prototype always shows the local player's
		// rank (champ-select-parts.jsx:517 showRank = ranksAvailable || p.you)
		const out: Record<string, RankInfo | null> = {}
		for (const p of puuids) {
			if (!p) continue // LCU hides enemy identity — blank puuid means unknown player
			out[p] = scenario.ranksAvailable || p === "p-me" ? (FIXTURE_RANKS[p] ?? null) : null
		}
		return out
	},
	async getBuild(championKey, position): Promise<BuildRecommendation | null> {
		if (!scenario.buildAvailable) return null
		return championKey === FIXTURE_BUILD.championKey && position === FIXTURE_BUILD.role
			? { ...FIXTURE_BUILD }
			: null
	},
	async setSpells(_spell1Id: number, _spell2Id: number): Promise<void> {
		// no-op in the fake bridge — the real LCU write lands in Phase 1B
	},
	async applyRunes(_page: RunePageRec): Promise<{ ok: boolean; error?: string }> {
		return { ok: true }
	},
	async startQueue(_queueId: number): Promise<{ ok: boolean; error?: string }> {
		return { ok: true }
	},
	async stopQueue(): Promise<void> {
		// no-op in the fake bridge
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
	onSummoner: (cb) => {
		const off = summonerCh.on(cb)
		cb(scenario.phase !== "disconnected" ? FIXTURE_SUMMONER : null)
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
	onInGame: (cb) => {
		const off = inGameCh.on(cb)
		cb(scenario.phase === "game" ? buildInGame() : null)
		return off
	},
	onNav: () => {
		// tray-driven nav has no fake source — no-op subscription
		return () => {}
	},
}
```

- [ ] **Step 8: Add `buildAvailable` to the scenario default.** The bridge now reads `scenario.buildAvailable`; add it to `ScenarioState` and the initial scenario. In `src/renderer/src/api/fake/scenario.ts`, add the field to `ScenarioState` (after `autoAcceptFired`):

```ts
	autoAcceptFired: boolean
	buildAvailable: boolean // dev toggle: OP.GG recommendation present vs unavailable
}
```

(Replace the closing of the `ScenarioState` interface accordingly — the `}` stays after the new field.) Then add it to `INITIAL_SCENARIO`:

```ts
export const INITIAL_SCENARIO: ScenarioState = {
	phase: "select",
	csSubPhase: null,
	enemyHidden: null,
	ranksAvailable: true,
	hasNote: true,
	roleAssigned: true,
	autoAcceptFired: false,
	buildAvailable: true,
}
```

- [ ] **Step 9: Verify and format.** Run `pnpm typecheck` (the fake `fakeBridge` is now a complete `Api`; all errors from earlier tasks should be resolved). Then run `pnpm test` to confirm the whole suite still passes. Then `pnpm format`.

- [ ] **Step 10: Commit.**

```sh
git add src/renderer/src/api/fake/fixtures.ts src/renderer/src/api/fake/scenario.ts src/renderer/src/api/fake/bridge.ts
git commit -m "feat(fake): add summoner, build, in-game fixtures and bridge implementations"
```

---

### Task 1A.13 — Add "In game" phase + auto-rune/spell/build toggles to the dev state-switcher

**Files:**
- Modify: `src/renderer/src/components/dev/state-switcher.tsx`

Add `"game"` to the Client phase `Seg`; when phase is `"game"`, show toggles for `autoRunes`/`autoSpells` (drive the settings query) and a `buildAvailable` toggle (drive the scenario). Reuse the existing `Seg`, `Switch`, `DemoLabel`, and `LABEL_CLASS` patterns already in the file. Keep the component under ~300 lines (it will land near ~310 with the additions, so the in-game controls are factored into a small block mirroring the existing champ-select block; if needed, no extraction beyond inline JSX is required since the additions are modest). This is a dev-only UI surface — verify by running the app in force-fake mode and exercising the toggles, then screenshot.

- [ ] **Step 1: Add `"game"` to the Client phase Seg.** In `src/renderer/src/components/dev/state-switcher.tsx`, replace the Client phase `Seg` `options` array (inside the "Client phase seg" block, lines 130–137):

```tsx
					options={[
						{ value: "disconnected", label: "Disconnected" },
						{ value: "idle", label: "Idle" },
						{ value: "ready", label: "Ready Check" },
						{ value: "select", label: "Champ Selection" },
					]}
```

with:

```tsx
					options={[
						{ value: "disconnected", label: "Disconnected" },
						{ value: "idle", label: "Idle" },
						{ value: "ready", label: "Ready Check" },
						{ value: "select", label: "Champ Selection" },
						{ value: "game", label: "In game" },
					]}
```

- [ ] **Step 2: Add the in-game controls block.** Insert a new block immediately after the closing `)}` of the "Champ Select controls" block (right after line 232, before the "Idle/Disconnected hint text" comment). Add:

```tsx
				{/* In-game controls */}
				{snapshot.phase === "game" && (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Switch
							id="dev-auto-runes"
							checked={settingsQuery.data?.autoRunes ?? false}
							onCheckedChange={(checked) => setSettingsMutation.mutate({ autoRunes: checked })}
						/>
						<label htmlFor="dev-auto-runes" className={LABEL_CLASS}>
							Auto-runes
						</label>
						<Switch
							id="dev-auto-spells"
							checked={settingsQuery.data?.autoSpells ?? false}
							onCheckedChange={(checked) => setSettingsMutation.mutate({ autoSpells: checked })}
						/>
						<label htmlFor="dev-auto-spells" className={LABEL_CLASS}>
							Auto-spells
						</label>
						<div className="flex items-center gap-[7px]">
							<DemoLabel>Build</DemoLabel>
							<Seg
								value={snapshot.buildAvailable ? "on" : "off"}
								onChange={(v) => drive({ buildAvailable: v === "on" })}
								options={[
									{ value: "on", label: "Available" },
									{ value: "off", label: "None" },
								]}
							/>
						</div>
					</div>
				)}
```

- [ ] **Step 3: Make the auto-toggles available in champ select too.** The auto-rune/spell toggles are also useful while previewing champ select (the auto-apply preview happens there). Add the same two switches to the existing "Champ Select controls" block. In the champ-select block, replace the opening `<div className="flex flex-wrap items-center justify-end gap-3">` (line 169) and insert the auto toggles as the first children — replace:

```tsx
				{/* Champ Select controls */}
				{snapshot.phase === "select" && (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<div className="flex items-center gap-[7px]">
							<DemoLabel>Phase</DemoLabel>
```

with:

```tsx
				{/* Champ Select controls */}
				{snapshot.phase === "select" && (
					<div className="flex flex-wrap items-center justify-end gap-3">
						<Switch
							id="dev-cs-auto-runes"
							checked={settingsQuery.data?.autoRunes ?? false}
							onCheckedChange={(checked) => setSettingsMutation.mutate({ autoRunes: checked })}
						/>
						<label htmlFor="dev-cs-auto-runes" className={LABEL_CLASS}>
							Auto-runes
						</label>
						<Switch
							id="dev-cs-auto-spells"
							checked={settingsQuery.data?.autoSpells ?? false}
							onCheckedChange={(checked) => setSettingsMutation.mutate({ autoSpells: checked })}
						/>
						<label htmlFor="dev-cs-auto-spells" className={LABEL_CLASS}>
							Auto-spells
						</label>
						<div className="flex items-center gap-[7px]">
							<DemoLabel>Build</DemoLabel>
							<Seg
								value={snapshot.buildAvailable ? "on" : "off"}
								onChange={(v) => drive({ buildAvailable: v === "on" })}
								options={[
									{ value: "on", label: "Available" },
									{ value: "off", label: "None" },
								]}
							/>
						</div>
						<div className="flex items-center gap-[7px]">
							<DemoLabel>Phase</DemoLabel>
```

(The rest of the champ-select block — Enemy/Ranks/Note/Role segs — is unchanged.)

- [ ] **Step 4: Confirm line count.** Run `wc -l src/renderer/src/components/dev/state-switcher.tsx`. If it exceeds ~330 lines, extract the in-game controls into a small local component `InGameControls` (a function declared above `StateSwitcher`, taking `{ settingsQuery, setSettingsMutation, drive, snapshot }` props) and render `<InGameControls .../>` in place. If it's within ~330, leave inline (dev-only tool, mild allowance). Document the choice in the commit message.

- [ ] **Step 5: Typecheck and format.** Run `pnpm typecheck` then `pnpm format`.

- [ ] **Step 6: Dev verification with Playwright.** Start the app with `pnpm dev` (run in background). Once the renderer is up, drive it in force-fake mode and verify the new switcher controls:
  1. Use the Playwright MCP `browser_navigate` to the renderer dev URL (default `http://localhost:5173`).
  2. In the page, enable force-fake: `browser_run_code_unsafe` running `window.localStorage.setItem("lockin:forceFake","1"); window.location.reload()`.
  3. After reload, take a `browser_snapshot`. Confirm the dev bar shows the Client `Seg` with an **"In game"** option.
  4. `browser_click` the **"In game"** option. Take a `browser_take_screenshot`. Confirm the in-game controls appear: **Auto-runes** switch, **Auto-spells** switch, and a **Build** seg with **Available/None**.
  5. Toggle **Auto-runes** on, toggle **Build → None**, and confirm via `browser_snapshot` that the controls reflect the change (the switch is checked; the seg highlights "None"). Toggle them back.
  6. `browser_click` **"Champ Selection"** and confirm the same Auto-runes/Auto-spells/Build controls now render alongside the existing Phase/Enemy/Ranks/Note/Role segs.
  7. Save a screenshot of the in-game state to confirm the deliverable.

- [ ] **Step 7: Commit.**

```sh
git add src/renderer/src/components/dev/state-switcher.tsx
git commit -m "feat(dev): add In-game phase and auto-rune/spell/build toggles to state switcher"
```

---

### Task 1A.14 — Phase-wide verification gate

**Files:**
- (no code changes — verification only)

- [ ] **Step 1: Full typecheck.** Run `pnpm typecheck`. Must report zero errors across `src/main`, `src/preload`, `src/renderer`, and `src/shared`.

- [ ] **Step 2: Full test suite.** Run `pnpm test`. The new `ddragon-normalize.test.ts` and `ddragon-urls.test.ts` plus all pre-existing `shared/lib/*.test.ts` must pass.

- [ ] **Step 3: Format check.** Run `pnpm format`. It should report no further changes (everything already formatted) — if it rewrites anything, re-run `pnpm typecheck`/`pnpm test`, then commit the formatting with `git commit -am "chore: format"` (only if there are changes).

- [ ] **Step 4: Confirm clean tree.** Run `git status` and confirm there are no uncommitted changes. Phase 1A is complete: all shared contracts, IPC channels, the `Api` surface, preload bridges, store accessors, DDragon catalog additions, renderer URL helpers, provider contexts, query/live hooks, and the full fake layer (fixtures + scenario + bridge + dev switcher) are in place for Phase 1B (real LCU writes + OP.GG provider) to build on.

Relevant absolute file paths produced/modified by this phase:
- `/Users/felipe/lockin/src/shared/types.ts`
- `/Users/felipe/lockin/src/shared/constants.ts`
- `/Users/felipe/lockin/src/shared/api.ts`
- `/Users/felipe/lockin/src/preload/index.ts`
- `/Users/felipe/lockin/src/main/store.ts`
- `/Users/felipe/lockin/src/main/ddragon.ts`
- `/Users/felipe/lockin/src/main/ddragon-normalize.ts` (new) + `.test.ts`
- `/Users/felipe/lockin/src/renderer/src/lib/ddragon-urls.ts` + `.test.ts` (new)
- `/Users/felipe/lockin/src/renderer/src/providers/lcu-provider.tsx`
- `/Users/felipe/lockin/src/renderer/src/hooks/use-data.ts`
- `/Users/felipe/lockin/src/renderer/src/hooks/use-lcu.ts`
- `/Users/felipe/lockin/src/renderer/src/api/fake/fixtures.ts`
- `/Users/felipe/lockin/src/renderer/src/api/fake/scenario.ts`
- `/Users/felipe/lockin/src/renderer/src/api/fake/bridge.ts`
- `/Users/felipe/lockin/src/renderer/src/components/dev/state-switcher.tsx`

---

## Phase 1B — Main-process LCU writes + OP.GG BuildProvider (fetch/parse/normalize/cache) + ipc handlers

This phase adds the main-process write/read capabilities to `LcuService`, builds the OP.GG `BuildProvider` (tokenizer, schema-aware parser, fetch+normalize, disk cache), and wires all five new IPC handlers (`BUILD_GET`, `LCU_SET_SPELLS`, `LCU_APPLY_RUNES`, `LCU_START_QUEUE`, `LCU_STOP_QUEUE`).

This phase assumes Phase 1A already landed the shared additions (`src/shared/types.ts` new interfaces/settings/snapshot fields, `src/shared/constants.ts` IPC channels, `src/shared/api.ts`, `src/preload/index.ts`). If any of those are missing when you reach a step that uses them, add the exact name/signature from the SHARED CONTRACT before continuing — but do **not** build the renderer, preload, or fake-layer features here.

---

### Task 1B.1 — Vitest config: include OP.GG provider tests

**Files:**
- Modify: `/Users/felipe/lockin/vitest.config.ts`

The existing config only globs `src/shared/lib/**/*.test.ts`. The OP.GG parser/normalizer tests live under `src/main/build/`, so they must be added to the include list or `pnpm test <file>` will silently pass without running them.

- [ ] **Step 1: Widen the vitest `include` glob.** Replace the file contents:

```ts
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		include: ["src/shared/lib/**/*.test.ts", "src/main/build/**/*.test.ts"],
	},
})
```

- [ ] **Step 2: Sanity-run.** `pnpm test` — expect the existing shared tests to still pass (and "no new tests" yet is fine; the script uses `--passWithNoTests`).
- [ ] **Step 3: Commit.** `git add vitest.config.ts && git commit -m "chore: include main build tests in vitest"`

---

### Task 1B.2 — BuildProvider interface + role/position mapping

**Files:**
- Create: `/Users/felipe/lockin/src/main/build/types.ts`
- Create: `/Users/felipe/lockin/src/main/build/position.ts`
- Test: `/Users/felipe/lockin/src/main/build/position.test.ts`

The provider interface and the pure `Role → OP.GG position` mapping. The mapping is pure logic, so it gets strict TDD.

- [ ] **Step 1: Write the failing position-mapping test.** Create `src/main/build/position.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { positionFromRole, roleFromPosition } from "./position"

describe("positionFromRole", () => {
	it("maps every Role to the OP.GG enum spelling", () => {
		expect(positionFromRole("top")).toBe("TOP")
		expect(positionFromRole("jungle")).toBe("JUNGLE")
		expect(positionFromRole("middle")).toBe("MID")
		expect(positionFromRole("bottom")).toBe("ADC")
		expect(positionFromRole("utility")).toBe("SUPPORT")
	})
})

describe("roleFromPosition", () => {
	it("round-trips back from the OP.GG enum", () => {
		expect(roleFromPosition("TOP")).toBe("top")
		expect(roleFromPosition("JUNGLE")).toBe("jungle")
		expect(roleFromPosition("MID")).toBe("middle")
		expect(roleFromPosition("ADC")).toBe("bottom")
		expect(roleFromPosition("SUPPORT")).toBe("utility")
	})

	it("accepts the renderer's freeform position strings (LCU assignedPosition)", () => {
		// the getBuild ipc receives a `position: string` (e.g. LCU "middle")
		expect(roleFromPosition("middle")).toBe("middle")
		expect(roleFromPosition("MIDDLE")).toBe("middle")
		expect(roleFromPosition("bot")).toBe("bottom")
		expect(roleFromPosition("support")).toBe("utility")
		expect(roleFromPosition("")).toBe(null)
		expect(roleFromPosition("nonsense")).toBe(null)
	})
})
```

- [ ] **Step 2: Run the test, expect FAIL.** `pnpm test src/main/build/position.test.ts` — fails (module not found).

- [ ] **Step 3: Implement `position.ts`.** Create `src/main/build/position.ts`:

```ts
import type { Role } from "@/shared/types"

/** OP.GG `lol_get_champion_analysis` position enum. */
export type OpggPosition = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT"

const ROLE_TO_POSITION: Record<Role, OpggPosition> = {
	top: "TOP",
	jungle: "JUNGLE",
	middle: "MID",
	bottom: "ADC",
	utility: "SUPPORT",
}

export function positionFromRole(role: Role): OpggPosition {
	return ROLE_TO_POSITION[role]
}

/**
 * Tolerant inbound mapping. The `build:get` ipc takes a freeform `position: string`
 * which may be a Role ("middle"), an LCU assignedPosition ("bottom"/"utility"),
 * an OP.GG enum ("MID"/"ADC"/"SUPPORT"), or common shorthands ("bot"/"mid"/"sup").
 * Returns null when nothing matches so the provider can degrade to no build.
 */
export function roleFromPosition(position: string): Role | null {
	switch (position.trim().toLowerCase()) {
		case "top":
			return "top"
		case "jungle":
		case "jg":
		case "jung":
			return "jungle"
		case "middle":
		case "mid":
			return "middle"
		case "bottom":
		case "bot":
		case "adc":
			return "bottom"
		case "utility":
		case "support":
		case "sup":
		case "supp":
			return "utility"
		default:
			return null
	}
}
```

- [ ] **Step 4: Run the test, expect PASS.** `pnpm test src/main/build/position.test.ts`.

- [ ] **Step 5: Create the provider interface `types.ts`.** Create `src/main/build/types.ts`:

```ts
import type { BuildRecommendation } from "@/shared/types"

export interface BuildProvider {
	getBuild(
		championKey: number,
		position: string,
		opts?: { tier?: string },
	): Promise<BuildRecommendation | null>
}
```

- [ ] **Step 6: typecheck + format.** `pnpm typecheck && pnpm format`.
- [ ] **Step 7: Commit.** `git add src/main/build/types.ts src/main/build/position.ts src/main/build/position.test.ts && git commit -m "feat: add BuildProvider interface and OP.GG position mapping"`

---

### Task 1B.3 — OP.GG text-format tokenizer + schema-aware parser

**Files:**
- Create: `/Users/felipe/lockin/src/main/build/opgg-parse.ts`
- Test: `/Users/felipe/lockin/src/main/build/opgg-parse.test.ts`

OP.GG returns a token-optimized text format in `result.content[0].text`: a header of `class X: f1,f2,...` lines defining field order per class, then one positional constructor expression `Root(arg, arg, Nested(...), [item,item], ...)`. Strings are `"double-quoted"`, numbers/bools/null bare, arrays in `[]`. This parser is pure logic, so strict TDD on **synthetic** small inputs.

The parser produces a plain decoded object tree: each `ClassName(...)` becomes `{ __class: "ClassName", <field>: <value>, ... }` where fields are zipped against the class's header in order; arrays become JS arrays; quoted strings become JS strings; bare `123`/`1.5`/`true`/`false`/`null` become their JS values. Extra constructor args beyond the declared fields are ignored; missing trailing fields are left `undefined` — that tolerance is the whole point (OP.GG reordering fields can't silently misalign because we zip by the declared header order, and adding fields only appends).

- [ ] **Step 1: Write the failing parser test (synthetic inputs).** Create `src/main/build/opgg-parse.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { parseOpggText } from "./opgg-parse"

describe("parseOpggText", () => {
	it("parses a flat class with mixed scalar fields", () => {
		const text = ['class Stats: win_rate,play,tier,ranked', 'Stats(0.62, 1234, "S", true)'].join(
			"\n",
		)
		const root = parseOpggText(text)
		expect(root).toEqual({
			__class: "Stats",
			win_rate: 0.62,
			play: 1234,
			tier: "S",
			ranked: true,
		})
	})

	it("parses nested classes by their own header field order", () => {
		const text = [
			"class Root: name,stats",
			"class Stats: win,play",
			'Root("Aatrox", Stats(0.51, 900))',
		].join("\n")
		expect(parseOpggText(text)).toEqual({
			__class: "Root",
			name: "Aatrox",
			stats: { __class: "Stats", win: 0.51, play: 900 },
		})
	})

	it("parses arrays of scalars and arrays of classes", () => {
		const text = [
			"class Root: ids,groups",
			"class Group: ids,win",
			"Root([3157, 6655], [Group([1001, 3047], 0.5), Group([3158], 0.6)])",
		].join("\n")
		expect(parseOpggText(text)).toEqual({
			__class: "Root",
			ids: [3157, 6655],
			groups: [
				{ __class: "Group", ids: [1001, 3047], win: 0.5 },
				{ __class: "Group", ids: [3158], win: 0.6 },
			],
		})
	})

	it("handles null, negatives, decimals, and empty arrays", () => {
		const text = ["class Root: a,b,c,d", "Root(null, -3, 0.0, [])"].join("\n")
		expect(parseOpggText(text)).toEqual({
			__class: "Root",
			a: null,
			b: -3,
			c: 0,
			d: [],
		})
	})

	it("handles quoted strings containing commas, parens, and escaped quotes", () => {
		const text = ["class Root: a,b", 'Root("hi, (there)", "she said \\"go\\"")'].join("\n")
		expect(parseOpggText(text)).toEqual({
			__class: "Root",
			a: "hi, (there)",
			b: 'she said "go"',
		})
	})

	it("zips by declared header order even when a field appears reordered", () => {
		// the SAME constructor, two different declared orders → different mapping.
		const a = parseOpggText(["class R: x,y", "R(1, 2)"].join("\n"))
		const b = parseOpggText(["class R: y,x", "R(1, 2)"].join("\n"))
		expect(a).toEqual({ __class: "R", x: 1, y: 2 })
		expect(b).toEqual({ __class: "R", y: 1, x: 2 })
	})

	it("tolerates extra trailing constructor args (unknown new fields) by ignoring them", () => {
		const text = ["class R: a", 'R(1, "future_field", 99)'].join("\n")
		expect(parseOpggText(text)).toEqual({ __class: "R", a: 1 })
	})

	it("leaves declared-but-missing trailing fields undefined", () => {
		const root = parseOpggText(["class R: a,b,c", "R(1)"].join("\n")) as Record<string, unknown>
		expect(root.a).toBe(1)
		expect("b" in root).toBe(false)
		expect("c" in root).toBe(false)
	})

	it("returns null on malformed input rather than throwing", () => {
		expect(parseOpggText("not a real payload")).toBe(null)
		expect(parseOpggText("class R: a\nR(")).toBe(null)
		expect(parseOpggText("")).toBe(null)
	})
})
```

- [ ] **Step 2: Run the test, expect FAIL.** `pnpm test src/main/build/opgg-parse.test.ts`.

- [ ] **Step 3: Implement `opgg-parse.ts` (full tokenizer + parser).** Create `src/main/build/opgg-parse.ts`:

```ts
/**
 * Parser for OP.GG MCP's token-optimized text format.
 *
 * Format:
 *   - Zero or more header lines: `class ClassName: field1,field2,...`
 *   - Exactly one root expression line: `ClassName(arg, arg, Nested(...), [a,b], ...)`
 *
 * Values: "double-quoted strings" | bare numbers | true | false | null | [arrays] | ClassName(...)
 *
 * Decoding is schema-aware: constructor args are zipped against the class's
 * declared field order, so OP.GG reordering or appending fields never silently
 * misaligns our normalizer. Decoded nodes are { __class, ...fields }.
 *
 * Any failure returns null (callers treat that as "no build").
 */

export type OpggNode = { __class: string; [field: string]: unknown }
export type OpggValue = string | number | boolean | null | OpggValue[] | OpggNode

type Schema = Map<string, string[]>

/* ----------------------------------------------------------------- header */

const CLASS_LINE = /^class\s+([A-Za-z_]\w*)\s*:\s*(.*)$/

function parseSchema(lines: string[]): { schema: Schema; rest: string } {
	const schema: Schema = new Map()
	let i = 0
	for (; i < lines.length; i++) {
		const line = lines[i]?.trim() ?? ""
		if (line === "") continue
		const match = CLASS_LINE.exec(line)
		if (!match) break // first non-class, non-blank line begins the root expression
		const [, name, fieldsRaw] = match
		const fields = fieldsRaw
			.split(",")
			.map((f) => f.trim())
			.filter((f) => f.length > 0)
		schema.set(name as string, fields)
	}
	const rest = lines.slice(i).join("\n").trim()
	return { schema, rest }
}

/* ---------------------------------------------------------------- scanner */

class Scanner {
	private pos = 0
	constructor(
		private readonly src: string,
		private readonly schema: Schema,
	) {}

	parseRoot(): OpggValue {
		this.skipWs()
		const value = this.parseValue()
		this.skipWs()
		if (this.pos !== this.src.length) {
			throw new Error(`trailing input at ${this.pos}`)
		}
		return value
	}

	private skipWs(): void {
		while (this.pos < this.src.length && /\s/.test(this.src[this.pos] as string)) this.pos++
	}

	private peek(): string {
		return this.src[this.pos] ?? ""
	}

	private parseValue(): OpggValue {
		this.skipWs()
		const ch = this.peek()
		if (ch === '"') return this.parseString()
		if (ch === "[") return this.parseArray()
		if (/[A-Za-z_]/.test(ch)) return this.parseIdentOrKeyword()
		if (ch === "-" || /[0-9.]/.test(ch)) return this.parseNumber()
		throw new Error(`unexpected char '${ch}' at ${this.pos}`)
	}

	private parseString(): string {
		this.pos++ // opening quote
		let out = ""
		while (this.pos < this.src.length) {
			const ch = this.src[this.pos++] as string
			if (ch === "\\") {
				const next = this.src[this.pos++] as string
				out += next === "n" ? "\n" : next === "t" ? "\t" : next
				continue
			}
			if (ch === '"') return out
			out += ch
		}
		throw new Error("unterminated string")
	}

	private parseNumber(): number {
		const start = this.pos
		if (this.peek() === "-") this.pos++
		while (this.pos < this.src.length && /[0-9.eE+-]/.test(this.src[this.pos] as string)) this.pos++
		const raw = this.src.slice(start, this.pos)
		const num = Number(raw)
		if (!Number.isFinite(num)) throw new Error(`bad number '${raw}'`)
		return num
	}

	private parseArray(): OpggValue[] {
		this.pos++ // [
		const out: OpggValue[] = []
		this.skipWs()
		if (this.peek() === "]") {
			this.pos++
			return out
		}
		for (;;) {
			out.push(this.parseValue())
			this.skipWs()
			const ch = this.peek()
			if (ch === ",") {
				this.pos++
				continue
			}
			if (ch === "]") {
				this.pos++
				return out
			}
			throw new Error(`expected ',' or ']' at ${this.pos}`)
		}
	}

	private parseIdentOrKeyword(): OpggValue {
		const start = this.pos
		while (this.pos < this.src.length && /[A-Za-z0-9_]/.test(this.src[this.pos] as string)) {
			this.pos++
		}
		const ident = this.src.slice(start, this.pos)
		if (ident === "true") return true
		if (ident === "false") return false
		if (ident === "null") return null
		this.skipWs()
		if (this.peek() !== "(") throw new Error(`expected '(' after class '${ident}'`)
		return this.parseConstructor(ident)
	}

	private parseConstructor(name: string): OpggNode {
		this.pos++ // (
		const args: OpggValue[] = []
		this.skipWs()
		if (this.peek() === ")") {
			this.pos++
		} else {
			for (;;) {
				args.push(this.parseValue())
				this.skipWs()
				const ch = this.peek()
				if (ch === ",") {
					this.pos++
					continue
				}
				if (ch === ")") {
					this.pos++
					break
				}
				throw new Error(`expected ',' or ')' in ${name} at ${this.pos}`)
			}
		}
		const fields = this.schema.get(name) ?? []
		const node: OpggNode = { __class: name }
		for (let i = 0; i < fields.length && i < args.length; i++) {
			node[fields[i] as string] = args[i]
		}
		return node
	}
}

export function parseOpggText(text: string): OpggValue | null {
	try {
		if (!text || text.trim() === "") return null
		const { schema, rest } = parseSchema(text.split("\n"))
		if (rest === "") return null
		return new Scanner(rest, schema).parseRoot()
	} catch {
		return null
	}
}
```

- [ ] **Step 4: Run the test, expect PASS.** `pnpm test src/main/build/opgg-parse.test.ts`.
- [ ] **Step 5: typecheck + format.** `pnpm typecheck && pnpm format`.
- [ ] **Step 6: Commit.** `git add src/main/build/opgg-parse.ts src/main/build/opgg-parse.test.ts && git commit -m "feat: add OP.GG schema-aware text-format parser"`

---

### Task 1B.4 — Capture a real OP.GG fixture (Aatrox top)

**Files:**
- Create: `/Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.txt`
- Create: `/Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.json` (the raw JSON-RPC envelope, for reference/debugging)

The normalizer test in Task 1B.6 asserts structural invariants against this **real** captured payload, so capture it first. The text fixture is just `result.content[0].text` extracted from the live response.

- [ ] **Step 1: Run the verified live call and save the raw envelope.** This streams an SSE/JSON response; capture it raw first:

```sh
mkdir -p /Users/felipe/lockin/src/main/build/__fixtures__
curl -s -X POST https://mcp-api.op.gg/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lol_get_champion_analysis","arguments":{"game_mode":"ranked","champion":"Aatrox","position":"TOP","lang":"en_US","tier":"emerald_plus"}}}' \
  -o /Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.raw
```

- [ ] **Step 2: Inspect the raw response shape.** `pnpm exec` is not needed; use a tiny node one-liner to print the first 400 chars so you can see whether it's plain JSON or `data:`-prefixed SSE frames: run `node -e 'console.log(require("node:fs").readFileSync("/Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.raw","utf8").slice(0,400))'`. (SSE frames look like `event: message\ndata: {json}\n\n`.)

- [ ] **Step 3: Extract `result.content[0].text` into the `.txt` fixture and the parsed envelope into `.json`.** Run this node script (it handles both plain-JSON and SSE `data:` framing — keep the exact code; do not abbreviate):

```sh
node -e '
const fs = require("node:fs")
const raw = fs.readFileSync("/Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.raw", "utf8")
let envelope = null
try {
  envelope = JSON.parse(raw)
} catch {
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith("data:")) continue
    const payload = t.slice(5).trim()
    if (payload === "" || payload === "[DONE]") continue
    try {
      const obj = JSON.parse(payload)
      if (obj && obj.result) envelope = obj
    } catch {}
  }
}
if (!envelope) throw new Error("could not parse OP.GG response envelope from raw capture")
const text = envelope.result && envelope.result.content && envelope.result.content[0] && envelope.result.content[0].text
if (typeof text !== "string" || text.length === 0) throw new Error("result.content[0].text missing/empty")
fs.writeFileSync("/Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.txt", text)
fs.writeFileSync("/Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.json", JSON.stringify(envelope, null, 2))
console.log("wrote aatrox-top.txt (" + text.length + " chars)")
'
rm /Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.raw
```

- [ ] **Step 4: Verify the fixture parses with our parser.** Quick check that the captured text is decodable end-to-end before writing the normalizer test against it:

```sh
node --import tsx -e '
import { readFileSync } from "node:fs"
import { parseOpggText } from "./src/main/build/opgg-parse.ts"
const text = readFileSync("./src/main/build/__fixtures__/aatrox-top.txt", "utf8")
const root = parseOpggText(text)
if (!root) throw new Error("parser returned null on real fixture")
console.log("root class:", (root as any).__class)
console.log(JSON.stringify(root, null, 2).slice(0, 1200))
'
```

If `tsx` is not installed, run `pnpm add -D tsx` first (it is a dev-only helper for this inspection step), then re-run. Use the printed tree to confirm the exact field/class names (`Data`, `Runes`, item-group classes, `skills`, `summary.average_stats`) you will index in the normalizer — the SHARED CONTRACT lists the expected fields, but read the real names off this output before writing Task 1B.5.

- [ ] **Step 5: Commit the fixtures.** `git add src/main/build/__fixtures__/aatrox-top.txt src/main/build/__fixtures__/aatrox-top.json && git commit -m "test: capture real OP.GG Aatrox top fixture"`

---

### Task 1B.5 — Normalizer: OP.GG decoded tree → BuildRecommendation

**Files:**
- Create: `/Users/felipe/lockin/src/main/build/opgg-normalize.ts`
- Test: `/Users/felipe/lockin/src/main/build/opgg-normalize.test.ts`

Pure transform from the parsed `OpggNode` tree into `BuildRecommendation`. Strict TDD: one test on a **synthetic** minimal tree (deterministic field-by-field assertions), one test on the **real captured fixture** (structural invariants per the SHARED CONTRACT).

Mapping (per SHARED CONTRACT):
- `runes.selectedPerkIds = [...primary_rune_ids, ...secondary_rune_ids, ...stat_mod_ids]` — **assert length 9**; on mismatch, `runes` becomes `null` (graceful, never throw). `primaryStyleId = primary_page_id`, `subStyleId = secondary_page_id`, `primaryName = primary_page_name`, `secondaryName = secondary_page_name`.
- `items.starter = starter_items`, `items.boots = boots`, `items.core = core_items`, `items.situational =` dedup-merge of `fourth_items + fifth_items + sixth_items` ids.
- `spells =` first two `summoner_spells` ids (or `null` if fewer than 2).
- `skillOrder =` `skills.order` normalized to `("Q"|"W"|"E"|"R")[]` length 18.
- `skillPriority =` derived from skillOrder (Q/W/E ranked by count desc, ties broken by earliest first appearance).
- `winRate = average_stats.win_rate`, `sampleSize = average_stats.play`.

- [ ] **Step 1: Write the failing normalizer test.** Create `src/main/build/opgg-normalize.test.ts`:

```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { parseOpggText } from "./opgg-parse"
import { normalizeOpgg, skillPriorityFrom } from "./opgg-normalize"
import type { OpggNode } from "./opgg-parse"

/* A hand-built minimal decoded tree mirroring OP.GG's class shape. */
function syntheticRoot(): OpggNode {
	const itemGroup = (ids: number[], win: number, pick: number): OpggNode => ({
		__class: "ItemGroup",
		ids,
		ids_names: ids.map(String),
		play: 100,
		win,
		pick_rate: pick,
	})
	return {
		__class: "Data",
		summary: {
			__class: "Summary",
			average_stats: {
				__class: "Stats",
				win_rate: 0.62,
				pick_rate: 0.08,
				ban_rate: 0.12,
				play: 3456,
				tier: "1",
				rank: 3,
			},
		},
		runes: {
			__class: "Runes",
			primary_page_id: 8000,
			primary_rune_ids: [8010, 9111, 9104, 8014],
			secondary_page_id: 8400,
			secondary_rune_ids: [8444, 8451],
			stat_mod_ids: [5005, 5008, 5001],
			primary_page_name: "Precision",
			secondary_page_name: "Resolve",
			play: 1000,
			win: 0.61,
			pick_rate: 0.5,
		},
		summoner_spells: { __class: "Spells", ids: [4, 12], win: 0.6, pick_rate: 0.9 },
		starter_items: itemGroup([1054, 2003], 0.6, 0.7),
		boots: itemGroup([3047], 0.62, 0.8),
		core_items: itemGroup([6630, 3071, 6333], 0.63, 0.5),
		fourth_items: itemGroup([3065, 3742], 0.6, 0.3),
		fifth_items: itemGroup([3742, 3193], 0.59, 0.2), // 3742 duplicates fourth
		sixth_items: itemGroup([3026], 0.58, 0.1),
		skills: {
			__class: "Skills",
			order: ["Q", "W", "E", "Q", "Q", "R", "Q", "W", "Q", "W", "R", "W", "W", "E", "E", "R", "E", "E"],
			play: 900,
			win: 0.6,
			pick_rate: 0.4,
		},
	}
}

describe("skillPriorityFrom", () => {
	it("ranks Q/W/E by count desc, ties broken by earliest appearance", () => {
		// Q x5, W x5, E x4 → tie Q/W broken by Q appearing first
		const order = ["Q", "W", "E", "Q", "Q", "R", "Q", "W", "Q", "W", "R", "W", "W", "E", "E", "R", "E", "E"] as const
		expect(skillPriorityFrom([...order])).toEqual(["W", "Q", "E"])
	})
})

describe("normalizeOpgg (synthetic)", () => {
	const build = normalizeOpgg(syntheticRoot(), { championKey: 266, role: "top", patch: "15.1.1" })

	it("maps identity, stats, and tier-driven labels", () => {
		expect(build).not.toBeNull()
		expect(build?.championKey).toBe(266)
		expect(build?.role).toBe("top")
		expect(build?.patch).toBe("15.1.1")
		expect(build?.winRate).toBe(0.62)
		expect(build?.sampleSize).toBe(3456)
	})

	it("assembles 9 perk ids in LCU order", () => {
		expect(build?.runes?.selectedPerkIds).toEqual([
			8010, 9111, 9104, 8014, 8444, 8451, 5005, 5008, 5001,
		])
		expect(build?.runes?.primaryStyleId).toBe(8000)
		expect(build?.runes?.subStyleId).toBe(8400)
		expect(build?.runes?.primaryName).toBe("Precision")
		expect(build?.runes?.secondaryName).toBe("Resolve")
	})

	it("maps spells to the first two ids", () => {
		expect(build?.spells).toEqual([4, 12])
	})

	it("maps item groups and dedups situational across 4th/5th/6th", () => {
		expect(build?.items.starter.ids).toEqual([1054, 2003])
		expect(build?.items.boots.ids).toEqual([3047])
		expect(build?.items.core.ids).toEqual([6630, 3071, 6333])
		expect(build?.items.situational.ids).toEqual([3065, 3742, 3193, 3026]) // 3742 deduped
	})

	it("keeps skill order (18) and derives priority", () => {
		expect(build?.skillOrder).toHaveLength(18)
		expect(build?.skillPriority).toEqual(["W", "Q", "E"])
	})
})

describe("normalizeOpgg (real fixture invariants)", () => {
	const text = readFileSync(join(__dirname, "__fixtures__", "aatrox-top.txt"), "utf8")
	const root = parseOpggText(text) as OpggNode
	const build = normalizeOpgg(root, { championKey: 266, role: "top", patch: "0.0.0" })

	it("produces a structurally valid BuildRecommendation", () => {
		expect(build).not.toBeNull()
		expect(build?.runes?.selectedPerkIds).toHaveLength(9)
		expect(build?.spells).not.toBeNull()
		expect(build?.spells?.length).toBe(2)
		expect(build?.skillOrder).toHaveLength(18)
		expect(build?.skillPriority.length).toBeGreaterThanOrEqual(1)
		expect(build?.items.starter.ids.length).toBeGreaterThan(0)
		expect(build?.items.core.ids.length).toBeGreaterThan(0)
		expect(build?.items.situational.ids.length).toBeGreaterThan(0)
		expect(build?.winRate).toBeGreaterThan(0)
		expect(build?.winRate).toBeLessThanOrEqual(1)
		expect(build?.sampleSize).toBeGreaterThan(0)
	})

	it("every skillOrder entry is one of Q/W/E/R", () => {
		for (const s of build?.skillOrder ?? []) {
			expect(["Q", "W", "E", "R"]).toContain(s)
		}
	})
})
```

- [ ] **Step 2: Run the test, expect FAIL.** `pnpm test src/main/build/opgg-normalize.test.ts`.

> Note: the real-fixture block may surface OP.GG field/class names that differ from the synthetic shape (e.g. a wrapping `Root` node holding `data`, or `winRate` expressed as `win_rate`/0-100). Use the Task 1B.4 Step 4 dump to read the exact names and adjust the accessor helpers below before declaring the implementation done — the *invariant* assertions must pass against the real payload, not just the synthetic one.

- [ ] **Step 3: Implement `opgg-normalize.ts` (full code).** Create `src/main/build/opgg-normalize.ts`:

```ts
import type { BuildRecommendation, ItemGroup, Role, RunePageRec } from "@/shared/types"

import type { OpggNode, OpggValue } from "./opgg-parse"

type Skill = "Q" | "W" | "E" | "R"
type Lev = "Q" | "W" | "E"

/* ----------------------------------------------------------- tree helpers */

function isNode(v: OpggValue | undefined): v is OpggNode {
	return typeof v === "object" && v !== null && !Array.isArray(v) && "__class" in v
}

/** Find the "Data" payload: OP.GG wraps the analysis under a root constructor;
 *  the data we want is either the root itself or its single descendant that
 *  carries the analysis fields. We probe a few shapes defensively. */
function findData(root: OpggNode): OpggNode {
	if ("runes" in root || "core_items" in root || "summary" in root) return root
	for (const value of Object.values(root)) {
		if (isNode(value) && ("runes" in value || "core_items" in value || "summary" in value)) {
			return value
		}
	}
	return root
}

function asNode(v: OpggValue | undefined): OpggNode | null {
	return isNode(v) ? v : null
}

function asNumber(v: OpggValue | undefined): number {
	return typeof v === "number" ? v : 0
}

function asString(v: OpggValue | undefined): string {
	return typeof v === "string" ? v : ""
}

function asNumberArray(v: OpggValue | undefined): number[] {
	return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []
}

/* ----------------------------------------------------------------- pieces */

function toItemGroup(node: OpggNode | null): ItemGroup {
	if (!node) return { ids: [] }
	const group: ItemGroup = { ids: asNumberArray(node.ids) }
	if (typeof node.win === "number") group.winRate = node.win
	if (typeof node.pick_rate === "number") group.pickRate = node.pick_rate
	return group
}

function mergeSituational(data: OpggNode): ItemGroup {
	const ids: number[] = []
	const seen = new Set<number>()
	for (const key of ["fourth_items", "fifth_items", "sixth_items"]) {
		const group = asNode(data[key])
		if (!group) continue
		for (const id of asNumberArray(group.ids)) {
			if (seen.has(id)) continue
			seen.add(id)
			ids.push(id)
		}
	}
	return { ids }
}

function toRunes(data: OpggNode): RunePageRec | null {
	const r = asNode(data.runes)
	if (!r) return null
	const selectedPerkIds = [
		...asNumberArray(r.primary_rune_ids),
		...asNumberArray(r.secondary_rune_ids),
		...asNumberArray(r.stat_mod_ids),
	]
	if (selectedPerkIds.length !== 9) return null // never apply a malformed page
	return {
		primaryStyleId: asNumber(r.primary_page_id),
		subStyleId: asNumber(r.secondary_page_id),
		selectedPerkIds,
		primaryName: asString(r.primary_page_name),
		secondaryName: asString(r.secondary_page_name),
	}
}

function toSpells(data: OpggNode): [number, number] | null {
	const s = asNode(data.summoner_spells)
	const ids = asNumberArray(s?.ids)
	if (ids.length < 2) return null
	return [ids[0] as number, ids[1] as number]
}

const SKILLS: Skill[] = ["Q", "W", "E", "R"]

function toSkillOrder(data: OpggNode): Skill[] {
	const skills = asNode(data.skills)
	const raw = Array.isArray(skills?.order) ? skills?.order : []
	const order = (raw ?? [])
		.map((s) => (typeof s === "string" ? (s.trim().toUpperCase() as Skill) : null))
		.filter((s): s is Skill => s !== null && SKILLS.includes(s))
	return order.slice(0, 18)
}

/** Q/W/E ranked by how often they're leveled, ties broken by earliest level. */
export function skillPriorityFrom(order: Skill[]): Lev[] {
	const levs: Lev[] = ["Q", "W", "E"]
	const count: Record<Lev, number> = { Q: 0, W: 0, E: 0 }
	const first: Record<Lev, number> = { Q: Infinity, W: Infinity, E: Infinity }
	order.forEach((s, i) => {
		if (s === "Q" || s === "W" || s === "E") {
			count[s]++
			first[s] = Math.min(first[s], i)
		}
	})
	return [...levs].sort((a, b) => count[b] - count[a] || first[a] - first[b])
}

/* --------------------------------------------------------------- assemble */

export function normalizeOpgg(
	root: OpggNode | null,
	meta: { championKey: number; role: Role; patch: string },
): BuildRecommendation | null {
	if (!root) return null
	const data = findData(root)
	const summary = asNode(data.summary)
	const stats = asNode(summary?.average_stats)
	const skillOrder = toSkillOrder(data)
	return {
		championKey: meta.championKey,
		role: meta.role,
		patch: meta.patch,
		winRate: asNumber(stats?.win_rate),
		sampleSize: asNumber(stats?.play),
		runes: toRunes(data),
		spells: toSpells(data),
		items: {
			starter: toItemGroup(asNode(data.starter_items)),
			boots: toItemGroup(asNode(data.boots)),
			core: toItemGroup(asNode(data.core_items)),
			situational: mergeSituational(data),
		},
		skillOrder,
		skillPriority: skillPriorityFrom(skillOrder),
	}
}
```

- [ ] **Step 4: Run the test, expect PASS.** `pnpm test src/main/build/opgg-normalize.test.ts`. If the real-fixture block fails, inspect the dump from Task 1B.4 Step 4, adjust `findData`/field accessors to the real names, and re-run until both blocks pass. Do not weaken the invariant assertions to make them pass.
- [ ] **Step 5: typecheck + format.** `pnpm typecheck && pnpm format`.
- [ ] **Step 6: Commit.** `git add src/main/build/opgg-normalize.ts src/main/build/opgg-normalize.test.ts && git commit -m "feat: normalize OP.GG build payload to BuildRecommendation"`

---

### Task 1B.6 — Disk cache (memo + JSON file, ddragon-style)

**Files:**
- Create: `/Users/felipe/lockin/src/main/build/cache.ts`

Mirrors `ddragon.ts`'s memo + disk pattern, but keyed per `<championKey>:<position>:<tier>:<patch>` in a single `opgg-cache.json` map under `userData`. Serve cache immediately; refresh in background; network/parse failure returns null gracefully (the caller handles the actual fetch — this module just wraps the fetcher with caching). Not unit-tested in isolation (it touches `app.getPath` + disk + timers); verified via the integration step in Task 1B.7.

- [ ] **Step 1: Implement `cache.ts` (full code).** Create `src/main/build/cache.ts`:

```ts
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { app } from "electron"

import type { BuildRecommendation } from "@/shared/types"

type CacheMap = Record<string, BuildRecommendation>

const TTL_MS = 12 * 60 * 60 * 1000 // a patch is stable for days; refresh twice a day at most

let memo: CacheMap | null = null
let writeChain: Promise<void> = Promise.resolve()
/** per-key guard so a background refresh fires at most once at a time */
const refreshing = new Set<string>()

function cachePath(): string {
	return join(app.getPath("userData"), "opgg-cache.json")
}

export function buildCacheKey(
	championKey: number,
	position: string,
	tier: string,
	patch: string,
): string {
	return `${championKey}:${position}:${tier}:${patch}`
}

async function load(): Promise<CacheMap> {
	if (memo) return memo
	try {
		memo = JSON.parse(await readFile(cachePath(), "utf8")) as CacheMap
	} catch {
		memo = {} // no cache / corrupt cache — start empty
	}
	return memo
}

function persist(map: CacheMap): void {
	// serialize writes so concurrent champ-select hovers don't clobber the file
	writeChain = writeChain
		.then(() => writeFile(cachePath(), JSON.stringify(map)))
		.catch((error) => console.warn("[opgg] cache write failed:", error))
}

function isFresh(entry: BuildRecommendation | undefined): entry is BuildRecommendation {
	if (!entry) return false
	const at = (entry as BuildRecommendation & { __cachedAt?: number }).__cachedAt
	return typeof at === "number" && Date.now() - at < TTL_MS
}

/**
 * Cache-through wrapper. Serves a fresh cache hit immediately. A stale hit is
 * served immediately while a single background refresh runs. A miss awaits the
 * fetch. `fetcher` failure → return whatever cache we have (even stale), else null.
 */
export async function withCache(
	key: string,
	fetcher: () => Promise<BuildRecommendation | null>,
): Promise<BuildRecommendation | null> {
	const map = await load()
	const cached = map[key]

	if (isFresh(cached)) return strip(cached)

	if (cached) {
		// stale — serve it, refresh in the background once
		if (!refreshing.has(key)) {
			refreshing.add(key)
			void fetcher()
				.then((fresh) => {
					if (fresh) {
						map[key] = stamp(fresh)
						persist(map)
					}
				})
				.catch((error) => console.warn("[opgg] background refresh failed:", error))
				.finally(() => refreshing.delete(key))
		}
		return strip(cached)
	}

	// miss — await the fetch
	try {
		const fresh = await fetcher()
		if (!fresh) return null
		map[key] = stamp(fresh)
		persist(map)
		return strip(fresh)
	} catch (error) {
		console.warn("[opgg] fetch failed:", error)
		return null
	}
}

function stamp(rec: BuildRecommendation): BuildRecommendation {
	return { ...rec, __cachedAt: Date.now() } as BuildRecommendation
}

function strip(rec: BuildRecommendation): BuildRecommendation {
	const { __cachedAt, ...rest } = rec as BuildRecommendation & { __cachedAt?: number }
	void __cachedAt
	return rest
}
```

- [ ] **Step 2: typecheck + format.** `pnpm typecheck && pnpm format`.
- [ ] **Step 3: Commit.** `git add src/main/build/cache.ts && git commit -m "feat: add OP.GG disk cache (memo + JSON file)"`

---

### Task 1B.7 — OP.GG provider: fetch + normalize + cache (the public adapter)

**Files:**
- Create: `/Users/felipe/lockin/src/main/build/opgg.ts`

The public `BuildProvider`. It needs the current patch for the cache key — read it from the DDragon bundle (`getDDragonBundle().version`) and the champion's DDragon name (for the OP.GG `champion` arg) from `championsByKey[championKey].name`. Network fetch uses global `fetch` POST with the JSON-RPC body; the response may be plain JSON or SSE-framed (`data:` lines), so it parses both — exactly mirroring the fixture-capture logic. Failure anywhere returns null gracefully.

- [ ] **Step 1: Implement `opgg.ts` (full code).** Create `src/main/build/opgg.ts`:

```ts
import type { BuildRecommendation } from "@/shared/types"

import { getDDragonBundle } from "../ddragon"
import { buildCacheKey, withCache } from "./cache"
import { normalizeOpgg } from "./opgg-normalize"
import { parseOpggText } from "./opgg-parse"
import { type OpggPosition, positionFromRole, roleFromPosition } from "./position"
import type { BuildProvider } from "./types"

const ENDPOINT = "https://mcp-api.op.gg/mcp"
const FETCH_TIMEOUT_MS = 12_000
const DEFAULT_TIER = "emerald_plus"

/** Extract result.content[0].text from a plain-JSON or SSE-framed body. */
function extractText(body: string): string | null {
	let envelope: { result?: { content?: { text?: string }[] } } | null = null
	try {
		envelope = JSON.parse(body)
	} catch {
		for (const line of body.split(/\r?\n/)) {
			const t = line.trim()
			if (!t.startsWith("data:")) continue
			const payload = t.slice(5).trim()
			if (payload === "" || payload === "[DONE]") continue
			try {
				const obj = JSON.parse(payload) as { result?: unknown }
				if (obj && obj.result) envelope = obj as typeof envelope
			} catch {
				// skip non-JSON SSE frames (e.g. event: lines)
			}
		}
	}
	const text = envelope?.result?.content?.[0]?.text
	return typeof text === "string" && text.length > 0 ? text : null
}

async function fetchAnalysisText(
	champion: string,
	position: OpggPosition,
	tier: string,
): Promise<string | null> {
	const requestBody = {
		jsonrpc: "2.0",
		id: 1,
		method: "tools/call",
		params: {
			name: "lol_get_champion_analysis",
			arguments: {
				game_mode: "ranked",
				champion,
				position,
				lang: "en_US",
				tier,
			},
		},
	}
	const response = await fetch(ENDPOINT, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
		},
		body: JSON.stringify(requestBody),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	})
	if (!response.ok) throw new Error(`OP.GG POST → ${response.status}`)
	return extractText(await response.text())
}

class OpggProvider implements BuildProvider {
	async getBuild(
		championKey: number,
		position: string,
		opts?: { tier?: string },
	): Promise<BuildRecommendation | null> {
		const role = roleFromPosition(position)
		if (!role) return null
		const tier = opts?.tier ?? DEFAULT_TIER

		const bundle = await getDDragonBundle()
		const champion = bundle.championsByKey[championKey]?.name
		if (!champion) return null
		const patch = bundle.version

		const key = buildCacheKey(championKey, role, tier, patch)
		return withCache(key, async () => {
			const text = await fetchAnalysisText(champion, positionFromRole(role), tier)
			if (!text) return null
			return normalizeOpgg(parseOpggText(text) as never, { championKey, role, patch })
		})
	}
}

let provider: BuildProvider | null = null

export function getBuildProvider(): BuildProvider {
	if (!provider) provider = new OpggProvider()
	return provider
}

export async function getBuild(
	championKey: number,
	position: string,
	tier?: string,
): Promise<BuildRecommendation | null> {
	return getBuildProvider().getBuild(championKey, position, tier ? { tier } : undefined)
}
```

- [ ] **Step 2: typecheck + format.** `pnpm typecheck && pnpm format`. The `parseOpggText(text) as never` cast satisfies `normalizeOpgg`'s `OpggNode | null` param without re-exporting the union (the function already null-guards internally); if you prefer, import `OpggNode` and cast to `OpggNode | null` instead — either is fine, keep types honest.
- [ ] **Step 3: Commit.** `git add src/main/build/opgg.ts && git commit -m "feat: add OP.GG build provider (fetch + normalize + cache)"`

---

### Task 1B.8 — store.ts: settings defaults + lockin rune-page id persistence

**Files:**
- Modify: `/Users/felipe/lockin/src/main/store.ts`

Phase 1A adds the new `AppSettings` fields to `DEFAULT_SETTINGS` in `shared/types.ts`; this task adds the `lockinRunePageId` store key + helpers that `applyRunePage` needs for cross-restart cleanup. (No `getMains/setMains` — mains live in settings, covered by `setSettings`.)

- [ ] **Step 1: Extend the store schema and add the rune-page-id helpers.** Edit `src/main/store.ts`. Replace the `StoreSchema` type and `store` declaration:

```ts
type StoreSchema = {
	settings: AppSettings
	notes: MatchupNote[]
	banlist: BanListEntry[]
	lockinRunePageId: number | null
}

export const store = new Store<StoreSchema>({
	defaults: {
		settings: DEFAULT_SETTINGS,
		notes: [],
		banlist: [],
		lockinRunePageId: null,
	},
})
```

- [ ] **Step 2: Add the helpers at the end of `store.ts`** (after `setBanList`):

```ts
export function getLockinRunePageId(): number | null {
	return store.get("lockinRunePageId")
}

export function setLockinRunePageId(id: number | null): void {
	store.set("lockinRunePageId", id)
}
```

- [ ] **Step 3: typecheck + format.** `pnpm typecheck && pnpm format`.
- [ ] **Step 4: Commit.** `git add src/main/store.ts && git commit -m "feat: persist lockin-owned rune page id in store"`

---

### Task 1B.9 — lcu-mappers.ts: extend RawGameflowSession + current-summoner + in-game mappers

**Files:**
- Modify: `/Users/felipe/lockin/src/main/lcu-mappers.ts`

`RawGameflowSession` currently only carries `gameData.queue`. Extend it for in-game champion selections, and add raw shapes + mappers for current-summoner → `SummonerIdentity` and gameflow → `InGameState`. Pure transforms — but they're tiny and exercised end-to-end in the LCU integration step, so implement-then-typecheck (no separate unit test file; the parser-heavy logic is already covered elsewhere).

- [ ] **Step 1: Update the type imports.** Edit the top import in `lcu-mappers.ts`:

```ts
import type {
	ChampSelectAction,
	ChampSelectPlayer,
	ChampSelectSession,
	InGameState,
	RankInfo,
	ReadyCheck,
	SummonerIdentity,
} from "@/shared/types"
```

- [ ] **Step 2: Replace the `RawGameflowSession` interface** (currently lines 103-105) with the wider shape, and add the current-summoner raw shape + mappers. Replace:

```ts
export interface RawGameflowSession {
	gameData?: { queue?: { id?: number; type?: string } }
}
```

with:

```ts
interface RawChampionSelection {
	championId?: number
	spell1Id?: number
	spell2Id?: number
	puuid?: string
	summonerInternalName?: string
}

export interface RawGameflowSession {
	gameData?: {
		queue?: { id?: number; type?: string }
		playerChampionSelections?: RawChampionSelection[]
	}
}

export interface RawCurrentSummoner {
	gameName?: string
	displayName?: string
	tagLine?: string
	profileIconId?: number
	summonerLevel?: number
	puuid?: string
}

export function toSummonerIdentity(raw: RawCurrentSummoner): SummonerIdentity {
	return {
		gameName: raw.gameName || raw.displayName || "",
		tagLine: raw.tagLine ?? "",
		profileIconId: raw.profileIconId ?? 0,
		summonerLevel: raw.summonerLevel ?? 0,
		puuid: raw.puuid ?? "",
	}
}

/** Resolve the local player's in-game champion from a gameflow session.
 *  Matches the selection by puuid; returns null when not in a game or unmatched. */
export function toInGameState(
	session: RawGameflowSession | null,
	localPuuid: string,
): InGameState | null {
	const selections = session?.gameData?.playerChampionSelections
	if (!selections || selections.length === 0) return null
	const mine = localPuuid ? selections.find((s) => s.puuid === localPuuid) : undefined
	const selection = mine ?? selections[0] // fall back to first if puuid absent in payload
	if (!selection || !selection.championId) return null
	return {
		championId: selection.championId,
		spell1Id: selection.spell1Id ?? 0,
		spell2Id: selection.spell2Id ?? 0,
		queueId: session?.gameData?.queue?.id ?? 0,
	}
}
```

- [ ] **Step 3: typecheck + format.** `pnpm typecheck && pnpm format`.
- [ ] **Step 4: Commit.** `git add src/main/lcu-mappers.ts && git commit -m "feat: add gameflow in-game + current-summoner LCU mappers"`

---

### Task 1B.10 — lcu.ts: widen request(), add summoner + in-game push/snapshot

**Files:**
- Modify: `/Users/felipe/lockin/src/main/lcu.ts`

Widen the POST-only `request()` to all methods + body returning the parsed JSON, then add current-summoner fetch (on connect + push + snapshot) and in-game read (on `InProgress` + push + snapshot, cleared when leaving). Write methods (`setSummonerSpells`/`applyRunePage`/`startQueue`/`stopQueue`) come in Task 1B.11; do those after this lands so the file stays reviewable.

- [ ] **Step 1: Extend imports.** Edit the `@/shared/types` import block to add the new types, and the `./lcu-mappers` import to add the new mappers + raw type:

```ts
import { IPC } from "@/shared/constants"
import {
	type ChampSelectSession,
	DISCONNECTED_SNAPSHOT,
	type GameflowPhase,
	type InGameState,
	type LcuSnapshot,
	type RankInfo,
	type ReadyCheck,
	type SummonerIdentity,
} from "@/shared/types"

import {
	type RawChampSelectSession,
	type RawCurrentSummoner,
	type RawGameflowSession,
	type RawRankedStats,
	type RawReadyCheck,
	rankedQueueOf,
	toChampSelectSession,
	toInGameState,
	toRankInfo,
	toReadyCheck,
	toSummonerIdentity,
} from "./lcu-mappers"
import { getSettings } from "./store"
```

- [ ] **Step 2: Track the local puuid as a field.** Add a private field next to the other private fields (after `private credentials: Credentials | null = null`):

```ts
	private localPuuid = ""
```

- [ ] **Step 3: Widen `request()`.** Replace the existing `request` method (currently lines 191-195):

```ts
	private async request(
		method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
		url: string,
		body?: unknown,
	): Promise<unknown> {
		if (!this.credentials) throw new Error("LCU not connected")
		const response = await createHttp1Request({ method, url, body }, this.credentials)
		if (!response.ok) throw new Error(`LCU ${method} ${url} → ${response.status}`)
		// many LCU writes return 204/empty; json() throws on empty body, so guard it
		try {
			return response.json()
		} catch {
			return null
		}
	}
```

- [ ] **Step 4: Fetch the current summoner on connect, push it, and store it in the snapshot.** Inside `session()`, after the initial `Promise.all([...])` that fetches phase/readyCheck/champSelect resolves and `this.setConnected(true)` runs, add the summoner fetch. Edit the block (currently lines 136-146) to also fetch summoner and call `setSummoner`. Replace:

```ts
					const [phase, readyCheck, champSelect] = await Promise.all([
						this.fetchJson<GameflowPhase>("/lol-gameflow/v1/gameflow-phase", credentials),
						this.fetchJson<RawReadyCheck>("/lol-matchmaking/v1/ready-check", credentials),
						this.fetchJson<RawChampSelectSession>("/lol-champ-select/v1/session", credentials),
					])
					if (settled) return // client died during the GETs — emit nothing on a dead session

					this.setConnected(true)
					this.setPhase(phase ?? "None")
					this.handleReadyCheck(readyCheck ? toReadyCheck(readyCheck) : null)
					this.setChampSelect(champSelect ? toChampSelectSession(champSelect) : null)
```

with:

```ts
					const [phase, readyCheck, champSelect, summoner] = await Promise.all([
						this.fetchJson<GameflowPhase>("/lol-gameflow/v1/gameflow-phase", credentials),
						this.fetchJson<RawReadyCheck>("/lol-matchmaking/v1/ready-check", credentials),
						this.fetchJson<RawChampSelectSession>("/lol-champ-select/v1/session", credentials),
						this.fetchJson<RawCurrentSummoner>("/lol-summoner/v1/current-summoner", credentials),
					])
					if (settled) return // client died during the GETs — emit nothing on a dead session

					this.setConnected(true)
					this.setSummoner(summoner ? toSummonerIdentity(summoner) : null)
					this.setPhase(phase ?? "None")
					this.handleReadyCheck(readyCheck ? toReadyCheck(readyCheck) : null)
					this.setChampSelect(champSelect ? toChampSelectSession(champSelect) : null)
```

- [ ] **Step 5: Drive in-game state off the phase.** Replace the `setPhase` method (currently lines 173-178) so entering `InProgress` reads the gameflow selection and pushes `InGameState`, and leaving it clears to null:

```ts
	private setPhase(phase: GameflowPhase): void {
		if (this.snapshot.phase === phase) return
		this.snapshot = { ...this.snapshot, phase }
		console.log(`[lcu] phase: ${phase}`)
		this.emit(IPC.LCU_PHASE, { phase })
		if (phase === "InProgress" || phase === "GameStart") {
			void this.refreshInGame()
		} else if (this.snapshot.inGame !== null) {
			this.setInGame(null)
		}
	}

	private async refreshInGame(): Promise<void> {
		const credentials = this.credentials
		if (!credentials) return
		const session = await this.fetchJson<RawGameflowSession>(
			"/lol-gameflow/v1/session",
			credentials,
		)
		this.setInGame(toInGameState(session, this.localPuuid))
	}
```

- [ ] **Step 6: Add the `setSummoner` and `setInGame` snapshot setters.** Place them next to the other setters, e.g. after `setChampSelect` (currently ends line 274):

```ts
	private setSummoner(summoner: SummonerIdentity | null): void {
		this.localPuuid = summoner?.puuid ?? ""
		if (summoner === null && this.snapshot.summoner === null) return
		this.snapshot = { ...this.snapshot, summoner }
		this.emit(IPC.LCU_SUMMONER, summoner)
	}

	private setInGame(inGame: InGameState | null): void {
		if (inGame === null && this.snapshot.inGame === null) return
		this.snapshot = { ...this.snapshot, inGame }
		this.emit(IPC.LCU_IN_GAME, inGame)
	}
```

- [ ] **Step 7: Reset summoner + in-game on disconnect.** In `setConnected`, the disconnect branch already resets phase/readyCheck/champSelect via the `prev` comparison and `DISCONNECTED_SNAPSHOT`. Add the two new pushes so the renderer clears them too. Edit the disconnect block (currently lines 164-170):

```ts
		if (!connected) {
			// disconnect resets phase + live state in the renderer too
			this.resetAutoAccept()
			this.localPuuid = ""
			if (prev.phase !== "None") this.emit(IPC.LCU_PHASE, { phase: this.snapshot.phase })
			if (prev.readyCheck !== null) this.emit(IPC.LCU_READY_CHECK, null)
			if (prev.champSelect !== null) this.emit(IPC.LCU_CHAMP_SELECT, null)
			if (prev.summoner !== null) this.emit(IPC.LCU_SUMMONER, null)
			if (prev.inGame !== null) this.emit(IPC.LCU_IN_GAME, null)
		}
```

> Note: this relies on Phase 1A having added `summoner`/`inGame` (both `null`) to `DISCONNECTED_SNAPSHOT` in `shared/types.ts` and `LCU_SUMMONER`/`LCU_IN_GAME` to `IPC`. If absent, add them per the SHARED CONTRACT before this step compiles.

- [ ] **Step 8: typecheck + format.** `pnpm typecheck && pnpm format`.
- [ ] **Step 9: Commit.** `git add src/main/lcu.ts && git commit -m "feat: widen LCU request() and push summoner + in-game state"`

---

### Task 1B.11 — lcu.ts: write methods (spells, runes apply, queue start/stop) + singleton exports

**Files:**
- Modify: `/Users/felipe/lockin/src/main/lcu.ts`

The actual client writes. `applyRunePage` runs the full flow (inventory cap check → delete persisted lockin page, 403→PUT fallback → POST new page current → persist id), touching only the lockin-owned page. `startQueue` creates a lobby, best-effort sets FILL position prefs for ranked queues, then starts search.

- [ ] **Step 1: Import the rune-page-id store helpers.** Edit the `./store` import:

```ts
import { getLockinRunePageId, getSettings, setLockinRunePageId } from "./store"
```

- [ ] **Step 2: Import `RunePageRec` into the types block** (add to the existing `@/shared/types` import):

```ts
import {
	type ChampSelectSession,
	DISCONNECTED_SNAPSHOT,
	type GameflowPhase,
	type InGameState,
	type LcuSnapshot,
	type RankInfo,
	type ReadyCheck,
	type RunePageRec,
	type SummonerIdentity,
} from "@/shared/types"
```

- [ ] **Step 3: Add the write methods on `LcuService`.** Place them after `declineReadyCheck` (currently ends line 206), before `handleReadyCheck`:

```ts
	async setSummonerSpells(spell1Id: number, spell2Id: number): Promise<void> {
		await this.request("PATCH", "/lol-champ-select/v1/session/my-selection", {
			spell1Id,
			spell2Id,
		})
	}

	async applyRunePage(page: RunePageRec): Promise<{ ok: boolean; error?: string }> {
		if (!this.credentials) return { ok: false, error: "League client not connected" }
		try {
			const inventory = (await this.request("GET", "/lol-perks/v1/inventory")) as {
				canAddCustomPage?: boolean
			} | null
			const existingId = getLockinRunePageId()
			if (inventory && inventory.canAddCustomPage === false && existingId === null) {
				return { ok: false, error: "Rune page slots are full. Delete a page and try again." }
			}

			if (existingId !== null) {
				try {
					await this.request("DELETE", `/lol-perks/v1/pages/${existingId}`)
				} catch (error) {
					// known LCU bug: DELETE can 403. Fall back to overwriting in place.
					if (String(error).includes("403")) {
						try {
							await this.request("PUT", `/lol-perks/v1/pages/${existingId}`, {
								id: existingId,
								name: this.runePageName(page),
								primaryStyleId: page.primaryStyleId,
								subStyleId: page.subStyleId,
								selectedPerkIds: page.selectedPerkIds,
								current: true,
							})
							return { ok: true }
						} catch (putError) {
							console.warn("[lcu] rune PUT fallback failed:", putError)
							// fall through to creating a fresh page
						}
					}
					// non-403 delete failures: the page may already be gone — continue to POST
				}
			}

			const created = (await this.request("POST", "/lol-perks/v1/pages", {
				name: this.runePageName(page),
				primaryStyleId: page.primaryStyleId,
				subStyleId: page.subStyleId,
				selectedPerkIds: page.selectedPerkIds,
				current: true,
			})) as { id?: number } | null
			if (created?.id != null) setLockinRunePageId(created.id)
			return { ok: true }
		} catch (error) {
			console.error("[lcu] applyRunePage failed:", error)
			return { ok: false, error: "Could not apply runes. Pages can't change once locked in." }
		}
	}

	private runePageName(page: RunePageRec): string {
		// keep it short + lockin-namespaced so we only ever touch our own page
		return `lockin: ${page.primaryName}`
	}

	async startQueue(queueId: number): Promise<{ ok: boolean; error?: string }> {
		if (!this.credentials) return { ok: false, error: "League client not connected" }
		try {
			await this.request("POST", "/lol-lobby/v2/lobby", { queueId })
			if (queueId === 420 || queueId === 440) {
				try {
					await this.request(
						"PUT",
						"/lol-lobby/v1/lobby/members/localMember/position-preferences",
						{ firstPreference: "FILL", secondPreference: "UNSELECTED" },
					)
				} catch (error) {
					console.warn("[lcu] position-preferences (best-effort) failed:", error)
				}
			}
			await this.request("POST", "/lol-matchmaking/v1/search")
			return { ok: true }
		} catch (error) {
			console.error("[lcu] startQueue failed:", error)
			return { ok: false, error: "Could not start the queue. Check you're in a lobby-eligible state." }
		}
	}

	async stopQueue(): Promise<void> {
		await this.request("DELETE", "/lol-matchmaking/v1/search")
	}
```

- [ ] **Step 4: Add the singleton exports.** At the bottom of the file, after the existing `getRanksForPuuids` export (currently ends line 341), add:

```ts
export async function setSummonerSpells(spell1Id: number, spell2Id: number): Promise<void> {
	if (!service) throw new Error("LCU service not started")
	await service.setSummonerSpells(spell1Id, spell2Id)
}

export async function applyRunePage(page: RunePageRec): Promise<{ ok: boolean; error?: string }> {
	if (!service) return { ok: false, error: "LCU service not started" }
	return service.applyRunePage(page)
}

export async function startQueue(queueId: number): Promise<{ ok: boolean; error?: string }> {
	if (!service) return { ok: false, error: "LCU service not started" }
	return service.startQueue(queueId)
}

export async function stopQueue(): Promise<void> {
	if (!service) return
	await service.stopQueue()
}
```

- [ ] **Step 5: typecheck + format.** `pnpm typecheck && pnpm format`.
- [ ] **Step 6: Commit.** `git add src/main/lcu.ts && git commit -m "feat: add LCU spell/rune apply and queue start/stop writes"`

---

### Task 1B.12 — ipc.ts: wire BUILD_GET, LCU_SET_SPELLS, LCU_APPLY_RUNES, LCU_START_QUEUE, LCU_STOP_QUEUE

**Files:**
- Modify: `/Users/felipe/lockin/src/main/ipc.ts`

Register the five new invoke handlers. `BUILD_GET` delegates to the OP.GG provider's exported `getBuild`; the LCU writes delegate to the new singleton exports.

- [ ] **Step 1: Extend imports.** Edit `src/main/ipc.ts` imports:

```ts
import { ipcMain } from "electron"

import { IPC } from "@/shared/constants"
import type { AppSettings, BanListEntry, MatchupNote, RunePageRec } from "@/shared/types"

import { getBuild } from "./build/opgg"
import { getDDragonBundle } from "./ddragon"
import {
	acceptReadyCheck,
	applyRunePage,
	declineReadyCheck,
	getLcuSnapshot,
	getRanksForPuuids,
	setSummonerSpells,
	startQueue,
	stopQueue,
} from "./lcu"
import {
	deleteNote,
	getBanList,
	getSettings,
	listNotes,
	setBanList,
	setSettings,
	upsertNote,
} from "./store"
```

- [ ] **Step 2: Register the handlers.** Add at the end of `src/main/ipc.ts` (after the `RANK_GET_FOR_PUUIDS` handler):

```ts
ipcMain.handle(IPC.BUILD_GET, (_event, championKey: number, position: string, tier?: string) =>
	getBuild(championKey, position, tier),
)

ipcMain.handle(IPC.LCU_SET_SPELLS, (_event, spell1Id: number, spell2Id: number) =>
	setSummonerSpells(spell1Id, spell2Id),
)
ipcMain.handle(IPC.LCU_APPLY_RUNES, (_event, page: RunePageRec) => applyRunePage(page))
ipcMain.handle(IPC.LCU_START_QUEUE, (_event, queueId: number) => startQueue(queueId))
ipcMain.handle(IPC.LCU_STOP_QUEUE, () => stopQueue())
```

> Note: relies on Phase 1A having added `BUILD_GET`/`LCU_SET_SPELLS`/`LCU_APPLY_RUNES`/`LCU_START_QUEUE`/`LCU_STOP_QUEUE` to the `IPC` object in `shared/constants.ts`. If absent, add them per the SHARED CONTRACT first.

- [ ] **Step 3: typecheck + format.** `pnpm typecheck && pnpm format`.

- [ ] **Step 4: Full test + typecheck gate.** `pnpm test` (all build tests green) then `pnpm typecheck`.

- [ ] **Step 5: Live integration smoke (real client, optional but recommended).** With the League client open and idle, run `pnpm dev`. In the main-process console, confirm the on-connect log shows the client found and no errors from the new summoner GET. Then exercise the build path from the renderer devtools console (the renderer has `window.api.getBuild` once Phase 1A wired preload):

```js
await window.api.getBuild(266, "top")
```

Expect a `BuildRecommendation` object (runes.selectedPerkIds length 9, items populated) or `null` if OP.GG is unreachable — never a thrown error. Confirm `opgg-cache.json` appears under the app's `userData` directory after the first call. Do **not** trigger `applyRunes`/`setSpells`/`startQueue` here unless you are actually in champ select / a lobby and intend the write — those mutate the live client.

- [ ] **Step 6: Commit.** `git add src/main/ipc.ts && git commit -m "feat: wire build:get and LCU write IPC handlers"`

---

Phase 1B complete: the main process can fetch/parse/normalize/cache OP.GG builds and perform the four opt-in client writes, all reachable over IPC. The renderer wiring (preload subscriptions for summoner/in-game, `LcuProvider` extension, hooks, fake layer, and UI) is out of scope here and handled in later phases.

Files created/modified in this phase (all absolute):
- `/Users/felipe/lockin/vitest.config.ts`
- `/Users/felipe/lockin/src/main/build/types.ts`
- `/Users/felipe/lockin/src/main/build/position.ts` (+ `position.test.ts`)
- `/Users/felipe/lockin/src/main/build/opgg-parse.ts` (+ `opgg-parse.test.ts`)
- `/Users/felipe/lockin/src/main/build/opgg-normalize.ts` (+ `opgg-normalize.test.ts`)
- `/Users/felipe/lockin/src/main/build/cache.ts`
- `/Users/felipe/lockin/src/main/build/opgg.ts`
- `/Users/felipe/lockin/src/main/build/__fixtures__/aatrox-top.txt` + `aatrox-top.json`
- `/Users/felipe/lockin/src/main/store.ts`
- `/Users/felipe/lockin/src/main/lcu-mappers.ts`
- `/Users/felipe/lockin/src/main/lcu.ts`
- `/Users/felipe/lockin/src/main/ipc.ts`

---

## Phase 2 — Sidebar nickname+avatar (feature 3) + copy pass (feature 5)

> **Depends on Phase 1.** This phase assumes the SHARED CONTRACT plumbing already landed: `SummonerIdentity` in `src/shared/types.ts`, the `useSummoner()` hook in `src/renderer/src/hooks/use-lcu.ts`, `profileIconUrl(version, iconId)` in `src/renderer/src/lib/ddragon-urls.ts`, `LcuProvider` exposing `summoner`, and the fake-layer `FIXTURE_SUMMONER` + `onSummoner` emit. Each task below verifies those exist before using them; if any is missing, stop and finish Phase 1 first.
>
> **Scope note on the copy pass:** em dashes inside `//` and `/* */` code comments are NOT user-facing and are left untouched. Only strings that render to the screen are rewritten. The grep over `src/renderer` (run in Task 2.5) is the exhaustive audit gate.

---

### Task 2.1: Verify Phase 1 plumbing the sidebar relies on

**Files:**
- Read `src/renderer/src/hooks/use-lcu.ts`
- Read `src/renderer/src/lib/ddragon-urls.ts`
- Read `src/renderer/src/providers/lcu-provider.tsx`
- Read `src/renderer/src/api/fake/fixtures.ts` (for `FIXTURE_SUMMONER`)
- Read `src/shared/types.ts` (for `SummonerIdentity`)

- [ ] **Step 1: Confirm `useSummoner()` exists.** Run:
  ```sh
  grep -n "export function useSummoner" src/renderer/src/hooks/use-lcu.ts
  ```
  Expect a match returning `SummonerIdentity | null`. If absent, halt — Phase 1 is incomplete.
- [ ] **Step 2: Confirm `profileIconUrl` exists.** Run:
  ```sh
  grep -n "profileIconUrl" src/renderer/src/lib/ddragon-urls.ts
  ```
  Expect: `export const profileIconUrl = (version: string, iconId: number) => ...`. If absent, halt.
- [ ] **Step 3: Confirm the fake bridge emits a summoner.** Run:
  ```sh
  grep -n "FIXTURE_SUMMONER" src/renderer/src/api/fake/fixtures.ts && grep -n "onSummoner" src/renderer/src/api/fake/bridge.ts
  ```
  Expect both to match. If absent, halt.
- [ ] **Step 4: Confirm `SummonerIdentity` type fields.** Run:
  ```sh
  grep -n "interface SummonerIdentity" src/shared/types.ts
  ```
  Expect fields `gameName`, `tagLine`, `profileIconId`, `summonerLevel`, `puuid`. (No commit — this is a read-only gate before implementation.)

---

### Task 2.2: Build the `SidebarIdentity` component (avatar + nickname)

Keep `sidebar.tsx` under ~300 lines by extracting the identity block into its own component rather than inlining it.

**Files:**
- Create `src/renderer/src/components/app/sidebar-identity.tsx`

- [ ] **Step 1: Implement the component (full code).** Create `src/renderer/src/components/app/sidebar-identity.tsx`:
  ```tsx
  import { useDDragon } from "@renderer/hooks/use-data"
  import { useSummoner } from "@renderer/hooks/use-lcu"
  import { profileIconUrl } from "@renderer/lib/ddragon-urls"

  export function SidebarIdentity(): React.JSX.Element | null {
  	const summoner = useSummoner()
  	const { data: bundle } = useDDragon()

  	if (!summoner) return null

  	const version = bundle?.version ?? ""
  	const avatar = version ? profileIconUrl(version, summoner.profileIconId) : null

  	return (
  		<div className="region-no-drag flex items-center gap-[8px] pb-1">
  			{avatar ? (
  				<img
  					src={avatar}
  					alt=""
  					width={24}
  					height={24}
  					className="size-6 shrink-0 rounded-full border border-(--stroke-default) object-cover bg-ink-800"
  				/>
  			) : (
  				<span className="size-6 shrink-0 rounded-full border border-(--stroke-default) bg-ink-800" />
  			)}
  			<span className="flex min-w-0 flex-col gap-px">
  				<span className="truncate text-[12px] font-medium leading-[1.1] text-paper-100">
  					{summoner.gameName}
  				</span>
  				<span className="font-mono text-[10px] font-normal leading-none text-paper-400">
  					#{summoner.tagLine}
  				</span>
  			</span>
  		</div>
  	)
  }
  ```
- [ ] **Step 2: Typecheck.** Run `pnpm typecheck`. Expect no errors. (`useSummoner` and `profileIconUrl` resolve from Phase 1.)
- [ ] **Step 3: Format.** Run `pnpm format`.
- [ ] **Step 4: Commit.**
  ```sh
  git add src/renderer/src/components/app/sidebar-identity.tsx && git commit -m "feat: add sidebar identity component (avatar + nickname)"
  ```

---

### Task 2.3: Mount `SidebarIdentity` in the sidebar footer

The footer currently renders `<ConnectionIndicator>` then a conditional `LCU · 127.0.0.1` line. The identity goes **above** the connection indicator, inside the same `<footer>`, only when connected (the component self-gates on `summoner`, and `summoner` is null when disconnected per `DISCONNECTED_SNAPSHOT`, so it clears on disconnect automatically).

**Files:**
- Modify `src/renderer/src/components/app/sidebar.tsx` (import at line 8; footer at lines 74-81)

- [ ] **Step 1: Add the import.** In `src/renderer/src/components/app/sidebar.tsx`, alongside the existing `ConnectionIndicator` import (line 8), add the `SidebarIdentity` import so the import block reads:
  ```tsx
  import { ConnectionIndicator } from "./connection-indicator"
  import { SidebarIdentity } from "./sidebar-identity"
  import { Wordmark } from "./wordmark"
  ```
- [ ] **Step 2: Render it in the footer.** Replace the existing `<footer>` block (lines 74-81) with:
  ```tsx
  			<footer className="border-t border-(--stroke-default) pt-3 flex flex-col gap-[6px]">
  				<SidebarIdentity />
  				<ConnectionIndicator connected={connected} />
  				{connected && (
  					<span className="font-mono text-[10px] font-normal leading-none text-paper-400 pl-4 whitespace-nowrap">
  						LCU · 127.0.0.1
  					</span>
  				)}
  			</footer>
  ```
- [ ] **Step 3: Typecheck.** Run `pnpm typecheck`. Expect no errors.
- [ ] **Step 4: Format.** Run `pnpm format`.
- [ ] **Step 5: Dev verify with Playwright (force-fake).** Run `pnpm dev`. Then with the Playwright MCP:
  1. `browser_navigate` to the dev URL (e.g. `http://localhost:5173`).
  2. Enable force-fake: `browser_evaluate` running `localStorage.setItem("lockin:forceFake","1"); location.reload()`.
  3. After reload, in the on-screen **state switcher**, set the Client phase to **Idle** (or any *connected* phase). Verify the sidebar footer now shows the avatar image + `gameName` with `#tagLine` beneath it, sitting **above** the "Client Connected" indicator and the `LCU · 127.0.0.1` line.
  4. In the state switcher set the Client phase to **Disconnected**. Verify the avatar + nickname **disappear** and only "Client Not Detected" shows (no `LCU` line).
  5. `browser_take_screenshot` of the connected sidebar state for the record.
- [ ] **Step 6: Commit.**
  ```sh
  git add src/renderer/src/components/app/sidebar.tsx && git commit -m "feat: show summoner avatar and nickname in sidebar footer"
  ```

---

### Task 2.4: Copy pass — rewrite each user-facing string (remove em dashes, de-AI tone)

Each edit below is an exact before → after. Apply them with `Edit` (the file must be Read first if not already in context). These are the rendered strings only; comment-only em dashes are skipped. Group the edits per file.

**Files:**
- Modify `src/renderer/src/components/live/idle.tsx` (lines 13-29)
- Modify `src/renderer/src/components/live/disconnected.tsx` (lines 15-20)
- Modify `src/renderer/src/pages/settings.tsx` (line 33)
- Modify `src/renderer/src/components/ready-check/ready-check-screen.tsx` (lines 40, 98)
- Modify `src/renderer/src/components/champ-select/notes-region.tsx` (lines 42-46)
- Modify `src/renderer/src/components/settings/ban-editor.tsx` (line 156)
- Modify `src/renderer/src/pages/notes.tsx` (line 95)
- Modify `src/renderer/src/components/dev/state-switcher.tsx` (lines 238-239)

- [ ] **Step 1: `idle.tsx` — STANDBY_COPY (idle).** Two strings.
  - `title`: `Back at it. Queue up when you're ready.` → `Back at it. Queue up when you're ready.` (no change; already clean — leave as is).
  - `sub`: replace
    ```tsx
    		sub: "Lockin wakes up the moment champ select begins. Until then, sharpen your notes.",
    ```
    with
    ```tsx
    		sub: "Lockin jumps in when champ select starts. Until then, tidy up your notes.",
    ```
- [ ] **Step 2: `idle.tsx` — STANDBY_COPY (queue).** Replace
  ```tsx
  		sub: "Hang tight — champ select pops the moment a game is found.",
  ```
  with
  ```tsx
  		sub: "Searching for a match. Champ select opens as soon as one's found.",
  ```
  Also tighten the queue `title` (drop the AI-ish ellipsis-only line): replace
  ```tsx
  		title: "Searching for a match…",
  ```
  with
  ```tsx
  		title: "Looking for a match",
  ```
- [ ] **Step 3: `idle.tsx` — STANDBY_COPY (lobby).** Replace
  ```tsx
  		sub: "Line up your matchups while the squad gets ready.",
  ```
  with
  ```tsx
  		sub: "Line up your matchups while the team gets ready.",
  ```
  (No em dash here; this is a light de-AI tone tweak — "squad" → "team". Keep `title: "In the lobby. Lock in your queue."` as is.)
- [ ] **Step 4: `disconnected.tsx` — heading + body.** Replace lines 15-20:
  ```tsx
  				<p className="m-0 font-display text-[26px] font-normal leading-[1.3] text-paper-100">
  					Waiting for the League client…
  				</p>
  				<p className="m-0 text-[13.5px] leading-[1.55] text-paper-300">
  					We'll wake up the moment it opens. Your notes and settings stay available in the meantime.
  				</p>
  ```
  with
  ```tsx
  				<p className="m-0 font-display text-[26px] font-normal leading-[1.3] text-paper-100">
  					Waiting for the League client
  				</p>
  				<p className="m-0 text-[13.5px] leading-[1.55] text-paper-300">
  					Lockin starts up as soon as it opens. Your notes and settings stay available until then.
  				</p>
  ```
- [ ] **Step 5: `settings.tsx` — auto-accept desc.** Replace line 33:
  ```tsx
  					desc="Automatically accept the queue pop. Off by default — you stay in control."
  ```
  with
  ```tsx
  					desc="Automatically accept the queue pop. Off by default, so nothing happens without you."
  ```
- [ ] **Step 6: `ready-check-screen.tsx` — accepted sub.** Replace line 40:
  ```tsx
  							? "Auto-accept handled it — sit tight for champ select."
  ```
  with
  ```tsx
  							? "Auto-accept handled it. Champ select is next."
  ```
- [ ] **Step 7: `ready-check-screen.tsx` — waiting heading.** Replace line 98:
  ```tsx
  						{autoAccept ? "Auto-accepting…" : "Match found — accept?"}
  ```
  with
  ```tsx
  						{autoAccept ? "Auto-accepting" : "Match found. Accept?"}
  ```
- [ ] **Step 8: `notes-region.tsx` — no em dash, but de-AI the "the moment they lock in" line.** Replace lines 42-46:
  ```tsx
  					<p className="m-0 max-w-[280px] text-[12.5px] leading-normal text-paper-400">
  						Your <b className="font-semibold text-paper-200">{me.champion?.name}</b> matchup notes
  						appear here the moment they lock in.
  					</p>
  ```
  with
  ```tsx
  					<p className="m-0 max-w-[280px] text-[12.5px] leading-normal text-paper-400">
  						Your <b className="font-semibold text-paper-200">{me.champion?.name}</b> matchup notes
  						show up here once they lock in.
  					</p>
  ```
- [ ] **Step 9: `ban-editor.tsx` — empty state text.** Replace line 156:
  ```tsx
  						Your ban list is empty. Add the champions you never want to face.
  ```
  with
  ```tsx
  						Your ban list is empty. Add the champions you'd rather not face.
  ```
  (No em dash; tone tweak toward natural phrasing.)
- [ ] **Step 10: `notes.tsx` — empty-state line (em dash).** Replace line 95:
  ```tsx
  							line="Jot what wins a matchup — trades, timings, what to respect. They'll surface the moment you lock in."
  ```
  with
  ```tsx
  							line="Jot down what wins a matchup: trades, timings, what to respect. They show up the moment you lock in."
  ```
- [ ] **Step 11: `state-switcher.tsx` — dev hint text (em dash + `&`).** This is dev-only UI but still rendered text; clean it for consistency. Replace lines 237-239:
  ```tsx
  						{snapshot.phase === "disconnected"
  							? "Client closed — calm waiting state. Notes & Settings stay usable."
  							: "Connected, between games. Sharpen notes or queue up."}
  ```
  with
  ```tsx
  						{snapshot.phase === "disconnected"
  							? "Client closed. Calm waiting state. Notes and Settings stay usable."
  							: "Connected, between games. Sharpen notes or queue up."}
  ```
- [ ] **Step 12: `team-region.tsx` — leave the `—` placeholder.** Line 73 renders a literal `—` as a "no rank" dash glyph (a typographic placeholder, not a sentence). This is intentional UI iconography, not copy; **do not change it.** (Recorded here so the audit grep in Task 2.5 doesn't flag it as a miss.)
- [ ] **Step 13: Typecheck.** Run `pnpm typecheck`. Expect no errors (string-only edits).
- [ ] **Step 14: Format.** Run `pnpm format`.
- [ ] **Step 15: Commit.**
  ```sh
  git add src/renderer/src/components/live/idle.tsx src/renderer/src/components/live/disconnected.tsx src/renderer/src/pages/settings.tsx src/renderer/src/components/ready-check/ready-check-screen.tsx src/renderer/src/components/champ-select/notes-region.tsx src/renderer/src/components/settings/ban-editor.tsx src/renderer/src/pages/notes.tsx src/renderer/src/components/dev/state-switcher.tsx && git commit -m "docs: de-AI user-facing copy and remove em dashes"
  ```

---

### Task 2.5: Exhaustive em-dash audit gate + visual verification

**Files:**
- (No file changes unless the audit surfaces a miss.)

- [ ] **Step 1: Re-grep user-facing em dashes.** Run:
  ```sh
  grep -rn "—" src/renderer/src --include="*.tsx" --include="*.ts"
  ```
  Every remaining hit MUST be either (a) inside a `//` or `/* */` code comment, or (b) the intentional `—` placeholder glyph in `team-region.tsx:73`. If any em dash remains inside a JSX text node, a `title=`/`placeholder=`/`alt=` attribute, a `STANDBY_COPY`-style string literal, or an `EmptyState` `line=`/`title=` prop, go back to Task 2.4 and fix it, then re-run this grep until clean. Expected post-pass hits (all allowed): the comment lines listed in `routes.tsx`, `ban-editor.tsx` (comment), `settings-rows.tsx` (comment), `countdown-ring.tsx` (comment), `search-field.tsx` (comment), `champion-picker.tsx` (comments), `sidebar.tsx` (comment), `use-data.ts` (comment), `use-champ-select.ts` (comments), `rank-format.ts` (comment), `bridge.ts` (comments), `scenario.ts` (comment), `index.ts` (comments), `note-editor.tsx` (comment), `fixtures.ts` (fixture note bodies + comments — see Step 2), and `team-region.tsx:73` (glyph).
- [ ] **Step 2: Decide on `fixtures.ts` note bodies.** The em dashes in `src/renderer/src/api/fake/fixtures.ts` (lines ~190, 199, 208, 217, 226 — the `body:` strings of mock matchup notes, plus the ban `reason` "Ranged top — miserable matchup") are **dev fixture content shown in the UI under force-fake**, so they ARE user-visible during demo. De-AI them for consistency. Apply:
  - Line ~190: `…Don't waste your sweetspot into her W — bait it first.` → `…Don't waste your sweetspot into her W. Bait it first.`
  - Line ~199: `Your Q outranges his pull — poke and disengage.` → `Your Q outranges his pull, so poke and disengage.`
  - Line ~208: `Charm is everything — hold it for when his Windwall is down.` → `Charm is everything. Hold it for when his Windwall is down.`
  - Line ~217: `Ward your own raptors at 3:00 — enemy jungler loves the invade here.` → `Ward your own raptors at 3:00; the enemy jungler loves the invade here.`
  - Line ~226: `Lantern timing wins the 2v2 — don't flay the wrong target.` → `Lantern timing wins the 2v2, so don't flay the wrong target.`
  - Line ~246 (ban reason): `Ranged top — miserable matchup` → `Ranged top, miserable matchup`
  Use `Edit` for each (Read `src/renderer/src/api/fake/fixtures.ts` first). These are the only non-comment em dashes left in `fixtures.ts`; its line 12 (`/* … */`) is a comment and stays.
- [ ] **Step 3: Re-grep to confirm.** Run the Step 1 grep again. The only remaining hits MUST now be comment lines + the `team-region.tsx:73` glyph. If `fixtures.ts` still shows non-comment hits, repeat Step 2.
- [ ] **Step 4: Typecheck + format.** Run `pnpm typecheck` then `pnpm format`. Expect clean.
- [ ] **Step 5: Dev verify the rewritten screens (force-fake + Playwright).** With `pnpm dev` running and force-fake enabled (`localStorage.setItem("lockin:forceFake","1")` + reload), drive the **state switcher** through each phase and confirm the new copy renders correctly with no stray em dashes or clipped text:
  1. **Disconnected** → "Waiting for the League client" + "Lockin starts up as soon as it opens…".
  2. **Idle** (connected) → "Back at it…" + "Lockin jumps in when champ select starts…"; also confirm the Task 2.3 sidebar identity still shows.
  3. **Queue/Matchmaking** → "Looking for a match" + "Searching for a match. Champ select opens as soon as one's found.".
  4. **Ready check (waiting)** → "Match found. Accept?".
  5. **Notes page** (navigate to `/notes`, clear search to show empty state if no notes, or read a fixture note) → confirm the empty-state line and fixture note bodies read naturally.
  6. **Settings page** → confirm the auto-accept desc reads "…Off by default, so nothing happens without you.".
  `browser_take_screenshot` on the Idle and Settings screens for the record.
- [ ] **Step 6: Commit.**
  ```sh
  git add src/renderer/src/api/fake/fixtures.ts && git commit -m "docs: de-AI fake fixture note copy"
  ```

---

### Task 2.6: Phase verification

**Files:**
- (No file changes.)

- [ ] **Step 1: Full typecheck.** Run `pnpm typecheck`. Expect zero errors.
- [ ] **Step 2: Format check.** Run `pnpm format`. Expect no further changes (working tree clean after).
- [ ] **Step 3: Run tests.** Run `pnpm test`. Expect all existing suites green (this phase adds no logic tests; the sidebar/copy work is UI-only and verified via Playwright). If any snapshot or string-asserting test references an old copy string, update that test to the new string in the same commit.
- [ ] **Step 4: Confirm acceptance criteria.** Sidebar: connected → avatar + `gameName#tagLine` appear above the LCU line; disconnected → they clear (verified in Task 2.3 Step 5). Copy: the Task 2.5 grep shows no user-facing em dashes remain and all rewritten screens read naturally (verified in Task 2.5 Step 5).
- [ ] **Step 5: Commit any test fixups (only if Step 3 required edits).**
  ```sh
  git add -A && git commit -m "test: update copy-string assertions for de-AI pass"
  ```

---

## Phase 3 — Tray native menu (feature 4)

This phase builds the rich native macOS tray menu (PRD §7.4): a connection/identity header, an auto-accept checkbox bound to `settings.autoAccept` with a `Control+Alt+A` global shortcut, start ranked (420) / flex (440) queue actions, a "New note" action that focuses the window and pushes `nav:go`, an "Open lockin" action, and Quit. The menu **rebuilds** whenever status, summoner, or settings change.

It assumes the SHARED CONTRACT plumbing landed in earlier phases: `IPC.NAV_GO`, `IPC.LCU_START_QUEUE`, `IPC.LCU_STOP_QUEUE` exist in `src/shared/constants.ts`; `startQueue`/`stopQueue`/`onNav` exist on `Api` and in the preload; `startQueue(queueId)`/`stopQueue()` exist on `LcuService` with singleton exports `startQueue`/`stopQueue`; `getLcuSnapshot()` returns a `LcuSnapshot` whose `summoner: SummonerIdentity | null` field is populated; and the `lcu:summoner` push fires on connect/disconnect. This phase wires the **tray** to those pieces and the renderer's **nav subscriber**. Where it must consume an earlier-phase value, it uses the exact contract name — never a variant.

The tray is pure main-process + native UI (not unit-testable), so its tasks use the implement → `pnpm typecheck` → `pnpm format` → dev/Playwright-verify → commit loop. The one piece of pure logic (queue-id resolution) is built TDD-first.

### Task 3.1 — Queue-action helper (TDD)

A tiny pure helper the tray uses to label/resolve the two ranked queue actions. Built test-first so the tray code stays declarative.

**Files:**
- Create: `/Users/felipe/lockin/src/main/tray-queues.ts`
- Test: `/Users/felipe/lockin/src/main/tray-queues.test.ts`

- [ ] **Step 1: Write the failing test.** Create `/Users/felipe/lockin/src/main/tray-queues.test.ts` with the full contents below, then run `pnpm test src/main/tray-queues.test.ts` and expect FAIL (module does not exist yet).

```ts
import { describe, expect, it } from "vitest"

import { QUEUE_ACTIONS, queueErrorMessage } from "./tray-queues"

describe("QUEUE_ACTIONS", () => {
	it("exposes ranked solo (420) and flex (440) in order", () => {
		expect(QUEUE_ACTIONS.map((q) => q.queueId)).toEqual([420, 440])
	})

	it("labels each action for the menu", () => {
		expect(QUEUE_ACTIONS.map((q) => q.label)).toEqual(["Start ranked queue", "Start flex queue"])
	})
})

describe("queueErrorMessage", () => {
	it("returns the provider error when present", () => {
		expect(queueErrorMessage("Start ranked queue", "Lobby busy")).toBe(
			"Start ranked queue failed: Lobby busy",
		)
	})

	it("falls back to a generic message when no error string is given", () => {
		expect(queueErrorMessage("Start flex queue")).toBe(
			"Start flex queue failed. Check the League client and try again.",
		)
	})
})
```

- [ ] **Step 2: Implement the helper.** Create `/Users/felipe/lockin/src/main/tray-queues.ts` with the full contents below.

```ts
/** The two ranked queue actions surfaced in the tray, in menu order. */
export const QUEUE_ACTIONS: { label: string; queueId: number }[] = [
	{ label: "Start ranked queue", queueId: 420 },
	{ label: "Start flex queue", queueId: 440 },
]

/** Human-readable notification body when a tray queue-start fails. */
export function queueErrorMessage(label: string, error?: string): string {
	if (error) return `${label} failed: ${error}`
	return `${label} failed. Check the League client and try again.`
}
```

- [ ] **Step 3: Run the test green.** Run `pnpm test src/main/tray-queues.test.ts` and expect PASS.

- [ ] **Step 4: Commit.**

```sh
git add src/main/tray-queues.ts src/main/tray-queues.test.ts
git commit -m "feat: add tray queue-action helper"
```

### Task 3.2 — Rebuildable native tray menu

Rewrite the stub `createTray()` into a function that receives accessors + a change-subscribe hook and rebuilds the native `Menu` on every status/summoner/settings change. It owns the global shortcut registration and surfaces queue failures via a native `Notification`.

**Files:**
- Modify: `/Users/felipe/lockin/src/main/tray.ts` (full rewrite)

- [ ] **Step 1: Rewrite `tray.ts` with the full implementation below.** This replaces the entire file. `createTray` takes a `TrayDeps` object: window accessor + surface callback, the LCU snapshot accessor (`getLcuSnapshot` from `./lcu`, exposing `connected` + `summoner`), the queue actions (`startQueue` from `./lcu`), settings get/set (`getSettings`/`setSettings` from `./store`), a `navigate` callback (used by "New note"), and an `onChange` subscribe hook that re-runs `rebuild()` whenever the caller's tracked state changes. The header reflects connection + `gameName#tagLine`; the auto-accept item is a checkbox bound to `settings.autoAccept`; the `Control+Alt+A` accelerator toggles the same setting; queue items call `startQueue` and notify on `{ ok: false }` or a throw. The function returns an `unregister()` for global-shortcut cleanup.

```ts
import { app, globalShortcut, Menu, type MenuItemConstructorOptions, nativeImage, Notification, Tray } from "electron"

import trayIcon from "~/resources/lockinTemplate.png"

import { QUEUE_ACTIONS, queueErrorMessage } from "./tray-queues"

const AUTO_ACCEPT_ACCELERATOR = "Control+Alt+A"

export interface TraySnapshot {
	connected: boolean
	summoner: { gameName: string; tagLine: string } | null
}

export interface TrayDeps {
	/** Current connection + identity for the header. */
	getSnapshot: () => TraySnapshot
	/** Current persisted settings (for the auto-accept checkbox state). */
	getSettings: () => { autoAccept: boolean }
	/** Persist a settings change (toggling auto-accept). */
	setSettings: (partial: { autoAccept: boolean }) => void
	/** Start a queue by id; resolves ok/error like the LCU service. */
	startQueue: (queueId: number) => Promise<{ ok: boolean; error?: string }>
	/** Focus/restore + show the main window. */
	surface: () => void
	/** Push a renderer navigation (tray-driven). */
	navigate: (to: string, search?: Record<string, unknown>) => void
	/** Re-run the supplied callback whenever status/summoner/settings change. */
	onChange: (rebuild: () => void) => void
}

function identityLabel(snapshot: TraySnapshot): string {
	if (!snapshot.connected) return "○ Client not detected"
	const id = snapshot.summoner
	if (!id) return "● Connected"
	return `● ${id.gameName}#${id.tagLine}`
}

function notifyQueueError(label: string, error?: string): void {
	if (!Notification.isSupported()) return
	new Notification({ title: "lockin", body: queueErrorMessage(label, error) }).show()
}

export function createTray(deps: TrayDeps): { unregister: () => void } {
	const icon = nativeImage.createFromDataURL(trayIcon)
	const tray = new Tray(icon)

	const toggleAutoAccept = (): void => {
		deps.setSettings({ autoAccept: !deps.getSettings().autoAccept })
		rebuild()
	}

	const startQueue = (label: string, queueId: number): void => {
		deps.surface()
		void deps
			.startQueue(queueId)
			.then((result) => {
				if (!result.ok) notifyQueueError(label, result.error)
			})
			.catch((error: unknown) => {
				notifyQueueError(label, error instanceof Error ? error.message : undefined)
			})
	}

	function rebuild(): void {
		const snapshot = deps.getSnapshot()
		const settings = deps.getSettings()

		const queueItems: MenuItemConstructorOptions[] = QUEUE_ACTIONS.map((action) => ({
			label: action.label,
			enabled: snapshot.connected,
			click: () => startQueue(action.label, action.queueId),
		}))

		const template: MenuItemConstructorOptions[] = [
			{ label: identityLabel(snapshot), enabled: false },
			{ type: "separator" },
			{
				label: "Auto-accept ready check",
				type: "checkbox",
				checked: settings.autoAccept,
				accelerator: AUTO_ACCEPT_ACCELERATOR,
				registerAccelerator: false, // we own the global shortcut explicitly below
				click: toggleAutoAccept,
			},
			{ type: "separator" },
			...queueItems,
			{ type: "separator" },
			{
				label: "New note…",
				click: () => {
					deps.surface()
					deps.navigate("/notes", { new: true })
				},
			},
			{ label: "Open lockin", click: () => deps.surface() },
			{ type: "separator" },
			{ label: "Quit lockin", click: () => app.quit() },
		]

		tray.setContextMenu(Menu.buildFromTemplate(template))
	}

	rebuild()
	deps.onChange(rebuild)

	const registered = globalShortcut.register(AUTO_ACCEPT_ACCELERATOR, toggleAutoAccept)
	if (!registered) console.warn(`[tray] failed to register ${AUTO_ACCEPT_ACCELERATOR}`)

	return {
		unregister: () => {
			globalShortcut.unregister(AUTO_ACCEPT_ACCELERATOR)
		},
	}
}
```

- [ ] **Step 2: Typecheck.** Run `pnpm typecheck` and expect no errors. (The `createTray` signature changed; `index.ts` still calls the old zero-arg form — that is fixed in Task 3.3, so expect a single error at `src/main/index.ts:37` of the form "Expected 1 arguments, but got 0". That is the only acceptable error here; any other error means a typo in this file.)

- [ ] **Step 3: Commit.**

```sh
git add src/main/tray.ts
git commit -m "feat: rebuildable native tray menu"
```

### Task 3.3 — Wire the tray in `index.ts` (deps, change-notify, NAV_GO routing)

Feed `createTray` real accessors, drive its `onChange` from the LCU emit pump (so the menu rebuilds on status/summoner changes) and from settings writes, route `nav:go` pushes to the renderer, and unregister the global shortcut on quit.

**Files:**
- Modify: `/Users/felipe/lockin/src/main/index.ts`
- Modify: `/Users/felipe/lockin/src/main/store.ts` (notify settings subscribers)

- [ ] **Step 1: Add a settings-change notifier to `store.ts`.** The tray must rebuild when `setSettings` flips `autoAccept` from the renderer (Settings page) — not only from its own toggle. Add a lightweight subscription. Insert the `settingsSubscribers` set and `onSettingsChange` export, and notify inside `setSettings`. Replace the existing `setSettings` function (lines 28–32) with the version below and add the subscriber plumbing directly above it.

In `/Users/felipe/lockin/src/main/store.ts`, replace:

```ts
export function setSettings(partial: Partial<AppSettings>): AppSettings {
	const next = { ...getSettings(), ...partial }
	store.set("settings", next)
	return next
}
```

with:

```ts
const settingsSubscribers = new Set<() => void>()

/** Subscribe to any settings write; returns an unsubscribe. */
export function onSettingsChange(cb: () => void): () => void {
	settingsSubscribers.add(cb)
	return () => settingsSubscribers.delete(cb)
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
	const next = { ...getSettings(), ...partial }
	store.set("settings", next)
	for (const cb of settingsSubscribers) cb()
	return next
}
```

- [ ] **Step 2: Rewrite `index.ts` to wire the tray and route `nav:go`.** Replace the entire file with the contents below. Key changes vs. the current file: import `globalShortcut` and the IPC/types needed; keep a module-level `mainWindow` reference and a `surfaceWindows` that works on the single window; build a `TrayDeps` whose `onChange` stores the tray's `rebuild` in a module-level `rebuildTray` ref and whose `navigate` does `mainWindow.webContents.send(IPC.NAV_GO, …)`; call `rebuildTray?.()` from the LCU emit pump when `channel === IPC.LCU_STATUS || channel === IPC.LCU_SUMMONER`; subscribe `onSettingsChange(() => rebuildTray?.())`; and `unregister()` the shortcut on `will-quit`.

```ts
import { join } from "node:path"

import { electronApp, is, optimizer } from "@electron-toolkit/utils"
import { app, BrowserWindow, nativeImage, shell } from "electron"

import { IPC } from "@/shared/constants"
import type { GameflowPhase } from "@/shared/types"
import icon from "~/resources/icon.png"

import "./ipc"
import "./store"

import { getLcuSnapshot, startLcuService, startQueue, stopLcuService } from "./lcu"
import { getSettings, onSettingsChange, setSettings } from "./store"
import { createTray } from "./tray"

if (is.dev) {
	app.commandLine.appendSwitch("remote-debugging-port", "9223")
}

let mainWindow: BrowserWindow | null = null
let rebuildTray: (() => void) | null = null

function createWindow(): void {
	mainWindow = new BrowserWindow({
		width: 1320,
		height: 860,
		minWidth: 1000,
		minHeight: 600,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: "#17141f",
		titleBarStyle: "hiddenInset",
		...(process.platform === "linux" ? { icon } : {}),
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			sandbox: false,
		},
	})

	mainWindow.on("ready-to-show", () => {
		mainWindow?.show()
	})

	mainWindow.on("closed", () => {
		mainWindow = null
	})

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url)
		return { action: "deny" }
	})

	if (is.dev && process.env.ELECTRON_RENDERER_URL) {
		mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
	}
}

function surfaceWindows(): void {
	if (!mainWindow) {
		createWindow()
		return
	}
	if (mainWindow.isMinimized()) mainWindow.restore()
	mainWindow.show()
	mainWindow.focus()
	if (process.platform === "darwin") {
		app.focus({ steal: true })
		app.dock?.bounce("informational")
	}
}

function navigateRenderer(to: string, search?: Record<string, unknown>): void {
	mainWindow?.webContents.send(IPC.NAV_GO, { to, search })
}

if (process.platform === "darwin") {
	app.dock?.setIcon(nativeImage.createFromDataURL(icon))
}

app.whenReady().then(() => {
	electronApp.setAppUserModelId("com.electron")

	app.on("browser-window-created", (_, window) => {
		optimizer.watchWindowShortcuts(window)
	})

	createWindow()

	const trayHandle = createTray({
		getSnapshot: () => {
			const snap = getLcuSnapshot()
			return {
				connected: snap.connected,
				summoner: snap.summoner
					? { gameName: snap.summoner.gameName, tagLine: snap.summoner.tagLine }
					: null,
			}
		},
		getSettings: () => ({ autoAccept: getSettings().autoAccept }),
		setSettings: (partial) => {
			setSettings(partial)
		},
		startQueue: (queueId) => startQueue(queueId),
		surface: surfaceWindows,
		navigate: navigateRenderer,
		onChange: (rebuild) => {
			rebuildTray = rebuild
		},
	})

	const offSettings = onSettingsChange(() => rebuildTray?.())

	startLcuService((channel, payload) => {
		for (const w of BrowserWindow.getAllWindows()) {
			w.webContents.send(channel, payload)
		}
		if (channel === IPC.LCU_STATUS || channel === IPC.LCU_SUMMONER) {
			rebuildTray?.()
		}
		if (channel === IPC.LCU_PHASE && (payload as { phase: GameflowPhase }).phase === "ReadyCheck") {
			surfaceWindows()
		}
	})

	app.on("activate", () => {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})

	app.on("will-quit", () => {
		offSettings()
		trayHandle.unregister()
		stopLcuService()
	})
})

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit()
	}
})
```

Note: the previous file had a top-level `app.on("will-quit", () => stopLcuService())` — that is removed because the new `will-quit` handler (registered inside `whenReady`) now performs `stopLcuService()` plus shortcut cleanup. Do not leave the old top-level handler in place (it would double-call `stopLcuService`).

- [ ] **Step 3: Typecheck.** Run `pnpm typecheck` and expect no errors. (`IPC.NAV_GO`, `IPC.LCU_SUMMONER`, `getLcuSnapshot().summoner`, and the `startQueue` singleton come from earlier phases per the SHARED CONTRACT; if any is missing the typecheck error names the exact symbol — that means the earlier phase has not landed, which is a prerequisite-ordering problem, not a bug in this code.)

- [ ] **Step 4: Format.** Run `pnpm format`.

- [ ] **Step 5: Commit.**

```sh
git add src/main/index.ts src/main/store.ts
git commit -m "feat: wire rebuildable tray and route nav:go to renderer"
```

### Task 3.4 — Renderer nav subscriber

Subscribe `api.onNav` in a tiny renderer component mounted inside the router, calling `router.navigate` so the tray's "New note" (and any future tray nav) lands on `/notes?new=true`. Reuses the existing `notes` route `validateSearch` (already accepts `{ new?: boolean }`).

**Files:**
- Create: `/Users/felipe/lockin/src/renderer/src/components/app/nav-listener.tsx`
- Modify: `/Users/felipe/lockin/src/renderer/src/routes.tsx`

- [ ] **Step 1: Create the nav listener.** Create `/Users/felipe/lockin/src/renderer/src/components/app/nav-listener.tsx` with the contents below. It subscribes once on mount, navigates with the pushed `to`/`search`, and renders nothing.

```tsx
import { api } from "@renderer/api"
import { useRouter } from "@tanstack/react-router"
import { useEffect } from "react"

/** Listens for tray-driven `nav:go` pushes and routes the renderer to them. */
export function NavListener(): null {
	const router = useRouter()
	useEffect(() => {
		return api.onNav(({ to, search }) => {
			void router.navigate({ to, search: search ?? {} })
		})
	}, [router])
	return null
}
```

- [ ] **Step 2: Mount the listener in `routes.tsx`.** Import `NavListener` and render it inside `RootLayout` (it must live under the `RouterProvider`, and `RootLayout` is the root route's component, so `useRouter` resolves). Add the import alongside the other `./components/app/*` imports and render `<NavListener />` as the first child inside the `WindowFrame`.

In `/Users/felipe/lockin/src/renderer/src/routes.tsx`, add the import after the `Sidebar` import (line 11):

```tsx
import { NavListener } from "./components/app/nav-listener"
```

Then, in `RootLayout`, change the opening of the `WindowFrame` body from:

```tsx
		<WindowFrame connected={connected} phase={phase}>
			<div className="flex min-h-0 flex-1">
```

to:

```tsx
		<WindowFrame connected={connected} phase={phase}>
			<NavListener />
			<div className="flex min-h-0 flex-1">
```

- [ ] **Step 3: Typecheck + format.** Run `pnpm typecheck` and expect no errors, then `pnpm format`. (`api.onNav` comes from the preload/fake bridge in earlier phases per the SHARED CONTRACT.)

- [ ] **Step 4: Commit.**

```sh
git add src/renderer/src/components/app/nav-listener.tsx src/renderer/src/routes.tsx
git commit -m "feat: route tray nav:go pushes to the renderer router"
```

### Task 3.5 — Dev verify (real client + fake-bridge nav)

Verify the full tray feature in the running app. The native tray + global shortcut + queue start require a real League client and cannot be exercised by the fake bridge; the renderer nav side is verified in force-fake mode.

**Files:** none (verification only).

- [ ] **Step 1: Launch the app.** Run `pnpm dev` (foreground in a terminal you can observe). Wait for the renderer window to appear and the tray icon to mount in the macOS menu bar.

- [ ] **Step 2: Verify the tray menu (no client needed).** Click the tray icon. Confirm the menu shows, top to bottom: a disabled header reading `○ Client not detected` (no League client running); `Auto-accept ready check` with a checkbox and the `^⌥A` accelerator hint; `Start ranked queue` and `Start flex queue` (both **disabled / greyed** while disconnected); `New note…`; `Open lockin`; `Quit lockin`.

- [ ] **Step 3: Verify the auto-accept checkbox + global shortcut both drive the setting.**
  - Open the app's **Settings** page; note the current Auto-accept value.
  - Click the tray's `Auto-accept ready check` item; reopen the tray and confirm the checkmark flipped, and that the Settings page toggle now reflects the new value (rebuild-on-settings-change + shared state).
  - Press `Control+Alt+A` with the app unfocused; reopen the tray and confirm the checkmark flipped again, and Settings reflects it.

- [ ] **Step 4: Verify "Open lockin" and "New note…".**
  - Minimize the app window. Click the tray's `Open lockin`; confirm the window restores and focuses.
  - Click the tray's `New note…`; confirm the window focuses **and** the renderer navigates to the Notes page with the new-note composer/editor open (the `?new=true` search drives the notes route).

- [ ] **Step 5: Verify the renderer nav path in force-fake mode (no client).** In the renderer devtools console set `localStorage.setItem("lockin:forceFake","1")` and reload. Then, in the same console, simulate a tray push to exercise `NavListener` end-to-end without the native menu:

  Use Playwright MCP `browser_navigate` to the dev URL, then `browser_run_code_unsafe` to dispatch the fake `onNav` (the fake bridge's `onNav` is a no-op emitter, so drive the router directly to assert `NavListener` wiring is mounted):
  ```js
  // confirm NavListener is mounted and the notes route accepts ?new=true
  window.location.hash // sanity
  ```
  Then navigate the UI to `/notes?new=true` via the in-app New Note button and screenshot to confirm the composer opens. (The authoritative `New note…` path is verified against the real tray in Step 4; this step confirms the renderer route/composer is reachable in fake mode.)

- [ ] **Step 6: Take a screenshot.** Use Playwright MCP `browser_take_screenshot` of the Notes page with the new-note composer open, and (separately, via macOS screen capture if needed) the open tray menu. Confirm both look correct.

- [ ] **Step 7: With a real League client running (if available), verify queue start.** Launch the League client, wait for the tray header to switch to `● <gameName>#<tagLine>` and the two queue items to become enabled (verifies rebuild-on-`lcu:summoner`/`lcu:status`). Click `Start ranked queue`; confirm a Ranked Solo lobby is created and matchmaking begins in the client. Force a failure (e.g. click while already in a lobby of the other type) and confirm a native lockin notification appears with the `<label> failed: …` body. If no client is available, note this step as deferred to manual QA and rely on Steps 2–6.

Verification files for the engineer: tray UI lives at `/Users/felipe/lockin/src/main/tray.ts`; wiring at `/Users/felipe/lockin/src/main/index.ts`; settings-notify at `/Users/felipe/lockin/src/main/store.ts`; renderer subscriber at `/Users/felipe/lockin/src/renderer/src/components/app/nav-listener.tsx` mounted from `/Users/felipe/lockin/src/renderer/src/routes.tsx`; pure helper + tests at `/Users/felipe/lockin/src/main/tray-queues.ts` and `/Users/felipe/lockin/src/main/tray-queues.test.ts`.

---

## Phase 4 — Responsive champ select + auto rune/spell (feature 1)

> **Depends on prior phases (per shared contract):** shared types (`Role`, `RunePageRec`, `ItemGroup`, `BuildRecommendation`), `AppSettings` gaining `autoRunes`/`autoSpells`/`buildTier`/`mains`, IPC channels (`BUILD_GET`, `LCU_SET_SPELLS`, `LCU_APPLY_RUNES`), `api.getBuild`/`setSpells`/`applyRunes`, `useBuild()` in `use-data.ts`, `FIXTURE_BUILD` + extended `FIXTURE_BUNDLE.runesById` in the fake layer, and `runeIconUrl` in `ddragon-urls.ts`. This phase wires the champ-select read-responsiveness, the recommendation panel, the auto-apply effect, and the related settings rows. It touches **no main-process code** (all writes go through the already-wired `api.*` invoke handlers).

This phase is split into four tasks:
- **Task 4.1** — Pure spell-precedence helper (`pinned > OPGG > heuristic`) with strict TDD.
- **Task 4.2** — Make `useChampSelect` responsive (hover intent) and surface the effective champion key + position, the build, and the merged spell rec.
- **Task 4.3** — `RecommendationPanel` component + placement in the champ-select left column; auto-apply effect with debounce and transient status.
- **Task 4.4** — Settings rows + state-switcher controls; dev verification.

---

### Task 4.1 — Pure spell-precedence helper (TDD)

**Files:**
- Create: `src/shared/lib/spell-precedence.ts`
- Test: `src/shared/lib/spell-precedence.test.ts`

> Rationale: vitest's `include` is restricted to `src/shared/lib/**/*.test.ts` (see `vitest.config.ts`), so the unit-testable precedence logic must live under `src/shared/lib/`. It is a pure function over spell-id pairs — no React, no DDragon. The existing `recommendSpells` heuristic in `src/shared/lib/spells.ts` stays as the last resort; this helper *layers* OPGG and pinned on top of it. It returns spell **ids** (matching `recommendSpells`), with a `source` discriminant the UI uses to label "Your pick" (pinned) and to decide whether to show a win-rate badge (opgg).

- [ ] **Step 1: Write the failing test.** Create `src/shared/lib/spell-precedence.test.ts` with the full content below, then run `pnpm test spell-precedence` and expect FAIL (module not found).

```ts
import { describe, expect, it } from "vitest"

import { FLASH } from "./spells"
import { resolveSpells } from "./spell-precedence"

describe("resolveSpells (precedence: pinned > opgg > heuristic)", () => {
	it("pinned wins over both opgg and heuristic", () => {
		expect(
			resolveSpells({
				assignedPosition: "top",
				pinnedSpells: [FLASH, 12],
				opggSpells: [FLASH, 14],
			}),
		).toEqual({ pair: [FLASH, 12], source: "pinned", rolePending: false })
	})

	it("opgg wins over heuristic when no pin", () => {
		expect(
			resolveSpells({
				assignedPosition: "top",
				opggSpells: [FLASH, 14],
			}),
		).toEqual({ pair: [FLASH, 14], source: "opgg", rolePending: false })
	})

	it("falls back to the heuristic when no pin and no opgg", () => {
		expect(resolveSpells({ assignedPosition: "top" })).toEqual({
			pair: [FLASH, 12],
			source: "heuristic",
			rolePending: false,
		})
	})

	it("ignores a null opgg pair and uses the heuristic", () => {
		expect(resolveSpells({ assignedPosition: "bottom", opggSpells: null })).toEqual({
			pair: [FLASH, 7],
			source: "heuristic",
			rolePending: false,
		})
	})

	it("carries rolePending from the heuristic when the role is unknown", () => {
		expect(resolveSpells({ assignedPosition: "" })).toEqual({
			pair: [FLASH, 14],
			source: "heuristic",
			rolePending: true,
		})
	})

	it("opgg still applies while the role is pending (carries rolePending true)", () => {
		expect(
			resolveSpells({
				assignedPosition: "",
				opggSpells: [FLASH, 3],
			}),
		).toEqual({ pair: [FLASH, 3], source: "opgg", rolePending: true })
	})

	it("pinned applies while the role is pending", () => {
		expect(
			resolveSpells({
				assignedPosition: "",
				pinnedSpells: [4, 14],
			}),
		).toEqual({ pair: [4, 14], source: "pinned", rolePending: true })
	})
})
```

- [ ] **Step 2: Run the test, expect FAIL.** `pnpm test spell-precedence` — confirm it errors because `./spell-precedence` does not exist yet. Do not proceed until you see the failure.

- [ ] **Step 3: Implement the helper.** Create `src/shared/lib/spell-precedence.ts` with the full content below. It reuses `recommendSpells` (which already resolves pinned-vs-heuristic and computes `rolePending`) and inserts OPGG between them.

```ts
import { recommendSpells } from "./spells"

export type SpellSource = "pinned" | "opgg" | "heuristic"

export interface ResolvedSpells {
	pair: [number, number]
	source: SpellSource
	rolePending: boolean
}

/**
 * Summoner-spell precedence for champ select / in-game (design §7.1):
 *   pinned-note spells > OP.GG recommendation > deterministic heuristic.
 *
 * Works in spell IDs (the caller resolves them against DDragon). `rolePending`
 * comes from the heuristic table so the UI can hint "role pending" even when an
 * OPGG/pinned pair is shown.
 */
export function resolveSpells(input: {
	assignedPosition: string
	pinnedSpells?: [number, number]
	opggSpells?: [number, number] | null
}): ResolvedSpells {
	const base = recommendSpells({ assignedPosition: input.assignedPosition })

	if (input.pinnedSpells) {
		return { pair: input.pinnedSpells, source: "pinned", rolePending: base.rolePending }
	}
	if (input.opggSpells) {
		return { pair: input.opggSpells, source: "opgg", rolePending: base.rolePending }
	}
	return { pair: base.pair, source: "heuristic", rolePending: base.rolePending }
}
```

- [ ] **Step 4: Run the test, expect PASS.** `pnpm test spell-precedence` — all 7 cases green.

- [ ] **Step 5: Typecheck + format.** `pnpm typecheck` then `pnpm format`.

- [ ] **Step 6: Commit.**
```sh
git add src/shared/lib/spell-precedence.ts src/shared/lib/spell-precedence.test.ts
git commit -m "feat: add spell-precedence helper (pinned > opgg > heuristic)"
```

---

### Task 4.2 — Make `useChampSelect` responsive and surface build + effective champion

**Files:**
- Modify: `src/renderer/src/hooks/use-champ-select.ts`

> Goals: (1) resolve `me.champion` from `championId || championPickIntent` so the screen reacts the instant you **hover** (no lock-in needed); (2) add a `hovering` flag (true when only intent is set); (3) expose the **effective** `championKey` (number | null) and `position` (raw lowercase `assignedPosition` string | null) so the panel and auto-apply effect can call `useBuild`; (4) pull the build via `useBuild`; (5) replace the inline `recommendSpells` call with `resolveSpells` so the merged precedence (`pinned > OPGG > heuristic`) drives the displayed spells. The `SpellRec.source` union widens to include `"opgg"`.

The contract's `BuildRecommendation.spells` is `[number, number] | null`; `useBuild(championKey, position)` takes the numeric champion key and the lowercase position string (which equals the `Role` enum: `top|jungle|middle|bottom|utility`). `useChampSelect` already computes `me.assignedPosition` (raw) and `role` (`DisplayRole`).

- [ ] **Step 1: Widen `SpellRec.source` and the VM type.** In `src/renderer/src/hooks/use-champ-select.ts`, replace the `SpellRec` interface and add the new fields to `ChampSelectVM`. Replace lines 13–17 (the `SpellRec` interface):

```ts
export interface SpellRec {
	pair: [SummonerSpellStatic, SummonerSpellStatic] | null
	source: "pinned" | "opgg" | "heuristic"
	rolePending: boolean
}
```

Then extend `ChampSelectVM` — change the `me` block and add the build/effective fields. Replace the `me` object and the lines that follow it inside `ChampSelectVM` (lines 38–53) with:

```ts
	me: {
		champion: ChampionStatic | null
		role: DisplayRole | null
		rolePending: boolean
		hovering: boolean // champion shown via pick intent, not yet locked
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
	// Build / responsiveness (design §7.1)
	championKey: number | null // effective champion (locked || hovered)
	position: string | null // raw LCU assignedPosition ("top"…), null when pending
	build: BuildRecommendation | null
}
```

- [ ] **Step 2: Update imports.** At the top of the file, add `resolveSpells` and `useBuild`, plus the `BuildRecommendation` type. Replace the import of `recommendSpells` (line 7) and add `BuildRecommendation` to the shared-types import (line 8). The new import block (lines 1–11) becomes:

```ts
import { championLane, type DisplayRole, displayRole } from "@renderer/lib/roles"
import { useEffect, useMemo, useRef, useState } from "react"

import { suggestBans } from "@/shared/lib/bans"
import { matchupNote } from "@/shared/lib/notes-match"
import { flagMismatch } from "@/shared/lib/rank"
import { resolveSpells } from "@/shared/lib/spell-precedence"
import type {
	BuildRecommendation,
	ChampionStatic,
	MatchupNote,
	RankInfo,
	SummonerSpellStatic,
} from "@/shared/types"

import { useBanList, useBuild, useDDragon, useNotes, useSettings, useTeamRanks } from "./use-data"
import { useChampSelectSession } from "./use-lcu"
```

- [ ] **Step 3: Compute the effective champion + position before the `useMemo`, and call `useBuild`.** Hooks must run unconditionally, so derive the effective champion key and position from `session` (not from inside the memo) and pass them to `useBuild`. Insert this block immediately **after** the `const elapsedMs = ...` line (currently line 84) and **before** `return useMemo(() => {`:

```ts
	// Effective champion + position resolved OUTSIDE the memo so useBuild (a hook)
	// runs unconditionally. Locked championId wins; otherwise fall back to the
	// hovered championPickIntent so the screen reacts the instant you hover.
	const meRaw = session?.myTeam.find((p) => p.cellId === session.localPlayerCellId) ?? null
	const championKey = meRaw ? meRaw.championId || meRaw.championPickIntent || null : null
	const position = meRaw && meRaw.assignedPosition ? meRaw.assignedPosition : null
	const { data: build } = useBuild(championKey, position)
```

- [ ] **Step 4: Rewrite the body of the memo to use the effective champion, the `hovering` flag, the build, and `resolveSpells`.** Replace the entire `return useMemo(() => { ... }, [...])` block (currently lines 86–188) with the version below. Changes from the original: `me.championId` → effective `championKey` for the portrait; `hovering` derived; spells resolved via `resolveSpells` with the build's spell pair as the OPGG layer; new `championKey`/`position`/`build` exposed; deps array gains `build`.

```ts
	return useMemo(() => {
		if (!session) return null
		const champ = (id: number): ChampionStatic | null => bundle?.championsByKey[id] ?? null
		const spell = (id: number): SummonerSpellStatic | null => bundle?.spellsByKey[id] ?? null

		const me = session.myTeam.find((p) => p.cellId === session.localPlayerCellId)
		if (!me) return null

		const role = displayRole(me.assignedPosition)
		const rolePending = !role

		// effective champion: locked championId wins, else the hovered intent.
		// hovering = we're showing the champ via intent only (not locked yet).
		const effectiveChampId = me.championId || me.championPickIntent || 0
		const hovering = me.championId === 0 && me.championPickIntent > 0

		// sub-phase: FINALIZATION → pick; PLANNING → ban (bans come first);
		// BAN_PICK → ban while any ban action is in progress (real sessions mix turns)
		const flat = session.actions.flat()
		const timerPhase = session.timer.phase
		const subPhase: "ban" | "pick" =
			timerPhase === "FINALIZATION"
				? "pick"
				: timerPhase === "PLANNING"
					? "ban"
					: flat.some((a) => a.type === "ban" && a.isInProgress)
						? "ban"
						: "pick"

		const enemyVisible = session.theirTeam.filter((p) => p.championId > 0)
		const enemyHidden = enemyVisible.length === 0
		// matchup target = the enemy in MY lane. Riot doesn't expose enemy
		// assignedPosition in champ select, so prefer it when present but otherwise
		// infer the enemy's lane from the champion (CHAMPION_LANE). No confident
		// match (role pending, or no enemy maps to my lane) → no specific matchup,
		// rather than guessing the wrong enemy.
		const laneOpponent = role
			? (enemyVisible.find(
					(p) =>
						(displayRole(p.assignedPosition) ?? championLane(champ(p.championId)?.id ?? "")) ===
						role,
				) ?? null)
			: null
		const opponent = laneOpponent ? champ(laneOpponent.championId) : null

		const note = matchupNote(notes ?? [], effectiveChampId, laneOpponent?.championId ?? null)

		// spell precedence: pinned-note > OP.GG build > deterministic heuristic.
		// pinned pre-validated against DDragon (§6.1: unresolvable pin → drop it).
		const pinned = note?.pinnedSpells
		const pinnedValid = !!(pinned && spell(pinned[0]) && spell(pinned[1]))
		const opggPair = build?.spells ?? null
		const opggValid = !!(opggPair && spell(opggPair[0]) && spell(opggPair[1]))
		const rec = resolveSpells({
			assignedPosition: me.assignedPosition,
			pinnedSpells: pinnedValid ? pinned : undefined,
			opggSpells: opggValid ? opggPair : null,
		})
		const s0 = spell(rec.pair[0])
		const s1 = spell(rec.pair[1])
		const spells: SpellRec = {
			pair: s0 && s1 ? [s0, s1] : null,
			source: rec.source,
			rolePending: rec.rolePending,
		}

		const rows: BanRowVM[] = suggestBans(banlist ?? [], session).entries.map((row) => ({
			championId: row.entry.championId,
			champion: champ(row.entry.championId),
			reason: row.entry.reason,
			status: row.status,
			threat: row.threat,
		}))

		const team: TeamRowVM[] = session.myTeam.map((p) => ({
			cellId: p.cellId,
			champion: champ(p.championId),
			role: displayRole(p.assignedPosition),
			name: p.gameName ?? `Summoner ${p.summonerId}`,
			rank: ranks?.[p.puuid] ?? null,
			you: p.cellId === session.localPlayerCellId,
		}))
		// requires at least one *teammate* rank — the fake always returns yours, matching the prototype
		const ranksAvailable = team.some((t) => !t.you && t.rank != null)

		const mismatch =
			ranksAvailable &&
			flagMismatch(
				team.map((t) => t.rank),
				settings?.rankDiffThreshold ?? 8,
			)

		return {
			subPhase,
			secondsLeft: Math.max(
				0,
				Math.ceil((session.timer.adjustedTimeLeftInPhase - elapsedMs) / 1000),
			),
			phaseTotal: Math.max(1, Math.round(session.timer.totalTimeInPhase / 1000)),
			timerVisible: !session.timer.isInfinite,
			enemyHidden,
			me: {
				champion: champ(effectiveChampId),
				role,
				rolePending,
				hovering,
				name: me.gameName ?? "",
			},
			opponent,
			spells,
			note,
			banRows: rows,
			goneCount: rows.filter((r) => r.status !== "open").length,
			team,
			ranksAvailable,
			mismatch,
			championKey: effectiveChampId || null,
			position: me.assignedPosition || null,
			build: build ?? null,
		}
	}, [session, bundle, notes, banlist, settings, ranks, elapsedMs, build])
```

- [ ] **Step 5: Typecheck + format.** `pnpm typecheck` then `pnpm format`. The `championKey`/`position` consts feed `useBuild`; the test in Task 4.1 still passes (`pnpm test`). Fix any type errors (e.g. `HeaderStrip` consumes `vm.me` — adding `hovering` is additive and won't break it).

- [ ] **Step 6: Commit.**
```sh
git add src/renderer/src/hooks/use-champ-select.ts
git commit -m "feat: make champ select responsive to hover and pull OP.GG build + spells"
```

---

### Task 4.3 — `RecommendationPanel` component + auto-apply effect

**Files:**
- Create: `src/renderer/src/components/champ-select/recommendation-panel.tsx`
- Modify: `src/renderer/src/components/champ-select/champ-select-screen.tsx`

> The panel renders OP.GG **runes** (keystone + the 6 selected perks as a compact cluster via `runeIconUrl` + `bundle.runesById`), the recommended **spells**, and a **win% · N games** label. It also owns the **auto-apply** effect: when `autoRunes`/`autoSpells` are on and the effective champion changes, it debounces ~400ms, then calls `api.applyRunes(build.runes)` / `api.setSpells(...)`, showing a transient status line. Off by default → no writes. We split this out (the spec caps components at ~300 lines and keeps `champ-select-screen` thin). The panel sits in the **left column**, directly under the `HeaderStrip`.

> Number formatting: `BuildRecommendation.winRate` is `0..1` (design §5); render as a percentage. `sampleSize` is a game count; render compact (e.g. `12.3k`).

- [ ] **Step 1: Create the `RecommendationPanel` component.** Create `src/renderer/src/components/champ-select/recommendation-panel.tsx` with the full content below.

```tsx
import { api } from "@renderer/api"
import { Section } from "@renderer/components/champ-select/section"
import { SpellPair } from "@renderer/components/game/spell-pair"
import { useSettings } from "@renderer/hooks/use-data"
import { runeIconUrl } from "@renderer/lib/ddragon-urls"
import { cn } from "@renderer/lib/utils"
import { useEffect, useRef, useState } from "react"

import type { BuildRecommendation, DDragonBundle, SummonerSpellStatic } from "@/shared/types"

interface RecommendationPanelProps {
	championKey: number | null
	build: BuildRecommendation | null
	spellPair: [SummonerSpellStatic, SummonerSpellStatic] | null
	layout: "DF" | "FD"
	bundle: DDragonBundle | undefined
	version: string
}

function formatPercent(rate: number): string {
	return `${Math.round(rate * 100)}%`
}

function formatGames(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
	return String(n)
}

export function RecommendationPanel({
	championKey,
	build,
	spellPair,
	layout,
	bundle,
	version,
}: RecommendationPanelProps): React.JSX.Element | null {
	const { data: settings } = useSettings()
	const [status, setStatus] = useState<string | null>(null)
	const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

	const autoRunes = settings?.autoRunes ?? false
	const autoSpells = settings?.autoSpells ?? false

	// transient status helper — clears itself after 2.4s
	function flash(msg: string): void {
		setStatus(msg)
		if (statusTimer.current) clearTimeout(statusTimer.current)
		statusTimer.current = setTimeout(() => setStatus(null), 2400)
	}

	// Auto-apply: when opted in and the effective champion changes, debounce ~400ms
	// (rapid hover shouldn't spam the client) then write spells/runes. Off by
	// default → this effect makes no calls. Writes go through the already-wired
	// invoke handlers (api.setSpells / api.applyRunes); no main-process code here.
	useEffect(() => {
		if (!championKey || !build) return
		if (!autoRunes && !autoSpells) return
		if (debounce.current) clearTimeout(debounce.current)
		debounce.current = setTimeout(async () => {
			if (autoSpells && build.spells) {
				try {
					await api.setSpells(build.spells[0], build.spells[1])
					flash("Spells applied")
				} catch {
					flash("Couldn't set spells")
				}
			}
			if (autoRunes && build.runes) {
				const res = await api.applyRunes(build.runes)
				flash(res.ok ? "Runes applied" : (res.error ?? "Couldn't set runes"))
			}
		}, 400)
		return () => {
			if (debounce.current) clearTimeout(debounce.current)
		}
		// championKey is the trigger; build/auto flags read latest values
	}, [championKey, build, autoRunes, autoSpells])

	useEffect(() => {
		return () => {
			if (statusTimer.current) clearTimeout(statusTimer.current)
			if (debounce.current) clearTimeout(debounce.current)
		}
	}, [])

	if (!championKey || !build) return null

	const runes = build.runes
	// keystone + 6 chosen perks (skip the 3 stat shards for the compact cluster)
	const perkIcons = runes
		? runes.selectedPerkIds
				.slice(0, 6)
				.map((id) => bundle?.runesById[id])
				.filter((r): r is NonNullable<typeof r> => r != null)
		: []

	return (
		<Section
			label="Recommended"
			right={
				<span className="font-mono text-[10px] font-semibold leading-none tracking-[0.06em] text-paper-300">
					{formatPercent(build.winRate)} · {formatGames(build.sampleSize)} games
				</span>
			}
		>
			<div className="flex items-center gap-4">
				{perkIcons.length > 0 && (
					<div className="flex shrink-0 items-center gap-[5px]">
						{perkIcons.map((rune, i) => (
							<img
								key={rune.id}
								src={runeIconUrl(rune.icon)}
								alt={rune.name}
								title={rune.name}
								className={cn(
									"shrink-0 rounded-full bg-ink-800 object-contain",
									i === 0 ? "h-9 w-9 p-px ring-1 ring-accent" : "h-6 w-6",
								)}
							/>
						))}
					</div>
				)}

				{spellPair && (
					<>
						<span className="shrink-0 h-8 w-px bg-(--stroke-default)" />
						<SpellPair pair={spellPair} version={version} layout={layout} size={28} showKeys />
					</>
				)}

				<div className="flex-1" />

				{status && (
					<span className="shrink-0 font-mono text-[10px] font-semibold leading-none tracking-[0.06em] text-accent">
						{status}
					</span>
				)}
				{(autoRunes || autoSpells) && !status && (
					<span className="shrink-0 font-mono text-[10px] font-medium leading-none tracking-[0.06em] text-paper-400">
						Auto-setup on
					</span>
				)}
			</div>
		</Section>
	)
}
```

- [ ] **Step 2: Place the panel in the champ-select left column.** Edit `src/renderer/src/components/champ-select/champ-select-screen.tsx`. Add the import and render the panel directly under `HeaderStrip` in the left column. Replace the file's imports (lines 1–6) with:

```tsx
import { BansRegion } from "@renderer/components/champ-select/bans-region"
import { HeaderStrip } from "@renderer/components/champ-select/header-strip"
import { NotesRegion } from "@renderer/components/champ-select/notes-region"
import { RecommendationPanel } from "@renderer/components/champ-select/recommendation-panel"
import { TeamRegion } from "@renderer/components/champ-select/team-region"
import { useChampSelect } from "@renderer/hooks/use-champ-select"
import { useDDragon, useSettings } from "@renderer/hooks/use-data"
```

Then insert the panel between the `HeaderStrip` and the `NotesRegion` in the left column. Replace the left-column block (currently lines 21–40) with:

```tsx
			<div className="flex min-h-0 flex-col gap-[14px]">
				<HeaderStrip
					me={vm.me}
					spells={vm.spells}
					layout={layout}
					version={version}
					subPhase={vm.subPhase}
					secondsLeft={vm.secondsLeft}
					phaseTotal={vm.phaseTotal}
					timerVisible={vm.timerVisible}
				/>
				<RecommendationPanel
					championKey={vm.championKey}
					build={vm.build}
					spellPair={vm.spells.pair}
					layout={layout}
					bundle={bundle}
					version={version}
				/>
				<NotesRegion
					note={vm.note}
					enemyHidden={vm.enemyHidden}
					me={vm.me}
					opponent={vm.opponent}
					version={version}
					grow
				/>
			</div>
```

- [ ] **Step 3: Typecheck + format.** `pnpm typecheck` then `pnpm format`. Confirm `runeIconUrl` exists in `src/renderer/src/lib/ddragon-urls.ts` (added in a prior phase) and `DDragonBundle.runesById` is typed; if a type error surfaces on `bundle.runesById`, the prior-phase types are missing — stop and verify the dependency rather than patching here.

- [ ] **Step 4: Dev verify (Playwright MCP).** Start the app: `pnpm dev`. In the renderer, enable force-fake (the on-screen Dev bar → Fake api toggle, which sets `localStorage lockin:forceFake="1"` and reloads). With the Dev bar set to **Client → Champ Selection**, **Role → Set**, take a `mcp__playwright__browser_snapshot` and a `mcp__playwright__browser_take_screenshot`. Verify the "Recommended" panel renders under the header with: a highlighted keystone + smaller perk icons, the spell pair with D/F key hints, and a `NN% · N games` label (sourced from `FIXTURE_BUILD`). Confirm the panel disappears when **Build → Unavailable** is toggled (added in Task 4.4) — do this check after Task 4.4 if the toggle isn't wired yet.

- [ ] **Step 5: Commit.**
```sh
git add src/renderer/src/components/champ-select/recommendation-panel.tsx src/renderer/src/components/champ-select/champ-select-screen.tsx
git commit -m "feat: add champ-select recommendation panel with opt-in auto rune/spell apply"
```

---

### Task 4.4 — Settings rows + state-switcher controls; verify

**Files:**
- Modify: `src/renderer/src/pages/settings.tsx`
- Modify: `src/renderer/src/api/fake/scenario.ts`
- Modify: `src/renderer/src/api/fake/bridge.ts`
- Modify: `src/renderer/src/components/dev/state-switcher.tsx`

> Add the user-facing toggles (Auto-set runes on hover, Auto-set spells on hover) and the build-tier `Segmented` to **Settings → Champ select**, plus a dev "Build" availability toggle and the two auto-setup switches to the **state switcher** so the panel and auto-apply are previewable in force-fake mode. The fake `getBuild` already returns `FIXTURE_BUILD` for the Aatrox-top fixture (added in the plumbing phase); we add a `buildAvailable` scenario flag so the dev bar can force `getBuild` to return `null`.

- [ ] **Step 1: Add the Champ-select settings rows.** Edit `src/renderer/src/pages/settings.tsx`. The `Champ select` group currently has two rows ("Summoner-spell keys" and "Rank-mismatch sensitivity", lines 63–110). Add three new rows. Replace the closing of the "Summoner-spell keys" row — specifically, insert the three rows **after** the `Summoner-spell keys` `<Row>` closes (after line 93, before the `Rank-mismatch sensitivity` `<Row last ...>`). The "Summoner-spell keys" row keeps its `last`-less state; the new tier row becomes the section's `last`. So:

  1. The existing "Rank-mismatch sensitivity" `<Row last ...>` keeps `last`.
  2. Insert these three rows between "Summoner-spell keys" and "Rank-mismatch sensitivity":

```tsx
				<Row
					title="Auto-set runes on hover"
					desc="When you hover a champion, create a lockin rune page from the recommendation and set it active. Off by default, so nothing happens without you. Your own pages are never touched."
					control={
						<Switch
							checked={settings.autoRunes}
							onCheckedChange={(v) => setSettings.mutate({ autoRunes: v })}
						/>
					}
				/>
				<Row
					title="Auto-set spells on hover"
					desc="Set your summoner spells to the recommendation when you hover a champion. Off by default."
					control={
						<Switch
							checked={settings.autoSpells}
							onCheckedChange={(v) => setSettings.mutate({ autoSpells: v })}
						/>
					}
				/>
				<Row
					title="Build tier"
					desc="Which rank bracket the recommendations are pulled from."
					control={
						<Segmented
							value={settings.buildTier}
							onChange={(v) => setSettings.mutate({ buildTier: v })}
							options={[
								{ value: "emerald_plus", label: "Emerald+" },
								{ value: "platinum_plus", label: "Plat+" },
								{ value: "all", label: "All" },
							]}
						/>
					}
				/>
```

  Note: `Segmented<T extends string | number>` infers `T = string` from `settings.buildTier: string`, so `onChange={(v) => ...}` types `v` as `string` — no cast needed.

- [ ] **Step 2: Add a `buildAvailable` scenario flag.** Edit `src/renderer/src/api/fake/scenario.ts`. Add `buildAvailable: boolean` to `ScenarioState` and `INITIAL_SCENARIO`. Replace the `ScenarioState` interface (lines 6–14) and `INITIAL_SCENARIO` (lines 16–24):

```ts
export interface ScenarioState {
	phase: "disconnected" | "idle" | "ready" | "select"
	csSubPhase: "ban" | "pick" | null // null = auto-cycle ban→pick on timer expiry
	enemyHidden: boolean | null // null = auto (hidden during ban)
	ranksAvailable: boolean
	hasNote: boolean
	roleAssigned: boolean
	autoAcceptFired: boolean
	buildAvailable: boolean // dev: when false, fake getBuild returns null
}

export const INITIAL_SCENARIO: ScenarioState = {
	phase: "select",
	csSubPhase: null,
	enemyHidden: null,
	ranksAvailable: true,
	hasNote: true,
	roleAssigned: true,
	autoAcceptFired: false,
	buildAvailable: true,
}
```

- [ ] **Step 3: Make the fake `getBuild` honor `buildAvailable`.** Edit `src/renderer/src/api/fake/bridge.ts`. Locate the `async getBuild(...)` implementation added by the plumbing phase (it returns `FIXTURE_BUILD` when the Aatrox-top ids match, else `null`). Wrap its body so that when `scenario.buildAvailable === false` it returns `null` regardless. The method should read:

```ts
	async getBuild(championKey, position) {
		if (!scenario.buildAvailable) return null
		// FIXTURE_BUILD is Aatrox (266) top; any other champ/position has no fixture
		if (championKey === FIXTURE_BUILD.championKey && position === "top") {
			return { ...FIXTURE_BUILD }
		}
		return null
	},
```

  If the plumbing-phase implementation differs in shape (e.g. named params), keep its matching logic and only add the leading `if (!scenario.buildAvailable) return null` guard. Ensure `FIXTURE_BUILD` is imported in the `fixtures` import block at the top of `bridge.ts` (it was added there in the plumbing phase; if not present, add `FIXTURE_BUILD` to the `from "./fixtures"` import).

- [ ] **Step 4: Add dev-bar controls for build availability + the two auto-setup toggles.** Edit `src/renderer/src/components/dev/state-switcher.tsx`. Inside the `snapshot.phase === "select"` controls block (the `<div className="flex flex-wrap items-center justify-end gap-3">` that currently ends at line 231), append three more control groups after the existing "Role" group (after line 230, before the block's closing `</div>` on line 231):

```tsx
						<div className="flex items-center gap-[7px]">
							<DemoLabel>Build</DemoLabel>
							<Seg
								value={snapshot.buildAvailable ? "on" : "off"}
								onChange={(v) => drive({ buildAvailable: v === "on" })}
								options={[
									{ value: "on", label: "Available" },
									{ value: "off", label: "None" },
								]}
							/>
						</div>
						<div className="flex items-center gap-[10px] border-l border-(--stroke-default) pl-3">
							<Switch
								id="dev-auto-runes"
								checked={settingsQuery.data?.autoRunes ?? false}
								onCheckedChange={(checked) => setSettingsMutation.mutate({ autoRunes: checked })}
							/>
							<label htmlFor="dev-auto-runes" className={LABEL_CLASS}>
								Auto runes
							</label>
							<Switch
								id="dev-auto-spells"
								checked={settingsQuery.data?.autoSpells ?? false}
								onCheckedChange={(checked) => setSettingsMutation.mutate({ autoSpells: checked })}
							/>
							<label htmlFor="dev-auto-spells" className={LABEL_CLASS}>
								Auto spells
							</label>
						</div>
```

  (`settingsQuery`, `setSettingsMutation`, `Switch`, `LABEL_CLASS`, `DemoLabel`, `Seg`, and `drive` are all already in scope in this component — see lines 64–82.)

- [ ] **Step 5: Typecheck + format.** `pnpm typecheck` then `pnpm format`. Run `pnpm test` to confirm Task 4.1's helper test still passes.

- [ ] **Step 6: Dev verify (Playwright MCP).** With `pnpm dev` running and force-fake on:
  - **Settings:** navigate to `/settings`; confirm the Champ-select group shows "Auto-set runes on hover", "Auto-set spells on hover" (both Switch, off by default), and a "Build tier" Segmented (Emerald+ selected). Screenshot.
  - **Champ select panel:** Dev bar → Client = Champ Selection, Role = Set, Build = Available → the "Recommended" panel shows runes + spells + win%/games. Toggle Build = None → the panel disappears (and `HeaderStrip` spells fall back to the heuristic). Screenshot both states.
  - **Auto-apply status:** Dev bar → flip "Auto spells" on; re-trigger by toggling Build None→Available (or Role Pending→Set) to fire the effective-champion change; within ~1s a transient "Spells applied" status should flash in the panel, then clear. Flip "Auto runes" on and repeat → "Runes applied". Confirm with both off, no status ever appears. Screenshot the status state.

- [ ] **Step 7: Commit.**
```sh
git add src/renderer/src/pages/settings.tsx src/renderer/src/api/fake/scenario.ts src/renderer/src/api/fake/bridge.ts src/renderer/src/components/dev/state-switcher.tsx
git commit -m "feat: add auto rune/spell + build-tier settings and dev-bar build/auto toggles"
```

---

## Phase 5 — In-game screen + champ-select mains (feature 2)

This phase builds the **In-Game screen** (rendered for `InProgress`/`GameStart`) and the **champ-select "mains"** feature. It depends on the shared plumbing from earlier phases: the `Role` / `BuildRecommendation` / `InGameState` / `SummonerIdentity` types in `src/shared/types.ts`; the `runesById` / `itemsById` additions to `DDragonBundle`; the `itemIconUrl` / `runeIconUrl` helpers in `ddragon-urls.ts`; the `useBuild` / `useInGame` / `useSummoner` hooks; the `mains` field on `AppSettings`; and the fake `FIXTURE_BUILD` / `"game"` scenario. Where this phase needs a small role-conversion helper or a widened test glob, it adds them defensively (idempotent) so the phase stands alone.

Pure logic is built test-first; UI is built implement → `pnpm typecheck` → `pnpm format` → Playwright-verify in force-fake mode.

> **Role-type note for the implementer:** the renderer's existing `roles.ts` uses `DisplayRole` (`"Top" | "Jungle" | "Mid" | "Bot" | "Support"`). The shared contract uses lowercase `Role` (`"top" | "jungle" | "middle" | "bottom" | "utility"`) for `BuildRecommendation.role` and `AppSettings.mains[].role`. Task 5.1 adds the conversion helpers so the two coexist cleanly. `useBuild(championKey, position)` takes the **OP.GG position string** (`TOP | JUNGLE | MID | ADC | SUPPORT`), produced by `roleToPosition`.

---

### Task 5.1 — Role conversion helpers (pure, TDD)

**Files:**
- Modify: `src/renderer/src/lib/roles.ts`
- Test (create): `src/renderer/src/lib/roles.test.ts`
- Modify: `vitest.config.ts` (widen `include` so renderer-colocated tests run)

- [ ] **Step 1: Widen the vitest glob so renderer tests are picked up.** Edit `vitest.config.ts` — replace the `include` array. (Idempotent: if an earlier phase already widened it, leave it.)

  ```ts
  import tsconfigPaths from "vite-tsconfig-paths"
  import { defineConfig } from "vitest/config"

  export default defineConfig({
  	plugins: [tsconfigPaths()],
  	test: {
  		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  		environment: "node",
  	},
  })
  ```

- [ ] **Step 2: Write the failing test** for the role converters. Create `src/renderer/src/lib/roles.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest"

  import { displayToRole, roleToDisplay, roleToPosition } from "./roles"

  describe("roleToDisplay", () => {
  	it("maps every lowercase Role to its DisplayRole", () => {
  		expect(roleToDisplay("top")).toBe("Top")
  		expect(roleToDisplay("jungle")).toBe("Jungle")
  		expect(roleToDisplay("middle")).toBe("Mid")
  		expect(roleToDisplay("bottom")).toBe("Bot")
  		expect(roleToDisplay("utility")).toBe("Support")
  	})
  })

  describe("displayToRole", () => {
  	it("maps every DisplayRole back to its lowercase Role", () => {
  		expect(displayToRole("Top")).toBe("top")
  		expect(displayToRole("Jungle")).toBe("jungle")
  		expect(displayToRole("Mid")).toBe("middle")
  		expect(displayToRole("Bot")).toBe("bottom")
  		expect(displayToRole("Support")).toBe("utility")
  	})

  	it("round-trips through roleToDisplay", () => {
  		for (const r of ["top", "jungle", "middle", "bottom", "utility"] as const) {
  			expect(displayToRole(roleToDisplay(r))).toBe(r)
  		}
  	})
  })

  describe("roleToPosition", () => {
  	it("maps Role to the OP.GG position enum", () => {
  		expect(roleToPosition("top")).toBe("TOP")
  		expect(roleToPosition("jungle")).toBe("JUNGLE")
  		expect(roleToPosition("middle")).toBe("MID")
  		expect(roleToPosition("bottom")).toBe("ADC")
  		expect(roleToPosition("utility")).toBe("SUPPORT")
  	})
  })
  ```

- [ ] **Step 3: Run the test, expect FAIL** (helpers don't exist yet):

  ```sh
  pnpm test src/renderer/src/lib/roles.test.ts
  ```

- [ ] **Step 4: Implement the helpers.** Append to `src/renderer/src/lib/roles.ts` (import `Role` from shared types — add the import at the top of the file alongside any existing imports):

  At the top of `src/renderer/src/lib/roles.ts`, add the import (the file currently has no imports — add this as line 1):

  ```ts
  import type { Role } from "@/shared/types"
  ```

  Then append at the end of the file (after `championLane`):

  ```ts
  /* Role (lowercase, shared contract) ↔ DisplayRole (renderer) ↔ OP.GG position enum */
  const ROLE_TO_DISPLAY: Record<Role, DisplayRole> = {
  	top: "Top",
  	jungle: "Jungle",
  	middle: "Mid",
  	bottom: "Bot",
  	utility: "Support",
  }

  const DISPLAY_TO_ROLE: Record<DisplayRole, Role> = {
  	Top: "top",
  	Jungle: "jungle",
  	Mid: "middle",
  	Bot: "bottom",
  	Support: "utility",
  }

  const ROLE_TO_POSITION: Record<Role, string> = {
  	top: "TOP",
  	jungle: "JUNGLE",
  	middle: "MID",
  	bottom: "ADC",
  	utility: "SUPPORT",
  }

  export function roleToDisplay(role: Role): DisplayRole {
  	return ROLE_TO_DISPLAY[role]
  }

  export function displayToRole(role: DisplayRole): Role {
  	return DISPLAY_TO_ROLE[role]
  }

  export function roleToPosition(role: Role): string {
  	return ROLE_TO_POSITION[role]
  }
  ```

- [ ] **Step 5: Run the test, expect PASS:**

  ```sh
  pnpm test src/renderer/src/lib/roles.test.ts
  ```

- [ ] **Step 6: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 7: Commit.**

  ```sh
  git add src/renderer/src/lib/roles.ts src/renderer/src/lib/roles.test.ts vitest.config.ts
  git commit -m "feat: add Role/DisplayRole/position converters and widen vitest glob"
  ```

---

### Task 5.2 — Mains grouping helper (pure, TDD)

A pure helper that buckets `AppSettings["mains"]` into the five roles in display order, used by both the settings editor and the champ-select section.

**Files:**
- Create: `src/renderer/src/lib/mains.ts`
- Test (create): `src/renderer/src/lib/mains.test.ts`

- [ ] **Step 1: Write the failing test.** Create `src/renderer/src/lib/mains.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest"

  import { groupMainsByRole, MAIN_ROLE_ORDER } from "./mains"

  describe("groupMainsByRole", () => {
  	it("returns the five role buckets in display order", () => {
  		const groups = groupMainsByRole([])
  		expect(groups.map((g) => g.role)).toEqual(MAIN_ROLE_ORDER)
  		expect(groups.every((g) => g.championIds.length === 0)).toBe(true)
  	})

  	it("buckets champions under their role preserving input order", () => {
  		const groups = groupMainsByRole([
  			{ championId: 266, role: "top" },
  			{ championId: 122, role: "top" },
  			{ championId: 64, role: "jungle" },
  			{ championId: 103, role: "middle" },
  		])
  		const byRole = Object.fromEntries(groups.map((g) => [g.role, g.championIds]))
  		expect(byRole.top).toEqual([266, 122])
  		expect(byRole.jungle).toEqual([64])
  		expect(byRole.middle).toEqual([103])
  		expect(byRole.bottom).toEqual([])
  		expect(byRole.utility).toEqual([])
  	})

  	it("reports total and emptiness", () => {
  		expect(groupMainsByRole([]).every((g) => g.championIds.length === 0)).toBe(true)
  		const groups = groupMainsByRole([{ championId: 266, role: "top" }])
  		const total = groups.reduce((n, g) => n + g.championIds.length, 0)
  		expect(total).toBe(1)
  	})
  })
  ```

- [ ] **Step 2: Run the test, expect FAIL:**

  ```sh
  pnpm test src/renderer/src/lib/mains.test.ts
  ```

- [ ] **Step 3: Implement the helper.** Create `src/renderer/src/lib/mains.ts`:

  ```ts
  import type { Role } from "@/shared/types"

  export interface MainGroup {
  	role: Role
  	championIds: number[]
  }

  /* fixed display order: Top → Jungle → Mid → Bot → Support */
  export const MAIN_ROLE_ORDER: Role[] = ["top", "jungle", "middle", "bottom", "utility"]

  export function groupMainsByRole(
  	mains: { championId: number; role: Role }[],
  ): MainGroup[] {
  	return MAIN_ROLE_ORDER.map((role) => ({
  		role,
  		championIds: mains.filter((m) => m.role === role).map((m) => m.championId),
  	}))
  }
  ```

- [ ] **Step 4: Run the test, expect PASS:**

  ```sh
  pnpm test src/renderer/src/lib/mains.test.ts
  ```

- [ ] **Step 5: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 6: Commit.**

  ```sh
  git add src/renderer/src/lib/mains.ts src/renderer/src/lib/mains.test.ts
  git commit -m "feat: add groupMainsByRole helper"
  ```

---

### Task 5.3 — Skill-order formatter (pure, TDD)

Converts `BuildRecommendation["skillOrder"]` (length-18 array of `"Q"|"W"|"E"|"R"`) into per-ability level lists for the 4×18 grid, asserts R sits at levels 6/11/16, and exposes the level-by-level array for cell coloring.

**Files:**
- Create: `src/renderer/src/lib/skill-order.ts`
- Test (create): `src/renderer/src/lib/skill-order.test.ts`

- [ ] **Step 1: Write the failing test.** Create `src/renderer/src/lib/skill-order.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest"

  import { type Ability, formatSkillOrder, SKILL_ABILITIES } from "./skill-order"

  // A canonical Aatrox-style order: Q maxed first, then E, then W; R at 6/11/16.
  const ORDER: Ability[] = [
  	"Q", "W", "E", "Q", "Q", "R",
  	"Q", "E", "Q", "E", "R", "E",
  	"E", "W", "W", "R", "W", "W",
  ]

  describe("SKILL_ABILITIES", () => {
  	it("rows are Q, W, E, R in that order", () => {
  		expect(SKILL_ABILITIES).toEqual(["Q", "W", "E", "R"])
  	})
  })

  describe("formatSkillOrder", () => {
  	it("returns one row per ability with 18 boolean cells", () => {
  		const rows = formatSkillOrder(ORDER)
  		expect(rows.map((r) => r.ability)).toEqual(["Q", "W", "E", "R"])
  		for (const row of rows) expect(row.cells).toHaveLength(18)
  	})

  	it("marks the cell at each level for the leveled ability and the running count", () => {
  		const rows = formatSkillOrder(ORDER)
  		const q = rows.find((r) => r.ability === "Q")!
  		// Q leveled at 1,4,5,7,9 (1-indexed) → cells[0,3,4,6,8]
  		expect(q.cells[0]).toEqual({ active: true, point: 1 })
  		expect(q.cells[3]).toEqual({ active: true, point: 2 })
  		expect(q.cells[4]).toEqual({ active: true, point: 3 })
  		expect(q.cells[6]).toEqual({ active: true, point: 4 })
  		expect(q.cells[8]).toEqual({ active: true, point: 5 })
  		expect(q.cells[1]).toEqual({ active: false, point: 0 })
  	})

  	it("places R at levels 6, 11, 16 (0-indexed 5, 10, 15)", () => {
  		const rows = formatSkillOrder(ORDER)
  		const r = rows.find((row) => row.ability === "R")!
  		expect(r.cells[5].active).toBe(true)
  		expect(r.cells[10].active).toBe(true)
  		expect(r.cells[15].active).toBe(true)
  		const activeLevels = r.cells.flatMap((c, i) => (c.active ? [i + 1] : []))
  		expect(activeLevels).toEqual([6, 11, 16])
  	})

  	it("is tolerant of short/empty input (pads to 18 cells, no actives)", () => {
  		const rows = formatSkillOrder([])
  		for (const row of rows) {
  			expect(row.cells).toHaveLength(18)
  			expect(row.cells.every((c) => !c.active)).toBe(true)
  		}
  	})
  })
  ```

- [ ] **Step 2: Run the test, expect FAIL:**

  ```sh
  pnpm test src/renderer/src/lib/skill-order.test.ts
  ```

- [ ] **Step 3: Implement the formatter.** Create `src/renderer/src/lib/skill-order.ts`:

  ```ts
  export type Ability = "Q" | "W" | "E" | "R"

  /* grid row order, top to bottom */
  export const SKILL_ABILITIES: Ability[] = ["Q", "W", "E", "R"]

  export interface SkillCell {
  	/** true when this ability is the one leveled at this level */
  	active: boolean
  	/** running count of points put into this ability through this level (0 when inactive) */
  	point: number
  }

  export interface SkillRow {
  	ability: Ability
  	cells: SkillCell[]
  }

  /**
   * Turn a length-18 skillOrder (the ability leveled at each level 1..18) into
   * per-ability rows of 18 cells. Tolerant of short/over-long input: reads at most
   * 18 levels and pads the rest with inactive cells.
   */
  export function formatSkillOrder(order: Ability[]): SkillRow[] {
  	const counts: Record<Ability, number> = { Q: 0, W: 0, E: 0, R: 0 }
  	return SKILL_ABILITIES.map((ability) => {
  		const cells: SkillCell[] = []
  		for (let level = 0; level < 18; level++) {
  			const leveled = order[level]
  			const active = leveled === ability
  			if (active) counts[ability] += 1
  			cells.push({ active, point: active ? counts[ability] : 0 })
  		}
  		// reset per-ability running counts so each row computes independently
  		counts[ability] = 0
  		return { ability, cells }
  	})
  }
  ```

  > Note: because each row is computed in its own pass, resetting `counts[ability]` at the end keeps the closure simple; the running `point` is correct within a row.

- [ ] **Step 4: Run the test, expect PASS:**

  ```sh
  pnpm test src/renderer/src/lib/skill-order.test.ts
  ```

- [ ] **Step 5: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 6: Commit.**

  ```sh
  git add src/renderer/src/lib/skill-order.ts src/renderer/src/lib/skill-order.test.ts
  git commit -m "feat: add skill-order grid formatter"
  ```

---

### Task 5.4 — Item icon + win/sample formatting helpers (pure, TDD)

Small shared formatters used by the build UI: a `winRate`/`sampleSize` label ("62% · 12.4k games") and a deduped situational-item flattener. Keeping these pure makes the strip components trivial.

**Files:**
- Create: `src/renderer/src/lib/build-format.ts`
- Test (create): `src/renderer/src/lib/build-format.test.ts`

- [ ] **Step 1: Write the failing test.** Create `src/renderer/src/lib/build-format.test.ts`:

  ```ts
  import { describe, expect, it } from "vitest"

  import { formatGames, formatWinRate, winSampleLabel } from "./build-format"

  describe("formatWinRate", () => {
  	it("renders a 0..1 fraction as a whole-ish percent", () => {
  		expect(formatWinRate(0.6234)).toBe("62%")
  		expect(formatWinRate(0.5)).toBe("50%")
  		expect(formatWinRate(0)).toBe("0%")
  	})
  })

  describe("formatGames", () => {
  	it("abbreviates thousands", () => {
  		expect(formatGames(842)).toBe("842")
  		expect(formatGames(1240)).toBe("1.2k")
  		expect(formatGames(12_400)).toBe("12.4k")
  		expect(formatGames(1_000_000)).toBe("1.0M")
  	})
  })

  describe("winSampleLabel", () => {
  	it("combines win% and games", () => {
  		expect(winSampleLabel(0.62, 12_400)).toBe("62% · 12.4k games")
  	})
  })
  ```

- [ ] **Step 2: Run the test, expect FAIL:**

  ```sh
  pnpm test src/renderer/src/lib/build-format.test.ts
  ```

- [ ] **Step 3: Implement the helpers.** Create `src/renderer/src/lib/build-format.ts`:

  ```ts
  export function formatWinRate(fraction: number): string {
  	return `${Math.round(fraction * 100)}%`
  }

  export function formatGames(games: number): string {
  	if (games >= 1_000_000) return `${(games / 1_000_000).toFixed(1)}M`
  	if (games >= 1000) return `${(games / 1000).toFixed(1)}k`
  	return String(games)
  }

  export function winSampleLabel(winRate: number, sampleSize: number): string {
  	return `${formatWinRate(winRate)} · ${formatGames(sampleSize)} games`
  }
  ```

- [ ] **Step 4: Run the test, expect PASS:**

  ```sh
  pnpm test src/renderer/src/lib/build-format.test.ts
  ```

- [ ] **Step 5: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 6: Commit.**

  ```sh
  git add src/renderer/src/lib/build-format.ts src/renderer/src/lib/build-format.test.ts
  git commit -m "feat: add build win/sample formatting helpers"
  ```

---

### Task 5.5 — `ItemIcon` + `ItemStrip` components (UI)

A small icon (DDragon item image with name tooltip + fallback) and the horizontal build strip (Starter → Boots → Core with `→` arrows → Situational), reused by the in-game screen.

**Files:**
- Create: `src/renderer/src/components/game/item-icon.tsx`
- Create: `src/renderer/src/components/game/item-strip.tsx`

- [ ] **Step 1: Implement `ItemIcon`.** Create `src/renderer/src/components/game/item-icon.tsx` (mirrors `SpellIcon`'s error-fallback pattern, using `itemIconUrl` + `bundle.itemsById` for the name):

  ```tsx
  import { itemIconUrl } from "@renderer/lib/ddragon-urls"
  import { cn } from "@renderer/lib/utils"
  import { useState } from "react"

  import type { DDragonBundle } from "@/shared/types"

  interface ItemIconProps {
  	itemId: number
  	bundle: DDragonBundle
  	version: string
  	size?: number
  	className?: string
  }

  export function ItemIcon({
  	itemId,
  	bundle,
  	version,
  	size = 30,
  	className,
  }: ItemIconProps): React.JSX.Element {
  	const [err, setErr] = useState(false)
  	const item = bundle.itemsById[itemId] ?? null
  	const name = item?.name ?? `Item ${itemId}`

  	return (
  		<div
  			title={name}
  			className={cn(
  				"relative shrink-0 overflow-hidden rounded-xs border border-(--stroke-default) bg-ink-800",
  				className,
  			)}
  			// dynamic: width/height derived from size prop
  			style={{ width: size, height: size }}
  		>
  			{!err ? (
  				<img
  					src={itemIconUrl(version, itemId)}
  					alt={name}
  					onError={() => setErr(true)}
  					className="block h-full w-full object-cover"
  				/>
  			) : (
  				<div className="grid h-full w-full place-items-center px-[2px] text-center font-mono text-[8px] font-semibold leading-none text-paper-200">
  					{name.slice(0, 6)}
  				</div>
  			)}
  		</div>
  	)
  }
  ```

- [ ] **Step 2: Implement `ItemStrip`.** Create `src/renderer/src/components/game/item-strip.tsx`. It renders the four item phases as a flowing row: Starter, Boots, Core (build-order, joined with `→`), and Situational (wraps). Each phase has a tiny mono caption.

  ```tsx
  import { ItemIcon } from "@renderer/components/game/item-icon"
  import { cn } from "@renderer/lib/utils"
  import { ArrowRight } from "lucide-react"

  import type { BuildRecommendation, DDragonBundle } from "@/shared/types"

  interface ItemPhaseProps {
  	caption: string
  	ids: number[]
  	bundle: DDragonBundle
  	version: string
  	/** join the icons with → arrows (build order); otherwise wrap as a pool */
  	ordered?: boolean
  	size?: number
  	className?: string
  }

  function ItemPhase({
  	caption,
  	ids,
  	bundle,
  	version,
  	ordered,
  	size = 30,
  	className,
  }: ItemPhaseProps): React.JSX.Element | null {
  	if (ids.length === 0) return null
  	return (
  		<div className={cn("flex flex-col gap-[6px]", className)}>
  			<span className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-paper-400">
  				{caption}
  			</span>
  			<div className={cn("flex items-center gap-[5px]", !ordered && "flex-wrap")}>
  				{ids.map((id, i) => (
  					<div key={`${id}-${i}`} className="flex items-center gap-[5px]">
  						{ordered && i > 0 && (
  							<ArrowRight size={12} className="shrink-0 text-paper-400" />
  						)}
  						<ItemIcon itemId={id} bundle={bundle} version={version} size={size} />
  					</div>
  				))}
  			</div>
  		</div>
  	)
  }

  interface ItemStripProps {
  	items: BuildRecommendation["items"]
  	bundle: DDragonBundle
  	version: string
  	size?: number
  }

  export function ItemStrip({
  	items,
  	bundle,
  	version,
  	size = 30,
  }: ItemStripProps): React.JSX.Element {
  	return (
  		<div className="flex flex-wrap items-start gap-x-5 gap-y-3">
  			<ItemPhase
  				caption="Starting"
  				ids={items.starter.ids}
  				bundle={bundle}
  				version={version}
  				size={size}
  			/>
  			<ItemPhase
  				caption="Boots"
  				ids={items.boots.ids}
  				bundle={bundle}
  				version={version}
  				size={size}
  			/>
  			<ItemPhase
  				caption="Core build"
  				ids={items.core.ids}
  				bundle={bundle}
  				version={version}
  				ordered
  				size={size}
  			/>
  			<ItemPhase
  				caption="Situational"
  				ids={items.situational.ids}
  				bundle={bundle}
  				version={version}
  				size={size}
  			/>
  		</div>
  	)
  }
  ```

- [ ] **Step 3: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 4: Commit.**

  ```sh
  git add src/renderer/src/components/game/item-icon.tsx src/renderer/src/components/game/item-strip.tsx
  git commit -m "feat: add ItemIcon and ItemStrip build components"
  ```

---

### Task 5.6 — `SkillOrderGrid` + `RunesReference` components (UI)

The color-coded 4×18 grid (consuming `formatSkillOrder`), with a `Q › E › W` priority line and win/sample label; and the compact in-game runes reference (keystone + shards from `bundle.runesById`).

**Files:**
- Create: `src/renderer/src/components/game/skill-order-grid.tsx`
- Create: `src/renderer/src/components/game/runes-reference.tsx`

- [ ] **Step 1: Implement `SkillOrderGrid`.** Create `src/renderer/src/components/game/skill-order-grid.tsx`. It uses `formatSkillOrder` for the cells and `winSampleLabel` for the footer. The per-ability accent color is data-driven (runtime color from the ability), so a `style` color is acceptable per the conventions.

  ```tsx
  import { type Ability, formatSkillOrder, type SkillRow } from "@renderer/lib/skill-order"
  import { cn } from "@renderer/lib/utils"

  import type { BuildRecommendation } from "@/shared/types"

  /* per-ability accent (data-driven runtime color → inline style is allowed) */
  const ABILITY_COLOR: Record<Ability, string> = {
  	Q: "var(--color-accent)",
  	W: "#5db5ff",
  	E: "#c98bff",
  	R: "#ffcf5d",
  }

  interface SkillOrderGridProps {
  	skillOrder: BuildRecommendation["skillOrder"]
  	skillPriority: BuildRecommendation["skillPriority"]
  }

  export function SkillOrderGrid({
  	skillOrder,
  	skillPriority,
  }: SkillOrderGridProps): React.JSX.Element {
  	const rows = formatSkillOrder(skillOrder as Ability[])
  	return (
  		<div className="flex flex-col gap-[10px]">
  			<PriorityLine priority={skillPriority} />
  			<div className="flex flex-col gap-[3px]">
  				{/* header: level numbers 1..18 */}
  				<div className="flex items-center gap-[3px] pl-[22px]">
  					{Array.from({ length: 18 }, (_, i) => (
  						<span
  							key={i}
  							className="w-[16px] text-center font-mono text-[8px] font-semibold leading-none text-paper-400"
  						>
  							{i + 1}
  						</span>
  					))}
  				</div>
  				{rows.map((row) => (
  					<GridRow key={row.ability} row={row} />
  				))}
  			</div>
  		</div>
  	)
  }

  function GridRow({ row }: { row: SkillRow }): React.JSX.Element {
  	const color = ABILITY_COLOR[row.ability]
  	return (
  		<div className="flex items-center gap-[3px]">
  			<span
  				className="w-[19px] text-center font-mono text-[10px] font-bold leading-none"
  				// dynamic: ability-keyed accent color
  				style={{ color }}
  			>
  				{row.ability}
  			</span>
  			{row.cells.map((cell, i) => (
  				<span
  					key={i}
  					className={cn(
  						"flex h-[16px] w-[16px] items-center justify-center rounded-[3px] font-mono text-[8px] font-bold leading-none",
  						cell.active ? "text-ink-950" : "bg-ink-800 text-transparent",
  					)}
  					// dynamic: active cells take the ability's accent as background
  					style={cell.active ? { backgroundColor: color } : undefined}
  				>
  					{cell.active ? cell.point : "·"}
  				</span>
  			))}
  		</div>
  	)
  }

  function PriorityLine({ priority }: { priority: ("Q" | "W" | "E")[] }): React.JSX.Element | null {
  	if (priority.length === 0) return null
  	return (
  		<div className="flex items-center gap-[6px]">
  			<span className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-paper-400">
  				Max order
  			</span>
  			<div className="flex items-center gap-[5px]">
  				{priority.map((a, i) => (
  					<div key={a} className="flex items-center gap-[5px]">
  						{i > 0 && <span className="text-[11px] leading-none text-paper-400">›</span>}
  						<span
  							className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] font-mono text-[10px] font-bold leading-none text-ink-950"
  							// dynamic: ability-keyed accent color
  							style={{ backgroundColor: ABILITY_COLOR[a] }}
  						>
  							{a}
  						</span>
  					</div>
  				))}
  			</div>
  		</div>
  	)
  }
  ```

- [ ] **Step 2: Implement `RunesReference`.** Create `src/renderer/src/components/game/runes-reference.tsx`. It shows the primary/secondary page names and the keystone + remaining perk icons via `bundle.runesById` + `runeIconUrl`. Stat shards (perk ids `5000+`) have no `runesById` entry, so we render only the ids that resolve.

  ```tsx
  import { runeIconUrl } from "@renderer/lib/ddragon-urls"
  import { cn } from "@renderer/lib/utils"
  import { useState } from "react"

  import type { DDragonBundle, RunePageRec } from "@/shared/types"

  interface RunesReferenceProps {
  	runes: RunePageRec
  	bundle: DDragonBundle
  }

  export function RunesReference({ runes, bundle }: RunesReferenceProps): React.JSX.Element {
  	// selectedPerkIds = [keystone, p1, p2, p3, s1, s2, shard1, shard2, shard3]
  	const keystone = runes.selectedPerkIds[0]
  	const rest = runes.selectedPerkIds.slice(1)
  	return (
  		<div className="flex flex-col gap-[10px]">
  			<div className="flex items-center gap-[10px]">
  				<RuneIcon perkId={keystone} bundle={bundle} size={34} />
  				<div className="flex min-w-0 flex-col gap-[3px]">
  					<span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold leading-none text-paper-100">
  						{runes.primaryName}
  					</span>
  					<span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] leading-none text-paper-400">
  						{runes.secondaryName}
  					</span>
  				</div>
  			</div>
  			<div className="flex flex-wrap items-center gap-[5px]">
  				{rest.map((id, i) => (
  					<RuneIcon key={`${id}-${i}`} perkId={id} bundle={bundle} size={20} />
  				))}
  			</div>
  		</div>
  	)
  }

  function RuneIcon({
  	perkId,
  	bundle,
  	size,
  }: {
  	perkId: number
  	bundle: DDragonBundle
  	size: number
  }): React.JSX.Element | null {
  	const [err, setErr] = useState(false)
  	const rune = bundle.runesById[perkId] ?? null
  	// stat shards (5000+) and unknown perks have no catalog icon → render a neutral dot
  	if (!rune || err) {
  		return (
  			<span
  				className="grid shrink-0 place-items-center rounded-full bg-ink-800 font-mono text-[7px] font-semibold leading-none text-paper-400"
  				// dynamic: width/height from size
  				style={{ width: size, height: size }}
  			>
  				·
  			</span>
  		)
  	}
  	return (
  		<img
  			src={runeIconUrl(rune.icon)}
  			alt={rune.name}
  			title={rune.name}
  			onError={() => setErr(true)}
  			className={cn("shrink-0 rounded-full bg-ink-900 object-contain")}
  			// dynamic: width/height from size
  			style={{ width: size, height: size }}
  		/>
  	)
  }
  ```

- [ ] **Step 3: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 4: Commit.**

  ```sh
  git add src/renderer/src/components/game/skill-order-grid.tsx src/renderer/src/components/game/runes-reference.tsx
  git commit -m "feat: add SkillOrderGrid and RunesReference components"
  ```

---

### Task 5.7 — `InGameScreen` + wire into `home.tsx` (UI)

The new screen: a header strip (champ from `useInGame` + spells), a matchup note, the build strip, and the skill grid in the left column; the team list + compact runes reference in the right rail. Role resolves from `CHAMPION_LANE` (via the in-game champion) as the in-game fallback. Build data from `useBuild(inGame.championId, roleToPosition(role))`.

**Files:**
- Create: `src/renderer/src/components/game/in-game-screen.tsx`
- Modify: `src/renderer/src/pages/home.tsx`

- [ ] **Step 1: Implement `InGameScreen`.** Create `src/renderer/src/components/game/in-game-screen.tsx`. It composes the existing `Section`, `Card`, `ChampionPortrait`, `SpellPair`, `RoleTag`, plus the new `ItemStrip`, `SkillOrderGrid`, `RunesReference`. Role comes from `championLane(champion.id)` → `displayToRole`; build from `useBuild`. The team list reuses the champ-select `TeamRegion` pattern by reading the live champ-select session if still present, else shows just the player. Since in-game team data isn't part of `InGameState`, the right rail shows the player card + runes reference (keeping the "team + compact runes" shape the spec calls for, degrading gracefully when no team is available).

  ```tsx
  import { Card } from "@renderer/components/app/card"
  import { Eyebrow } from "@renderer/components/app/eyebrow"
  import { Section } from "@renderer/components/champ-select/section"
  import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
  import { ItemStrip } from "@renderer/components/game/item-strip"
  import { RoleTag } from "@renderer/components/game/role"
  import { RunesReference } from "@renderer/components/game/runes-reference"
  import { SkillOrderGrid } from "@renderer/components/game/skill-order-grid"
  import { SpellPair } from "@renderer/components/game/spell-pair"
  import { NoteCard } from "@renderer/components/notes/note-card"
  import { Button } from "@renderer/components/ui/button"
  import { useBuild, useDDragon, useSettings, useUpsertNote } from "@renderer/hooks/use-data"
  import { useInGame } from "@renderer/hooks/use-lcu"
  import { useNotes } from "@renderer/hooks/use-data"
  import { championLane, displayToRole, roleToPosition, roleToDisplay } from "@renderer/lib/roles"
  import { winSampleLabel } from "@renderer/lib/build-format"
  import { matchupNote } from "@/shared/lib/notes-match"
  import { useNavigate } from "@tanstack/react-router"
  import { Plus, Swords } from "lucide-react"

  import type { Role, SummonerSpellStatic } from "@/shared/types"

  export function InGameScreen(): React.JSX.Element | null {
  	const inGame = useInGame()
  	const { data: bundle } = useDDragon()
  	const { data: settings } = useSettings()
  	const { data: notes } = useNotes()
  	const upsert = useUpsertNote()
  	const navigate = useNavigate()

  	const version = bundle?.version ?? ""
  	const layout = settings?.spellSlotLayout ?? "DF"

  	const champion = inGame && bundle ? (bundle.championsByKey[inGame.championId] ?? null) : null
  	// in-game role fallback: infer from the champion's lane, then last champ-select role isn't
  	// available here, so CHAMPION_LANE is the source of truth in-game.
  	const displayRole = champion ? championLane(champion.id) : null
  	const role: Role | null = displayRole ? displayToRole(displayRole) : null

  	const { data: build } = useBuild(
  		inGame?.championId ?? null,
  		role ? roleToPosition(role) : null,
  	)

  	if (!inGame || !bundle) return null

  	const s0: SummonerSpellStatic | null = bundle.spellsByKey[inGame.spell1Id] ?? null
  	const s1: SummonerSpellStatic | null = bundle.spellsByKey[inGame.spell2Id] ?? null
  	const spellPair = s0 && s1 ? ([s0, s1] as [SummonerSpellStatic, SummonerSpellStatic]) : null

  	const note = matchupNote(notes ?? [], inGame.championId, null)

  	return (
  		<section className="grid h-full min-h-0 gap-[14px] grid-cols-[1fr_314px] grid-rows-[minmax(0,1fr)]">
  			<div className="flex min-h-0 flex-col gap-[14px] overflow-y-auto -mr-1 pr-1">
  				{/* header strip */}
  				<Card className="flex min-h-[78px] items-center justify-between gap-3 p-4">
  					<div className="flex min-w-0 items-center gap-3">
  						<ChampionPortrait champion={champion} version={version} size={46} ring radius={10} />
  						<div className="flex min-w-0 flex-col gap-[6px]">
  							<span className="text-[16px] font-semibold leading-none tracking-[-0.01em] text-paper-100">
  								{champion?.name ?? "In game"}
  							</span>
  							{role && <RoleTag role={roleToDisplay(role)} active />}
  						</div>
  						<span className="h-10 w-px shrink-0 bg-(--stroke-default)" />
  						<SpellPair pair={spellPair} version={version} layout={layout} size={32} showKeys />
  					</div>
  					<span className="inline-flex items-center gap-[6px] rounded-sm bg-(--accent-bg) px-2 py-[5px] font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-accent">
  						<Swords size={11} />
  						In game
  					</span>
  				</Card>

  				{/* matchup note */}
  				<Section label="Your note">
  					{note ? (
  						<NoteCard
  							key={note.id}
  							note={note}
  							bundle={bundle}
  							version={version}
  							variant="compact"
  							onSaveBody={(body) => {
  								if (!upsert.isPending) upsert.mutate({ id: note.id, body })
  							}}
  							saving={upsert.isPending}
  						/>
  					) : (
  						<div className="flex flex-1 flex-col justify-center gap-3">
  							<ChampionPortrait champion={champion} version={version} size={24} />
  							<p className="m-0 text-[14px] leading-normal text-paper-200">
  								No note yet for{" "}
  								<b className="font-semibold text-paper-100">{champion?.name}</b>.
  							</p>
  							<Button
  								className="self-start"
  								onClick={() => navigate({ to: "/notes", search: { new: true } })}
  							>
  								<Plus size={16} />
  								Add a note
  							</Button>
  						</div>
  					)}
  				</Section>

  				{/* build */}
  				{build && (
  					<Section
  						label="Build"
  						right={
  							<span className="font-mono text-[10px] leading-none text-paper-400">
  								{winSampleLabel(build.winRate, build.sampleSize)}
  							</span>
  						}
  					>
  						<div className="flex flex-col gap-[14px] py-1">
  							<ItemStrip items={build.items} bundle={bundle} version={version} />
  							{build.skillOrder.length > 0 && (
  								<div className="border-t border-(--stroke-subtle) pt-[14px]">
  									<SkillOrderGrid
  										skillOrder={build.skillOrder}
  										skillPriority={build.skillPriority}
  									/>
  								</div>
  							)}
  						</div>
  					</Section>
  				)}
  			</div>

  			{/* right rail */}
  			<div className="flex min-h-0 flex-col gap-[14px]">
  				<Section label="You" grow>
  					<div className="flex flex-1 flex-col gap-3">
  						<div className="flex items-center gap-[10px]">
  							<ChampionPortrait champion={champion} version={version} size={36} ring />
  							<div className="flex min-w-0 flex-col gap-[3px]">
  								<span className="text-[13px] font-semibold leading-none text-paper-100">
  									{champion?.name}
  								</span>
  								{role && (
  									<span className="font-mono text-[10px] leading-none text-paper-400">
  										{roleToDisplay(role)}
  									</span>
  								)}
  							</div>
  						</div>
  						{build?.runes ? (
  							<div className="border-t border-(--stroke-subtle) pt-3">
  								<Eyebrow line={18}>Runes</Eyebrow>
  								<div className="pt-3">
  									<RunesReference runes={build.runes} bundle={bundle} />
  								</div>
  							</div>
  						) : null}
  					</div>
  				</Section>
  			</div>
  		</section>
  	)
  }
  ```

- [ ] **Step 2: Route `InProgress` and `GameStart` to the screen.** Edit `src/renderer/src/pages/home.tsx`:

  ```tsx
  import { ChampSelectScreen } from "@renderer/components/champ-select/champ-select-screen"
  import { InGameScreen } from "@renderer/components/game/in-game-screen"
  import { Disconnected } from "@renderer/components/live/disconnected"
  import { Idle } from "@renderer/components/live/idle"
  import { useLcuStatus, usePhase } from "@renderer/hooks/use-lcu"

  export function HomePage(): React.JSX.Element {
  	const { connected } = useLcuStatus()
  	const phase = usePhase()
  	if (!connected) return <Disconnected />
  	if (phase === "ChampSelect") return <ChampSelectScreen />
  	if (phase === "InProgress" || phase === "GameStart") return <InGameScreen />
  	return <Idle />
  }
  ```

  > `InGameScreen` returns `null` until `useInGame()`/`bundle` resolve, so `GameStart` (where `inGame` may briefly be null) renders nothing rather than crashing; `Idle` would otherwise have shown — acceptable since the user is leaving the lobby flow.

- [ ] **Step 3: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 4: Playwright verify.** Start the app and drive it to the In-Game state:
  - Run `pnpm dev` (background).
  - In the Playwright MCP browser, navigate to the dev renderer URL; set `localStorage.lockin:forceFake = "1"` and reload.
  - In the on-screen **state switcher** bottom bar, set **Client** to **In game** (the option added in Task 5.9).
  - Confirm: header shows the in-game champion (Aatrox) + spells + role tag + "In game" badge; the note renders; the **Build** section shows Starting/Boots/Core (with → arrows)/Situational item rows and the 4×18 skill grid with the `Max order` priority line and a `62% · …games` label; the right rail shows the "You" card + a Runes reference.
  - `browser_take_screenshot` for the record.

- [ ] **Step 5: Commit.**

  ```sh
  git add src/renderer/src/components/game/in-game-screen.tsx src/renderer/src/pages/home.tsx
  git commit -m "feat: add in-game screen with build and skill order"
  ```

---

### Task 5.8 — `MainsEditor` in Settings (UI)

A new **"Your mains"** Settings group: pick a champion + role and add it; rows grouped by role with a role tag and remove button; persisted via `setSettings({ mains })`.

**Files:**
- Create: `src/renderer/src/components/settings/mains-editor.tsx`
- Modify: `src/renderer/src/pages/settings.tsx`

- [ ] **Step 1: Implement `MainsEditor`.** Create `src/renderer/src/components/settings/mains-editor.tsx`. It reuses `ChampionPicker`, `RoleTag`, the `Group`/`Eyebrow` patterns, `groupMainsByRole`, and the `Role`↔`DisplayRole` converters. Add a champion under the currently selected role; remove by `(championId, role)`.

  ```tsx
  import { Card } from "@renderer/components/app/card"
  import { ChampionPicker } from "@renderer/components/app/champion-picker"
  import { Eyebrow } from "@renderer/components/app/eyebrow"
  import { Segmented } from "@renderer/components/app/segmented"
  import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
  import { RoleTag } from "@renderer/components/game/role"
  import { useDDragon, useSetSettings, useSettings } from "@renderer/hooks/use-data"
  import { groupMainsByRole, MAIN_ROLE_ORDER } from "@renderer/lib/mains"
  import { roleToDisplay } from "@renderer/lib/roles"
  import { cn } from "@renderer/lib/utils"
  import { Trash2 } from "lucide-react"
  import { useState } from "react"

  import type { Role } from "@/shared/types"

  export function MainsEditor(): React.JSX.Element | null {
  	const { data: bundle } = useDDragon()
  	const { data: settings } = useSettings()
  	const setSettings = useSetSettings()
  	const [role, setRole] = useState<Role>("top")

  	if (!bundle || !settings) return null

  	const mains = settings.mains
  	const groups = groupMainsByRole(mains)

  	const add = (championId: number | null) => {
  		if (championId == null) return
  		if (mains.some((m) => m.championId === championId && m.role === role)) return
  		setSettings.mutate({ mains: [...mains, { championId, role }] })
  	}

  	const remove = (championId: number, r: Role) => {
  		setSettings.mutate({
  			mains: mains.filter((m) => !(m.championId === championId && m.role === r)),
  		})
  	}

  	const excludeIds = mains.filter((m) => m.role === role).map((m) => m.championId)

  	return (
  		<div className="flex flex-col gap-3">
  			<div className="flex items-center justify-between">
  				<Eyebrow line={22}>Your mains</Eyebrow>
  				<span className="font-mono text-[11px] leading-none text-paper-400">
  					{mains.length} champions
  				</span>
  			</div>

  			<Card className="flex flex-col gap-3 p-3">
  				{mains.length === 0 && (
  					<p className="m-0 px-6 py-5 text-center text-[13px] leading-[1.5] text-paper-400">
  						No mains yet. Add the champions you play, tagged by role.
  					</p>
  				)}

  				{groups.map((g) =>
  					g.championIds.length === 0 ? null : (
  						<div key={g.role} className="flex flex-col gap-2">
  							<RoleTag role={roleToDisplay(g.role)} />
  							<ul className="m-0 flex flex-wrap gap-2 p-0">
  								{g.championIds.map((id) => {
  									const champ = bundle.championsByKey[id] ?? null
  									return (
  										<li
  											key={id}
  											className="flex items-center gap-2 rounded-sm border border-(--stroke-subtle) bg-ink-950 py-1 pl-1 pr-2"
  										>
  											<ChampionPortrait champion={champ} version={bundle.version} size={26} />
  											<span className="text-[12.5px] font-medium leading-none text-paper-100">
  												{champ?.name ?? "Unknown"}
  											</span>
  											<button
  												type="button"
  												onClick={() => remove(id, g.role)}
  												title="Remove"
  												className={cn(
  													"flex cursor-pointer border-none bg-transparent p-[2px] text-paper-400",
  													"transition-colors duration-(--dur-base) ease-(--ease-standard) hover:text-[var(--color-fail)]",
  												)}
  											>
  												<Trash2 size={14} />
  											</button>
  										</li>
  									)
  								})}
  							</ul>
  						</div>
  					),
  				)}

  				{/* add row: role seg + champion picker */}
  				<div className="flex flex-col gap-2 border-t border-(--stroke-subtle) pt-3">
  					<Segmented
  						value={role}
  						onChange={(v) => setRole(v as Role)}
  						options={MAIN_ROLE_ORDER.map((r) => ({ value: r, label: roleToDisplay(r) }))}
  					/>
  					<div className="max-w-[280px]">
  						<ChampionPicker
  							value={null}
  							onChange={add}
  							bundle={bundle}
  							version={bundle.version}
  							placeholder={`Add a ${roleToDisplay(role)} main`}
  							size="sm"
  							excludeIds={excludeIds}
  						/>
  					</div>
  				</div>
  			</Card>
  		</div>
  	)
  }
  ```

- [ ] **Step 2: Add `MainsEditor` to the Settings page.** Edit `src/renderer/src/pages/settings.tsx`:

  Add the import (alongside `BanEditor`):

  ```tsx
  import { MainsEditor } from "@renderer/components/settings/mains-editor"
  ```

  Place it after `<BanEditor />` (before the trailing spacer):

  ```tsx
  			<BanEditor />

  			<MainsEditor />

  			<div className="h-1" />
  ```

- [ ] **Step 3: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 4: Playwright verify.** With the app running in force-fake mode, navigate to **Settings**:
  - Confirm a **"Your mains"** group appears below the ban list with a role Segmented (Top/Jungle/Mid/Bot/Support) and an "Add a … main" champion picker.
  - Pick **Top**, add **Aatrox** → a Top group with the Aatrox chip appears and the count increments.
  - Add a second role (e.g. Mid → Ahri) → grouped under its role tag.
  - Click the trash icon → the chip is removed and the count decrements.
  - `browser_take_screenshot`.

- [ ] **Step 5: Commit.**

  ```sh
  git add src/renderer/src/components/settings/mains-editor.tsx src/renderer/src/pages/settings.tsx
  git commit -m "feat: add mains editor to settings"
  ```

---

### Task 5.9 — `YourMains` section in champ select + "In game" state-switcher option (UI)

The **"Your mains"** section in the champ-select left column (under the note), grouped by role, with an empty-state prompt linking to settings; plus the **"In game"** phase option in the dev state switcher so the In-Game screen is previewable in force-fake mode.

**Files:**
- Create: `src/renderer/src/components/champ-select/your-mains.tsx`
- Modify: `src/renderer/src/components/champ-select/champ-select-screen.tsx`
- Modify: `src/renderer/src/components/dev/state-switcher.tsx`

- [ ] **Step 1: Implement `YourMains`.** Create `src/renderer/src/components/champ-select/your-mains.tsx`. Reads `settings.mains`, groups by role, shows a compact role-tagged chip list, and links to Settings when empty.

  ```tsx
  import { Section } from "@renderer/components/champ-select/section"
  import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
  import { RoleTag } from "@renderer/components/game/role"
  import { useDDragon, useSettings } from "@renderer/hooks/use-data"
  import { groupMainsByRole } from "@renderer/lib/mains"
  import { roleToDisplay } from "@renderer/lib/roles"
  import { useNavigate } from "@tanstack/react-router"
  import { Settings as SettingsIcon } from "lucide-react"

  interface YourMainsProps {
  	grow?: boolean
  }

  export function YourMains({ grow }: YourMainsProps): React.JSX.Element | null {
  	const { data: bundle } = useDDragon()
  	const { data: settings } = useSettings()
  	const navigate = useNavigate()

  	if (!bundle || !settings) return null

  	const mains = settings.mains
  	const groups = groupMainsByRole(mains).filter((g) => g.championIds.length > 0)

  	return (
  		<Section label="Your mains" grow={grow} scroll={grow}>
  			{mains.length === 0 ? (
  				<div className="flex flex-1 flex-col items-center justify-center gap-[10px] px-3 py-2 text-center">
  					<p className="m-0 text-[13px] leading-[1.4] text-paper-300">
  						Add the champions you play to see them here.
  					</p>
  					<button
  						type="button"
  						onClick={() => navigate({ to: "/settings" })}
  						className="inline-flex cursor-pointer items-center gap-[6px] border-none bg-transparent text-[12px] font-medium leading-none text-accent"
  					>
  						<SettingsIcon size={13} />
  						Set up your mains
  					</button>
  				</div>
  			) : (
  				<div className="flex flex-col gap-[10px]">
  					{groups.map((g) => (
  						<div key={g.role} className="flex flex-col gap-[6px]">
  							<RoleTag role={roleToDisplay(g.role)} />
  							<ul className="m-0 flex flex-wrap gap-[6px] p-0">
  								{g.championIds.map((id) => {
  									const champ = bundle.championsByKey[id] ?? null
  									return (
  										<li key={id} title={champ?.name}>
  											<ChampionPortrait champion={champ} version={bundle.version} size={28} />
  										</li>
  									)
  								})}
  							</ul>
  						</div>
  					))}
  				</div>
  			)}
  		</Section>
  	)
  }
  ```

- [ ] **Step 2: Add `YourMains` to the champ-select left column.** Edit `src/renderer/src/components/champ-select/champ-select-screen.tsx`. Import it and place it under the `NotesRegion` in the left column. The note keeps `grow` (it scrolls when long); `YourMains` stays compact below it.

  Add the import:

  ```tsx
  import { YourMains } from "@renderer/components/champ-select/your-mains"
  ```

  Replace the left-column block:

  ```tsx
  			<div className="flex min-h-0 flex-col gap-[14px]">
  				<HeaderStrip
  					me={vm.me}
  					spells={vm.spells}
  					layout={layout}
  					version={version}
  					subPhase={vm.subPhase}
  					secondsLeft={vm.secondsLeft}
  					phaseTotal={vm.phaseTotal}
  					timerVisible={vm.timerVisible}
  				/>
  				<NotesRegion
  					note={vm.note}
  					enemyHidden={vm.enemyHidden}
  					me={vm.me}
  					opponent={vm.opponent}
  					version={version}
  					grow
  				/>
  				<YourMains />
  			</div>
  ```

- [ ] **Step 3: Add the "In game" phase to the dev state switcher.** Edit `src/renderer/src/components/dev/state-switcher.tsx`. Add the option to the Client phase `Seg` (the `ScenarioState["phase"]` union gains `"game"` in the fake layer — Task 5.10):

  ```tsx
  				<Seg
  					accentActive
  					value={snapshot.phase}
  					onChange={(v) => drive({ phase: v })}
  					options={[
  						{ value: "disconnected", label: "Disconnected" },
  						{ value: "idle", label: "Idle" },
  						{ value: "ready", label: "Ready Check" },
  						{ value: "select", label: "Champ Selection" },
  						{ value: "game", label: "In game" },
  					]}
  				/>
  ```

  And add an "In game" hint paragraph by extending the existing idle/disconnected hint condition to also describe the game phase (place this new block right after the existing idle/disconnected hint block):

  ```tsx
  			{snapshot.phase === "game" && (
  				<p className="m-0 max-w-[320px] text-right text-[11px] leading-[1.4] text-paper-400">
  					In a live game — showing the build, skill order, and runes for your champion.
  				</p>
  			)}
  ```

- [ ] **Step 4: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 5: Playwright verify.** App running in force-fake mode:
  - In **Champ Selection** phase, confirm a **"Your mains"** section now sits under the note in the left column. With no mains configured it shows the "Set up your mains" prompt; after adding mains in Settings, the chips appear grouped by role.
  - Switch the **Client** seg to **In game** and confirm it renders the In-Game screen (sanity re-check from Task 5.7).
  - `browser_take_screenshot` of both.

- [ ] **Step 6: Commit.**

  ```sh
  git add src/renderer/src/components/champ-select/your-mains.tsx src/renderer/src/components/champ-select/champ-select-screen.tsx src/renderer/src/components/dev/state-switcher.tsx
  git commit -m "feat: add Your mains section to champ select and in-game dev state"
  ```

---

### Task 5.10 — Fake layer: build + summoner + in-game fixtures and "game" scenario (UI plumbing)

Wire the fake bridge so the In-Game screen and mains are fully previewable without a client: a `FIXTURE_BUILD` (Aatrox top), a `FIXTURE_SUMMONER`, minimal `runesById`/`itemsById` on `FIXTURE_BUNDLE`, the `"game"` scenario phase mapping to `InProgress`, and `getBuild`/`onInGame`/`onSummoner` bridge methods.

> If an earlier phase (per the shared contract's "Fake layer" section) already added any of these, this task only adds what's missing — the goal is the In-Game screen renders end-to-end in force-fake mode.

**Files:**
- Modify: `src/renderer/src/api/fake/fixtures.ts`
- Modify: `src/renderer/src/api/fake/scenario.ts`
- Modify: `src/renderer/src/api/fake/bridge.ts`

- [ ] **Step 1: Add fixtures.** Edit `src/renderer/src/api/fake/fixtures.ts`.

  Extend the type imports at the top:

  ```ts
  import type {
  	AppSettings,
  	BanListEntry,
  	BuildRecommendation,
  	ChampionStatic,
  	DDragonBundle,
  	InGameState,
  	MatchupNote,
  	RankInfo,
  	SummonerIdentity,
  	SummonerSpellStatic,
  } from "@/shared/types"
  ```

  Replace the `FIXTURE_BUNDLE` export to include minimal `runesById`/`itemsById` (covering the ids used by `FIXTURE_BUILD`):

  ```ts
  /* minimal rune catalog entries — keystone + a couple perks used by FIXTURE_BUILD */
  const RUNES_BY_ID: DDragonBundle["runesById"] = {
  	8010: { id: 8010, key: "Conqueror", name: "Conqueror", icon: "perk-images/Styles/Precision/Conqueror/Conqueror.png" },
  	9111: { id: 9111, key: "Triumph", name: "Triumph", icon: "perk-images/Styles/Precision/Triumph.png" },
  	9104: { id: 9104, key: "LegendAlacrity", name: "Legend: Alacrity", icon: "perk-images/Styles/Precision/LegendAlacrity/LegendAlacrity.png" },
  	8014: { id: 8014, key: "CoupDeGrace", name: "Coup de Grace", icon: "perk-images/Styles/Precision/CoupDeGrace/CoupDeGrace.png" },
  	8473: { id: 8473, key: "BonePlating", name: "Bone Plating", icon: "perk-images/Styles/Resolve/BonePlating/BonePlating.png" },
  	8242: { id: 8242, key: "Unflinching", name: "Unflinching", icon: "perk-images/Styles/Sorcery/Unflinching/Unflinching.png" },
  }

  /* minimal item catalog entries used by FIXTURE_BUILD */
  const ITEMS_BY_ID: DDragonBundle["itemsById"] = {
  	1054: { id: 1054, name: "Doran's Shield", imageFull: "1054.png" },
  	2003: { id: 2003, name: "Health Potion", imageFull: "2003.png" },
  	3047: { id: 3047, name: "Plated Steelcaps", imageFull: "3047.png" },
  	6630: { id: 6630, name: "Goredrinker", imageFull: "6630.png" },
  	3071: { id: 3071, name: "Black Cleaver", imageFull: "3071.png" },
  	6333: { id: 6333, name: "Death's Dance", imageFull: "6333.png" },
  	3053: { id: 3053, name: "Sterak's Gage", imageFull: "3053.png" },
  	3742: { id: 3742, name: "Dead Man's Plate", imageFull: "3742.png" },
  	3065: { id: 3065, name: "Spirit Visage", imageFull: "3065.png" },
  }

  export const FIXTURE_BUNDLE: DDragonBundle = {
  	version: "14.10.1", // pinned mock version (data.js:6); real version resolved in Phase 4
  	championsByKey: Object.fromEntries(CHAMPIONS.map((c) => [c.key, c])),
  	spellsByKey: Object.fromEntries(SPELLS.map((s) => [s.key, s])),
  	runesById: RUNES_BY_ID,
  	itemsById: ITEMS_BY_ID,
  }
  ```

  Append the summoner, in-game, and build fixtures at the end of the file:

  ```ts
  export const FIXTURE_SUMMONER: SummonerIdentity = {
  	gameName: "lategame andy",
  	tagLine: "EUW",
  	profileIconId: 4568,
  	summonerLevel: 312,
  	puuid: "p-me",
  }

  export const FIXTURE_IN_GAME: InGameState = {
  	championId: C.aatrox,
  	spell1Id: 4, // Flash
  	spell2Id: 12, // Teleport
  	queueId: 420, // Ranked Solo
  }

  export const FIXTURE_BUILD: BuildRecommendation = {
  	championKey: C.aatrox,
  	role: "top",
  	patch: "14.10",
  	winRate: 0.62,
  	sampleSize: 12_400,
  	runes: {
  		primaryStyleId: 8000,
  		subStyleId: 8400,
  		// [keystone, p1, p2, p3, s1, s2, shard1, shard2, shard3]
  		selectedPerkIds: [8010, 9111, 9104, 8014, 8473, 8242, 5005, 5008, 5001],
  		primaryName: "Precision",
  		secondaryName: "Resolve",
  	},
  	spells: [4, 12],
  	items: {
  		starter: { ids: [1054, 2003] },
  		boots: { ids: [3047] },
  		core: { ids: [6630, 3071, 6333] },
  		situational: { ids: [3053, 3742, 3065] },
  	},
  	skillOrder: [
  		"Q", "W", "E", "Q", "Q", "R",
  		"Q", "E", "Q", "E", "R", "E",
  		"E", "W", "W", "R", "W", "W",
  	],
  	skillPriority: ["Q", "E", "W"],
  }
  ```

- [ ] **Step 2: Add the `"game"` phase to the scenario.** Edit `src/renderer/src/api/fake/scenario.ts`.

  Widen the union:

  ```ts
  	phase: "disconnected" | "idle" | "ready" | "select" | "game"
  ```

  Extend the gameflow map:

  ```ts
  export const GAMEFLOW_BY_SCENARIO: Record<ScenarioState["phase"], GameflowPhase> = {
  	disconnected: "None",
  	idle: "Lobby",
  	ready: "ReadyCheck",
  	select: "ChampSelect",
  	game: "InProgress",
  }
  ```

- [ ] **Step 3: Wire the bridge.** Edit `src/renderer/src/api/fake/bridge.ts`.

  Extend the type imports:

  ```ts
  import type { Api, Unsubscribe } from "@/shared/api"
  import type {
  	AppSettings,
  	BanListEntry,
  	BuildRecommendation,
  	ChampSelectSession,
  	GameflowPhase,
  	InGameState,
  	MatchupNote,
  	RankInfo,
  	ReadyCheck,
  	RunePageRec,
  	SummonerIdentity,
  } from "@/shared/types"
  ```

  Extend the fixtures import:

  ```ts
  import {
  	C,
  	FIXTURE_BANLIST,
  	FIXTURE_BUILD,
  	FIXTURE_BUNDLE,
  	FIXTURE_IN_GAME,
  	FIXTURE_NOTES,
  	FIXTURE_RANKS,
  	FIXTURE_SETTINGS,
  	FIXTURE_SUMMONER,
  } from "./fixtures"
  ```

  Add two channels next to the existing ones:

  ```ts
  const statusCh = channel<{ connected: boolean }>()
  const phaseCh = channel<{ phase: GameflowPhase }>()
  const readyCh = channel<ReadyCheck | null>()
  const champCh = channel<ChampSelectSession | null>()
  const summonerCh = channel<SummonerIdentity | null>()
  const inGameCh = channel<InGameState | null>()
  ```

  Extend `emitAll()` to also push summoner + in-game:

  ```ts
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
  	summonerCh.emit(connected ? FIXTURE_SUMMONER : null)
  	inGameCh.emit(scenario.phase === "game" ? FIXTURE_IN_GAME : null)
  }
  ```

  Add the bridge methods to the `fakeBridge` object. Place the invoke methods near the other `async` methods (e.g. after `getRanksForPuuids`), and the subscription methods after `onChampSelect`:

  ```ts
  	async getBuild(championKey, position, _tier) {
  		// only the Aatrox/top fixture resolves; anything else returns null (graceful)
  		if (championKey === FIXTURE_BUILD.championKey && position === "TOP") {
  			return { ...FIXTURE_BUILD }
  		}
  		return null as BuildRecommendation | null
  	},
  	async setSpells(_spell1Id, _spell2Id) {
  		// no-op in fake mode
  	},
  	async applyRunes(_page: RunePageRec) {
  		return { ok: true }
  	},
  	async startQueue(_queueId) {
  		return { ok: true }
  	},
  	async stopQueue() {
  		// no-op in fake mode
  	},
  ```

  And the subscriptions (after `onChampSelect`):

  ```ts
  	onSummoner: (cb) => {
  		const off = summonerCh.on(cb)
  		cb(scenario.phase !== "disconnected" ? FIXTURE_SUMMONER : null)
  		return off
  	},
  	onInGame: (cb) => {
  		const off = inGameCh.on(cb)
  		cb(scenario.phase === "game" ? FIXTURE_IN_GAME : null)
  		return off
  	},
  	onNav: (_cb) => {
  		// tray-driven navigation has no source in fake mode
  		return () => {}
  	},
  ```

- [ ] **Step 4: Typecheck and format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 5: Playwright verify.** App in force-fake mode:
  - Set **Client** → **In game**. Confirm the In-Game screen renders the Aatrox header, the Build section with the fixture items (Doran's Shield/Health Potion starter, Plated Steelcaps boots, Goredrinker → Black Cleaver → Death's Dance core, situational pool), the skill grid with `Q › E › W` priority, and the right-rail "You" card + Runes reference.
  - Switch back to **Champ Selection** and **Idle** to confirm no regressions.
  - `browser_take_screenshot` of the In-Game screen.

- [ ] **Step 6: Commit.**

  ```sh
  git add src/renderer/src/api/fake/fixtures.ts src/renderer/src/api/fake/scenario.ts src/renderer/src/api/fake/bridge.ts
  git commit -m "feat: add build/summoner/in-game fixtures and game scenario to fake bridge"
  ```

---

### Task 5.11 — Phase verification

**Files:**
- (no source changes — verification only)

- [ ] **Step 1: Run the full unit suite, expect PASS:**

  ```sh
  pnpm test
  ```

  Confirm the new files run: `roles.test.ts`, `mains.test.ts`, `skill-order.test.ts`, `build-format.test.ts`.

- [ ] **Step 2: Final typecheck + format:**

  ```sh
  pnpm typecheck && pnpm format
  ```

- [ ] **Step 3: End-to-end Playwright pass** in force-fake mode covering this phase's acceptance criteria:
  - `InProgress` ("In game" scenario) renders the In-Game screen (not Idle).
  - Build (items) + skill order render from the fixture; the 4×18 grid shows R at levels 6/11/16 and is color-coded.
  - Champ select shows a "Your mains" section: empty prompt with no mains, then grouped chips after adding mains in Settings.
  - Mains are editable in Settings and persist across a reload (force-fake persists in module memory for the session; verify add/remove updates the count and the champ-select section reflects it).
  - `browser_take_screenshot` of the In-Game screen, the Settings "Your mains" group, and the champ-select "Your mains" section for the record.

- [ ] **Step 4:** No commit (verification only). If any check fails, return to the owning task, fix, re-verify, and amend that task's commit.

---

## Phase 6 — PRD/CLAUDE.md updates + final integration verification

This phase has **no application code**. It records the deliberate scope change (OP.GG as an external recommendation source; opt-in, off-by-default rune + spell auto-apply; user-clicked tray queue-start that is never looped; a new In-Game state; the new IPC channels) into `PRD.md` and `CLAUDE.md`, then runs a full-app verification pass. Run it **after** Phases 1–5 have landed (it documents and verifies their combined result).

Throughout, follow the project's house style: em dashes in PRD/CLAUDE prose are intentional and stay (the §7.5 copy pass only de-em-dashes *user-facing app strings*, not these docs). Commits are conventional with no `Co-Authored-By: Claude` trailer.

---

### Task 6.1 — PRD.md §2.2 Non-Goals: reverse the two now-in-scope items

**Files:**
- Modify `/Users/felipe/lockin/PRD.md` (§2.2 Non-Goals block, lines 29–36)

- [ ] **Step 1: Read the current §2.2 block** to confirm the exact text before editing.
  - `Read /Users/felipe/lockin/PRD.md` offset 29 limit 8.

- [ ] **Step 2: Replace the two reversed non-goal bullets and the auto-anything bullet.** Apply this exact edit.

  Replace:
  ```md
  - **No** post-game analytics, match history, or stat tracking.
  - **No** starting-item recommendations and **no** crowd-sourced / "pro" data (u.gg / Blitz-style). Summoner-spell suggestions are *heuristic + user-defined* only. See §6.1.
  ```
  with:
  ```md
  - **No** post-game analytics, match history, or stat tracking.
  - ~~**No** starting-item recommendations and **no** crowd-sourced / "pro" data~~ **Now in scope (v1.1):** item builds, rune pages, skill order, and summoner-spell recommendations are sourced from **one external read source (OP.GG MCP)** behind a swappable `BuildProvider`, disk-cached per (champion, role, patch). DDragon remains the catalog. Still **no first-party backend** and no other crowd-sourced surfaces (no win-rate dashboards, no match history). User-defined matchup notes and the offline spell heuristic remain and take precedence over OP.GG where they apply. See §6.1.
  ```

- [ ] **Step 3: Reverse the "no auto-anything" non-goal.** Replace:
  ```md
  - **No** auto-pick / auto-ban / auto-anything beyond accepting the ready check.
  ```
  with:
  ```md
  - **No** auto-pick / auto-ban / auto-dodge. **Now in scope (v1.1), opt-in and off by default:** automatic application of recommended **rune pages** and **summoner spells** during champ select, and **user-clicked** queue start from the tray. The line we hold: no automation of gameplay *decisions* (pick/ban/dodge), and queue-start is **never** chained with auto-accept into a hands-off matchmaking loop. See §14.
  ```

- [ ] **Step 4: Verify the file still reads cleanly** around §2.2.
  - `Read /Users/felipe/lockin/PRD.md` offset 29 limit 12 — confirm the three replacements are present and the surrounding bullets (no overlay, no Windows/Linux, no multi-account sync) are untouched.

- [ ] **Step 5: Commit.**
  ```sh
  git add /Users/felipe/lockin/PRD.md && git commit -m "docs(prd): reverse §2.2 non-goals for OP.GG builds and opt-in auto-apply"
  ```

---

### Task 6.2 — PRD.md §6.1: retitle and rewrite the spell-recommendation scope note

**Files:**
- Modify `/Users/felipe/lockin/PRD.md` (§6.1 heading + scope note + heuristic note, lines 123–138)

- [ ] **Step 1: Read §6.1** to confirm exact text.
  - `Read /Users/felipe/lockin/PRD.md` offset 123 limit 30.

- [ ] **Step 2: Retitle the §6.1 heading.** Replace:
  ```md
  ### 6.1 Recommended Summoner Spells
  ```
  with:
  ```md
  ### 6.1 Recommendations: Summoner Spells, Runes, Items & Skill Order
  ```

- [ ] **Step 3: Replace the honest-scope blockquote** with the v1.1 sourcing model. Replace:
  ```md
  > **Honest scope note:** Data Dragon provides the **catalog** of summoner spells and their icons, but not per-matchup recommendations. v1 uses a deterministic **heuristic engine** plus **user overrides**. Starting-item recommendations and crowd-sourced data are deliberate non-goals.
  ```
  with:
  ```md
  > **Scope note (v1.1):** Data Dragon is the **catalog** (what each rune/spell/item/ability *is*); it never says what's *good* for champion X in role Y. Per-champ/per-role recommendations come from **OP.GG MCP** (`mcp-api.op.gg/mcp`, keyless JSON-RPC, tool `lol_get_champion_analysis`), normalized into a `BuildRecommendation` and disk-cached per (championKey, role, patch). It is accessed only in the **main process** behind a swappable `BuildProvider` interface (`src/main/build/`), so the source can be replaced later; network or parse failure degrades to **null** (the UI hides the build, never crashes). The renderer reads recommendations via the `build:get` IPC query (TanStack Query, long `staleTime`). The deterministic **heuristic engine** below stays as the **offline fallback** for spells.
  ```

- [ ] **Step 4: Update the spell precedence + auto-apply paragraph.** Immediately after the heuristic engine list (after the line beginning `**User override.** Pinned spells…`), the precedence is: pinned-note spells > OP.GG recommendation > heuristic. Replace:
  ```md
  **User override.** Pinned spells on a matching note replace the heuristic output for that matchup.
  ```
  with:
  ```md
  **User override & precedence.** Effective spells resolve in order: **pinned-note spells** (labeled "Your pick") > **OP.GG recommendation** > **heuristic** (offline fallback). The pinned-note value always wins for that matchup.

  **Auto-apply (opt-in, off by default).** When `autoSpells` / `autoRunes` are enabled, a change in the effective champion writes to the client during champ select — spells via `lcu:setSpells` (`PATCH /lol-champ-select/v1/session/my-selection`) and runes via `lcu:applyRunes`, which creates/replaces a **lockin-owned** rune page only (the user's own pages are never modified) and sets it current. Both default off; with them off, the panel only *displays* recommendations and performs no writes. See §6.6 and §14.
  ```

- [ ] **Step 5: Append the four new acceptance criteria** to the §6.1 acceptance list. Replace:
  ```md
  - [ ] No crash when a spell ID doesn't resolve for the current patch.
  ```
  with:
  ```md
  - [ ] No crash when a spell ID doesn't resolve for the current patch.
  - [ ] The recommendation panel shows OP.GG runes, spells, and a win% · sample-size label for the hovered or locked champion + role.
  - [ ] With `autoRunes` on, a lockin-owned rune page is created/replaced and set current; the user's own pages are never modified.
  - [ ] With `autoSpells` on, summoner spells are written to the client.
  - [ ] Both toggles default off; with them off, no client writes happen and pinned-note spells still override and are labeled "Your pick."
  ```

- [ ] **Step 6: Verify §6.1 reads cleanly.**
  - `Read /Users/felipe/lockin/PRD.md` offset 123 limit 40 — confirm heading, blockquote, precedence/auto-apply paragraphs, and the four added acceptance bullets are present.

- [ ] **Step 7: Commit.**
  ```sh
  git add /Users/felipe/lockin/PRD.md && git commit -m "docs(prd): rewrite §6.1 for OP.GG recommendations and opt-in auto-apply"
  ```

---

### Task 6.3 — PRD.md: add §6.6 (In-Game screen & mains), §6.7 (tray), and a §7 type-model note

**Files:**
- Modify `/Users/felipe/lockin/PRD.md` (insert §6.6/§6.7 after §6.5, before the `---` and `## 7 Data Models`; extend §7 data models)

- [ ] **Step 1: Read the §6.5 → §7 boundary** to locate the insertion point.
  - `Read /Users/felipe/lockin/PRD.md` offset 243 limit 12 — confirm §6.5 ends at the `---` on line 244 and `## 7. Data Models (TypeScript)` follows on line 246.

- [ ] **Step 2: Insert §6.6 and §6.7 before the `---` that closes §6.** Replace this boundary (lines 242–246):
  ```md
  - [ ] Graceful degradation when ranks are missing; never blocks champ-select UI.

  ---

  ## 7. Data Models (TypeScript)
  ```
  with:
  ```md
  - [ ] Graceful degradation when ranks are missing; never blocks champ-select UI.

  ---

  ### 6.6 In-Game Screen & Champ-Select "Mains"

  **In-Game screen.** The `/live` route renders a dedicated **In-Game** view on the `InProgress` (and `GameStart`) phase instead of falling through to Idle. It reuses the champ-select shell. The local champion + spells come from the `lcu:inGame` push (`InGameState`, read from `GET /lol-gameflow/v1/session` → `gameData.playerChampionSelections[]` matched by the local puuid, plus `gameData.queue.id`).

  Layout: a **main column** (header strip → matchup **Note** → **item Build** as horizontal Starting → Boots → Core → Situational strips → **Skill order**, a color-coded grid with the Q › E › W priority and win% · games label) and a **right rail** (team list + a compact, read-only runes reference, since runes are locked in-game). Build data is `build:get(championKey, role)`; role comes from the gameflow selection or the last champ-select role, falling back to the champion's default lane.

  **Champ-select "Your mains."** A new section in the champ-select notes column lists the user's configured **main champions**, grouped by role (portraits). Mains are edited in a new **Settings → "Your mains"** group (champion picker + role tag) and persist in settings (`AppSettings.mains`).

  **Edge cases.** No mains configured → subtle empty prompt linking to settings. In-game champion unresolved → show note + team only. Build unavailable (OP.GG null/offline) → show note + team, hide the build/skill sections.

  **Acceptance criteria.**
  - [ ] `InProgress` renders the In-Game screen (not Idle).
  - [ ] Item build and skill order render from OP.GG for the in-game champion; the skill grid is correct (R at 6/11/16) and color-coded.
  - [ ] Champ select shows a "Your mains" section populated from settings, with an empty state when none.
  - [ ] Mains are editable in Settings and persist across restarts.

  ---

  ### 6.7 Native Tray Menu & User-Clicked Queue Start

  **Behavior.** A rich macOS tray menu (`src/main/tray.ts`), rebuilt whenever status / summoner / settings change. Items: a disabled status header (`● Connected · gameName#tagLine` or `○ Client not detected`); an **Auto-accept** checkbox bound to `settings.autoAccept` plus a global accelerator (default `Control+Alt+A`) that toggles it; **Start ranked queue** / **Start flex queue**; **New note…** (focuses the window and emits `nav:go` to `/notes?new`); **Open lockin**; **Quit**.

  **Queue start (the guardrail).** Start-ranked/flex creates a lobby (`POST /lol-lobby/v2/lobby`), sets ranked position preferences best-effort, then starts matchmaking (`POST /lol-matchmaking/v1/search`) via `lcu:startQueue(queueId)`. It is invoked **only by an explicit user click** — never on a timer, never in a loop, and **never auto-chained with auto-accept** into hands-off matchmaking. Failures surface via a native `Notification`. `lcu:stopQueue` cancels the search.

  **queueIds:** 400 Draft · 420 Ranked Solo/Duo · 430 Blind · 440 Ranked Flex · 450 ARAM.

  **Acceptance criteria.**
  - [ ] Tray shows nickname/status when connected and clears on disconnect.
  - [ ] Auto-accept checkbox reflects and toggles the setting; the global shortcut toggles it too.
  - [ ] Start ranked/flex creates a lobby and begins matchmaking; failures show a notification.
  - [ ] Queue start fires only on explicit click and is never chained with auto-accept; New note opens the note-creation screen; Quit quits.

  ---

  ## 7. Data Models (TypeScript)
  ```

- [ ] **Step 3: Append the v1.1 types to §7.** Read the close of the §7 code block (the `AppSettings` interface and the locale note).
  - `Read /Users/felipe/lockin/PRD.md` offset 346 limit 12 — confirm `interface AppSettings { … }` then the closing ``` ``` `` then the `> Note:` locale line.

- [ ] **Step 4: Replace the `AppSettings` interface with its v1.1 fields and append the three new model interfaces inside the same code block.** Replace:
  ```md
  interface AppSettings {
    autoAccept: boolean;                 // default false
    autoAcceptDelayMs: number;           // default 0
    spellSlotLayout: "DF" | "FD";        // default "DF"
    rankDiffThreshold: number;           // tiers/divisions delta to flag
  }
  ```
  with:
  ```md
  interface AppSettings {
    autoAccept: boolean;                 // default false
    autoAcceptDelayMs: number;           // default 0
    spellSlotLayout: "DF" | "FD";        // default "DF"
    rankDiffThreshold: number;           // tiers/divisions delta to flag
    autoRunes: boolean;                  // v1.1 — default false (opt-in)
    autoSpells: boolean;                 // v1.1 — default false (opt-in)
    buildTier: string;                   // v1.1 — default "emerald_plus"
    mains: { championId: number; role: Role }[]; // v1.1 — default []
  }

  // ---------- Recommendations (normalized from BuildProvider) — v1.1 ----------
  type Role = "top" | "jungle" | "middle" | "bottom" | "utility";

  interface RunePageRec {
    primaryStyleId: number;
    subStyleId: number;
    selectedPerkIds: number[];           // exactly 9, LCU order: [keystone, p1,p2,p3, s1,s2, shard1,shard2,shard3]
    primaryName: string;
    secondaryName: string;
  }
  interface ItemGroup { ids: number[]; winRate?: number; pickRate?: number }
  interface BuildRecommendation {
    championKey: number;
    role: Role;
    patch: string;
    winRate: number;                     // 0..1
    sampleSize: number;                  // total games
    runes: RunePageRec | null;
    spells: [number, number] | null;
    items: { starter: ItemGroup; boots: ItemGroup; core: ItemGroup; situational: ItemGroup };
    skillOrder: ("Q"|"W"|"E"|"R")[];     // length 18, ability leveled at each level 1..18
    skillPriority: ("Q"|"W"|"E")[];      // max-order priority, e.g. ["Q","E","W"]
  }

  // ---------- Live LCU additions — v1.1 ----------
  interface SummonerIdentity {
    gameName: string;
    tagLine: string;
    profileIconId: number;
    summonerLevel: number;
    puuid: string;
  }
  interface InGameState {
    championId: number;
    spell1Id: number;
    spell2Id: number;
    queueId: number;
  }
  // LcuSnapshot gains: summoner: SummonerIdentity | null; inGame: InGameState | null
  // DDragonBundle gains: runesById, itemsById (catalog for the recommendation panels)
  ```

- [ ] **Step 5: Verify the §6.6/§6.7 insertion and the §7 type additions read cleanly.**
  - `Read /Users/felipe/lockin/PRD.md` offset 244 limit 60 — confirm §6.6 and §6.7 are present, well-formed, and §7 still follows.

- [ ] **Step 6: Commit.**
  ```sh
  git add /Users/felipe/lockin/PRD.md && git commit -m "docs(prd): add §6.6 in-game/mains, §6.7 tray, and v1.1 data models"
  ```

---

### Task 6.4 — PRD.md §8 IPC contract + §11 screens-in-scope (add In-Game)

**Files:**
- Modify `/Users/felipe/lockin/PRD.md` (§8 push/invoke tables ~lines 362–383; §11 screens list ~lines 436–442)

- [ ] **Step 1: Read §8 tables.**
  - `Read /Users/felipe/lockin/PRD.md` offset 362 limit 25 — confirm the two markdown tables (push and invoke) exact rows.

- [ ] **Step 2: Add the three v1.1 push rows.** Replace the closing row of the push table:
  ```md
  | `lcu:champSelect` | `ChampSelectSession \| null` |
  ```
  with:
  ```md
  | `lcu:champSelect` | `ChampSelectSession \| null` |
  | `lcu:summoner` *(v1.1)* | `SummonerIdentity \| null` |
  | `lcu:inGame` *(v1.1)* | `InGameState \| null` |
  | `nav:go` *(v1.1)* | `{ to: string; search?: Record<string, unknown> }` (tray-driven navigation) |
  ```

- [ ] **Step 3: Add the five v1.1 invoke rows.** Replace the closing row of the invoke table:
  ```md
  | `rank:getForPuuids` | `(puuids: string[]) → Record<string, RankInfo \| null>` *(spike)* | query |
  ```
  with:
  ```md
  | `rank:getForPuuids` | `(puuids: string[]) → Record<string, RankInfo \| null>` *(spike)* | query |
  | `build:get` *(v1.1)* | `(championKey, position, tier?) → BuildRecommendation \| null` | query (long cache) |
  | `lcu:setSpells` *(v1.1)* | `(spell1Id, spell2Id) → void` | mutation |
  | `lcu:applyRunes` *(v1.1)* | `(page: RunePageRec) → { ok: boolean; error?: string }` | mutation |
  | `lcu:startQueue` *(v1.1)* | `(queueId) → { ok: boolean; error?: string }` | mutation |
  | `lcu:stopQueue` *(v1.1)* | `() → void` | mutation |
  ```

- [ ] **Step 4: Read §11 screens-in-scope list.**
  - `Read /Users/felipe/lockin/PRD.md` offset 436 limit 8.

- [ ] **Step 5: Add the In-Game screen to §11.** Replace:
  ```md
  - **Champ Select** (the hero screen: recommended spells, matchup notes, ban suggestions, phase/dodge timer, team ranks)
  - **Notes Library + note editor**
  ```
  with:
  ```md
  - **Champ Select** (the hero screen: recommended spells + OP.GG runes/build recommendation, matchup notes, "Your mains," ban suggestions, phase/dodge timer, team ranks)
  - **In-Game** *(v1.1)* (the `InProgress`/`GameStart` view: champion header, matchup note, item build, skill order, team + read-only runes reference)
  - **Notes Library + note editor**
  ```

- [ ] **Step 6: Verify §8 and §11 edits.**
  - `Read /Users/felipe/lockin/PRD.md` offset 362 limit 30 and `offset 436 limit 12` — confirm all eight new IPC rows and the In-Game screen line are present.

- [ ] **Step 7: Commit.**
  ```sh
  git add /Users/felipe/lockin/PRD.md && git commit -m "docs(prd): add v1.1 IPC channels and the In-Game screen to §8/§11"
  ```

---

### Task 6.5 — PRD.md §14 Compliance: document expanded automated writes

**Files:**
- Modify `/Users/felipe/lockin/PRD.md` (§14 Compliance & Risk, lines 469–478)

- [ ] **Step 1: Read §14.**
  - `Read /Users/felipe/lockin/PRD.md` offset 469 limit 12.

- [ ] **Step 2: Expand the auto-accept bullet and the no-automation bullet.** Replace:
  ```md
  - **Auto-accept is automation** and is the one feature in a gray area under Riot's third-party policies. Mainstream apps ship it and it functions, but it could be interpreted as automation. Mitigations: keep it **off by default**, opt-in, with a clear in-app note. The user assumes this risk.
  ```
  with:
  ```md
  - **Automated client writes (v1.1).** Beyond accepting the ready check, the app can: (a) **apply recommended rune pages and summoner spells** during champ select, and (b) **start a ranked/flex queue** from the tray. Riot's third-party policy explicitly permits rune/build/spell recommendation **and import** — Blitz, OP.GG, and Porofessor do exactly this. The line we hold: **rune/spell apply and queue-start are opt-in and off by default**; rune apply only ever touches a **lockin-owned** page (never the user's pages); queue-start fires **only on an explicit user click** and is **never** chained with auto-accept into a hands-off matchmaking loop. Auto-accept itself stays **off by default**, opt-in, with a clear in-app note. The user assumes the (small) automation risk.
  ```

- [ ] **Step 3: Update the "no automated decisions" bullet.** Replace:
  ```md
  - **No automated dodging, picking, or banning.** The app advises; the human acts. The only write is accepting the ready check.
  ```
  with:
  ```md
  - **No automated gameplay decisions.** No auto-pick, auto-ban, or auto-dodge — ever. The app advises; the human decides. The automated *writes* are limited to: accepting the ready check, applying a lockin-owned rune page, setting summoner spells, and (on explicit click) creating a lobby + starting matchmaking. All are opt-in and off by default except none are looped or chained.
  ```

- [ ] **Step 4: Add an external-data-source compliance bullet** after the Vanguard bullet. Replace:
  ```md
  - **Branding.** Ship as unofficial; no Riot trademarks in the app identity (see §11).
  ```
  with:
  ```md
  - **External data source (v1.1).** Recommendations come from **OP.GG MCP** (one keyless external read, main process only) behind a swappable `BuildProvider`. There is still **no first-party backend, login, or telemetry**. DDragon remains the icon/catalog source. OP.GG availability/format is a third-party dependency risk, mitigated by the swappable interface + disk cache; on failure the build silently degrades to none.
  - **Branding.** Ship as unofficial; no Riot trademarks in the app identity (see §11).
  ```

- [ ] **Step 5: Verify §14.**
  - `Read /Users/felipe/lockin/PRD.md` offset 469 limit 16 — confirm the expanded automation bullet, the decisions bullet, the new external-data bullet, and the branding bullet are all present.

- [ ] **Step 6: Commit.**
  ```sh
  git add /Users/felipe/lockin/PRD.md && git commit -m "docs(prd): document expanded automated writes and OP.GG source in §14"
  ```

---

### Task 6.6 — CLAUDE.md: record the scope change for future Claude sessions

**Files:**
- Modify `/Users/felipe/lockin/CLAUDE.md` (Project intro line 7; Architecture state-ownership block lines 43–48; Compliance constraints lines 62–66)

- [ ] **Step 1: Update the Project one-liner** to mention OP.GG recommendations and the In-Game view. Replace (line 7):
  ```md
  **lockin** — an unofficial Electron companion for the League of Legends client. It reads the local League Client (LCU) API and surfaces matchup-aware help during champion select: spell recommendations, personal matchup notes, ban suggestions, ready-check auto-accept, and team rank diffs. No backend, no login — all user data is local; static data comes from Riot's Data Dragon CDN.
  ```
  with:
  ```md
  **lockin** — an unofficial Electron companion for the League of Legends client. It reads the local League Client (LCU) API and surfaces matchup-aware help during champion select: spell recommendations, personal matchup notes, ban suggestions, ready-check auto-accept, and team rank diffs. It also (v1.1) shows OP.GG-sourced runes/items/skill-order recommendations, an **In-Game** screen, a "Your mains" section, a sidebar identity, and a rich native tray. No first-party backend, no login — all user data is local; static data comes from Riot's Data Dragon CDN, and per-champ/per-role recommendations come from OP.GG MCP (one external read, main process only).
  ```

- [ ] **Step 2: Add a state-ownership note for the new live channels and the build query.** Replace the `LcuProvider` bullet:
  ```md
  - **`LcuProvider`** (plain React context, `src/renderer/src/providers/lcu-provider.tsx`) holds the live LCU push state (`lcu:status`, `lcu:phase`, `lcu:readyCheck`, `lcu:champSelect`) — it subscribes once and exposes two churn-split contexts; never poll for these, and don't add Zustand unless re-render pressure demands it.
  ```
  with:
  ```md
  - **`LcuProvider`** (plain React context, `src/renderer/src/providers/lcu-provider.tsx`) holds the live LCU push state (`lcu:status`, `lcu:phase`, `lcu:readyCheck`, `lcu:champSelect`, plus v1.1 `lcu:summoner` and `lcu:inGame`) — it subscribes once and exposes two churn-split contexts (summoner in the status-ish context, `inGame` in the live context); never poll for these, and don't add Zustand unless re-render pressure demands it.
  - **OP.GG recommendations** are a TanStack Query (`build:get` → `useBuild(championKey, position)`, `staleTime: Infinity`), fetched and disk-cached only in the **main process** (`src/main/build/`) behind a swappable `BuildProvider`; the renderer never talks to OP.GG directly. Failure returns `null` and the UI hides the build — never crashes.
  ```

- [ ] **Step 3: Rewrite the Compliance constraints block** to reflect the expanded, opt-in writes. Replace the whole block (lines 62–66):
  ```md
  ## Compliance constraints (PRD §14)

  - Touch the **LCU (client) API only** — never the game process or game memory.
  - The only automated write is accepting the ready check, **off by default**. No auto-pick/ban/dodge.
  - Ship as unofficial: no Riot logos, wordmarks, or "League of Legends" in the app identity.
  ```
  with:
  ```md
  ## Compliance constraints (PRD §14)

  - Touch the **LCU (client) API only** — never the game process or game memory.
  - **Automated writes are limited and opt-in.** Accept ready check (off by default); apply rune pages + summoner spells during champ select (`autoRunes`/`autoSpells`, both off by default); create lobby + start matchmaking from the tray (explicit click only). **No auto-pick / auto-ban / auto-dodge, ever.** Rune apply only ever touches a **lockin-owned** page — never the user's pages. Queue-start is **never** looped or chained with auto-accept.
  - **Recommendations come from OP.GG MCP** — one keyless external read, main process only, behind a swappable `BuildProvider`, disk-cached. Still no first-party backend, login, or telemetry. DDragon stays the icon/catalog source.
  - Ship as unofficial: no Riot logos, wordmarks, or "League of Legends" in the app identity.
  ```

- [ ] **Step 4: Verify CLAUDE.md reads cleanly.**
  - `Read /Users/felipe/lockin/CLAUDE.md` offset 1 limit 70 — confirm the Project line, the two state-ownership bullets, and the rewritten Compliance block are present and well-formed.

- [ ] **Step 5: Commit.**
  ```sh
  git add /Users/felipe/lockin/CLAUDE.md && git commit -m "docs(claude): record OP.GG source, opt-in auto-apply, in-game, and tray scope"
  ```

---

### Task 6.7 — Full-app verification checklist (static checks)

**Files:** none (verification only — no commit unless a fix is needed).

This task runs the three static gates. Each must pass with zero errors before moving to the live UI pass. Run from the repo root `/Users/felipe/lockin`.

- [ ] **Step 1: Typecheck.** Run `pnpm typecheck`. Expect exit 0 and no `error TS…` lines. The shared-type additions (`Role`, `RunePageRec`, `ItemGroup`, `BuildRecommendation`, `SummonerIdentity`, `InGameState`, `AppSettings` gains, `LcuSnapshot`/`DDragonBundle` gains) and every consumer (preload, ipc, hooks, components, fake layer) must compile clean. If it fails, fix the offending source (this is a Phase 1–5 regression, not a doc issue), then re-run until green.

- [ ] **Step 2: Format/lint.** Run `pnpm format` (`biome check --write --unsafe .`). Expect it to report `Checked N files` with no remaining errors (it auto-fixes formatting + import order). Re-run once to confirm a clean second pass (no further changes). If Biome flags real lint errors it can't auto-fix, fix them in source and re-run.

- [ ] **Step 3: Tests.** Run `pnpm test` (`vitest run --passWithNoTests`). Expect all suites green, including the OP.GG parser/normalizer suites (`src/main/build/opgg-parse.test.ts`, `src/main/build/opgg.test.ts`), the cache suite (`src/main/build/cache.test.ts`), the lcu-mappers suite, the store-defaults suite, and the ddragon-urls suite. Zero failing, zero unhandled rejections. If any fail, treat as a Phase 1–5 regression: fix the source and re-run until all pass.

- [ ] **Step 4: Confirm the static gate.** All three commands exited 0. Do **not** claim completion until you have seen the passing output for each (per `verification-before-completion`). No commit — these commands change nothing tracked except auto-formatting, which, if it produced diffs, should already have been committed within the relevant Phase 1–5 task. If `pnpm format` produced uncommitted diffs here, commit them: `git add -A && git commit -m "chore: apply biome formatting"`.

---

### Task 6.8 — Full-app verification checklist (live UI pass via force-fake + state switcher)

**Files:** none (verification only). Produces screenshots as evidence; no commit.

Drive every new state through the on-screen dev state switcher in **force-fake mode** and screenshot each. This exercises the fake layer (`bridge.ts`/`fixtures.ts`/`scenario.ts`) end-to-end, so it verifies the renderer without a running League client.

- [ ] **Step 1: Start the app in dev.** Run `pnpm dev` (background, via the `run_in_background` option). Wait until electron-vite prints the renderer dev-server URL and the Electron window opens. Note the renderer URL (typically `http://localhost:5173`).

- [ ] **Step 2: Attach Playwright and enter force-fake mode.** Use the Playwright MCP: `browser_navigate` to the renderer dev URL, then in `browser_evaluate` run `() => { localStorage.setItem("lockin:forceFake", "1"); location.reload() }`. After reload, `browser_snapshot` and confirm the dev **state switcher** is visible (per the `lockin-dev-verification-setup` memory note: cdp.mjs harness, force-fake mode; watch the zombie-9223 + biome-unsafe-deps pitfalls).

- [ ] **Step 3: Verify sidebar identity (connected).** In the state switcher, set the Client phase Seg to any **connected** state (e.g. "Idle"). `browser_snapshot`, confirm the sidebar footer shows the fixture nickname `gameName#tagLine` + the profile-icon avatar above the "Client Connected / LCU · 127.0.0.1" lines. `browser_take_screenshot` → `verify-sidebar-identity.png`. Then switch to **Disconnected** and confirm the identity clears (shows "Client Not Detected"); screenshot → `verify-sidebar-disconnected.png`.

- [ ] **Step 4: Verify the In-Game screen.** In the state switcher, set the Client phase Seg to **"In game"** (the v1.1 option mapped to `InProgress`). `browser_snapshot` and confirm: champion header + spells from the in-game fixture, the matchup Note, the item Build strips (Starting → Boots → Core → Situational), and the color-coded skill-order grid with the `Q › E › W` priority line and win% · games label; the right rail shows the team list + a read-only runes reference. `browser_take_screenshot` (full page) → `verify-in-game.png`.

- [ ] **Step 5: Verify champ-select "Your mains."** Set the phase to **Champ Select**. Confirm the "Your mains" section renders under the note, grouped by role, with portraits from the fixture mains. `browser_take_screenshot` → `verify-champ-select-mains.png`. Then, in Settings → "Your mains", confirm the add/remove + role-tag controls render (navigate via the sidebar or `browser_click` Settings); screenshot → `verify-settings-mains.png`.

- [ ] **Step 6: Verify the recommendation panel + auto-apply toggles.** Still in **Champ Select**, confirm the recommendation panel near the header strip shows OP.GG runes (compact keystone cluster), recommended spells, and the win% · sample label (from `FIXTURE_BUILD` for Aatrox top). In the state switcher, toggle **autoRunes** and **autoSpells** on; confirm the panel reflects the toggled settings (and, in fake mode, the apply no-ops return ok with the transient "applied" status). `browser_take_screenshot` → `verify-recommendation-panel.png`. Then use the state switcher's **build availability** toggle to set the build to *unavailable* and confirm the panel content hides gracefully (note + team still render, no crash); screenshot → `verify-build-unavailable.png`.

- [ ] **Step 7: Verify the tray (manual, real-process).** The tray is main-process native UI and cannot be driven by Playwright. With `pnpm dev` running, open the macOS menu-bar tray icon and visually confirm: the status header (in fake mode it reflects the fake summoner if wired, else "Client not detected"), the Auto-accept checkbox toggling `settings.autoAccept`, Start ranked / Start flex items, New note…, Open lockin, and Quit. Capture the open tray menu with a system screenshot: `Bash` → `screencapture -x /tmp/verify-tray.png` (take it while the menu is open). Confirm New note… focuses the window on the note-creation screen (`nav:go` → `/notes?new`). Note in the checklist that queue-start must be tested against a real client later (it cannot create a real lobby in fake mode); confirm only that the menu items exist and are disabled/no-op when disconnected.

- [ ] **Step 8: Surface the screenshots and stop dev.** Send the captured screenshots to the user as evidence (`verify-sidebar-identity.png`, `verify-in-game.png`, `verify-champ-select-mains.png`, `verify-recommendation-panel.png`, `verify-tray.png`, plus the disconnected/unavailable/settings shots). Then `browser_close` the Playwright session and stop the background `pnpm dev` process.

- [ ] **Step 9: Final completion statement.** Only after all of `pnpm typecheck`, `pnpm format`, `pnpm test` passed (Task 6.7) **and** every new state was visually confirmed via screenshots (Steps 3–7), state that Phase 6 is complete. Evidence (passing command output + screenshots) precedes the claim — do not assert completion otherwise. This task has no commit (doc edits were already committed in Tasks 6.1–6.6).

---

**Phase 6 commits (recap):** `docs(prd): reverse §2.2 non-goals…`, `docs(prd): rewrite §6.1…`, `docs(prd): add §6.6 in-game/mains, §6.7 tray, and v1.1 data models`, `docs(prd): add v1.1 IPC channels and the In-Game screen to §8/§11`, `docs(prd): document expanded automated writes and OP.GG source in §14`, `docs(claude): record OP.GG source, opt-in auto-apply, in-game, and tray scope`, and (only if needed) `chore: apply biome formatting`.
