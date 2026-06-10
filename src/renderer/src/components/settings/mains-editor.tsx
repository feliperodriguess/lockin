import { Card } from "@renderer/components/app/card"
import { ChampionPicker } from "@renderer/components/app/champion-picker"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { Segmented } from "@renderer/components/app/segmented"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { RoleTag } from "@renderer/components/game/role"
import { useDDragon, useSetSettings, useSettings } from "@renderer/hooks/use-data"
import { groupMainsByRole, MAIN_ROLE_ORDER } from "@renderer/lib/mains"
import { roleToDisplay } from "@renderer/lib/roles"
import { cn } from "@renderer/lib/utils"
import { Trash2 } from "lucide-react"
import { useState } from "react"

import type { Role } from "@/shared/types"

export function MainsEditor(): React.JSX.Element | null {
	const { data: bundle } = useDDragon()
	const { data: settings } = useSettings()
	const setSettings = useSetSettings()
	const [role, setRole] = useState<Role>("top")

	if (!bundle || !settings) return null

	const mains = settings.mains
	const groups = groupMainsByRole(mains)

	const add = (championId: number | null) => {
		if (championId == null) return
		if (mains.some((m) => m.championId === championId && m.role === role)) return
		setSettings.mutate({ mains: [...mains, { championId, role }] })
	}

	const remove = (championId: number, r: Role) => {
		setSettings.mutate({
			mains: mains.filter((m) => !(m.championId === championId && m.role === r)),
		})
	}

	const excludeIds = mains.filter((m) => m.role === role).map((m) => m.championId)

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<Eyebrow line={22}>Your mains</Eyebrow>
				<span className="font-mono text-[11px] leading-none text-paper-400">
					{mains.length} champions
				</span>
			</div>

			<Card className="flex flex-col gap-3 p-3">
				{mains.length === 0 && (
					<p className="m-0 px-6 py-5 text-center text-[13px] leading-normal text-paper-400">
						No mains yet. Add the champions you play, tagged by role.
					</p>
				)}

				{groups.map((g) =>
					g.championIds.length === 0 ? null : (
						<div key={g.role} className="flex flex-col gap-2">
							<RoleTag role={roleToDisplay(g.role)} />
							<ul className="m-0 flex flex-wrap gap-2 p-0">
								{g.championIds.map((id) => {
									const champ = bundle.championsByKey[id] ?? null
									return (
										<li
											key={id}
											className="flex items-center gap-2 rounded-sm border border-(--stroke-subtle) bg-ink-950 py-1 pl-1 pr-2"
										>
											<ChampionPortrait champion={champ} version={bundle.version} size={26} />
											<span className="text-[12.5px] font-medium leading-none text-paper-100">
												{champ?.name ?? "Unknown"}
											</span>
											<button
												type="button"
												onClick={() => remove(id, g.role)}
												title="Remove"
												className={cn(
													"flex cursor-pointer border-none bg-transparent p-[2px] text-paper-400",
													"transition-colors duration-(--dur-base) ease-(--ease-standard) hover:text-fail",
												)}
											>
												<Trash2 size={14} />
											</button>
										</li>
									)
								})}
							</ul>
						</div>
					),
				)}

				{/* add row: role seg + champion picker */}
				<div className="flex flex-col gap-2 border-t border-(--stroke-subtle) pt-3">
					<Segmented
						value={role}
						onChange={(v) => setRole(v as Role)}
						options={MAIN_ROLE_ORDER.map((r) => ({ value: r, label: roleToDisplay(r) }))}
					/>
					<div className="max-w-[280px]">
						<ChampionPicker
							value={null}
							onChange={add}
							bundle={bundle}
							version={bundle.version}
							placeholder={`Add a ${roleToDisplay(role)} main`}
							size="sm"
							excludeIds={excludeIds}
						/>
					</div>
				</div>
			</Card>
		</div>
	)
}
