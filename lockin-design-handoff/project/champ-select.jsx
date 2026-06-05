/* global React, ChampSelectParts, Card, CCP */
/* =========================================================================
   Champ Co-Pilot — Champ Select layouts (stacked / hero / rail)
   Owns the live phase timer + ban→pick transition.
   ========================================================================= */
const { useState: useCSL, useEffect: useCSLE, useRef: useCSLR } = React
const { dens, HeaderStrip, NotesRegion, LoadoutRegion, BansRegion, TeamRegion } = ChampSelectParts

const PHASE_LEN = { ban: 27, pick: 31 }

function ChampSelect({
	layout = "stacked",
	density = "cozy",
	settings,
	demo,
	notes,
	banlist,
	onEditBody,
	onAddNote,
	onGoNotes,
}) {
	const [subPhase, setSubPhase] = useCSL("ban")
	const [secondsLeft, setSecondsLeft] = useCSL(PHASE_LEN.ban)
	const [bansCollapsed, setBansCollapsed] = useCSL(false)
	const tickRef = useCSLR(null)

	// live countdown
	useCSLE(() => {
		tickRef.current = setInterval(() => {
			setSecondsLeft((s) => {
				if (s <= 1) {
					setSubPhase((p) => {
						if (p === "ban") {
							setBansCollapsed(true)
							return "pick"
						}
						return "pick"
					})
					return PHASE_LEN.pick
				}
				return s - 1
			})
		}, 1000)
		return () => clearInterval(tickRef.current)
	}, [])

	// demo overrides for sub-phase / enemy reveal
	const forcedBan = demo.csSubPhase === "ban"
	const forcedPick = demo.csSubPhase === "pick"
	const effSub = forcedBan ? "ban" : forcedPick ? "pick" : subPhase
	useCSLE(() => {
		if (forcedBan) {
			setSubPhase("ban")
			setSecondsLeft(PHASE_LEN.ban)
			setBansCollapsed(false)
		}
		if (forcedPick) {
			setSubPhase("pick")
			setSecondsLeft(PHASE_LEN.pick)
			setBansCollapsed(true)
		}
	}, [demo.csSubPhase])

	const enemyHidden = demo.enemyHidden != null ? demo.enemyHidden : effSub === "ban"
	const ranksAvailable = demo.ranksAvailable
	const roleAssigned = demo.roleAssigned
	const opponent = "Fiora"
	const me = CCP.ME

	// matching note for this matchup
	const matchNote = demo.hasNote
		? notes.find((n) => n.champ === me.champ && n.opponent === opponent)
		: null

	const d = dens(density)
	const advance = () => {
		if (effSub === "ban") {
			setSubPhase("pick")
			setSecondsLeft(PHASE_LEN.pick)
			setBansCollapsed(true)
		} else {
			setSubPhase("ban")
			setSecondsLeft(PHASE_LEN.ban)
			setBansCollapsed(false)
		}
	}

	const ban = effSub === "ban"
	const spells =
		matchNote?.spells && matchNote.spells.length === 2
			? matchNote.spells
			: roleAssigned
				? ["Flash", "Teleport"]
				: ["Flash", "Ignite"]
	const header = (
		<HeaderStrip
			me={me}
			roleAssigned={roleAssigned}
			subPhase={effSub}
			secondsLeft={secondsLeft}
			phaseTotal={PHASE_LEN[effSub]}
			onAdvance={advance}
			pad={d.pad}
			compact={layout === "rail"}
			spells={spells}
			spellLayout={settings.spellLayout}
		/>
	)
	const notesP = {
		note: matchNote,
		enemyHidden,
		opponent,
		me,
		onChangeBody: onEditBody,
		onAddNote: onGoNotes,
		pad: d.pad,
	}
	const bansP = {
		banlist,
		enemyHidden,
		collapsed: !ban && bansCollapsed,
		onToggle: () => setBansCollapsed((v) => !v),
		pad: d.pad,
	}
	const teamP = {
		team: CCP.TEAM,
		ranksAvailable,
		threshold: settings.mismatchThreshold,
		pad: d.pad,
	}

	const wrap = {
		height: "100%",
		display: "flex",
		flexDirection: "column",
		gap: d.gap,
		minHeight: 0,
	}
	const col = { display: "flex", flexDirection: "column", gap: d.gap, minHeight: 0 }

	if (layout === "hero") {
		return (
			<div style={wrap}>
				{header}
				{ban ? (
					<>
						<div style={{ flex: "0 0 auto", display: "flex", minHeight: 132 }}>
							<NotesRegion grow {...notesP} />
						</div>
						<div style={{ flex: "1 1 0", display: "flex", minHeight: 0 }}>
							<BansRegion grow {...bansP} />
						</div>
					</>
				) : (
					<>
						<div style={{ flex: "1 1 0", display: "flex", minHeight: 128 }}>
							<NotesRegion grow {...notesP} />
						</div>
						<BansRegion {...bansP} />
						<div style={{ flex: "0 0 auto", display: "flex", minHeight: 0 }}>
							<TeamRegion cols={2} {...teamP} />
						</div>
					</>
				)}
			</div>
		)
	}

	if (layout === "rail") {
		return (
			<div
				style={{
					height: "100%",
					display: "grid",
					gridTemplateColumns: "1fr 314px",
					gridTemplateRows: "minmax(0, 1fr)",
					gap: d.gap,
					minHeight: 0,
				}}
			>
				<div style={col}>
					{header}
					<NotesRegion grow {...notesP} />
				</div>
				<div style={col}>
					{ban ? (
						<>
							<TeamRegion {...teamP} />
							<BansRegion grow {...bansP} />
						</>
					) : (
						<>
							<TeamRegion grow {...teamP} />
							<BansRegion {...bansP} />
						</>
					)}
				</div>
			</div>
		)
	}

	// stacked (default)
	return (
		<div style={wrap}>
			{header}
			<div
				style={{
					flex: 1,
					display: "grid",
					gridTemplateColumns: "1.5fr 1fr",
					gridTemplateRows: "minmax(0, 1fr)",
					gap: d.gap,
					minHeight: 0,
				}}
			>
				<NotesRegion grow {...notesP} />
				<div style={col}>
					{ban ? (
						<>
							<BansRegion grow {...bansP} />
							<TeamRegion {...teamP} />
						</>
					) : (
						<>
							<BansRegion {...bansP} />
							<TeamRegion grow {...teamP} />
						</>
					)}
				</div>
			</div>
		</div>
	)
}

window.ChampSelect = ChampSelect
