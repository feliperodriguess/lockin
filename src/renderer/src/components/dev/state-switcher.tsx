import { FORCE_FAKE_KEY } from "@renderer/api"
import { getScenario, setScenario } from "@renderer/api/fake/bridge"
import type { ScenarioState } from "@renderer/api/fake/scenario"
import { Switch } from "@renderer/components/ui/switch"
import { useSetSettings, useSettings } from "@renderer/hooks/use-data"
import { cn } from "@renderer/lib/utils"
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
		<div className="inline-flex gap-[2px] rounded-sm border border-[var(--stroke-default)] bg-[rgba(0,0,0,0.35)] p-[2px]">
			{options.map((o) => {
				const on = value === o.value
				return (
					<button
						key={String(o.value)}
						type="button"
						onClick={() => onChange(o.value)}
						className={cn(
							"cursor-pointer whitespace-nowrap rounded-[4px] border-none px-[10px] py-[5px]",
							"text-[11px] font-semibold leading-none",
							"transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
							on
								? accentActive
									? "bg-accent text-[var(--color-accent-fg)]"
									: "bg-ink-700 text-paper-100"
								: "bg-transparent text-paper-300",
						)}
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
		<span className="mr-[2px] font-mono text-[9px] font-semibold leading-none tracking-[0.1em] uppercase text-paper-400">
			{children}
		</span>
	)
}

/* shared label style for switch rows */
const LABEL_CLASS =
	"inline-flex cursor-pointer items-center gap-2 text-[11px] font-medium leading-none text-paper-200"

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
				className={cn(
					"absolute bottom-3 right-3 z-50",
					"inline-flex cursor-pointer items-center gap-[6px]",
					"rounded-full border border-[var(--stroke-default)] px-3 py-[6px]",
					"bg-[rgba(14,16,18,0.9)] text-accent shadow-[0_4px_12px_rgba(0,0,0,0.5)]",
					"text-[11px] font-semibold leading-none",
				)}
			>
				<Play size={10} />
				Dev
			</button>
		)
	}

	return (
		<div
			className={cn(
				"absolute bottom-3 z-50",
				"flex min-h-[54px] flex-wrap items-center gap-[18px]",
				"rounded-[12px] border border-[var(--stroke-default)] px-4 py-2",
				"bg-[rgba(14,16,18,0.9)] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]",
			)}
			// dynamic: translateX(-50%) horizontal centering from left:50% requires runtime transform
			style={{ left: "50%", transform: "translateX(-50%)" }}
		>
			{/* label block */}
			<div className="flex flex-col gap-[3px] border-r border-[var(--stroke-default)] pr-4">
				<span className="inline-flex items-center gap-[6px] font-mono text-[9px] font-semibold leading-none tracking-[0.14em] uppercase text-accent">
					<Play size={10} />
					Prototype
				</span>
				<span className="text-[10px] leading-none text-paper-400">Drive the client state</span>
			</div>

			{/* Client phase seg */}
			<div className="flex items-center gap-2">
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
			<div className="flex-1" />

			{/* Ready Check controls */}
			{snapshot.phase === "ready" && (
				<div className="flex items-center gap-[14px]">
					{/* switch restyled in Task 9 */}
					<Switch
						id="dev-auto-accept"
						checked={settingsQuery.data?.autoAccept ?? false}
						onCheckedChange={(checked) => setSettingsMutation.mutate({ autoAccept: checked })}
					/>
					<label htmlFor="dev-auto-accept" className={LABEL_CLASS}>
						Auto-accept
					</label>
					{/* switch restyled in Task 9 */}
					<Switch
						id="dev-show-fired"
						checked={snapshot.autoAcceptFired}
						onCheckedChange={(checked) => drive({ autoAcceptFired: checked })}
					/>
					<label htmlFor="dev-show-fired" className={LABEL_CLASS}>
						Show fired
					</label>
				</div>
			)}

			{/* Champ Select controls */}
			{snapshot.phase === "select" && (
				<div className="flex flex-wrap items-center justify-end gap-3">
					<div className="flex items-center gap-[7px]">
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
					<div className="flex items-center gap-[7px]">
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
					<div className="flex items-center gap-[7px]">
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
					<div className="flex items-center gap-[7px]">
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
					<div className="flex items-center gap-[7px]">
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
				<p className="m-0 max-w-[320px] text-right text-[11px] leading-[1.4] text-paper-400">
					{snapshot.phase === "disconnected"
						? "Client closed — calm waiting state. Notes & Settings stay usable."
						: "Connected, between games. Sharpen notes or queue up."}
				</p>
			)}

			{/* Force fake API toggle */}
			<div className="flex items-center gap-[7px] border-l border-[var(--stroke-default)] pl-4">
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
				className={cn(
					"inline-flex cursor-pointer items-center justify-center rounded-[4px]",
					"border-none bg-transparent p-1 text-paper-400",
					"transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]",
				)}
				aria-label="Collapse dev bar"
			>
				<X size={14} />
			</button>
		</div>
	)
}
