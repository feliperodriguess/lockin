// Primitives.jsx:478-511 — Eyebrow label + AfterLine accent dash.
// Eyebrow: mono 600 10px uppercase tracking 0.16em fg-3.
// AfterLine: accent bg, 1.5px tall, width controlled by prop.
// Eyebrow `line` prop: number (explicit px width) | true (24px default).

import { cn } from "@renderer/lib/utils"

interface AfterLineProps {
	width?: number
	className?: string
}

function AfterLine({ width = 28, className }: AfterLineProps): React.JSX.Element {
	return (
		<span
			className={cn("inline-block shrink-0 bg-accent align-middle", className)}
			// dynamic: width is prop-driven; height is 1.5px (non-standard, not in Tailwind scale)
			style={{ width, height: 1.5 }}
		/>
	)
}

interface EyebrowProps {
	children: React.ReactNode
	line?: number | boolean
	className?: string
}

function Eyebrow({ children, line, className }: EyebrowProps): React.JSX.Element {
	const lineWidth = line === true ? 24 : typeof line === "number" ? line : undefined
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<span className="font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-paper-300 whitespace-nowrap">
				{children}
			</span>
			{lineWidth !== undefined && <AfterLine width={lineWidth} />}
		</div>
	)
}

export { AfterLine, Eyebrow }
