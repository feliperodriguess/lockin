/* global React, Icon, Card, Button, Eyebrow, Pill, ChampionPortrait, SpellPair, ItemRow, ItemIcon, CountdownRing, RankBadge, MismatchFlag, YourPickBadge, ThreatBadge, RoleTag, RoleGlyph, NoteCard, CCP */
/* =========================================================================
   Champ Co-Pilot — Champ Select (the hero screen)
   One set of card regions, three switchable layouts (Tweaks-driven).
   ========================================================================= */
const { useState: useCS, useEffect: useCSE, useRef: useCSR } = React

/* density → spacing */
function dens(density) {
	return (
		{
			compact: { gap: 10, pad: 13 },
			cozy: { gap: 14, pad: 16 },
			comfortable: { gap: 18, pad: 20 },
		}[density] || { gap: 14, pad: 16 }
	)
}

/* ----------------------------- Card section ---------------------------- */
function Section({ label, right, pad, children, emphasis, grow, scroll, style }) {
	return (
		<Card
			emphasis={emphasis}
			style={{
				display: "flex",
				flexDirection: "column",
				padding: pad,
				gap: pad * 0.7,
				minHeight: 0,
				overflow: "hidden",
				...(grow ? { flex: "1 1 0" } : {}),
				...style,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 8,
					flexShrink: 0,
				}}
			>
				<Eyebrow line={20}>{label}</Eyebrow>
				{right}
			</div>
			<div
				style={{
					flex: 1,
					minHeight: 0,
					display: "flex",
					flexDirection: "column",
					overflowY: scroll ? "auto" : "hidden",
					margin: scroll ? "0 -4px" : 0,
				}}
			>
				{children}
			</div>
		</Card>
	)
}

/* --------------------------- Header strip ------------------------------ */
function HeaderStrip({
	me,
	roleAssigned,
	subPhase,
	secondsLeft,
	phaseTotal,
	onAdvance,
	pad,
	compact,
	spells,
	spellLayout,
}) {
	const danger = secondsLeft <= 10
	const tone = danger ? "warn" : "accent"
	return (
		<Card
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				padding: pad,
				gap: compact ? 12 : 16,
				minHeight: compact ? 78 : 88,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: compact ? 12 : 15, minWidth: 0 }}>
				<ChampionPortrait champKey={me.champ} size={compact ? 46 : 54} ring radius={10} />
				<div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
					<div style={{ display: "flex", alignItems: "center", gap: 9 }}>
						<span
							style={{
								font: `600 ${compact ? 16 : 19}px/1 var(--font-ui)`,
								color: "var(--fg-1)",
								letterSpacing: "-0.01em",
							}}
						>
							{CCP.champ(me.champ)?.name}
						</span>
						{!compact && (
							<span
								style={{
									font: "italic 400 14px/1 var(--font-display)",
									color: "var(--fg-3)",
									whiteSpace: "nowrap",
								}}
							>
								{CCP.champ(me.champ)?.title}
							</span>
						)}
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
						{roleAssigned ? (
							<RoleTag role={me.role} active />
						) : (
							<span
								style={{
									display: "inline-flex",
									alignItems: "center",
									gap: 5,
									font: "500 10px/1 var(--font-mono)",
									letterSpacing: "0.06em",
									textTransform: "uppercase",
									color: "var(--warn)",
									padding: "3px 8px",
									background: "var(--warn-bg)",
									borderRadius: "var(--r-sm)",
									flexShrink: 0,
								}}
							>
								<Icon name="help" size={11} />
								Role pending
							</span>
						)}
						<span
							style={{
								font: "500 11px/1.3 var(--font-mono)",
								color: "var(--fg-4)",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								minWidth: 0,
							}}
						>
							{me.summoner}
						</span>
					</div>
				</div>
				<span
					style={{ width: 1, height: 40, background: "var(--border-default)", flexShrink: 0 }}
				/>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 6,
						alignItems: "flex-start",
						flexShrink: 0,
					}}
				>
					{!compact && (
						<span
							style={{
								font: "600 9px/1 var(--font-mono)",
								letterSpacing: "0.14em",
								textTransform: "uppercase",
								color: "var(--fg-3)",
							}}
						>
							Spells
						</span>
					)}
					<SpellPair spells={spells} layout={spellLayout} size={compact ? 32 : 36} showKeys />
				</div>
			</div>

			<button
				onClick={onAdvance}
				title="Advance phase (demo)"
				style={{
					display: "flex",
					alignItems: "center",
					gap: compact ? 10 : 14,
					background: "none",
					border: "none",
					cursor: "pointer",
					padding: 0,
					flexShrink: 0,
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
					<span
						style={{
							font: "600 10px/1 var(--font-mono)",
							letterSpacing: "0.14em",
							textTransform: "uppercase",
							color: danger ? "var(--warn)" : "var(--fg-3)",
						}}
					>
						{subPhase === "ban" ? "Ban phase" : "Pick phase"}
					</span>
					{!compact && (
						<span
							style={{
								font: "400 11px/1 var(--font-ui)",
								color: "var(--fg-4)",
								whiteSpace: "nowrap",
							}}
						>
							{danger ? "Dodge window closing" : "Time to dodge if comp is bad"}
						</span>
					)}
				</div>
				<CountdownRing
					size={compact ? 54 : 66}
					stroke={5}
					progress={secondsLeft / phaseTotal}
					tone={tone}
					value={secondsLeft}
					sub=""
					pulsing={danger}
				/>
			</button>
		</Card>
	)
}

