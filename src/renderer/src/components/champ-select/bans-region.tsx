import { Card } from "@renderer/components/app/card"
import { EmptyState } from "@renderer/components/app/empty-state"
import { Section } from "@renderer/components/champ-select/section"
import { CountersYouBadge, ThreatBadge } from "@renderer/components/game/badges"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { Button } from "@renderer/components/ui/button"
import type { BanRowVM, StatBanRowVM } from "@renderer/hooks/use-champ-select"
import { formatWinRate } from "@renderer/lib/build-format"
import { cn } from "@renderer/lib/utils"
import { useNavigate } from "@tanstack/react-router"
import { ChevronDown, ChevronUp, Shield } from "lucide-react"
import { useEffect, useState } from "react"

interface BansRegionProps {
	banRows: BanRowVM[]
	statBanRows: StatBanRowVM[]
	goneCount: number
	enemyHidden: boolean
	subPhase: "ban" | "pick"
	version: string
	grow?: boolean
}

export function BansRegion({
	banRows,
	statBanRows,
	goneCount,
	enemyHidden,
	subPhase,
	version,
	grow,
}: BansRegionProps): React.JSX.Element {
	const [collapsed, setCollapsed] = useState(subPhase === "pick")

	useEffect(() => {
		setCollapsed(subPhase === "pick")
	}, [subPhase])

	if (banRows.length === 0 && statBanRows.length === 0) {
		return (
			<Section label="Ban radar" grow={grow}>
				<EmptyBanList />
			</Section>
		)
	}

	if (collapsed) {
		return <CollapsedBans goneCount={goneCount} onToggle={() => setCollapsed(false)} />
	}

	return (
		<Section
			label="Ban radar"
			grow={grow}
			scroll
			right={
				<div className="flex items-center gap-2">
					<span className="font-mono text-[10px] leading-none text-paper-400">
						{goneCount}/{banRows.length} gone
					</span>
					{subPhase === "pick" && (
						<button
							type="button"
							title="Collapse"
							onClick={() => setCollapsed(true)}
							className="inline-flex cursor-pointer items-center justify-center border-none bg-transparent text-paper-400"
						>
							<ChevronUp size={15} />
						</button>
					)}
				</div>
			}
		>
			<ul className="flex flex-col gap-[2px]">
				{banRows.map((row) => (
					<BanRow key={row.championId} row={row} enemyHidden={enemyHidden} version={version} />
				))}
			</ul>
			{statBanRows.length > 0 && (
				<div className="mt-[10px] border-t border-(--stroke-subtle) pt-[8px]">
					<span className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.06em] text-paper-400">
						Statistical counters to your pick
					</span>
					<ul className="mt-[6px] flex flex-col gap-[2px]">
						{statBanRows.map((row, i) => (
							<li
								key={row.champion?.key ?? i}
								className="flex items-center gap-[10px] rounded-sm px-[9px] py-[7px]"
							>
								<ChampionPortrait champion={row.champion} version={version} size={30} />
								<div className="min-w-0 flex-1">
									<span className="text-[13px] font-semibold leading-none text-paper-100">
										{row.champion?.name}
									</span>
									<div className="mt-[2px] text-[11px] leading-[1.3] text-paper-400">
										Beats your pick — not on your list
									</div>
								</div>
								<span className="shrink-0 font-mono text-[10px] leading-none text-warn">
									{formatWinRate(row.winRate)}
								</span>
							</li>
						))}
					</ul>
				</div>
			)}
		</Section>
	)
}

function BanRow({
	row,
	enemyHidden,
	version,
}: {
	row: BanRowVM
	enemyHidden: boolean
	version: string
}): React.JSX.Element {
	const gone = row.status === "banned" || row.status === "picked"
	const showThreat = row.threat && !enemyHidden
	return (
		<li
			className={cn(
				"flex items-center gap-[10px] rounded-sm border px-[9px] py-[7px]",
				showThreat
					? "border-[rgba(255,107,94,0.22)] bg-(--fail-bg)"
					: "border-transparent bg-transparent",
				gone && "opacity-[0.42]",
			)}
		>
			<ChampionPortrait champion={row.champion} version={version} size={30} dim={gone} />
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-[7px]">
					<span
						className={cn(
							"text-[13px] font-semibold leading-none",
							gone ? "text-paper-300 line-through" : "text-paper-100",
						)}
					>
						{row.champion?.name}
					</span>
					{showThreat && <ThreatBadge />}
					{row.counterWinRate != null && !gone && <CountersYouBadge winRate={row.counterWinRate} />}
				</div>
				{row.reason && (
					<div className="mt-[2px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-[1.3] text-paper-400">
						{row.reason}
					</div>
				)}
			</div>
			<span
				className={cn(
					"shrink-0 font-mono text-[9px] font-medium leading-none tracking-[0.06em] uppercase",
					gone ? "text-paper-400" : "text-accent",
				)}
			>
				{row.status === "banned" ? "Banned" : row.status === "picked" ? "Picked" : "Open"}
			</span>
		</li>
	)
}

function CollapsedBans({
	goneCount,
	onToggle,
}: {
	goneCount: number
	onToggle: () => void
}): React.JSX.Element {
	return (
		<Card hover onClick={onToggle} className="flex items-center justify-between px-4 py-[11.2px]">
			<div className="flex items-center gap-[9px]">
				<Shield size={15} strokeWidth={2} className="text-paper-300" />
				<span className="text-[12.5px] font-medium leading-none text-paper-200">
					Ban phase complete
				</span>
				<span className="font-mono text-[11px] leading-none text-paper-400">
					{goneCount} of your targets gone
				</span>
			</div>
			<ChevronDown size={15} strokeWidth={2} className="text-paper-400" />
		</Card>
	)
}

function EmptyBanList(): React.JSX.Element {
	const navigate = useNavigate()
	return (
		<div className="flex flex-1 items-center justify-center">
			<EmptyState
				icon={Shield}
				compact
				title="Your ban list is empty"
				line="Add the champions you never want to face."
				action={
					<Button variant="ghost" size="sm" onClick={() => navigate({ to: "/settings" })}>
						Manage ban list
					</Button>
				}
			/>
		</div>
	)
}
