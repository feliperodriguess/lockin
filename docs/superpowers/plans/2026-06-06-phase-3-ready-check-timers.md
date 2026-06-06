# Phase 3 — Ready Check + Timers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real ready-check push with main-process auto-accept (delay + decline-guard, off by default), real accept/decline mutations (D16), real settings persistence (D11), and the champ-select session push for the phase timer (D12).

**Architecture:** `LcuService` gains two more WS subscriptions (`/lol-matchmaking/v1/ready-check`, `/lol-champ-select/v1/session`) with initial GETs on connect (both 404 when idle — verified live: `"Not attached to a matchmaking queue."` / `"No active delegate"`). Raw LCU payloads are mapped to the PRD §7 subsets in a new `lcu-mappers.ts`. The auto-accept guard lives in main (PRD §6 edge: *"a manual decline is never overridden"*): per-check-cycle `declined`/`fired` flags + a delay timer that revalidates everything at fire time. `store.ts` becomes a typed electron-store schema with settings accessors. Preload grows 6 channels; the progressive merge then routes ready-check/champ-select to real, so fake previews of those move behind the force-fake flag (by design, spec §3.2).

**Tech Stack:** electron-store v11 (bundled, not externalized), league-connect HTTP/WS, typed IPC. Plus a DEV-only CDP verification harness (`scripts/cdp.mjs`, native `WebSocket` — Node 24) used for overnight E1 smoke tests from Phase 3 onward.

**Testing (D4):** No vitest until Phase 5. Verification = typecheck + format + live smoke: boot against the idle client (404 paths), settings round-trip through the real renderer via CDP `Runtime.evaluate`, restart persistence, CDP screenshot of the Idle screen. Queue-dependent flows (actual pop, auto-accept firing, timer) go on the morning checklist.

**Live-verified facts this plan relies on:**
- Idle client: `GET /lol-matchmaking/v1/ready-check` → HTTP 404 `RPC_ERROR`; `GET /lol-champ-select/v1/session` → HTTP 404. Initial GETs must treat `!response.ok` as `null`.
- Real LCU ready-check `state` has values beyond the PRD §7 pair (e.g. `EveryoneReady`, `PartyNotReady`, `Error`). The renderer keys on `playerResponse` first and only special-cases the literal `"Invalid"`, so pass-through is safe once the type is widened with the `(string & {})` pattern already used by `ChampSelectAction.type`.
- `ReadyCheckScreen` (src/renderer/src/components/ready-check/ready-check-screen.tsx) already wires `useAcceptReadyCheck`/`useDeclineReadyCheck`/`useSettings` — no renderer changes needed in this phase.

---

### Task 0: DEV verification harness (CDP)

**Files:**
- Modify: `src/main/index.ts`
- Create: `scripts/cdp.mjs`

- [ ] **Step 1: Open a DEV-only CDP port in `src/main/index.ts`**

Immediately after the imports block (before `function createWindow`), add:

```ts
// CDP endpoint for the overnight verification harness (scripts/cdp.mjs). DEV only.
if (is.dev) {
	app.commandLine.appendSwitch("remote-debugging-port", "9223")
}
```

(`is` is already imported from `@electron-toolkit/utils`; `app` from `electron`. `appendSwitch` must run before `app.whenReady()` — module top-level is correct.)

- [ ] **Step 2: Create `scripts/cdp.mjs`**

Uses Node's native `WebSocket` (system node is v24) — no dependency:

