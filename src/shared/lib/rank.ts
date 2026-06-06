import type { RankInfo } from "@/shared/types"

/**
 * Rank scoring (PRD §6.5): tier+division → ordinal (IRON IV = 0 … CHALLENGER
 * = 39) so deltas are comparable. Unranked/unknown → -1 and excluded from the
 * spread. Apex tiers (MASTER+) have no real division — the LCU reports "I" or
 * "NA" — so they normalize to the tier's top step. Pure + deterministic.
 *
 * Supersedes the design §4 shorthand signatures: rankScore takes the whole
 * RankInfo (not tier+div), and the flag helper is singular `flagMismatch`.
 */

const TIER_ORDER = [
	"IRON",
	"BRONZE",
	"SILVER",
	"GOLD",
	"PLATINUM",
	"EMERALD",
	"DIAMOND",
	"MASTER",
	"GRANDMASTER",
	"CHALLENGER",
] as const

const APEX_START = TIER_ORDER.indexOf("MASTER")

const DIV_STEPS: Record<string, number> = { I: 3, II: 2, III: 1, IV: 0 }

export function isApexTier(tier: string): boolean {
	const idx = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number])
	return idx >= APEX_START
}

export function rankScore(rank: RankInfo | null): number {
	if (!rank) return -1
	const tierIdx = TIER_ORDER.indexOf(rank.tier as (typeof TIER_ORDER)[number])
	if (tierIdx < 0) return -1
	if (tierIdx >= APEX_START) return tierIdx * 4 + 3
	return tierIdx * 4 + (DIV_STEPS[rank.division] ?? 0)
}

export function rankSpread(ranks: readonly (RankInfo | null)[]): number {
	const scores = ranks.map(rankScore).filter((s) => s >= 0)
	if (scores.length < 2) return 0
	return Math.max(...scores) - Math.min(...scores)
}

export function flagMismatch(ranks: readonly (RankInfo | null)[], threshold: number): boolean {
	if (threshold <= 0) return false
	return rankSpread(ranks) >= threshold
}
