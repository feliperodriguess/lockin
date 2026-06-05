// notes.jsx:235-335 — Notes library page.
// Header (title + count + SearchField + New note button) + grid of NoteCard full
// or empty states; NoteEditor drawer on top.

import { Card } from "@renderer/components/app/card"
import { EmptyState } from "@renderer/components/app/empty-state"
import { SearchField } from "@renderer/components/app/search-field"
import { NoteCard } from "@renderer/components/notes/note-card"
import { NoteEditor } from "@renderer/components/notes/note-editor"
import { Button } from "@renderer/components/ui/button"
import { useDDragon, useNotes, useSettings } from "@renderer/hooks/use-data"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { BookOpen, Plus, Search } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

export function NotesPage(): React.JSX.Element {
	const navigate = useNavigate()
	const search = useSearch({ from: "/notes" })

	const { data: notes = [] } = useNotes()
	const { data: bundle } = useDDragon()
	const { data: settings } = useSettings()

	const [q, setQ] = useState("")
	// editingId: "new" | note.id | null
	const [editingId, setEditingId] = useState<string | null>(null)

	// On mount, open the editor from route search params (?new / ?edit), then clear
	// them (replace) so back-navigation doesn't reopen. The effect re-runs once after
	// the params clear; both values are then falsy, so it no-ops.
	const initSearch = { new: search.new, edit: search.edit }
	useEffect(
		() => {
			if (initSearch.new) {
				setEditingId("new")
				navigate({ to: "/notes", search: {}, replace: true })
			} else if (initSearch.edit) {
				setEditingId(initSearch.edit)
				navigate({ to: "/notes", search: {}, replace: true })
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount
		[navigate, initSearch.new, initSearch.edit], // intentionally empty — values captured in closure at mount time
	)

	const version = bundle?.version ?? ""
	const spellSlotLayout = settings?.spellSlotLayout ?? "DF"

	// Renderer-side search filter (D9 — no IPC round trip)
	const filtered = notes.filter((n) => {
		if (!q) return true
		const t = q.toLowerCase()
		const champName = bundle?.championsByKey[n.championId]?.name?.toLowerCase() ?? ""
		const oppName = n.opponentChampionId
			? (bundle?.championsByKey[n.opponentChampionId]?.name?.toLowerCase() ?? "")
			: ""
		return n.body.toLowerCase().includes(t) || champName.includes(t) || oppName.includes(t)
	})

	// Sorted most-recent-first (listNotes() already sorted; re-sort defensively)
	const sorted = [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

	const editingNote =
		editingId && editingId !== "new" ? (notes.find((n) => n.id === editingId) ?? null) : null
	const editorOpen = editingId !== null

	const openNew = () => setEditingId("new")
	const openEdit = (id: string) => setEditingId(id)
	const closeEditor = useCallback(() => setEditingId(null), [])

	if (!bundle) return <div className="h-full" />

	return (
		<div
			style={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				gap: 16,
				minHeight: 0,
				position: "relative",
			}}
		>
			{/* header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 16,
				}}
			>
				<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
					<h1
						style={{
							margin: 0,
							font: "600 24px/1 var(--font-ui)",
							color: "var(--fg-1)",
						}}
					>
						Notes
					</h1>
					<span style={{ font: "400 12px/1 var(--font-mono)", color: "var(--fg-4)" }}>
						{notes.length} matchup{notes.length === 1 ? "" : "s"}
					</span>
				</div>
				<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
					<SearchField
						value={q}
						onChange={setQ}
						placeholder="Search notes & champions"
						className="w-[248px]"
					/>
					<Button onClick={openNew}>
						<Plus size={14} />
						New note
					</Button>
				</div>
			</div>

			{/* content */}
			{sorted.length === 0 ? (
				<Card className="flex flex-1 items-center justify-center">
					{notes.length === 0 ? (
						<EmptyState
							icon={BookOpen}
							title="No notes yet"
							line="Jot what wins a matchup — trades, timings, what to respect. They'll surface the moment you lock in."
							action={
								<Button onClick={openNew}>
									<Plus size={14} />
									Write your first note
								</Button>
							}
						/>
					) : (
						<EmptyState
							icon={Search}
							title="Nothing matches"
							line={`No notes for "${q}".`}
							compact
						/>
					)}
				</Card>
			) : (
				<div
					style={{
						flex: 1,
						minHeight: 0,
						overflowY: "auto",
						display: "grid",
						gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
						gridAutoRows: "minmax(186px, auto)",
						gap: 14,
						paddingBottom: 4,
					}}
				>
					{sorted.map((n) => (
						<NoteCard
							key={n.id}
							note={n}
							bundle={bundle}
							version={version}
							variant="full"
							spellSlotLayout={spellSlotLayout}
							onClick={() => openEdit(n.id)}
						/>
					))}
				</div>
			)}

			{/* editor drawer */}
			{editorOpen && (
				<NoteEditor
					note={editingId === "new" ? null : editingNote}
					bundle={bundle}
					version={version}
					spellSlotLayout={spellSlotLayout}
					onClose={closeEditor}
				/>
			)}
		</div>
	)
}
