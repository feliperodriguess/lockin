import { spellIconUrl } from "@renderer/lib/ddragon-urls"
import { useState } from "react"

import type { SummonerSpellStatic } from "@/shared/types"

interface SpellIconProps {
	spell: SummonerSpellStatic | null
	version: string
	size?: number
	keyHint?: "D" | "F"
}

export function SpellIcon({
	spell,
	version,
	size = 28,
	keyHint,
}: SpellIconProps): React.JSX.Element | null {
	const [errKey, setErrKey] = useState<number | null>(null)
	// derived, not synced: a failed load only suppresses THIS spell's icon
	const err = spell != null && errKey === spell.key

	if (!spell) return null

	return (
		<div
			title={spell.name}
			className="relative overflow-hidden shrink-0 bg-ink-800 border border-(--stroke-default) rounded-xs"
			// dynamic: width/height derived from size prop
			style={{ width: size, height: size }}
		>
			{!err ? (
				<img
					src={spellIconUrl(version, spell.imageFull)}
					alt={spell.name}
					onError={() => setErrKey(spell.key)}
					className="w-full h-full object-cover block"
				/>
			) : (
				<div className="w-full h-full grid place-items-center font-mono text-[9px] font-semibold leading-none text-paper-200">
					{spell.name.slice(0, 4)}
				</div>
			)}
			{keyHint && (
				<span className="absolute -bottom-px -right-px px-[3px] py-px bg-ink-950 rounded-tl-[4px] font-mono text-[8px] font-semibold leading-none text-accent">
					{keyHint}
				</span>
			)}
		</div>
	)
}
