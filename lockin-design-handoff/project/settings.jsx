/* global React, Icon, Button, Input, Toggle, Card, Eyebrow, Pill, ChampionPicker, ChampionPortrait, SpellIcon, ThreatBadge, CCP */
/* =========================================================================
   Champ Co-Pilot — Settings + ban-list editor
   ========================================================================= */
const { useState: useST } = React

function Group({ label, children }) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<Eyebrow line={22}>{label}</Eyebrow>
			<Card style={{ padding: "4px 16px" }}>{children}</Card>
		</div>
	)
}
function Row({ title, desc, control, last }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 20,
				padding: "15px 0",
				borderBottom: last ? "none" : "1px solid var(--border-subtle)",
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
				<span style={{ font: "500 14px/1.2 var(--font-ui)", color: "var(--fg-1)" }}>{title}</span>
				{desc && (
					<span
						style={{ font: "400 12px/1.45 var(--font-ui)", color: "var(--fg-4)", maxWidth: 380 }}
					>
						{desc}
					</span>
				)}
			</div>
			<div style={{ flexShrink: 0 }}>{control}</div>
		</div>
	)
}

/* segmented radio */
function Segmented({ value, options, onChange }) {
	return (
		<div
			style={{
				display: "inline-flex",
				padding: 3,
				gap: 2,
				background: "var(--ink-950)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--r-sm)",
			}}
		>
			{options.map((o) => {
				const on = value === o.value
				return (
					<button
						key={o.value}
						onClick={() => onChange(o.value)}
						style={{
							padding: "5px 12px",
							borderRadius: 4,
							border: "none",
							cursor: "pointer",
							background: on ? "var(--accent)" : "transparent",
							color: on ? "var(--accent-fg)" : "var(--fg-2)",
							font: "600 12px/1 var(--font-ui)",
							transition: "background var(--dur-base) var(--ease-standard)",
						}}
					>
						{o.label}
					</button>
				)
			})}
		</div>
	)
}

/* ----------------------------- Ban editor ------------------------------ */
function BanEditor({ banlist, setBanlist }) {
	const move = (i, dir) => {
		const j = i + dir
		if (j < 0 || j >= banlist.length) return
		const next = [...banlist]
		;[next[i], next[j]] = [next[j], next[i]]
		setBanlist(next)
	}
	const remove = (i) => setBanlist(banlist.filter((_, k) => k !== i))
	const setReason = (i, v) => setBanlist(banlist.map((e, k) => (k === i ? { ...e, reason: v } : e)))
	const add = (key) => {
		if (key && !banlist.find((e) => e.champ === key))
			setBanlist([...banlist, { champ: key, reason: "", status: "available" }])
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<Eyebrow line={22}>Ban list · priority order</Eyebrow>
				<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>
					{banlist.length} champions
				</span>
			</div>
			<Card style={{ padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
				{banlist.length === 0 && (
					<div
						style={{
							padding: "24px",
							textAlign: "center",
							font: "400 13px/1.5 var(--font-ui)",
							color: "var(--fg-4)",
						}}
					>
						Your ban list is empty. Add the champions you never want to face.
					</div>
				)}
				{banlist.map((e, i) => (
					<div
						key={e.champ}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 10,
							padding: "7px 8px",
							borderRadius: "var(--r-sm)",
							background: "var(--ink-950)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<span
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								color: "var(--fg-4)",
							}}
						>
							<button
								onClick={() => move(i, -1)}
								disabled={i === 0}
								style={{
									background: "none",
									border: "none",
									cursor: i === 0 ? "default" : "pointer",
									color: i === 0 ? "var(--ink-600)" : "var(--fg-3)",
									padding: 0,
									display: "flex",
									height: 13,
								}}
							>
								<Icon name="chevup" size={14} />
							</button>
							<button
								onClick={() => move(i, 1)}
								disabled={i === banlist.length - 1}
								style={{
									background: "none",
									border: "none",
									cursor: i === banlist.length - 1 ? "default" : "pointer",
									color: i === banlist.length - 1 ? "var(--ink-600)" : "var(--fg-3)",
									padding: 0,
									display: "flex",
									height: 13,
								}}
							>
								<Icon name="chevdown" size={14} />
							</button>
						</span>
						<span
							style={{
								font: "600 11px/1 var(--font-mono)",
								color: "var(--fg-4)",
								width: 16,
								textAlign: "center",
							}}
						>
							{i + 1}
						</span>
						<ChampionPortrait champKey={e.champ} size={30} />
						<div
							style={{ display: "flex", flexDirection: "column", gap: 2, width: 96, flexShrink: 0 }}
						>
							<span
								style={{
									display: "flex",
									alignItems: "center",
									gap: 6,
									font: "600 13px/1 var(--font-ui)",
									color: "var(--fg-1)",
								}}
							>
								{CCP.champ(e.champ)?.name}
								{e.threat && <ThreatBadge />}
							</span>
						</div>
						<input
							value={e.reason || ""}
							onChange={(ev) => setReason(i, ev.target.value)}
							placeholder="Add a reason (optional)"
							style={{
								flex: 1,
								minWidth: 0,
								background: "transparent",
								border: "none",
								outline: "none",
								color: "var(--fg-2)",
								font: "400 12.5px/1 var(--font-ui)",
							}}
						/>
						<button
							onClick={() => remove(i)}
							title="Remove"
							style={{
								background: "none",
								border: "none",
								cursor: "pointer",
								color: "var(--fg-4)",
								display: "flex",
								padding: 4,
							}}
							onMouseEnter={(ev) => (ev.currentTarget.style.color = "var(--fail)")}
							onMouseLeave={(ev) => (ev.currentTarget.style.color = "var(--fg-4)")}
						>
							<Icon name="trash" size={15} />
						</button>
					</div>
				))}
				<div style={{ padding: "6px 4px 2px", maxWidth: 280 }}>
					<ChampionPicker
						value={null}
						onChange={add}
						placeholder="Add champion to ban list"
						size="sm"
					/>
				</div>
			</Card>
		</div>
	)
}

