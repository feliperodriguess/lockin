import type { CounterEntry, CounterTable } from "@/shared/types"

/** Matchups with fewer games than this render as "low data" (real per-matchup
 *  samples at a single tier+patch run ~100–150 games). */
export const LOW_DATA_GAMES = 50
export const EASY_WR = 0.52
export const HARD_WR = 0.48
export const BEST_OVERALL_MAX = 5
export const STAT_BANS_MAX = 3

export type DifficultyLevel = "easy" | "even" | "hard"

export interface MatchupDifficulty {
	level: DifficultyLevel
	/** my win rate vs the opponent, 0..1; null = tables exist but no matchup data */
	winRate: number | null
	games: number
	lowData: boolean
}

/** Difficulty of MY champion vs the enemy laner. `enemyTable` is the ENEMY
 *  champion's counter table (preferred — larger overlap), `myTable` is mine.
 *  Either may be null (fetch failed); both null → null (hide the pill). */
export function matchupDifficulty(
	myChampionKey: number,
	enemyChampionKey: number,
	enemyTable: CounterTable | null,
	myTable: CounterTable | null,
): MatchupDifficulty | null {
	if (!enemyTable && !myTable) return null
	// my champ in the ENEMY's lists: entry.winRate is the enemy's → mine is 1 − it
	const inEnemy = findEntry(enemyTable, myChampionKey)
	if (inEnemy) return classify(1 - inEnemy.winRate, inEnemy.games)
	// the enemy in MY lists: entry.winRate is already mine
	const inMine = findEntry(myTable, enemyChampionKey)
	if (inMine) return classify(inMine.winRate, inMine.games)
	return { level: "even", winRate: null, games: 0, lowData: false }
}

function findEntry(table: CounterTable | null, championKey: number): CounterEntry | null {
	if (!table) return null
	return (
		table.weakAgainst.find((e) => e.championId === championKey) ??
		table.strongAgainst.find((e) => e.championId === championKey) ??
		null
	)
}

function classify(winRate: number, games: number): MatchupDifficulty {
	const level: DifficultyLevel = winRate >= EASY_WR ? "easy" : winRate < HARD_WR ? "hard" : "even"
	return { level, winRate, games, lowData: games < LOW_DATA_GAMES }
}

export interface CounterPick {
	championId: number
	/** the counter pick's win rate INTO the enemy (display perspective), 0..1 */
	winRate: number
	games: number
}

export interface CounterPicksResult {
	/** my mains for the role that counter the enemy, best first */
	yours: CounterPick[]
	/** top global counters (mains deduped out), best first */
	best: CounterPick[]
}

/** Picks that beat the enemy, derived from the ENEMY's weakAgainst. Entry
 *  winRate is the enemy's rate, so flip it for display. weakAgainst arrives
 *  worst-for-the-enemy first, which is already best-counter-first for us. */
export function counterPicks(
	enemyTable: CounterTable | null,
	mainChampionIds: readonly number[],
): CounterPicksResult | null {
	if (!enemyTable || enemyTable.weakAgainst.length === 0) return null
	const all: CounterPick[] = enemyTable.weakAgainst.map((e) => ({
		championId: e.championId,
		winRate: 1 - e.winRate,
		games: e.games,
	}))
	const mains = new Set(mainChampionIds)
	return {
		yours: all.filter((p) => mains.has(p.championId)),
		best: all.filter((p) => !mains.has(p.championId)).slice(0, BEST_OVERALL_MAX),
	}
}
