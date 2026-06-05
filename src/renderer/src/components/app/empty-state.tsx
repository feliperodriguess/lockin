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
	// dynamic: tile/gap/pad/text sizes are derived from compact prop; non-standard values
	const tileSize = compact ? 44 : 60
	const gap = compact ? 10 : 14
	const pad = compact ? 20 : 36

	return (
		<div
			className={cn("flex flex-col items-center justify-center text-center", className)}
			// dynamic: gap and padding derived from compact prop
			style={{ gap, padding: pad }}
		>
			{/* icon tile */}
			<div
				className={cn(
					"grid place-items-center shrink-0",
					"bg-ink-850 border border-[var(--stroke-default)]",
					"rounded-lg text-paper-300",
					pulse && "ccp-breathe",
				)}
				// dynamic: width/height derived from compact prop
				style={{ width: tileSize, height: tileSize }}
			>
				<Icon size={iconSize} strokeWidth={1.5} />
			</div>

			{/* text block */}
			{(title || line) && (
				<div className="flex flex-col gap-[5px] max-w-[280px]">
					{title && (
						<p
							className={cn(
								"text-paper-100 leading-[1.3]",
								compact ? "text-[14px] font-medium" : "text-[15px] font-medium",
							)}
						>
							{title}
						</p>
					)}
					{line && (
						<p
							className={cn(
								"text-paper-300 leading-[1.5]",
								compact ? "text-[12px]" : "text-[13px]",
							)}
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
