import type { RankInfo } from "@/shared/types"

/* tier metadata — tint colors from data.js:59-70, LCU-uppercase keys */
export const TIERS: Record<string, { idx: number; color: string; label: string }> = {
	IRON: { idx: 0, color: "#6b6258", label: "Iron" },
	BRONZE: { idx: 1, color: "#9c6b43", label: "Bronze" },
	SILVER: { idx: 2, color: "#9aa6ad", label: "Silver" },
	GOLD: { idx: 3, color: "#e0b441", label: "Gold" },
	PLATINUM: { idx: 4, color: "#4fb6a6", label: "Platinum" },
	EMERALD: { idx: 5, color: "#46c279", label: "Emerald" },
	DIAMOND: { idx: 6, color: "#7aa2ff", label: "Diamond" },
	MASTER: { idx: 7, color: "#c77dff", label: "Master" },
	GRANDMASTER: { idx: 8, color: "#ff6b5e", label: "Grandmaster" },
	CHALLENGER: { idx: 9, color: "#d6ff66", label: "Challenger" },
}

const DIV_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }

/* PHASE-1 GLUE — replaced by src/shared/lib/rank.ts in Phase 7 */
export function rankScore(rank: RankInfo | null): number {
	if (!rank || !TIERS[rank.tier]) return -1
	return TIERS[rank.tier].idx * 4 + (4 - (DIV_NUM[rank.division] ?? 4))
}

// TODO(Phase 7): apex tiers (MASTER+) should render without a division — LCU reports "I".
export function formatRank(rank: RankInfo | null): string {
	if (!rank || !TIERS[rank.tier]) return "Unranked"
	return `${TIERS[rank.tier].label} ${rank.division}`
}