```js
#!/usr/bin/env node
/* DEV verification helper — drives the running dev app over CDP (port 9223).
   Usage:
     node scripts/cdp.mjs eval '<js expression>'   // awaits promises, prints JSON result
     node scripts/cdp.mjs shot /tmp/app.png        // PNG screenshot of the renderer
   Requires `pnpm dev` to be running (the CDP port is DEV-only). */
import { writeFileSync } from "node:fs"

const [, , cmd, arg] = process.argv
if (!cmd || !arg) {
	console.error("usage: cdp.mjs eval '<expr>' | cdp.mjs shot <file.png>")
	process.exit(1)
}

const list = await (await fetch("http://127.0.0.1:9223/json/list")).json()
const page = list.find((t) => t.type === "page" && !t.url.startsWith("devtools://"))
if (!page) {
	console.error("no renderer page target; is `pnpm dev` running?")
	process.exit(1)
}

const ws = new WebSocket(page.webSocketDebuggerUrl)
let nextId = 1
const pending = new Map()

function send(method, params = {}) {
	const id = nextId++
	ws.send(JSON.stringify({ id, method, params }))
	return new Promise((resolve, reject) => pending.set(id, { resolve, reject }))
}

ws.onmessage = (event) => {
	const msg = JSON.parse(event.data)
	if (msg.id && pending.has(msg.id)) {
		const { resolve, reject } = pending.get(msg.id)
		pending.delete(msg.id)
		if (msg.error) reject(new Error(msg.error.message))
		else resolve(msg.result)
	}
}

ws.onopen = async () => {
	try {
		if (cmd === "eval") {
			const res = await send("Runtime.evaluate", {
				expression: arg,
				awaitPromise: true,
				returnByValue: true,
			})
			if (res.exceptionDetails) {
				console.error("threw:", JSON.stringify(res.exceptionDetails))
				process.exitCode = 1
			} else {
				console.log(JSON.stringify(res.result.value ?? res.result, null, 2))
			}
		} else if (cmd === "shot") {
			const res = await send("Page.captureScreenshot", { format: "png" })
			writeFileSync(arg, Buffer.from(res.data, "base64"))
			console.log(`wrote ${arg}`)
		} else {
			console.error(`unknown command: ${cmd}`)
			process.exitCode = 1
		}
	} catch (error) {
		console.error(error.message)
		process.exitCode = 1
	} finally {
		ws.close()
	}
}
```

- [ ] **Step 3: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean (biome also formats scripts/).

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts scripts/cdp.mjs
git commit -m "feat(dev): CDP verification harness — DEV-only debugging port + cdp.mjs eval/screenshot helper"
```

---

### Task 1: Typed store with settings accessors

**Files:**
- Modify: `src/main/store.ts` (full replacement of the scaffold placeholder)

- [ ] **Step 1: Replace `src/main/store.ts`**

```ts
import Store from "electron-store"

import {
	type AppSettings,
	type BanListEntry,
	DEFAULT_SETTINGS,
	type MatchupNote,
} from "@/shared/types"

type StoreSchema = {
	settings: AppSettings
	notes: MatchupNote[]
	banlist: BanListEntry[]
}

// Single store under userData (PRD §3). Notes/banlist accessors land in Phases 5/6.
export const store = new Store<StoreSchema>({
	defaults: {
		settings: DEFAULT_SETTINGS,
		notes: [],
		banlist: [],
	},
})

export function getSettings(): AppSettings {
	// spread over defaults so settings keys added in app updates are always present
	return { ...DEFAULT_SETTINGS, ...store.get("settings") }
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
	const next = { ...getSettings(), ...partial }
	store.set("settings", next)
	return next
}
```

(This also clears the repo's one pre-existing biome warning — `noExplicitAny` on the scaffold's `Record<string, any>`.)

- [ ] **Step 2: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean; biome warning count drops to 0.

- [ ] **Step 3: Commit**

```bash
git add src/main/store.ts
git commit -m "feat(main): typed electron-store schema + settings accessors (D11)"
```

---

### Task 2: Settings over IPC, end to end

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Handlers in `src/main/ipc.ts`**

Replace the file content with:

```ts
import { ipcMain } from "electron"

import { IPC } from "@/shared/constants"
import type { AppSettings } from "@/shared/types"

import { getLcuSnapshot } from "./lcu"
import { getSettings, setSettings } from "./store"

// ALL invoke handlers live here (CLAUDE.md). Channels not yet implemented
// still answer from the renderer's fake bridge via the progressive merge.
ipcMain.handle(IPC.LCU_GET_SNAPSHOT, () => getLcuSnapshot())

ipcMain.handle(IPC.SETTINGS_GET, () => getSettings())
ipcMain.handle(IPC.SETTINGS_SET, (_event, partial: Partial<AppSettings>) => setSettings(partial))
```

- [ ] **Step 2: Bridge channels in `src/preload/index.ts`**

Replace the `const api: Partial<Api> = { … }` block with:

```ts
// Real channels land here phase-by-phase (Phase 2: status/phase; Phase 3:
// settings + ready-check + champ-select). getApi() in the renderer merges
// this over the fake bridge — real keys win.
const api: Partial<Api> = {
	getSettings: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
	setSettings: (partial) => ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
	onLcuStatus: (cb) =>
		subscribeWithSnapshot(IPC.LCU_STATUS, cb, (s) => ({ connected: s.connected })),
	onGameflowPhase: (cb) => subscribeWithSnapshot(IPC.LCU_PHASE, cb, (s) => ({ phase: s.phase })),
}
```

- [ ] **Step 3: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts src/preload/index.ts
git commit -m "feat: real settings:get/set over IPC (D11)"
```

