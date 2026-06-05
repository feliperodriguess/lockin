import { champIconUrl, championFallbackColor } from "@renderer/lib/ddragon-urls"
import { cn } from "@renderer/lib/utils"
import { useState } from "react"

import type { ChampionStatic } from "@/shared/types"

interface ChampionPortraitProps {
	champion: ChampionStatic | null
	version: string
	size?: number
	hidden?: boolean
	dim?: boolean
	ring?: boolean
	className?: string
}

export function ChampionPortrait({
	champion,
	version,
	size = 40,
	hidden,
	dim,
	ring,
	className,
}: ChampionPortraitProps): React.JSX.Element {
	const [errKey, setErrKey] = useState<number | null>(null)
	// derived, not synced: a failed load only suppresses THIS champion's icon
	const err = champion != null && errKey === champion.key
	const r = Math.max(6, Math.round(size * 0.18))

	if (hidden || !champion) {
		return (
			<div
				className={cn(className)}
				style={{
					width: size,
					height: size,
					borderRadius: r,
					flexShrink: 0,
					background:
						"repeating-linear-gradient(135deg, var(--color-ink-850) 0 6px, var(--color-ink-900) 6px 12px)",
					border: "1px dashed var(--stroke-strong)",
					display: "grid",
					placeItems: "center",
					boxShadow: ring ? "0 0 0 2px var(--color-accent)" : "none",
				}}
			>
				<span
					style={{
						font: `400 ${Math.round(size * 0.5)}px/1 var(--font-display)`,
						color: "var(--fg-3)",
					}}
				>
					?
				</span>
			</div>
		)
	}

	// Extract initials like champ-art.jsx:44-50
	const initials = champion.name
		.replace(/[^A-Za-z' ]/g, "")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase()

	const fallbackBg = championFallbackColor(champion.key)

	return (
		<div
			className={cn(className)}
			style={{
				width: size,
				height: size,
				borderRadius: r,
				flexShrink: 0,
				position: "relative",
				overflow: "hidden",
				background: fallbackBg,
				border: "1px solid var(--stroke-default)",
				boxShadow: ring ? "0 0 0 2px var(--color-accent)" : "none",
			}}
		>
			{!err ? (
				<img
					src={champIconUrl(version, champion.imageFull)}
					alt={champion.name}
					onError={() => setErrKey(champion.key)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						display: "block",
						filter: dim ? "grayscale(0.6) brightness(0.6)" : "none",
					}}
				/>
			) : (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "grid",
						placeItems: "center",
						font: `600 ${Math.round(size * 0.34)}px/1 var(--font-ui)`,
						color: "rgba(255,255,255,0.92)",
						letterSpacing: "0.02em",
					}}
				>
					{initials}
				</div>
			)}
			{dim && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						background: "rgba(12,13,14,0.35)",
					}}
				/>
			)}
		</div>
	)
}
