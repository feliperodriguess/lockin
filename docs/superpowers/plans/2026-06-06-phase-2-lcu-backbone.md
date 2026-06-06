# Phase 2 — LCU Backbone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app connects to the real League client: `lcu:status` and `lcu:phase` are pushed from a main-process `LcuService` (league-connect), exposed through the first real preload channels, and the progressive merge makes them win over the fake bridge.

**Architecture:** A main-process session loop — `authenticate({ awaitConnection: true })` → WebSocket subscribe to `/lol-gameflow/v1/gameflow-phase` → initial phase via HTTP GET → `LeagueClient` watcher for process death — that emits push events to all windows and re-enters discovery on disconnect. The preload implements the two push channels with a *snapshot-then-stream* pattern (an internal `lcu:getSnapshot` invoke) so subscribers get the current value immediately, matching the fake bridge's contract semantics. No renderer component changes: `LcuProvider` consumes the merged API unchanged.

**Tech Stack:** Electron main process, `league-connect` 6.0.0-rc13 (`authenticate`, `createWebSocketConnection`, `createHttp1Request`, `LeagueClient`), typed IPC over `contextBridge`.

**Testing note (design D4):** No unit tests in this phase — vitest enters at Phase 5 for pure engines only. Verification = `pnpm typecheck`, `pnpm format`, and a live smoke test against the running League client (`ELECTRON_ENABLE_LOGGING=1` so renderer console reaches stdout).

**league-connect facts (verified from `node_modules/league-connect/dist/index.d.ts` + `index.js`):**
- `authenticate({ awaitConnection: true, pollInterval })` polls the process list until the client exists; resolves `Credentials { port, password, pid, certificate? }`. Without `awaitConnection` it throws `ClientNotFoundError` immediately.
- `createWebSocketConnection({ authenticationOptions, pollInterval, maxRetries })` does its **own** `authenticate()` internally (you cannot pass credentials); retries `ECONNREFUSED` up to `maxRetries` spaced `pollInterval` ms. Returns `LeagueWebSocket extends WebSocket` with `.subscribe(path, (data, event) => …)`.
- For `/lol-gameflow/v1/gameflow-phase` events, `data` is the bare phase string (e.g. `"ChampSelect"`).
- `createHttp1Request({ method, url }, credentials)` → `Http1Response` with **sync** `.json<T>(): T`.
- `LeagueClient(credentials, { pollInterval })` polls the pid every `pollInterval` ms; emits `'disconnect'` when the process dies. `.start()` throws `ClientNotFoundError` if the pid is already gone.

---

### Task 1: Shared contract groundwork (snapshot channel + type + contract docs)

**Files:**
- Modify: `src/shared/constants.ts`
- Modify: `src/shared/types.ts`
- Modify: `src/shared/api.ts`

- [ ] **Step 1: Add the internal snapshot channel to `src/shared/constants.ts`**

Append to the `IPC` object (after `RANK_GET_FOR_PUUIDS`, before the push section):

```ts
	// Renderer → Main (invoke, preload-internal — not part of the public Api;
	// the bridge uses it to deliver current state on subscribe, matching the fake)
	LCU_GET_SNAPSHOT: "lcu:getSnapshot",
```

- [ ] **Step 2: Add `LcuSnapshot` to `src/shared/types.ts`**

Append at the end of the file:

```ts
// ---------- LCU snapshot (preload-internal; current push-state on subscribe) ----------
export interface LcuSnapshot {
	connected: boolean
	phase: GameflowPhase
	readyCheck: ReadyCheck | null // stays null until Phase 3
	champSelect: ChampSelectSession | null // stays null until Phase 3 (timer) / 4 (full)
}

export const DISCONNECTED_SNAPSHOT: LcuSnapshot = {
	connected: false,
	phase: "None",
	readyCheck: null,
	champSelect: null,
}
```

- [ ] **Step 3: Document the immediate-callback semantics in `src/shared/api.ts`**

Replace the comment line `// pushes → LcuProvider context (never into the Query cache)` with:

```ts
	// pushes → LcuProvider context (never into the Query cache).
	// Contract: every subscribe delivers the CURRENT value immediately (microtask ok),
	// then streams updates. The fake calls back synchronously; the real bridge
	// answers from lcu:getSnapshot. Subscribers must not assume sync delivery.
```

- [ ] **Step 4: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: both clean (re-stage if format rewrites).

- [ ] **Step 5: Commit**

```bash
git add src/shared/constants.ts src/shared/types.ts src/shared/api.ts
git commit -m "feat(shared): lcu snapshot channel + type, codify subscribe-delivers-current contract"
```

---

### Task 2: `LcuService` in `src/main/lcu.ts`

