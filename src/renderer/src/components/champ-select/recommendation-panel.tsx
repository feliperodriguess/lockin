import { Section } from "@renderer/components/champ-select/section"
import { SpellPair } from "@renderer/components/game/spell-pair"
import { useAutoApply } from "@renderer/hooks/use-auto-apply"
import { useSettings } from "@renderer/hooks/use-data"
import { runeIconUrl } from "@renderer/lib/ddragon-urls"
import { fade, rise } from "@renderer/lib/motion"
import { cn } from "@renderer/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useEffect, useRef, useState } from "react"

import type { BuildRecommendation, DDragonBundle, SummonerSpellStatic } from "@/shared/types"

interface RecommendationPanelProps {
	championKey: number | null
	build: BuildRecommendation | null
	buildLoading: boolean
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
	buildLoading,
	spellPair,
	layout,
	bundle,
	version,
}: RecommendationPanelProps): React.JSX.Element | null {
	const { data: settings } = useSettings()
	const [status, setStatus] = useState<string | null>(null)
	const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

	const autoRunes = settings?.autoRunes ?? false
	const autoSpells = settings?.autoSpells ?? false

	// transient status helper — clears itself after 2.4s. Stable identity so the
	// auto-apply hook only re-fires on its real trigger (the champion).
	const flash = useCallback((msg: string): void => {
		setStatus(msg)
		if (statusTimer.current) clearTimeout(statusTimer.current)
		statusTimer.current = setTimeout(() => setStatus(null), 2400)
	}, [])

	useAutoApply({
		championKey,
		build,
		spellPair,
		autoRunes,
		autoSpells,
		championName: championKey ? bundle?.championsByKey[championKey]?.name : undefined,
		layout,
		flash,
	})

	useEffect(() => {
		return () => {
			if (statusTimer.current) clearTimeout(statusTimer.current)
		}
	}, [])

	if (!championKey || (!build && !buildLoading)) return null

	if (!build) {
		return (
			<Section label="Recommended">
				<div aria-busy className="flex items-center gap-4">
					<div className="flex shrink-0 items-center gap-[5px]">
						<div className="ccp-shimmer h-9 w-9 rounded-full" />
						<div className="ccp-shimmer h-6 w-6 rounded-full" />
						<div className="ccp-shimmer h-6 w-6 rounded-full" />
						<div className="ccp-shimmer h-6 w-6 rounded-full" />
						<div className="ccp-shimmer h-6 w-6 rounded-full" />
						<div className="ccp-shimmer h-6 w-6 rounded-full" />
					</div>
					<span className="shrink-0 h-8 w-px bg-(--stroke-default)" />
					<div className="ccp-shimmer h-8 w-[120px] rounded-sm" />
				</div>
			</Section>
		)
	}

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
			<motion.div
				key={championKey}
				variants={rise}
				initial="hidden"
				animate="visible"
				className="flex items-center gap-4"
			>
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

				<AnimatePresence mode="wait" initial={false}>
					{status ? (
						<motion.span
							key={status}
							variants={fade}
							initial="hidden"
							animate="visible"
							exit="exit"
							className="shrink-0 font-mono text-[10px] font-semibold leading-none tracking-[0.06em] text-accent"
						>
							{status}
						</motion.span>
					) : autoRunes || autoSpells ? (
						<motion.span
							key="auto"
							variants={fade}
							initial="hidden"
							animate="visible"
							exit="exit"
							className="shrink-0 font-mono text-[10px] font-medium leading-none tracking-[0.06em] text-paper-400"
						>
							Auto-setup on
						</motion.span>
					) : null}
				</AnimatePresence>
			</motion.div>
		</Section>
	)
}