---

### Task 3: Widen `ReadyCheck.state` + raw-payload mappers

**Files:**
- Modify: `src/shared/types.ts:77` (the `ReadyCheck` interface)
- Create: `src/main/lcu-mappers.ts`

- [ ] **Step 1: Widen the state union in `src/shared/types.ts`**

Replace the `ReadyCheck` interface's `state` line:

```ts
export interface ReadyCheck {
	// LCU emits more states (EveryoneReady, PartyNotReady, Error, …); we consume
	// the two named ones and pass the rest through (renderer keys on playerResponse)
	state: "Invalid" | "InProgress" | (string & {})
	playerResponse: "None" | "Accepted" | "Declined"
	timer: number // seconds elapsed since the check appeared
	declinerIds: number[]
}
```

- [ ] **Step 2: Create `src/main/lcu-mappers.ts`**

Defensive raw→§7-subset mappers. Raw shapes are all-optional typed interfaces (no `any` — biome):

```ts
import type {
	ChampSelectAction,
	ChampSelectPlayer,
	ChampSelectSession,
	ReadyCheck,
} from "@/shared/types"

/* Raw LCU payload subsets (everything optional — the wire shape is not ours).
   Mapping rules: never throw; missing numerics → 0, strings → "", and
   timer.isInfinite defaults TRUE so an unknown timer hides the countdown
   instead of showing garbage (PRD §6.4 edge). */

export interface RawReadyCheck {
	state?: string
	playerResponse?: string
	timer?: number
	declinerIds?: number[]
}

interface RawPlayer {
	cellId?: number
	championId?: number
	championPickIntent?: number
	assignedPosition?: string
	summonerId?: number
	puuid?: string
	gameName?: string
	spell1Id?: number
	spell2Id?: number
	team?: number
}

interface RawAction {
	actorCellId?: number
	championId?: number
	completed?: boolean
	id?: number
	isAllyAction?: boolean
	isInProgress?: boolean
	pickTurn?: number
	type?: string
}

export interface RawChampSelectSession {
	actions?: RawAction[][]
	bans?: { myTeamBans?: number[]; theirTeamBans?: number[]; numBans?: number }
	localPlayerCellId?: number
	myTeam?: RawPlayer[]
	theirTeam?: RawPlayer[]
	timer?: {
		adjustedTimeLeftInPhase?: number
		totalTimeInPhase?: number
		phase?: string
		isInfinite?: boolean
	}
}

export function toReadyCheck(raw: RawReadyCheck): ReadyCheck {
	return {
		state: (raw.state as ReadyCheck["state"]) ?? "Invalid",
		playerResponse: (raw.playerResponse as ReadyCheck["playerResponse"]) ?? "None",
		timer: raw.timer ?? 0,
		declinerIds: raw.declinerIds ?? [],
	}
}

function toPlayer(raw: RawPlayer): ChampSelectPlayer {
	return {
		cellId: raw.cellId ?? -1,
		championId: raw.championId ?? 0,
		championPickIntent: raw.championPickIntent ?? 0,
		assignedPosition: raw.assignedPosition ?? "",
		summonerId: raw.summonerId ?? 0,
		puuid: raw.puuid ?? "",
		gameName: raw.gameName || undefined,
		spell1Id: raw.spell1Id ?? 0,
		spell2Id: raw.spell2Id ?? 0,
		team: raw.team ?? 0,
	}
}

function toAction(raw: RawAction): ChampSelectAction {
	return {
		actorCellId: raw.actorCellId ?? -1,
		championId: raw.championId ?? 0,
		completed: raw.completed ?? false,
		id: raw.id ?? 0,
		isAllyAction: raw.isAllyAction ?? false,
		isInProgress: raw.isInProgress ?? false,
		pickTurn: raw.pickTurn ?? 0,
		type: raw.type ?? "",
	}
}

export function toChampSelectSession(raw: RawChampSelectSession): ChampSelectSession {
	return {
		actions: (raw.actions ?? []).map((group) => (group ?? []).map(toAction)),
		bans: {
			myTeamBans: raw.bans?.myTeamBans ?? [],
			theirTeamBans: raw.bans?.theirTeamBans ?? [],
			numBans: raw.bans?.numBans ?? 0,
		},
		localPlayerCellId: raw.localPlayerCellId ?? -1,
		myTeam: (raw.myTeam ?? []).map(toPlayer),
		theirTeam: (raw.theirTeam ?? []).map(toPlayer),
		timer: {
			adjustedTimeLeftInPhase: raw.timer?.adjustedTimeLeftInPhase ?? 0,
			totalTimeInPhase: raw.timer?.totalTimeInPhase ?? 0,
			phase: raw.timer?.phase ?? "",
			isInfinite: raw.timer?.isInfinite ?? true,
		},
	}
}
```

