import { formatRank, TIERS } from "@renderer/lib/rank-format"
import { cn } from "@renderer/lib/utils"

import type { RankInfo } from "@/shared/types"

interface RankEmblemProps {
	tier: string
	size?: number
}

export function RankEmblem({ tier, size = 18 }: RankEmblemProps): React.JSX.Element {
	// dynamic: col is data-driven from tier name
	const t = TIERS[tier]
	const col = t ? t.color : "var(--fg-4)"
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
			<path
				d="M12 2 L21 8 L12 22 L3 8 Z"
				fill={col}
				fillOpacity="0.22"
				stroke={col}
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
			<path d="M12 2 L16 8 L12 14 L8 8 Z" fill={col} fillOpacity="0.85" />
		</svg>
	)
}

interface RankBadgeProps {
	rank: RankInfo | null
	size?: "sm" | "md"
	showEmblem?: boolean
}

export function RankBadge({
	rank,
	size = "md",
	showEmblem = true,
}: RankBadgeProps): React.JSX.Element {
	const small = size === "sm"
	const unranked = !rank || !TIERS[rank.tier]
	// dynamic: col is data-driven from rank tier
	const col = unranked ? "var(--fg-4)" : TIERS[rank.tier].color

	return (
		<span className={cn("inline-flex items-center", small ? "gap-[5px]" : "gap-[7px]")}>
			{showEmblem &&
				(unranked ? (
					<span
						className={cn(
							"inline-block shrink-0 rounded-xs border border-dashed border-(--stroke-strong)",
							small ? "w-[14px] h-[14px]" : "w-[18px] h-[18px]",
						)}
					/>
				) : (
					<RankEmblem tier={rank.tier} size={small ? 14 : 18} />
				))}
			<span className="inline-flex flex-col leading-[1.15]">
				<span
					className={cn(
						"font-mono font-semibold leading-[1.2] tracking-[0.01em] whitespace-nowrap",
						small ? "text-[11px]" : "text-[12px]",
						unranked ? "text-paper-300" : "text-paper-100",
					)}
				>
					{formatRank(rank)}
				</span>
				{!small && !unranked && (
					<span
						className="text-[10px] font-mono font-normal leading-none mt-[2px]"
						// dynamic: color is data-driven from tier color
						style={{ color: col }}
					>
						{rank?.lp} LP
					</span>
				)}
			</span>
		</span>
	)
}
