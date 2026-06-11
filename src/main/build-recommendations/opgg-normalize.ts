import type { BuildRecommendation, ItemGroup, ItemOption, Role, RunePageRec } from "@/shared/types"

import type { OpggNode, OpggValue } from "./opgg-parse"

type Skill = "Q" | "W" | "E" | "R"
type Lev = "Q" | "W" | "E"

/* ----------------------------------------------------------- tree helpers */

function isNode(v: unknown): v is OpggNode {
	return typeof v === "object" && v !== null && !Array.isArray(v) && "__class" in v
}

/** Find the "Data" payload: OP.GG wraps the analysis under a root constructor;
 *  the data we want is either the root itself or its single descendant that
 *  carries the analysis fields. We probe a few shapes defensively. */
function findData(root: OpggNode): OpggNode {
	if ("runes" in root || "core_items" in root || "summary" in root) return root
	for (const value of Object.values(root)) {
		if (isNode(value) && ("runes" in value || "core_items" in value || "summary" in value)) {
			return value
		}
	}
	return root
}

function asNode(v: unknown): OpggNode | null {
	return isNode(v) ? v : null
}

function asNumber(v: unknown): number {
	return typeof v === "number" ? v : 0
}

function asString(v: unknown): string {
	return typeof v === "string" ? v : ""
}

function asNumberArray(v: unknown): number[] {
	return Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : []
}

/* ----------------------------------------------------------------- pieces */

function toItemGroup(node: OpggNode | null): ItemGroup {
	if (!node) return { ids: [] }
	const group: ItemGroup = { ids: asNumberArray(node.ids) }
	// OP.GG item groups carry absolute play/win COUNTS (no win_rate field); the
	// ItemGroup contract is a 0..1 rate, so derive it from the counts
	const play = typeof node.play === "number" ? node.play : 0
	if (typeof node.win === "number" && play > 0) group.winRate = node.win / play
	if (typeof node.pick_rate === "number") group.pickRate = node.pick_rate
	return group
}

/** A late slot (4th/5th/6th) is either a single item group with an `ids` array,
 *  or an array of per-option nodes (OP.GG's real shape), each option carrying its
 *  own play/win counts. Yield one ItemOption per item id, deduped within the
 *  slot, preserving OP.GG's order (most-picked first). */
function slotOptions(value: unknown): ItemOption[] {
	const nodes = Array.isArray(value) ? value.map(asNode) : [asNode(value)]
	const out: ItemOption[] = []
	const seen = new Set<number>()
	for (const node of nodes) {
		if (!node) continue
		const group = toItemGroup(node)
		for (const id of group.ids) {
			if (seen.has(id)) continue
			seen.add(id)
			out.push({ id, winRate: group.winRate, pickRate: group.pickRate })
		}
	}
	return out
}

function toRunes(data: OpggNode): RunePageRec | null {
	const r = asNode(data.runes)
	if (!r) return null
	const selectedPerkIds = [
		...asNumberArray(r.primary_rune_ids),
		...asNumberArray(r.secondary_rune_ids),
		...asNumberArray(r.stat_mod_ids),
	]
	if (selectedPerkIds.length !== 9) return null // never apply a malformed page
	return {
		primaryStyleId: asNumber(r.primary_page_id),
		subStyleId: asNumber(r.secondary_page_id),
		selectedPerkIds,
		primaryName: asString(r.primary_page_name),
		secondaryName: asString(r.secondary_page_name),
	}
}

function toSpells(data: OpggNode): [number, number] | null {
	const s = asNode(data.summoner_spells)
	const ids = asNumberArray(s?.ids)
	if (ids.length < 2) return null
	return [ids[0] as number, ids[1] as number]
}

const SKILLS: Skill[] = ["Q", "W", "E", "R"]
const MAX_RANK: Record<Skill, number> = { Q: 5, W: 5, E: 5, R: 3 }
/** Levels (1-based) at which the ultimate becomes available. */
const ULT_LEVELS = new Set([6, 11, 16])

/** OP.GG only encodes the first 15 levels (ranks 16-18 are deterministic given
 *  League's leveling rules). Pad to 18 so downstream code can index any level:
 *  fill remaining levels by maxing the ult at its unlock levels, otherwise the
 *  highest-priority basic ability that still has rank to gain. */
function padToEighteen(order: Skill[], priority: Lev[]): Skill[] {
	const out = order.slice(0, 18)
	const rank: Record<Skill, number> = { Q: 0, W: 0, E: 0, R: 0 }
	for (const s of out) rank[s]++
	while (out.length < 18) {
		const level = out.length + 1
		let pick: Skill | null = null
		if (ULT_LEVELS.has(level) && rank.R < MAX_RANK.R) {
			pick = "R"
		} else {
			pick = priority.find((s) => rank[s] < MAX_RANK[s]) ?? null
			if (!pick && rank.R < MAX_RANK.R) pick = "R"
		}
		if (!pick) break
		out.push(pick)
		rank[pick]++
	}
	return out
}

function toSkillOrder(data: OpggNode): Skill[] {
	const skills = asNode(data.skills)
	const raw = Array.isArray(skills?.order) ? skills?.order : []
	const order = (raw ?? [])
		.map((s) => (typeof s === "string" ? (s.trim().toUpperCase() as Skill) : null))
		.filter((s): s is Skill => s !== null && SKILLS.includes(s))
		.slice(0, 18)
	return padToEighteen(order, skillPriorityFrom(order))
}

/** Q/W/E ranked by how often they're leveled, ties broken by earliest level. */
export function skillPriorityFrom(order: Skill[]): Lev[] {
	const levs: Lev[] = ["Q", "W", "E"]
	const count: Record<Lev, number> = { Q: 0, W: 0, E: 0 }
	const first: Record<Lev, number> = { Q: Infinity, W: Infinity, E: Infinity }
	order.forEach((s, i) => {
		if (s === "Q" || s === "W" || s === "E") {
			count[s]++
			first[s] = Math.min(first[s], i)
		}
	})
	return [...levs].sort((a, b) => count[b] - count[a] || first[a] - first[b])
}

/* --------------------------------------------------------------- assemble */

export function normalizeOpgg(
	root: OpggValue | null,
	meta: { championKey: number; role: Role; patch: string },
): BuildRecommendation | null {
	if (!isNode(root)) return null
	const data = findData(root)
	const summary = asNode(data.summary)
	const stats = asNode(summary?.average_stats)
	const skillOrder = toSkillOrder(data)
	return {
		championKey: meta.championKey,
		role: meta.role,
		patch: meta.patch,
		winRate: asNumber(stats?.win_rate),
		sampleSize: asNumber(stats?.play),
		runes: toRunes(data),
		spells: toSpells(data),
		items: {
			starter: toItemGroup(asNode(data.starter_items)),
			boots: toItemGroup(asNode(data.boots)),
			core: toItemGroup(asNode(data.core_items)),
			fourth: slotOptions(data.fourth_items),
			fifth: slotOptions(data.fifth_items),
			sixth: slotOptions(data.sixth_items),
		},
		skillOrder,
		skillPriority: skillPriorityFrom(skillOrder),
	}
}