- [ ] **Step 3: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/types.ts src/main/lcu-mappers.ts
git commit -m "feat(main): raw LCU payload mappers; widen ReadyCheck.state to pass-through"
```

---

### Task 4: Ready-check + champ-select in `LcuService` (subscriptions, initial GETs, auto-accept, accept/decline)

**Files:**
- Modify: `src/main/lcu.ts`

- [ ] **Step 1: Extend imports and add service state**

Update the shared-types import and add the mappers import:

```ts
import {
	type RawChampSelectSession,
	type RawReadyCheck,
	toChampSelectSession,
	toReadyCheck,
} from "./lcu-mappers"
import { getSettings } from "./store"
```

and widen the types import:

```ts
import {
	type ChampSelectSession,
	DISCONNECTED_SNAPSHOT,
	type GameflowPhase,
	type LcuSnapshot,
	type ReadyCheck,
} from "@/shared/types"
```

Add fields to `LcuService` (after `private endSession`):

```ts
	private credentials: Credentials | null = null
	// per-ready-check-cycle auto-accept state (PRD §6.4: a decline is final)
	private aaDeclined = false
	private aaFired = false
	private aaTimer: NodeJS.Timeout | null = null
```

- [ ] **Step 2: Wire the session — subscriptions + initial GETs + credentials retention**

Inside `session()`'s async IIFE, replace the block from `socket.subscribe<GameflowPhase>(…)` through `this.setPhase(phase)` with:

```ts
					this.credentials = credentials
					socket.subscribe<GameflowPhase>("/lol-gameflow/v1/gameflow-phase", (data) => {
						this.setPhase(data ?? "None")
					})
					socket.subscribe<RawReadyCheck>("/lol-matchmaking/v1/ready-check", (data) => {
						this.handleReadyCheck(data ? toReadyCheck(data) : null)
					})
					socket.subscribe<RawChampSelectSession>("/lol-champ-select/v1/session", (data) => {
						this.setChampSelect(data ? toChampSelectSession(data) : null)
					})

					// initial state AFTER subscribing so no transition is missed in between.
					// ready-check + session 404 while idle (verified live) → null.
					const phase = await this.fetchJson<GameflowPhase>(
						"/lol-gameflow/v1/gameflow-phase",
						credentials,
					)
					const readyCheck = await this.fetchJson<RawReadyCheck>(
						"/lol-matchmaking/v1/ready-check",
						credentials,
					)
					const champSelect = await this.fetchJson<RawChampSelectSession>(
						"/lol-champ-select/v1/session",
						credentials,
					)

					this.setConnected(true)
					this.setPhase(phase ?? "None")
					this.handleReadyCheck(readyCheck ? toReadyCheck(readyCheck) : null)
					this.setChampSelect(champSelect ? toChampSelectSession(champSelect) : null)
```

In `finish()` (the session cleanup), add credential + timer cleanup after `settled = true`:

```ts
				this.credentials = null
				this.resetAutoAccept()
