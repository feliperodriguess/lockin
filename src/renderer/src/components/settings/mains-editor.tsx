import { Card } from "@renderer/components/app/card"
import { ChampionPicker } from "@renderer/components/app/champion-picker"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { RoleGlyph } from "@renderer/components/game/role"
import { useDDragon, useSetSettings, useSettings } from "@renderer/hooks/use-data"
import { MAIN_ROLE_ORDER } from "@renderer/lib/mains"
import { ROLE_ABBR, roleToDisplay } from "@renderer/lib/roles"
import { cn } from "@renderer/lib/utils"
import { Plus, X } from "lucide-react"
import { useState } from "react"

import type { DDragonBundle, Role } from "@/shared/types"

function MainChip({
	championId,
	role,
	bundle,
	onRemove,
}: {
	championId: number
	role: Role
	bundle: DDragonBundle
	onRemove: (championId: number, role: Role) => void
}): React.JSX.Element {
	const champ = bundle.championsByKey[championId] ?? null
	return (
		<li className="group flex items-center gap-2 rounded-sm border border-(--stroke-subtle) bg-ink-950 py-1 pl-1 pr-2">
			<ChampionPortrait champion={champ} version={bundle.version} size={26} />
			<span className="text-[12.5px] font-medium leading-none text-paper-100">
				{champ?.name ?? "Unknown"}
			</span>
			<button
				type="button"
				onClick={() => onRemove(championId, role)}
				title={`Remove ${champ?.name ?? "champion"}`}
				className={cn(
					"flex cursor-pointer border-none bg-transparent p-[2px] text-paper-400",
					"opacity-0 transition-opacity duration-(--dur-base) ease-(--ease-standard)",
					"group-hover:opacity-100 focus-visible:opacity-100 hover:text-fail",
				)}
			>
				<X size={13} />
			</button>
		</li>
	)
}

export function MainsEditor(): React.JSX.Element | null {
	const { data: bundle } = useDDragon()
	const { data: settings } = useSettings()
	const setSettings = useSetSettings()
	const [addingRole, setAddingRole] = useState<Role | null>(null)

	if (!bundle || !settings) return null

	const mains = settings.mains

	const add = (role: Role, championId: number | null) => {
		if (championId == null) return
		if (mains.some((m) => m.championId === championId && m.role === role)) return
		setSettings.mutate({ mains: [...mains, { championId, role }] })
	}

	const remove = (championId: number, role: Role) => {
		setSettings.mutate({
			mains: mains.filter((m) => !(m.championId === championId && m.role === role)),
		})
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<Eyebrow line={22}>Your mains</Eyebrow>
				{mains.length > 0 && (
					<span className="font-mono text-[11px] leading-none text-paper-400">
						{mains.length} {mains.length === 1 ? "champion" : "champions"}
					</span>
				)}
			</div>

			<Card className="flex flex-col divide-y divide-(--stroke-subtle) p-0">
				{MAIN_ROLE_ORDER.map((role) => {
					const ids = mains.filter((m) => m.role === role).map((m) => m.championId)
					const display = roleToDisplay(role)
					return (
						<section
							key={role}
							className="grid grid-cols-[56px_1fr] items-start gap-3 px-3 py-[10px]"
						>
							<h3 className="m-0 flex h-9 items-center gap-[6px] font-mono text-[10px] font-semibold leading-none tracking-[0.08em] text-paper-400">
								<RoleGlyph role={display} size={13} />
								{ROLE_ABBR[display]}
							</h3>
							<ul className="m-0 flex flex-wrap items-center gap-2 p-0">
								{ids.map((id) => (
									<MainChip
										key={id}
										championId={id}
										role={role}
										bundle={bundle}
										onRemove={remove}
									/>
								))}
								<li className="list-none">
									{addingRole === role ? (
										<div className="w-[230px]">
											<ChampionPicker
												value={null}
												onChange={(id) => add(role, id)}
												bundle={bundle}
												version={bundle.version}
												placeholder={`Add a ${display} main`}
												size="sm"
												excludeIds={ids}
												defaultOpen
												onOpenChange={(open) => {
													if (!open) setAddingRole(null)
												}}
											/>
										</div>
									) : (
										<button
											type="button"
											onClick={() => setAddingRole(role)}
											className={cn(
												"flex h-9 cursor-pointer items-center gap-[6px] rounded-sm border border-dashed border-(--stroke-default) bg-transparent px-3",
												"text-[12px] font-medium leading-none text-paper-400",
												"transition-colors duration-(--dur-base) ease-(--ease-standard)",
												"hover:border-(--stroke-strong) hover:text-paper-200",
											)}
										>
											<Plus size={13} />
											{ids.length === 0 ? `Add a ${display} main` : "Add"}
										</button>
									)}
								</li>
							</ul>
						</section>
					)
				})}
			</Card>
		</div>
	)
}
