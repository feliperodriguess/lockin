// notes.jsx:18-196 — Note editor right drawer.
// ccp-fade backdrop + ccp-drawer 392px panel; header Eyebrow + X;
// body: Champion (req), Opponent (allowClear), Note textarea, Pinned spells chip-toggles;
// footer: Delete (destructive, edit only) + Cancel (ghost) + Create/Save (default).

import { ChampionPicker } from "@renderer/components/app/champion-picker"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { SpellIcon } from "@renderer/components/game/spell-icon"
import { Field } from "@renderer/components/notes/note-field"
import { Button } from "@renderer/components/ui/button"
import { Textarea } from "@renderer/components/ui/textarea"
import { useDeleteNote, useUpsertNote } from "@renderer/hooks/use-data"
import { cn } from "@renderer/lib/utils"
import { Check, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"

import type { AppSettings, DDragonBundle, MatchupNote } from "@/shared/types"

interface NoteEditorProps {
	/** null = new note */
	note: MatchupNote | null
	bundle: DDragonBundle
	version: string
	spellSlotLayout: AppSettings["spellSlotLayout"]
	onClose: () => void
}

export function NoteEditor({
	note,
	bundle,
	version,
	spellSlotLayout,
	onClose,
}: NoteEditorProps): React.JSX.Element {
	const isNew = note === null
	const upsert = useUpsertNote()
	const del = useDeleteNote()

	// Draft state — seeded from existing note or blank
	const [championId, setChampionId] = useState<number | null>(note?.championId ?? null)
	const [opponentChampionId, setOpponentChampionId] = useState<number | null>(
		note?.opponentChampionId ?? null,
	)
	const [body, setBody] = useState(note?.body ?? "")
	// pinnedSpells as mutable array of spell keys (max 2 at a time)
	const [spells, setSpells] = useState<number[]>(note?.pinnedSpells ? [...note.pinnedSpells] : [])

	// Close on Escape
	useEffect(() => {
		const h = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		document.addEventListener("keydown", h)
		return () => document.removeEventListener("keydown", h)
	}, [onClose])

	// toggleSpell: exact notes.jsx:20-29 semantics
	const toggleSpell = (s: number) => {
		setSpells((cur) => {
			if (cur.includes(s)) return cur.filter((x) => x !== s)
			if (cur.length < 2) return [...cur, s]
			// 3rd click replaces the second [cur[1], s]
			return [cur[1], s]
		})
	}

	const canSave = championId != null && body.trim().length > 0
	const isPending = upsert.isPending || del.isPending

	const handleSave = async () => {
		if (!canSave || isPending) return
		// pinnedSpells: persist only when exactly 2 selected
		const pinnedSpells: [number, number] | undefined =
			spells.length === 2 ? [spells[0], spells[1]] : undefined
		// canSave guarantees championId != null here
		if (championId == null) return
		await upsert.mutateAsync({
			...(note ? { id: note.id } : {}),
			championId,
			opponentChampionId: opponentChampionId ?? null,
			body,
			pinnedSpells,
		})
		onClose()
	}

	const handleDelete = async () => {
		if (!note || isPending) return
		await del.mutateAsync(note.id)
		onClose()
	}

	// All spells sorted by key for display
	const allSpells = Object.values(bundle.spellsByKey).sort((a, b) => a.key - b.key)

	return (
		<>
			{/* backdrop — Esc handled via useEffect; click closes drawer */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop dismiss; keyboard handled via Esc useEffect */}
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: same */}
			<div
				onClick={onClose}
				className="ccp-fade absolute inset-0 z-[60] bg-[rgba(0,0,0,0.55)] backdrop-blur-[2px]"
			/>

			{/* drawer panel */}
			<aside
				role="dialog"
				aria-modal
				aria-label={isNew ? "New note" : "Edit note"}
				className={cn(
					"ccp-drawer absolute inset-y-0 right-0 z-[61]",
					"flex flex-col",
					"bg-ink-900 border-l border-[var(--stroke-strong)] shadow-[var(--shadow-lg)]",
					"max-w-[92%] w-[392px]",
				)}
			>
				{/* header */}
				<div className="flex items-center justify-between border-b border-[var(--stroke-default)] px-[18px] py-4">
					<Eyebrow line={20}>{isNew ? "New note" : "Edit note"}</Eyebrow>
					<button
						type="button"
						onClick={onClose}
						className="flex cursor-pointer border-none bg-transparent p-1 text-paper-300"
					>
						<X size={18} />
					</button>
				</div>

				{/* body — form semantics */}
				<form
					onSubmit={(e) => {
						e.preventDefault()
						handleSave()
					}}
					className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[18px]"
				>
					{/* champion + opponent row */}
					<div className="grid grid-cols-2 gap-3">
						<Field label="Champion" req>
							<ChampionPicker
								value={championId}
								onChange={setChampionId}
								bundle={bundle}
								version={version}
								placeholder="Pick champion"
							/>
						</Field>
						<Field label="Opponent">
							<ChampionPicker
								value={opponentChampionId}
								onChange={setOpponentChampionId}
								bundle={bundle}
								version={version}
								placeholder="Optional"
								allowClear
							/>
						</Field>
					</div>

					{/* note textarea */}
					<Field label="Note">
						<Textarea
							rows={7}
							value={body}
							onChange={(e) => setBody(e.target.value)}
							autoFocus
							placeholder="What wins this matchup? Trades, timings, what to respect…"
							className="text-[14px] leading-[1.6] text-paper-100"
						/>
					</Field>

					{/* pinned spells */}
					<Field label="Pinned spells" hint="Overrides the suggestion in the header">
						<div className="flex flex-wrap gap-2">
							{allSpells.map((s) => {
								const on = spells.includes(s.key)
								const order = spells.indexOf(s.key)
								// D/F label based on spellSlotLayout and selection order
								// spellSlotLayout "DF": first selected = D (slot 0), second = F (slot 1)
								// spellSlotLayout "FD": first selected = F (slot 0), second = D (slot 1)
								const slotLabel = (): string => {
									if (!on || order < 0) return ""
									if (spellSlotLayout === "DF") return order === 0 ? "D" : "F"
									return order === 0 ? "F" : "D"
								}
								const label = slotLabel()
								return (
									<button
										key={s.key}
										type="button"
										onClick={() => toggleSpell(s.key)}
										className={cn(
											"relative flex cursor-pointer items-center gap-[7px] rounded-sm px-[9px] py-[5px] pl-[6px]",
											"border text-[12px] font-medium leading-none",
											"transition-colors duration-[var(--dur-base)] ease-[var(--ease-standard)]",
											on
												? "border-accent bg-[var(--accent-bg)] text-accent"
												: "border-[var(--stroke-default)] bg-ink-950 text-paper-200",
										)}
									>
										<SpellIcon spell={s} version={version} size={22} />
										{s.name}
										{on && label && (
											<span className="font-mono text-[9px] font-semibold leading-none">
												{label}
											</span>
										)}
									</button>
								)
							})}
						</div>
					</Field>
				</form>

				{/* footer */}
				<div className="flex items-center justify-between gap-[10px] border-t border-[var(--stroke-default)] px-[18px] py-[14px]">
					{!isNew ? (
						<Button variant="destructive" disabled={isPending} onClick={handleDelete}>
							<Trash2 size={14} />
							Delete
						</Button>
					) : (
						<span />
					)}
					<div className="flex gap-2">
						<Button variant="ghost" type="button" onClick={onClose}>
							Cancel
						</Button>
						<Button disabled={!canSave || isPending} onClick={handleSave}>
							<Check size={14} />
							{isNew ? "Create note" : "Save"}
						</Button>
					</div>
				</div>
			</aside>
		</>
	)
}
