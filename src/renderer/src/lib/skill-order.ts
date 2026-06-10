export type Ability = "Q" | "W" | "E" | "R"

/* grid row order, top to bottom */
export const SKILL_ABILITIES: Ability[] = ["Q", "W", "E", "R"]

export interface SkillCell {
	/** true when this ability is the one leveled at this level */
	active: boolean
	/** running count of points put into this ability through this level (0 when inactive) */
	point: number
}

export interface SkillRow {
	ability: Ability
	cells: SkillCell[]
}

/**
 * Turn a length-18 skillOrder (the ability leveled at each level 1..18) into
 * per-ability rows of 18 cells. Tolerant of short/over-long input: reads at most
 * 18 levels and pads the rest with inactive cells.
 */
export function formatSkillOrder(order: Ability[]): SkillRow[] {
	const counts: Record<Ability, number> = { Q: 0, W: 0, E: 0, R: 0 }
	return SKILL_ABILITIES.map((ability) => {
		const cells: SkillCell[] = []
		for (let level = 0; level < 18; level++) {
			const leveled = order[level]
			const active = leveled === ability
			if (active) counts[ability] += 1
			cells.push({ active, point: active ? counts[ability] : 0 })
		}
		// reset per-ability running counts so each row computes independently
		counts[ability] = 0
		return { ability, cells }
	})
}
