# Phase 5 — Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real notes CRUD (electron-store + IPC), the `notes-match.ts` pure engine replacing the renderer glue, and vitest entering the repo (D4: engines only). Exit: PRD §6.2 boxes — fully verifiable overnight via CDP.

**Architecture:** `store.ts` grows typed notes accessors (uuid + timestamps assigned in main — single writer). Three IPC handlers + three preload keys make the library/editor screens real with zero component changes (they already consume `useNotes`/`useUpsertNote`/`useDeleteNote`). The matching logic moves to `src/shared/lib/notes-match.ts` — zero deps, deterministic, vitest-covered — and `useChampSelect()` swaps its `PHASE-1 GLUE` block for the engine. Notes search stays renderer-side (D9, already built).

**Testing:** vitest enters as devDependency with `pnpm test` script and a minimal `vitest.config.ts` (tsconfig paths only; no jsdom — pure logic). TDD for the engine: spec first, watch it fail, implement, watch it pass.

**Behavioral note:** Felipe's real store starts with **zero notes** — the library renders its Phase-1 empty state, and the fake's six fixture notes disappear from the merged app (force-fake still previews them). Correct integration, not a regression.

---

### Task 1: Vitest enters

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest**

Run: `pnpm add -D vitest`
Expected: vitest added to devDependencies (latest stable, ~3.x).

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import tsconfigPaths from "vite-tsconfig-paths"
import { defineConfig } from "vitest/config"

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		include: ["src/shared/lib/**/*.test.ts"], // pure engines only (design D4)
	},
})
```

- [ ] **Step 3: Add the script**

In `package.json` scripts, after `"typecheck"`:

```json
		"test": "vitest run",
```

- [ ] **Step 4: Sanity run**

Run: `pnpm test`
Expected: "No test files found" (exits non-zero or warns — fine; the engine spec lands next task). If vitest errors on config, fix before committing.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: vitest enters — pnpm test runs pure-engine specs (D4)"
```

---

### Task 2: `notes-match.ts` engine (TDD)

**Files:**
- Create: `src/shared/lib/notes-match.test.ts`
- Create: `src/shared/lib/notes-match.ts`

- [ ] **Step 1: Write the failing spec**

```ts
import { describe, expect, it } from "vitest"

import type { MatchupNote } from "@/shared/types"

import { matchNotes } from "./notes-match"

const note = (over: Partial<MatchupNote>): MatchupNote => ({
	id: "n-test",
	championId: 266,
	opponentChampionId: null,
	body: "",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	...over,
})

describe("matchNotes (PRD §6.2)", () => {
	it("returns general notes for my champion", () => {
		const general = note({ id: "a" })
		expect(matchNotes([general], 266, [])).toEqual([general])
	})

	it("excludes notes for other champions", () => {
		expect(matchNotes([note({ championId: 122 })], 266, [122])).toEqual([])
	})

	it("includes opponent-specific notes only when that enemy is visible", () => {
		const vsFiora = note({ id: "b", opponentChampionId: 114 })
		expect(matchNotes([vsFiora], 266, [114, 157])).toEqual([vsFiora])
		expect(matchNotes([vsFiora], 266, [157])).toEqual([])
		expect(matchNotes([vsFiora], 266, [])).toEqual([]) // enemy hidden → general only
	})

	it("sorts multiple matches most-recently-updated first", () => {
		const older = note({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" })
		const newer = note({ id: "new", updatedAt: "2026-02-01T00:00:00.000Z" })
		expect(matchNotes([older, newer], 266, [])).toEqual([newer, older])
	})

	it("returns nothing while my champion is unknown (id 0)", () => {
		expect(matchNotes([note({})], 0, [114])).toEqual([])
	})

	it("does not mutate the input array", () => {
		const notes = [
			note({ id: "1", updatedAt: "2026-02-01T00:00:00.000Z" }),
			note({ id: "2", updatedAt: "2026-03-01T00:00:00.000Z" }),
		]
		matchNotes(notes, 266, [])
		expect(notes.map((n) => n.id)).toEqual(["1", "2"])
	})
})
```

- [ ] **Step 2: Run, watch it fail**

Run: `pnpm test`
Expected: FAIL — `notes-match.ts` does not exist.

- [ ] **Step 3: Implement the engine**

```ts
import type { MatchupNote } from "@/shared/types"

/**
 * Matchup-note surfacing (PRD §6.2): notes for the champion I am playing,
 * where general notes (no opponent) always match and opponent-specific notes
 * match only while that enemy champion is visible. Most-recently-updated first.
 * Pure + deterministic (design §4).
 */
export function matchNotes(
	notes: readonly MatchupNote[],
	myChampionId: number,
	enemyChampionIds: readonly number[],
): MatchupNote[] {
	if (myChampionId <= 0) return []
	return notes
		.filter(
			(n) =>
				n.championId === myChampionId &&
				(n.opponentChampionId == null || enemyChampionIds.includes(n.opponentChampionId)),
		)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
```

- [ ] **Step 4: Run, watch it pass**

Run: `pnpm test`
Expected: 6 passing.

- [ ] **Step 5: Typecheck + format, commit**

```bash
pnpm typecheck && pnpm format
git add src/shared/lib/notes-match.ts src/shared/lib/notes-match.test.ts
git commit -m "feat(shared): notes-match engine + vitest spec (§6.2)"
```

---

### Task 3: Notes CRUD in the store

**Files:**
- Modify: `src/main/store.ts`

- [ ] **Step 1: Append accessors to `src/main/store.ts`**

