/* global React, Icon, Button, Card, Eyebrow, EmptyState, Pill, CountdownRing, NoteCard, ConnectionIndicator, ChampSelect, ChampSelectParts, CCP */
/* =========================================================================
   Champ Co-Pilot — Live view (phase-driven)
   disconnected · idle · ready · select   (+ ingame → quiet idle)
   ========================================================================= */
const { useState: useLV, useEffect: useLVE, useRef: useLVR } = React

/* ---------------------------- Disconnected ----------------------------- */
function Disconnected({ density }) {
	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 22,
				textAlign: "center",
			}}
		>
			<div
				style={{
					position: "relative",
					width: 92,
					height: 92,
					display: "grid",
					placeItems: "center",
				}}
			>
				<span
					className="ccp-halo"
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: "50%",
						border: "1px solid var(--border-default)",
					}}
				/>
				<span
					className="ccp-halo ccp-halo-2"
					style={{
						position: "absolute",
						inset: 0,
						borderRadius: "50%",
						border: "1px solid var(--border-default)",
					}}
				/>
				<div
					className="ccp-breathe"
					style={{
						width: 60,
						height: 60,
						borderRadius: "50%",
						background: "var(--ink-850)",
						border: "1px solid var(--border-default)",
						display: "grid",
						placeItems: "center",
						color: "var(--fg-3)",
					}}
				>
					<Icon name="wifioff" size={26} stroke={1.5} />
				</div>
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 340 }}>
				<div style={{ font: "400 26px/1.3 var(--font-display)", color: "var(--fg-1)" }}>
					Waiting for the League client…
				</div>
				<div style={{ font: "400 13.5px/1.55 var(--font-ui)", color: "var(--fg-3)" }}>
					We’ll wake up the moment it opens. Your notes and settings stay available in the meantime.
				</div>
			</div>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 8,
					font: "500 11px/1 var(--font-mono)",
					letterSpacing: "0.04em",
					color: "var(--fg-4)",
				}}
			>
				<span
					className="ccp-breathe"
					style={{ width: 6, height: 6, borderRadius: 999, background: "var(--fg-4)" }}
				/>
				Listening on 127.0.0.1
			</div>
		</div>
	)
}

/* -------------------------------- Idle --------------------------------- */
function Idle({ notes, onNewNote, onOpenNote, onGoBans, density }) {
	const recent = notes.slice(0, 4)
	return (
		<div
			style={{ height: "100%", display: "flex", flexDirection: "column", gap: 18, minHeight: 0 }}
		>
			<Card
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 16,
					padding: 20,
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
					<Eyebrow line={22}>Connected · standing by</Eyebrow>
					<div style={{ font: "400 24px/1.3 var(--font-display)", color: "var(--fg-1)" }}>
						Back at it. Queue up when you’re ready.
					</div>
					<div style={{ font: "400 13px/1.5 var(--font-ui)", color: "var(--fg-3)", maxWidth: 420 }}>
						Lockin wakes up the moment champ select begins. Until then, sharpen your notes.
					</div>
				</div>
				<Button kind="primary" icon="plus" size="lg" onClick={onNewNote}>
					New note
				</Button>
			</Card>

			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<Eyebrow line={22}>Recent notes</Eyebrow>
				<button
					onClick={onGoBans}
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						background: "none",
						border: "none",
						cursor: "pointer",
						color: "var(--fg-3)",
						font: "500 12px/1 var(--font-ui)",
					}}
				>
					<Icon name="shield" size={13} />
					Manage ban list
					<Icon name="chevright" size={13} />
				</button>
			</div>

			<div
				style={{
					flex: 1,
					minHeight: 0,
					display: "grid",
					gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
					gridAutoRows: "1fr",
					gap: 14,
					overflowY: "auto",
				}}
			>
				{recent.map((n) => (
					<NoteCard key={n.id} note={n} variant="full" onClick={() => onOpenNote(n)} />
				))}
			</div>
		</div>
	)
}

