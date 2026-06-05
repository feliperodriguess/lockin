/* global React, Icon, Button, ChampionPortrait, YourPickBadge, SpellPair, ItemRow, CCP, Input */
/* =========================================================================
   Champ Co-Pilot — Note card + Champion picker
   ========================================================================= */
const { useState: useStateCm, useRef: useRefCm, useEffect: useEffectCm } = React

/* --------------------------- Note title line --------------------------- */
function NoteTitle({ champKey, opponent, size = 22, fs = 14 }) {
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
			<ChampionPortrait champKey={champKey} size={size} />
			<span
				style={{
					font: `600 ${fs}px/1 var(--font-ui)`,
					color: "var(--fg-1)",
					whiteSpace: "nowrap",
					flexShrink: 0,
				}}
			>
				{CCP.champ(champKey)?.name}
			</span>
			{opponent && (
				<>
					<span
						style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)", flexShrink: 0 }}
					>
						vs
					</span>
					<ChampionPortrait champKey={opponent} size={size} />
					<span
						style={{
							font: `500 ${fs}px/1 var(--font-ui)`,
							color: "var(--fg-2)",
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							minWidth: 0,
						}}
					>
						{CCP.champ(opponent)?.name}
					</span>
				</>
			)}
		</div>
	)
}

/* ------------------------------- Note card ----------------------------- */
/* variant: "full" (library) | "compact" (champ select, inline-editable)   */
function NoteCard({ note, variant = "full", onClick, onEdit, onChangeBody, editable }) {
	const [hover, setHover] = useStateCm(false)
	const [editing, setEditing] = useStateCm(false)
	const compact = variant === "compact"

	if (compact) {
		return (
			<div
				onMouseEnter={() => setHover(true)}
				onMouseLeave={() => setHover(false)}
				style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}
			>
				<div
					style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
				>
					<NoteTitle champKey={note.champ} opponent={note.opponent} size={24} fs={14} />
					{editable && (
						<button
							onClick={() => setEditing((v) => !v)}
							title="Edit note"
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 5,
								background: editing ? "var(--accent-bg)" : "transparent",
								border: "1px solid",
								borderColor: editing
									? "transparent"
									: hover
										? "var(--border-default)"
										: "transparent",
								color: editing ? "var(--accent)" : "var(--fg-3)",
								borderRadius: "var(--r-sm)",
								padding: "4px 8px",
								cursor: "pointer",
								font: "500 11px/1 var(--font-ui)",
								transition: "all var(--dur-base) var(--ease-standard)",
							}}
						>
							<Icon name={editing ? "check" : "edit"} size={12} />
							{editing ? "Done" : "Edit"}
						</button>
					)}
				</div>
				{editing ? (
					<Input
						rows={5}
						value={note.body}
						onChange={onChangeBody}
						autoFocus
						style={{
							flex: 1,
							fontFamily: "var(--font-ui)",
							fontSize: 14,
							lineHeight: 1.6,
							color: "var(--fg-1)",
						}}
					/>
				) : (
					<p
						style={{
							margin: 0,
							font: "400 14.5px/1.62 var(--font-ui)",
							color: "var(--paper-100)",
							flex: 1,
							minHeight: 0,
							overflowY: "auto",
							letterSpacing: "0.005em",
							textWrap: "pretty",
							whiteSpace: "pre-wrap",
						}}
					>
						{note.body}
					</p>
				)}
			</div>
		)
	}

	// empty-prompt variant
	if (note.empty) {
		return (
			<div
				onClick={onClick}
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 10,
					cursor: "pointer",
					height: "100%",
					justifyContent: "center",
				}}
			>
				<NoteTitle champKey={note.champ} opponent={note.opponent} size={24} fs={14} />
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 8,
						padding: "12px 14px",
						borderRadius: "var(--r-sm)",
						border: "1px dashed var(--border-strong)",
						background: "rgba(255,255,255,0.015)",
						color: "var(--fg-3)",
					}}
				>
					<Icon name="plus" size={15} style={{ color: "var(--accent)" }} />
					<span style={{ font: "400 13.5px/1.4 var(--font-ui)" }}>
						Add a note for{" "}
						<b style={{ color: "var(--fg-1)", fontWeight: 600 }}>{CCP.champ(note.champ)?.name}</b>
						{note.opponent && (
							<>
								{" "}
								vs{" "}
								<b style={{ color: "var(--fg-2)", fontWeight: 600 }}>
									{CCP.champ(note.opponent)?.name}
								</b>
							</>
						)}
					</span>
				</div>
			</div>
		)
	}

	// full (library)
	return (
		<div
			onClick={onClick}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			style={{
				background: hover ? "var(--bg-hover)" : "var(--bg-raised)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--r-md)",
				padding: 16,
				cursor: "pointer",
				display: "flex",
				flexDirection: "column",
				gap: 11,
				overflow: "hidden",
				transition: "background 160ms var(--ease-standard)",
				height: "100%",
				boxSizing: "border-box",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					gap: 8,
				}}
			>
				<div style={{ flex: 1, minWidth: 0 }}>
					<NoteTitle champKey={note.champ} opponent={note.opponent} size={26} fs={14} />
				</div>
				<Icon
					name="edit"
					size={14}
					style={{
						color: hover ? "var(--fg-2)" : "var(--fg-4)",
						flexShrink: 0,
						marginTop: 2,
						transition: "color 160ms",
					}}
				/>
			</div>
			<p
				style={{
					margin: 0,
					font: "400 13px/1.55 var(--font-ui)",
					color: "var(--paper-200)",
					flex: 1,
					display: "-webkit-box",
					WebkitLineClamp: 3,
					WebkitBoxOrient: "vertical",
					overflow: "hidden",
					textWrap: "pretty",
				}}
			>
				{note.body}
			</p>
			<div
				style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					{note.spells && note.spells.length === 2 && (
						<SpellPair spells={note.spells} size={20} gap={3} />
					)}
				</div>
				<span
					style={{
						font: "400 10.5px/1 var(--font-mono)",
						color: "var(--fg-4)",
						whiteSpace: "nowrap",
					}}
				>
					{note.updated}
				</span>
			</div>
		</div>
	)
}

