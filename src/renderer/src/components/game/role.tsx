import { type DisplayRole, ROLE_ABBR, ROLE_GLYPH_POS } from "@renderer/lib/roles"

interface RoleGlyphProps {
	role: DisplayRole | null
	size?: number
	color?: string
}

export function RoleGlyph({
	role,
	size = 16,
	color = "currentColor",
}: RoleGlyphProps): React.JSX.Element {
	const pos = role ? ROLE_GLYPH_POS[role] : ([12, 12] as [number, number])
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			style={{ flexShrink: 0 }}
		>
			<line
				x1="3"
				y1="21"
				x2="21"
				y2="3"
				stroke={color}
				strokeWidth="1.4"
				strokeOpacity="0.35"
				strokeLinecap="round"
			/>
			<circle cx={pos[0]} cy={pos[1]} r="3.4" fill={color} />
		</svg>
	)
}

interface RoleTagProps {
	role: DisplayRole
	active?: boolean
}

export function RoleTag({ role, active }: RoleTagProps): React.JSX.Element {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 5,
				padding: "3px 8px",
				borderRadius: "var(--radius-sm)",
				background: active ? "var(--accent-bg)" : "var(--color-ink-800)",
				color: active ? "var(--color-accent)" : "var(--fg-2)",
				font: "600 10px/1 var(--font-mono)",
				letterSpacing: "0.08em",
			}}
		>
			<RoleGlyph role={role} size={12} />
			{ROLE_ABBR[role]}
		</span>
	)
}
