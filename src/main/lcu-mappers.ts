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
