/* global React, ReactDOM, Icon, Button, Toggle, AfterLine, Eyebrow, ConnectionIndicator, LiveView, Notes, Settings, useTweaks, TweaksPanel, TweakSection, TweakColor, TweakRadio, CCP */
/* =========================================================================
   Lockin — app shell (macOS window on a desktop, beside the faint client)
   ========================================================================= */
const { useState, useEffect, useRef, useMemo } = React

/* ------------------------------ Identity ------------------------------- */
/* A faceted crimson gem — the champion you lock in, your pick made precious. */
function AppMark({ size = 22, radius }) {
	const r = radius != null ? radius : Math.round(size * 0.27)
	const v = size * 0.68
	return (
		<span
			style={{
				width: size,
				height: size,
				borderRadius: r,
				flexShrink: 0,
				position: "relative",
				overflow: "hidden",
				background: "linear-gradient(155deg, #24272c 0%, #0b0c0d 78%)",
				border: "1px solid var(--border-strong)",
				display: "grid",
				placeItems: "center",
				boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)",
			}}
		>
			<span
				style={{
					gridArea: "1/1",
					width: size * 0.78,
					height: size * 0.78,
					borderRadius: "50%",
					background: "radial-gradient(circle, rgba(245,0,61,0.45) 0%, rgba(245,0,61,0) 68%)",
				}}
			/>
			<svg
				width={v}
				height={v}
				viewBox="0 0 24 24"
				style={{ gridArea: "1/1", position: "relative", display: "block" }}
			>
				<defs>
					<linearGradient id="lkGem" x1="0" y1="0" x2="0.25" y2="1">
						<stop offset="0" stopColor="#ff5a7d" />
						<stop offset="0.52" stopColor="#f5003d" />
						<stop offset="1" stopColor="#a8002c" />
					</linearGradient>
				</defs>
				<path d="M7.3 3.8 H16.7 L21 9.3 L12 21.2 L3 9.3 Z" fill="url(#lkGem)" />
				<path d="M3 9.3 H21" stroke="#fff" strokeOpacity="0.30" strokeWidth="0.7" />
				<path
					d="M7.3 3.8 L9.4 9.3 L12 21.2 M16.7 3.8 L14.6 9.3 L12 21.2"
					stroke="#fff"
					strokeOpacity="0.16"
					strokeWidth="0.6"
					fill="none"
				/>
				<path d="M8.6 5 H11 L9.9 8.3 Z" fill="#fff" fillOpacity="0.55" />
			</svg>
		</span>
	)
}
function Wordmark({ size = 15, mark = true }) {
	return (
		<span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.5 }}>
			{mark && <AppMark size={size * 1.55} />}
			<span
				style={{
					font: `600 ${size}px/1 var(--font-ui)`,
					color: "var(--fg-1)",
					letterSpacing: "-0.015em",
				}}
			>
				lockin
			</span>
		</span>
	)
}

