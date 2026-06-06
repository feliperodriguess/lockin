import type { MatchupNote } from "@/shared/types"

/**
 * Matchup-note surfacing (PRD §6.2): notes for the champion I am playing,
 * where general notes (no opponent) always match and opponent-specific notes
 * match only while that enemy champion is visible. Most-recently-updated first.
 * Pure + deterministic (design §4).
 */
export function matchNotes(
	notes: readonly MatchupNote[],
	myChampionId: number,
	enemyChampionIds: readonly number[],
): MatchupNote[] {
	if (myChampionId <= 0) return []
	return notes
		.filter(
			(n) =>
				n.championId === myChampionId &&
				(n.opponentChampionId == null || enemyChampionIds.includes(n.opponentChampionId)),
		)
		.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
