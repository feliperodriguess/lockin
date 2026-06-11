import { describe, expect, it } from "vitest"

import { mergeRoster, resolveRankedPreferences, toInGameTeams } from "./lcu-mappers"

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

describe("toInGameTeams", () => {
	const session = {
		gameData: {
			playerChampionSelections: [
				{ championId: 266, spell1Id: 4, spell2Id: 12, puuid: "p-me" },
				{ championId: 64, spell1Id: 4, spell2Id: 11, puuid: "p-ally" },
				{ championId: 114, spell1Id: 4, spell2Id: 12, puuid: "p-enemy" },
			],
			teamOne: [{ puuid: "p-enemy", summonerId: 9, summonerName: "riposte enjoyer" }],
			teamTwo: [
				{ puuid: "p-me", summonerId: 1, summonerName: "me", selectedPosition: "TOP" },
				{ puuid: "p-ally", summonerId: 2, summonerName: "ally jg" },
			],
		},
	}

	it("splits sides by the local puuid and joins champion picks", () => {
		const { myTeam, theirTeam } = toInGameTeams(session, "p-me")
		expect(myTeam.map((p) => p.puuid)).toEqual(["p-me", "p-ally"])
		expect(myTeam[0]?.championId).toBe(266)
		expect(myTeam[0]?.assignedPosition).toBe("top")
		expect(myTeam[1]?.championId).toBe(64)
		expect(theirTeam.map((p) => p.gameName)).toEqual(["riposte enjoyer"])
		expect(theirTeam[0]?.championId).toBe(114)
	})

	it("defaults to teamOne as mine when the local puuid is unknown", () => {
		const { myTeam } = toInGameTeams(session, "")
		expect(myTeam.map((p) => p.puuid)).toEqual(["p-enemy"])
	})
})

describe("mergeRoster", () => {
	const player = (over: Record<string, unknown>) => ({
		cellId: 0,
		championId: 0,
		championPickIntent: 0,
		assignedPosition: "",
		summonerId: 0,
		puuid: "",
		gameName: undefined as string | undefined,
		spell1Id: 0,
		spell2Id: 0,
		team: 1,
		...over,
	})

	it("fills missing positions from the carry-over by puuid, then champion", () => {
		const fromSession = [
			player({ puuid: "p-me", championId: 266, gameName: "me" }),
			player({ puuid: "p-enemy", championId: 114, gameName: "riposte enjoyer" }),
		]
		const fromCarry = [
			player({ puuid: "p-me", championId: 266, assignedPosition: "top" }),
			player({ puuid: "", championId: 114, assignedPosition: "top" }),
		]
		const merged = mergeRoster(fromSession, fromCarry)
		expect(merged[0]?.assignedPosition).toBe("top")
		expect(merged[1]?.assignedPosition).toBe("top")
		expect(merged[1]?.gameName).toBe("riposte enjoyer") // session identity wins
	})

	it("falls back to the carry-over roster when the session gave none", () => {
		const carry = [player({ puuid: "p-me", championId: 266 })]
		expect(mergeRoster([], carry)).toEqual(carry)
	})
})
