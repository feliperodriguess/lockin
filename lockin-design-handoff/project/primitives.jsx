/* global React */
/* =========================================================================
   Champ Co-Pilot — UI primitives (chrome)
   Adapted from AfterCode. Accent is driven by --accent (swappable via Tweaks).
   ========================================================================= */
const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React

/* ------------------------------- Icon ---------------------------------- */
function Icon({ name, size = 16, stroke = 1.75, style, className }) {
	const p = {
		lock: (
			<>
				<rect x="3" y="11" width="18" height="11" rx="2" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</>
		),
		unlock: (
			<>
				<rect x="3" y="11" width="18" height="11" rx="2" />
				<path d="M7 11V7a5 5 0 0 1 9.9-1" />
			</>
		),
		wifi: (
			<>
				<path d="M5 13a10 10 0 0 1 14 0" />
				<path d="M8.5 16.5a5 5 0 0 1 7 0" />
				<line x1="12" y1="20" x2="12.01" y2="20" />
				<path d="M2 8.82a15 15 0 0 1 20 0" />
			</>
		),
		wifioff: (
			<>
				<line x1="2" y1="2" x2="22" y2="22" />
				<path d="M8.5 16.5a5 5 0 0 1 7 0" />
				<path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
				<path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
				<path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
				<path d="M5 13a10 10 0 0 1 5.24-2.76" />
				<line x1="12" y1="20" x2="12.01" y2="20" />
			</>
		),
		plus: (
			<>
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</>
		),
		search: (
			<>
				<circle cx="11" cy="11" r="8" />
				<line x1="21" y1="21" x2="16.65" y2="16.65" />
			</>
		),
		x: (
			<>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</>
		),
		check: <polyline points="20 6 9 17 4 12" />,
		chevright: <polyline points="9 18 15 12 9 6" />,
		chevdown: <polyline points="6 9 12 15 18 9" />,
		chevup: <polyline points="18 15 12 9 6 15" />,
		alert: (
			<>
				<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
				<line x1="12" y1="9" x2="12" y2="13" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</>
		),
		trash: (
			<>
				<polyline points="3 6 5 6 21 6" />
				<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
			</>
		),
		grip: (
			<>
				<circle cx="9" cy="6" r="1" />
				<circle cx="9" cy="12" r="1" />
				<circle cx="9" cy="18" r="1" />
				<circle cx="15" cy="6" r="1" />
				<circle cx="15" cy="12" r="1" />
				<circle cx="15" cy="18" r="1" />
			</>
		),
		settings: (
			<>
				<circle cx="12" cy="12" r="3" />
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
			</>
		),
		edit: (
			<>
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
			</>
		),
		pin: (
			<>
				<path d="M12 17v5" />
				<path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
			</>
		),
		clock: (
			<>
				<circle cx="12" cy="12" r="10" />
				<polyline points="12 6 12 12 16 14" />
			</>
		),
		swords: (
			<>
				<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
				<line x1="13" y1="19" x2="19" y2="13" />
				<line x1="16" y1="16" x2="20" y2="20" />
				<line x1="19" y1="21" x2="21" y2="19" />
				<polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
				<line x1="5" y1="14" x2="9" y2="18" />
				<line x1="7" y1="17" x2="4" y2="20" />
				<line x1="3" y1="19" x2="5" y2="21" />
			</>
		),
		shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
		activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
		book: (
			<>
				<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
				<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
			</>
		),
		sliders: (
			<>
				<line x1="4" y1="21" x2="4" y2="14" />
				<line x1="4" y1="10" x2="4" y2="3" />
				<line x1="12" y1="21" x2="12" y2="12" />
				<line x1="12" y1="8" x2="12" y2="3" />
				<line x1="20" y1="21" x2="20" y2="16" />
				<line x1="20" y1="12" x2="20" y2="3" />
				<line x1="1" y1="14" x2="7" y2="14" />
				<line x1="9" y1="8" x2="15" y2="8" />
				<line x1="17" y1="16" x2="23" y2="16" />
			</>
		),
		bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
		eye: (
			<>
				<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
				<circle cx="12" cy="12" r="3" />
			</>
		),
		eyeoff: (
			<>
				<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
				<line x1="1" y1="1" x2="23" y2="23" />
			</>
		),
		refresh: (
			<>
				<polyline points="23 4 23 10 17 10" />
				<polyline points="1 20 1 14 7 14" />
				<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
			</>
		),
		help: (
			<>
				<circle cx="12" cy="12" r="10" />
				<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</>
		),
		arrowright: (
			<>
				<line x1="5" y1="12" x2="19" y2="12" />
				<polyline points="12 5 19 12 12 19" />
			</>
		),
		cmd: (
			<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
		),
		sparkle: (
			<path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
		),
		play: <polygon points="5 3 19 12 5 21 5 3" />,
	}
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={stroke}
			strokeLinecap="round"
			strokeLinejoin="round"
			style={style}
		>
			{p[name] || null}
		</svg>
	)
}

