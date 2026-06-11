import type { ChampSelectSession, GameflowPhase, ReadyCheck } from "@/shared/types"

import { ME_CELL_ID, MY_TEAM, THEIR_TEAM } from "./fixtures"

/* The dev switcher's state — mirrors the prototype DemoBar (app.jsx:505-684). */
export interface ScenarioState {
	phase: "disconnected" | "idle" | "ready" | "select" | "game"
	csSubPhase: "ban" | "pick" | null // null = auto-cycle ban→pick on timer expiry
	enemyHidden: boolean | null // null = auto (hidden during ban)
	ranksAvailable: boolean
	hasNote: boolean
	roleAssigned: boolean
	autoAcceptFired: boolean
	buildAvailable: boolean // dev toggle: OP.GG recommendation present vs unavailable
	myPickLocked: boolean // false = I'm only hovering (counter-pick assist visible)
	countersAvailable: boolean // dev toggle: counter tables present vs fetch-failed
}

export const INITIAL_SCENARIO: ScenarioState = {
	phase: "select",
	csSubPhase: null,
	enemyHidden: null,
	ranksAvailable: true,
	hasNote: true,
	roleAssigned: true,
	autoAcceptFired: false,
	buildAvailable: true,
	myPickLocked: true,
	countersAvailable: true,
}

export const GAMEFLOW_BY_SCENARIO: Record<ScenarioState["phase"], GameflowPhase> = {
	disconnected: "None",
	idle: "Lobby",
	ready: "ReadyCheck",
	select: "ChampSelect",
	game: "InProgress",
}

/* prototype PHASE_LEN (champ-select.jsx:9), in ms */
export const PHASE_LEN_MS = { ban: 27_000, pick: 31_000 } as const
export const READY_CHECK_TOTAL_S = 12

export function buildReadyCheck(s: ScenarioState, elapsedSeconds: number): ReadyCheck {
	return {
		state: "InProgress",
		playerResponse: s.autoAcceptFired ? "Accepted" : "None",
		timer: elapsedSeconds,
		declinerIds: [],
	}
}

export function buildSession(
	s: ScenarioState,
	subPhase: "ban" | "pick",
	msLeft: number,
): ChampSelectSession {
	const enemyHidden = s.enemyHidden ?? subPhase === "ban"
	return {
		localPlayerCellId: ME_CELL_ID,
		timer: {
			adjustedTimeLeftInPhase: msLeft,
			totalTimeInPhase: PHASE_LEN_MS[subPhase],
			phase: "BAN_PICK",
			isInfinite: false,
		},
		bans: { myTeamBans: [164], theirTeamBans: [], numBans: 10 }, // Camille banned
		myTeam: MY_TEAM.map((p) => ({
			cellId: p.cellId,
			championId: p.cellId === ME_CELL_ID && !s.myPickLocked ? 0 : p.championId,
			championPickIntent: p.cellId === ME_CELL_ID && !s.myPickLocked ? p.championId : 0,
			assignedPosition: p.cellId === ME_CELL_ID && !s.roleAssigned ? "" : p.position,
			summonerId: p.summonerId,
			puuid: p.puuid,
			gameName: p.gameName,
			spell1Id: 4,
			spell2Id: 12,
			team: 1,
		})),
		theirTeam: THEIR_TEAM.map((p) => ({
			cellId: p.cellId,
			championId: enemyHidden ? 0 : p.championId,
			championPickIntent: 0,
			assignedPosition: enemyHidden ? "" : p.position,
			summonerId: 0,
			puuid: "",
			spell1Id: 0,
			spell2Id: 0,
			team: 2,
		})),
		actions: [
			[
				{
					actorCellId: ME_CELL_ID,
					championId: 0,
					completed: subPhase !== "ban",
					id: 10,
					isAllyAction: true,
					isInProgress: subPhase === "ban",
					pickTurn: 1,
					type: "ban",
				},
			],
			[
				{
					actorCellId: ME_CELL_ID,
					championId: subPhase === "pick" ? 266 : 0,
					completed: false,
					id: 20,
					isAllyAction: true,
					isInProgress: subPhase === "pick",
					pickTurn: 2,
					type: "pick",
				},
			],
		],
	}
}
