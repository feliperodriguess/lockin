// settings.jsx:7-40 — Group (Eyebrow + Card wrapper) and Row (title/desc/control).
// Group: Eyebrow line=22 + Card padding "4px 16px".
// Row: flex row, py 15px, bottom border stroke-subtle unless last;
//   title 500 14px fg-1; desc 400 12px/1.45 fg-4 maxW 380.

import { Card } from "@renderer/components/app/card"
import { Eyebrow } from "@renderer/components/app/eyebrow"

interface GroupProps {
	label: string
	children: React.ReactNode
}

export function Group({ label, children }: GroupProps): React.JSX.Element {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<Eyebrow line={22}>{label}</Eyebrow>
			<Card className="px-4 py-1">{children}</Card>
		</div>
	)
}

interface RowProps {
	title: string
	desc?: string
	control: React.ReactNode
	last?: boolean
}

export function Row({ title, desc, control, last }: RowProps): React.JSX.Element {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 20,
				padding: "15px 0",
				borderBottom: last ? "none" : "1px solid var(--stroke-subtle)",
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
				<span style={{ font: "500 14px/1.2 var(--font-ui)", color: "var(--fg-1)" }}>{title}</span>
				{desc && (
					<span
						style={{
							font: "400 12px/1.45 var(--font-ui)",
							color: "var(--fg-4)",
							maxWidth: 380,
						}}
					>
						{desc}
					</span>
				)}
			</div>
			<div style={{ flexShrink: 0 }}>{control}</div>
		</div>
	)
}
