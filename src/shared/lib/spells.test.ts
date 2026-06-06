import { describe, expect, it } from "vitest"

import { FLASH, recommendSpells } from "./spells"

describe("recommendSpells (PRD §6.1)", () => {
	it.each([
		["jungle", 11], // Smite
		["top", 12], // Teleport
		["middle", 12], // Teleport
		["bottom", 7], // Heal
		["utility", 14], // Ignite
	])("role %s → Flash + spell %i", (role, second) => {
		expect(recommendSpells({ assignedPosition: role })).toEqual({
			pair: [FLASH, second],
			source: "heuristic",
			rolePending: false,
		})
	})

	it("empty/unknown role → Ignite + rolePending", () => {
		expect(recommendSpells({ assignedPosition: "" })).toEqual({
			pair: [FLASH, 14],
			source: "heuristic",
			rolePending: true,
		})
		expect(recommendSpells({ assignedPosition: "weird-future-role" })).toEqual({
			pair: [FLASH, 14],
			source: "heuristic",
			rolePending: true,
		})
	})

	it("pinned spells win verbatim and are labeled pinned", () => {
		expect(recommendSpells({ assignedPosition: "top", pinnedSpells: [6, 4] })).toEqual({
			pair: [6, 4],
			source: "pinned",
			rolePending: false,
		})
	})

	it("pinned wins even while the role is pending", () => {
		expect(recommendSpells({ assignedPosition: "", pinnedSpells: [4, 14] })).toEqual({
			pair: [4, 14],
			source: "pinned",
			rolePending: true,
		})
	})
})
