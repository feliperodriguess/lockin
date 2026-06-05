// champ-select-parts.jsx:231-320 — the "Your note" region, three bodies:
//   1. enemyHidden  → EyeOff + "Enemy laner not revealed yet" + champion-name copy
//   2. note present → inline compact note card (read/edit toggle)
//   3. no note      → portraits row + "No note yet for X vs Y." + "Add a note" CTA
// Section emphasis is on only when a real note is showing (note && !enemyHidden);
// the header `right` slot shows the note's relative timestamp in that case.
//
// The compact note card here is TEMPORARY: Task 14 builds the real reusable
// NoteCard (compact variant) and this gets swapped for it.

import { TextInput } from "@renderer/components/app/text-input"
import { Section } from "@renderer/components/champ-select/section"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { Button } from "@renderer/components/ui/button"
import type { ChampSelectVM } from "@renderer/hooks/use-champ-select"
import { useDDragon, useUpsertNote } from "@renderer/hooks/use-data"
import { timeAgo } from "@renderer/lib/time"
import { useNavigate } from "@tanstack/react-router"
import { Check, EyeOff, Plus, SquarePen } from "lucide-react"
import { useState } from "react"

import type { ChampionStatic, MatchupNote } from "@/shared/types"

interface NotesRegionProps {
	note: MatchupNote | null
	enemyHidden: boolean
	me: ChampSelectVM["me"]
	opponent: ChampionStatic | null
	version: string
	grow?: boolean
}

export function NotesRegion({
	note,
	enemyHidden,
	me,
	opponent,
	version,
	grow,
}: NotesRegionProps): React.JSX.Element {
	const navigate = useNavigate()
	const showNote = !!note && !enemyHidden

	let body: React.JSX.Element
	if (enemyHidden) {
		body = (
			<div
				className="flex flex-1 flex-col items-center justify-center text-center"
				style={{ gap: 10, padding: "8px 12px" }}
			>
				<EyeOff size={24} strokeWidth={2} style={{ color: "var(--fg-4)" }} />
				<p style={{ font: "500 14px/1.4 var(--font-ui)", color: "var(--fg-2)", margin: 0 }}>
					Enemy laner not revealed yet
				</p>
				<p
					style={{
						font: "400 12.5px/1.5 var(--font-ui)",
						color: "var(--fg-4)",
						maxWidth: 280,
						margin: 0,
					}}
				>
					Your <b style={{ color: "var(--fg-2)", fontWeight: 600 }}>{me.champion?.name}</b> matchup
					notes appear here the moment they lock in.
				</p>
			</div>
		)
	} else if (note) {
		// key on note.id → a different matchup note remounts CompactNote, resetting
		// its local draft/editing state (no effect needed)
		body = <CompactNote key={note.id} note={note} />
	} else {
		body = (
			<div className="flex flex-1 flex-col justify-center" style={{ gap: 12 }}>
				<div className="flex items-center" style={{ gap: 8 }}>
					<ChampionPortrait champion={me.champion} version={version} size={24} />
					<span style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}>vs</span>
					<ChampionPortrait champion={opponent} version={version} size={24} />
				</div>
				<p style={{ font: "400 14px/1.5 var(--font-ui)", color: "var(--fg-2)", margin: 0 }}>
					No note yet for{" "}
					<b style={{ color: "var(--fg-1)", fontWeight: 600 }}>{me.champion?.name}</b> vs{" "}
					<b style={{ color: "var(--fg-1)", fontWeight: 600 }}>{opponent?.name}</b>.
				</p>
				<Button
					className="self-start"
					onClick={() => navigate({ to: "/notes", search: { new: true } })}
				>
					<Plus size={16} />
					Add a note
				</Button>
			</div>
		)
	}

	return (
		<Section
			label="Your note"
			grow={grow}
			emphasis={showNote}
			right={
				showNote ? (
					<span style={{ font: "400 10px/1 var(--font-mono)", color: "var(--fg-4)" }}>
						{timeAgo(note.updatedAt)}
					</span>
				) : null
			}
		>
			{body}
		</Section>
	)
}

/* TODO(Task 14): replace with NoteCard compact */
// Remounted via key={note.id} by the parent, so useState seeds the draft from
// the current note each time the matchup changes.
function CompactNote({ note }: { note: MatchupNote }): React.JSX.Element {
	const upsert = useUpsertNote()
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState(note.body)

	const toggle = () => {
		if (editing) upsert.mutate({ id: note.id, body: draft }) // save on Done, not per keystroke
		setEditing((v) => !v)
	}

	return (
		<div className="flex h-full flex-col" style={{ gap: 10 }}>
			<div className="flex items-center justify-between" style={{ gap: 8 }}>
				<NoteTitle note={note} />
				<button
					type="button"
					onClick={toggle}
					title="Edit note"
					className="inline-flex items-center"
					style={{
						gap: 5,
						background: editing ? "var(--accent-bg)" : "transparent",
						border: "1px solid",
						borderColor: editing ? "transparent" : "var(--stroke-default)",
						color: editing ? "var(--color-accent)" : "var(--fg-3)",
						borderRadius: "var(--radius-sm)",
						padding: "4px 8px",
						cursor: "pointer",
						font: "500 11px/1 var(--font-ui)",
						transition: "all var(--dur-base) var(--ease-standard)",
					}}
				>
					{editing ? <Check size={12} /> : <SquarePen size={12} />}
					{editing ? "Done" : "Edit"}
				</button>
			</div>
			{editing ? (
				<TextInput
					rows={5}
					value={draft}
					onChange={setDraft}
					autoFocus
					className="min-h-0 flex-1 resize-none text-[14px] leading-[1.6] text-[var(--fg-1)]"
				/>
			) : (
				<p
					className="min-h-0 flex-1 overflow-y-auto"
					style={{
						margin: 0,
						font: "400 14.5px/1.62 var(--font-ui)",
						color: "var(--color-paper-100)",
						letterSpacing: "0.005em",
						textWrap: "pretty",
						whiteSpace: "pre-wrap",
					}}
				>
					{note.body}
				</p>
			)}
		</div>
	)
}

/* champ-select / components.jsx:8-46 — note title line (compact sizing). */
function NoteTitle({ note }: { note: MatchupNote }): React.JSX.Element {
	const { data: bundle } = useDDragon()
	const version = bundle?.version ?? ""
	const champ = note.championId ? (bundle?.championsByKey[note.championId] ?? null) : null
	const opp = note.opponentChampionId
		? (bundle?.championsByKey[note.opponentChampionId] ?? null)
		: null
	return (
		<div className="flex min-w-0 items-center" style={{ gap: 8 }}>
			<ChampionPortrait champion={champ} version={version} size={24} />
			<span
				className="shrink-0"
				style={{ font: "600 14px/1 var(--font-ui)", color: "var(--fg-1)", whiteSpace: "nowrap" }}
			>
				{champ?.name}
			</span>
			{opp && (
				<>
					<span
						className="shrink-0"
						style={{ font: "400 11px/1 var(--font-mono)", color: "var(--fg-4)" }}
					>
						vs
					</span>
					<ChampionPortrait champion={opp} version={version} size={24} />
					<span
						className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
						style={{ font: "500 14px/1 var(--font-ui)", color: "var(--fg-2)" }}
					>
						{opp.name}
					</span>
				</>
			)}
		</div>
	)
}
