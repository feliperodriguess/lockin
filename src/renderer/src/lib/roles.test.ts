import { describe, expect, it } from "vitest"

import { displayToRole, roleToDisplay, roleToPosition } from "./roles"

describe("roleToDisplay", () => {
	it("maps every lowercase Role to its DisplayRole", () => {
		expect(roleToDisplay("top")).toBe("Top")
		expect(roleToDisplay("jungle")).toBe("Jungle")
		expect(roleToDisplay("middle")).toBe("Mid")
		expect(roleToDisplay("bottom")).toBe("Bot")
		expect(roleToDisplay("utility")).toBe("Support")
	})
})

describe("displayToRole", () => {
	it("maps every DisplayRole back to its lowercase Role", () => {
		expect(displayToRole("Top")).toBe("top")
		expect(displayToRole("Jungle")).toBe("jungle")
		expect(displayToRole("Mid")).toBe("middle")
		expect(displayToRole("Bot")).toBe("bottom")
		expect(displayToRole("Support")).toBe("utility")
	})

	it("round-trips through roleToDisplay", () => {
		for (const r of ["top", "jungle", "middle", "bottom", "utility"] as const) {
			expect(displayToRole(roleToDisplay(r))).toBe(r)
		}
	})
})

describe("roleToPosition", () => {
	it("maps Role to the OP.GG position enum", () => {
		expect(roleToPosition("top")).toBe("TOP")
		expect(roleToPosition("jungle")).toBe("JUNGLE")
		expect(roleToPosition("middle")).toBe("MID")
		expect(roleToPosition("bottom")).toBe("ADC")
		expect(roleToPosition("utility")).toBe("SUPPORT")
	})
})
