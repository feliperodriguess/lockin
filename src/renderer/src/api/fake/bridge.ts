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
const summonerCh = channel<SummonerIdentity | null>()
const inGameCh = channel<InGameState | null>()

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
let readyTimedOut = false
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
	summonerCh.emit(connected ? FIXTURE_SUMMONER : null)
	inGameCh.emit(scenario.phase === "game" ? FIXTURE_IN_GAME : null)
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
		} else if (
			scenario.phase === "ready" &&
			!readyTimedOut &&
			effectiveReadyResponse() === "None"
		) {
			readyElapsedS += 1
			if (readyElapsedS >= READY_CHECK_TOTAL_S) {
				// missed — LCU flips state to Invalid
				readyTimedOut = true
				readyCh.emit({
					state: "Invalid",
					playerResponse: effectiveReadyResponse(),
					timer: readyElapsedS,
					declinerIds: [],
				})
				return
			}
			readyCh.emit({ ...buildReadyCheck(scenario, readyElapsedS), playerResponse: "None" })
		}
	}, 1000)
}
function stopTicker() {
	if (tick) clearInterval(tick)
	tick = undefined
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
		readyTimedOut = false
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
		for (const p of puuids) {
			if (!p) continue // LCU hides enemy identity — blank puuid means unknown player
			out[p] = scenario.ranksAvailable || p === "p-me" ? (FIXTURE_RANKS[p] ?? null) : null
		}
		return out
	},
	async getBuild(championKey, position): Promise<BuildRecommendation | null> {
		if (!scenario.buildAvailable) return null
		if (championKey !== FIXTURE_BUILD.championKey) return null
		// mirror the real provider's tolerant position matching so any caller convention
		// (Role | LCU position | OP.GG enum | shorthand) resolves a build in fake mode too
		const norm: Record<string, string> = {
			top: "top",
			jungle: "jungle",
			jg: "jungle",
			middle: "middle",
			mid: "middle",
			bottom: "bottom",
			bot: "bottom",
			adc: "bottom",
			utility: "utility",
			support: "utility",
			sup: "utility",
		}
		const role = norm[position.trim().toLowerCase()]
		return role === FIXTURE_BUILD.role ? { ...FIXTURE_BUILD } : null
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
		cb(scenario.phase === "game" ? FIXTURE_IN_GAME : null)
		return off
	},
	onNav: () => {
		// tray-driven nav has no fake source — no-op subscription
		return () => {}
	},
}

// Called once at module init. Edits to this module trigger a full page reload
// (no hot.accept), so intervals can't accumulate under HMR.
startTicker()