/* --------------------------- Champion picker --------------------------- */
function ChampionPicker({
	value,
	onChange,
	placeholder = "Select champion",
	roleFilter,
	allowClear,
	size = "md",
}) {
	const [open, setOpen] = useStateCm(false)
	const [q, setQ] = useStateCm("")
	const ref = useRefCm(null)
	useEffectCm(() => {
		const h = (e) => {
			if (ref.current && !ref.current.contains(e.target)) setOpen(false)
		}
		document.addEventListener("mousedown", h)
		return () => document.removeEventListener("mousedown", h)
	}, [])
	const list = CCP.CHAMPIONS.filter(
		(c) =>
			(!roleFilter || c.role === roleFilter) &&
			(c.name.toLowerCase().includes(q.toLowerCase()) ||
				c.key.toLowerCase().includes(q.toLowerCase())),
	)
	const sel = value ? CCP.champ(value) : null
	const h = size === "sm" ? 32 : 36

	return (
		<div ref={ref} style={{ position: "relative" }}>
			<button
				onClick={() => setOpen((v) => !v)}
				style={{
					display: "flex",
					alignItems: "center",
					gap: 9,
					width: "100%",
					height: h,
					padding: "0 10px 0 8px",
					boxSizing: "border-box",
					background: "var(--ink-950)",
					border: `1px solid ${open ? "var(--accent)" : "var(--border-default)"}`,
					boxShadow: open ? "0 0 0 1px var(--accent), 0 0 16px var(--accent-glow)" : "none",
					borderRadius: "var(--r-sm)",
					cursor: "pointer",
					color: "var(--fg-1)",
					textAlign: "left",
					transition:
						"border-color 160ms var(--ease-standard), box-shadow 160ms var(--ease-standard)",
				}}
			>
				{sel ? (
					<ChampionPortrait champKey={sel.key} size={h - 12} />
				) : (
					<span
						style={{
							width: h - 12,
							height: h - 12,
							borderRadius: "var(--r-xs)",
							border: "1px dashed var(--border-strong)",
						}}
					/>
				)}
				<span
					style={{
						flex: 1,
						font: "500 13px/1 var(--font-ui)",
						color: sel ? "var(--fg-1)" : "var(--fg-4)",
					}}
				>
					{sel ? sel.name : placeholder}
				</span>
				{allowClear && sel && (
					<span
						onClick={(e) => {
							e.stopPropagation()
							onChange?.(null)
						}}
						style={{ display: "flex", color: "var(--fg-4)", padding: 2 }}
					>
						<Icon name="x" size={13} />
					</span>
				)}
				<Icon name="chevdown" size={14} style={{ color: "var(--fg-3)" }} />
			</button>
			{open && (
				<div
					style={{
						position: "absolute",
						top: h + 6,
						left: 0,
						right: 0,
						zIndex: 50,
						background: "var(--ink-900)",
						border: "1px solid var(--border-strong)",
						borderRadius: "var(--r-md)",
						boxShadow: "var(--shadow-lg)",
						overflow: "hidden",
					}}
				>
					<div style={{ padding: 8, borderBottom: "1px solid var(--border-default)" }}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 7,
								height: 30,
								padding: "0 9px",
								background: "var(--ink-950)",
								borderRadius: "var(--r-sm)",
								border: "1px solid var(--border-default)",
							}}
						>
							<Icon name="search" size={13} style={{ color: "var(--fg-3)" }} />
							<input
								value={q}
								onChange={(e) => setQ(e.target.value)}
								placeholder="Search champions"
								style={{
									flex: 1,
									background: "none",
									border: "none",
									outline: "none",
									color: "var(--fg-1)",
									font: "400 12px/1 var(--font-ui)",
								}}
							/>
						</div>
					</div>
					<div style={{ maxHeight: 232, overflowY: "auto", padding: 4 }}>
						{list.length === 0 && (
							<div
								style={{
									padding: "14px",
									textAlign: "center",
									font: "400 12px/1 var(--font-ui)",
									color: "var(--fg-4)",
								}}
							>
								No champions match
							</div>
						)}
						{list.map((c) => (
							<button
								key={c.key}
								onClick={() => {
									onChange?.(c.key)
									setOpen(false)
									setQ("")
								}}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 9,
									width: "100%",
									padding: "6px 8px",
									border: "none",
									cursor: "pointer",
									background: value === c.key ? "var(--accent-bg)" : "transparent",
									borderRadius: "var(--r-sm)",
									textAlign: "left",
									color: "var(--fg-1)",
								}}
								onMouseEnter={(e) => {
									if (value !== c.key) e.currentTarget.style.background = "var(--bg-hover)"
								}}
								onMouseLeave={(e) => {
									if (value !== c.key) e.currentTarget.style.background = "transparent"
								}}
							>
								<ChampionPortrait champKey={c.key} size={26} />
								<span
									style={{
										flex: 1,
										font: "500 13px/1.2 var(--font-ui)",
										color: value === c.key ? "var(--accent)" : "var(--fg-1)",
									}}
								>
									{c.name}
								</span>
								<span
									style={{
										font: "500 9px/1 var(--font-mono)",
										letterSpacing: "0.08em",
										color: "var(--fg-4)",
									}}
								>
									{window.ROLE_ABBR?.[c.role] || c.role}
								</span>
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	)
}

Object.assign(window, { NoteTitle, NoteCard, ChampionPicker })
