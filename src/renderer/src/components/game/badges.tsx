import { cn } from "@renderer/lib/utils"
import { Pin, TriangleAlert } from "lucide-react"

export function YourPickBadge(): React.JSX.Element {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1",
				"px-[7px] py-[2px] rounded-full",
				"bg-[var(--accent-bg)] text-accent",
				"font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.06em]",
			)}
		>
			<Pin size={10} strokeWidth={2} />
			Your pick
		</span>
	)
}

export function ThreatBadge(): React.JSX.Element {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1",
				"px-[7px] py-[2px] rounded-full",
				"bg-[var(--fail-bg)] text-[var(--color-fail)]",
				"font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.06em]",
			)}
		>
			<TriangleAlert size={10} strokeWidth={2} />
			Threat
		</span>
	)
}

interface MismatchFlagProps {
	label?: string
}

export function MismatchFlag({ label = "Rank spread" }: MismatchFlagProps): React.JSX.Element {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-[5px]",
				"px-2 py-[3px] rounded-sm",
				"bg-[var(--warn-bg)] text-[var(--color-warn)]",
				"border border-[rgba(245,183,64,0.25)]",
				"font-mono text-[10px] font-semibold uppercase leading-none tracking-[0.04em]",
			)}
		>
			<TriangleAlert size={11} strokeWidth={2} />
			{label}
		</span>
	)
}
