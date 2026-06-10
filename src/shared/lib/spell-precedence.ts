import { recommendSpells } from "./spells"

export type SpellSource = "pinned" | "opgg" | "heuristic"

export interface ResolvedSpells {
	pair: [number, number]
	source: SpellSource
	rolePending: boolean
}

/**
 * Summoner-spell precedence for champ select / in-game (design §7.1):
 *   pinned-note spells > OP.GG recommendation > deterministic heuristic.
 *
 * Works in spell IDs (the caller resolves them against DDragon). `rolePending`
 * comes from the heuristic table so the UI can hint "role pending" even when an
 * OPGG/pinned pair is shown.
 */
export function resolveSpells(input: {
	assignedPosition: string
	pinnedSpells?: [number, number]
	opggSpells?: [number, number] | null
}): ResolvedSpells {
	const base = recommendSpells({ assignedPosition: input.assignedPosition })

	if (input.pinnedSpells) {
		return { pair: input.pinnedSpells, source: "pinned", rolePending: base.rolePending }
	}
	if (input.opggSpells) {
		return { pair: input.opggSpells, source: "opgg", rolePending: base.rolePending }
	}
	return { pair: base.pair, source: "heuristic", rolePending: base.rolePending }
}
