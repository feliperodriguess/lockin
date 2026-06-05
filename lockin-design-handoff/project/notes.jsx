/* global React, Icon, Button, Input, SearchField, Card, Eyebrow, EmptyState, Pill, NoteCard, NoteTitle, ChampionPicker, ChampionPortrait, SpellIcon, SpellPair, ItemIcon, CCP */
/* =========================================================================
   Champ Co-Pilot — Notes library + editor drawer
   ========================================================================= */
const { useState: useNT, useEffect: useNTE } = React

const SPELL_KEYS = ["Flash", "Teleport", "Ignite", "Smite", "Heal", "Exhaust"]
const _ITEM_KEYS = [
	"doransBlade",
	"doransRing",
	"doransShield",
	"healthPotion",
	"refillable",
	"jungleStarter",
]

/* ------------------------------ Editor --------------------------------- */
function NoteEditor({ draft, onChange, onSave, onDelete, onClose, isNew }) {
	const set = (k, v) => onChange({ ...draft, [k]: v })
	const toggleSpell = (s) => {
		const cur = draft.spells || []
		if (cur.includes(s))
			set(
				"spells",
				cur.filter((x) => x !== s),
			)
		else if (cur.length < 2) set("spells", [...cur, s])
		else set("spells", [cur[1], s])
	}
	const _toggleItem = (it) => {
		const cur = draft.items || []
		set("items", cur.includes(it) ? cur.filter((x) => x !== it) : [...cur, it])
	}
	const canSave = !!draft.champ && (draft.body || "").trim().length > 0

	return (
		<>
			<div
				onClick={onClose}
				className="ccp-fade"
				style={{
					position: "absolute",
					inset: 0,
					background: "rgba(0,0,0,0.55)",
					backdropFilter: "blur(2px)",
					zIndex: 60,
				}}
			/>
			<div
				className="ccp-drawer"
				style={{
					position: "absolute",
					top: 0,
					right: 0,
					bottom: 0,
					width: 392,
					maxWidth: "92%",
					zIndex: 61,
					background: "var(--bg-surface)",
					borderLeft: "1px solid var(--border-strong)",
					boxShadow: "var(--shadow-lg)",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "16px 18px",
						borderBottom: "1px solid var(--border-default)",
					}}
				>
					<Eyebrow line={20}>{isNew ? "New note" : "Edit note"}</Eyebrow>
					<button
						onClick={onClose}
						style={{
							background: "none",
							border: "none",
							cursor: "pointer",
							color: "var(--fg-3)",
							display: "flex",
							padding: 4,
						}}
					>
						<Icon name="x" size={18} />
					</button>
				</div>

				<div
					style={{
						flex: 1,
						overflowY: "auto",
						padding: 18,
						display: "flex",
						flexDirection: "column",
						gap: 18,
					}}
				>
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
						<Field label="Champion" req>
							<ChampionPicker
								value={draft.champ}
								onChange={(v) => set("champ", v)}
								placeholder="Pick champion"
							/>
						</Field>
						<Field label="Opponent">
							<ChampionPicker
								value={draft.opponent}
								onChange={(v) => set("opponent", v)}
								placeholder="Optional"
								allowClear
							/>
						</Field>
					</div>

					<Field label="Note">
						<Input
							rows={7}
							value={draft.body || ""}
							onChange={(v) => set("body", v)}
							autoFocus
							placeholder="What wins this matchup? Trades, timings, what to respect…"
							style={{ fontSize: 14, lineHeight: 1.6, color: "var(--fg-1)" }}
						/>
					</Field>

					<Field label="Pinned spells" hint="Overrides the suggestion in the header">
						<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
							{SPELL_KEYS.map((s) => {
								const on = (draft.spells || []).includes(s)
								const order = (draft.spells || []).indexOf(s)
								return (
									<button
										key={s}
										onClick={() => toggleSpell(s)}
										style={{
											display: "flex",
											alignItems: "center",
											gap: 7,
											padding: "5px 9px 5px 6px",
											borderRadius: "var(--r-sm)",
											cursor: "pointer",
											background: on ? "var(--accent-bg)" : "var(--ink-950)",
											border: `1px solid ${on ? "var(--accent)" : "var(--border-default)"}`,
											color: on ? "var(--accent)" : "var(--fg-2)",
											font: "500 12px/1 var(--font-ui)",
											position: "relative",
										}}
									>
										<SpellIcon spell={s} size={22} />
										{CCP.SPELLS[s].name}
										{on && (
											<span style={{ font: "600 9px/1 var(--font-mono)" }}>
												{order === 0 ? "D" : "F"}
											</span>
										)}
									</button>
								)
							})}
						</div>
					</Field>
				</div>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "14px 18px",
						borderTop: "1px solid var(--border-default)",
						gap: 10,
					}}
				>
					{!isNew ? (
						<Button kind="danger" icon="trash" onClick={onDelete}>
							Delete
						</Button>
					) : (
						<span />
					)}
					<div style={{ display: "flex", gap: 8 }}>
						<Button kind="ghost" onClick={onClose}>
							Cancel
						</Button>
						<Button kind="primary" icon="check" disabled={!canSave} onClick={onSave}>
							{isNew ? "Create note" : "Save"}
						</Button>
					</div>
				</div>
			</div>
		</>
	)
}

