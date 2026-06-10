import type {
	AppSettings,
	BanListEntry,
	BuildRecommendation,
	ChampSelectSession,
	DDragonBundle,
	GameflowPhase,
	InGameState,
	MatchupNote,
	RankInfo,
	ReadyCheck,
	RunePageRec,
	SummonerIdentity,
} from "./types"

export type Unsubscribe = () => void

export interface Api {
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
	getBuild(
		championKey: number,
		position: string,
		tier?: string,
	): Promise<BuildRecommendation | null>
	setSpells(spell1Id: number, spell2Id: number): Promise<void>
	applyRunes(page: RunePageRec, championName?: string): Promise<{ ok: boolean; error?: string }>
	startQueue(queueId: number): Promise<{ ok: boolean; error?: string }>
	stopQueue(): Promise<void>
	onLcuStatus(cb: (s: { connected: boolean }) => void): Unsubscribe
	onGameflowPhase(cb: (p: { phase: GameflowPhase }) => void): Unsubscribe
	onReadyCheck(cb: (r: ReadyCheck | null) => void): Unsubscribe
	onChampSelect(cb: (s: ChampSelectSession | null) => void): Unsubscribe
	onSummoner(cb: (s: SummonerIdentity | null) => void): Unsubscribe
	onInGame(cb: (s: InGameState | null) => void): Unsubscribe
	onNav(cb: (n: { to: string; search?: Record<string, unknown> }) => void): Unsubscribe
}
