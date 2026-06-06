import {
	authenticate,
	type Credentials,
	createHttp1Request,
	createWebSocketConnection,
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
		this.snapshot = connected ? { ...this.snapshot, connected } : { ...DISCONNECTED_SNAPSHOT } // disconnect resets phase + live state
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
