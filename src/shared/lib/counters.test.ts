import { describe, expect, it } from "vitest"

import type { CounterTable } from "@/shared/types"

import { counterPicks, matchupDifficulty } from "./counters"

const table = (
	championKey: number,
	weakAgainst: [number, number, number][],
	strongAgainst: [number, number, number][] = [],
): CounterTable => ({
	championKey,
	role: "top",
	patch: "15.11",
	weakAgainst: weakAgainst.map(([championId, winRate, games]) => ({ championId, winRate, games })),
	strongAgainst: strongAgainst.map(([championId, winRate, games]) => ({
		championId,
		winRate,
		games,
	})),
})

describe("matchupDifficulty", () => {
	it("reads my champ from the ENEMY's table and flips the perspective", () => {
		// I (266) appear in the enemy's weakAgainst at 0.42 (the ENEMY's rate) → mine is 0.58
		const enemy = table(114, [[266, 0.42, 800]])
		const d = matchupDifficulty(266, 114, enemy, null)
		expect(d?.level).toBe("easy")
		expect(d?.winRate).toBeCloseTo(0.58, 5)
		expect(d?.games).toBe(800)
		expect(d?.lowData).toBe(false)
	})

	it("falls back to MY table where the rate is already mine", () => {
		const mine = table(266, [[114, 0.46, 1200]])
		const d = matchupDifficulty(266, 114, null, mine)
		expect(d?.level).toBe("hard")
		expect(d?.winRate).toBeCloseTo(0.46, 5)
	})

	it("classifies at the documented boundaries (≥0.52 easy, <0.48 hard)", () => {
		const at = (wr: number) => matchupDifficulty(266, 114, null, table(266, [[114, wr, 500]]))
		expect(at(0.52)?.level).toBe("easy")
		expect(at(0.519)?.level).toBe("even")
		expect(at(0.48)?.level).toBe("even")
		expect(at(0.479)?.level).toBe("hard")
	})

	it("flags low data under 50 games", () => {
		const d = matchupDifficulty(266, 114, null, table(266, [[114, 0.55, 49]]))
		expect(d?.lowData).toBe(true)
		const ok = matchupDifficulty(266, 114, null, table(266, [[114, 0.55, 50]]))
		expect(ok?.lowData).toBe(false)
	})

	it("matchup absent from both available tables → even with null winRate", () => {
		const d = matchupDifficulty(266, 114, table(114, [[86, 0.4, 500]]), null)
		expect(d).toEqual({ level: "even", winRate: null, games: 0, lowData: false })
	})

	it("no tables at all → null (hide the pill)", () => {
		expect(matchupDifficulty(266, 114, null, null)).toBeNull()
	})

	it("also finds the matchup in strongAgainst lists", () => {
		// I appear in the enemy's strongAgainst at 0.56 (their rate) → mine 0.44 → hard
		const enemy = table(114, [], [[266, 0.56, 900]])
		expect(matchupDifficulty(266, 114, enemy, null)?.level).toBe("hard")
	})
})

describe("counterPicks", () => {
	const enemy = table(114, [
		[133, 0.44, 310],
		[58, 0.46, 1480],
		[86, 0.47, 1820],
		[875, 0.485, 960],
		[17, 0.49, 400],
		[36, 0.495, 350],
	])

	it("flips to display perspective and keeps best-counter-first order", () => {
		const picks = counterPicks(enemy, [])
		expect(picks?.best.map((p) => p.championId)).toEqual([133, 58, 86, 875, 17])
		expect(picks?.best[0]?.winRate).toBeCloseTo(0.56, 5)
	})

	it("intersects mains and dedupes them out of the best row", () => {
		const picks = counterPicks(enemy, [58, 875, 999])
		expect(picks?.yours.map((p) => p.championId)).toEqual([58, 875])
		expect(picks?.best.map((p) => p.championId)).toEqual([133, 86, 17, 36])
	})

	it("null table or empty weakAgainst → null", () => {
		expect(counterPicks(null, [58])).toBeNull()
		expect(counterPicks(table(114, []), [58])).toBeNull()
	})
})