```

Delete the now-unused direct `createHttp1Request` block that fetched the initial phase (replaced by `fetchJson` above).

- [ ] **Step 3: Add the private helpers (place after `setPhase`)**

```ts
	/** GET that treats any non-ok response (404 while idle) as null. */
	private async fetchJson<T>(url: string, credentials: Credentials): Promise<T | null> {
		const response = await createHttp1Request({ method: "GET", url }, credentials)
		return response.ok ? response.json<T>() : null
	}

	private async request(method: "POST", url: string): Promise<void> {
		if (!this.credentials) throw new Error("LCU not connected")
		const response = await createHttp1Request({ method, url }, this.credentials)
		if (!response.ok) throw new Error(`LCU ${method} ${url} → ${response.status}`)
	}

	async acceptReadyCheck(): Promise<void> {
		await this.request("POST", "/lol-matchmaking/v1/ready-check/accept")
	}

	async declineReadyCheck(): Promise<void> {
		// the guard flips BEFORE the POST — even on request failure we never auto-accept after
		this.aaDeclined = true
		this.cancelAutoAcceptTimer()
		await this.request("POST", "/lol-matchmaking/v1/ready-check/decline")
	}

	private handleReadyCheck(readyCheck: ReadyCheck | null): void {
		if (readyCheck?.state !== "InProgress") {
			this.resetAutoAccept() // check over/gone → next pop is a fresh cycle
		} else if (readyCheck.playerResponse === "Declined") {
			this.aaDeclined = true // decline observed (either surface) is final for this cycle
			this.cancelAutoAcceptTimer()
		} else if (readyCheck.playerResponse === "None") {
			this.maybeScheduleAutoAccept()
		}
		this.setReadyCheck(readyCheck)
	}

	private maybeScheduleAutoAccept(): void {
		if (this.aaTimer || this.aaFired || this.aaDeclined) return
		const settings = getSettings()
		if (!settings.autoAccept) return
		this.aaTimer = setTimeout(
			() => {
				this.aaTimer = null
				void this.fireAutoAccept()
			},
			Math.max(0, settings.autoAcceptDelayMs),
		)
	}

	private async fireAutoAccept(): Promise<void> {
		// revalidate EVERYTHING at fire time — never override a decline (PRD §6.4)
		const readyCheck = this.snapshot.readyCheck
		if (this.aaDeclined || this.aaFired || !getSettings().autoAccept) return
		if (readyCheck?.state !== "InProgress" || readyCheck.playerResponse !== "None") return
		this.aaFired = true
		try {
			await this.acceptReadyCheck()
			console.log("[lcu] auto-accepted ready check")
		} catch (error) {
			this.aaFired = false // a later push may reschedule if the check is still live
			console.error("[lcu] auto-accept failed:", error)
		}
	}

	private cancelAutoAcceptTimer(): void {
		if (this.aaTimer) clearTimeout(this.aaTimer)
		this.aaTimer = null
	}

	private resetAutoAccept(): void {
		this.cancelAutoAcceptTimer()
		this.aaDeclined = false
		this.aaFired = false
	}

	private setReadyCheck(readyCheck: ReadyCheck | null): void {
		if (readyCheck === null && this.snapshot.readyCheck === null) return
		this.snapshot = { ...this.snapshot, readyCheck }
		this.emit(IPC.LCU_READY_CHECK, readyCheck)
	}

	private setChampSelect(champSelect: ChampSelectSession | null): void {
		if (champSelect === null && this.snapshot.champSelect === null) return
		this.snapshot = { ...this.snapshot, champSelect }
		this.emit(IPC.LCU_CHAMP_SELECT, champSelect)
	}
```

- [ ] **Step 4: Disconnect resets the live channels too**

Replace `setConnected` with:

```ts
	private setConnected(connected: boolean): void {
		if (this.snapshot.connected === connected) return
		const prev = this.snapshot
		this.snapshot = connected ? { ...this.snapshot, connected } : { ...DISCONNECTED_SNAPSHOT }
		console.log(`[lcu] status: ${connected ? "connected" : "disconnected"}`)
		this.emit(IPC.LCU_STATUS, { connected })
		if (!connected) {
			this.resetAutoAccept()
			if (prev.phase !== "None") this.emit(IPC.LCU_PHASE, { phase: this.snapshot.phase })
			if (prev.readyCheck !== null) this.emit(IPC.LCU_READY_CHECK, null)
			if (prev.champSelect !== null) this.emit(IPC.LCU_CHAMP_SELECT, null)
		}
	}
```

- [ ] **Step 5: Module-level mutation exports (for `ipc.ts`), after `getLcuSnapshot`**

```ts
export async function acceptReadyCheck(): Promise<void> {
	if (!service) throw new Error("LCU service not started")
	await service.acceptReadyCheck()
}

