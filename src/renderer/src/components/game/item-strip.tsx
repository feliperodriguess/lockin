import { ItemIcon } from "@renderer/components/game/item-icon"
import { formatWinRate } from "@renderer/lib/build-format"
import { cn } from "@renderer/lib/utils"
import { ArrowRight } from "lucide-react"

import type { BuildRecommendation, DDragonBundle, ItemOption } from "@/shared/types"

const MAX_SLOT_OPTIONS = 4

function PhaseCaption({
	caption,
	winRate,
}: {
	caption: string
	winRate?: number
}): React.JSX.Element {
	return (
		<span className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-paper-400">
			{caption}
			{winRate != null && (
				<span className="ml-[6px] text-paper-300">{formatWinRate(winRate)} WR</span>
			)}
		</span>
	)
}

interface ItemPhaseProps {
	caption: string
	group: BuildRecommendation["items"]["starter"]
	bundle: DDragonBundle
	version: string
	/** join the icons with → arrows (build order); otherwise wrap as a pool */
	ordered?: boolean
	size?: number
	className?: string
}

function ItemPhase({
	caption,
	group,
	bundle,
	version,
	ordered,
	size = 30,
	className,
}: ItemPhaseProps): React.JSX.Element | null {
	if (group.ids.length === 0) return null
	return (
		<div className={cn("flex flex-col gap-[6px]", className)}>
			<PhaseCaption caption={caption} winRate={group.winRate} />
			<div className={cn("flex items-center gap-[5px]", !ordered && "flex-wrap")}>
				{group.ids.map((id, i) => (
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

function SlotColumn({
	caption,
	options,
	bundle,
	version,
	size = 30,
}: {
	caption: string
	options: ItemOption[]
	bundle: DDragonBundle
	version: string
	size?: number
}): React.JSX.Element | null {
	if (options.length === 0) return null
	return (
		<div className="flex flex-col gap-[6px]">
			<PhaseCaption caption={caption} />
			<ul className="m-0 flex items-start gap-[7px] p-0">
				{options.slice(0, MAX_SLOT_OPTIONS).map((option) => (
					<li key={option.id} className="flex flex-col items-center gap-[4px]">
						<ItemIcon itemId={option.id} bundle={bundle} version={version} size={size} />
						<span className="font-mono text-[8px] font-medium leading-none text-paper-400">
							{option.winRate != null ? formatWinRate(option.winRate) : "—"}
						</span>
					</li>
				))}
			</ul>
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
	const hasSlots = [items.fourth, items.fifth, items.sixth].some((s) => s.length > 0)
	return (
		<div className="flex flex-col gap-[14px]">
			<div className="flex flex-wrap items-start gap-x-6 gap-y-3">
				<ItemPhase
					caption="Starting"
					group={items.starter}
					bundle={bundle}
					version={version}
					size={size}
				/>
				<ItemPhase
					caption="Boots"
					group={items.boots}
					bundle={bundle}
					version={version}
					size={size}
				/>
				<ItemPhase
					caption="Core build"
					group={items.core}
					bundle={bundle}
					version={version}
					ordered
					size={size}
				/>
			</div>
			{hasSlots && (
				<div className="flex flex-wrap items-start gap-x-6 gap-y-3 border-t border-(--stroke-subtle) pt-3">
					<SlotColumn
						caption="4th item"
						options={items.fourth}
						bundle={bundle}
						version={version}
						size={size}
					/>
					<SlotColumn
						caption="5th item"
						options={items.fifth}
						bundle={bundle}
						version={version}
						size={size}
					/>
					<SlotColumn
						caption="6th item"
						options={items.sixth}
						bundle={bundle}
						version={version}
						size={size}
					/>
				</div>
			)}
		</div>
	)
}
