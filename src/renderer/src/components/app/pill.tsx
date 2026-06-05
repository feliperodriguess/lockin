// Primitives.jsx:420-451 — Pill component.
// Tones: neutral/accent/info/warn/fail — bg/fg pairs from prototype.
// neutral: ink-800/paper-300; accent: --accent-bg/accent; info: --info-bg/info;
// warn: --warn-bg/warn; fail: --fail-bg/fail.
// Optional `dot` (5px circle) and `icon` (lucide component, 11px).
// mono 600 10px uppercase tracking 0.06em, pill shape (radius 999).

import { cn } from "@renderer/lib/utils"
import type { LucideIcon } from "lucide-react"

export type PillTone = "neutral" | "accent" | "info" | "warn" | "fail"

const TONE_CLASSES: Record<PillTone, string> = {
	neutral: "bg-[var(--color-ink-800)] text-[var(--color-paper-300)]",
	accent: "bg-[var(--accent-bg)] text-[var(--color-accent)]",
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
			{dot && <span className="shrink-0 rounded-full bg-current" style={{ width: 5, height: 5 }} />}
			{Icon && <Icon size={11} strokeWidth={2} className="shrink-0" />}
			{children}
		</span>
	)
}

export { Pill }
