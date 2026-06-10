import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { normalizeOpggCounters } from "./opgg-counters-normalize"
import { parseOpggText } from "./opgg-parse"

const META = { championKey: 17, role: "top" as const, patch: "15.11" }

function fixture(name: string): string {
	return readFileSync(join(__dirname, "__fixtures__", name), "utf8")
}

describe("normalizeOpggCounters", () => {
	it("normalizes a field-selected counters response", () => {
		const table = normalizeOpggCounters(parseOpggText(fixture("teemo-top-counters.txt")), META)
		expect(table).not.toBeNull()
		expect(table?.championKey).toBe(17)
		expect(table?.role).toBe("top")
		expect(table?.patch).toBe("15.11")
		expect(table?.weakAgainst.map((e) => e.championId)).toEqual([14, 266, 86])
		expect(table?.strongAgainst.map((e) => e.championId)).toEqual([67, 41])
	})

	it("PINS the win-rate perspective: winRate = owner's win/play, NOT OP.GG's win_rate", () => {
		const table = normalizeOpggCounters(parseOpggText(fixture("teemo-top-counters.txt")), META)
		// weak_counters: Sion(play 149, win 62, advertised win_rate 0.58 = SION's rate).
		// Ours must be Teemo's: 62/149 ≈ 0.416, i.e. ≈ 1 − 0.58.
		const sion = table?.weakAgainst.find((e) => e.championId === 14)
		expect(sion?.winRate).toBeCloseTo(62 / 149, 5)
		expect(sion?.games).toBe(149)
		// strong_counters: Vayne(101, 62, 0.61) — owner's rate matches win/play here too.
		const vayne = table?.strongAgainst.find((e) => e.championId === 67)
		expect(vayne?.winRate).toBeCloseTo(62 / 101, 5)
	})

	it("sorts weakAgainst ascending (worst first) and strongAgainst descending (best first)", () => {
		const table = normalizeOpggCounters(parseOpggText(fixture("teemo-top-counters.txt")), META)
		const weak = table?.weakAgainst.map((e) => e.winRate) ?? []
		const strong = table?.strongAgainst.map((e) => e.winRate) ?? []
		expect(weak).toEqual([...weak].sort((a, b) => a - b))
		expect(strong).toEqual([...strong].sort((a, b) => b - a))
	})

	it("also extracts counters from a FULL analysis response (build payload)", () => {
		const meta = { championKey: 266, role: "top" as const, patch: "15.11" }
		const table = normalizeOpggCounters(parseOpggText(fixture("aatrox-top.txt")), meta)
		expect(table).not.toBeNull()
		expect(table?.strongAgainst.length).toBeGreaterThan(0)
		expect(table?.weakAgainst.length).toBeGreaterThan(0)
		// K'Sante (897) leads Aatrox's weak list: 65/140
		const ksante = table?.weakAgainst.find((e) => e.championId === 897)
		expect(ksante?.winRate).toBeCloseTo(65 / 140, 5)
	})

	it("returns null on junk, and skips zero-play or zero-id entries", () => {
		expect(normalizeOpggCounters(parseOpggText(""), META)).toBeNull()
		expect(normalizeOpggCounters(null, META)).toBeNull()
		expect(normalizeOpggCounters("not a node", META)).toBeNull()
		const empty = normalizeOpggCounters(
			parseOpggText(
				'class Root: data\nclass Data: strong_counters,weak_counters\nclass StrongCounter: champion_id,champion_name,play,win,win_rate\nRoot(Data([StrongCounter(0,"x",10,5,0.5),StrongCounter(5,"y",0,0,0.5)],[]))',
			),
			META,
		)
		expect(empty).toBeNull() // every entry filtered out → no table
	})
})
