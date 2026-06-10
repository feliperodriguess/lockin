import { describe, expect, it } from "vitest"

import type { ChampSelectSession } from "@/shared/types"

import { asRole, CHAMPION_LANE, championLaneRole, findLaneOpponent } from "./lanes"

const player = (over: Record<string, unknown>) => ({
	cellId: 0,
	championId: 0,
	championPickIntent: 0,
	assignedPosition: "",
	summonerId: 0,
	puuid: "",
	spell1Id: 0,
	spell2Id: 0,
	team: 2,
	...over,
})

const session = (over?: Partial<ChampSelectSession>): ChampSelectSession => ({
	actions: [],
	bans: { myTeamBans: [], theirTeamBans: [], numBans: 10 },
	localPlayerCellId: 2,
	myTeam: [player({ cellId: 2, championId: 266, assignedPosition: "top", team: 1 })],
	theirTeam: [],
	timer: { adjustedTimeLeftInPhase: 0, totalTimeInPhase: 0, phase: "BAN_PICK", isInfinite: false },
	...over,
})

/** id lookup over a tiny static catalog */
const idOf = (key: number): string | null =>
	({ 266: "Aatrox", 114: "Fiora", 157: "Yasuo", 64: "LeeSin" })[key] ?? null

describe("CHAMPION_LANE (moved from renderer)", () => {
	it("kept every entry through the Role-value conversion", () => {
		expect(Object.keys(CHAMPION_LANE)).toHaveLength(170)
	})
	it("spot-checks each role value", () => {
		expect(championLaneRole("Aatrox")).toBe("top")
		expect(championLaneRole("LeeSin")).toBe("jungle")
		expect(championLaneRole("Ahri")).toBe("middle")
		expect(championLaneRole("Jinx")).toBe("bottom")
		expect(championLaneRole("Thresh")).toBe("utility")
		expect(championLaneRole("NotAChampion")).toBeNull()
	})
})

describe("asRole", () => {
	it("accepts exactly the five LCU position strings", () => {
		expect(asRole("top")).toBe("top")
		expect(asRole("utility")).toBe("utility")
		expect(asRole("")).toBeNull()
		expect(asRole("TOP")).toBeNull()
	})
})

describe("findLaneOpponent", () => {
	it("matches by the enemy's assignedPosition when present", () => {
		const s = session({
			theirTeam: [player({ cellId: 5, championId: 157, assignedPosition: "top" })],
		})
		expect(findLaneOpponent(s, idOf)).toEqual({
			assignedPosition: "top",
			opponentChampionId: 157,
		})
	})

	it("falls back to the champion's default lane when position is hidden", () => {
		const s = session({
			theirTeam: [
				player({ cellId: 5, championId: 64 }), // LeeSin → jungle, not my lane
				player({ cellId: 6, championId: 114 }), // Fiora → top, my lane
			],
		})
		expect(findLaneOpponent(s, idOf).opponentChampionId).toBe(114)
	})

	it("ignores hidden enemies and returns null without a confident match", () => {
		const s = session({ theirTeam: [player({ cellId: 5, championId: 0 })] })
		expect(findLaneOpponent(s, idOf).opponentChampionId).toBeNull()
	})

	it("returns null opponent when my role is unassigned", () => {
		const s = session({
			myTeam: [player({ cellId: 2, championId: 266, team: 1 })],
			theirTeam: [player({ cellId: 5, championId: 114, assignedPosition: "top" })],
		})
		expect(findLaneOpponent(s, idOf)).toEqual({ assignedPosition: "", opponentChampionId: null })
	})
})
