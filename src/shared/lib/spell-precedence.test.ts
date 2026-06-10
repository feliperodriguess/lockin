import { describe, expect, it } from "vitest"

import { resolveSpells } from "./spell-precedence"
import { FLASH } from "./spells"

describe("resolveSpells (precedence: pinned > opgg > heuristic)", () => {
	it("pinned wins over both opgg and heuristic", () => {
		expect(
			resolveSpells({
				assignedPosition: "top",
				pinnedSpells: [FLASH, 12],
				opggSpells: [FLASH, 14],
			}),
		).toEqual({ pair: [FLASH, 12], source: "pinned", rolePending: false })
	})

	it("opgg wins over heuristic when no pin", () => {
		expect(
			resolveSpells({
				assignedPosition: "top",
				opggSpells: [FLASH, 14],
			}),
		).toEqual({ pair: [FLASH, 14], source: "opgg", rolePending: false })
	})

	it("falls back to the heuristic when no pin and no opgg", () => {
		expect(resolveSpells({ assignedPosition: "top" })).toEqual({
			pair: [FLASH, 12],
			source: "heuristic",
			rolePending: false,
		})
	})

	it("ignores a null opgg pair and uses the heuristic", () => {
		expect(resolveSpells({ assignedPosition: "bottom", opggSpells: null })).toEqual({
			pair: [FLASH, 7],
			source: "heuristic",
			rolePending: false,
		})
	})

	it("carries rolePending from the heuristic when the role is unknown", () => {
		expect(resolveSpells({ assignedPosition: "" })).toEqual({
			pair: [FLASH, 14],
			source: "heuristic",
			rolePending: true,
		})
	})

	it("opgg still applies while the role is pending (carries rolePending true)", () => {
		expect(
			resolveSpells({
				assignedPosition: "",
				opggSpells: [FLASH, 3],
			}),
		).toEqual({ pair: [FLASH, 3], source: "opgg", rolePending: true })
	})

	it("pinned applies while the role is pending", () => {
		expect(
			resolveSpells({
				assignedPosition: "",
				pinnedSpells: [4, 14],
			}),
		).toEqual({ pair: [4, 14], source: "pinned", rolePending: true })
	})
})
