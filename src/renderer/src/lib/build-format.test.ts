import { describe, expect, it } from "vitest"

import { formatGames, formatWinRate, winSampleLabel } from "./build-format"

describe("formatWinRate", () => {
	it("renders a 0..1 fraction as a whole-ish percent", () => {
		expect(formatWinRate(0.6234)).toBe("62%")
		expect(formatWinRate(0.5)).toBe("50%")
		expect(formatWinRate(0)).toBe("0%")
	})
})

describe("formatGames", () => {
	it("abbreviates thousands", () => {
		expect(formatGames(842)).toBe("842")
		expect(formatGames(1240)).toBe("1.2k")
		expect(formatGames(12_400)).toBe("12.4k")
		expect(formatGames(1_000_000)).toBe("1.0M")
	})
})

describe("winSampleLabel", () => {
	it("combines win% and games", () => {
		expect(winSampleLabel(0.62, 12_400)).toBe("62% · 12.4k games")
	})
})
