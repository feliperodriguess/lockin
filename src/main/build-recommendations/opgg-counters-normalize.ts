import type { CounterEntry, CounterTable, Role } from "@/shared/types"

import type { OpggNode, OpggValue } from "./opgg-parse"

function isNode(v: unknown): v is OpggNode {
	return typeof v === "object" && v !== null && !Array.isArray(v) && "__class" in v
}

/** Find the payload node carrying the counter arrays — same defensive probing
 *  as the build normalizer: the root either IS the Data node or wraps it. */
function findData(root: OpggNode): OpggNode {
	if ("strong_counters" in root || "weak_counters" in root) return root
	for (const value of Object.values(root)) {
		if (isNode(value) && ("strong_counters" in value || "weak_counters" in value)) return value
	}
	return root
}

/** OP.GG counter entries carry `play` (matchup games) and `win` (the TABLE
 *  OWNER's wins). The `win_rate` field is the ADVANTAGED side's rate — its
 *  perspective flips between strong_counters and weak_counters — so derive the
 *  owner's rate from the counts and ignore it. */
function toEntries(value: unknown): CounterEntry[] {
	if (!Array.isArray(value)) return []
	const out: CounterEntry[] = []
	for (const item of value) {
		if (!isNode(item)) continue
		const championId = typeof item.champion_id === "number" ? item.champion_id : 0
		const play = typeof item.play === "number" ? item.play : 0
		const win = typeof item.win === "number" ? item.win : 0
		if (championId <= 0 || play <= 0) continue
		out.push({ championId, winRate: win / play, games: play })
	}
	return out
}

export function normalizeOpggCounters(
	root: OpggValue | null,
	meta: { championKey: number; role: Role; patch: string },
): CounterTable | null {
	if (!isNode(root)) return null
	const data = findData(root)
	const weakAgainst = toEntries(data.weak_counters).sort((a, b) => a.winRate - b.winRate)
	const strongAgainst = toEntries(data.strong_counters).sort((a, b) => b.winRate - a.winRate)
	if (weakAgainst.length === 0 && strongAgainst.length === 0) return null
	return {
		championKey: meta.championKey,
		role: meta.role,
		patch: meta.patch,
		weakAgainst,
		strongAgainst,
	}
}
