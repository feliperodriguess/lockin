// ---------- Static data (Data Dragon) ----------
export interface ChampionStatic {
	id: string // "Aatrox" (DDragon string key, used in image paths)
	key: number // 266 — numeric id; equals LCU championId
	name: string
	title: string
	tags: string[] // ["Fighter","Tank"] — used for the spell heuristic fallback (Phase 6)
	imageFull: string // "Aatrox.png"
}

export interface SummonerSpellStatic {
	id: string // "SummonerFlash"
	key: number // 4 — equals LCU spell id
	name: string
	imageFull: string
}

export interface DDragonBundle {
	version: string
	championsByKey: Record<number, ChampionStatic>
	spellsByKey: Record<number, SummonerSpellStatic>
	runesById: Record<number, { id: number; key: string; name: string; icon: string }>
	itemsById: Record<number, { id: number; name: string; imageFull: string }>
}

// ---------- LCU session (subset we consume) ----------
export type GameflowPhase =
	| "None"
	| "Lobby"
	| "Matchmaking"
	| "ReadyCheck"
	| "ChampSelect"
	| "GameStart"
	| "InProgress"
	| "Reconnect"
	| "WaitingForStats"
	| "PreEndOfGame"
	| "EndOfGame"

export interface ChampSelectPlayer {
	cellId: number
	championId: number // 0 if not locked/hidden
	championPickIntent: number // hovered champ
	assignedPosition: string // "top"|"jungle"|"middle"|"bottom"|"utility"|""
	summonerId: number
	puuid: string
	gameName?: string // present in modern LCU payloads
	spell1Id: number
	spell2Id: number
	team: number
}

export interface ChampSelectAction {
	actorCellId: number
	championId: number
	completed: boolean
	id: number
	isAllyAction: boolean
	isInProgress: boolean
	pickTurn: number
	type: "ban" | "pick" | (string & {})
}

export interface ChampSelectSession {
	actions: ChampSelectAction[][]
	bans: { myTeamBans: number[]; theirTeamBans: number[]; numBans: number }
	localPlayerCellId: number
	myTeam: ChampSelectPlayer[]
	theirTeam: ChampSelectPlayer[]
	timer: {
		adjustedTimeLeftInPhase: number // ms
		totalTimeInPhase: number // ms
		phase: string // "PLANNING"|"BAN_PICK"|"FINALIZATION"
		isInfinite: boolean
	}
}

export interface ReadyCheck {
	// LCU emits more states (EveryoneReady, PartyNotReady, Error, …); we consume
	// the two named ones and pass the rest through (renderer keys on playerResponse)
	state: "Invalid" | "InProgress" | (string & {})
	playerResponse: "None" | "Accepted" | "Declined"
	timer: number // seconds elapsed since the check appeared
	declinerIds: number[]
}

export interface RankInfo {
	tier: string // "GOLD" (uppercase, LCU style)
	division: string // "II"
	lp: number
	queueType: string // "RANKED_SOLO_5x5"
}

// ---------- App domain (local) ----------
export interface MatchupNote {
	id: string // uuid
	championId: number // champ you play
	opponentChampionId: number | null // optional lane opponent
	body: string
	pinnedSpells?: [number, number] // override summoner-spell keys
	createdAt: string // ISO
	updatedAt: string // ISO
}

export interface BanListEntry {
	championId: number
	priority: number // 1 = highest
	reason?: string
}

// ---------- Roles & build recommendation (OP.GG) ----------
export type Role = "top" | "jungle" | "middle" | "bottom" | "utility"

export interface RunePageRec {
	primaryStyleId: number
	subStyleId: number
	// exactly 9 in LCU order:
	// [keystone, p1, p2, p3, s1, s2, shard1, shard2, shard3]
	selectedPerkIds: number[]
	primaryName: string
	secondaryName: string
}

export interface ItemGroup {
	ids: number[]
	winRate?: number
	pickRate?: number
}

/** One candidate item for a late build slot, with its own stats when OP.GG has them. */
export interface ItemOption {
	id: number
	winRate?: number
	pickRate?: number
}

