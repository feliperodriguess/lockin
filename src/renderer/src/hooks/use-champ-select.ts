import { championLane, type DisplayRole, displayRole } from "@renderer/lib/roles"
import { useEffect, useMemo, useRef, useState } from "react"

import { suggestBans } from "@/shared/lib/bans"
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
	const { data: build } = useBuildRecommendation(championKey, position, settings?.buildTier)

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
		// matchup target = the enemy in MY lane. Riot doesn't expose enemy
		// assignedPosition in champ select, so prefer it when present but otherwise
		// infer the enemy's lane from the champion (CHAMPION_LANE). No confident
		// match (role pending, or no enemy maps to my lane) → no specific matchup,
		// rather than guessing the wrong enemy.
		const laneOpponent = role
			? (enemyVisible.find(
					(p) =>
						(displayRole(p.assignedPosition) ?? championLane(champ(p.championId)?.id ?? "")) ===
						role,
				) ?? null)
			: null
		const opponent = laneOpponent ? champ(laneOpponent.championId) : null

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
		}
	}, [session, bundle, notes, banlist, settings, ranks, elapsedMs, build])
}
