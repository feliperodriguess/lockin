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
