import { describe, expect, it } from "vitest"

import { positionFromRole, roleFromPosition } from "./position"

describe("positionFromRole", () => {
	it("maps every Role to the OP.GG enum spelling", () => {
		expect(positionFromRole("top")).toBe("TOP")
		expect(positionFromRole("jungle")).toBe("JUNGLE")
		expect(positionFromRole("middle")).toBe("MID")
		expect(positionFromRole("bottom")).toBe("ADC")
		expect(positionFromRole("utility")).toBe("SUPPORT")
	})
})

describe("roleFromPosition", () => {
	it("round-trips back from the OP.GG enum", () => {
		expect(roleFromPosition("TOP")).toBe("top")
		expect(roleFromPosition("JUNGLE")).toBe("jungle")
		expect(roleFromPosition("MID")).toBe("middle")
		expect(roleFromPosition("ADC")).toBe("bottom")
		expect(roleFromPosition("SUPPORT")).toBe("utility")
	})

	it("accepts the renderer's freeform position strings (LCU assignedPosition)", () => {
		// the getBuild ipc receives a `position: string` (e.g. LCU "middle")
		expect(roleFromPosition("middle")).toBe("middle")
		expect(roleFromPosition("MIDDLE")).toBe("middle")
		expect(roleFromPosition("bot")).toBe("bottom")
		expect(roleFromPosition("support")).toBe("utility")
		expect(roleFromPosition("")).toBe(null)
		expect(roleFromPosition("nonsense")).toBe(null)
	})
})
