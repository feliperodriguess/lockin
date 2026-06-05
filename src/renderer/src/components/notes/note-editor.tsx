// notes.jsx:18-196 — Note editor right drawer.
// ccp-fade backdrop + ccp-drawer 392px panel; header Eyebrow + X;
// body: Champion (req), Opponent (allowClear), Note textarea, Pinned spells chip-toggles;
// footer: Delete (destructive, edit only) + Cancel (ghost) + Create/Save (default).

import { ChampionPicker } from "@renderer/components/app/champion-picker"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { TextInput } from "@renderer/components/app/text-input"
import { SpellIcon } from "@renderer/components/game/spell-icon"
import { Button } from "@renderer/components/ui/button"
import { useDeleteNote, useUpsertNote } from "@renderer/hooks/use-data"
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
				className="ccp-fade"
				style={{
					position: "absolute",
					inset: 0,
					background: "rgba(0,0,0,0.55)",
					backdropFilter: "blur(2px)",
					zIndex: 60,
				}}
			/>

			{/* drawer panel */}
			<aside
				role="dialog"
				aria-modal
				aria-label={isNew ? "New note" : "Edit note"}
				className="ccp-drawer"
				style={{
					position: "absolute",
					top: 0,
					right: 0,
					bottom: 0,
					width: 392,
					maxWidth: "92%",
					zIndex: 61,
					background: "var(--bg-surface)",
					borderLeft: "1px solid var(--stroke-strong)",
					boxShadow: "var(--shadow-lg)",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* header */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "16px 18px",
						borderBottom: "1px solid var(--stroke-default)",
					}}
				>
					<Eyebrow line={20}>{isNew ? "New note" : "Edit note"}</Eyebrow>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: "none",
							border: "none",
							cursor: "pointer",
							color: "var(--fg-3)",
							display: "flex",
							padding: 4,
						}}
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
					style={{
						flex: 1,
						overflowY: "auto",
						padding: 18,
						display: "flex",
						flexDirection: "column",
						gap: 18,
					}}
				>
					{/* champion + opponent row */}
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
						<TextInput
							rows={7}
							value={body}
							onChange={setBody}
							autoFocus
							placeholder="What wins this matchup? Trades, timings, what to respect…"
							className="text-[14px] leading-[1.6] text-[var(--fg-1)]"
						/>
					</Field>

					{/* pinned spells */}
					<Field label="Pinned spells" hint="Overrides the suggestion in the header">
						<div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
										style={{
											display: "flex",
											alignItems: "center",
											gap: 7,
											padding: "5px 9px 5px 6px",
											borderRadius: "var(--radius-sm)",
											cursor: "pointer",
											background: on ? "var(--accent-bg)" : "var(--color-ink-950)",
											border: `1px solid ${on ? "var(--color-accent)" : "var(--stroke-default)"}`,
											color: on ? "var(--color-accent)" : "var(--fg-2)",
											font: "500 12px/1 var(--font-ui)",
											position: "relative",
										}}
									>
										<SpellIcon spell={s} version={version} size={22} />
										{s.name}
										{on && label && (
											<span style={{ font: "600 9px/1 var(--font-mono)" }}>{label}</span>
										)}
									</button>
								)
							})}
						</div>
					</Field>
				</form>

				{/* footer */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "14px 18px",
						borderTop: "1px solid var(--stroke-default)",
						gap: 10,
					}}
				>
					{!isNew ? (
						<Button variant="destructive" disabled={isPending} onClick={handleDelete}>
							<Trash2 size={14} />
							Delete
						</Button>
					) : (
						<span />
					)}
					<div style={{ display: "flex", gap: 8 }}>
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

/* ---------- Field ---------- */

interface FieldProps {
	label: string
	hint?: string
	req?: boolean
	children: React.ReactNode
}

function Field({ label, hint, req, children }: FieldProps) {
	return (
		// Using div so biome's noLabelWithoutControl doesn't fire on dynamic children
		<div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
			<span
				style={{
					display: "flex",
					alignItems: "center",
					gap: 6,
					font: "500 11px/1 var(--font-mono)",
					letterSpacing: "0.06em",
					textTransform: "uppercase",
					color: "var(--fg-3)",
				}}
			>
				{label}
				{req && <span style={{ color: "var(--color-accent)" }}>*</span>}
				{hint && (
					<span
						style={{
							textTransform: "none",
							letterSpacing: 0,
							fontFamily: "var(--font-ui)",
							color: "var(--fg-4)",
							fontWeight: 400,
							fontSize: 10,
						}}
					>
						· {hint}
					</span>
				)}
			</span>
			{children}
		</div>
	)
}
