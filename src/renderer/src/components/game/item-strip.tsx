import { ItemIcon } from "@renderer/components/game/item-icon"
import { cn } from "@renderer/lib/utils"
import { ArrowRight } from "lucide-react"

import type { BuildRecommendation, DDragonBundle } from "@/shared/types"

interface ItemPhaseProps {
	caption: string
	ids: number[]
	bundle: DDragonBundle
	version: string
	/** join the icons with → arrows (build order); otherwise wrap as a pool */
	ordered?: boolean
	size?: number
	className?: string
}

function ItemPhase({
	caption,
	ids,
	bundle,
	version,
	ordered,
	size = 30,
	className,
}: ItemPhaseProps): React.JSX.Element | null {
	if (ids.length === 0) return null
	return (
		<div className={cn("flex flex-col gap-[6px]", className)}>
			<span className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-paper-400">
				{caption}
			</span>
			<div className={cn("flex items-center gap-[5px]", !ordered && "flex-wrap")}>
				{ids.map((id, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: item ids may repeat in a pool
					<div key={`${id}-${i}`} className="flex items-center gap-[5px]">
						{ordered && i > 0 && <ArrowRight size={12} className="shrink-0 text-paper-400" />}
						<ItemIcon itemId={id} bundle={bundle} version={version} size={size} />
					</div>
				))}
			</div>
		</div>
	)
}

interface ItemStripProps {
	items: BuildRecommendation["items"]
	bundle: DDragonBundle
	version: string
	size?: number
}

export function ItemStrip({
	items,
	bundle,
	version,
	size = 30,
}: ItemStripProps): React.JSX.Element {
	return (
		<div className="flex flex-wrap items-start gap-x-5 gap-y-3">
			<ItemPhase
				caption="Starting"
				ids={items.starter.ids}
				bundle={bundle}
				version={version}
				size={size}
			/>
			<ItemPhase
				caption="Boots"
				ids={items.boots.ids}
				bundle={bundle}
				version={version}
				size={size}
			/>
			<ItemPhase
				caption="Core build"
				ids={items.core.ids}
				bundle={bundle}
				version={version}
				ordered
				size={size}
			/>
			<ItemPhase
				caption="Situational"
				ids={items.situational.ids}
				bundle={bundle}
				version={version}
				size={size}
			/>
		</div>
	)
}
