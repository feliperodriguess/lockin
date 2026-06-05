/* global React, Icon, CCP */
/* =========================================================================
   Champ Co-Pilot — game art components
   Champion / spell / item art from Data Dragon, with on-brand fallbacks.
   ========================================================================= */
const { useState: useStateA } = React

/* --------------------------- Champion portrait ------------------------- */
/* hidden=true → the "unknown enemy" variant (not yet revealed).            */
function ChampionPortrait({ champKey, size = 40, radius, hidden, dim, ring, style }) {
	const [err, setErr] = useStateA(false)
	const c = champKey ? CCP.champ(champKey) : null
	const r = radius != null ? radius : Math.max(6, Math.round(size * 0.18))

	if (hidden || !c) {
		return (
			<div
				style={{
					width: size,
					height: size,
					borderRadius: r,
					flexShrink: 0,
					background:
						"repeating-linear-gradient(135deg, var(--ink-850) 0 6px, var(--ink-900) 6px 12px)",
					border: "1px dashed var(--border-strong)",
					display: "grid",
					placeItems: "center",
					color: "var(--fg-4)",
					boxShadow: ring ? "0 0 0 2px var(--accent)" : "none",
					...style,
				}}
			>
				<span
					style={{
						font: `400 ${Math.round(size * 0.5)}px/1 var(--font-display)`,
						color: "var(--fg-3)",
					}}
				>
					?
				</span>
			</div>
		)
	}
	const initials = c.name
		.replace(/[^A-Za-z' ]/g, "")
		.split(" ")
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase()
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: r,
				flexShrink: 0,
				position: "relative",
				overflow: "hidden",
				background: c.color,
				border: "1px solid var(--border-default)",
				boxShadow: ring ? "0 0 0 2px var(--accent)" : "none",
				...style,
			}}
		>
			{!err ? (
				<img
					src={CCP.ddChamp(c.key)}
					alt={c.name}
					onError={() => setErr(true)}
					style={{
						width: "100%",
						height: "100%",
						objectFit: "cover",
						display: "block",
						filter: dim ? "grayscale(0.6) brightness(0.6)" : "none",
					}}
				/>
			) : (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "grid",
						placeItems: "center",
						font: `600 ${Math.round(size * 0.34)}px/1 var(--font-ui)`,
						color: "rgba(255,255,255,0.92)",
						letterSpacing: "0.02em",
					}}
				>
					{initials}
				</div>
			)}
			{dim && <div style={{ position: "absolute", inset: 0, background: "rgba(12,13,14,0.35)" }} />}
		</div>
	)
}

/* ----------------------------- Spell icon ------------------------------ */
function SpellIcon({ spell, size = 28, keyHint, style }) {
	const [err, setErr] = useStateA(false)
	const s = CCP.SPELLS[spell]
	if (!s) return null
	return (
		<div
			title={s.name}
			style={{
				width: size,
				height: size,
				borderRadius: "var(--r-xs)",
				position: "relative",
				overflow: "hidden",
				background: "var(--ink-800)",
				border: "1px solid var(--border-default)",
				flexShrink: 0,
				...style,
			}}
		>
			{!err ? (
				<img
					src={CCP.ddSpell(s.key)}
					alt={s.name}
					onError={() => setErr(true)}
					style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
				/>
			) : (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "grid",
						placeItems: "center",
						font: `600 9px/1 var(--font-mono)`,
						color: "var(--fg-2)",
					}}
				>
					{s.name.slice(0, 4)}
				</div>
			)}
			{keyHint && (
				<span
					style={{
						position: "absolute",
						bottom: -1,
						right: -1,
						padding: "1px 3px",
						background: "var(--ink-950)",
						borderTopLeftRadius: 4,
						font: "600 8px/1 var(--font-mono)",
						color: "var(--accent)",
					}}
				>
					{keyHint}
				</span>
			)}
		</div>
	)
}

/* D/F order honored by the caller passing [dKey, fKey] layout              */
function SpellPair({ spells, layout = { D: 0, F: 1 }, size = 28, showKeys, gap = 4 }) {
	// spells is array in [first, second]; layout maps which key holds which slot
	const order = [
		["D", layout.D],
		["F", layout.F],
	].sort((a, b) => a[1] - b[1])
	return (
		<div style={{ display: "flex", gap }}>
			{order.map(([k, slot]) => (
				<SpellIcon key={k} spell={spells[slot]} size={size} keyHint={showKeys ? k : undefined} />
			))}
		</div>
	)
}

