import { isApexTier } from "@/shared/lib/rank"
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

export function formatRank(rank: RankInfo | null): string {
	if (!rank || !TIERS[rank.tier]) return "Unranked"
	if (isApexTier(rank.tier)) return TIERS[rank.tier].label // LCU division is "I"/"NA" noise
	return `${TIERS[rank.tier].label} ${rank.division}`
}
