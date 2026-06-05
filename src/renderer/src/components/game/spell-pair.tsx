import type { SummonerSpellStatic } from "@/shared/types"

import { SpellIcon } from "./spell-icon"

interface SpellPairProps {
	pair: [SummonerSpellStatic, SummonerSpellStatic] | null
	version: string
	/** "DF" = pair[0] is D (rendered first), pair[1] is F.
	 *  "FD" = pair[0] is F (rendered first), pair[1] is D. */
	layout: "DF" | "FD"
	size?: number
	showKeys?: boolean
	gap?: number
}

export function SpellPair({
	pair,
	version,
	layout,
	size = 28,
	showKeys,
	gap = 4,
}: SpellPairProps): React.JSX.Element | null {
	if (!pair) return null

	// layout "DF": D holds pair[0], F holds pair[1] → render D then F (pair[0], pair[1])
	// layout "FD": F holds pair[0], D holds pair[1] → render F then D (pair[0], pair[1])
	const [firstKey, secondKey]: ["D" | "F", "D" | "F"] = layout === "DF" ? ["D", "F"] : ["F", "D"]

	return (
		<div
			className="flex"
			// dynamic: gap is prop-driven
			style={{ gap }}
		>
			<SpellIcon
				spell={pair[0]}
				version={version}
				size={size}
				keyHint={showKeys ? firstKey : undefined}
			/>
			<SpellIcon
				spell={pair[1]}
				version={version}
				size={size}
				keyHint={showKeys ? secondKey : undefined}
			/>
		</div>
	)
}
