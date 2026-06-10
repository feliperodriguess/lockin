import { describe, expect, it } from "vitest"

import type { MatchupNote } from "@/shared/types"

import { matchupNote } from "./notes-match"

const note = (over: Partial<MatchupNote>): MatchupNote => ({
	id: "n-test",
	championId: 266,
	opponentChampionId: null,
	body: "",
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
	...over,
})

describe("matchupNote (PRD §6.2, lane-aware)", () => {
	it("returns a general note for my champion", () => {
		const general = note({ id: "a" })
		expect(matchupNote([general], 266, null)).toEqual(general)
	})

	it("excludes notes for other champions", () => {
		expect(matchupNote([note({ championId: 122 })], 266, 122)).toBeNull()
	})

	it("prefers the lane-opponent note over a general one", () => {
		const general = note({ id: "g", updatedAt: "2026-05-01T00:00:00.000Z" }) // newer
		const vsFiora = note({
			id: "f",
			opponentChampionId: 114,
			updatedAt: "2026-01-01T00:00:00.000Z",
		})
		// opponent-specific wins even though the general note is more recent
		expect(matchupNote([general, vsFiora], 266, 114)).toEqual(vsFiora)
	})

	it("does NOT surface an off-lane opponent note (the original Yasuo/Smolder bug)", () => {
		const vsYasuo = note({
			id: "y",
			opponentChampionId: 157,
			updatedAt: "2026-05-01T00:00:00.000Z",
		})
		const vsSmolder = note({
			id: "s",
			opponentChampionId: 901,
			updatedAt: "2026-01-01T00:00:00.000Z",
		})
		// lane opponent is Smolder (901); the more-recent Yasuo note must not win
		expect(matchupNote([vsYasuo, vsSmolder], 266, 901)).toEqual(vsSmolder)
	})

	it("falls back to a general note when no lane-opponent note exists", () => {
		const general = note({ id: "g" })
		const vsYasuo = note({ id: "y", opponentChampionId: 157 })
		expect(matchupNote([general, vsYasuo], 266, 114)).toEqual(general)
	})

	it("surfaces only a general note when no lane opponent is resolved", () => {
		const general = note({ id: "g" })
		const vsFiora = note({ id: "f", opponentChampionId: 114 })
		// opponentChampionId null → opponent-specific notes are never surfaced
		expect(matchupNote([general, vsFiora], 266, null)).toEqual(general)
		expect(matchupNote([vsFiora], 266, null)).toBeNull()
	})

	it("picks the most-recent lane-opponent note when several exist", () => {
		const older = note({
			id: "old",
			opponentChampionId: 114,
			updatedAt: "2026-01-01T00:00:00.000Z",
		})
		const newer = note({
			id: "new",
			opponentChampionId: 114,
			updatedAt: "2026-02-01T00:00:00.000Z",
		})
		expect(matchupNote([older, newer], 266, 114)).toEqual(newer)
	})

	it("returns null while my champion is unknown (id 0)", () => {
		expect(matchupNote([note({})], 0, 114)).toBeNull()
	})

	it("matches a mirror matchup (opponent is my own champion)", () => {
		const mirror = note({ id: "m", opponentChampionId: 266 })
		expect(matchupNote([mirror], 266, 266)).toEqual(mirror)
	})

	it("does not mutate the input array", () => {
		const notes = [
			note({ id: "1", opponentChampionId: 114, updatedAt: "2026-02-01T00:00:00.000Z" }),
			note({ id: "2", opponentChampionId: 114, updatedAt: "2026-03-01T00:00:00.000Z" }),
		]
		matchupNote(notes, 266, 114)
		expect(notes.map((n) => n.id)).toEqual(["1", "2"])
	})
})
