import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { normalizeOpgg, skillPriorityFrom } from "./opgg-normalize"
import type { OpggNode } from "./opgg-parse"
import { parseOpggText } from "./opgg-parse"

/* A hand-built minimal decoded tree mirroring OP.GG's class shape. */
function syntheticRoot(): OpggNode {
	const itemGroup = (ids: number[], win: number, pick: number): OpggNode => ({
		__class: "ItemGroup",
		ids,
		ids_names: ids.map(String),
		play: 100,
		win,
		pick_rate: pick,
	})
	return {
		__class: "Data",
		summary: {
			__class: "Summary",
			average_stats: {
				__class: "Stats",
				win_rate: 0.62,
				pick_rate: 0.08,
				ban_rate: 0.12,
				play: 3456,
				tier: "1",
				rank: 3,
			},
		},
		runes: {
			__class: "Runes",
			primary_page_id: 8000,
			primary_rune_ids: [8010, 9111, 9104, 8014],
			secondary_page_id: 8400,
			secondary_rune_ids: [8444, 8451],
			stat_mod_ids: [5005, 5008, 5001],
			primary_page_name: "Precision",
			secondary_page_name: "Resolve",
			play: 1000,
			win: 0.61,
			pick_rate: 0.5,
		},
		summoner_spells: { __class: "Spells", ids: [4, 12], win: 0.6, pick_rate: 0.9 },
		starter_items: itemGroup([1054, 2003], 60, 0.7),
		boots: itemGroup([3047], 62, 0.8),
		core_items: itemGroup([6630, 3071, 6333], 63, 0.5),
		fourth_items: itemGroup([3065, 3742], 60, 0.3),
		fifth_items: itemGroup([3742, 3193], 59, 0.2), // 3742 duplicates fourth
		sixth_items: itemGroup([3026], 58, 0.1),
		skills: {
			__class: "Skills",
			order: [
				"Q",
				"W",
				"E",
				"Q",
				"Q",
				"R",
				"Q",
				"W",
				"Q",
				"W",
				"R",
				"W",
				"W",
				"E",
				"E",
				"R",
				"E",
				"E",
			],
			play: 900,
			win: 0.6,
			pick_rate: 0.4,
		},
	}
}

describe("skillPriorityFrom", () => {
	it("ranks Q/W/E by count desc, ties broken by earliest appearance", () => {
		// Q/W/E all x5 → tie broken by earliest appearance: Q@0, W@1, E@2
		const order = [
			"Q",
			"W",
			"E",
			"Q",
			"Q",
			"R",
			"Q",
			"W",
			"Q",
			"W",
			"R",
			"W",
			"W",
			"E",
			"E",
			"R",
			"E",
			"E",
		] as const
		expect(skillPriorityFrom([...order])).toEqual(["Q", "W", "E"])
	})
})

describe("normalizeOpgg (synthetic)", () => {
	const build = normalizeOpgg(syntheticRoot(), { championKey: 266, role: "top", patch: "15.1.1" })

	it("maps identity, stats, and tier-driven labels", () => {
		expect(build).not.toBeNull()
		expect(build?.championKey).toBe(266)
		expect(build?.role).toBe("top")
		expect(build?.patch).toBe("15.1.1")
		expect(build?.winRate).toBe(0.62)
		expect(build?.sampleSize).toBe(3456)
	})

	it("assembles 9 perk ids in LCU order", () => {
		expect(build?.runes?.selectedPerkIds).toEqual([
			8010, 9111, 9104, 8014, 8444, 8451, 5005, 5008, 5001,
		])
		expect(build?.runes?.primaryStyleId).toBe(8000)
		expect(build?.runes?.subStyleId).toBe(8400)
		expect(build?.runes?.primaryName).toBe("Precision")
		expect(build?.runes?.secondaryName).toBe("Resolve")
	})

	it("maps spells to the first two ids", () => {
		expect(build?.spells).toEqual([4, 12])
	})

	it("maps item groups and keeps per-slot options with their stats", () => {
		expect(build?.items.starter.ids).toEqual([1054, 2003])
		expect(build?.items.boots.ids).toEqual([3047])
		expect(build?.items.core.ids).toEqual([6630, 3071, 6333])
		expect(build?.items.fourth.map((o) => o.id)).toEqual([3065, 3742])
		expect(build?.items.fifth.map((o) => o.id)).toEqual([3742, 3193]) // slots keep their own options
		expect(build?.items.sixth.map((o) => o.id)).toEqual([3026])
		// winRate is derived from counts (win/play) into the 0..1 contract
		expect(build?.items.starter.winRate).toBeCloseTo(0.6)
		expect(build?.items.core.winRate).toBeCloseTo(0.63)
		expect(build?.items.fourth[0]?.winRate).toBeCloseTo(0.6)
	})

	it("keeps skill order (18) and derives priority", () => {
		expect(build?.skillOrder).toHaveLength(18)
		expect(build?.skillPriority).toEqual(["Q", "W", "E"])
	})
})

describe("normalizeOpgg (real fixture invariants)", () => {
	const text = readFileSync(join(__dirname, "__fixtures__", "aatrox-top.txt"), "utf8")
	const root = parseOpggText(text) as OpggNode
	const build = normalizeOpgg(root, { championKey: 266, role: "top", patch: "0.0.0" })

	it("produces a structurally valid BuildRecommendation", () => {
		expect(build).not.toBeNull()
		expect(build?.runes?.selectedPerkIds).toHaveLength(9)
		expect(build?.spells).not.toBeNull()
		expect(build?.spells?.length).toBe(2)
		expect(build?.skillOrder).toHaveLength(18)
		expect(build?.skillPriority.length).toBeGreaterThanOrEqual(1)
		expect(build?.items.starter.ids.length).toBeGreaterThan(0)
		expect(build?.items.core.ids.length).toBeGreaterThan(0)
		expect(build?.items.fourth.length).toBeGreaterThan(0)
		expect(build?.items.fifth.length).toBeGreaterThan(0)
		expect(build?.items.sixth.length).toBeGreaterThan(0)
		expect(build?.winRate).toBeGreaterThan(0)
		expect(build?.winRate).toBeLessThanOrEqual(1)
		expect(build?.sampleSize).toBeGreaterThan(0)
	})

	it("every skillOrder entry is one of Q/W/E/R", () => {
		for (const s of build?.skillOrder ?? []) {
			expect(["Q", "W", "E", "R"]).toContain(s)
		}
	})
})
