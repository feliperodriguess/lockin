import { type DisplayRole, ROLE_ABBR, ROLE_GLYPH_POS } from "@renderer/lib/roles"
import { cn } from "@renderer/lib/utils"

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
	// dynamic: cx/cy are data-driven from role → ROLE_GLYPH_POS lookup
	const pos = role ? ROLE_GLYPH_POS[role] : ([12, 12] as [number, number])
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			aria-hidden="true"
			className="shrink-0"
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
			{/* dynamic: cx/cy derived from role glyph position */}
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
			className={cn(
				"inline-flex items-center gap-[5px]",
				"px-2 py-[3px] rounded-sm",
				"font-mono text-[10px] font-semibold leading-none tracking-[0.08em]",
				active ? "bg-[var(--accent-bg)] text-accent" : "bg-ink-800 text-paper-200",
			)}
		>
			<RoleGlyph role={role} size={12} />
			{ROLE_ABBR[role]}
		</span>
	)
}