```ts
export function listNotes(): MatchupNote[] {
	return store.get("notes")
}

export function upsertNote(partial: Partial<MatchupNote>): MatchupNote {
	const notes = listNotes()
	const now = new Date().toISOString()
	if (partial.id) {
		const existing = notes.find((n) => n.id === partial.id)
		if (!existing) throw new Error(`note not found: ${partial.id}`)
		const updated: MatchupNote = { ...existing, ...partial, id: existing.id, updatedAt: now }
		store.set(
			"notes",
			notes.map((n) => (n.id === updated.id ? updated : n)),
		)
		return updated
	}
	const created: MatchupNote = {
		id: crypto.randomUUID(),
		championId: partial.championId ?? 0,
		opponentChampionId: partial.opponentChampionId ?? null,
		body: partial.body ?? "",
		pinnedSpells: partial.pinnedSpells,
		createdAt: now,
		updatedAt: now,
	}
	store.set("notes", [created, ...notes])
	return created
}

export function deleteNote(id: string): void {
	store.set(
		"notes",
		listNotes().filter((n) => n.id !== id),
	)
}
```

- [ ] **Step 2: Typecheck + format, commit**

```bash
pnpm typecheck && pnpm format
git add src/main/store.ts
git commit -m "feat(main): notes CRUD accessors in the typed store"
```

---

### Task 4: Notes over IPC

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Handlers in `src/main/ipc.ts`**

Update the store import to `import { deleteNote, getSettings, listNotes, setSettings, upsertNote } from "./store"`, add the type import `MatchupNote` next to `AppSettings`, and append:

```ts
ipcMain.handle(IPC.NOTES_LIST, () => listNotes())
ipcMain.handle(IPC.NOTES_UPSERT, (_event, note: Partial<MatchupNote>) => upsertNote(note))
ipcMain.handle(IPC.NOTES_DELETE, (_event, id: string) => deleteNote(id))
```

- [ ] **Step 2: Bridge channels in `src/preload/index.ts`**

Add to the `api` object (after `getDDragonBundle`):

```ts
	listNotes: () => ipcRenderer.invoke(IPC.NOTES_LIST),
	upsertNote: (note) => ipcRenderer.invoke(IPC.NOTES_UPSERT, note),
	deleteNote: (id) => ipcRenderer.invoke(IPC.NOTES_DELETE, id),
```

- [ ] **Step 3: Typecheck + format, commit**

```bash
pnpm typecheck && pnpm format
git add src/main/ipc.ts src/preload/index.ts
git commit -m "feat: real notes CRUD over IPC"
```

---

### Task 5: Engine replaces the renderer glue

**Files:**
- Modify: `src/renderer/src/hooks/use-champ-select.ts`

- [ ] **Step 1: Swap the glue for the engine**

Add the import:

```ts
import { matchNotes } from "@/shared/lib/notes-match"
```

Replace:

```ts
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
```

with:

```ts
		const matching = matchNotes(
			notes ?? [],
			me.championId,
			enemyVisible.map((p) => p.championId),
		)
		const note = matching[0] ?? null
```

- [ ] **Step 2: Typecheck + format + test, commit**

```bash
pnpm typecheck && pnpm format && pnpm test
git add src/renderer/src/hooks/use-champ-select.ts
git commit -m "feat(renderer): champ-select notes via notes-match engine"
```

---

### Task 6: Live smoke — real CRUD round-trip

**Files:** none (verification only)

- [ ] **Step 1: Boot**

Run (background): `ELECTRON_ENABLE_LOGGING=1 pnpm dev > /tmp/lockin-phase5-smoke.log 2>&1`, wait for `[lcu] status: connected`.

- [ ] **Step 2: Empty start + create**

```bash
node scripts/cdp.mjs eval 'window.api.listNotes()'
```
Expected: `[]` (real store, no fixture notes — see Behavioral note).

```bash
node scripts/cdp.mjs eval 'window.api.upsertNote({ championId: 266, opponentChampionId: 114, body: "smoke-test note", pinnedSpells: [4, 12] })'
```
Expected: created note with uuid `id`, ISO timestamps.

- [ ] **Step 3: Update + list + disk**

```bash
node scripts/cdp.mjs eval 'window.api.listNotes().then(ns => window.api.upsertNote({ id: ns[0].id, body: "smoke-test note v2" }))'
node scripts/cdp.mjs eval 'window.api.listNotes()'
cat ~/Library/Application\ Support/lockin/config.json
```
Expected: body updated, `updatedAt` > `createdAt`; disk shows the note under `"notes"`.

- [ ] **Step 4: Restart persistence + delete + UI evidence**

Kill, relaunch into `/tmp/lockin-phase5-smoke2.log`, wait for connect:

```bash
node scripts/cdp.mjs eval 'window.api.listNotes().then(ns => ns.length)'
```
Expected: `1`.

Screenshot the home screen (`node scripts/cdp.mjs shot /tmp/lockin-phase5-home.png`) — the recent-notes rail shows ONLY the smoke note (real store) with real DDragon icons.

Then clean up:

```bash
node scripts/cdp.mjs eval 'window.api.listNotes().then(ns => Promise.all(ns.map(n => window.api.deleteNote(n.id)))).then(() => window.api.listNotes())'
```
Expected: `[]` — leave Felipe's store empty as found.

- [ ] **Step 5: Kill, record evidence**

Stop the app, no orphans, excerpts → morning notes. §6.2's "matching notes appear within 1s of locking" → morning checklist (queue-dependent).
