# Phase 6 — Spells + Bans Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `spells.ts` and `bans.ts` pure engines (+ vitest specs), real banlist persistence, and the champ-select hook swapped onto both engines. Exit: PRD §6.1 + §6.3 boxes — engine logic fully verifiable overnight; live ban-phase behavior → morning checklist.

**Architecture:** Both engines live in `src/shared/lib/` (zero deps, types only, deterministic — design §4). `recommendSpells` returns spell **keys**; the hook resolves keys → DDragon statics and pre-validates pinned resolvability (the bundle is renderer-held; §6.1's "spell not resolvable → fail gracefully" stays at the seam). `suggestBans` takes the banlist + the full session and derives banned/picked/visible sets itself (robust to `session.bans` lagging behind completed ban actions). Banlist accessors mirror the fake's contract (priority renumbered 1..n on set).

**Deferred (explicit):** §6.1's parenthetical archetype fallbacks (middle→Ignite for assassins, utility→Exhaust) and the `ChampionStatic.tags` input the spec reserves for them are **deliberately out of scope** — the v1 engine emits role primaries only (identical to the Phase-1 glue; no §6.1 acceptance box needs tags). Also: enemy-hover threat lift (`championPickIntent`) is spec-aligned per §6.3 "hover/pick" but the real LCU hides enemy intent, so that branch is exercised only by fixtures/tests — the morning checklist verifies pick-based threat lift only.

**Layout finding (consumer-verified):** `SpellPair` renders `pair[0]` first and maps D/F key hints from the `layout` prop itself (`"DF"` → first icon labeled D; `"FD"` → first labeled F). Under **both** layouts `pair[0]` is the user's flash-key slot, so the engine always puts Flash at `pair[0]` and takes **no layout input** — §6.1's "placement respects the D/F setting" is satisfied at render. `HeaderStrip` shows "Your pick" off `source === "pinned"`; the VM's `source` union widens from `"pinned" | "default"` to `"pinned" | "heuristic"` (only the `"pinned"` literal is consumed).

---

### Task 1: `spells.ts` engine (TDD)

**Files:**
- Create: `src/shared/lib/spells.test.ts`
- Create: `src/shared/lib/spells.ts`

- [ ] **Step 1: Write the failing spec**

```ts
import { describe, expect, it } from "vitest"

import { FLASH, recommendSpells } from "./spells"

describe("recommendSpells (PRD §6.1)", () => {
	it.each([
		["jungle", 11], // Smite
		["top", 12], // Teleport
		["middle", 12], // Teleport
		["bottom", 7], // Heal
		["utility", 14], // Ignite
	])("role %s → Flash + spell %i", (role, second) => {
		expect(recommendSpells({ assignedPosition: role })).toEqual({
			pair: [FLASH, second],
			source: "heuristic",
			rolePending: false,
		})
	})

	it("empty/unknown role → Ignite + rolePending", () => {
		expect(recommendSpells({ assignedPosition: "" })).toEqual({
			pair: [FLASH, 14],
			source: "heuristic",
			rolePending: true,
		})
		expect(recommendSpells({ assignedPosition: "weird-future-role" })).toEqual({
			pair: [FLASH, 14],
			source: "heuristic",
			rolePending: true,
		})
	})

	it("pinned spells win verbatim and are labeled pinned", () => {
		expect(recommendSpells({ assignedPosition: "top", pinnedSpells: [6, 4] })).toEqual({
			pair: [6, 4],
			source: "pinned",
			rolePending: false,
		})
	})

	it("pinned wins even while the role is pending", () => {
		expect(recommendSpells({ assignedPosition: "", pinnedSpells: [4, 14] })).toEqual({
			pair: [4, 14],
			source: "pinned",
			rolePending: true,
		})
	})
})
```

- [ ] **Step 2: Run, watch it fail**

Run: `pnpm test`
Expected: FAIL — `spells.ts` does not exist.

- [ ] **Step 3: Implement**

```ts
/**
 * Summoner-spell recommendation (PRD §6.1): deterministic heuristic + user
 * override. Returns spell KEYS; the caller resolves them against DDragon and
 * pre-validates pinned pairs (unresolvable pin → call again without it).
 *
 * pair[0] is the user's flash-key slot under BOTH D/F layouts (SpellPair maps
 * key hints from the layout setting), so Flash always leads and the engine
 * needs no layout input.
 */

export const FLASH = 4

// §6.1's archetype-aware secondary fallbacks (mid assassins→Ignite, support→Exhaust)
// are deliberately out of scope for the deterministic v1 table — role primaries only.
const SECOND_BY_ROLE: Record<string, number> = {
	jungle: 11, // Smite
	top: 12, // Teleport
	middle: 12, // Teleport
	bottom: 7, // Heal
	utility: 14, // Ignite
}

const IGNITE = 14 // unknown/empty role fallback

export interface SpellRecommendation {
	pair: [number, number]
	source: "heuristic" | "pinned"
	rolePending: boolean
}

export function recommendSpells(input: {
	assignedPosition: string
	pinnedSpells?: [number, number]
}): SpellRecommendation {
	const second = SECOND_BY_ROLE[input.assignedPosition]
	const rolePending = second === undefined
	if (input.pinnedSpells) {
		return { pair: input.pinnedSpells, source: "pinned", rolePending }
	}
	return { pair: [FLASH, second ?? IGNITE], source: "heuristic", rolePending }
}
```

- [ ] **Step 4: Run, watch it pass**

Run: `pnpm test`
Expected: spells specs passing (plus the 8 notes-match specs).

- [ ] **Step 5: Typecheck + format, commit**

```bash
pnpm typecheck && pnpm format
git add src/shared/lib/spells.ts src/shared/lib/spells.test.ts
git commit -m "feat(shared): spells engine + vitest spec (§6.1)"
```

---

### Task 2: `bans.ts` engine (TDD)

**Files:**
- Create: `src/shared/lib/bans.test.ts`
- Create: `src/shared/lib/bans.ts`

- [ ] **Step 1: Write the failing spec**

```ts
import { describe, expect, it } from "vitest"

import type { BanListEntry, ChampSelectSession } from "@/shared/types"

import { suggestBans } from "./bans"

const entry = (championId: number, priority: number, reason?: string): BanListEntry => ({
	championId,
	priority,
	reason,
})

const session = (over?: Partial<ChampSelectSession>): ChampSelectSession => ({
	actions: [],
	bans: { myTeamBans: [], theirTeamBans: [], numBans: 10 },
	localPlayerCellId: 0,
	myTeam: [],
	theirTeam: [],
	timer: { adjustedTimeLeftInPhase: 0, totalTimeInPhase: 0, phase: "BAN_PICK", isInfinite: false },
	...over,
})

const player = (championId: number, over?: Record<string, unknown>) => ({
	cellId: 5,
	championId,
	championPickIntent: 0,
	assignedPosition: "",
	summonerId: 0,
	puuid: "",
	spell1Id: 0,
	spell2Id: 0,
	team: 2,
	...over,
})

describe("suggestBans (PRD §6.3)", () => {
	it("orders by priority and keeps available champs open", () => {
		const out = suggestBans([entry(122, 2), entry(114, 1)], session())
		expect(out.entries.map((e) => e.entry.championId)).toEqual([114, 122])
		expect(out.entries.every((e) => e.status === "open" && !e.threat)).toBe(true)
		expect(out.allGone).toBe(false)
	})

	it("marks champs banned by either team", () => {
		const s = session({ bans: { myTeamBans: [114], theirTeamBans: [122], numBans: 10 } })
		const out = suggestBans([entry(114, 1), entry(122, 2), entry(164, 3)], s)
		expect(out.entries.map((e) => e.status)).toEqual(["banned", "banned", "open"])
	})

	it("treats completed ban actions as banned even before session.bans catches up", () => {
		const s = session({
			actions: [
				[
					{
						actorCellId: 5,
						championId: 114,
						completed: true,
						id: 1,
						isAllyAction: false,
						isInProgress: false,
						pickTurn: 1,
						type: "ban",
					},
				],
			],
		})
		expect(suggestBans([entry(114, 1)], s).entries[0]?.status).toBe("banned")
	})

	it("marks picked champs from both teams", () => {
		const s = session({
			myTeam: [player(157, { team: 1 })],
			theirTeam: [player(114)],
		})
		const out = suggestBans([entry(114, 1), entry(157, 2)], s)
		expect(out.entries.map((e) => e.status)).toEqual(["picked", "picked"])
	})

	it("lifts visible enemy threats (pick or hover) to the top with a badge", () => {
		const s = session({ theirTeam: [player(133), player(0, { championPickIntent: 157 })] })
		const out = suggestBans([entry(114, 1), entry(157, 2), entry(133, 3)], s)
		expect(out.entries.map((e) => e.entry.championId)).toEqual([157, 133, 114])
		expect(out.entries.map((e) => e.threat)).toEqual([true, true, false])
	})

	it("threat lift is stable within groups (priority preserved)", () => {
		const s = session({ theirTeam: [player(133), player(157)] })
		const out = suggestBans([entry(157, 1), entry(114, 2), entry(133, 3)], s)
		expect(out.entries.map((e) => e.entry.championId)).toEqual([157, 133, 114])
	})

	it("allGone only when a non-empty list is fully banned/picked", () => {
		const s = session({ bans: { myTeamBans: [114, 122], theirTeamBans: [], numBans: 10 } })
		expect(suggestBans([entry(114, 1), entry(122, 2)], s).allGone).toBe(true)
		expect(suggestBans([], s).allGone).toBe(false) // empty list → build-one prompt, not allGone
	})

	it("a banned threat stays marked banned, not open", () => {
		const s = session({
			bans: { myTeamBans: [114], theirTeamBans: [], numBans: 10 },
			theirTeam: [player(114)],
		})
		const out = suggestBans([entry(114, 1)], s)
		expect(out.entries[0]?.status).toBe("banned")
		expect(out.entries[0]?.threat).toBe(true)
	})
})
```

- [ ] **Step 2: Run, watch it fail**

Run: `pnpm test`
Expected: FAIL — `bans.ts` does not exist.

- [ ] **Step 3: Implement**

```ts
import type { BanListEntry, ChampSelectSession } from "@/shared/types"

/**
 * Session-aware ban suggestions (PRD §6.3): the personal ban list ordered by
 * priority, statuses derived from the live session (banned by either team —
 * including completed ban actions, which can lead session.bans — or already
 * picked), and visible enemy threats (pick or hover intent) lifted to the top.
 * Pure + deterministic (design §4).
 */

export interface BanSuggestionRow {
	entry: BanListEntry
	status: "open" | "banned" | "picked"
	threat: boolean
}

export interface BanSuggestions {
	entries: BanSuggestionRow[]
	allGone: boolean
}

export function suggestBans(
	banlist: readonly BanListEntry[],
	session: ChampSelectSession,
): BanSuggestions {
	const bannedIds = new Set([...session.bans.myTeamBans, ...session.bans.theirTeamBans])
	for (const action of session.actions.flat()) {
		if (action.type === "ban" && action.completed && action.championId > 0) {
			bannedIds.add(action.championId)
		}
	}
	const pickedIds = new Set(
		[...session.myTeam, ...session.theirTeam].map((p) => p.championId).filter((id) => id > 0),
	)
	const visibleEnemyIds = new Set(
		session.theirTeam.flatMap((p) =>
			[p.championId, p.championPickIntent].filter((id) => id > 0),
		),
	)

	const entries: BanSuggestionRow[] = [...banlist]
		.sort((a, b) => a.priority - b.priority)
		.map((entry) => ({
			entry,
			status: bannedIds.has(entry.championId)
				? ("banned" as const)
				: pickedIds.has(entry.championId)
					? ("picked" as const)
					: ("open" as const),
			threat: visibleEnemyIds.has(entry.championId),
		}))
		.sort((a, b) => Number(b.threat) - Number(a.threat)) // stable: priority kept within groups

	return {
		entries,
		allGone: entries.length > 0 && entries.every((e) => e.status !== "open"),
	}
}
```

- [ ] **Step 4: Run, watch it pass**

Run: `pnpm test`
Expected: all specs passing (notes-match 8 + spells + bans).

- [ ] **Step 5: Typecheck + format, commit**

```bash
pnpm typecheck && pnpm format
git add src/shared/lib/bans.ts src/shared/lib/bans.test.ts
git commit -m "feat(shared): bans engine + vitest spec (§6.3)"
```

---

### Task 3: Banlist persistence

**Files:**
- Modify: `src/main/store.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Store accessors (append to `src/main/store.ts`)**

```ts
export function getBanList(): BanListEntry[] {
	// order is guaranteed by renumber-on-set below — exactly mirrors the fake (no sort)
	return store.get("banlist").map((e) => ({ ...e }))
}

export function setBanList(entries: BanListEntry[]): BanListEntry[] {
	// renumber 1..n in given order — matches the fake bridge's contract
	const next = entries.map((e, i) => ({ ...e, priority: i + 1 }))
	store.set("banlist", next)
	return next
}
```

- [ ] **Step 2: IPC handlers (append to `src/main/ipc.ts`)**

Extend the store import with `getBanList, setBanList` and the types import with `BanListEntry`, then:

```ts
ipcMain.handle(IPC.BANLIST_GET, () => getBanList())
ipcMain.handle(IPC.BANLIST_SET, (_event, entries: BanListEntry[]) => setBanList(entries))
```

- [ ] **Step 3: Bridge channels (add to the `api` object in `src/preload/index.ts`)**

```ts
	getBanList: () => ipcRenderer.invoke(IPC.BANLIST_GET),
	setBanList: (entries) => ipcRenderer.invoke(IPC.BANLIST_SET, entries),
```

- [ ] **Step 4: Typecheck + format, commit**

```bash
pnpm typecheck && pnpm format
git add src/main/store.ts src/main/ipc.ts src/preload/index.ts
git commit -m "feat: real banlist persistence over IPC"
```

---

### Task 4: Hook swaps onto both engines

**Files:**
- Modify: `src/renderer/src/hooks/use-champ-select.ts`

- [ ] **Step 1: Imports + SpellRec type**

Add imports (biome will sort):

```ts
import { suggestBans } from "@/shared/lib/bans"
import { recommendSpells } from "@/shared/lib/spells"
```

Change the `SpellRec` interface's source union:

```ts
export interface SpellRec {
	pair: [SummonerSpellStatic, SummonerSpellStatic] | null
	source: "pinned" | "heuristic"
	rolePending: boolean
}
```

- [ ] **Step 2: Replace the spells glue**

Delete the module-level `DEFAULT_SECOND_SPELL` and `FLASH` constants (engine owns them now) and replace the spells block:

```ts
		// PHASE-1 GLUE — replaced by src/shared/lib/spells.ts in Phase 6
		const pinned = note?.pinnedSpells
		const pinnedValid = !!(pinned && spell(pinned[0]) && spell(pinned[1]))
		const pairIds: [number, number] = pinnedValid
			? pinned
			: [FLASH, DEFAULT_SECOND_SPELL[me.assignedPosition] ?? 14]
		const s0 = spell(pairIds[0])
		const s1 = spell(pairIds[1])
		const spells: SpellRec = {
			pair: s0 && s1 ? [s0, s1] : null,
			source: pinnedValid ? "pinned" : "default",
			rolePending,
		}
```

with:

```ts
		// pinned pre-validated against DDragon (§6.1: unresolvable pin → heuristic)
		const pinned = note?.pinnedSpells
		const pinnedValid = !!(pinned && spell(pinned[0]) && spell(pinned[1]))
		const rec = recommendSpells({
			assignedPosition: me.assignedPosition,
			pinnedSpells: pinnedValid ? pinned : undefined,
		})
		const s0 = spell(rec.pair[0])
		const s1 = spell(rec.pair[1])
		const spells: SpellRec = {
			pair: s0 && s1 ? [s0, s1] : null,
			source: rec.source,
			rolePending: rec.rolePending,
		}
```

- [ ] **Step 3: Replace the bans glue**

Replace:

```ts
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
```

with:

```ts
		const rows: BanRowVM[] = suggestBans(banlist ?? [], session).entries.map((row) => ({
			championId: row.entry.championId,
			champion: champ(row.entry.championId),
			reason: row.entry.reason,
			status: row.status,
			threat: row.threat,
		}))
```

(If the `BanListEntry` type import in this file becomes unused, drop it — `pnpm format`/typecheck will flag it.)

- [ ] **Step 4: Verify rolePending stays consistent**

The VM's `me.rolePending` comes from `displayRole()`; the engine derives its own from the role table. Both treat `""`/unknown as pending — no change needed, but confirm `pnpm typecheck` is clean and the `rolePending` const formerly used by the glue is still needed for `me` (it is — keep it).

- [ ] **Step 5: Typecheck + format + test, commit**

```bash
pnpm typecheck && pnpm format && pnpm test
git add src/renderer/src/hooks/use-champ-select.ts
git commit -m "feat(renderer): champ-select spells + bans via the pure engines"
```

---

### Task 5: Live smoke — banlist round-trip

**Files:** none (verification only)

- [ ] **Step 1: Boot**

Run (background): `ELECTRON_ENABLE_LOGGING=1 pnpm dev > /tmp/lockin-phase6-smoke.log 2>&1`, wait for `[lcu] status: connected`.

- [ ] **Step 2: Banlist CRUD via CDP**

Precondition (cache semantics): run this **on a fresh boot, before any settings-page visit** — `useBanList` has `staleTime: Infinity`, and the direct `window.api.setBanList` below bypasses the mutation's invalidation, so Step 3's screenshot relies on settings mounting the query for the first time *after* the set.

First, **snapshot the pre-existing list** — never assume it is empty and never destroy real data:

```bash
node scripts/cdp.mjs eval 'window.api.getBanList()' | tee /tmp/lockin-banlist-before.json
```
Expected: whatever the real store holds (likely `[]` on this install).

```bash
node scripts/cdp.mjs eval 'window.api.setBanList([{ championId: 114, priority: 9, reason: "smoke" }, { championId: 122, priority: 1 }])'
```
Expected: priorities renumbered `1, 2` in given order (114 first).

```bash
node scripts/cdp.mjs eval 'window.api.getBanList()'
python3 -c "import json; print(json.load(open('$HOME/Library/Application Support/lockin/config.json'))['banlist'])"
```
Expected: both show the renumbered list.

- [ ] **Step 3: Settings screen visual**

The settings page + ban editor now run fully real. Screenshot it — navigate by CDP click on the sidebar (the Settings nav button), or if flaky, verify the ban editor data through Step 2's round-trip alone:

```bash
node scripts/cdp.mjs eval 'document.querySelector("aside nav button:nth-of-type(3)")?.click() ?? "no-button"'
node scripts/cdp.mjs shot /tmp/lockin-phase6-settings.png
```
Read the PNG — Match group (auto-accept toggle off + delay), Champ-select group (D/F, threshold), ban editor showing Fiora (smoke) + Darius rows with real icons.

- [ ] **Step 4: Cleanup — MANDATORY, restore the snapshot**

Restore exactly what Step 2 captured (substitute the snapshot contents):

```bash
node scripts/cdp.mjs eval "window.api.setBanList($(cat /tmp/lockin-banlist-before.json)).then(() => window.api.getBanList())"
```
Expected: identical to the Step-2 snapshot — Felipe's store left as found. (Settings keys untouched throughout this smoke.)

- [ ] **Step 5: Kill, record evidence**

Stop the app, no orphans, excerpts → morning notes. Live ban-phase §6.3 boxes (threat lift during a real ban phase, live updates as bans land) → morning checklist.
