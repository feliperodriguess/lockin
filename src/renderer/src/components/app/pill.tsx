import { cn } from "@renderer/lib/utils"
import type { LucideIcon } from "lucide-react"

export type PillTone = "neutral" | "accent" | "info" | "warn" | "fail"

const TONE_CLASSES: Record<PillTone, string> = {
	neutral: "bg-ink-800 text-paper-300",
	accent: "bg-[var(--accent-bg)] text-accent",
	info: "bg-[var(--info-bg)] text-[var(--color-info)]",
	warn: "bg-[var(--warn-bg)] text-[var(--color-warn)]",
	fail: "bg-[var(--fail-bg)] text-[var(--color-fail)]",
}

interface PillProps {
	tone?: PillTone
	dot?: boolean
	icon?: LucideIcon
	children?: React.ReactNode
	className?: string
}

function Pill({
	tone = "neutral",
	dot,
	icon: Icon,
	children,
	className,
}: PillProps): React.JSX.Element {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-[5px]",
				"px-[9px] py-[3px] rounded-full",
				"font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.06em]",
				"whitespace-nowrap",
				TONE_CLASSES[tone],
				className,
			)}
		>
			{dot && <span className="shrink-0 size-[5px] rounded-full bg-current" />}
			{Icon && <Icon size={11} strokeWidth={2} className="shrink-0" />}
			{children}
		</span>
	)
}

export { Pill }
