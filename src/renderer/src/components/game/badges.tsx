import { Pin, TriangleAlert } from "lucide-react"

export function YourPickBadge(): React.JSX.Element {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				padding: "2px 7px",
				borderRadius: 999,
				background: "var(--accent-bg)",
				color: "var(--color-accent)",
				font: "600 9px/1 var(--font-mono)",
				letterSpacing: "0.06em",
				textTransform: "uppercase",
			}}
		>
			<Pin size={10} strokeWidth={2} />
			Your pick
		</span>
	)
}

export function ThreatBadge(): React.JSX.Element {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				padding: "2px 7px",
				borderRadius: 999,
				background: "var(--fail-bg)",
				color: "var(--color-fail)",
				font: "600 9px/1 var(--font-mono)",
				letterSpacing: "0.06em",
				textTransform: "uppercase",
			}}
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
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 5,
				padding: "3px 8px",
				borderRadius: "var(--radius-sm)",
				background: "rgba(245,183,64,0.25)",
				color: "var(--color-warn)",
				border: "1px solid rgba(245,183,64,0.25)",
				font: "600 10px/1 var(--font-mono)",
				letterSpacing: "0.04em",
				textTransform: "uppercase",
			}}
		>
			<TriangleAlert size={11} strokeWidth={2} />
			{label}
		</span>
	)
}
