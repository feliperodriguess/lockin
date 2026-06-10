import { describe, expect, it } from "vitest"

import { parseOpggText } from "./opgg-parse"

describe("parseOpggText", () => {
	it("parses a flat class with mixed scalar fields", () => {
		const text = ["class Stats: win_rate,play,tier,ranked", 'Stats(0.62, 1234, "S", true)'].join(
			"\n",
		)
		const root = parseOpggText(text)
		expect(root).toEqual({
			__class: "Stats",
			win_rate: 0.62,
			play: 1234,
			tier: "S",
			ranked: true,
		})
	})

	it("parses nested classes by their own header field order", () => {
		const text = [
			"class Root: name,stats",
			"class Stats: win,play",
			'Root("Aatrox", Stats(0.51, 900))',
		].join("\n")
		expect(parseOpggText(text)).toEqual({
			__class: "Root",
			name: "Aatrox",
			stats: { __class: "Stats", win: 0.51, play: 900 },
		})
	})

	it("parses arrays of scalars and arrays of classes", () => {
		const text = [
			"class Root: ids,groups",
			"class Group: ids,win",
			"Root([3157, 6655], [Group([1001, 3047], 0.5), Group([3158], 0.6)])",
		].join("\n")
		expect(parseOpggText(text)).toEqual({
			__class: "Root",
			ids: [3157, 6655],
			groups: [
				{ __class: "Group", ids: [1001, 3047], win: 0.5 },
				{ __class: "Group", ids: [3158], win: 0.6 },
			],
		})
	})

	it("handles null, negatives, decimals, and empty arrays", () => {
		const text = ["class Root: a,b,c,d", "Root(null, -3, 0.0, [])"].join("\n")
		expect(parseOpggText(text)).toEqual({
			__class: "Root",
			a: null,
			b: -3,
			c: 0,
			d: [],
		})
	})

	it("handles quoted strings containing commas, parens, and escaped quotes", () => {
		const text = ["class Root: a,b", 'Root("hi, (there)", "she said \\"go\\"")'].join("\n")
		expect(parseOpggText(text)).toEqual({
			__class: "Root",
			a: "hi, (there)",
			b: 'she said "go"',
		})
	})

	it("zips by declared header order even when a field appears reordered", () => {
		// the SAME constructor, two different declared orders → different mapping.
		const a = parseOpggText(["class R: x,y", "R(1, 2)"].join("\n"))
		const b = parseOpggText(["class R: y,x", "R(1, 2)"].join("\n"))
		expect(a).toEqual({ __class: "R", x: 1, y: 2 })
		expect(b).toEqual({ __class: "R", y: 1, x: 2 })
	})

	it("tolerates extra trailing constructor args (unknown new fields) by ignoring them", () => {
		const text = ["class R: a", 'R(1, "future_field", 99)'].join("\n")
		expect(parseOpggText(text)).toEqual({ __class: "R", a: 1 })
	})

	it("leaves declared-but-missing trailing fields undefined", () => {
		const root = parseOpggText(["class R: a,b,c", "R(1)"].join("\n")) as Record<string, unknown>
		expect(root.a).toBe(1)
		expect("b" in root).toBe(false)
		expect("c" in root).toBe(false)
	})

	it("returns null on malformed input rather than throwing", () => {
		expect(parseOpggText("not a real payload")).toBe(null)
		expect(parseOpggText("class R: a\nR(")).toBe(null)
		expect(parseOpggText("")).toBe(null)
	})
})
