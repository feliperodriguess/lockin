import { formatRank, TIERS } from "@renderer/lib/rank-format"

import type { RankInfo } from "@/shared/types"

interface RankEmblemProps {
	tier: string
	size?: number
}

export function RankEmblem({ tier, size = 18 }: RankEmblemProps): React.JSX.Element {
	const t = TIERS[tier]
	const col = t ? t.color : "var(--fg-4)"
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			aria-hidden="true"
			style={{ flexShrink: 0 }}
		>
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
	// provisional states arrive with real data (Phase 7)
	const col = unranked ? "var(--fg-4)" : TIERS[rank.tier].color

	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: small ? 5 : 7 }}>
			{showEmblem &&
				(unranked ? (
					<span
						style={{
							width: small ? 14 : 18,
							height: small ? 14 : 18,
							borderRadius: "var(--radius-xs)",
							border: "1px dashed var(--stroke-strong)",
							display: "inline-block",
							flexShrink: 0,
						}}
					/>
				) : (
					<RankEmblem tier={rank?.tier} size={small ? 14 : 18} />
				))}
			<span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.15 }}>
				<span
					style={{
						font: `600 ${small ? 11 : 12}px/1.2 var(--font-mono)`,
						color: unranked ? "var(--fg-3)" : "var(--fg-1)",
						letterSpacing: "0.01em",
						whiteSpace: "nowrap",
					}}
				>
					{formatRank(rank)}
				</span>
				{!small && !unranked && (
					<span style={{ font: "400 10px/1 var(--font-mono)", color: col, marginTop: 2 }}>
						{rank?.lp} LP
					</span>
				)}
			</span>
		</span>
	)
}
