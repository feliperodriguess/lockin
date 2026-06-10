import { describe, expect, it } from "vitest"

import { resolveRankedPreferences } from "./lcu-mappers"

describe("resolveRankedPreferences", () => {
	it("passes through the default Fill/none", () => {
		expect(resolveRankedPreferences({ first: "FILL", second: "UNSELECTED" })).toEqual({
			firstPreference: "FILL",
			secondPreference: "UNSELECTED",
		})
	})

	it("forces second to UNSELECTED when first is FILL", () => {
		expect(resolveRankedPreferences({ first: "FILL", second: "TOP" })).toEqual({
			firstPreference: "FILL",
			secondPreference: "UNSELECTED",
		})
	})

	it("forces second to UNSELECTED when it duplicates a specific first", () => {
		expect(resolveRankedPreferences({ first: "MIDDLE", second: "MIDDLE" })).toEqual({
			firstPreference: "MIDDLE",
			secondPreference: "UNSELECTED",
		})
	})

	it("passes through a valid distinct pair", () => {
		expect(resolveRankedPreferences({ first: "MIDDLE", second: "TOP" })).toEqual({
			firstPreference: "MIDDLE",
			secondPreference: "TOP",
		})
	})
})