/* ---------------------------- Faint client ----------------------------- */
/* The loud, busy LoL client — heavily dimmed so Lockin reads as the calm   */
/* co-pilot parked beside it.                                               */
const FaintClient = React.memo(function FaintClient() {
	const slot = (tint) => (
		<div
			style={{
				height: 58,
				borderRadius: 6,
				background: tint,
				border: "1px solid rgba(255,255,255,0.05)",
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "0 10px",
			}}
		>
			<div
				style={{ width: 38, height: 38, borderRadius: 5, background: "rgba(255,255,255,0.06)" }}
			/>
			<div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
				<div
					style={{ height: 7, width: "60%", borderRadius: 3, background: "rgba(255,255,255,0.08)" }}
				/>
				<div
					style={{ height: 5, width: "38%", borderRadius: 3, background: "rgba(255,255,255,0.05)" }}
				/>
			</div>
		</div>
	)
	return (
		<div
			aria-hidden="true"
			style={{
				position: "absolute",
				inset: 0,
				borderRadius: 14,
				overflow: "hidden",
				background: "radial-gradient(120% 90% at 50% 0%, #161b22 0%, #0a0d12 70%)",
				border: "1px solid rgba(255,255,255,0.04)",
				filter: "saturate(0.5) blur(1.4px) brightness(0.78)",
				opacity: 0.9,
			}}
		>
			{/* top bar */}
			<div
				style={{
					height: 46,
					borderBottom: "1px solid rgba(255,255,255,0.05)",
					display: "flex",
					alignItems: "center",
					gap: 18,
					padding: "0 26px",
				}}
			>
				{["Play", "Profile", "Collection", "Store"].map((_x, i) => (
					<div
						key={i}
						style={{
							height: 8,
							width: 48 + i * 6,
							borderRadius: 3,
							background: "rgba(255,255,255,0.07)",
						}}
					/>
				))}
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 320px 1fr",
					gap: 28,
					padding: "34px 30px",
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					{[0, 1, 2, 3, 4].map((i) => (
						<div key={i}>{slot("rgba(80,130,210,0.14)")}</div>
					))}
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: 18,
						paddingTop: 18,
					}}
				>
					<div
						style={{
							width: 132,
							height: 132,
							borderRadius: "50%",
							border: "3px solid rgba(120,160,255,0.22)",
							display: "grid",
							placeItems: "center",
						}}
					>
						<div
							style={{ font: "300 42px/1 var(--font-display)", color: "rgba(255,255,255,0.22)" }}
						>
							0:23
						</div>
					</div>
					<div
						style={{
							height: 10,
							width: 150,
							borderRadius: 4,
							background: "rgba(255,255,255,0.06)",
						}}
					/>
					<div
						style={{
							height: 220,
							width: "100%",
							borderRadius: 8,
							background: "rgba(255,255,255,0.025)",
							border: "1px solid rgba(255,255,255,0.04)",
						}}
					/>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					{[0, 1, 2, 3, 4].map((i) => (
						<div key={i}>{slot("rgba(210,80,80,0.13)")}</div>
					))}
				</div>
			</div>
			{/* dim toward the left where our window sits */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background:
						"linear-gradient(90deg, rgba(5,6,7,0.92) 0%, rgba(5,6,7,0.55) 26%, rgba(5,6,7,0.18) 60%, rgba(5,6,7,0.0) 100%)",
				}}
			/>
		</div>
	)
})

/* ------------------------------ Sidebar -------------------------------- */
const PHASE_SUB = {
	disconnected: "Disconnected",
	idle: "Idle",
	ready: "Ready Check",
	select: "Champ Selection",
}
function Sidebar({ nav, setNav, phase, connected, alwaysOnTop }) {
	const items = [
		{ id: "live", icon: "activity", label: "Live", sub: PHASE_SUB[phase] },
		{ id: "notes", icon: "book", label: "Notes" },
		{ id: "settings", icon: "settings", label: "Settings" },
	]
	return (
		<aside
			style={{
				width: 198,
				flexShrink: 0,
				background: "var(--bg-surface)",
				borderRight: "1px solid var(--border-default)",
				display: "flex",
				flexDirection: "column",
				padding: "14px 12px",
			}}
		>
			<div style={{ padding: "4px 8px 16px" }}>
				<Wordmark size={15} />
			</div>
			<nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
				{items.map((it) => {
					const on = nav === it.id
					return (
						<button
							key={it.id}
							onClick={() => setNav(it.id)}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 10,
								padding: "9px 10px",
								borderRadius: "var(--r-sm)",
								cursor: "pointer",
								background: on ? "var(--bg-hover)" : "transparent",
								border: "1px solid",
								borderColor: on ? "var(--border-default)" : "transparent",
								color: on ? "var(--fg-1)" : "var(--fg-3)",
								textAlign: "left",
								transition:
									"background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard)",
								position: "relative",
							}}
							onMouseEnter={(e) => {
								if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.03)"
							}}
							onMouseLeave={(e) => {
								if (!on) e.currentTarget.style.background = "transparent"
							}}
						>
							{on && (
								<span
									style={{
										position: "absolute",
										left: -12,
										top: "50%",
										transform: "translateY(-50%)",
										width: 2.5,
										height: 18,
										background: "var(--accent)",
										borderRadius: 2,
									}}
								/>
							)}
							<Icon name={it.icon} size={16} style={{ flexShrink: 0 }} />
							<span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
								<span style={{ font: "500 13px/1.1 var(--font-ui)" }}>{it.label}</span>
								{it.sub && (
									<span
										style={{
											font: "400 10px/1 var(--font-mono)",
											color: on ? "var(--accent)" : "var(--fg-4)",
											letterSpacing: "0.02em",
										}}
									>
										{it.sub}
									</span>
								)}
							</span>
							{it.id === "live" && (
								<span
									style={{
										width: 6,
										height: 6,
										borderRadius: 999,
										background: connected ? "var(--accent)" : "var(--ink-600)",
										flexShrink: 0,
									}}
								/>
							)}
						</button>
					)
				})}
			</nav>
			<div style={{ flex: 1 }} />
			<div
				style={{
					borderTop: "1px solid var(--border-default)",
					paddingTop: 12,
					display: "flex",
					flexDirection: "column",
					gap: 6,
				}}
			>
				<ConnectionIndicator connected={connected} />
				<span
					style={{
						font: "400 10px/1 var(--font-mono)",
						color: "var(--fg-4)",
						paddingLeft: 16,
						whiteSpace: "nowrap",
					}}
				>
					{connected ? "LCU · 127.0.0.1" : "retrying every 2s…"}
				</span>
			</div>
		</aside>
	)
}