/* ------------------------------ Button --------------------------------- */
function Button({
	kind = "secondary",
	size = "md",
	icon,
	iconRight,
	children,
	onClick,
	disabled,
	full,
	style,
}) {
	const sizes = {
		sm: { h: 28, px: 10, fs: 12 },
		md: { h: 34, px: 14, fs: 13 },
		lg: { h: 42, px: 20, fs: 15 },
	}
	const s = sizes[size]
	const [hover, setHover] = useStateP(false)
	const [press, setPress] = useStateP(false)
	const palette = {
		primary: {
			bg: "var(--accent)",
			color: "var(--accent-fg)",
			border: "transparent",
			hover: "var(--accent-strong)",
			press: "var(--accent-press)",
		},
		secondary: {
			bg: "var(--bg-raised)",
			color: "var(--fg-1)",
			border: "var(--border-default)",
			hover: "var(--bg-hover)",
			press: "var(--ink-700)",
		},
		ghost: {
			bg: "transparent",
			color: "var(--fg-2)",
			border: "transparent",
			hover: "rgba(255,255,255,0.05)",
			press: "var(--bg-hover)",
		},
		danger: {
			bg: "transparent",
			color: "var(--fail)",
			border: "rgba(255,107,94,0.28)",
			hover: "rgba(255,107,94,0.08)",
			press: "rgba(255,107,94,0.14)",
		},
	}[kind]
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => {
				setHover(false)
				setPress(false)
			}}
			onMouseDown={() => setPress(true)}
			onMouseUp={() => setPress(false)}
			style={{
				height: s.h,
				padding: `0 ${s.px}px`,
				width: full ? "100%" : "auto",
				background: disabled
					? "var(--ink-700)"
					: press
						? palette.press
						: hover
							? palette.hover
							: palette.bg,
				color: disabled ? "var(--paper-500)" : palette.color,
				border: `1px solid ${palette.border}`,
				borderRadius: "var(--r-sm)",
				font: `600 ${s.fs}px/1 var(--font-ui)`,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				gap: 7,
				cursor: disabled ? "not-allowed" : "pointer",
				whiteSpace: "nowrap",
				transition:
					"background var(--dur-base) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)",
				transform: press && kind === "primary" ? "scale(0.98)" : "none",
				...style,
			}}
		>
			{icon && <Icon name={icon} size={s.fs + 2} />}
			{children}
			{iconRight && <Icon name={iconRight} size={s.fs + 2} />}
		</button>
	)
}

/* ------------------------------- Input --------------------------------- */
function Input({ value, onChange, placeholder, mono, rows, autoFocus, style }) {
	const [focus, setFocus] = useStateP(false)
	const base = {
		width: "100%",
		boxSizing: "border-box",
		padding: rows ? "10px 12px" : "0 12px",
		height: rows ? "auto" : 34,
		background: "var(--ink-950)",
		border: `1px solid ${focus ? "var(--accent)" : "var(--border-default)"}`,
		boxShadow: focus ? "0 0 0 1px var(--accent), 0 0 16px var(--accent-glow)" : "none",
		borderRadius: "var(--r-sm)",
		color: "var(--fg-1)",
		font: `400 13px/${rows ? 1.6 : 1} ${mono ? "var(--font-mono)" : "var(--font-ui)"}`,
		outline: "none",
		resize: rows ? "vertical" : "none",
		transition: "border-color 160ms var(--ease-standard), box-shadow 160ms var(--ease-standard)",
		...style,
	}
	const props = {
		value,
		placeholder,
		autoFocus,
		onChange: (e) => onChange?.(e.target.value),
		onFocus: () => setFocus(true),
		onBlur: () => setFocus(false),
		style: base,
	}
	return rows ? <textarea rows={rows} {...props} /> : <input {...props} />
}

/* --------------------------- Search field ------------------------------ */
function SearchField({ value, onChange, placeholder = "Search", style }) {
	const [focus, setFocus] = useStateP(false)
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				height: 34,
				padding: "0 12px",
				background: "var(--ink-950)",
				borderRadius: "var(--r-sm)",
				border: `1px solid ${focus ? "var(--accent)" : "var(--border-default)"}`,
				boxShadow: focus ? "0 0 0 1px var(--accent), 0 0 16px var(--accent-glow)" : "none",
				transition:
					"border-color 160ms var(--ease-standard), box-shadow 160ms var(--ease-standard)",
				...style,
			}}
		>
			<Icon name="search" size={15} style={{ color: "var(--fg-3)", flexShrink: 0 }} />
			<input
				value={value}
				placeholder={placeholder}
				onChange={(e) => onChange?.(e.target.value)}
				onFocus={() => setFocus(true)}
				onBlur={() => setFocus(false)}
				style={{
					flex: 1,
					background: "none",
					border: "none",
					outline: "none",
					color: "var(--fg-1)",
					font: "400 13px/1 var(--font-ui)",
				}}
			/>
			{value ? (
				<button
					onClick={() => onChange?.("")}
					style={{
						background: "none",
						border: "none",
						cursor: "pointer",
						color: "var(--fg-3)",
						display: "flex",
						padding: 0,
					}}
				>
					<Icon name="x" size={14} />
				</button>
			) : null}
		</div>
	)
}

