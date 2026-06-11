import { describe, expect, it } from "vitest"

import type { BanListEntry, ChampSelectSession, CounterEntry } from "@/shared/types"

import { goneChampionIds, statisticalBans, suggestBans } from "./bans"

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

const weak = (championId: number, winRate: number, games = 500): CounterEntry => ({
	championId,
	winRate,
	games,
})

describe("suggestBans with counter data", () => {
	it("attaches the flipped counter win rate to matching rows", () => {
		const out = suggestBans([entry(114, 1), entry(122, 2)], session(), [weak(114, 0.46)])
		expect(out.entries[0]?.counterWinRate).toBeCloseTo(0.54, 5)
		expect(out.entries[1]?.counterWinRate).toBeNull()
	})

	it("lifts counters above plain rows but below threats", () => {
		const s = session({ theirTeam: [player(133)] })
		const out = suggestBans([entry(114, 1), entry(157, 2), entry(133, 3)], s, [weak(157, 0.46)])
		expect(out.entries.map((e) => e.entry.championId)).toEqual([133, 157, 114])
	})

	it("omitting counter data keeps every row's counterWinRate null", () => {
		const out = suggestBans([entry(114, 1)], session())
		expect(out.entries[0]?.counterWinRate).toBeNull()
	})
})

describe("goneChampionIds", () => {
	it("returns union of bans (including completed ban actions) and picks from both teams, excluding hover-only intents", () => {
		const s = session({
			bans: { myTeamBans: [114], theirTeamBans: [], numBans: 10 },
			actions: [
				[
					{
						actorCellId: 1,
						championId: 122,
						completed: true,
						id: 1,
						isAllyAction: true,
						isInProgress: false,
						pickTurn: 1,
						type: "ban",
					},
				],
			],
			myTeam: [player(266, { team: 1 })],
			theirTeam: [
				player(157), // picked (championId > 0)
				player(0, { championPickIntent: 133 }), // hover only — NOT gone
			],
		})
		const gone = goneChampionIds(s)
		// banned by session.bans: 114
		expect(gone.has(114)).toBe(true)
		// banned by completed ban action: 122
		expect(gone.has(122)).toBe(true)
		// picked by my team: 266
		expect(gone.has(266)).toBe(true)
		// picked by their team: 157
		expect(gone.has(157)).toBe(true)
		// hover-only intent: NOT included
		expect(gone.has(133)).toBe(false)
	})
})

describe("statisticalBans", () => {
	const myWeak = [
		weak(114, 0.46),
		weak(122, 0.465),
		weak(164, 0.47),
		weak(875, 0.475),
		weak(86, 0.48),
		weak(36, 0.485),
	]

	it("suggests top counters not on the list, flipped to their win rate into me", () => {
		const out = statisticalBans(myWeak, [entry(114, 1), entry(122, 2)], session())
		expect(out.map((r) => r.championId)).toEqual([164, 875, 86])
		expect(out[0]?.winRate).toBeCloseTo(0.53, 5)
	})

	it("caps at 3 and excludes banned/picked champions", () => {
		const s = session({
			bans: { myTeamBans: [164], theirTeamBans: [], numBans: 10 },
			theirTeam: [player(875)],
		})
		const out = statisticalBans(myWeak, [], s)
		expect(out.map((r) => r.championId)).toEqual([114, 122, 86])
	})

	it("empty input → empty output", () => {
		expect(statisticalBans([], [entry(114, 1)], session())).toEqual([])
	})
})