/* ----------------------------- Window frame ---------------------------- */
function WindowFrame({ children, phase, connected }) {
	const [now, setNow] = useState("")
	useEffect(() => {
		const t = () =>
			setNow(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))
		t()
		const id = setInterval(t, 15000)
		return () => clearInterval(id)
	}, [])
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				borderRadius: 12,
				overflow: "hidden",
				background: "var(--bg-canvas)",
				border: "1px solid rgba(255,255,255,0.10)",
				boxShadow: "0 40px 90px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(0,0,0,0.5)",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* titlebar */}
			<div
				style={{
					height: 36,
					flexShrink: 0,
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "0 14px",
					background: "rgba(17,19,21,0.86)",
					backdropFilter: "blur(12px)",
					borderBottom: "1px solid var(--border-default)",
				}}
			>
				<div style={{ display: "flex", gap: 8, alignItems: "center", width: 120 }}>
					<span
						style={{
							width: 12,
							height: 12,
							borderRadius: "50%",
							background: "#ff5f57",
							border: "0.5px solid rgba(0,0,0,0.2)",
						}}
					/>
					<span
						style={{
							width: 12,
							height: 12,
							borderRadius: "50%",
							background: "#febc2e",
							border: "0.5px solid rgba(0,0,0,0.2)",
						}}
					/>
					<span
						style={{
							width: 12,
							height: 12,
							borderRadius: "50%",
							background: "#28c840",
							border: "0.5px solid rgba(0,0,0,0.2)",
						}}
					/>
				</div>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 8,
						font: "500 12px/1 var(--font-ui)",
						color: "var(--fg-3)",
					}}
				>
					<Wordmark size={12} mark={false} />
					<span style={{ color: "var(--fg-4)" }}>·</span>
					<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>
						{PHASE_SUB[phase]}
					</span>
				</span>
				<div
					style={{
						width: 120,
						display: "flex",
						justifyContent: "flex-end",
						alignItems: "center",
						gap: 10,
					}}
				>
					<ConnectionIndicator connected={connected} compact />
					<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>{now}</span>
				</div>
			</div>
			{children}
		</div>
	)
}

/* ------------------------------ Demo bar ------------------------------- */
function Seg({ value, options, onChange, accentActive }) {
	return (
		<div
			style={{
				display: "inline-flex",
				padding: 2,
				gap: 2,
				background: "rgba(0,0,0,0.35)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--r-sm)",
			}}
		>
			{options.map((o) => {
				const on = value === o.value
				return (
					<button
						key={String(o.value)}
						onClick={() => onChange(o.value)}
						style={{
							padding: "5px 10px",
							borderRadius: 4,
							border: "none",
							cursor: "pointer",
							whiteSpace: "nowrap",
							background: on ? (accentActive ? "var(--accent)" : "var(--ink-700)") : "transparent",
							color: on ? (accentActive ? "var(--accent-fg)" : "var(--fg-1)") : "var(--fg-3)",
							font: "600 11px/1 var(--font-ui)",
							transition: "background var(--dur-fast) var(--ease-standard)",
						}}
					>
						{o.label}
					</button>
				)
			})}
		</div>
	)
}
function DemoLabel({ children }) {
	return (
		<span
			style={{
				font: "600 9px/1 var(--font-mono)",
				letterSpacing: "0.1em",
				textTransform: "uppercase",
				color: "var(--fg-4)",
				marginRight: 2,
			}}
		>
			{children}
		</span>
	)
}

