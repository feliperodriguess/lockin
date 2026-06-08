import type {
	ChampSelectAction,
	ChampSelectPlayer,
	ChampSelectSession,
	RankInfo,
	ReadyCheck,
} from "@/shared/types"

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

export interface RawRankedStats {
	queueMap?: Record<string, { tier?: string; division?: string; leaguePoints?: number }>
}

export type RankedQueue = "RANKED_SOLO_5x5" | "RANKED_FLEX_SR"

/** Stable Riot LCU queue IDs (catalog: GET /lol-game-queues/v1/queues). */
export const RANKED_QUEUE_ID = {
	SOLO_DUO: 420,
	FLEX: 440,
} as const

export interface RawGameflowSession {
	gameData?: { queue?: { id?: number; type?: string } }
}

/** Queue-aware rank: show the rank for the queue this lobby is actually in —
 *  a flex lobby shows flex rank, everything else (solo/duo, draft, normals)
 *  shows solo/duo rank. Keys off the queue id; the `type` string is a backup. */
export function rankedQueueOf(session: RawGameflowSession | null): RankedQueue {
	const queue = session?.gameData?.queue
	if (queue?.id === RANKED_QUEUE_ID.FLEX || queue?.type === "RANKED_FLEX_SR") {
		return "RANKED_FLEX_SR"
	}
	return "RANKED_SOLO_5x5"
}

/** Reads the chosen queue's entry from the ranked-stats payload (which carries
 *  every queue). Empty tier = unranked → null. */
export function toRankInfo(raw: RawRankedStats, queue: RankedQueue): RankInfo | null {
	const entry = raw.queueMap?.[queue]
	if (!entry?.tier) return null
	return {
		tier: entry.tier,
		division: entry.division ?? "NA",
		lp: entry.leaguePoints ?? 0,
		queueType: queue,
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