function Field({ label, hint, req, children }) {
	return (
		<label style={{ display: "flex", flexDirection: "column", gap: 7 }}>
			<span
				style={{
					display: "flex",
					alignItems: "center",
					gap: 6,
					font: "500 11px/1 var(--font-mono)",
					letterSpacing: "0.06em",
					textTransform: "uppercase",
					color: "var(--fg-3)",
				}}
			>
				{label}
				{req && <span style={{ color: "var(--accent)" }}>*</span>}
				{hint && (
					<span
						style={{
							textTransform: "none",
							letterSpacing: 0,
							fontFamily: "var(--font-ui)",
							color: "var(--fg-4)",
							fontWeight: 400,
							fontSize: 10,
						}}
					>
						· {hint}
					</span>
				)}
			</span>
			{children}
		</label>
	)
}

/* ------------------------------ Library -------------------------------- */
function Notes({ notes, editing, setEditing, draft, setDraft, onSave, onDelete }) {
	const [q, setQ] = useNT("")
	const filtered = notes.filter((n) => {
		if (!q) return true
		const t = q.toLowerCase()
		return (
			(n.body || "").toLowerCase().includes(t) ||
			CCP.champ(n.champ)?.name.toLowerCase().includes(t) ||
			(n.opponent && CCP.champ(n.opponent)?.name.toLowerCase().includes(t))
		)
	})

	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				gap: 16,
				minHeight: 0,
				position: "relative",
			}}
		>
			<div
				style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}
			>
				<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
					<h1 className="t-h2" style={{ margin: 0 }}>
						Notes
					</h1>
					<span style={{ font: "400 12px/1 var(--font-mono)", color: "var(--fg-4)" }}>
						{notes.length} matchup{notes.length === 1 ? "" : "s"}
					</span>
				</div>
				<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
					<SearchField
						value={q}
						onChange={setQ}
						placeholder="Search notes & champions"
						style={{ width: 248 }}
					/>
					<Button kind="primary" icon="plus" onClick={() => setEditing("new")}>
						New note
					</Button>
				</div>
			</div>

			{filtered.length === 0 ? (
				<Card style={{ flex: 1, display: "grid", placeItems: "center" }}>
					{notes.length === 0 ? (
						<EmptyState
							icon="book"
							title="No notes yet"
							line="Jot what wins a matchup — trades, timings, what to respect. They’ll surface the moment you lock in."
							action={
								<Button kind="primary" icon="plus" onClick={() => setEditing("new")}>
									Write your first note
								</Button>
							}
						/>
					) : (
						<EmptyState
							icon="search"
							title="Nothing matches"
							line={`No notes for “${q}”.`}
							compact
						/>
					)}
				</Card>
			) : (
				<div
					style={{
						flex: 1,
						minHeight: 0,
						overflowY: "auto",
						display: "grid",
						gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
						gridAutoRows: "minmax(186px, auto)",
						gap: 14,
						paddingBottom: 4,
					}}
				>
					{filtered.map((n) => (
						<NoteCard key={n.id} note={n} variant="full" onClick={() => setEditing(n.id)} />
					))}
				</div>
			)}

			{editing && draft && (
				<NoteEditor
					draft={draft}
					onChange={setDraft}
					onSave={onSave}
					onDelete={onDelete}
					onClose={() => setEditing(null)}
					isNew={editing === "new"}
				/>
			)}
		</div>
	)
}

window.Notes = Notes