/* ------------------------------ Item icon ------------------------------ */
function ItemIcon({ item, size = 30, style }) {
	const [err, setErr] = useStateA(false)
	const it = CCP.ITEMS[item]
	if (!it) return null
	return (
		<div
			title={it.name}
			style={{
				width: size,
				height: size,
				borderRadius: "var(--r-xs)",
				position: "relative",
				overflow: "hidden",
				background: "var(--ink-800)",
				border: "1px solid var(--border-default)",
				flexShrink: 0,
				...style,
			}}
		>
			{!err ? (
				<img
					src={CCP.ddItem(it.id)}
					alt={it.name}
					onError={() => setErr(true)}
					style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
				/>
			) : (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "grid",
						placeItems: "center",
						font: `600 8px/1.1 var(--font-mono)`,
						color: "var(--fg-2)",
						textAlign: "center",
						padding: 2,
					}}
				>
					{it.name.split(" ")[0]}
				</div>
			)}
		</div>
	)
}

function ItemRow({ items, size = 30, gap = 5 }) {
	if (!items?.length) {
		return (
			<span
				style={{ font: "400 12px/1 var(--font-ui)", color: "var(--fg-4)", fontStyle: "italic" }}
			>
				No starting items pinned
			</span>
		)
	}
	return (
		<div style={{ display: "flex", gap, alignItems: "center" }}>
			{items.map((it, i) => (
				<ItemIcon key={i} item={it} size={size} />
			))}
		</div>
	)
}

/* ---------------------------- Countdown ring --------------------------- */
function CountdownRing({
	progress = 1,
	size = 168,
	stroke = 8,
	tone = "accent",
	value,
	label,
	sub,
	pulsing,
}) {
	const radius = (size - stroke) / 2
	const circ = 2 * Math.PI * radius
	const toneColor =
		{ accent: "var(--accent)", warn: "var(--warn)", fail: "var(--fail)" }[tone] || "var(--accent)"
	return (
		<div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
			<svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--ink-800)"
					strokeWidth={stroke}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={toneColor}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={circ}
					strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, progress)))}
					style={{
						transition:
							"stroke-dashoffset 980ms linear, stroke var(--dur-base) var(--ease-standard)",
						filter: pulsing ? `drop-shadow(0 0 8px ${toneColor})` : "none",
					}}
				/>
			</svg>
			<div
				className={pulsing ? "ccp-breathe" : ""}
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 2,
				}}
			>
				{value != null && (
					<div
						style={{
							font: `400 ${Math.round(size * 0.32)}px/1 var(--font-display)`,
							color: "var(--fg-1)",
							fontVariantNumeric: "tabular-nums",
						}}
					>
						{value}
					</div>
				)}
				{label && (
					<div
						style={{
							font: "600 10px/1 var(--font-mono)",
							letterSpacing: "0.14em",
							textTransform: "uppercase",
							color: tone === "accent" ? "var(--accent)" : toneColor,
						}}
					>
						{label}
					</div>
				)}
				{sub && (
					<div style={{ font: "400 11px/1 var(--font-ui)", color: "var(--fg-3)" }}>{sub}</div>
				)}
			</div>
		</div>
	)
}

/* ------------------------------- Rank badge ---------------------------- */
function RankEmblem({ tier, size = 18 }) {
	const t = CCP.TIERS[tier]
	const col = t ? t.color : "var(--fg-4)"
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
			<path
				d="M12 2 L21 8 L12 22 L3 8 Z"
				fill={col}
				fillOpacity="0.22"
				stroke={col}
				strokeWidth="1.5"
				strokeLinejoin="round"
			/>
			<path d="M12 2 L16 8 L12 14 L8 8 Z" fill={col} fillOpacity="0.85" />
		</svg>
	)
}

function RankBadge({ rank, size = "md", showEmblem = true }) {
	const small = size === "sm"
	const unranked = !rank || rank.status === "unranked" || !rank.tier
	const provisional = rank && rank.status === "provisional"
	const col = unranked ? "var(--fg-4)" : CCP.TIERS[rank.tier].color
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: small ? 5 : 7 }}>
			{showEmblem &&
				(unranked ? (
					<span
						style={{
							width: small ? 14 : 18,
							height: small ? 14 : 18,
							borderRadius: "var(--r-xs)",
							border: "1px dashed var(--border-strong)",
							display: "inline-block",
							flexShrink: 0,
						}}
					/>
				) : (
					<RankEmblem tier={rank.tier} size={small ? 14 : 18} />
				))}
			<span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.15 }}>
				<span
					style={{
						font: `600 ${small ? 11 : 12}px/1.2 var(--font-mono)`,
						color: unranked ? "var(--fg-3)" : "var(--fg-1)",
						letterSpacing: "0.01em",
						whiteSpace: "nowrap",
					}}
				>
					{CCP.fmtRank(rank).split(" · ")[0]}
				</span>
				{!small && !unranked && !provisional && (
					<span style={{ font: "400 10px/1 var(--font-mono)", color: col, marginTop: 2 }}>
						{rank.lp} LP
					</span>
				)}
				{!small && provisional && (
					<span style={{ font: "400 10px/1 var(--font-mono)", color: "var(--warn)", marginTop: 2 }}>
						placements
					</span>
				)}
			</span>
		</span>
	)
}

