import {
	authenticate,
	type Credentials,
	createHttp1Request,
	createWebSocketConnection,
	LeagueClient,
	type LeagueWebSocket,
} from "league-connect"

import { IPC } from "@/shared/constants"
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
import { getLockinRunePageId, getSettings, setLockinRunePageId } from "./store"

const PROCESS_POLL_MS = 2500 // league-connect's default cadence for process scans
const WS_RETRY_MS = 1000
const WS_MAX_RETRIES = 30 // ~30s grace while a freshly launched client boots its API server
const SESSION_RETRY_MS = 3000 // pause after an unexpected session failure before re-discovery

type Emit = (channel: string, payload: unknown) => void

class LcuService {
	private running = false
	private snapshot: LcuSnapshot = { ...DISCONNECTED_SNAPSHOT }
	private endSession: (() => void) | null = null
	private credentials: Credentials | null = null
	private localPuuid = ""
	private aaDeclined = false
	private aaFired = false
	private aaTimer: NodeJS.Timeout | null = null

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
				this.credentials = null
				this.resetAutoAccept()
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

					// initial state after subscribing; a later push reconciles any
					// in-between transition (last-writer race, self-heals within ~1 WS tick).
					// ready-check + session 404 while idle (verified live) → null.
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
		const prev = this.snapshot
		this.snapshot = connected ? { ...this.snapshot, connected } : { ...DISCONNECTED_SNAPSHOT }
		console.log(`[lcu] status: ${connected ? "connected" : "disconnected"}`)
		this.emit(IPC.LCU_STATUS, { connected })
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
	}

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

	/** GET that treats non-ok (404 while idle) and transport hiccups as null. */
	private async fetchJson<T>(url: string, credentials: Credentials): Promise<T | null> {
		try {
			const response = await createHttp1Request({ method: "GET", url }, credentials)
			return response.ok ? response.json<T>() : null
		} catch (error) {
			console.warn(`[lcu] GET ${url} failed:`, error)
			return null // transient transport failure must not kill the session — WS close decides
		}
	}

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

	async acceptReadyCheck(): Promise<void> {
		await this.request("POST", "/lol-matchmaking/v1/ready-check/accept")
	}

	async declineReadyCheck(): Promise<void> {
		// the guard flips BEFORE the POST — even on request failure we never auto-accept after
		this.aaDeclined = true
		this.cancelAutoAcceptTimer()
		await this.request("POST", "/lol-matchmaking/v1/ready-check/decline")
	}

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
			return {
				ok: false,
				error: "Could not start the queue. Check you're in a lobby-eligible state.",
			}
		}
	}

	async stopQueue(): Promise<void> {
		await this.request("DELETE", "/lol-matchmaking/v1/search")
	}

	private handleReadyCheck(readyCheck: ReadyCheck | null): void {
		if (readyCheck?.state !== "InProgress") {
			this.resetAutoAccept() // check over/gone → next pop is a fresh cycle
		} else {
			// transition INTO InProgress = a new pop; flags/timers never leak across
			// cycles even if no null/Invalid push separated them (back-to-back pops)
			if (this.snapshot.readyCheck?.state !== "InProgress") this.resetAutoAccept()
			if (readyCheck.playerResponse === "Declined") {
				this.aaDeclined = true // decline observed (either surface) is final for this cycle
				this.cancelAutoAcceptTimer()
			} else if (readyCheck.playerResponse === "None") {
				this.maybeScheduleAutoAccept()
			}
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
		// revalidate EVERYTHING at fire time, never override a decline
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

	async getRanksForPuuids(puuids: string[]): Promise<Record<string, RankInfo | null>> {
		const out: Record<string, RankInfo | null> = {}
		const credentials = this.credentials
		const targets = puuids.filter(Boolean)
		if (!credentials) {
			for (const puuid of targets) out[puuid] = null
			return out
		}
		// queue-aware: read the lobby's queue once, then show each player's rank
		// for THAT queue (flex lobby → flex rank). Falls back to solo if unknown.
		const gameflow = await this.fetchJson<RawGameflowSession>(
			"/lol-gameflow/v1/session",
			credentials,
		)
		const queue = rankedQueueOf(gameflow)
		await Promise.all(
			targets.map(async (puuid) => {
				const raw = await this.fetchJson<RawRankedStats>(
					`/lol-ranked/v1/ranked-stats/${puuid}`,
					credentials,
				)
				out[puuid] = raw ? toRankInfo(raw, queue) : null
			}),
		)
		return out
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

export async function acceptReadyCheck(): Promise<void> {
	if (!service) throw new Error("LCU service not started")
	await service.acceptReadyCheck()
}

export async function declineReadyCheck(): Promise<void> {
	if (!service) throw new Error("LCU service not started")
	await service.declineReadyCheck()
}

export async function getRanksForPuuids(
	puuids: string[],
): Promise<Record<string, RankInfo | null>> {
	if (!service) return Object.fromEntries(puuids.filter(Boolean).map((p) => [p, null]))
	return service.getRanksForPuuids(puuids)
}

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
