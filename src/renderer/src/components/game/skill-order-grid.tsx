import { type Ability, formatSkillOrder, type SkillRow } from "@renderer/lib/skill-order"
import { cn } from "@renderer/lib/utils"

import type { BuildRecommendation } from "@/shared/types"

/* per-ability accent (data-driven runtime color → inline style is allowed) */
const ABILITY_COLOR: Record<Ability, string> = {
	Q: "var(--color-accent)",
	W: "#5db5ff",
	E: "#c98bff",
	R: "#ffcf5d",
}

/** stable level-number array 1..18 for the header row */
const LEVELS = Array.from({ length: 18 }, (_, i) => i + 1)

interface SkillOrderGridProps {
	skillOrder: BuildRecommendation["skillOrder"]
	skillPriority: BuildRecommendation["skillPriority"]
}

export function SkillOrderGrid({
	skillOrder,
	skillPriority,
}: SkillOrderGridProps): React.JSX.Element {
	const rows = formatSkillOrder(skillOrder as Ability[])
	return (
		<div className="flex flex-col gap-[10px]">
			<PriorityLine priority={skillPriority} />
			<div className="flex flex-col gap-[3px]">
				{/* header: level numbers 1..18 */}
				<div className="flex items-center gap-[3px] pl-[22px]">
					{LEVELS.map((level) => (
						<span
							key={level}
							className="w-[16px] text-center font-mono text-[8px] font-semibold leading-none text-paper-400"
						>
							{level}
						</span>
					))}
				</div>
				{rows.map((row) => (
					<GridRow key={row.ability} row={row} />
				))}
			</div>
		</div>
	)
}

function GridRow({ row }: { row: SkillRow }): React.JSX.Element {
	const color = ABILITY_COLOR[row.ability]
	return (
		<div className="flex items-center gap-[3px]">
			<span
				className="w-[19px] text-center font-mono text-[10px] font-bold leading-none"
				// dynamic: ability-keyed accent color
				style={{ color }}
			>
				{row.ability}
			</span>
			{row.cells.map((cell, i) => (
				<span
					key={LEVELS[i]}
					className={cn(
						"flex h-[16px] w-[16px] items-center justify-center rounded-[3px] font-mono text-[8px] font-bold leading-none",
						cell.active ? "text-ink-950" : "bg-ink-800 text-transparent",
					)}
					// dynamic: active cells take the ability's accent as background
					style={cell.active ? { backgroundColor: color } : undefined}
				>
					{cell.active ? cell.point : "·"}
				</span>
			))}
		</div>
	)
}

function PriorityLine({ priority }: { priority: ("Q" | "W" | "E")[] }): React.JSX.Element | null {
	if (priority.length === 0) return null
	return (
		<div className="flex items-center gap-[6px]">
			<span className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-paper-400">
				Max order
			</span>
			<div className="flex items-center gap-[5px]">
				{priority.map((a, i) => (
					<div key={a} className="flex items-center gap-[5px]">
						{i > 0 && <span className="text-[11px] leading-none text-paper-400">›</span>}
						<span
							className="flex h-[18px] w-[18px] items-center justify-center rounded-[3px] font-mono text-[10px] font-bold leading-none text-ink-950"
							// dynamic: ability-keyed accent color
							style={{ backgroundColor: ABILITY_COLOR[a] }}
						>
							{a}
						</span>
					</div>
				))}
			</div>
		</div>
	)
}
