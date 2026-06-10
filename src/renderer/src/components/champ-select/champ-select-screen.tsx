import { BansRegion } from "@renderer/components/champ-select/bans-region"
import { HeaderStrip } from "@renderer/components/champ-select/header-strip"
import { NotesRegion } from "@renderer/components/champ-select/notes-region"
import { RecommendationPanel } from "@renderer/components/champ-select/recommendation-panel"
import { TeamRegion } from "@renderer/components/champ-select/team-region"
import { YourMains } from "@renderer/components/champ-select/your-mains"
import { useChampSelect } from "@renderer/hooks/use-champ-select"
import { useDDragon, useSettings } from "@renderer/hooks/use-data"

export function ChampSelectScreen(): React.JSX.Element | null {
	const vm = useChampSelect()
	const { data: bundle } = useDDragon()
	const { data: settings } = useSettings()

	if (!vm) return null

	const version = bundle?.version ?? ""
	const layout = settings?.spellSlotLayout ?? "DF"
	const ban = vm.subPhase === "ban"

	return (
		<section className="grid h-full min-h-0 gap-[14px] grid-cols-[1fr_314px] grid-rows-[minmax(0,1fr)]">
			<div className="flex min-h-0 flex-col gap-[14px]">
				<HeaderStrip
					me={vm.me}
					spells={vm.spells}
					layout={layout}
					version={version}
					subPhase={vm.subPhase}
					secondsLeft={vm.secondsLeft}
					phaseTotal={vm.phaseTotal}
					timerVisible={vm.timerVisible}
				/>
				<RecommendationPanel
					championKey={vm.championKey}
					build={vm.build}
					spellPair={vm.spells.pair}
					layout={layout}
					bundle={bundle}
					version={version}
				/>
				<NotesRegion
					note={vm.note}
					enemyHidden={vm.enemyHidden}
					me={vm.me}
					opponent={vm.opponent}
					version={version}
					grow
				/>
				<YourMains />
			</div>

			<div className="flex min-h-0 flex-col gap-[14px]">
				<TeamRegion
					team={vm.team}
					ranksAvailable={vm.ranksAvailable}
					mismatch={vm.mismatch}
					version={version}
					grow={!ban}
				/>
				<BansRegion
					banRows={vm.banRows}
					goneCount={vm.goneCount}
					enemyHidden={vm.enemyHidden}
					subPhase={vm.subPhase}
					version={version}
					grow={ban}
				/>
			</div>
		</section>
	)
}