/* ------------------------------- Toggle -------------------------------- */
function Toggle({ checked, onChange, disabled }) {
	return (
		<button
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => !disabled && onChange?.(!checked)}
			style={{
				width: 38,
				height: 22,
				borderRadius: 999,
				padding: 2,
				border: "none",
				cursor: disabled ? "not-allowed" : "pointer",
				background: checked ? "var(--accent)" : "var(--ink-700)",
				opacity: disabled ? 0.4 : 1,
				display: "flex",
				alignItems: "center",
				transition: "background var(--dur-base) var(--ease-standard)",
			}}
		>
			<span
				style={{
					width: 18,
					height: 18,
					borderRadius: 999,
					background: checked ? "var(--ink-950)" : "var(--paper-200)",
					transform: checked ? "translateX(16px)" : "translateX(0)",
					transition: "transform var(--dur-base) var(--ease-standard)",
				}}
			/>
		</button>
	)
}

/* -------------------------------- Pill --------------------------------- */
function Pill({ tone = "neutral", icon, children, dot, style }) {
	const tones = {
		neutral: { bg: "var(--ink-800)", fg: "var(--paper-300)" },
		accent: { bg: "var(--accent-bg)", fg: "var(--accent)" },
		info: { bg: "var(--info-bg)", fg: "var(--info)" },
		warn: { bg: "var(--warn-bg)", fg: "var(--warn)" },
		fail: { bg: "var(--fail-bg)", fg: "var(--fail)" },
	}
	const t = tones[tone]
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 5,
				padding: "3px 9px",
				borderRadius: 999,
				background: t.bg,
				color: t.fg,
				font: "600 10px/1 var(--font-mono)",
				letterSpacing: "0.06em",
				textTransform: "uppercase",
				whiteSpace: "nowrap",
				...style,
			}}
		>
			{dot && <span style={{ width: 5, height: 5, borderRadius: 999, background: t.fg }} />}
			{icon && <Icon name={icon} size={11} stroke={2} />}
			{children}
		</span>
	)
}

/* -------------------------------- Card --------------------------------- */
function Card({ children, hover, emphasis, style, onClick }) {
	const [h, setH] = useStateP(false)
	return (
		<div
			onClick={onClick}
			onMouseEnter={() => hover && setH(true)}
			onMouseLeave={() => setH(false)}
			style={{
				background: h ? "var(--bg-hover)" : "var(--bg-raised)",
				border: `1px solid ${emphasis ? "var(--accent)" : "var(--border-default)"}`,
				borderRadius: "var(--r-md)",
				boxShadow: emphasis ? "0 0 0 1px var(--accent), 0 0 28px var(--accent-glow)" : "none",
				transition:
					"background 160ms var(--ease-standard), border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard)",
				cursor: onClick ? "pointer" : "default",
				...style,
			}}
		>
			{children}
		</div>
	)
}

/* ----------------------------- AfterLine ------------------------------- */
function AfterLine({ width = 28, style }) {
	return (
		<span
			style={{
				display: "inline-block",
				width,
				height: 1.5,
				background: "var(--accent)",
				verticalAlign: "middle",
				...style,
			}}
		/>
	)
}

/* ----------------------- Section label (eyebrow) ----------------------- */
function Eyebrow({ children, line, style }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
			<span
				style={{
					font: "600 10px/1 var(--font-mono)",
					letterSpacing: "0.16em",
					textTransform: "uppercase",
					color: "var(--fg-3)",
					whiteSpace: "nowrap",
				}}
			>
				{children}
			</span>
			{line && <AfterLine width={line === true ? 24 : line} />}
		</div>
	)
}

/* --------------------------- Empty state ------------------------------- */
/* Shared calm visual language: a soft icon + a short line.                 */
function EmptyState({ icon = "sparkle", title, line, action, pulse, compact, style }) {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				textAlign: "center",
				gap: compact ? 10 : 14,
				padding: compact ? 20 : 36,
				...style,
			}}
		>
			<div
				className={pulse ? "ccp-breathe" : ""}
				style={{
					width: compact ? 44 : 60,
					height: compact ? 44 : 60,
					borderRadius: "var(--r-lg)",
					display: "grid",
					placeItems: "center",
					color: "var(--fg-3)",
					background: "var(--ink-850)",
					border: "1px solid var(--border-default)",
				}}
			>
				<Icon name={icon} size={compact ? 20 : 26} stroke={1.5} />
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 5, maxWidth: 280 }}>
				{title && (
					<div
						style={{ font: `500 ${compact ? 14 : 15}px/1.3 var(--font-ui)`, color: "var(--fg-1)" }}
					>
						{title}
					</div>
				)}
				{line && (
					<div
						style={{ font: `400 ${compact ? 12 : 13}px/1.5 var(--font-ui)`, color: "var(--fg-3)" }}
					>
						{line}
					</div>
				)}
			</div>
			{action}
		</div>
	)
}

Object.assign(window, {
	Icon,
	Button,
	Input,
	SearchField,
	Toggle,
	Pill,
	Card,
	AfterLine,
	Eyebrow,
	EmptyState,
})