/* ----------------------------- Mismatch flag --------------------------- */
/* Never color-only: icon + label always together.                         */
function MismatchFlag({ label = "Rank spread", style }) {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 5,
				padding: "3px 8px",
				borderRadius: "var(--r-sm)",
				background: "var(--warn-bg)",
				color: "var(--warn)",
				border: "1px solid rgba(245,183,64,0.25)",
				font: "600 10px/1 var(--font-mono)",
				letterSpacing: "0.04em",
				textTransform: "uppercase",
				...style,
			}}
		>
			<Icon name="alert" size={11} stroke={2} />
			{label}
		</span>
	)
}

/* -------------------------------- Badges ------------------------------- */
function YourPickBadge({ style }) {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				padding: "2px 7px",
				borderRadius: 999,
				background: "var(--accent-bg)",
				color: "var(--accent)",
				font: "600 9px/1 var(--font-mono)",
				letterSpacing: "0.06em",
				textTransform: "uppercase",
				...style,
			}}
		>
			<Icon name="pin" size={10} stroke={2} />
			Your pick
		</span>
	)
}
function ThreatBadge({ style }) {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				padding: "2px 7px",
				borderRadius: 999,
				background: "var(--fail-bg)",
				color: "var(--fail)",
				font: "600 9px/1 var(--font-mono)",
				letterSpacing: "0.06em",
				textTransform: "uppercase",
				...style,
			}}
		>
			<Icon name="alert" size={10} stroke={2} />
			Threat
		</span>
	)
}

/* ------------------------------ Role glyph ----------------------------- */
const ROLE_POS = { Top: [6, 6], Jungle: [9, 14], Mid: [12, 12], Bot: [18, 18], Support: [15, 19] }
const ROLE_ABBR = { Top: "TOP", Jungle: "JNG", Mid: "MID", Bot: "BOT", Support: "SUP" }
function RoleGlyph({ role, size = 16, color = "currentColor" }) {
	const pos = ROLE_POS[role] || [12, 12]
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
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
function RoleTag({ role, active, style }) {
	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 5,
				padding: "3px 8px",
				borderRadius: "var(--r-sm)",
				background: active ? "var(--accent-bg)" : "var(--ink-800)",
				color: active ? "var(--accent)" : "var(--fg-2)",
				font: "600 10px/1 var(--font-mono)",
				letterSpacing: "0.08em",
				...style,
			}}
		>
			<RoleGlyph role={role} size={12} />
			{ROLE_ABBR[role] || role}
		</span>
	)
}

/* ------------------------- Connection indicator ------------------------ */
const ONLINE_GREEN = "#3fd07a"
function ConnectionIndicator({ connected, compact }) {
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
			<span style={{ position: "relative", width: 8, height: 8, flexShrink: 0 }}>
				<span
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: 999,
						background: connected ? ONLINE_GREEN : "var(--fg-4)",
					}}
				/>
				{connected && (
					<span
						className="ccp-ping"
						style={{ position: "absolute", inset: 0, borderRadius: 999, background: ONLINE_GREEN }}
					/>
				)}
			</span>
			{!compact && (
				<span
					style={{
						font: "500 11px/1 var(--font-mono)",
						color: connected ? "var(--fg-2)" : "var(--fg-3)",
						letterSpacing: "0.02em",
						whiteSpace: "nowrap",
					}}
				>
					{connected ? "Client Connected" : "Client Not Detected"}
				</span>
			)}
		</span>
	)
}

Object.assign(window, {
	ChampionPortrait,
	SpellIcon,
	SpellPair,
	ItemIcon,
	ItemRow,
	CountdownRing,
	RankEmblem,
	RankBadge,
	MismatchFlag,
	YourPickBadge,
	ThreatBadge,
	RoleGlyph,
	RoleTag,
	ROLE_ABBR,
	ConnectionIndicator,
})
