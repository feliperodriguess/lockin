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
	radius?: number
	className?: string
}

export function ChampionPortrait({
	champion,
	version,
	size = 40,
	hidden,
	dim,
	ring,
	radius,
	className,
}: ChampionPortraitProps): React.JSX.Element {
	const [errKey, setErrKey] = useState<number | null>(null)
	// derived, not synced: a failed load only suppresses THIS champion's icon
	const err = champion != null && errKey === champion.key
	const r = radius ?? Math.max(6, Math.round(size * 0.18))

	if (hidden || !champion) {
		return (
			<div
				className={cn("grid place-items-center shrink-0", className)}
				// dynamic: width/height/borderRadius/boxShadow derived from size/ring props
				style={{
					width: size,
					height: size,
					borderRadius: r,
					background:
						"repeating-linear-gradient(135deg, var(--color-ink-850) 0 6px, var(--color-ink-900) 6px 12px)",
					border: "1px dashed var(--stroke-strong)",
					boxShadow: ring ? "0 0 0 2px var(--color-accent)" : "none",
				}}
			>
				<span
					className="text-paper-300"
					// dynamic: font-size derived from size prop
					style={{ font: `400 ${Math.round(size * 0.5)}px/1 var(--font-display)` }}
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

	// dynamic: fallback bg is data-driven (hsl based on champion key)
	const fallbackBg = championFallbackColor(champion.key)

	return (
		<div
			className={cn(
				"relative overflow-hidden shrink-0 border border-(--stroke-default)",
				className,
			)}
			style={{
				width: size,
				height: size,
				borderRadius: r,
				background: fallbackBg,
				boxShadow: ring ? "0 0 0 2px var(--color-accent)" : "none",
			}}
		>
			{!err ? (
				<img
					src={champIconUrl(version, champion.imageFull)}
					alt={champion.name}
					onError={() => setErrKey(champion.key)}
					className={cn(
						"w-full h-full object-cover block",
						"transition-[filter] duration-(--dur-slow) ease-(--ease-standard)",
						dim && "grayscale-[0.6] brightness-[0.6]",
					)}
				/>
			) : (
				<div
					className="w-full h-full grid place-items-center text-white/90 tracking-[0.02em]"
					// dynamic: font-size derived from size prop
					style={{ font: `600 ${Math.round(size * 0.34)}px/1 var(--font-ui)` }}
				>
					{initials}
				</div>
			)}
			<div
				className={cn(
					"absolute inset-0 bg-[rgba(12,13,14,0.35)] pointer-events-none",
					"transition-opacity duration-(--dur-slow) ease-(--ease-standard)",
					dim ? "opacity-100" : "opacity-0",
				)}
			/>
		</div>
	)
}