export async function declineReadyCheck(): Promise<void> {
	if (!service) throw new Error("LCU service not started")
	await service.declineReadyCheck()
}
```

- [ ] **Step 6: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean. (`lcu.ts` lands ~290 lines — at the cap; mappers already split out.)

- [ ] **Step 7: Commit**

```bash
git add src/main/lcu.ts
git commit -m "feat(main): ready-check + champ-select pushes, auto-accept with decline guard, accept/decline requests"
```

---

### Task 5: Expose the mutations + live pushes through IPC and preload

**Files:**
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Handlers in `src/main/ipc.ts`**

Update the lcu import and append handlers:

```ts
import { acceptReadyCheck, declineReadyCheck, getLcuSnapshot } from "./lcu"
```

```ts
ipcMain.handle(IPC.ACCEPT_READY_CHECK, () => acceptReadyCheck())
ipcMain.handle(IPC.DECLINE_READY_CHECK, () => declineReadyCheck())
```

- [ ] **Step 2: Bridge channels in `src/preload/index.ts`**

Add to the `api` object:

```ts
	acceptReadyCheck: () => ipcRenderer.invoke(IPC.ACCEPT_READY_CHECK),
	declineReadyCheck: () => ipcRenderer.invoke(IPC.DECLINE_READY_CHECK),
	onReadyCheck: (cb) => subscribeWithSnapshot(IPC.LCU_READY_CHECK, cb, (s) => s.readyCheck),
	onChampSelect: (cb) => subscribeWithSnapshot(IPC.LCU_CHAMP_SELECT, cb, (s) => s.champSelect),
```

Note the consequence: ready-check/champ-select previews from the dev switcher now require the **force-fake** toggle (real channels win the merge). Expected per spec §3.2 — not a regression.

- [ ] **Step 3: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc.ts src/preload/index.ts
git commit -m "feat: real ready-check mutations + readyCheck/champSelect pushes over the bridge (D12, D16)"
```

---

### Task 6: Live smoke test (idle client + CDP round-trips)

**Files:** none (verification only; fixes get their own commits)

- [ ] **Step 1: Boot and confirm idle-state handling**

Run (background): `ELECTRON_ENABLE_LOGGING=1 pnpm dev > /tmp/lockin-phase3-smoke.log 2>&1`
Wait for `[lcu] status: connected`, then check:

```bash
grep -E '\[lcu\]|lcu-provider' /tmp/lockin-phase3-smoke.log
```

Expected: connected logs as in Phase 2; **no** errors from the two initial 404 GETs; provider breadcrumbs present.

- [ ] **Step 2: Settings round-trip through the real renderer (CDP)**

```bash
node scripts/cdp.mjs eval 'window.api.getSettings()'
```
Expected: `{"autoAccept":false,"autoAcceptDelayMs":0,"spellSlotLayout":"DF","rankDiffThreshold":8}` (defaults).

```bash
node scripts/cdp.mjs eval 'window.api.setSettings({ autoAccept: true, autoAcceptDelayMs: 1500 })'
cat ~/Library/Application\ Support/lockin/config.json
```
Expected: returned object and disk file both show `autoAccept: true`, `autoAcceptDelayMs: 1500`.

- [ ] **Step 3: Restart persistence**

Kill the dev app (TaskStop), relaunch, wait for connect, then:

```bash
node scripts/cdp.mjs eval 'window.api.getSettings()'
```
Expected: persisted `autoAccept: true, autoAcceptDelayMs: 1500`.

- [ ] **Step 4: Reset to defaults — MANDATORY**

```bash
node scripts/cdp.mjs eval 'window.api.setSettings({ autoAccept: false, autoAcceptDelayMs: 0 })'
```
Auto-accept must be left **off** (PRD §14: off by default; this is Felipe's real store).

- [ ] **Step 5: Visual evidence**

```bash
node scripts/cdp.mjs shot /tmp/lockin-phase3-idle.png
```
Read the PNG — expect the Idle screen (client connected, no queue) with the sidebar dot lit.

- [ ] **Step 6: Snapshot sanity via CDP**

```bash
node scripts/cdp.mjs eval 'new Promise(r => { const off = window.api.onReadyCheck(v => { off(); r(v === null ? "null-ok" : JSON.stringify(v)) }) })'
```
Expected: `"null-ok"` (snapshot delivers the current null ready-check immediately).

- [ ] **Step 7: Kill the app, record evidence**

Stop the dev process; confirm no orphans. Append log + CDP excerpts to the morning-report notes. Queue-dependent §6.4 boxes (pop rendering, auto-accept firing with delay, decline guard under a real pop, champ-select timer) go on the morning checklist.
