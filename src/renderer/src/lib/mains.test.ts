import { describe, expect, it } from "vitest"

import { groupMainsByRole, MAIN_ROLE_ORDER } from "./mains"

describe("groupMainsByRole", () => {
	it("returns the five role buckets in display order", () => {
		const groups = groupMainsByRole([])
		expect(groups.map((g) => g.role)).toEqual(MAIN_ROLE_ORDER)
		expect(groups.every((g) => g.championIds.length === 0)).toBe(true)
	})

	it("buckets champions under their role preserving input order", () => {
		const groups = groupMainsByRole([
			{ championId: 266, role: "top" },
			{ championId: 122, role: "top" },
			{ championId: 64, role: "jungle" },
			{ championId: 103, role: "middle" },
		])
		const byRole = Object.fromEntries(groups.map((g) => [g.role, g.championIds]))
		expect(byRole.top).toEqual([266, 122])
		expect(byRole.jungle).toEqual([64])
		expect(byRole.middle).toEqual([103])
		expect(byRole.bottom).toEqual([])
		expect(byRole.utility).toEqual([])
	})

	it("reports total and emptiness", () => {
		expect(groupMainsByRole([]).every((g) => g.championIds.length === 0)).toBe(true)
		const groups = groupMainsByRole([{ championId: 266, role: "top" }])
		const total = groups.reduce((n, g) => n + g.championIds.length, 0)
		expect(total).toBe(1)
	})
})
