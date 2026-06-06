import { describe, expect, it } from "vitest"

import type { BanListEntry, ChampSelectSession } from "@/shared/types"

import { suggestBans } from "./bans"

const entry = (championId: number, priority: number, reason?: string): BanListEntry => ({
	championId,
	priority,
	reason,
})

const session = (over?: Partial<ChampSelectSession>): ChampSelectSession => ({
	actions: [],
	bans: { myTeamBans: [], theirTeamBans: [], numBans: 10 },
	localPlayerCellId: 0,
	myTeam: [],
	theirTeam: [],
	timer: { adjustedTimeLeftInPhase: 0, totalTimeInPhase: 0, phase: "BAN_PICK", isInfinite: false },
	...over,
})

const player = (championId: number, over?: Record<string, unknown>) => ({
	cellId: 5,
	championId,
	championPickIntent: 0,
	assignedPosition: "",
	summonerId: 0,
	puuid: "",
	spell1Id: 0,
	spell2Id: 0,
	team: 2,
	...over,
})

describe("suggestBans (PRD §6.3)", () => {
	it("orders by priority and keeps available champs open", () => {
		const out = suggestBans([entry(122, 2), entry(114, 1)], session())
		expect(out.entries.map((e) => e.entry.championId)).toEqual([114, 122])
		expect(out.entries.every((e) => e.status === "open" && !e.threat)).toBe(true)
		expect(out.allGone).toBe(false)
	})

	it("marks champs banned by either team", () => {
		const s = session({ bans: { myTeamBans: [114], theirTeamBans: [122], numBans: 10 } })
		const out = suggestBans([entry(114, 1), entry(122, 2), entry(164, 3)], s)
		expect(out.entries.map((e) => e.status)).toEqual(["banned", "banned", "open"])
	})

	it("treats completed ban actions as banned even before session.bans catches up", () => {
		const s = session({
			actions: [
				[
					{
						actorCellId: 5,
						championId: 114,
						completed: true,
						id: 1,
						isAllyAction: false,
						isInProgress: false,
						pickTurn: 1,
						type: "ban",
					},
				],
			],
		})
		expect(suggestBans([entry(114, 1)], s).entries[0]?.status).toBe("banned")
	})

	it("marks picked champs from both teams", () => {
		const s = session({
			myTeam: [player(157, { team: 1 })],
			theirTeam: [player(114)],
		})
		const out = suggestBans([entry(114, 1), entry(157, 2)], s)
		expect(out.entries.map((e) => e.status)).toEqual(["picked", "picked"])
	})

	it("lifts visible enemy threats (pick or hover) to the top with a badge", () => {
		const s = session({ theirTeam: [player(133), player(0, { championPickIntent: 157 })] })
		const out = suggestBans([entry(114, 1), entry(157, 2), entry(133, 3)], s)
		expect(out.entries.map((e) => e.entry.championId)).toEqual([157, 133, 114])
		expect(out.entries.map((e) => e.threat)).toEqual([true, true, false])
	})

	it("threat lift is stable within groups (priority preserved)", () => {
		const s = session({ theirTeam: [player(133), player(157)] })
		const out = suggestBans([entry(157, 1), entry(114, 2), entry(133, 3)], s)
		expect(out.entries.map((e) => e.entry.championId)).toEqual([157, 133, 114])
	})

	it("allGone only when a non-empty list is fully banned/picked", () => {
		const s = session({ bans: { myTeamBans: [114, 122], theirTeamBans: [], numBans: 10 } })
		expect(suggestBans([entry(114, 1), entry(122, 2)], s).allGone).toBe(true)
		expect(suggestBans([], s).allGone).toBe(false) // empty list → build-one prompt, not allGone
	})

	it("a banned threat stays marked banned, not open", () => {
		const s = session({
			bans: { myTeamBans: [114], theirTeamBans: [], numBans: 10 },
			theirTeam: [player(114)],
		})
		const out = suggestBans([entry(114, 1)], s)
		expect(out.entries[0]?.status).toBe("banned")
		expect(out.entries[0]?.threat).toBe(true)
	})
})
