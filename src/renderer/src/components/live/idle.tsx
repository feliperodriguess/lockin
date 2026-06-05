// live-view.jsx:93-161 — Idle state (connected, no active game flow).
// Hero card + recent notes grid (placeholder cards until Task 14 swaps in real NoteCard).

import { Card } from "@renderer/components/app/card"
import { EmptyState } from "@renderer/components/app/empty-state"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { Button } from "@renderer/components/ui/button"
import { useDDragon, useNotes } from "@renderer/hooks/use-data"
import { timeAgo } from "@renderer/lib/time"
import { useNavigate } from "@tanstack/react-router"
import { BookOpen, ChevronRight, Plus, Shield } from "lucide-react"

export function Idle(): React.JSX.Element {
	const navigate = useNavigate()
	const { data: notes = [] } = useNotes()
	const { data: bundle } = useDDragon()

	const champName = (id: number | null | undefined) =>
		id ? (bundle?.championsByKey[id]?.name ?? "Unknown") : null

	// 4 most-recently-updated notes — listNotes() already sorts desc; re-sort defensively
	const recent = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)

	return (
		<div className="flex h-full flex-col gap-[18px]" style={{ minHeight: 0 }}>
			{/* hero card */}
			<Card className="flex items-center justify-between gap-4 p-5">
				<div className="flex flex-col gap-[10px]">
					<Eyebrow line={22}>Connected · standing by</Eyebrow>
					<div style={{ font: "400 24px/1.3 var(--font-display)", color: "var(--fg-1)" }}>
						Back at it. Queue up when you're ready.
					</div>
					<div
						style={{
							font: "400 13px/1.5 var(--font-ui)",
							color: "var(--fg-3)",
							maxWidth: 420,
						}}
					>
						Lockin wakes up the moment champ select begins. Until then, sharpen your notes.
					</div>
				</div>
				<Button size="lg" onClick={() => navigate({ to: "/notes", search: { new: true } })}>
					<Plus size={16} />
					New note
				</Button>
			</Card>

			{/* recent notes row header */}
			<div className="flex items-center justify-between">
				<Eyebrow line={22}>Recent notes</Eyebrow>
				<button
					type="button"
					onClick={() => navigate({ to: "/settings" })}
					className="inline-flex cursor-pointer items-center gap-[6px] border-none bg-transparent"
					style={{
						font: "500 12px/1 var(--font-ui)",
						color: "var(--fg-3)",
					}}
				>
					<Shield size={13} />
					Manage ban list
					<ChevronRight size={13} />
				</button>
			</div>

			{/* recent notes grid */}
			{recent.length === 0 ? (
				<EmptyState
					icon={BookOpen}
					title="No notes yet"
					action={
						<Button onClick={() => navigate({ to: "/notes", search: { new: true } })}>
							Write your first note
						</Button>
					}
				/>
			) : (
				<div
					className="min-h-0 flex-1 overflow-y-auto"
					style={{
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
						gridAutoRows: "1fr",
						gap: 14,
					}}
				>
					{recent.map((note) => (
						// swapped for the real NoteCard in Task 14
						<Card key={note.id} className="flex flex-col gap-2 p-3">
							<p
								className="truncate text-[var(--fg-1)]"
								style={{ font: "500 13px/1.3 var(--font-ui)" }}
							>
								{champName(note.championId) ?? "Note"}{" "}
								{note.opponentChampionId ? `vs ${champName(note.opponentChampionId)}` : ""}
							</p>
							<p
								className="text-[var(--fg-3)] overflow-hidden"
								style={{
									font: "400 12px/1.5 var(--font-ui)",
									display: "-webkit-box",
									WebkitLineClamp: 3,
									WebkitBoxOrient: "vertical",
								}}
							>
								{note.body}
							</p>
							<p
								className="mt-auto"
								style={{
									font: "400 11px/1 var(--font-mono)",
									color: "var(--fg-4)",
								}}
							>
								{timeAgo(note.updatedAt)}
							</p>
						</Card>
					))}
				</div>
			)}
		</div>
	)
}
