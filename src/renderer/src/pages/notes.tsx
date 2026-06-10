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
		[navigate, initSearch.new, initSearch.edit], // intentionally empty — values captured in closure at mount time
	)

	const version = bundle?.version ?? ""
	const spellSlotLayout = settings?.spellSlotLayout ?? "DF"

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
		<div className="relative flex h-full min-h-0 flex-col gap-4">
			<header className="flex items-center justify-between gap-4">
				<div className="flex flex-col gap-1">
					<h1 className="m-0 text-[24px] font-semibold leading-none text-(--fg-1)">Notes</h1>
					<span className="font-mono text-[12px] font-normal leading-none text-(--fg-4)">
						{notes.length} matchup{notes.length === 1 ? "" : "s"}
					</span>
				</div>
				<div className="flex items-center gap-[10px]">
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
			</header>

			{sorted.length === 0 ? (
				<Card className="flex flex-1 items-center justify-center">
					{notes.length === 0 ? (
						<EmptyState
							icon={BookOpen}
							title="No notes yet"
							line="Jot down what wins a matchup: trades, timings, what to respect. They show up the moment you lock in."
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
				<div className="-mr-6 grid min-h-0 flex-1 auto-rows-[220px] grid-cols-[repeat(auto-fill,minmax(340px,1fr))] content-start gap-[14px] overflow-y-auto pb-1 pr-6">
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
