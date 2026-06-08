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

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center text-center",
				compact ? "gap-[10px] p-[20px]" : "gap-[14px] p-[36px]",
				className,
			)}
		>
			<div
				className={cn(
					"grid place-items-center shrink-0",
					"bg-ink-850 border border-(--stroke-default)",
					"rounded-lg text-paper-300",
					compact ? "size-[44px]" : "size-[60px]",
					pulse && "ccp-breathe",
				)}
			>
				<Icon size={iconSize} strokeWidth={1.5} />
			</div>

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
								"text-paper-300 leading-normal",
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
