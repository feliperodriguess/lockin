import { Row } from "@renderer/components/settings/settings-rows"
import type { SelectOption } from "@renderer/components/ui/select"
import { Select } from "@renderer/components/ui/select"
import { useSetSettings, useSettings } from "@renderer/hooks/use-data"

import type { RankedPosition } from "@/shared/types"

/** The five assignable roles, in lane order. */
const ROLES: { value: RankedPosition; label: string }[] = [
	{ value: "TOP", label: "Top" },
	{ value: "JUNGLE", label: "Jungle" },
	{ value: "MIDDLE", label: "Mid" },
	{ value: "BOTTOM", label: "Bot" },
	{ value: "UTILITY", label: "Support" },
]

/** First-preference choices: Fill (auto) + the five roles. */
export const FIRST_OPTIONS: SelectOption<RankedPosition>[] = [
	{ value: "FILL", label: "Fill" },
	...ROLES,
]

/** Second-preference choices for a given first: None, then every role except first. */
export function secondOptions(first: RankedPosition): SelectOption<RankedPosition>[] {
	return [{ value: "UNSELECTED", label: "None" }, ...ROLES.filter((r) => r.value !== first)]
}

/** Keep a (first, second) pair legal: Fill or a duplicate collapses second to None. */
export function clampSecond(first: RankedPosition, second: RankedPosition): RankedPosition {
	return first === "FILL" || second === first ? "UNSELECTED" : second
}

export function RankedPositions(): React.JSX.Element | null {
	const { data: settings } = useSettings()
	const setSettings = useSetSettings()
	if (!settings) return null

	const { first, second } = settings.rankedPositions
	const fillSelected = first === "FILL"

	const setFirst = (next: RankedPosition): void => {
		setSettings.mutate({
			rankedPositions: { first: next, second: clampSecond(next, second) },
		})
	}
	const setSecond = (next: RankedPosition): void => {
		setSettings.mutate({ rankedPositions: { first, second: clampSecond(first, next) } })
	}

	return (
		<Row
			last
			title="Position preferences"
			desc="Roles requested when you start a ranked or flex queue from the tray."
			control={
				<div className="flex items-center gap-2">
					<Select value={first} options={FIRST_OPTIONS} onChange={setFirst} />
					<Select
						value={fillSelected ? "UNSELECTED" : second}
						options={secondOptions(first)}
						onChange={setSecond}
						disabled={fillSelected}
					/>
				</div>
			}
		/>
	)
}
