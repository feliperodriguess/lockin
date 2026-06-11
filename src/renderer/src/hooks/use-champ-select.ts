import { type DisplayRole, displayRole } from "@renderer/lib/roles"
import { useEffect, useMemo, useRef, useState } from "react"

import { goneChampionIds, statisticalBans, suggestBans } from "@/shared/lib/bans"
import { counterPicks, type MatchupDifficulty, matchupDifficulty } from "@/shared/lib/counters"
import { asRole, findLaneOpponent } from "@/shared/lib/lanes"
import { matchupNote } from "@/shared/lib/notes-match"
import { flagMismatch } from "@/shared/lib/rank"
import { resolveSpells } from "@/shared/lib/spell-precedence"
import type {
	BuildRecommendation,
	ChampionStatic,
	MatchupNote,
	RankInfo,
	SummonerSpellStatic,
} from "@/shared/types"

import {
	useBanList,
	useBuildRecommendation,
	useCounterTable,
	useDDragon,
	useNotes,
	useSettings,
	useTeamRanks,
} from "./use-data"
import { useChampSelectSession } from "./use-lcu"

export interface SpellRec {
	pair: [SummonerSpellStatic, SummonerSpellStatic] | null
	source: "pinned" | "opgg" | "heuristic"
	rolePending: boolean
}
export interface BanRowVM {
	championId: number
	champion: ChampionStatic | null
	reason?: string
	status: "open" | "banned" | "picked"
	threat: boolean
	counterWinRate: number | null
}
export interface CounterPickVM {
	champion: ChampionStatic | null
	winRate: number // displayed: this pick's win rate INTO the opponent
}
export interface CounterPicksVM {
	opponent: ChampionStatic
	yours: CounterPickVM[]
	best: CounterPickVM[]
}
export interface StatBanRowVM {
	champion: ChampionStatic | null
	winRate: number // displayed: their win rate INTO my champion
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
		hovering: boolean // champion shown via pick intent, not yet locked
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
	championKey: number | null // effective champion (locked || hovered)
	position: string | null // raw LCU assignedPosition ("top"…), null when pending
	build: BuildRecommendation | null
	counterPicks: CounterPicksVM | null
	difficulty: MatchupDifficulty | null
	statBanRows: StatBanRowVM[]
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

	// Effective champion + position resolved OUTSIDE the memo so useBuildRecommendation (a hook)
	// runs unconditionally. Locked championId wins; otherwise fall back to the
	// hovered championPickIntent so the screen reacts the instant you hover.
	const meRaw = session?.myTeam.find((p) => p.cellId === session.localPlayerCellId) ?? null
	const championKey = meRaw ? meRaw.championId || meRaw.championPickIntent || null : null
	const position = meRaw?.assignedPosition ? meRaw.assignedPosition : null

	// lane opponent resolved OUTSIDE the memo so the counter queries (hooks) can key off it
	const opponentChampionId = useMemo(
		() =>
			session && bundle
				? findLaneOpponent(session, (key) => bundle.championsByKey[key]?.id ?? null)
						.opponentChampionId
				: null,
		[session, bundle],
	)

	const { data: build } = useBuildRecommendation(championKey, position, settings?.buildTier)
	const { data: enemyCounters } = useCounterTable(opponentChampionId, position, settings?.buildTier)
	const { data: myCounters } = useCounterTable(championKey, position, settings?.buildTier)

	return useMemo(() => {
		if (!session) return null
		const champ = (id: number): ChampionStatic | null => bundle?.championsByKey[id] ?? null
		const spell = (id: number): SummonerSpellStatic | null => bundle?.spellsByKey[id] ?? null

		const me = session.myTeam.find((p) => p.cellId === session.localPlayerCellId)
		if (!me) return null

		const role = displayRole(me.assignedPosition)
		const rolePending = !role

		// effective champion: locked championId wins, else the hovered intent.
		// hovering = we're showing the champ via intent only (not locked yet).
		const effectiveChampId = me.championId || me.championPickIntent || 0
		const hovering = me.championId === 0 && me.championPickIntent > 0

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
		// matchup target = the enemy in MY lane — resolved by findLaneOpponent (shared)
		// outside this memo so counter queries can key off opponentChampionId directly.
		const laneOpponent = opponentChampionId
			? (session.theirTeam.find((p) => p.championId === opponentChampionId) ?? null)
			: null
		const opponent = laneOpponent ? champ(laneOpponent.championId) : null

		// counter-pick assist: only while the decision is live (pick phase, opponent visible, not locked)
		const myRole = asRole(me.assignedPosition)
		const mainIds = (settings?.mains ?? [])
			.filter((m) => m.role === myRole)
			.map((m) => m.championId)
		const picks =
			subPhase === "pick" && me.championId === 0 && opponent
				? counterPicks(enemyCounters ?? null, mainIds, goneChampionIds(session))
				: null
		const counterPicksVM: CounterPicksVM | null =
			picks && opponent && (picks.yours.length > 0 || picks.best.length > 0)
				? {
						opponent,
						yours: picks.yours.map((p) => ({ champion: champ(p.championId), winRate: p.winRate })),
						best: picks.best.map((p) => ({ champion: champ(p.championId), winRate: p.winRate })),
					}
				: null

		const difficulty =
			effectiveChampId && opponentChampionId
				? matchupDifficulty(
						effectiveChampId,
						opponentChampionId,
						enemyCounters ?? null,
						myCounters ?? null,
					)
				: null

		const note = matchupNote(notes ?? [], effectiveChampId, laneOpponent?.championId ?? null)

		// spell precedence: pinned-note > OP.GG build > deterministic heuristic.
		const pinned = note?.pinnedSpells
		const pinnedValid = !!(pinned && spell(pinned[0]) && spell(pinned[1]))
		const opggPair = build?.spells ?? null
		const opggValid = !!(opggPair && spell(opggPair[0]) && spell(opggPair[1]))
		const rec = resolveSpells({
			assignedPosition: me.assignedPosition,
			pinnedSpells: pinnedValid ? pinned : undefined,
			opggSpells: opggValid ? opggPair : null,
		})
		const s0 = spell(rec.pair[0])
		const s1 = spell(rec.pair[1])
		const spells: SpellRec = {
			pair: s0 && s1 ? [s0, s1] : null,
			source: rec.source,
			rolePending: rec.rolePending,
		}

		const rows: BanRowVM[] = suggestBans(
			banlist ?? [],
			session,
			myCounters?.weakAgainst ?? [],
		).entries.map((row) => ({
			championId: row.entry.championId,
			champion: champ(row.entry.championId),
			reason: row.entry.reason,
			status: row.status,
			threat: row.threat,
			counterWinRate: row.counterWinRate,
		}))

		const statBanRows: StatBanRowVM[] = statisticalBans(
			myCounters?.weakAgainst ?? [],
			banlist ?? [],
			session,
		).map((r) => ({ champion: champ(r.championId), winRate: r.winRate }))

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
			me: {
				champion: champ(effectiveChampId),
				role,
				rolePending,
				hovering,
				name: me.gameName ?? "",
			},
			opponent,
			spells,
			note,
			banRows: rows,
			goneCount: rows.filter((r) => r.status !== "open").length,
			team,
			ranksAvailable,
			mismatch,
			championKey: effectiveChampId || null,
			position: me.assignedPosition || null,
			build: build ?? null,
			counterPicks: counterPicksVM,
			difficulty,
			statBanRows,
		}
	}, [
		session,
		bundle,
		notes,
		banlist,
		settings,
		ranks,
		elapsedMs,
		build,
		opponentChampionId,
		enemyCounters,
		myCounters,
	])
}
