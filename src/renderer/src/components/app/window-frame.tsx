/* WindowFrame — real Electron titlebar with hiddenInset traffic lights
   Ported from app.jsx:351-449. NO painted traffic-light dots. */

import { phaseSub } from "@renderer/lib/phase"
import { useEffect, useState } from "react"

import type { GameflowPhase } from "@/shared/types"

import { ConnectionIndicator } from "./connection-indicator"
import { Wordmark } from "./wordmark"

interface WindowFrameProps {
	children: React.ReactNode
	connected: boolean
	phase: GameflowPhase
}

export function WindowFrame({ children, connected, phase }: WindowFrameProps): React.JSX.Element {
	const [now, setNow] = useState("")

	useEffect(() => {
		const tick = () =>
			setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
		tick()
		const id = setInterval(tick, 15000)
		return () => clearInterval(id)
	}, [])

	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-[var(--bg-canvas)]">
			{/* titlebar */}
			<header
				className="region-drag"
				style={{
					height: 36,
					flexShrink: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "0 14px",
					background: "rgba(17,19,21,0.86)",
					backdropFilter: "blur(12px)",
					borderBottom: "1px solid var(--stroke-default)",
				}}
			>
				{/* left spacer — clears the real hiddenInset traffic lights (trafficLightPosition x:20) */}
				<div className="w-[120px]" />

				{/* center: wordmark + phase sub-label */}
				<span
					className="region-no-drag"
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						font: "500 12px/1 var(--font-ui)",
						color: "var(--fg-3)",
					}}
				>
					<Wordmark size={12} mark={false} />
					<span style={{ color: "var(--fg-4)" }}>·</span>
					<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>
						{phaseSub(connected, phase)}
					</span>
				</span>

				{/* right: connection indicator + clock */}
				<div
					style={{
						width: 120,
						display: "flex",
						justifyContent: "flex-end",
						alignItems: "center",
						gap: 10,
					}}
				>
					<ConnectionIndicator connected={connected} compact />
					<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>{now}</span>
				</div>
			</header>

			{children}
		</div>
	)
}
