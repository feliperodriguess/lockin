import { ChampionPicker } from "@renderer/components/app/champion-picker"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { SpellIcon } from "@renderer/components/game/spell-icon"
import { Field } from "@renderer/components/notes/note-field"
import { Button } from "@renderer/components/ui/button"
import { Textarea } from "@renderer/components/ui/textarea"
import { useDeleteNote, useUpsertNote } from "@renderer/hooks/use-data"
import { tweenBase, tweenEmphasized, tweenExit } from "@renderer/lib/motion"
import { cn } from "@renderer/lib/utils"
import { Check, Trash2, X } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useState } from "react"

import type { AppSettings, DDragonBundle, MatchupNote } from "@/shared/types"

import { PINNABLE_SPELL_KEYS } from "../../lib/spells"

interface NoteEditorProps {
	note: MatchupNote | null
	prefill?: { championId: number | null; opponentChampionId: number | null } | null
	bundle: DDragonBundle
	version: string
	spellSlotLayout: AppSettings["spellSlotLayout"]
	onClose: () => void
}

export function NoteEditor({
	note,
	prefill,
	bundle,
	version,
	spellSlotLayout,
	onClose,
}: NoteEditorProps): React.JSX.Element {
	const isNew = note === null
	const upsert = useUpsertNote()
	const del = useDeleteNote()

	const [championId, setChampionId] = useState<number | null>(
		note?.championId ?? prefill?.championId ?? null,
	)
	const [opponentChampionId, setOpponentChampionId] = useState<number | null>(
		note?.opponentChampionId ?? prefill?.opponentChampionId ?? null,
	)
	const [body, setBody] = useState(note?.body ?? "")
	const [spells, setSpells] = useState<number[]>(note?.pinnedSpells ? [...note.pinnedSpells] : [])

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
		const pinnedSpells: [number, number] | undefined =
			spells.length === 2 ? [spells[0], spells[1]] : undefined
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

	const allSpells = Object.values(bundle.spellsByKey)
		.filter((s) => PINNABLE_SPELL_KEYS.has(s.key))
		.sort((a, b) => a.key - b.key)

	useEffect(() => {
		const h = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		document.addEventListener("keydown", h)
		return () => document.removeEventListener("keydown", h)
	}, [onClose])

	return (
		<>
			{/* backdrop — Esc handled via useEffect; click closes drawer */}
			<motion.div
				onClick={onClose}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={tweenBase}
				className="absolute inset-0 z-60 bg-[rgba(0,0,0,0.55)] backdrop-blur-[2px]"
			/>

			<motion.aside
				role="dialog"
				aria-modal
				aria-label={isNew ? "New note" : "Edit note"}
				initial={{ x: 26 }}
				animate={{ x: 0, transition: tweenEmphasized }}
				exit={{ x: 26, opacity: 0, transition: tweenExit }}
				className={cn(
					"absolute inset-y-0 right-0 z-61",
					"flex flex-col",
					"bg-ink-900 border-l border-(--stroke-strong) shadow-(--shadow-lg)",
					"max-w-[92%] w-[392px]",
				)}
			>
				<div className="flex items-center justify-between border-b border-(--stroke-default) px-[18px] py-4">
					<Eyebrow line={20}>{isNew ? "New note" : "Edit note"}</Eyebrow>
					<button
						className="flex cursor-pointer border-none bg-transparent p-1 text-paper-300"
						onClick={onClose}
						type="button"
					>
						<X size={18} />
					</button>
				</div>

				<form
					onSubmit={(e) => {
						e.preventDefault()
						handleSave()
					}}
					className="flex flex-1 flex-col gap-[18px] overflow-y-auto p-[18px]"
				>
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
					<Field label="Pinned spells" hint="Overrides the recommended spells for this matchup">
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
											"transition-colors duration-(--dur-base) ease-(--ease-standard)",
											on
												? "border-accent bg-(--accent-bg) text-accent"
												: "border-(--stroke-default) bg-ink-950 text-paper-200",
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

				<div className="flex items-center justify-between gap-[10px] border-t border-(--stroke-default) px-[18px] py-[14px]">
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
			</motion.aside>
		</>
	)
}
