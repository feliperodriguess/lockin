# Phase 4 — DDragon + Champ-Select Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Data Dragon bundle (version resolve → fetch → normalize → disk cache → offline fallback → background patch refresh) served over IPC, plus the one renderer refinement real sessions need (timer-phase-aware sub-phase derivation). After this phase a live champ select renders fully real except notes/banlist/ranks (Phases 5–7).

**Architecture:** `src/main/ddragon.ts` is **cache-first**: serve the disk cache (`userData/ddragon-cache.json`) immediately when present and, if the live patch differs, refresh the cache in the background for the *next* launch (icons are stable within a patch; staleness costs one launch — this is the PRD §10 "serve from cache when offline; refresh in the background" reading). First run awaits the network; offline + no cache → the invoke rejects, TanStack Query retries, and the UI keeps D15 fallback tiles. Bundle is memoized per app session (matches the renderer's `staleTime: Infinity`).

**Tech Stack:** main-process built-in `fetch` (PRD §3) with `AbortSignal.timeout`, `node:fs/promises` for the cache.

**Live-verified facts (probed against the real CDN tonight):**
- `GET https://ddragon.leagueoflegends.com/api/versions.json` → `["16.11.1", …]` — `[0]` is latest.
- `champion.json`/`summoner.json` shape: `{ data: { <Id>: { id, key: "266" (STRING — must `Number()`), name, title, tags, image: { full } } } }`.
- Renderer consumes via `DDragonBundle.championsByKey[number]` and builds icon URLs in `src/renderer/src/lib/ddragon-urls.ts` from `version` + `imageFull`.
- `ChampSelectScreen` null-guards the VM (`if (!vm) return null`) — a missing bundle cannot crash champ select (D15 holds).

**Testing (D4):** typecheck + format + live smoke (CDP bundle eval, cache file on disk, cache-hit relaunch log, home screenshot). Real champ-select rendering is queue-dependent → morning checklist.

---

### Task 1: `src/main/ddragon.ts`

**Files:**
- Create: `src/main/ddragon.ts`

- [ ] **Step 1: Write the module**

```ts
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { app } from "electron"

import type { ChampionStatic, DDragonBundle, SummonerSpellStatic } from "@/shared/types"

const BASE = "https://ddragon.leagueoflegends.com"
const LOCALE = "en_US" // fixed internal constant (PRD §10)
const FETCH_TIMEOUT_MS = 10_000

interface RawEntry {
	id?: string
	key?: string // DDragon serializes the numeric key as a string ("266")
	name?: string
	title?: string
	tags?: string[]
	image?: { full?: string }
}

function cachePath(): string {
	return join(app.getPath("userData"), "ddragon-cache.json")
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
	if (!response.ok) throw new Error(`GET ${url} → ${response.status}`)
	return (await response.json()) as T
}

async function resolveLatestVersion(): Promise<string> {
	const versions = await fetchJson<string[]>(`${BASE}/api/versions.json`)
	const latest = versions[0]
	if (!latest) throw new Error("ddragon versions.json came back empty")
	return latest
}

function normalizeChampions(data: Record<string, RawEntry>): Record<number, ChampionStatic> {
	const byKey: Record<number, ChampionStatic> = {}
	for (const entry of Object.values(data)) {
		const key = Number(entry.key)
		if (!Number.isFinite(key)) continue
		byKey[key] = {
			id: entry.id ?? "",
			key,
			name: entry.name ?? entry.id ?? "",
			title: entry.title ?? "",
			tags: entry.tags ?? [],
			imageFull: entry.image?.full ?? `${entry.id}.png`,
		}
	}
	return byKey
}

function normalizeSpells(data: Record<string, RawEntry>): Record<number, SummonerSpellStatic> {
	const byKey: Record<number, SummonerSpellStatic> = {}
	for (const entry of Object.values(data)) {
		const key = Number(entry.key)
		if (!Number.isFinite(key)) continue
		byKey[key] = {
			id: entry.id ?? "",
			key,
			name: entry.name ?? entry.id ?? "",
			imageFull: entry.image?.full ?? `${entry.id}.png`,
		}
	}
	return byKey
}

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

async function readCache(): Promise<DDragonBundle | null> {
	try {
		const bundle = JSON.parse(await readFile(cachePath(), "utf8")) as DDragonBundle
		return bundle.version && bundle.championsByKey && bundle.spellsByKey ? bundle : null
	} catch {
		return null // no cache / corrupt cache — treated as absent
	}
}

async function writeCache(bundle: DDragonBundle): Promise<void> {
	try {
		await writeFile(cachePath(), JSON.stringify(bundle))
	} catch (error) {
		console.warn("[ddragon] cache write failed:", error)
	}
}

async function refreshIfStale(cachedVersion: string): Promise<void> {
	try {
		const latest = await resolveLatestVersion()
		if (latest === cachedVersion) return
		console.log(`[ddragon] patch change ${cachedVersion} → ${latest}, refreshing cache`)
		await writeCache(await fetchBundle(latest))
	} catch (error) {
		console.warn("[ddragon] background refresh failed:", error) // offline is fine — cache serves
	}
}

async function loadBundle(): Promise<DDragonBundle> {
	const cached = await readCache()
	if (cached) {
		void refreshIfStale(cached.version) // background; the NEXT launch picks up a new patch
		console.log(`[ddragon] serving cached bundle ${cached.version}`)
		return cached
	}
	const version = await resolveLatestVersion()
	const bundle = await fetchBundle(version)
	await writeCache(bundle)
	console.log(`[ddragon] fetched fresh bundle ${version}`)
	return bundle
}

/* session memo — matches the renderer's staleTime: Infinity; a failed load is
   not memoized so Query retries hit the network again */
let memo: DDragonBundle | null = null
let loading: Promise<DDragonBundle> | null = null

export function getDDragonBundle(): Promise<DDragonBundle> {
	if (memo) return Promise.resolve(memo)
	if (!loading) {
		loading = loadBundle()
			.then((bundle) => {
				memo = bundle
				return bundle
			})
			.finally(() => {
				loading = null
			})
	}
	return loading
}
```

- [ ] **Step 2: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/main/ddragon.ts
git commit -m "feat(main): ddragon service — version resolve, normalize, disk cache, background patch refresh"
```

---

### Task 2: Wire the bundle over IPC

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Handler in `src/main/ipc.ts`**

Add the import and handler:

```ts
import { getDDragonBundle } from "./ddragon"
```

```ts
ipcMain.handle(IPC.DDRAGON_GET_BUNDLE, () => getDDragonBundle())
```

- [ ] **Step 2: Bridge channel in `src/preload/index.ts`**

Add to the `api` object (after `declineReadyCheck`):

```ts
	getDDragonBundle: () => ipcRenderer.invoke(IPC.DDRAGON_GET_BUNDLE),
```

- [ ] **Step 3: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts src/preload/index.ts
git commit -m "feat: real ddragon:getBundle over IPC"
```

---

### Task 3: Timer-phase-aware sub-phase derivation

**Files:**
- Modify: `src/renderer/src/hooks/use-champ-select.ts:92-96`

- [ ] **Step 1: Replace the sub-phase glue**

Replace:

```ts
		// sub-phase from actions: any in-progress ban → ban (PHASE-1 GLUE, Phase 4 refines)
		const flat = session.actions.flat()
		const subPhase: "ban" | "pick" = flat.some((a) => a.type === "ban" && a.isInProgress)
			? "ban"
			: "pick"
```

with:

```ts
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
```

- [ ] **Step 2: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/hooks/use-champ-select.ts
git commit -m "feat(renderer): timer-phase-aware champ-select sub-phase derivation"
```

---

### Task 4: Live smoke test

**Files:** none (verification only)

- [ ] **Step 1: Fresh fetch path**

Run (background): `ELECTRON_ENABLE_LOGGING=1 pnpm dev > /tmp/lockin-phase4-smoke.log 2>&1`
Wait for `[lcu] status: connected`, then:

```bash
grep -E '\[ddragon\]' /tmp/lockin-phase4-smoke.log
node scripts/cdp.mjs eval 'window.api.getDDragonBundle().then(b => ({ version: b.version, champs: Object.keys(b.championsByKey).length, spells: Object.keys(b.spellsByKey).length, aatrox: b.championsByKey[266]?.name, flash: b.spellsByKey[4]?.name }))'
ls -la ~/Library/Application\ Support/lockin/ddragon-cache.json
```

Expected: `[ddragon] fetched fresh bundle 16.11.1` (first run — no cache yet); eval returns `version: "16.11.1"`, champs ≈ 171, spells ≈ 15–20, `aatrox: "Aatrox"`, `flash: "Flash"`; cache file exists (~1MB).

- [ ] **Step 2: Visual sanity**

```bash
node scripts/cdp.mjs shot /tmp/lockin-phase4-home.png
```
Read the PNG — recent-note champion icons render real DDragon portraits (no tinted fallbacks).

- [ ] **Step 3: Cache-hit path**

Kill the app, relaunch (same logging), wait for connect, then:

```bash
grep -E '\[ddragon\]' /tmp/lockin-phase4-smoke2.log
node scripts/cdp.mjs eval 'window.api.getDDragonBundle().then(b => b.version)'
```

Expected: `[ddragon] serving cached bundle 16.11.1` and **no** "patch change" line (same patch); eval returns the version instantly.

- [ ] **Step 4: Kill, record evidence**

Stop the dev app; no orphans. Log excerpts → morning notes. Morning checklist gains: "real champ select renders (champs/roles/teams/picks/bans real; notes/bans/ranks still fake)".

**Offline path note:** the no-cache + offline rejection and cache + offline serve paths are exercised by code-path inspection only (we will not sever this machine's network overnight); both are trivial reads of `loadBundle()`. If Felipe wants, the morning checklist includes an optional Wi-Fi-off relaunch.
