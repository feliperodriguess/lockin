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
		<div className="flex h-full w-full flex-col overflow-hidden bg-ink-950">
			{/* titlebar */}
			<header
				className="region-drag h-9 shrink-0 flex items-center justify-between px-[14px] border-b border-[var(--stroke-default)]"
				style={{
					// dynamic: backdrop-filter and semi-transparent bg are not Tailwind utilities
					background: "rgba(17,19,21,0.86)",
					backdropFilter: "blur(12px)",
				}}
			>
				{/* left spacer — clears the real hiddenInset traffic lights (trafficLightPosition x:20) */}
				<div className="w-[120px]" />

				{/* center: wordmark + phase sub-label */}
				<span className="region-no-drag inline-flex items-center gap-2 text-[12px] font-medium leading-none text-paper-300">
					<Wordmark size={12} mark={false} />
					<span className="text-paper-400">·</span>
					<span className="font-mono text-[11px] font-normal leading-none text-paper-400">
						{phaseSub(connected, phase)}
					</span>
				</span>

				{/* right: connection indicator + clock */}
				<div className="w-[120px] flex justify-end items-center gap-[10px]">
					<ConnectionIndicator connected={connected} compact />
					<time className="font-mono text-[11px] font-normal leading-none text-paper-400">
						{now}
					</time>
				</div>
			</header>

			{children}
		</div>
	)
}
