import { api } from "@renderer/api"
import { Section } from "@renderer/components/champ-select/section"
import { SpellPair } from "@renderer/components/game/spell-pair"
import { useSettings } from "@renderer/hooks/use-data"
import { runeIconUrl } from "@renderer/lib/ddragon-urls"
import { cn } from "@renderer/lib/utils"
import { useCallback, useEffect, useRef, useState } from "react"

import type { BuildRecommendation, DDragonBundle, SummonerSpellStatic } from "@/shared/types"

interface RecommendationPanelProps {
	championKey: number | null
	build: BuildRecommendation | null
	spellPair: [SummonerSpellStatic, SummonerSpellStatic] | null
	layout: "DF" | "FD"
	bundle: DDragonBundle | undefined
	version: string
}

function formatPercent(rate: number): string {
	return `${Math.round(rate * 100)}%`
}

function formatGames(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
	return String(n)
}

export function RecommendationPanel({
	championKey,
	build,
	spellPair,
	layout,
	bundle,
	version,
}: RecommendationPanelProps): React.JSX.Element | null {
	const { data: settings } = useSettings()
	const [status, setStatus] = useState<string | null>(null)
	const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
	const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastApplied = useRef<number | null>(null)

	const autoRunes = settings?.autoRunes ?? false
	const autoSpells = settings?.autoSpells ?? false

	// transient status helper — clears itself after 2.4s. Stable identity so the
	// auto-apply effect below only re-fires on its real trigger (the champion).
	const flash = useCallback((msg: string): void => {
		setStatus(msg)
		if (statusTimer.current) clearTimeout(statusTimer.current)
		statusTimer.current = setTimeout(() => setStatus(null), 2400)
	}, [])

	// Auto-apply: when opted in and the effective champion changes, debounce ~400ms
	// (rapid hover shouldn't spam the client) then write spells/runes. Off by
	// default → this effect makes no calls. Writes go through the already-wired
	// invoke handlers (api.setSpells / api.applyRunes); no main-process code here.
	useEffect(() => {
		if (!championKey || !build) return
		// only act when the EFFECTIVE CHAMPION actually changes — never on a mere
		// settings-toggle flip or a build refetch (both keep championKey the same)
		if (championKey === lastApplied.current) return
		lastApplied.current = championKey
		if (!autoRunes && !autoSpells) return
		if (debounce.current) clearTimeout(debounce.current)
		debounce.current = setTimeout(async () => {
			// spells: write the precedence-RESOLVED pair shown in the panel
			// (pinned > OP.GG > heuristic) — never the raw OP.GG pair
			if (autoSpells && spellPair) {
				try {
					await api.setSpells(spellPair[0].key, spellPair[1].key)
					flash("Spells applied")
				} catch {
					flash("Couldn't set spells")
				}
			}
			if (autoRunes && build.runes) {
				try {
					const championName = bundle?.championsByKey[championKey]?.name
					const res = await api.applyRunes(build.runes, championName)
					flash(res.ok ? "Runes applied" : (res.error ?? "Couldn't set runes"))
				} catch {
					flash("Couldn't set runes")
				}
			}
		}, 400)
		return () => {
			if (debounce.current) clearTimeout(debounce.current)
		}
	}, [championKey, build, spellPair, autoRunes, autoSpells, bundle, flash])

	useEffect(() => {
		return () => {
			if (statusTimer.current) clearTimeout(statusTimer.current)
			if (debounce.current) clearTimeout(debounce.current)
		}
	}, [])

	if (!championKey || !build) return null

	const runes = build.runes
	// keystone + 6 chosen perks (skip the 3 stat shards for the compact cluster)
	const perkIcons = runes
		? runes.selectedPerkIds
				.slice(0, 6)
				.map((id) => bundle?.runesById[id])
				.filter((r): r is NonNullable<typeof r> => r != null)
		: []

	return (
		<Section
			label="Recommended"
			right={
				<span className="font-mono text-[10px] font-semibold leading-none tracking-[0.06em] text-paper-300">
					{formatPercent(build.winRate)} · {formatGames(build.sampleSize)} games
				</span>
			}
		>
			<div className="flex items-center gap-4">
				{perkIcons.length > 0 && (
					<div className="flex shrink-0 items-center gap-[5px]">
						{perkIcons.map((rune, i) => (
							<img
								key={rune.id}
								src={runeIconUrl(rune.icon)}
								alt={rune.name}
								title={rune.name}
								className={cn(
									"shrink-0 rounded-full bg-ink-800 object-contain",
									i === 0 ? "h-9 w-9 p-px ring-1 ring-accent" : "h-6 w-6",
								)}
							/>
						))}
					</div>
				)}

				{spellPair && (
					<>
						<span className="shrink-0 h-8 w-px bg-(--stroke-default)" />
						<SpellPair pair={spellPair} version={version} layout={layout} size={28} showKeys />
					</>
				)}

				<div className="flex-1" />

				{status && (
					<span className="shrink-0 font-mono text-[10px] font-semibold leading-none tracking-[0.06em] text-accent">
						{status}
					</span>
				)}
				{(autoRunes || autoSpells) && !status && (
					<span className="shrink-0 font-mono text-[10px] font-medium leading-none tracking-[0.06em] text-paper-400">
						Auto-setup on
					</span>
				)}
			</div>
		</Section>
	)
}