function DemoBar({ phase, setPhase, demo, setDemo, settings, setSettings }) {
	const dset = (k, v) => setDemo({ ...demo, [k]: v })
	return (
		<div
			style={{
				minHeight: 54,
				display: "flex",
				alignItems: "center",
				gap: 18,
				padding: "8px 16px",
				borderRadius: 12,
				flexWrap: "wrap",
				background: "rgba(14,16,18,0.9)",
				border: "1px solid var(--border-default)",
				boxShadow: "0 10px 30px -12px rgba(0,0,0,0.6)",
			}}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 3,
					paddingRight: 16,
					borderRight: "1px solid var(--border-default)",
				}}
			>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						font: "600 9px/1 var(--font-mono)",
						letterSpacing: "0.14em",
						textTransform: "uppercase",
						color: "var(--accent)",
					}}
				>
					<Icon name="play" size={10} />
					Prototype
				</span>
				<span style={{ font: "400 10px/1 var(--font-ui)", color: "var(--fg-4)" }}>
					Drive the client state
				</span>
			</div>

			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<DemoLabel>Client</DemoLabel>
				<Seg
					accentActive
					value={phase}
					onChange={setPhase}
					options={[
						{ value: "disconnected", label: "Disconnected" },
						{ value: "idle", label: "Idle" },
						{ value: "ready", label: "Ready Check" },
						{ value: "select", label: "Champ Selection" },
					]}
				/>
			</div>

			<div style={{ flex: 1 }} />

			{phase === "ready" && (
				<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
					<label
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							font: "500 11px/1 var(--font-ui)",
							color: "var(--fg-2)",
						}}
					>
						Auto-accept{" "}
						<Toggle
							checked={settings.autoAccept}
							onChange={(v) => setSettings({ ...settings, autoAccept: v })}
						/>
					</label>
					<label
						style={{
							display: "inline-flex",
							alignItems: "center",
							gap: 8,
							font: "500 11px/1 var(--font-ui)",
							color: "var(--fg-2)",
						}}
					>
						Show fired{" "}
						<Toggle checked={demo.autoAcceptFired} onChange={(v) => dset("autoAcceptFired", v)} />
					</label>
				</div>
			)}

			{phase === "select" && (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 12,
						flexWrap: "wrap",
						justifyContent: "flex-end",
					}}
				>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						<DemoLabel>Phase</DemoLabel>
						<Seg
							value={demo.csSubPhase || "live"}
							onChange={(v) => dset("csSubPhase", v === "live" ? null : v)}
							options={[
								{ value: "live", label: "Live" },
								{ value: "ban", label: "Ban" },
								{ value: "pick", label: "Pick" },
							]}
						/>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						<DemoLabel>Enemy</DemoLabel>
						<Seg
							value={demo.enemyHidden === null ? "auto" : demo.enemyHidden ? "hidden" : "shown"}
							onChange={(v) => dset("enemyHidden", v === "auto" ? null : v === "hidden")}
							options={[
								{ value: "auto", label: "Auto" },
								{ value: "hidden", label: "Hidden" },
								{ value: "shown", label: "Shown" },
							]}
						/>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						<DemoLabel>Ranks</DemoLabel>
						<Seg
							value={demo.ranksAvailable ? "on" : "off"}
							onChange={(v) => dset("ranksAvailable", v === "on")}
							options={[
								{ value: "on", label: "OK" },
								{ value: "off", label: "N/A" },
							]}
						/>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						<DemoLabel>Note</DemoLabel>
						<Seg
							value={demo.hasNote ? "on" : "off"}
							onChange={(v) => dset("hasNote", v === "on")}
							options={[
								{ value: "on", label: "Has" },
								{ value: "off", label: "None" },
							]}
						/>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						<DemoLabel>Role</DemoLabel>
						<Seg
							value={demo.roleAssigned ? "on" : "off"}
							onChange={(v) => dset("roleAssigned", v === "on")}
							options={[
								{ value: "on", label: "Set" },
								{ value: "off", label: "Pending" },
							]}
						/>
					</div>
				</div>
			)}
			{(phase === "disconnected" || phase === "idle") && (
				<span
					style={{
						font: "400 11px/1.4 var(--font-ui)",
						color: "var(--fg-4)",
						maxWidth: 320,
						textAlign: "right",
					}}
				>
					{phase === "disconnected"
						? "Client closed — calm waiting state. Notes & Settings stay usable."
						: "Connected, between games. Sharpen notes or queue up."}
				</span>
			)}
		</div>
	)
}