/* ----------------------------- Ready Check ----------------------------- */
function ReadyCheck({ settings, demo, density }) {
	const TOTAL = 10
	const [left, setLeft] = useLV(TOTAL)
	const [state, setState] = useLV("waiting") // waiting | accepted | declined
	const ref = useLVR(null)

	// demo: force the auto-accept fired confirmation
	useLVE(() => {
		if (demo.autoAcceptFired) setState("accepted")
	}, [demo.autoAcceptFired])

	useLVE(() => {
		if (state !== "waiting") return
		ref.current = setInterval(() => {
			setLeft((s) => {
				if (s <= 1) {
					clearInterval(ref.current)
					setState(settings.autoAccept ? "accepted" : "expired")
					return 0
				}
				return s - 1
			})
		}, 1000)
		return () => clearInterval(ref.current)
	}, [state])

	if (state === "accepted") {
		return (
			<div
				style={{
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 22,
				}}
			>
				<CountdownRing
					size={176}
					stroke={8}
					progress={1}
					tone="accent"
					value={<Icon name="check" size={52} stroke={2.5} style={{ color: "var(--accent)" }} />}
					label="Accepted"
				/>
				<div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}>
					<div style={{ font: "400 22px/1.3 var(--font-display)", color: "var(--fg-1)" }}>
						Match accepted
					</div>
					<div style={{ font: "400 13px/1.4 var(--font-ui)", color: "var(--fg-3)" }}>
						{settings.autoAccept
							? "Auto-accept handled it — sit tight for champ select."
							: "Locked in. Loading champ select…"}
					</div>
				</div>
			</div>
		)
	}
	if (state === "declined" || state === "expired") {
		return (
			<div
				style={{
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: 20,
				}}
			>
				<CountdownRing
					size={176}
					stroke={8}
					progress={1}
					tone="warn"
					value={<Icon name="x" size={48} stroke={2.5} style={{ color: "var(--warn)" }} />}
					label={state === "declined" ? "Declined" : "Missed"}
				/>
				<div style={{ font: "400 13px/1.4 var(--font-ui)", color: "var(--fg-3)" }}>
					Back to the queue.
				</div>
			</div>
		)
	}
	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: 26,
			}}
		>
			<CountdownRing
				size={188}
				stroke={9}
				progress={left / TOTAL}
				tone={left <= 3 ? "warn" : "accent"}
				value={left}
				label="seconds"
				pulsing={left <= 3}
			/>
			<div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "center" }}>
				<div style={{ font: "600 20px/1.1 var(--font-ui)", color: "var(--fg-1)" }}>
					{settings.autoAccept ? "Auto-accepting…" : "Match found — accept?"}
				</div>
				<div style={{ font: "400 12.5px/1 var(--font-mono)", color: "var(--fg-4)" }}>
					{settings.autoAccept ? `Firing in ${left}s · cancel to take over` : "Your move"}
				</div>
			</div>
			<div style={{ display: "flex", gap: 12 }}>
				<Button
					kind="primary"
					size="lg"
					icon="check"
					onClick={() => {
						clearInterval(ref.current)
						setState("accepted")
					}}
					style={{ minWidth: 132 }}
				>
					Accept
				</Button>
				<Button
					kind="danger"
					size="lg"
					icon="x"
					onClick={() => {
						clearInterval(ref.current)
						setState("declined")
					}}
					style={{ minWidth: 132 }}
				>
					Decline
				</Button>
			</div>
		</div>
	)
}

/* ------------------------------ LiveView ------------------------------- */
function LiveView({
	phase,
	density,
	settings,
	demo,
	csLayout,
	notes,
	banlist,
	onNewNote,
	onOpenNote,
	onGoBans,
	onGoNotes,
	onEditBody,
}) {
	if (phase === "disconnected") return <Disconnected density={density} />
	if (phase === "ready") return <ReadyCheck settings={settings} demo={demo} density={density} />
	if (phase === "select")
		return (
			<ChampSelect
				layout={csLayout}
				density={density}
				settings={settings}
				demo={demo}
				notes={notes}
				banlist={banlist}
				onEditBody={onEditBody}
				onAddNote={onGoNotes}
				onGoNotes={onGoNotes}
			/>
		)
	return (
		<Idle
			notes={notes}
			onNewNote={onNewNote}
			onOpenNote={onOpenNote}
			onGoBans={onGoBans}
			density={density}
		/>
	)
}

window.LiveView = LiveView
