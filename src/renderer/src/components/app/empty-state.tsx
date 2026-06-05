// Primitives.jsx:514-563 — EmptyState.
// Icon tile: 60px (compact: 44px), ink-850 bg, border stroke-default, radius-lg.
// `pulse` adds ccp-breathe animation (defined in global.css).
// title: 500 15px (compact: 14px); line: 400 13px (compact: 12px); maxWidth 280.
// Gap: 14 default, 10 compact. Padding: 36 default, 20 compact.
// Icon passed as a lucide component (not rendered as 'name' string).

import { cn } from "@renderer/lib/utils"
import type { LucideIcon } from "lucide-react"

interface EmptyStateProps {
	icon: LucideIcon
	title?: string
	line?: string
	action?: React.ReactNode
	pulse?: boolean
	compact?: boolean
	className?: string
}

function EmptyState({
	icon: Icon,
	title,
	line,
	action,
	pulse,
	compact,
	className,
}: EmptyStateProps): React.JSX.Element {
	const iconSize = compact ? 20 : 26
	const tileSize = compact ? 44 : 60
	const gap = compact ? 10 : 14
	const pad = compact ? 20 : 36

	return (
		<div
			className={cn("flex flex-col items-center justify-center text-center", className)}
			style={{ gap, padding: pad }}
		>
			{/* icon tile */}
			<div
				className={cn(
					"grid place-items-center shrink-0",
					"bg-[var(--color-ink-850)] border border-[var(--stroke-default)]",
					"rounded-[var(--radius-lg)] text-[var(--fg-3)]",
					pulse && "ccp-breathe",
				)}
				style={{ width: tileSize, height: tileSize }}
			>
				<Icon size={iconSize} strokeWidth={1.5} />
			</div>

			{/* text block */}
			{(title || line) && (
				<div className="flex flex-col gap-[5px]" style={{ maxWidth: 280 }}>
					{title && (
						<p
							className="text-[var(--fg-1)] leading-[1.3]"
							style={{ font: `500 ${compact ? 14 : 15}px/1.3 var(--font-ui)` }}
						>
							{title}
						</p>
					)}
					{line && (
						<p
							className="text-[var(--fg-3)] leading-[1.5]"
							style={{ font: `400 ${compact ? 12 : 13}px/1.5 var(--font-ui)` }}
						>
							{line}
						</p>
					)}
				</div>
			)}

			{action}
		</div>
	)
}

export { EmptyState }
