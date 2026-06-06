import { describe, expect, it } from "vitest"

import type { RankInfo } from "@/shared/types"

import { flagMismatch, isApexTier, rankScore, rankSpread } from "./rank"

const rank = (tier: string, division = "I", lp = 0): RankInfo => ({
	tier,
	division,
	lp,
	queueType: "RANKED_SOLO_5x5",
})

describe("rankScore (§6.5 ordinal scoring)", () => {
	it("scores IRON IV as 0 and CHALLENGER as 39", () => {
		expect(rankScore(rank("IRON", "IV"))).toBe(0)
		expect(rankScore(rank("CHALLENGER"))).toBe(39)
	})

	it("steps by division within a tier", () => {
		expect(rankScore(rank("GOLD", "IV"))).toBe(12)
		expect(rankScore(rank("GOLD", "I"))).toBe(15)
		expect(rankScore(rank("PLATINUM", "IV"))).toBe(16)
	})

	it("returns -1 for unranked/unknown", () => {
		expect(rankScore(null)).toBe(-1)
		expect(rankScore(rank("WOOD", "IV"))).toBe(-1)
	})

	it("normalizes apex divisions (MASTER NA == MASTER I)", () => {
		expect(rankScore(rank("MASTER", "NA"))).toBe(rankScore(rank("MASTER", "I")))
		expect(rankScore(rank("MASTER", "NA"))).toBeGreaterThan(rankScore(rank("DIAMOND", "I")))
		expect(rankScore(rank("GRANDMASTER", "IV"))).toBe(rankScore(rank("GRANDMASTER")))
	})

	it("scores EMERALD in the post-2023 ladder (between PLATINUM and DIAMOND)", () => {
		expect(rankScore(rank("EMERALD", "IV"))).toBe(20)
		expect(rankScore(rank("EMERALD", "IV"))).toBeGreaterThan(rankScore(rank("PLATINUM", "I")))
		expect(rankScore(rank("DIAMOND", "IV"))).toBeGreaterThan(rankScore(rank("EMERALD", "I")))
	})

	it("unknown division scores as the tier floor", () => {
		expect(rankScore(rank("GOLD", "weird"))).toBe(12)
	})
})

describe("rankSpread (§6.5 — unranked excluded)", () => {
	it("is max minus min over ranked players only", () => {
		expect(rankSpread([rank("GOLD", "IV"), rank("DIAMOND", "IV"), null])).toBe(12)
	})

	it("is 0 with fewer than two ranked players", () => {
		expect(rankSpread([rank("GOLD", "IV"), null, null])).toBe(0)
		expect(rankSpread([])).toBe(0)
	})
})

describe("flagMismatch", () => {
	const team = [rank("GOLD", "IV"), rank("DIAMOND", "IV")] // spread 12

	it("flags when spread meets/exceeds the threshold", () => {
		expect(flagMismatch(team, 12)).toBe(true)
		expect(flagMismatch(team, 8)).toBe(true)
		expect(flagMismatch(team, 13)).toBe(false)
	})

	it("never flags on a non-positive threshold (defensive)", () => {
		expect(flagMismatch(team, 0)).toBe(false)
	})
})

describe("isApexTier", () => {
	it("true for MASTER+, false below and for unknown", () => {
		expect(isApexTier("MASTER")).toBe(true)
		expect(isApexTier("GRANDMASTER")).toBe(true)
		expect(isApexTier("CHALLENGER")).toBe(true)
		expect(isApexTier("DIAMOND")).toBe(false)
		expect(isApexTier("")).toBe(false)
	})
})
