// settings.jsx:81-239 — BanEditor: priority-ordered ban list with reorder, reason, remove, add.
// NOTE: ThreatBadge intentionally omitted — BanListEntry has no threat field and settings has
// no session context (ThreatBadge is a champ-select-only concept). This is an intentional
// simplification per the task spec.

import { Card } from "@renderer/components/app/card"
import { ChampionPicker } from "@renderer/components/app/champion-picker"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { useBanList, useDDragon, useSetBanList } from "@renderer/hooks/use-data"
import { cn } from "@renderer/lib/utils"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { useState } from "react"

import type { BanListEntry } from "@/shared/types"

// Per-row local draft for reason (mutate on blur)
function BanRow({
	entry,
	index,
	total,
	version,
	bundle,
	onMove,
	onRemove,
	onReasonBlur,
}: {
	entry: BanListEntry
	index: number
	total: number
	version: string
	bundle: import("@/shared/types").DDragonBundle
	onMove: (dir: -1 | 1) => void
	onRemove: () => void
	onReasonBlur: (reason: string) => void
}): React.JSX.Element {
	const [localReason, setLocalReason] = useState(entry.reason ?? "")
	const champion = bundle.championsByKey[entry.championId] ?? null
	const atTop = index === 0
	const atBottom = index === total - 1

	return (
		<li className="flex list-none items-center gap-[10px] rounded-sm border border-[var(--stroke-subtle)] bg-ink-950 px-2 py-[7px]">
			{/* Move chevrons */}
			<span className="flex flex-col items-center text-paper-400">
				<button
					type="button"
					onClick={() => onMove(-1)}
					disabled={atTop}
					title="Move up"
					className={cn(
						"flex h-[13px] items-center border-none bg-transparent p-0",
						atTop ? "cursor-default text-ink-600" : "cursor-pointer text-paper-300",
					)}
				>
					<ChevronUp size={14} />
				</button>
				<button
					type="button"
					onClick={() => onMove(1)}
					disabled={atBottom}
					title="Move down"
					className={cn(
						"flex h-[13px] items-center border-none bg-transparent p-0",
						atBottom ? "cursor-default text-ink-600" : "cursor-pointer text-paper-300",
					)}
				>
					<ChevronDown size={14} />
				</button>
			</span>

			{/* Priority index */}
			<span className="w-4 text-center font-mono text-[11px] font-semibold leading-none text-paper-400">
				{index + 1}
			</span>

			{/* Champion portrait */}
			<ChampionPortrait champion={champion} version={version} size={30} />

			{/* Champion name */}
			<div className="flex w-24 shrink-0 flex-col gap-[2px]">
				<span className="text-[13px] font-semibold leading-none text-paper-100">
					{champion?.name ?? "Unknown"}
				</span>
			</div>

			{/* Reason inline input — local draft, mutate on blur; transparent look preserved via classes only */}
			<input
				value={localReason}
				onChange={(ev) => setLocalReason(ev.target.value)}
				onBlur={() => onReasonBlur(localReason)}
				placeholder="Add a reason (optional)"
				className="min-w-0 flex-1 border-none bg-transparent text-[12.5px] leading-none text-paper-200 outline-none placeholder:text-paper-400"
			/>

			{/* Remove button */}
			<button
				type="button"
				onClick={onRemove}
				title="Remove"
				className="flex cursor-pointer border-none bg-transparent p-1 text-paper-400 transition-colors duration-[var(--dur-base)] ease-[var(--ease-standard)] hover:text-[var(--color-fail)]"
			>
				<Trash2 size={15} />
			</button>
		</li>
	)
}

export function BanEditor(): React.JSX.Element {
	const { data: bundle } = useDDragon()
	const { data: banlist } = useBanList()
	const setBanList = useSetBanList()

	if (!bundle || !banlist) return <div />

	const move = (i: number, dir: -1 | 1) => {
		const j = i + dir
		if (j < 0 || j >= banlist.length) return
		const next = [...banlist]
		;[next[i], next[j]] = [next[j], next[i]]
		setBanList.mutate(next)
	}

	const remove = (i: number) => {
		setBanList.mutate(banlist.filter((_, k) => k !== i))
	}

	const updateReason = (i: number, reason: string) => {
		const next = banlist.map((e, k) => (k === i ? { ...e, reason } : e))
		setBanList.mutate(next)
	}

	const add = (championId: number | null) => {
		if (championId == null) return
		if (banlist.find((e) => e.championId === championId)) return
		const next: BanListEntry[] = [...banlist, { championId, priority: banlist.length + 1 }]
		setBanList.mutate(next)
	}

	const excludeIds = banlist.map((e) => e.championId)

	return (
		<div className="flex flex-col gap-3">
			{/* Header */}
			<div className="flex items-center justify-between">
				<Eyebrow line={22}>Ban list · priority order</Eyebrow>
				<span className="font-mono text-[11px] leading-none text-paper-400">
					{banlist.length} champions
				</span>
			</div>

			<Card className="flex flex-col gap-1 p-2">
				{/* Empty state */}
				{banlist.length === 0 && (
					<p className="m-0 px-6 py-6 text-center text-[13px] leading-[1.5] text-paper-400">
						Your ban list is empty. Add the champions you'd rather not face.
					</p>
				)}

				{/* Ban rows */}
				<ul className="m-0 flex flex-col gap-1 p-0">
					{banlist.map((entry, i) => (
						<BanRow
							key={entry.championId}
							entry={entry}
							index={i}
							total={banlist.length}
							version={bundle.version}
							bundle={bundle}
							onMove={(dir) => move(i, dir)}
							onRemove={() => remove(i)}
							onReasonBlur={(reason) => updateReason(i, reason)}
						/>
					))}
				</ul>

				{/* Footer: add champion picker */}
				<div className="max-w-[280px] px-1 pb-[2px] pt-[6px]">
					<ChampionPicker
						value={null}
						onChange={add}
						bundle={bundle}
						version={bundle.version}
						placeholder="Add champion to ban list"
						size="sm"
						excludeIds={excludeIds}
					/>
				</div>
			</Card>
		</div>
	)
}
