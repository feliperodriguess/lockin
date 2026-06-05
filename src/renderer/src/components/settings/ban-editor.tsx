// settings.jsx:81-239 — BanEditor: priority-ordered ban list with reorder, reason, remove, add.
// NOTE: ThreatBadge intentionally omitted — BanListEntry has no threat field and settings has
// no session context (ThreatBadge is a champ-select-only concept). This is an intentional
// simplification per the task spec.

import { Card } from "@renderer/components/app/card"
import { ChampionPicker } from "@renderer/components/app/champion-picker"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { useBanList, useDDragon, useSetBanList } from "@renderer/hooks/use-data"
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
		<li
			style={{
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: "7px 8px",
				borderRadius: "var(--radius-sm)",
				background: "var(--color-ink-950)",
				border: "1px solid var(--stroke-subtle)",
				listStyle: "none",
			}}
		>
			{/* Move chevrons */}
			<span
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					color: "var(--fg-4)",
				}}
			>
				<button
					type="button"
					onClick={() => onMove(-1)}
					disabled={atTop}
					title="Move up"
					style={{
						background: "none",
						border: "none",
						cursor: atTop ? "default" : "pointer",
						color: atTop ? "var(--color-ink-600)" : "var(--fg-3)",
						padding: 0,
						display: "flex",
						height: 13,
					}}
				>
					<ChevronUp size={14} />
				</button>
				<button
					type="button"
					onClick={() => onMove(1)}
					disabled={atBottom}
					title="Move down"
					style={{
						background: "none",
						border: "none",
						cursor: atBottom ? "default" : "pointer",
						color: atBottom ? "var(--color-ink-600)" : "var(--fg-3)",
						padding: 0,
						display: "flex",
						height: 13,
					}}
				>
					<ChevronDown size={14} />
				</button>
			</span>

			{/* Priority index */}
			<span
				style={{
					font: "600 11px/1 var(--font-mono)",
					color: "var(--fg-4)",
					width: 16,
					textAlign: "center",
				}}
			>
				{index + 1}
			</span>

			{/* Champion portrait */}
			<ChampionPortrait champion={champion} version={version} size={30} />

			{/* Champion name */}
			<div style={{ display: "flex", flexDirection: "column", gap: 2, width: 96, flexShrink: 0 }}>
				<span
					style={{
						font: "600 13px/1 var(--font-ui)",
						color: "var(--fg-1)",
					}}
				>
					{champion?.name ?? "Unknown"}
				</span>
			</div>

			{/* Reason inline input — local draft, mutate on blur */}
			<input
				value={localReason}
				onChange={(ev) => setLocalReason(ev.target.value)}
				onBlur={() => onReasonBlur(localReason)}
				placeholder="Add a reason (optional)"
				style={{
					flex: 1,
					minWidth: 0,
					background: "transparent",
					border: "none",
					outline: "none",
					color: "var(--fg-2)",
					font: "400 12.5px/1 var(--font-ui)",
				}}
			/>

			{/* Remove button */}
			<button
				type="button"
				onClick={onRemove}
				title="Remove"
				onMouseEnter={(ev) => {
					ev.currentTarget.style.color = "var(--color-fail)"
				}}
				onMouseLeave={(ev) => {
					ev.currentTarget.style.color = "var(--fg-4)"
				}}
				style={{
					background: "none",
					border: "none",
					cursor: "pointer",
					color: "var(--fg-4)",
					display: "flex",
					padding: 4,
				}}
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
		<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
			{/* Header */}
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
				<Eyebrow line={22}>Ban list · priority order</Eyebrow>
				<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>
					{banlist.length} champions
				</span>
			</div>

			<Card className="p-2 flex flex-col gap-1">
				{/* Empty state */}
				{banlist.length === 0 && (
					<div
						style={{
							padding: "24px",
							textAlign: "center",
							font: "400 13px/1.5 var(--font-ui)",
							color: "var(--fg-4)",
						}}
					>
						Your ban list is empty. Add the champions you never want to face.
					</div>
				)}

				{/* Ban rows */}
				<ul
					style={{
						listStyle: "none",
						margin: 0,
						padding: 0,
						display: "flex",
						flexDirection: "column",
						gap: 4,
					}}
				>
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
				<div style={{ padding: "6px 4px 2px", maxWidth: 280 }}>
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
