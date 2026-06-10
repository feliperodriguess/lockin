import { describe, expect, it } from "vitest"

import { type Ability, formatSkillOrder, SKILL_ABILITIES } from "./skill-order"

// A canonical Aatrox-style order: Q maxed first, then E, then W; R at 6/11/16.
const ORDER: Ability[] = [
	"Q",
	"W",
	"E",
	"Q",
	"Q",
	"R",
	"Q",
	"E",
	"Q",
	"E",
	"R",
	"E",
	"E",
	"W",
	"W",
	"R",
	"W",
	"W",
]

describe("SKILL_ABILITIES", () => {
	it("rows are Q, W, E, R in that order", () => {
		expect(SKILL_ABILITIES).toEqual(["Q", "W", "E", "R"])
	})
})

describe("formatSkillOrder", () => {
	it("returns one row per ability with 18 boolean cells", () => {
		const rows = formatSkillOrder(ORDER)
		expect(rows.map((r) => r.ability)).toEqual(["Q", "W", "E", "R"])
		for (const row of rows) expect(row.cells).toHaveLength(18)
	})

	it("marks the cell at each level for the leveled ability and the running count", () => {
		const rows = formatSkillOrder(ORDER)
		const q = rows.find((r) => r.ability === "Q")
		if (!q) throw new Error("Q row missing")
		// Q leveled at 1,4,5,7,9 (1-indexed) → cells[0,3,4,6,8]
		expect(q.cells[0]).toEqual({ active: true, point: 1 })
		expect(q.cells[3]).toEqual({ active: true, point: 2 })
		expect(q.cells[4]).toEqual({ active: true, point: 3 })
		expect(q.cells[6]).toEqual({ active: true, point: 4 })
		expect(q.cells[8]).toEqual({ active: true, point: 5 })
		expect(q.cells[1]).toEqual({ active: false, point: 0 })
	})

	it("places R at levels 6, 11, 16 (0-indexed 5, 10, 15)", () => {
		const rows = formatSkillOrder(ORDER)
		const r = rows.find((row) => row.ability === "R")
		if (!r) throw new Error("R row missing")
		expect(r.cells[5].active).toBe(true)
		expect(r.cells[10].active).toBe(true)
		expect(r.cells[15].active).toBe(true)
		const activeLevels = r.cells.flatMap((c, i) => (c.active ? [i + 1] : []))
		expect(activeLevels).toEqual([6, 11, 16])
	})

	it("is tolerant of short/empty input (pads to 18 cells, no actives)", () => {
		const rows = formatSkillOrder([])
		for (const row of rows) {
			expect(row.cells).toHaveLength(18)
			expect(row.cells.every((c) => !c.active)).toBe(true)
		}
	})
})