/* ------------------------------ Notes region --------------------------- */
function NotesRegion({
	note,
	enemyHidden,
	opponent,
	me,
	onChangeBody,
	onAddNote,
	pad,
	grow,
	emphasis = true,
}) {
	let body
	if (enemyHidden) {
		body = (
			<div
				style={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					textAlign: "center",
					gap: 10,
					padding: "8px 12px",
				}}
			>
				<Icon name="eyeoff" size={24} style={{ color: "var(--fg-4)" }} />
				<div style={{ font: "500 14px/1.4 var(--font-ui)", color: "var(--fg-2)" }}>
					Enemy laner not revealed yet
				</div>
				<div style={{ font: "400 12.5px/1.5 var(--font-ui)", color: "var(--fg-4)", maxWidth: 280 }}>
					Your <b style={{ color: "var(--fg-2)", fontWeight: 600 }}>{CCP.champ(me.champ)?.name}</b>{" "}
					matchup notes appear here the moment they lock in.
				</div>
			</div>
		)
	} else if (note) {
		body = <NoteCard note={note} variant="compact" editable onChangeBody={onChangeBody} />
	} else {
		body = (
			<div
				style={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					gap: 12,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<ChampionPortrait champKey={me.champ} size={24} />
					<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>vs</span>
					<ChampionPortrait champKey={opponent} size={24} />
				</div>
				<div style={{ font: "400 14px/1.5 var(--font-ui)", color: "var(--fg-2)" }}>
					No note yet for{" "}
					<b style={{ color: "var(--fg-1)", fontWeight: 600 }}>{CCP.champ(me.champ)?.name}</b> vs{" "}
					<b style={{ color: "var(--fg-1)", fontWeight: 600 }}>{CCP.champ(opponent)?.name}</b>.
				</div>
				<Button
					kind="primary"
					icon="plus"
					size="md"
					onClick={onAddNote}
					style={{ alignSelf: "flex-start" }}
				>
					Add a note
				</Button>
			</div>
		)
	}
	return (
		<Section
			label="Your note"
			pad={pad}
			grow={grow}
			emphasis={emphasis && !enemyHidden && !!note}
			right={
				note && !enemyHidden ? (
					<span style={{ font: "400 10px/1 var(--font-mono)", color: "var(--fg-4)" }}>
						{note.updated}
					</span>
				) : null
			}
			style={{ minHeight: 0 }}
		>
			{body}
		</Section>
	)
}

/* ----------------------------- Loadout region -------------------------- */
function LoadoutRegion({ note, roleAssigned, spellLayout, pad, grow }) {
	const yourPick = !!note && (note.items?.length || note.spells?.length)
	const spells =
		note?.spells?.length === 2
			? note.spells
			: roleAssigned
				? ["Flash", "Teleport"]
				: ["Flash", "Ignite"]
	const items = note?.items?.length
		? note.items
		: roleAssigned
			? ["doransBlade", "healthPotion"]
			: ["doransShield", "healthPotion"]
	return (
		<Section
			label="Loadout"
			pad={pad}
			grow={grow}
			right={yourPick ? <YourPickBadge /> : <Pill tone="neutral">Suggested</Pill>}
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: pad * 0.75,
					justifyContent: "center",
					flex: 1,
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span
						style={{
							font: "500 11px/1 var(--font-mono)",
							letterSpacing: "0.04em",
							color: "var(--fg-3)",
							width: 56,
						}}
					>
						Spells
					</span>
					<SpellPair spells={spells} layout={spellLayout} size={34} showKeys />
				</div>
				<div style={{ height: 1, background: "var(--border-subtle)" }} />
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					<span
						style={{
							font: "500 11px/1 var(--font-mono)",
							letterSpacing: "0.04em",
							color: "var(--fg-3)",
							width: 56,
						}}
					>
						Start
					</span>
					<ItemRow items={items} size={34} />
				</div>
				{!roleAssigned && (
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							font: "400 11px/1.3 var(--font-ui)",
							color: "var(--fg-4)",
						}}
					>
						<Icon name="help" size={12} />
						Role pending — showing champion defaults
					</div>
				)}
			</div>
		</Section>
	)
}