/* ------------------------------ Settings ------------------------------- */
function Settings({ settings, setSettings, banlist, setBanlist }) {
	const set = (k, v) => setSettings({ ...settings, [k]: v })
	const dLeft = settings.spellLayout.D < settings.spellLayout.F

	return (
		<div
			style={{
				height: "100%",
				overflowY: "auto",
				display: "flex",
				flexDirection: "column",
				gap: 22,
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
				<h1 className="t-h2" style={{ margin: 0 }}>
					Settings
				</h1>
				<span style={{ font: "400 12px/1 var(--font-mono)", color: "var(--fg-4)" }}>
					Preferences · ban list
				</span>
			</div>

			<Group label="Match">
				<Row
					title="Auto-accept ready check"
					desc="Automatically accept the queue pop. Off by default — you stay in control."
					control={<Toggle checked={settings.autoAccept} onChange={(v) => set("autoAccept", v)} />}
				/>
				<Row
					last
					title="Auto-accept delay"
					desc={
						settings.autoAccept
							? "Wait this long before accepting, so you can cancel."
							: "Enable auto-accept to set a delay."
					}
					control={
						<Segmented
							value={settings.autoAcceptDelay}
							onChange={(v) => set("autoAcceptDelay", v)}
							options={[
								{ value: 0, label: "Instant" },
								{ value: 2, label: "2s" },
								{ value: 4, label: "4s" },
							]}
						/>
					}
				/>
			</Group>

			<Group label="Champ select">
				<Row
					title="Summoner-spell keys"
					desc="Which key holds your left spell. Shown beside your champion in champ select."
					control={
						<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
							<div style={{ display: "flex", gap: 4 }}>
								<SpellIcon spell="Flash" size={28} keyHint={dLeft ? "D" : "F"} />
								<SpellIcon spell="Teleport" size={28} keyHint={dLeft ? "F" : "D"} />
							</div>
							<Segmented
								value={dLeft ? "d" : "f"}
								onChange={(v) => set("spellLayout", v === "d" ? { D: 0, F: 1 } : { D: 1, F: 0 })}
								options={[
									{ value: "d", label: "D left" },
									{ value: "f", label: "F left" },
								]}
							/>
						</div>
					}
				/>
				<Row
					last
					title="Rank-mismatch sensitivity"
					desc="How wide a rank spread must be before the team card flags it."
					control={
						<Segmented
							value={settings.mismatchThreshold}
							onChange={(v) => set("mismatchThreshold", v)}
							options={[
								{ value: 12, label: "Relaxed" },
								{ value: 8, label: "Balanced" },
								{ value: 5, label: "Strict" },
							]}
						/>
					}
				/>
			</Group>

			<BanEditor banlist={banlist} setBanlist={setBanlist} />
			<div style={{ height: 4 }} />
		</div>
	)
}

window.Settings = Settings
