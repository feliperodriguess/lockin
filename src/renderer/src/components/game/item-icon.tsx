import { itemIconUrl } from "@renderer/lib/ddragon-urls"
import { cn } from "@renderer/lib/utils"
import { useState } from "react"

import type { DDragonBundle } from "@/shared/types"

interface ItemIconProps {
	itemId: number
	bundle: DDragonBundle
	version: string
	size?: number
	className?: string
}

export function ItemIcon({
	itemId,
	bundle,
	version,
	size = 30,
	className,
}: ItemIconProps): React.JSX.Element {
	const [err, setErr] = useState(false)
	const item = bundle.itemsById[itemId] ?? null
	const name = item?.name ?? `Item ${itemId}`

	return (
		<div
			title={name}
			className={cn(
				"relative shrink-0 overflow-hidden rounded-xs border border-(--stroke-default) bg-ink-800",
				className,
			)}
			style={{ width: size, height: size }}
		>
			{!err ? (
				<img
					src={itemIconUrl(version, itemId)}
					alt={name}
					onError={() => setErr(true)}
					className="block h-full w-full object-cover"
				/>
			) : (
				<div className="grid h-full w-full place-items-center px-[2px] text-center font-mono text-[8px] font-semibold leading-none text-paper-200">
					{name.slice(0, 6)}
				</div>
			)}
		</div>
	)
}