/* ------------------------------- Bans region --------------------------- */
function BanRow({ entry, enemyHidden, pad }) {
	const c = CCP.champ(entry.champ)
	const gone = entry.status === "banned" || entry.status === "picked"
	const showThreat = entry.threat && !enemyHidden
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "7px 9px",
				borderRadius: "var(--r-sm)",
				background: showThreat ? "var(--fail-bg)" : "transparent",
				border: showThreat ? "1px solid rgba(255,107,94,0.22)" : "1px solid transparent",
				opacity: gone ? 0.42 : 1,
			}}
		>
			<ChampionPortrait champKey={entry.champ} size={30} dim={gone} />
			<div style={{ flex: 1, minWidth: 0 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
					<span
						style={{
							font: "600 13px/1 var(--font-ui)",
							color: gone ? "var(--fg-3)" : "var(--fg-1)",
							textDecoration: gone ? "line-through" : "none",
						}}
					>
						{c?.name}
					</span>
					{showThreat && <ThreatBadge />}
				</div>
				{entry.reason && (
					<div
						style={{
							font: "400 11px/1.3 var(--font-ui)",
							color: "var(--fg-4)",
							marginTop: 2,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{entry.reason}
					</div>
				)}
			</div>
			<span
				style={{
					font: "500 9px/1 var(--font-mono)",
					letterSpacing: "0.06em",
					textTransform: "uppercase",
					color: gone ? "var(--fg-4)" : "var(--accent)",
					flexShrink: 0,
				}}
			>
				{entry.status === "banned" ? "Banned" : entry.status === "picked" ? "Picked" : "Open"}
			</span>
		</div>
	)
}

function BansRegion({ banlist, enemyHidden, collapsed, onToggle, pad, grow }) {
	const ordered = [...banlist].sort((a, b) => {
		const at = a.threat && !enemyHidden ? 0 : 1,
			bt = b.threat && !enemyHidden ? 0 : 1
		if (at !== bt) return at - bt
		return 0
	})
	const goneCount = banlist.filter((b) => b.status !== "available").length
	if (collapsed) {
		return (
			<Card
				hover
				onClick={onToggle}
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: `${pad * 0.7}px ${pad}px`,
					cursor: "pointer",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 9 }}>
					<Icon name="shield" size={15} style={{ color: "var(--fg-3)" }} />
					<span style={{ font: "500 12.5px/1 var(--font-ui)", color: "var(--fg-2)" }}>
						Ban phase complete
					</span>
					<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>
						{goneCount} of your targets gone
					</span>
				</div>
				<Icon name="chevdown" size={15} style={{ color: "var(--fg-4)" }} />
			</Card>
		)
	}
	return (
		<Section
			label="Ban suggestions"
			pad={pad}
			grow={grow}
			scroll
			right={
				<span style={{ font: "400 10px/1 var(--font-mono)", color: "var(--fg-4)" }}>
					{goneCount}/{banlist.length} gone
				</span>
			}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
				{ordered.map((e, _i) => (
					<BanRow key={e.champ} entry={e} enemyHidden={enemyHidden} pad={pad} />
				))}
			</div>
		</Section>
	)
}

/* ------------------------------- Team region --------------------------- */
function TeamRow({ p, ranksAvailable }) {
	const showRank = ranksAvailable || p.you
	const _rk = showRank ? p.rank : { status: "unavailable" }
	return (
		<div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px" }}>
			<RoleGlyph role={p.role} size={15} color="var(--fg-4)" />
			<ChampionPortrait champKey={p.champ} size={30} ring={p.you} />
			<div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
				<span
					style={{
						font: "600 12.5px/1 var(--font-ui)",
						color: p.you ? "var(--accent)" : "var(--fg-1)",
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
					}}
				>
					{p.summoner}
					{p.you ? " (you)" : ""}
				</span>
				<span style={{ font: "400 10px/1 var(--font-mono)", color: "var(--fg-4)" }}>
					{CCP.champ(p.champ)?.name}
				</span>
			</div>
			{showRank ? (
				<RankBadge rank={p.rank} size="sm" />
			) : (
				<span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>—</span>
			)}
		</div>
	)
}

function TeamRegion({ team, ranksAvailable, threshold, pad, grow, cols }) {
	const known = team
		.filter((p) => ranksAvailable || p.you)
		.map((p) => CCP.rankIdx(p.rank))
		.filter((x) => x >= 0)
	const spread = known.length >= 2 ? Math.max(...known) - Math.min(...known) : 0
	const mismatch = ranksAvailable && spread >= threshold
	const grid = cols === 2
	return (
		<Section
			label="Your team"
			pad={pad}
			grow={grow}
			scroll={grow}
			right={
				mismatch ? (
					<MismatchFlag />
				) : !ranksAvailable ? (
					<Pill tone="neutral" icon="wifioff">
						Ranks unavailable
					</Pill>
				) : null
			}
		>
			<div
				style={
					grid
						? {
								display: "grid",
								gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
								columnGap: 16,
								rowGap: 2,
								alignContent: "center",
								flex: 1,
							}
						: {
								display: "flex",
								flexDirection: "column",
								gap: 1,
								flex: 1,
								justifyContent: grow ? "flex-start" : "center",
							}
				}
			>
				{team.map((p, i) => (
					<TeamRow key={i} p={p} ranksAvailable={ranksAvailable} />
				))}
			</div>
		</Section>
	)
}

window.ChampSelectParts = {
	dens,
	Section,
	HeaderStrip,
	NotesRegion,
	LoadoutRegion,
	BansRegion,
	TeamRegion,
}
