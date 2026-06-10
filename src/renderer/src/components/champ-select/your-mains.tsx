import { Section } from "@renderer/components/champ-select/section"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { RoleTag } from "@renderer/components/game/role"
import { useDDragon, useSettings } from "@renderer/hooks/use-data"
import { groupMainsByRole } from "@renderer/lib/mains"
import { roleToDisplay } from "@renderer/lib/roles"
import { useNavigate } from "@tanstack/react-router"
import { Settings as SettingsIcon } from "lucide-react"

interface YourMainsProps {
	grow?: boolean
}

export function YourMains({ grow }: YourMainsProps): React.JSX.Element | null {
	const { data: bundle } = useDDragon()
	const { data: settings } = useSettings()
	const navigate = useNavigate()

	if (!bundle || !settings) return null

	const mains = settings.mains
	const groups = groupMainsByRole(mains).filter((g) => g.championIds.length > 0)

	return (
		<Section label="Your mains" grow={grow} scroll={grow}>
			{mains.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-[10px] px-3 py-2 text-center">
					<p className="m-0 text-[13px] leading-[1.4] text-paper-300">
						Add the champions you play to see them here.
					</p>
					<button
						type="button"
						onClick={() => navigate({ to: "/settings" })}
						className="inline-flex cursor-pointer items-center gap-[6px] border-none bg-transparent text-[12px] font-medium leading-none text-accent"
					>
						<SettingsIcon size={13} />
						Set up your mains
					</button>
				</div>
			) : (
				<div className="flex flex-col gap-[10px]">
					{groups.map((g) => (
						<div key={g.role} className="flex flex-col gap-[6px]">
							<RoleTag role={roleToDisplay(g.role)} />
							<ul className="m-0 flex flex-wrap gap-[6px] p-0">
								{g.championIds.map((id) => {
									const champ = bundle.championsByKey[id] ?? null
									return (
										<li key={id} title={champ?.name}>
											<ChampionPortrait champion={champ} version={bundle.version} size={28} />
										</li>
									)
								})}
							</ul>
						</div>
					))}
				</div>
			)}
		</Section>
	)
}
