import type { DDragonBundle } from "@/shared/types"

interface RawRune {
	id?: number
	key?: string
	name?: string
	icon?: string
}
interface RawRuneSlot {
	runes?: RawRune[]
}
export interface RawRuneStyle {
	id?: number
	key?: string
	name?: string
	icon?: string
	slots?: RawRuneSlot[]
}

interface RawItemEntry {
	name?: string
	image?: { full?: string }
}

export function normalizeRunes(styles: RawRuneStyle[]): DDragonBundle["runesById"] {
	const byId: DDragonBundle["runesById"] = {}
	for (const style of styles) {
		for (const slot of style.slots ?? []) {
			for (const rune of slot.runes ?? []) {
				const id = Number(rune.id)
				if (!Number.isFinite(id)) continue
				byId[id] = {
					id,
					key: rune.key ?? "",
					name: rune.name ?? "",
					icon: rune.icon ?? "",
				}
			}
		}
	}
	return byId
}

export function normalizeItems(data: Record<string, RawItemEntry>): DDragonBundle["itemsById"] {
	const byId: DDragonBundle["itemsById"] = {}
	for (const [rawId, entry] of Object.entries(data)) {
		const id = Number(rawId)
		if (!Number.isFinite(id)) continue
		byId[id] = {
			id,
			name: entry.name ?? "",
			imageFull: entry.image?.full ?? `${id}.png`,
		}
	}
	return byId
}
