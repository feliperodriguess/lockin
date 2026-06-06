import { describe, expect, it } from "vitest"

import type { MatchupNote } from "@/shared/types"

import { matchNotes } from "./notes-match"

const note = (over: Partial<MatchupNote>): MatchupNote => ({
	id: "n-test",
	championId: 266,
	opponentChampionId: null,
	body: "",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	...over,
})

describe("matchNotes (PRD §6.2)", () => {
	it("returns general notes for my champion", () => {
		const general = note({ id: "a" })
		expect(matchNotes([general], 266, [])).toEqual([general])
	})

	it("excludes notes for other champions", () => {
		expect(matchNotes([note({ championId: 122 })], 266, [122])).toEqual([])
	})

	it("includes opponent-specific notes only when that enemy is visible", () => {
		const vsFiora = note({ id: "b", opponentChampionId: 114 })
		expect(matchNotes([vsFiora], 266, [114, 157])).toEqual([vsFiora])
		expect(matchNotes([vsFiora], 266, [157])).toEqual([])
		expect(matchNotes([vsFiora], 266, [])).toEqual([]) // enemy hidden → general only
	})

	it("sorts multiple matches most-recently-updated first", () => {
		const older = note({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" })
		const newer = note({ id: "new", updatedAt: "2026-02-01T00:00:00.000Z" })
		expect(matchNotes([older, newer], 266, [])).toEqual([newer, older])
	})

	it("returns nothing while my champion is unknown (id 0)", () => {
		expect(matchNotes([note({})], 0, [114])).toEqual([])
	})

	it("keeps a stable, defined order for equal updatedAt", () => {
		const a = note({ id: "a" })
		const b = note({ id: "b" })
		expect(matchNotes([a, b], 266, []).map((n) => n.id)).toEqual(["a", "b"])
	})

	it("matches an opponent-specific note even when the opponent is my own champion", () => {
		const mirror = note({ id: "m", opponentChampionId: 266 })
		expect(matchNotes([mirror], 266, [266])).toEqual([mirror]) // mirror matchup
	})

	it("does not mutate the input array", () => {
		const notes = [
			note({ id: "1", updatedAt: "2026-02-01T00:00:00.000Z" }),
			note({ id: "2", updatedAt: "2026-03-01T00:00:00.000Z" }),
		]
		matchNotes(notes, 266, [])
		expect(notes.map((n) => n.id)).toEqual(["1", "2"])
	})
})