**Files:**
- Create: `src/main/lcu.ts`

- [ ] **Step 1: Write `src/main/lcu.ts`**

```ts
import {
	authenticate,
	createHttp1Request,
	createWebSocketConnection,
	type Credentials,
	LeagueClient,
	type LeagueWebSocket,
} from "league-connect"

import { IPC } from "@/shared/constants"
import { DISCONNECTED_SNAPSHOT, type GameflowPhase, type LcuSnapshot } from "@/shared/types"

const PROCESS_POLL_MS = 2500 // league-connect's default cadence for process scans
const WS_RETRY_MS = 1000
const WS_MAX_RETRIES = 30 // ~30s grace while a freshly launched client boots its API server
const SESSION_RETRY_MS = 3000 // pause after an unexpected session failure before re-discovery

type Emit = (channel: string, payload: unknown) => void

/**
 * Owns all LCU connectivity (PRD §9). Lifecycle: discovery loop →
 * authenticated session (WS subscriptions + process watcher) → on client
 * death, emit disconnected and re-enter discovery. Never throws out of the
 * loop; the app must stay alive without a client.
 */
class LcuService {
	private running = false
	private snapshot: LcuSnapshot = { ...DISCONNECTED_SNAPSHOT }
	private endSession: (() => void) | null = null

	constructor(private emit: Emit) {}

	getSnapshot(): LcuSnapshot {
		return { ...this.snapshot }
	}

	start(): void {
		if (this.running) return
		this.running = true
		void this.loop()
	}

	stop(): void {
		this.running = false
		this.endSession?.()
	}

	private async loop(): Promise<void> {
		while (this.running) {
			try {
				console.log("[lcu] waiting for League client…")
				const credentials = await authenticate({
					awaitConnection: true,
					pollInterval: PROCESS_POLL_MS,
				})
				if (!this.running) return
				console.log(`[lcu] client found (port ${credentials.port})`)
				await this.session(credentials)
				console.log("[lcu] client gone")
			} catch (error) {
				console.error("[lcu] session error:", error)
				this.setConnected(false)
				await sleep(SESSION_RETRY_MS)
				continue
			}
			this.setConnected(false)
		}
	}

	/** Resolves when the client goes away (socket close or process death). */
	private session(credentials: Credentials): Promise<void> {
		return new Promise((resolve, reject) => {
			let ws: LeagueWebSocket | null = null
			let watcher: LeagueClient | null = null
			let settled = false

			const finish = (error?: Error): void => {
				if (settled) return
				settled = true
				this.endSession = null
				watcher?.stop()
				ws?.close()
				if (error) reject(error)
				else resolve()
			}
			this.endSession = () => finish()

			void (async () => {
				try {
					const socket = await createWebSocketConnection({
						authenticationOptions: {},
						pollInterval: WS_RETRY_MS,
						maxRetries: WS_MAX_RETRIES,
					})
					if (settled) {
						socket.close()
						return
					}
					ws = socket
					socket.on("close", () => finish())
					// log only — a 'close' always follows; without a listener Node throws
					socket.on("error", (error) => console.error("[lcu] ws error:", error))
					socket.subscribe<GameflowPhase>("/lol-gameflow/v1/gameflow-phase", (data) => {
						this.setPhase(data ?? "None")
					})

					// initial phase AFTER subscribing so no transition is missed in between
					const response = await createHttp1Request(
						{ method: "GET", url: "/lol-gameflow/v1/gameflow-phase" },
						credentials,
					)
					const phase = response.json<GameflowPhase>()

					this.setConnected(true)
					this.setPhase(phase)

					watcher = new LeagueClient(credentials, { pollInterval: PROCESS_POLL_MS })
					watcher.on("disconnect", () => finish())
					watcher.start() // throws ClientNotFoundError if the pid died meanwhile
				} catch (error) {
					finish(error as Error)
				}
			})()
		})
	}

	private setConnected(connected: boolean): void {
		if (this.snapshot.connected === connected) return
		this.snapshot = connected
			? { ...this.snapshot, connected }
			: { ...DISCONNECTED_SNAPSHOT } // disconnect resets phase + live state
		console.log(`[lcu] status: ${connected ? "connected" : "disconnected"}`)
		this.emit(IPC.LCU_STATUS, { connected })
		if (!connected) this.emit(IPC.LCU_PHASE, { phase: this.snapshot.phase })
	}

	private setPhase(phase: GameflowPhase): void {
		if (this.snapshot.phase === phase) return
		this.snapshot = { ...this.snapshot, phase }
		console.log(`[lcu] phase: ${phase}`)
		this.emit(IPC.LCU_PHASE, { phase })
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms))
}

/* ------------------------------------------------------------- singleton */
let service: LcuService | null = null

export function startLcuService(emit: Emit): void {
	if (service) return
	service = new LcuService(emit)
	service.start()
}

export function stopLcuService(): void {
	service?.stop()
	service = null
}

export function getLcuSnapshot(): LcuSnapshot {
	return service?.getSnapshot() ?? { ...DISCONNECTED_SNAPSHOT }
}
```

