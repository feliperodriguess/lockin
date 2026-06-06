import type {
	AppSettings,
	BanListEntry,
	ChampSelectSession,
	DDragonBundle,
	GameflowPhase,
	MatchupNote,
	RankInfo,
	ReadyCheck,
} from "./types"

export type Unsubscribe = () => void

/**
 * THE contract between renderer and main (PRD §8 + spec D16).
 * The real preload bridge implements it channel-by-channel across Phases 2–7;
 * the fake bridge (renderer, DEV-only) implements all of it from fixtures.
 * getApi() merges them: real channels win key-by-key (spec §3.2).
 */
export interface Api {
	// invokes → TanStack Query
	acceptReadyCheck(): Promise<void>
	declineReadyCheck(): Promise<void>
	getDDragonBundle(): Promise<DDragonBundle>
	getSettings(): Promise<AppSettings>
	setSettings(partial: Partial<AppSettings>): Promise<AppSettings>
	listNotes(): Promise<MatchupNote[]>
	upsertNote(note: Partial<MatchupNote>): Promise<MatchupNote>
	deleteNote(id: string): Promise<void>
	getBanList(): Promise<BanListEntry[]>
	setBanList(entries: BanListEntry[]): Promise<BanListEntry[]>
	getRanksForPuuids(puuids: string[]): Promise<Record<string, RankInfo | null>>
	// pushes → LcuProvider context (never into the Query cache).
	// Contract: every subscribe delivers the CURRENT value immediately (microtask ok),
	// then streams updates. The fake calls back synchronously; the real bridge
	// answers from lcu:getSnapshot. Subscribers must not assume sync delivery.
	onLcuStatus(cb: (s: { connected: boolean }) => void): Unsubscribe
	onGameflowPhase(cb: (p: { phase: GameflowPhase }) => void): Unsubscribe
	onReadyCheck(cb: (r: ReadyCheck | null) => void): Unsubscribe
	onChampSelect(cb: (s: ChampSelectSession | null) => void): Unsubscribe
}
