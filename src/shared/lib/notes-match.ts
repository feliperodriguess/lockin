import type { MatchupNote } from "@/shared/types"

/**
 * The single matchup note to surface in champ select (PRD §6.2, lane-aware):
 * prefer a note scoped to the resolved lane opponent; otherwise a general note
 * for the champion I'm playing. Off-lane opponent notes are intentionally NOT
 * surfaced here — the matchup is the lane opponent, so a note for some other
 * enemy never hijacks the panel. Most-recently-updated wins within each tier.
 * `opponentChampionId == null` means no lane opponent was confidently resolved
 * (role pending, enemy hidden, or no enemy maps to my lane) → general note only.
 * Pure + deterministic (design §4).
 */
export function matchupNote(
	notes: readonly MatchupNote[],
	myChampionId: number,
	opponentChampionId: number | null,
): MatchupNote | null {
	if (myChampionId <= 0) return null
	const mine = notes.filter((n) => n.championId === myChampionId)
	const newestFirst = (a: MatchupNote, b: MatchupNote): number =>
		b.updatedAt.localeCompare(a.updatedAt)
	const opponentNote =
		opponentChampionId != null
			? mine.filter((n) => n.opponentChampionId === opponentChampionId).sort(newestFirst)[0]
			: undefined
	const generalNote = mine.filter((n) => n.opponentChampionId == null).sort(newestFirst)[0]
	return opponentNote ?? generalNote ?? null
}
