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
	const toneColor =
		tone === "accent"
			? "var(--color-accent)"
			: tone === "warn"
				? "var(--color-warn)"
				: "var(--color-fail)"

	return (
		<div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
			<svg
				width={size}
				height={size}
				aria-hidden="true"
				style={{ transform: "rotate(-90deg)", display: "block" }}
			>
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
					strokeDasharray={circ}
					strokeDashoffset={circ * (1 - clamped)}
					style={{
						transition:
							"stroke-dashoffset 980ms linear, stroke var(--dur-base) var(--ease-standard)",
						filter: pulsing ? `drop-shadow(0 0 8px ${toneColor})` : "none",
					}}
				/>
			</svg>
			<div
				className={pulsing ? "ccp-breathe" : undefined}
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 2,
				}}
			>
				{value != null && (
					<div
						style={{
							fontFamily: "var(--font-display)",
							fontSize: `${Math.round(size * 0.32)}px`,
							fontWeight: 400,
							lineHeight: 1,
							fontVariantNumeric: "tabular-nums",
							color: "var(--fg-1)",
						}}
					>
						{value}
					</div>
				)}
				{label && (
					<div
						style={{
							font: "600 10px/1 var(--font-mono)",
							letterSpacing: "0.14em",
							textTransform: "uppercase",
							color: tone === "accent" ? "var(--color-accent)" : toneColor,
						}}
					>
						{label}
					</div>
				)}
				{sub && (
					<div style={{ font: "400 11px/1 var(--font-ui)", color: "var(--fg-3)" }}>{sub}</div>
				)}
			</div>
		</div>
	)
}
