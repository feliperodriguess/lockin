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
}

// Single store under userData (PRD §3). Notes/banlist accessors land in Phases 5/6.
export const store = new Store<StoreSchema>({
	defaults: {
		settings: DEFAULT_SETTINGS,
		notes: [],
		banlist: [],
	},
})

export function getSettings(): AppSettings {
	// spread over defaults so settings keys added in app updates are always present
	return { ...DEFAULT_SETTINGS, ...store.get("settings") }
}

export function setSettings(partial: Partial<AppSettings>): AppSettings {
	const next = { ...getSettings(), ...partial }
	store.set("settings", next)
	return next
}

export function listNotes(): MatchupNote[] {
	// sorted copy — matches the fake bridge's contract (consumers re-sort only defensively);
	// spreading also avoids handing out electron-store's internal array reference
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
