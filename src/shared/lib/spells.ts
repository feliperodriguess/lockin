/**
 * Summoner-spell recommendation (PRD §6.1): deterministic heuristic + user
 * override. Returns spell KEYS; the caller resolves them against DDragon and
 * pre-validates pinned pairs (unresolvable pin → call again without it).
 *
 * pair[0] is the user's flash-key slot under BOTH D/F layouts (SpellPair maps
 * key hints from the layout setting), so Flash always leads and the engine
 * needs no layout input.
 */

export const FLASH = 4
const IGNITE = 14 // unknown/empty role fallback

// §6.1's archetype-aware secondary fallbacks (mid assassins→Ignite, support→Exhaust)
// are deliberately out of scope for the deterministic v1 table — role primaries only.
const SECOND_BY_ROLE: Record<string, number> = {
	jungle: 11, // Smite
	top: 12, // Teleport
	middle: 12, // Teleport
	bottom: 7, // Heal
	utility: 14, // Ignite
}

export interface SpellRecommendation {
	pair: [number, number]
	source: "heuristic" | "pinned"
	rolePending: boolean
}

export function recommendSpells(input: {
	assignedPosition: string
	pinnedSpells?: [number, number]
}): SpellRecommendation {
	const second = SECOND_BY_ROLE[input.assignedPosition]
	const rolePending = second === undefined
	if (input.pinnedSpells) {
		return { pair: input.pinnedSpells, source: "pinned", rolePending }
	}
	return { pair: [FLASH, second ?? IGNITE], source: "heuristic", rolePending }
}
