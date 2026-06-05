import { FORCE_FAKE_KEY } from "@renderer/api"
import { getScenario, setScenario } from "@renderer/api/fake/bridge"
import type { ScenarioState } from "@renderer/api/fake/scenario"
import { Switch } from "@renderer/components/ui/switch"
import { useSetSettings, useSettings } from "@renderer/hooks/use-data"
import { useQueryClient } from "@tanstack/react-query"
import { Play, X } from "lucide-react"
import { useState } from "react"

/* ---------------------------------------------------------------- sub-components */

interface SegOption<T> {
	value: T
	label: string
}

function Seg<T extends string | null>({
	value,
	options,
	onChange,
	accentActive,
}: {
	value: T
	options: SegOption<T>[]
	onChange: (v: T) => void
	accentActive?: boolean
}) {
	return (
		<div
			style={{
				display: "inline-flex",
				padding: 2,
				gap: 2,
				background: "rgba(0,0,0,0.35)",
				border: "1px solid var(--stroke-default)",
				borderRadius: "var(--radius-sm)",
			}}
		>
			{options.map((o) => {
				const on = value === o.value
				return (
					<button
						key={String(o.value)}
						type="button"
						onClick={() => onChange(o.value)}
						style={{
							padding: "5px 10px",
							borderRadius: 4,
							border: "none",
							cursor: "pointer",
							whiteSpace: "nowrap",
							background: on
								? accentActive
									? "var(--color-accent)"
									: "var(--color-ink-700)"
								: "transparent",
							color: on ? (accentActive ? "var(--color-accent-fg)" : "var(--fg-1)") : "var(--fg-3)",
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

function DemoLabel({ children }: { children: React.ReactNode }) {
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

/* shared inline-label style for switch rows */
const LABEL_STYLE: React.CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: 8,
	font: "500 11px/1 var(--font-ui)",
	color: "var(--fg-2)",
	cursor: "pointer",
}

/* ---------------------------------------------------------------- main component */

export default function StateSwitcher(): React.JSX.Element {
	const [expanded, setExpanded] = useState(true)
	const [snapshot, setSnapshot] = useState<ScenarioState>(() => getScenario())

	const qc = useQueryClient()
	const setSettingsMutation = useSetSettings()
	const settingsQuery = useSettings()

	function drive(next: Partial<ScenarioState>) {
		setScenario(next)
		setSnapshot(getScenario())
		qc.invalidateQueries({ queryKey: ["notes"] })
		qc.invalidateQueries({ queryKey: ["ranks"] })
	}

	const forceFake = localStorage.getItem(FORCE_FAKE_KEY) === "1"

	/* collapsed: small pill bottom-right */
	if (!expanded) {
		return (
			<button
				type="button"
				onClick={() => setExpanded(true)}
				style={{
					position: "absolute",
					bottom: 12,
					right: 12,
					zIndex: 50,
					display: "inline-flex",
					alignItems: "center",
					gap: 6,
					padding: "6px 12px",
					borderRadius: 999,
					background: "rgba(14,16,18,0.9)",
					border: "1px solid var(--stroke-default)",
					color: "var(--color-accent)",
					font: "600 11px/1 var(--font-ui)",
					cursor: "pointer",
					boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
				}}
			>
				<Play size={10} />
				Dev
			</button>
		)
	}

	return (
		<div
			style={{
				position: "absolute",
				bottom: 12,
				left: "50%",
				transform: "translateX(-50%)",
				zIndex: 50,
				minHeight: 54,
				display: "flex",
				alignItems: "center",
				gap: 18,
				padding: "8px 16px",
				borderRadius: 12,
				flexWrap: "wrap",
				background: "rgba(14,16,18,0.9)",
				border: "1px solid var(--stroke-default)",
				boxShadow: "0 10px 30px -12px rgba(0,0,0,0.6)",
			}}
		>
			{/* label block */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: 3,
					paddingRight: 16,
					borderRight: "1px solid var(--stroke-default)",
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
						color: "var(--color-accent)",
					}}
				>
					<Play size={10} />
					Prototype
				</span>
				<span style={{ font: "400 10px/1 var(--font-ui)", color: "var(--fg-4)" }}>
					Drive the client state
				</span>
			</div>

			{/* Client phase seg */}
			<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
				<DemoLabel>Client</DemoLabel>
				<Seg
					accentActive
					value={snapshot.phase}
					onChange={(v) => drive({ phase: v })}
					options={[
						{ value: "disconnected", label: "Disconnected" },
						{ value: "idle", label: "Idle" },
						{ value: "ready", label: "Ready Check" },
						{ value: "select", label: "Champ Selection" },
					]}
				/>
			</div>

			{/* Spacer */}
			<div style={{ flex: 1 }} />

			{/* Ready Check controls */}
			{snapshot.phase === "ready" && (
				<div style={{ display: "flex", alignItems: "center", gap: 14 }}>
					{/* switch restyled in Task 9 */}
					<Switch
						id="dev-auto-accept"
						checked={settingsQuery.data?.autoAccept ?? false}
						onCheckedChange={(checked) => setSettingsMutation.mutate({ autoAccept: checked })}
					/>
					<label htmlFor="dev-auto-accept" style={LABEL_STYLE}>
						Auto-accept
					</label>
					{/* switch restyled in Task 9 */}
					<Switch
						id="dev-show-fired"
						checked={snapshot.autoAcceptFired}
						onCheckedChange={(checked) => drive({ autoAcceptFired: checked })}
					/>
					<label htmlFor="dev-show-fired" style={LABEL_STYLE}>
						Show fired
					</label>
				</div>
			)}

			{/* Champ Select controls */}
			{snapshot.phase === "select" && (
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
							value={snapshot.csSubPhase ?? ("live" as const)}
							onChange={(v) =>
								drive({ csSubPhase: v === ("live" as string) ? null : (v as "ban" | "pick") })
							}
							options={[
								{ value: "live" as const, label: "Live" },
								{ value: "ban" as const, label: "Ban" },
								{ value: "pick" as const, label: "Pick" },
							]}
						/>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						<DemoLabel>Enemy</DemoLabel>
						<Seg
							value={
								snapshot.enemyHidden === null ? "auto" : snapshot.enemyHidden ? "hidden" : "shown"
							}
							onChange={(v) => drive({ enemyHidden: v === "auto" ? null : v === "hidden" })}
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
							value={snapshot.ranksAvailable ? "on" : "off"}
							onChange={(v) => drive({ ranksAvailable: v === "on" })}
							options={[
								{ value: "on", label: "OK" },
								{ value: "off", label: "N/A" },
							]}
						/>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						<DemoLabel>Note</DemoLabel>
						<Seg
							value={snapshot.hasNote ? "on" : "off"}
							onChange={(v) => drive({ hasNote: v === "on" })}
							options={[
								{ value: "on", label: "Has" },
								{ value: "off", label: "None" },
							]}
						/>
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 7 }}>
						<DemoLabel>Role</DemoLabel>
						<Seg
							value={snapshot.roleAssigned ? "on" : "off"}
							onChange={(v) => drive({ roleAssigned: v === "on" })}
							options={[
								{ value: "on", label: "Set" },
								{ value: "off", label: "Pending" },
							]}
						/>
					</div>
				</div>
			)}

			{/* Idle/Disconnected hint text */}
			{(snapshot.phase === "disconnected" || snapshot.phase === "idle") && (
				<span
					style={{
						font: "400 11px/1.4 var(--font-ui)",
						color: "var(--fg-4)",
						maxWidth: 320,
						textAlign: "right",
					}}
				>
					{snapshot.phase === "disconnected"
						? "Client closed — calm waiting state. Notes & Settings stay usable."
						: "Connected, between games. Sharpen notes or queue up."}
				</span>
			)}

			{/* Force fake API toggle */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: 7,
					paddingLeft: 16,
					borderLeft: "1px solid var(--stroke-default)",
				}}
			>
				<DemoLabel>Fake api</DemoLabel>
				{/* switch restyled in Task 9 */}
				<Switch
					id="dev-force-fake"
					checked={forceFake}
					onCheckedChange={(checked) => {
						if (checked) {
							localStorage.setItem(FORCE_FAKE_KEY, "1")
						} else {
							localStorage.removeItem(FORCE_FAKE_KEY)
						}
						window.location.reload()
					}}
				/>
			</div>

			{/* Collapse button */}
			<button
				type="button"
				onClick={() => setExpanded(false)}
				style={{
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					padding: 4,
					borderRadius: 4,
					border: "none",
					background: "transparent",
					color: "var(--fg-4)",
					cursor: "pointer",
					transition: "color var(--dur-fast) var(--ease-standard)",
				}}
				aria-label="Collapse dev bar"
			>
				<X size={14} />
			</button>
		</div>
	)
}