/* ------------------------------ Tweaks --------------------------------- */
const ACCENTS = {
	"#f5003d": {
		strong: "#ff2e5f",
		press: "#cc0034",
		fg: "#ffffff",
		bg: "rgba(245,0,61,0.12)",
		glow: "rgba(245,0,61,0.32)",
	},
	"#c8ff3d": {
		strong: "#d6ff66",
		press: "#a8db1f",
		fg: "#0c0d0e",
		bg: "rgba(200,255,61,0.10)",
		glow: "rgba(200,255,61,0.18)",
	},
	"#58d6e0": {
		strong: "#7fe6ee",
		press: "#34b3bd",
		fg: "#04181b",
		bg: "rgba(88,214,224,0.11)",
		glow: "rgba(88,214,224,0.20)",
	},
	"#f5c451": {
		strong: "#ffd778",
		press: "#d6a32f",
		fg: "#1c1606",
		bg: "rgba(245,196,81,0.11)",
		glow: "rgba(245,196,81,0.22)",
	},
}
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
	accent: "#f5003d",
	density: "cozy",
	csLayout: "rail",
} /*EDITMODE-END*/

/* -------------------------------- App ---------------------------------- */
function App() {
	const [t, setTweak] = useTweaks(TWEAK_DEFAULTS)
	const [nav, setNav] = useState("live")
	const [phase, setPhaseRaw] = useState("select")
	const [demo, setDemo] = useState({
		csSubPhase: null,
		enemyHidden: null,
		ranksAvailable: true,
		hasNote: true,
		roleAssigned: true,
		autoAcceptFired: false,
	})
	const [settings, setSettings] = useState({
		autoAccept: false,
		autoAcceptDelay: 2,
		spellLayout: { D: 0, F: 1 },
		mismatchThreshold: 8,
		alwaysOnTop: false,
		launchOnLogin: true,
		locale: "en",
	})
	const [notes, setNotes] = useState(() => CCP.NOTES.map((n) => ({ ...n })))
	const [banlist, setBanlist] = useState(() => CCP.BANLIST.map((b) => ({ ...b })))
	const [editing, setEditing] = useState(null)
	const [draft, setDraft] = useState(null)

	const connected = phase !== "disconnected"
	const ac = ACCENTS[t.accent] || ACCENTS["#f5003d"]

	const setPhase = (p) => {
		setPhaseRaw(p)
		if (p === "ready" || p === "select" || p === "disconnected" || p === "idle") setNav("live")
	}

	// notes editor helpers
	const startNew = (prefill = {}) => {
		setDraft({
			id: null,
			champ: null,
			opponent: null,
			body: "",
			spells: [],
			items: [],
			updated: "just now",
			...prefill,
		})
		setEditing("new")
		setNav("notes")
	}
	const startEdit = (note) => {
		setDraft({ ...note })
		setEditing(note.id)
	}
	const saveNote = () => {
		if (editing === "new") {
			const id = `n${Date.now()}`
			setNotes([{ ...draft, id, updated: "just now" }, ...notes])
		} else {
			setNotes(notes.map((n) => (n.id === editing ? { ...draft, updated: "just now" } : n)))
		}
		setEditing(null)
		setDraft(null)
	}
	const deleteNote = () => {
		setNotes(notes.filter((n) => n.id !== editing))
		setEditing(null)
		setDraft(null)
	}
	const editBody = (body) => {
		const opp = "Fiora"
		setNotes(
			notes.map((n) =>
				n.champ === CCP.ME.champ && n.opponent === opp ? { ...n, body, updated: "just now" } : n,
			),
		)
	}

	const rootStyle = {
		"--accent": t.accent,
		"--accent-strong": ac.strong,
		"--accent-press": ac.press,
		"--accent-fg": ac.fg,
		"--accent-bg": ac.bg,
		"--accent-glow": ac.glow,
	}

	let screen
	if (nav === "notes")
		screen = (
			<Notes
				notes={notes}
				editing={editing}
				setEditing={(e) => {
					if (e === "new") startNew()
					else if (e) startEdit(notes.find((n) => n.id === e))
					else {
						setEditing(null)
						setDraft(null)
					}
				}}
				draft={draft}
				setDraft={setDraft}
				onSave={saveNote}
				onDelete={deleteNote}
			/>
		)
	else if (nav === "settings")
		screen = (
			<Settings
				settings={settings}
				setSettings={setSettings}
				banlist={banlist}
				setBanlist={setBanlist}
			/>
		)
	else
		screen = (
			<LiveView
				phase={phase}
				density={t.density}
				settings={settings}
				demo={demo}
				csLayout={t.csLayout}
				notes={notes}
				banlist={banlist}
				onNewNote={() => startNew()}
				onOpenNote={startEdit}
				onGoBans={() => setNav("settings")}
				onGoNotes={() => startNew({ champ: CCP.ME.champ, opponent: "Fiora" })}
				onEditBody={editBody}
			/>
		)

	return (
		<div
			style={{
				...rootStyle,
				position: "fixed",
				inset: 0,
				overflow: "hidden",
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-start",
				padding: "clamp(12px, 3vw, 44px)",
				background: "radial-gradient(140% 120% at 70% -10%, #11151c 0%, #080a0c 55%, #050607 100%)",
			}}
		>
			{/* faint dot grid */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					opacity: 0.5,
					pointerEvents: "none",
					backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
					backgroundSize: "34px 34px",
				}}
			/>
			{/* the loud client, dimmed, parked to the right/behind */}
			<div style={{ position: "absolute", top: "5vh", bottom: "5vh", right: "2vw", left: "26%" }}>
				<FaintClient />
			</div>
			{/* window + demo controls */}
			<div
				style={{
					position: "relative",
					display: "flex",
					flexDirection: "column",
					gap: 14,
					alignItems: "stretch",
					width: "min(1080px, 94vw)",
					maxHeight: "100%",
					marginLeft: "min(2vw, 24px)",
				}}
			>
				<div style={{ height: "min(740px, 78vh)", minHeight: 0 }}>
					<WindowFrame phase={phase} connected={connected}>
						<div style={{ flex: 1, display: "flex", minHeight: 0 }}>
							<Sidebar
								nav={nav}
								setNav={setNav}
								phase={phase}
								connected={connected}
								alwaysOnTop={settings.alwaysOnTop}
							/>
							<main
								style={{
									flex: 1,
									minWidth: 0,
									position: "relative",
									overflow: "hidden",
									background: "var(--bg-canvas)",
								}}
							>
								<div
									key={nav + phase}
									className="ccp-screen"
									style={{ position: "absolute", inset: 0, padding: "clamp(12px, 1.6vw, 20px)" }}
								>
									{screen}
								</div>
							</main>
						</div>
					</WindowFrame>
				</div>
				<div style={{ flexShrink: 0 }}>
					<DemoBar
						phase={phase}
						setPhase={setPhase}
						demo={demo}
						setDemo={setDemo}
						settings={settings}
						setSettings={setSettings}
					/>
				</div>
			</div>

			<TweaksPanel title="Tweaks">
				<TweakSection label="Accent" />
				<TweakColor
					label="Live accent"
					value={t.accent}
					options={["#f5003d", "#c8ff3d", "#58d6e0", "#f5c451"]}
					onChange={(v) => setTweak("accent", v)}
				/>
				<TweakSection label="Layout" />
				<TweakRadio
					label="Density"
					value={t.density}
					options={["compact", "cozy", "comfortable"]}
					onChange={(v) => setTweak("density", v)}
				/>
				<TweakRadio
					label="Champ select"
					value={t.csLayout}
					options={["stacked", "hero", "rail"]}
					onChange={(v) => setTweak("csLayout", v)}
				/>
			</TweaksPanel>
		</div>
	)
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />)
