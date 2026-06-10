import Store from "electron-store"

import {
	type AppSettings,
	type BanListEntry,
	DEFAULT_SETTINGS,
	type MatchupNote,
} from "@/shared/types"

type StoreSchema = {
	settings: AppSettings
	notes: MatchupNote[]
	banlist: BanListEntry[]
	lockinRunePageId: number | null
}

export const store = new Store<StoreSchema>({
	defaults: {
		settings: DEFAULT_SETTINGS,
		notes: [],
		banlist: [],
		lockinRunePageId: null,
	},
})

export function getSettings(): AppSettings {
	return { ...DEFAULT_SETTINGS, ...store.get("settings") }
}

const settingsSubscribers = new Set<() => void>()

/** Subscribe to any settings write; returns an unsubscribe. */
export function onSettingsChange(cb: () => void): () => void {
	settingsSubscribers.add(cb)
	return () => settingsSubscribers.delete(cb)
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
	const next = { ...getSettings(), ...partial }
	store.set("settings", next)
	for (const cb of settingsSubscribers) cb()
	return next
}

export function listNotes(): MatchupNote[] {
	return [...store.get("notes")].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function upsertNote(partial: Partial<MatchupNote>): MatchupNote {
	const notes = listNotes()
	const now = new Date().toISOString()
	if (partial.id) {
		const existing = notes.find((n) => n.id === partial.id)
		if (!existing) throw new Error(`note not found: ${partial.id}`)
		const updated: MatchupNote = { ...existing, ...partial, id: existing.id, updatedAt: now }
		store.set(
			"notes",
			notes.map((n) => (n.id === updated.id ? updated : n)),
		)
		return updated
	}
	const created: MatchupNote = {
		id: crypto.randomUUID(),
		championId: partial.championId ?? 0,
		opponentChampionId: partial.opponentChampionId ?? null,
		body: partial.body ?? "",
		pinnedSpells: partial.pinnedSpells,
		createdAt: now,
		updatedAt: now,
	}
	store.set("notes", [created, ...notes])
	return created
}

export function deleteNote(id: string): void {
	store.set(
		"notes",
		listNotes().filter((n) => n.id !== id),
	)
}

export function getBanList(): BanListEntry[] {
	return store.get("banlist").map((e) => ({ ...e }))
}

export function setBanList(entries: BanListEntry[]): BanListEntry[] {
	const next = entries.map((e, i) => ({ ...e, priority: i + 1 }))
	store.set("banlist", next)
	return next
}

export function getLockinRunePageId(): number | null {
	return store.get("lockinRunePageId")
}

export function setLockinRunePageId(id: number | null): void {
	store.set("lockinRunePageId", id)
}
