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
	onLcuStatus(cb: (s: { connected: boolean }) => void): Unsubscribe
	onGameflowPhase(cb: (p: { phase: GameflowPhase }) => void): Unsubscribe
	onReadyCheck(cb: (r: ReadyCheck | null) => void): Unsubscribe
	onChampSelect(cb: (s: ChampSelectSession | null) => void): Unsubscribe
}
