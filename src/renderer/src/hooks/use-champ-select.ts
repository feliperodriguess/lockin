import { rankScore } from "@renderer/lib/rank-format"
import { type DisplayRole, displayRole } from "@renderer/lib/roles"
import { useMemo } from "react"

import type {
	BanListEntry,
	ChampionStatic,
	MatchupNote,
	RankInfo,
	SummonerSpellStatic,
} from "@/shared/types"

import { useBanList, useDDragon, useNotes, useSettings, useTeamRanks } from "./use-data"
import { useChampSelectSession } from "./use-lcu"

export interface SpellRec {
	pair: [SummonerSpellStatic, SummonerSpellStatic] | null
	source: "pinned" | "default"
	rolePending: boolean
}
export interface BanRowVM {
	championId: number
	champion: ChampionStatic | null
	reason?: string
	status: "open" | "banned" | "picked"
	threat: boolean
}
export interface TeamRowVM {
	cellId: number
	champion: ChampionStatic | null
	role: DisplayRole | null
	name: string
	rank: RankInfo | null
	you: boolean
}
export interface ChampSelectVM {
	subPhase: "ban" | "pick"
	secondsLeft: number
	phaseTotal: number
	timerVisible: boolean
	enemyHidden: boolean
	me: {
		champion: ChampionStatic | null
		role: DisplayRole | null
		rolePending: boolean
		name: string
	}
	opponent: ChampionStatic | null // visible enemy in my lane (matchup target)
	spells: SpellRec
	note: MatchupNote | null
	banRows: BanRowVM[]
	goneCount: number
	team: TeamRowVM[]
	ranksAvailable: boolean
	mismatch: boolean
}

/* PHASE-1 GLUE — replaced by src/shared/lib/spells.ts in Phase 6 */
const DEFAULT_SECOND_SPELL: Record<string, number> = {
	jungle: 11, // Smite
	top: 12, // Teleport
	middle: 12, // Teleport
	bottom: 7, // Heal
	utility: 14, // Ignite
	"": 14, // Ignite
}
const FLASH = 4

export function useChampSelect(): ChampSelectVM | null {
	const session = useChampSelectSession()
	const { data: bundle } = useDDragon()
	const { data: notes } = useNotes()
	const { data: banlist } = useBanList()
	const { data: settings } = useSettings()
	const myPuuids = useMemo(
		() => (session ? session.myTeam.map((p) => p.puuid).filter(Boolean) : []),
		[session],
	)
	const { data: ranks } = useTeamRanks(myPuuids)

	return useMemo(() => {
		if (!session || !bundle) return null
		const champ = (id: number): ChampionStatic | null => bundle.championsByKey[id] ?? null
		const spell = (id: number): SummonerSpellStatic | null => bundle.spellsByKey[id] ?? null

		const me = session.myTeam.find((p) => p.cellId === session.localPlayerCellId)
		if (!me) return null

		const role = displayRole(me.assignedPosition)
		const rolePending = !role

		// sub-phase from actions: any in-progress ban → ban (PHASE-1 GLUE, Phase 4 refines)
		const flat = session.actions.flat()
		const subPhase: "ban" | "pick" = flat.some((a) => a.type === "ban" && a.isInProgress)
			? "ban"
			: "pick"

		const enemyVisible = session.theirTeam.filter((p) => p.championId > 0)
		const enemyHidden = enemyVisible.length === 0
		// matchup target: same assignedPosition if known, else first visible enemy
		const laneOpponent =
			enemyVisible.find((p) => p.assignedPosition === me.assignedPosition) ??
			enemyVisible[0] ??
			null
		const opponent = laneOpponent ? champ(laneOpponent.championId) : null

		// PHASE-1 GLUE — replaced by src/shared/lib/notes-match.ts in Phase 5
		const matching = (notes ?? [])
			.filter(
				(n) =>
					n.championId === me.championId &&
					(n.opponentChampionId == null ||
						enemyVisible.some((p) => p.championId === n.opponentChampionId)),
			)
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
		const note = matching[0] ?? null

		// PHASE-1 GLUE — replaced by src/shared/lib/spells.ts in Phase 6
		const pinned = note?.pinnedSpells
		const pairIds: [number, number] =
			pinned && spell(pinned[0]) && spell(pinned[1])
				? pinned
				: [FLASH, DEFAULT_SECOND_SPELL[me.assignedPosition] ?? 14]
		const s0 = spell(pairIds[0])
		const s1 = spell(pairIds[1])
		const spells: SpellRec = {
			pair: s0 && s1 ? [s0, s1] : null,
			source: pinned ? "pinned" : "default",
			rolePending,
		}

		// PHASE-1 GLUE — replaced by src/shared/lib/bans.ts in Phase 6
		const bannedIds = new Set([...session.bans.myTeamBans, ...session.bans.theirTeamBans])
		const pickedIds = new Set(
			[...session.myTeam, ...session.theirTeam].map((p) => p.championId).filter((id) => id > 0),
		)
		const visibleEnemyIds = new Set(enemyVisible.map((p) => p.championId))
		const rows: BanRowVM[] = [...(banlist ?? [])]
			.sort((a, b) => a.priority - b.priority)
			.map((e: BanListEntry) => ({
				championId: e.championId,
				champion: champ(e.championId),
				reason: e.reason,
				status: bannedIds.has(e.championId)
					? ("banned" as const)
					: pickedIds.has(e.championId)
						? ("picked" as const)
						: ("open" as const),
				threat: visibleEnemyIds.has(e.championId),
			}))
			.sort((a, b) => Number(b.threat) - Number(a.threat))

		const team: TeamRowVM[] = session.myTeam.map((p) => ({
			cellId: p.cellId,
			champion: champ(p.championId),
			role: displayRole(p.assignedPosition),
			name: p.gameName ?? `Summoner ${p.summonerId}`,
			rank: ranks?.[p.puuid] ?? null,
			you: p.cellId === session.localPlayerCellId,
		}))
		// teammates only — your own rank is always present, so it can't count as "available"
		const ranksAvailable = team.some((t) => !t.you && t.rank != null)

		// PHASE-1 GLUE — replaced by src/shared/lib/rank.ts in Phase 7
		const scores = team.map((t) => rankScore(t.rank)).filter((s) => s >= 0)
		const spread = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0
		const mismatch = ranksAvailable && spread >= (settings?.rankDiffThreshold ?? 8)

		return {
			subPhase,
			secondsLeft: Math.max(0, Math.ceil(session.timer.adjustedTimeLeftInPhase / 1000)),
			phaseTotal: Math.max(1, Math.round(session.timer.totalTimeInPhase / 1000)),
			timerVisible: !session.timer.isInfinite,
			enemyHidden,
			me: { champion: champ(me.championId), role, rolePending, name: me.gameName ?? "" },
			opponent,
			spells,
			note,
			banRows: rows,
			goneCount: rows.filter((r) => r.status !== "open").length,
			team,
			ranksAvailable,
			mismatch,
		}
	}, [session, bundle, notes, banlist, settings, ranks])
}