export interface BuildRecommendation {
	championKey: number
	role: Role
	patch: string
	winRate: number // 0..1
	sampleSize: number // total games
	runes: RunePageRec | null
	spells: [number, number] | null
	items: {
		starter: ItemGroup
		boots: ItemGroup
		core: ItemGroup // build-order sequence
		fourth: ItemOption[]
		fifth: ItemOption[]
		sixth: ItemOption[]
	}
	skillOrder: ("Q" | "W" | "E" | "R")[] // length 18; ability leveled at each level 1..18
	skillPriority: ("Q" | "W" | "E")[] // max-order priority, e.g. ["Q","E","W"]
}

export interface CounterEntry {
	championId: number
	/** 0..1 — ALWAYS the table-owner champion's win rate vs this champion.
	 *  Derived from OP.GG's play/win counts; OP.GG's own win_rate field flips
	 *  perspective between lists and is deliberately ignored. */
	winRate: number
	games: number
}

export interface CounterTable {
	championKey: number
	role: Role
	patch: string
	/** champions that beat this champion — worst matchup (lowest winRate) first */
	weakAgainst: CounterEntry[]
	/** champions this champion beats — best matchup (highest winRate) first */
	strongAgainst: CounterEntry[]
}

export interface SummonerIdentity {
	gameName: string
	tagLine: string
	profileIconId: number
	summonerLevel: number
	puuid: string
}

export interface InGameState {
	championId: number
	spell1Id: number
	spell2Id: number
	queueId: number
	/** carried over from the champ select this app observed; "" when unknown
	 *  (app restarted mid-game). Same convention as ChampSelectPlayer. */
	assignedPosition: string
	opponentChampionId: number | null
	/** rosters carried over from the same champ select; [] when unknown */
	myTeam: ChampSelectPlayer[]
	theirTeam: ChampSelectPlayer[]
}

/** Q/W/E/R ability + passive icons for one champion (DDragon per-champion detail). */
export interface ChampionAbilities {
	championKey: number
	abilities: { key: "Q" | "W" | "E" | "R"; name: string; imageFull: string }[]
	passive: { name: string; imageFull: string } | null
}

/** LCU lobby position-preference strings (PUT /lol-lobby/v1/.../position-preferences). */
export type RankedPosition =
	| "FILL"
	| "UNSELECTED"
	| "TOP"
	| "JUNGLE"
	| "MIDDLE"
	| "BOTTOM"
	| "UTILITY"

export interface AppSettings {
	autoAccept: boolean // default false
	autoAcceptDelayMs: number // default 0
	spellSlotLayout: "DF" | "FD" // default "DF"
	rankDiffThreshold: number // division-steps delta to flag; default 8 (= 2 tiers)
	autoRunes: boolean // default false — opt-in rune apply during champ select
	autoSpells: boolean // default false — opt-in spell apply during champ select
	buildTier: string // default "emerald_plus" — OP.GG tier bucket
	mains: { championId: number; role: Role }[] // default [] — configured main champions
	// roles requested when starting a ranked/flex queue from the tray; default Fill/none
	rankedPositions: { first: RankedPosition; second: RankedPosition }
}

export const DEFAULT_SETTINGS: AppSettings = {
	autoAccept: false,
	autoAcceptDelayMs: 0,
	spellSlotLayout: "DF",
	rankDiffThreshold: 8,
	autoRunes: false,
	autoSpells: false,
	buildTier: "emerald_plus",
	mains: [],
	rankedPositions: { first: "FILL", second: "UNSELECTED" },
}

// ---------- LCU snapshot (preload-internal; current push-state on subscribe) ----------
export interface LcuSnapshot {
	connected: boolean
	phase: GameflowPhase
	readyCheck: ReadyCheck | null // stays null until Phase 3
	champSelect: ChampSelectSession | null // stays null until Phase 3 (timer) / 4 (full)
	summoner: SummonerIdentity | null // current-summoner identity when connected
	inGame: InGameState | null // populated only during InProgress
}

export const DISCONNECTED_SNAPSHOT: LcuSnapshot = {
	connected: false,
	phase: "None",
	readyCheck: null,
	champSelect: null,
	summoner: null,
	inGame: null,
}
