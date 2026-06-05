// settings.jsx:242-335 — Settings page: scrollable column with header, Match group,
// Champ select group, BanEditor, bottom spacer.

import { Segmented } from "@renderer/components/app/segmented"
import { SpellIcon } from "@renderer/components/game/spell-icon"
import { BanEditor } from "@renderer/components/settings/ban-editor"
import { Group, Row } from "@renderer/components/settings/settings-rows"
import { Switch } from "@renderer/components/ui/switch"
import { useDDragon, useSetSettings, useSettings } from "@renderer/hooks/use-data"

export function SettingsPage(): React.JSX.Element | null {
	const { data: settings } = useSettings()
	const { data: bundle } = useDDragon()
	const setSettings = useSetSettings()

	// Loading — data is local, resolves in one tick; render nothing until ready
	if (!settings || !bundle) return null

	const dLeft = settings.spellSlotLayout === "DF"
	const flashSpell = bundle.spellsByKey[4] ?? null // SummonerFlash key=4
	const teleportSpell = bundle.spellsByKey[12] ?? null // SummonerTeleport key=12

	return (
		<div className="flex h-full flex-col gap-[22px] overflow-y-auto px-6 py-5">
			{/* Header */}
			<div className="flex flex-col gap-1">
				<h1 className="m-0 text-[24px] font-semibold leading-[1.2] text-[var(--fg-1)]">Settings</h1>
				<span className="font-mono text-[12px] font-normal leading-none text-[var(--fg-4)]">
					Preferences · ban list
				</span>
			</div>

			{/* Match group */}
			<Group label="Match">
				<Row
					title="Auto-accept ready check"
					desc="Automatically accept the queue pop. Off by default — you stay in control."
					control={
						<Switch
							checked={settings.autoAccept}
							onCheckedChange={(v) => setSettings.mutate({ autoAccept: v })}
						/>
					}
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
							value={settings.autoAcceptDelayMs}
							onChange={(v) => setSettings.mutate({ autoAcceptDelayMs: v })}
							options={[
								{ value: 0, label: "Instant" },
								{ value: 2000, label: "2s" },
								{ value: 4000, label: "4s" },
							]}
						/>
					}
				/>
			</Group>

			{/* Champ select group */}
			<Group label="Champ select">
				<Row
					title="Summoner-spell keys"
					desc="Which key holds your left spell. Shown beside your champion in champ select."
					control={
						<div className="flex items-center gap-3">
							<div className="flex gap-1">
								<SpellIcon
									spell={flashSpell}
									version={bundle.version}
									size={28}
									keyHint={dLeft ? "D" : "F"}
								/>
								<SpellIcon
									spell={teleportSpell}
									version={bundle.version}
									size={28}
									keyHint={dLeft ? "F" : "D"}
								/>
							</div>
							<Segmented
								value={settings.spellSlotLayout}
								onChange={(v) => setSettings.mutate({ spellSlotLayout: v as "DF" | "FD" })}
								options={[
									{ value: "DF", label: "D left" },
									{ value: "FD", label: "F left" },
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
							value={settings.rankDiffThreshold}
							onChange={(v) => setSettings.mutate({ rankDiffThreshold: v })}
							options={[
								{ value: 12, label: "Relaxed" },
								{ value: 8, label: "Balanced" },
								{ value: 5, label: "Strict" },
							]}
						/>
					}
				/>
			</Group>

			{/* Ban list editor */}
			<BanEditor />

			{/* Bottom spacer */}
			<div className="h-1" />
		</div>
	)
}
