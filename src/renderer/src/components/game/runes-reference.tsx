import { runeIconUrl } from "@renderer/lib/ddragon-urls"
import { cn } from "@renderer/lib/utils"
import { useState } from "react"

import type { DDragonBundle, RunePageRec } from "@/shared/types"

interface RunesReferenceProps {
	runes: RunePageRec
	bundle: DDragonBundle
}

export function RunesReference({ runes, bundle }: RunesReferenceProps): React.JSX.Element {
	// selectedPerkIds = [keystone, p1, p2, p3, s1, s2, shard1, shard2, shard3]
	const keystone = runes.selectedPerkIds[0]
	const rest = runes.selectedPerkIds.slice(1)
	return (
		<div className="flex flex-col gap-[10px]">
			<div className="flex items-center gap-[10px]">
				<RuneIcon perkId={keystone} bundle={bundle} size={34} />
				<div className="flex min-w-0 flex-col gap-[3px]">
					<span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] font-semibold leading-none text-paper-100">
						{runes.primaryName}
					</span>
					<span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] leading-none text-paper-400">
						{runes.secondaryName}
					</span>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-[5px]">
				{rest.map((id, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: positional perk slots, order is fixed
					<RuneIcon key={`${id}-${i}`} perkId={id} bundle={bundle} size={20} />
				))}
			</div>
		</div>
	)
}

function RuneIcon({
	perkId,
	bundle,
	size,
}: {
	perkId: number
	bundle: DDragonBundle
	size: number
}): React.JSX.Element | null {
	const [err, setErr] = useState(false)
	const rune = bundle.runesById[perkId] ?? null
	// stat shards (5000+) and unknown perks have no catalog icon → render a neutral dot
	if (!rune || err) {
		return (
			<span
				className="grid shrink-0 place-items-center rounded-full bg-ink-800 font-mono text-[7px] font-semibold leading-none text-paper-400"
				style={{ width: size, height: size }}
			>
				·
			</span>
		)
	}
	return (
		<img
			src={runeIconUrl(rune.icon)}
			alt={rune.name}
			title={rune.name}
			onError={() => setErr(true)}
			className={cn("shrink-0 rounded-full bg-ink-900 object-contain")}
			style={{ width: size, height: size }}
		/>
	)
}
