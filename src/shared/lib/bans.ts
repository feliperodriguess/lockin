import type { BanListEntry, ChampSelectSession } from "@/shared/types"

/**
 * Session-aware ban suggestions (PRD §6.3): the personal ban list ordered by
 * priority, statuses derived from the live session (banned by either team —
 * including completed ban actions, which can lead session.bans — or already
 * picked), and visible enemy threats (pick or hover intent) lifted to the top.
 * Pure + deterministic (design §4).
 */

export interface BanSuggestionRow {
	entry: BanListEntry
	status: "open" | "banned" | "picked"
	threat: boolean
}

export interface BanSuggestions {
	entries: BanSuggestionRow[]
	allGone: boolean
}

export function suggestBans(
	banlist: readonly BanListEntry[],
	session: ChampSelectSession,
): BanSuggestions {
	const bannedIds = new Set([...session.bans.myTeamBans, ...session.bans.theirTeamBans])
	for (const action of session.actions.flat()) {
		if (action.type === "ban" && action.completed && action.championId > 0) {
			bannedIds.add(action.championId)
		}
	}
	const pickedIds = new Set(
		[...session.myTeam, ...session.theirTeam].map((p) => p.championId).filter((id) => id > 0),
	)
	const visibleEnemyIds = new Set(
		session.theirTeam.flatMap((p) => [p.championId, p.championPickIntent].filter((id) => id > 0)),
	)

	const entries: BanSuggestionRow[] = [...banlist]
		.sort((a, b) => a.priority - b.priority)
		.map((entry) => ({
			entry,
			status: bannedIds.has(entry.championId)
				? ("banned" as const)
				: pickedIds.has(entry.championId)
					? ("picked" as const)
					: ("open" as const),
			threat: visibleEnemyIds.has(entry.championId),
		}))
		.sort((a, b) => Number(b.threat) - Number(a.threat)) // stable: priority kept within groups

	return {
		entries,
		allGone: entries.length > 0 && entries.every((e) => e.status !== "open"),
	}
}