Design notes the implementer must preserve:
- **Disconnect resets phase to `"None"` and pushes it** — the renderer must not keep a stale "Champ Select" sub-label on a dead client.
- **Subscribe before the initial GET** — eliminates the gap where a phase change lands between fetch and subscription. The de-dupe in `setPhase` makes double delivery harmless.
- **`finish()` is idempotent** (`settled` flag) — WS `close` and watcher `disconnect` race on client quit; both call it.
- The phase event `data` is cast loosely on purpose: unknown future phases (e.g. `"TerminatedInError"`) flow through as strings; the renderer's phase→screen mapping defaults to idle for anything unrecognized.

- [ ] **Step 2: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: both clean (re-stage if format rewrites).

- [ ] **Step 3: Commit**

```bash
git add src/main/lcu.ts
git commit -m "feat(main): LcuService — discovery loop, gameflow-phase subscription, process watcher"
```

---

### Task 3: Wire the service into the app (broadcast + snapshot handler)

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/ipc.ts`

- [ ] **Step 1: Register the snapshot invoke handler in `src/main/ipc.ts`**

Replace the entire file (it is currently an empty placeholder) with:

```ts
import { ipcMain } from "electron"

import { IPC } from "@/shared/constants"

import { getLcuSnapshot } from "./lcu"

// ALL invoke handlers live here (CLAUDE.md). Channels not yet implemented
// still answer from the renderer's fake bridge via the progressive merge.
ipcMain.handle(IPC.LCU_GET_SNAPSHOT, () => getLcuSnapshot())
```

- [ ] **Step 2: Start/stop the service in `src/main/index.ts`**

Add to the imports block (after the `./store` import line, before `createTray`):

```ts
import { startLcuService, stopLcuService } from "./lcu"
```

In `app.whenReady().then(() => { … })`, after `createWindow()`:

```ts
	startLcuService((channel, payload) => {
		for (const w of BrowserWindow.getAllWindows()) {
			w.webContents.send(channel, payload)
		}
	})
```

After the `app.on("window-all-closed", …)` block at the bottom of the file:

```ts
app.on("will-quit", () => {
	stopLcuService()
})
```

- [ ] **Step 3: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: both clean (re-stage if format rewrites).

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/main/ipc.ts
git commit -m "feat(main): start LcuService on ready, broadcast pushes, snapshot handler"
```

---

### Task 4: Real preload channels (snapshot-then-stream)

**Files:**
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Implement `onLcuStatus` + `onGameflowPhase` in `src/preload/index.ts`**

Replace the entire file with:

```ts
import { contextBridge, ipcRenderer } from "electron"

import type { Api, Unsubscribe } from "@/shared/api"
import { IPC } from "@/shared/constants"
import type { LcuSnapshot } from "@/shared/types"

declare global {
	interface Window {
		api?: Partial<Api>
	}
}

/**
 * Push subscription honoring the Api contract: deliver the current value
 * immediately (from lcu:getSnapshot), then stream pushes. If a push lands
 * before the snapshot resolves, the snapshot is dropped — never regress to
 * older state.
 */
function subscribeWithSnapshot<T>(
	channel: string,
	cb: (payload: T) => void,
	fromSnapshot: (snap: LcuSnapshot) => T,
): Unsubscribe {
	let gotPush = false
	let unsubscribed = false
	const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
		gotPush = true
		cb(payload)
	}
	ipcRenderer.on(channel, listener)
	void ipcRenderer.invoke(IPC.LCU_GET_SNAPSHOT).then((snap: LcuSnapshot) => {
		if (!gotPush && !unsubscribed) cb(fromSnapshot(snap))
	})
	return () => {
		unsubscribed = true
		ipcRenderer.removeListener(channel, listener)
	}
}

// Real channels land here phase-by-phase (Phase 2: status/phase pushes).
// getApi() in the renderer merges this over the fake bridge — real keys win.
const api: Partial<Api> = {
	onLcuStatus: (cb) => subscribeWithSnapshot(IPC.LCU_STATUS, cb, (s) => ({ connected: s.connected })),
	onGameflowPhase: (cb) => subscribeWithSnapshot(IPC.LCU_PHASE, cb, (s) => ({ phase: s.phase })),
}

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

- [ ] **Step 2: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: both clean — biome will reflow the ~101-char `onLcuStatus` line; re-stage after it does.

Note: after this task, fake `readyCheck`/`champSelect` channels remain live alongside the real status/phase (progressive merge). The fake ticker keeps emitting a fresh champ-select session every second in DEV — that churn is intended Phase 2 behavior, not a defect; it resolves when those channels go real (Phases 3–4).

- [ ] **Step 3: Commit**

```bash
git add src/preload/index.ts
git commit -m "feat(preload): real onLcuStatus/onGameflowPhase with snapshot-then-stream delivery"
```

---

### Task 5: Dev observability in `LcuProvider`

**Files:**
- Modify: `src/renderer/src/providers/lcu-provider.tsx:47-57`

- [ ] **Step 1: Log status/phase events in DEV**

Replace the subscription `useEffect` body with:

```ts
	// subscribe exactly once (spec §3.3)
	useEffect(() => {
		const log = (e: LcuEvent): void => {
			// DEV-only breadcrumb for live smoke tests; high-churn events excluded
			if (import.meta.env.DEV && (e.type === "status" || e.type === "phase")) {
				console.log("[lcu-provider]", e)
			}
			dispatch(e)
		}
		const offs = [
			api.onLcuStatus(({ connected }) => log({ type: "status", connected })),
			api.onGameflowPhase(({ phase }) => log({ type: "phase", phase })),
			api.onReadyCheck((readyCheck) => log({ type: "readyCheck", readyCheck })),
			api.onChampSelect((champSelect) => log({ type: "champSelect", champSelect })),
		]
		return () => {
			for (const off of offs) off()
		}
	}, [])
```

- [ ] **Step 2: Typecheck + format**

Run: `pnpm typecheck && pnpm format`
Expected: both clean (format may rewrite — re-stage if so).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/providers/lcu-provider.tsx
git commit -m "feat(renderer): dev breadcrumb log for status/phase pushes in LcuProvider"
```

---

### Task 6: Live smoke test against the running client

**Files:** none (verification only; fixes get their own commits)

- [ ] **Step 1: Confirm the League client is still running**

Run: `ps -ww -x -o args | grep 'MacOS/LeagueClientUx ' | grep -v grep | head -1 | grep -oE '\--app-port=[0-9]+'`
Expected: one `--app-port=NNNNN` line. If absent, the client closed overnight — record it and fall back to checklist-only verification.

- [ ] **Step 2: Launch the app with renderer console routed to stdout**

Run (background): `ELECTRON_ENABLE_LOGGING=1 pnpm dev > /tmp/lockin-phase2-smoke.log 2>&1`
Wait ~20s, then inspect:

```bash
grep -E '\[lcu\]' /tmp/lockin-phase2-smoke.log
grep -E 'lcu-provider' /tmp/lockin-phase2-smoke.log
```

Expected in order:
1. `[lcu] waiting for League client…`
2. `[lcu] client found (port NNNNN)`
3. `[lcu] status: connected`
4. `[lcu] phase: <X>` — **only if** the client's live phase ≠ `None`. `setPhase` de-dupes against the `"None"` seed, so an idle client correctly produces **no** main-side phase line; that is a PASS, not a failure. The phase still must surface in the renderer via #5.
5. Renderer `CONSOLE` lines containing `[lcu-provider] {type: 'status', connected: true}` and a phase event (`[lcu-provider] {type: 'phase', phase: '<X>'}` — from the push, or from the snapshot delivery when the phase never changed).

Note: per-second fake champ-select emissions in the logs are the still-merged fake bridge ticking (see Task 4 note) — ignore them.

- [ ] **Step 3: Kill the dev app**

Stop the background process (SIGTERM to the pnpm dev process group). Confirm no orphan Electron processes:
`ps x | grep -i 'electron.*lockin' | grep -v grep` → empty.

- [ ] **Step 4: Record results**

Append a short "Phase 2 smoke evidence" section (log excerpts) to the morning report notes. If any expectation failed: STOP, debug with superpowers:systematic-debugging, fix, re-run, commit fixes individually.

**Deliberately NOT exercised overnight:** the client-quit → Disconnected → reconnect transition (`setConnected(false)` reset + re-discovery loop). Exercising it means quitting Felipe's logged-in League client, which risks an interactive re-login and would torpedo live testing for all later phases. It goes on the morning live-verification checklist as a first-class item (quit client → expect `[lcu] status: disconnected`, phase reset push, Disconnected screen, `[lcu] waiting for League client…`; reopen → reconnect + Idle). The renderer's disconnected rendering itself is already Phase-1-verified via the fake.
