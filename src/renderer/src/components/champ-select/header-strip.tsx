import { Card } from "@renderer/components/app/card"
import { YourPickBadge } from "@renderer/components/game/badges"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { CountdownRing } from "@renderer/components/game/countdown-ring"
import { RoleTag } from "@renderer/components/game/role"
import { SpellPair } from "@renderer/components/game/spell-pair"
import type { ChampSelectVM } from "@renderer/hooks/use-champ-select"
import { cn } from "@renderer/lib/utils"
import { CircleHelp } from "lucide-react"

interface HeaderStripProps {
	me: ChampSelectVM["me"]
	spells: ChampSelectVM["spells"]
	layout: "DF" | "FD"
	version: string
	subPhase: ChampSelectVM["subPhase"]
	secondsLeft: number
	phaseTotal: number
	timerVisible: boolean
}

export function HeaderStrip({
	me,
	spells,
	layout,
	version,
	subPhase,
	secondsLeft,
	phaseTotal,
	timerVisible,
}: HeaderStripProps): React.JSX.Element {
	const danger = secondsLeft <= 10
	const tone = danger ? "warn" : "accent"
	const showYourPick = spells.source === "pinned"

	return (
		<Card className="flex min-h-[78px] items-center justify-between gap-3 p-4">
			<div className="flex min-w-0 items-center gap-3">
				<ChampionPortrait champion={me.champion} version={version} size={46} ring radius={10} />
				<div className="flex min-w-0 flex-col gap-[6px]">
					<div className="flex items-center gap-[9px]">
						<span className="text-[16px] font-semibold leading-none tracking-[-0.01em] text-paper-100">
							{me.champion?.name}
						</span>
					</div>
					<div className="flex min-w-0 items-center gap-2">
						{me.role ? (
							<RoleTag role={me.role} active />
						) : (
							<span
								className={cn(
									"inline-flex shrink-0 items-center gap-[5px]",
									"rounded-sm px-2 py-[3px]",
									"font-mono text-[10px] font-medium leading-none tracking-[0.06em] uppercase",
									"text-warn bg-(--warn-bg)",
								)}
							>
								<CircleHelp size={11} strokeWidth={2} />
								Role pending
							</span>
						)}
						<span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] font-medium leading-[1.3] text-paper-400">
							{me.name}
						</span>
					</div>
				</div>
				{/* 1px × 40px divider */}
				<span className="shrink-0 w-px h-10 bg-(--stroke-default)" />
				<div className="flex shrink-0 items-center gap-2">
					<SpellPair pair={spells.pair} version={version} layout={layout} size={32} showKeys />
					{showYourPick && <YourPickBadge />}
				</div>
			</div>

			{timerVisible && (
				<div className="flex shrink-0 items-center gap-[10px]">
					<div className="flex flex-col items-end gap-[5px]">
						<span
							className={cn(
								"font-mono text-[10px] font-semibold leading-none tracking-[0.14em] uppercase",
								danger ? "text-warn" : "text-paper-300",
							)}
						>
							{subPhase === "ban" ? "Ban phase" : "Pick phase"}
						</span>
					</div>
					<CountdownRing
						size={54}
						stroke={5}
						progress={secondsLeft / phaseTotal}
						tone={tone}
						value={secondsLeft}
						sub=""
						pulsing={danger}
					/>
				</div>
			)}
		</Card>
	)
}
