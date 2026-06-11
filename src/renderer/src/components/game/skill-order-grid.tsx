import { passiveIconUrl, spellIconUrl } from "@renderer/lib/ddragon-urls"
import { cn } from "@renderer/lib/utils"
import { ChevronRight } from "lucide-react"
import { useState } from "react"

import type { BuildRecommendation, ChampionAbilities } from "@/shared/types"

type Ability = "Q" | "W" | "E" | "R"

const ABILITY_ROWS: Ability[] = ["Q", "W", "E", "R"]

const ABILITY_COLOR: Record<Ability, string> = {
	Q: "var(--color-accent)",
	W: "#5db5ff",
	E: "#c98bff",
	R: "#ffcf5d",
}

const LEVELS = Array.from({ length: 18 }, (_, i) => i + 1)

const CELL = "h-[22px] w-[22px]" // one sizing for header numbers, cells, and key tiles

interface SkillOrderGridProps {
	skillOrder: BuildRecommendation["skillOrder"]
	skillPriority: BuildRecommendation["skillPriority"]
	abilities: ChampionAbilities | null
	version: string
}

export function SkillOrderGrid({
	skillOrder,
	skillPriority,
	abilities,
	version,
}: SkillOrderGridProps): React.JSX.Element {
	return (
		<div className="flex flex-col gap-[10px]">
			<PriorityLine priority={skillPriority} />
			<div className="flex flex-col gap-[3px]">
				{/* header: passive icon over the row-icon column, then level numbers */}
				<div className="flex items-center gap-[3px]">
					<span className={cn(CELL, "flex items-center justify-center")}>
						{abilities?.passive ? (
							<RowIcon
								src={passiveIconUrl(version, abilities.passive.imageFull)}
								name={abilities.passive.name}
							/>
						) : null}
					</span>
					{LEVELS.map((level) => (
						<span
							key={level}
							className={cn(
								CELL,
								"flex items-center justify-center font-mono text-[10px] font-semibold leading-none text-paper-400",
							)}
						>
							{level}
						</span>
					))}
				</div>

				{ABILITY_ROWS.map((ability) => (
					<GridRow
						key={ability}
						ability={ability}
						skillOrder={skillOrder}
						abilities={abilities}
						version={version}
					/>
				))}
			</div>
		</div>
	)
}

function GridRow({
	ability,
	skillOrder,
	abilities,
	version,
}: {
	ability: Ability
	skillOrder: BuildRecommendation["skillOrder"]
	abilities: ChampionAbilities | null
	version: string
}): React.JSX.Element {
	const detail = abilities?.abilities.find((a) => a.key === ability) ?? null
	const color = ABILITY_COLOR[ability]
	return (
		<div className="flex items-center gap-[3px]">
			<span className={cn(CELL, "flex items-center justify-center")}>
				{detail?.imageFull ? (
					<RowIcon src={spellIconUrl(version, detail.imageFull)} name={detail.name} />
				) : (
					<span className="font-mono text-[11px] font-bold leading-none" style={{ color }}>
						{ability}
					</span>
				)}
			</span>
			{LEVELS.map((level) => {
				const active = skillOrder[level - 1] === ability
				return (
					<span
						key={level}
						className={cn(
							CELL,
							"flex items-center justify-center rounded-[4px] font-mono text-[11px] font-bold leading-none",
							active ? "bg-ink-950 border border-(--stroke-default)" : "bg-ink-800/60",
						)}
						style={active ? { color } : undefined}
					>
						{active ? ability : ""}
					</span>
				)
			})}
		</div>
	)
}

function PriorityLine({ priority }: { priority: ("Q" | "W" | "E")[] }): React.JSX.Element | null {
	if (priority.length === 0) return null
	return (
		<div className="flex items-center gap-[10px]">
			<span className="font-mono text-[9px] font-semibold uppercase leading-none tracking-widest text-paper-400">
				Max order
			</span>
			<ol className="m-0 flex items-center gap-[6px] p-0">
				{priority.map((ability, i) => (
					<li key={ability} className="flex items-center gap-[6px]">
						{i > 0 && <ChevronRight size={15} className="shrink-0 text-paper-400" />}
						<span
							className={cn(
								CELL,
								"flex items-center justify-center rounded-[4px] border border-(--stroke-default) bg-ink-950 font-mono text-[12px] font-bold leading-none",
							)}
							style={{ color: ABILITY_COLOR[ability] }}
						>
							{ability}
						</span>
					</li>
				))}
			</ol>
		</div>
	)
}

/** Small ability/passive icon with a letter-free, image-only treatment. */
function RowIcon({ src, name }: { src: string; name: string }): React.JSX.Element | null {
	const [err, setErr] = useState(false)
	if (err) return null
	return (
		<img
			src={src}
			alt={name}
			title={name}
			onError={() => setErr(true)}
			className="block size-5.5 rounded-[4px] border border-(--stroke-default) object-cover"
		/>
	)
}
