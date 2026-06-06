import { type DisplayRole, displayRole } from "@renderer/lib/roles"
import { useEffect, useMemo, useRef, useState } from "react"

import { suggestBans } from "@/shared/lib/bans"
import { matchNotes } from "@/shared/lib/notes-match"
import { flagMismatch } from "@/shared/lib/rank"
import { recommendSpells } from "@/shared/lib/spells"
import type { ChampionStatic, MatchupNote, RankInfo, SummonerSpellStatic } from "@/shared/types"

import { useBanList, useDDragon, useNotes, useSettings, useTeamRanks } from "./use-data"
import { useChampSelectSession } from "./use-lcu"

export interface SpellRec {
	pair: [SummonerSpellStatic, SummonerSpellStatic] | null
	source: "pinned" | "heuristic"
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

	// Countdown interpolation: the real LCU pushes sessions on state changes only
	// (picks/bans), NOT at 1 Hz — without a local tick the timer freezes between
	// pushes. Stamp each session's arrival (ref-compare, not a deps array — the
	// linter would strip a deps-only dependency) and tick once per second from it.
	// (The fake bridge pushes every second, so elapsed stays ~0 there.)
	const stampRef = useRef<{ session: typeof session; at: number }>({ session: null, at: 0 })
	if (stampRef.current.session !== session) {
		stampRef.current = { session, at: Date.now() }
	}
	const receivedAt = stampRef.current.at
	const [nowMs, setNowMs] = useState(receivedAt)
	useEffect(() => {
		if (!session || session.timer.isInfinite) return
		setNowMs(Date.now())
		const id = setInterval(() => setNowMs(Date.now()), 1000)
		return () => clearInterval(id)
	}, [session])
	const elapsedMs = Math.max(0, nowMs - receivedAt)

	return useMemo(() => {
		// bundle-optional: with no bundle (first-run offline) every lookup misses and
		// the rail renders D15 fallback tiles — champ select is never blocked
		if (!session) return null
		const champ = (id: number): ChampionStatic | null => bundle?.championsByKey[id] ?? null
		const spell = (id: number): SummonerSpellStatic | null => bundle?.spellsByKey[id] ?? null

		const me = session.myTeam.find((p) => p.cellId === session.localPlayerCellId)
		if (!me) return null

		const role = displayRole(me.assignedPosition)
		const rolePending = !role

		// sub-phase: FINALIZATION → pick; PLANNING → ban (bans come first);
		// BAN_PICK → ban while any ban action is in progress (real sessions mix turns)
		const flat = session.actions.flat()
		const timerPhase = session.timer.phase
		const subPhase: "ban" | "pick" =
			timerPhase === "FINALIZATION"
				? "pick"
				: timerPhase === "PLANNING"
					? "ban"
					: flat.some((a) => a.type === "ban" && a.isInProgress)
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

		const matching = matchNotes(
			notes ?? [],
			me.championId,
			enemyVisible.map((p) => p.championId),
		)
		const note = matching[0] ?? null

		// pinned pre-validated against DDragon (§6.1: unresolvable pin → heuristic)
		const pinned = note?.pinnedSpells
		const pinnedValid = !!(pinned && spell(pinned[0]) && spell(pinned[1]))
		const rec = recommendSpells({
			assignedPosition: me.assignedPosition,
			pinnedSpells: pinnedValid ? pinned : undefined,
		})
		const s0 = spell(rec.pair[0])
		const s1 = spell(rec.pair[1])
		const spells: SpellRec = {
			pair: s0 && s1 ? [s0, s1] : null,
			source: rec.source,
			rolePending: rec.rolePending,
		}

		const rows: BanRowVM[] = suggestBans(banlist ?? [], session).entries.map((row) => ({
			championId: row.entry.championId,
			champion: champ(row.entry.championId),
			reason: row.entry.reason,
			status: row.status,
			threat: row.threat,
		}))

		const team: TeamRowVM[] = session.myTeam.map((p) => ({
			cellId: p.cellId,
			champion: champ(p.championId),
			role: displayRole(p.assignedPosition),
			name: p.gameName ?? `Summoner ${p.summonerId}`,
			rank: ranks?.[p.puuid] ?? null,
			you: p.cellId === session.localPlayerCellId,
		}))
		// requires at least one *teammate* rank — the fake always returns yours, matching the prototype
		const ranksAvailable = team.some((t) => !t.you && t.rank != null)

		const mismatch =
			ranksAvailable &&
			flagMismatch(
				team.map((t) => t.rank),
				settings?.rankDiffThreshold ?? 8,
			)

		return {
			subPhase,
			secondsLeft: Math.max(
				0,
				Math.ceil((session.timer.adjustedTimeLeftInPhase - elapsedMs) / 1000),
			),
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
	}, [session, bundle, notes, banlist, settings, ranks, elapsedMs])
}
