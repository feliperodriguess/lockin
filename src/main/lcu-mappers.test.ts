import { describe, expect, it } from "vitest"

import { mergeRoster, resolveRankedPreferences, toInGameState, toInGameTeams } from "./lcu-mappers"

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

	it("orients sides from the champ select carry-over when the local puuid is unknown", () => {
		const carry = {
			localPlayerCellId: 0,
			myTeam: [player({ cellId: 0, puuid: "p-ally" })],
		}
		const { myTeam, theirTeam } = toInGameTeams(session, "", carry)
		expect(myTeam.map((p) => p.puuid)).toEqual(["p-me", "p-ally"])
		expect(theirTeam.map((p) => p.puuid)).toEqual(["p-enemy"])
	})
})

describe("toInGameState", () => {
	// the bug scenario: Senna happens to be first in playerChampionSelections,
	// the local player (Malphite) is second
	const session = {
		gameData: {
			queue: { id: 440 },
			playerChampionSelections: [
				{ championId: 235, spell1Id: 4, spell2Id: 7, puuid: "p-senna" },
				{ championId: 54, spell1Id: 4, spell2Id: 12, puuid: "p-me" },
			],
			teamOne: [
				{ puuid: "p-me", summonerId: 1, summonerName: "me" },
				{ puuid: "p-senna", summonerId: 2, summonerName: "senna" },
			],
			teamTwo: [],
		},
	}

	it("resolves the local selection by puuid", () => {
		const state = toInGameState(session, "p-me")
		expect(state?.championId).toBe(54)
		expect(state?.spell2Id).toBe(12)
		expect(state?.queueId).toBe(440)
	})

	it("never falls back to another player's selection when the local player is unknown", () => {
		expect(toInGameState(session, "")).toBeNull()
	})

	it("recovers the local pick from the champ select carry-over when the puuid never arrived", () => {
		const carry = {
			localPlayerCellId: 2,
			myTeam: [player({ cellId: 2, puuid: "p-me", championId: 54, spell1Id: 4, spell2Id: 12 })],
		}
		const state = toInGameState(session, "", carry)
		expect(state?.championId).toBe(54)
		expect(state?.spell2Id).toBe(12)
	})

	it("resolves via the gameflow roster when selections lack puuids", () => {
		const noPuuidSelections = {
			gameData: {
				queue: { id: 420 },
				playerChampionSelections: [
					{ championId: 235, spell1Id: 4, spell2Id: 7 },
					{ championId: 54, spell1Id: 4, spell2Id: 12 },
				],
				teamOne: [{ puuid: "p-me", championId: 54 }],
				teamTwo: [],
			},
		}
		expect(toInGameState(noPuuidSelections, "p-me")?.championId).toBe(54)
	})

	it("falls back to the carry-over pick when no selection is matchable", () => {
		const enemyOnly = {
			gameData: {
				playerChampionSelections: [{ championId: 235, spell1Id: 4, spell2Id: 7, puuid: "p-senna" }],
			},
		}
		const carry = {
			localPlayerCellId: 0,
			myTeam: [player({ cellId: 0, puuid: "p-me", championId: 54, spell1Id: 12, spell2Id: 4 })],
		}
		const state = toInGameState(enemyOnly, "p-me", carry)
		expect(state?.championId).toBe(54)
		expect(state?.spell1Id).toBe(12)
	})
})

describe("mergeRoster", () => {
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
