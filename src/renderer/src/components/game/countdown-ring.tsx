import { cn } from "@renderer/lib/utils"
import type { ReactNode } from "react"

interface CountdownRingProps {
	progress: number
	size?: number
	stroke?: number
	tone?: "accent" | "warn" | "fail"
	value?: ReactNode
	label?: string
	sub?: string
	pulsing?: boolean
}

export function CountdownRing({
	progress,
	size = 168,
	stroke = 8,
	tone = "accent",
	value,
	label,
	sub,
	pulsing,
}: CountdownRingProps): React.JSX.Element {
	const radius = (size - stroke) / 2
	const circ = 2 * Math.PI * radius
	const clamped = Math.max(0, Math.min(1, progress))
	// dynamic: toneColor is data-driven (tone prop) — used in SVG stroke and drop-shadow filter
	const toneColor =
		tone === "accent"
			? "var(--color-accent)"
			: tone === "warn"
				? "var(--color-warn)"
				: "var(--color-fail)"

	return (
		<div
			className="relative shrink-0"
			// dynamic: width/height derived from size prop
			style={{ width: size, height: size }}
		>
			<svg width={size} height={size} aria-hidden="true" className="block -rotate-90">
				{/* track */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--color-ink-800)"
					strokeWidth={stroke}
				/>
				{/* progress arc */}
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={toneColor}
					strokeWidth={stroke}
					strokeLinecap="round"
					// dynamic: dasharray/dashoffset are SVG geometry computed from radius/progress
					strokeDasharray={circ}
					strokeDashoffset={circ * (1 - clamped)}
					style={{
						transition:
							"stroke-dashoffset 980ms linear, stroke var(--dur-base) var(--ease-standard)",
						// dynamic: drop-shadow color is tone-derived
						filter: pulsing ? `drop-shadow(0 0 8px ${toneColor})` : "none",
					}}
				/>
			</svg>
			<div
				className={cn(
					"absolute inset-0 flex flex-col items-center justify-center gap-[2px]",
					pulsing && "ccp-breathe",
				)}
			>
				{value != null && (
					<div
						className="text-paper-100 tabular-nums leading-none font-normal"
						// dynamic: font-size derived from size prop; font-family is a CSS var
						style={{
							fontFamily: "var(--font-display)",
							fontSize: `${Math.round(size * 0.32)}px`,
						}}
					>
						{value}
					</div>
				)}
				{label && (
					<div
						className="font-mono text-[10px] font-semibold leading-none tracking-[0.14em] uppercase"
						// dynamic: color is tone-derived (accent uses brand accent color)
						style={{ color: tone === "accent" ? "var(--color-accent)" : toneColor }}
					>
						{label}
					</div>
				)}
				{sub && <div className="text-[11px] font-normal leading-none text-paper-300">{sub}</div>}
			</div>
		</div>
	)
}
