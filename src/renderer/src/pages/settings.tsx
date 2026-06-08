import { Segmented } from "@renderer/components/app/segmented"
import { SpellIcon } from "@renderer/components/game/spell-icon"
import { BanEditor } from "@renderer/components/settings/ban-editor"
import { Group, Row } from "@renderer/components/settings/settings-rows"
import { Switch } from "@renderer/components/ui/switch"
import { useDDragon, useSetSettings, useSettings } from "@renderer/hooks/use-data"

import { SPELL } from "../lib/spells"

export function SettingsPage(): React.JSX.Element | null {
	const { data: settings } = useSettings()
	const { data: bundle } = useDDragon()
	const setSettings = useSetSettings()

	if (!settings || !bundle) return null

	const dLeft = settings.spellSlotLayout === "DF"
	const flashSpell = bundle.spellsByKey[SPELL.FLASH] ?? null
	const teleportSpell = bundle.spellsByKey[SPELL.TELEPORT] ?? null

	return (
		<div className="-mr-6 flex h-full flex-col gap-[22px] overflow-y-auto pr-6">
			<header className="flex flex-col gap-1">
				<h1 className="m-0 text-[24px] font-semibold leading-[1.2] text-(--fg-1)">Settings</h1>
				<span className="font-mono text-[12px] font-normal leading-none text-(--fg-4)">
					Preferences
				</span>
			</header>

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

			<BanEditor />

			<div className="h-1" />
		</div>
	)
}
