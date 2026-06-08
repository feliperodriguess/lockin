import { Card } from "@renderer/components/app/card"
import { EmptyState } from "@renderer/components/app/empty-state"
import { Eyebrow } from "@renderer/components/app/eyebrow"
import { NoteCard } from "@renderer/components/notes/note-card"
import { Button } from "@renderer/components/ui/button"
import { useDDragon, useNotes, useSettings } from "@renderer/hooks/use-data"
import { useNavigate } from "@tanstack/react-router"
import { BookOpen, ChevronRight, Plus, Shield } from "lucide-react"

export function Idle(): React.JSX.Element {
	const navigate = useNavigate()
	const { data: notes = [] } = useNotes()
	const { data: bundle } = useDDragon()
	const { data: settings } = useSettings()

	const version = bundle?.version ?? ""
	const spellSlotLayout = settings?.spellSlotLayout ?? "DF"
	const recent = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)

	return (
		<div className="flex h-full min-h-0 flex-col gap-[18px]">
			<Card className="flex items-center justify-between gap-4 p-5">
				<div className="flex flex-col gap-[10px]">
					<Eyebrow line={22}>Connected · standing by</Eyebrow>
					<p className="m-0 font-display text-[24px] font-normal leading-[1.3] text-paper-100">
						Back at it. Queue up when you're ready.
					</p>
					<p className="m-0 max-w-[420px] text-[13px] leading-normal text-paper-300">
						Lockin wakes up the moment champ select begins. Until then, sharpen your notes.
					</p>
				</div>
				<Button size="lg" onClick={() => navigate({ to: "/notes", search: { new: true } })}>
					<Plus size={16} />
					New note
				</Button>
			</Card>

			<div className="flex items-center justify-between">
				<Eyebrow line={22}>Recent notes</Eyebrow>
				<button
					type="button"
					onClick={() => navigate({ to: "/settings" })}
					className="inline-flex cursor-pointer items-center gap-[6px] border-none bg-transparent text-[12px] font-medium leading-none text-paper-300"
				>
					<Shield size={13} />
					Manage ban list
					<ChevronRight size={13} />
				</button>
			</div>

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
			) : bundle ? (
				<div className="grid min-h-0 flex-1 auto-rows-[220px] grid-cols-[repeat(auto-fill,minmax(340px,1fr))] content-start gap-[14px] overflow-y-auto">
					{recent.map((note) => (
						<NoteCard
							key={note.id}
							note={note}
							bundle={bundle}
							version={version}
							variant="full"
							spellSlotLayout={spellSlotLayout}
							onClick={() => navigate({ to: "/notes", search: { edit: note.id } })}
						/>
					))}
				</div>
			) : null}
		</div>
	)
}
