import { Section } from "@renderer/components/champ-select/section"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { RoleGlyph } from "@renderer/components/game/role"
import { useDDragon, useSettings } from "@renderer/hooks/use-data"
import { groupMainsByRole } from "@renderer/lib/mains"
import { ROLE_ABBR, roleToDisplay } from "@renderer/lib/roles"
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
		<Section
			label="Your mains"
			grow={grow}
			scroll={grow}
			right={
				mains.length > 0 ? (
					<button
						type="button"
						onClick={() => navigate({ to: "/settings" })}
						title="Edit your mains in Settings"
						className="flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 font-mono text-[10px] font-semibold leading-none tracking-[0.08em] text-paper-400 transition-colors duration-(--dur-base) ease-(--ease-standard) hover:text-paper-200"
					>
						<SettingsIcon size={11} />
						EDIT
					</button>
				) : undefined
			}
		>
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
				<ul className="m-0 flex flex-wrap items-center gap-x-7 gap-y-2 p-0">
					{groups.map((g) => {
						const display = roleToDisplay(g.role)
						return (
							<li key={g.role} className="flex items-center gap-[10px]">
								<span className="flex items-center gap-[5px] font-mono text-[10px] font-semibold leading-none tracking-[0.08em] text-paper-400">
									<RoleGlyph role={display} size={12} />
									{ROLE_ABBR[display]}
								</span>
								<ul className="m-0 flex items-center gap-[6px] p-0">
									{g.championIds.map((id) => {
										const champ = bundle.championsByKey[id] ?? null
										return (
											<li key={id} className="flex" title={champ?.name}>
												<ChampionPortrait champion={champ} version={bundle.version} size={30} />
											</li>
										)
									})}
								</ul>
							</li>
						)
					})}
				</ul>
			)}
		</Section>
	)
}
