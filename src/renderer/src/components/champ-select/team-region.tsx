import { Pill } from "@renderer/components/app/pill"
import { Section } from "@renderer/components/champ-select/section"
import { MismatchFlag } from "@renderer/components/game/badges"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { RankBadge } from "@renderer/components/game/rank-badge"
import { RoleGlyph } from "@renderer/components/game/role"
import type { TeamRowVM } from "@renderer/hooks/use-champ-select"
import { cn } from "@renderer/lib/utils"
import { WifiOff } from "lucide-react"

interface TeamRegionProps {
	team: TeamRowVM[]
	ranksAvailable: boolean
	mismatch: boolean
	version: string
	grow?: boolean
}

export function TeamRegion({
	team,
	ranksAvailable,
	mismatch,
	version,
	grow,
}: TeamRegionProps): React.JSX.Element {
	return (
		<Section
			label="Your team"
			grow={grow}
			scroll={grow}
			right={
				mismatch ? (
					<MismatchFlag />
				) : !ranksAvailable ? (
					<Pill tone="neutral" icon={WifiOff}>
						Ranks unavailable
					</Pill>
				) : null
			}
		>
			<ul className={cn("flex flex-1 flex-col gap-px", grow ? "justify-start" : "justify-center")}>
				{team.map((p) => (
					<TeamRow key={p.cellId} p={p} version={version} />
				))}
			</ul>
		</Section>
	)
}

function TeamRow({ p, version }: { p: TeamRowVM; version: string }): React.JSX.Element {
	const showRank = p.rank != null || p.you
	return (
		<li className="flex items-center gap-[10px] px-1 py-[6px]">
			<RoleGlyph role={p.role} size={15} color="var(--fg-4)" />
			<ChampionPortrait champion={p.champion} version={version} size={30} ring={p.you} />
			<div className="flex min-w-0 flex-1 flex-col gap-[2px]">
				<span
					className={cn(
						"overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold leading-none",
						p.you ? "text-accent" : "text-paper-100",
					)}
				>
					{p.name}
					{p.you ? " (you)" : ""}
				</span>
				<span className="font-mono text-[10px] leading-none text-paper-400">
					{p.champion?.name}
				</span>
			</div>
			{showRank ? (
				<RankBadge rank={p.rank} size="sm" />
			) : (
				<span className="font-mono text-[11px] font-medium leading-none text-paper-400">—</span>
			)}
		</li>
	)
}
