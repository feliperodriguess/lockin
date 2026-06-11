import type { BanListEntry, ChampSelectSession, CounterEntry } from "@/shared/types"

import { STAT_BANS_MAX } from "./counters"

/**
 * Session-aware ban suggestions (PRD §6.3): the personal ban list ordered by
 * priority, statuses derived from the live session (banned by either team —
 * including completed ban actions, which can lead session.bans — or already
 * picked), visible enemy threats (pick or hover intent) lifted to the top,
 * then statistical counters to my champion lifted next.
 * Pure + deterministic (design §4).
 */

export interface BanSuggestionRow {
	entry: BanListEntry
	status: "open" | "banned" | "picked"
	threat: boolean
	/** this champion's win rate INTO my champion (display perspective), when known */
	counterWinRate: number | null
}

export interface BanSuggestions {
	entries: BanSuggestionRow[]
	allGone: boolean
}

function bannedIds(session: ChampSelectSession): Set<number> {
	const banned = new Set([...session.bans.myTeamBans, ...session.bans.theirTeamBans])
	for (const action of session.actions.flat()) {
		if (action.type === "ban" && action.completed && action.championId > 0) {
			banned.add(action.championId)
		}
	}
	return banned
}

function pickedIds(session: ChampSelectSession): Set<number> {
	return new Set(
		[...session.myTeam, ...session.theirTeam].map((p) => p.championId).filter((id) => id > 0),
	)
}

/** Champions no longer pickable this session (banned by either team or already picked). */
export function goneChampionIds(session: ChampSelectSession): Set<number> {
	return new Set([...bannedIds(session), ...pickedIds(session)])
}

export function suggestBans(
	banlist: readonly BanListEntry[],
	session: ChampSelectSession,
	myWeakAgainst: readonly CounterEntry[] = [],
): BanSuggestions {
	const banned = bannedIds(session)
	const picked = pickedIds(session)
	const visibleEnemyIds = new Set(
		session.theirTeam.flatMap((p) => [p.championId, p.championPickIntent].filter((id) => id > 0)),
	)
	// entry.winRate is MY rate vs them → their rate into me is the flip
	const counterRate = new Map(myWeakAgainst.map((e) => [e.championId, 1 - e.winRate]))

	const entries: BanSuggestionRow[] = [...banlist]
		.sort((a, b) => a.priority - b.priority)
		.map((entry) => ({
			entry,
			status: banned.has(entry.championId)
				? ("banned" as const)
				: picked.has(entry.championId)
					? ("picked" as const)
					: ("open" as const),
			threat: visibleEnemyIds.has(entry.championId),
			counterWinRate: counterRate.get(entry.championId) ?? null,
		}))
		// stable: threats first, then statistical counters, priority kept within groups
		.sort(
			(a, b) =>
				Number(b.threat) - Number(a.threat) ||
				Number(b.counterWinRate != null) - Number(a.counterWinRate != null),
		)

	return {
		entries,
		allGone: entries.length > 0 && entries.every((e) => e.status !== "open"),
	}
}

export interface StatBanRow {
	championId: number
	/** their win rate INTO my champion (display perspective) */
	winRate: number
	games: number
}

/** Statistical counters to my champion that the user does NOT track — the
 *  "you didn't think to ban this" group. Excludes anything already banned or
 *  picked. Input is my weakAgainst (worst matchup first = strongest counter
 *  first), so order is preserved. */
export function statisticalBans(
	myWeakAgainst: readonly CounterEntry[],
	banlist: readonly BanListEntry[],
	session: ChampSelectSession,
): StatBanRow[] {
	const listed = new Set(banlist.map((b) => b.championId))
	const banned = bannedIds(session)
	const picked = pickedIds(session)
	return myWeakAgainst
		.filter(
			(e) => !listed.has(e.championId) && !banned.has(e.championId) && !picked.has(e.championId),
		)
		.slice(0, STAT_BANS_MAX)
		.map((e) => ({ championId: e.championId, winRate: 1 - e.winRate, games: e.games }))
}
