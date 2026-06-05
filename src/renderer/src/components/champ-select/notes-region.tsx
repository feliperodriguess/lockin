// champ-select-parts.jsx:231-320 — the "Your note" region, three bodies:
//   1. enemyHidden  → EyeOff + "Enemy laner not revealed yet" + champion-name copy
//   2. note present → NoteCard compact (inline read/edit toggle via onSaveBody)
//   3. no note      → portraits row + "No note yet for X vs Y." + "Add a note" CTA

import { Section } from "@renderer/components/champ-select/section"
import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { NoteCard } from "@renderer/components/notes/note-card"
import { Button } from "@renderer/components/ui/button"
import type { ChampSelectVM } from "@renderer/hooks/use-champ-select"
import { useDDragon, useUpsertNote } from "@renderer/hooks/use-data"
import { timeAgo } from "@renderer/lib/time"
import { useNavigate } from "@tanstack/react-router"
import { EyeOff, Plus } from "lucide-react"

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
	const upsert = useUpsertNote()
	const { data: bundle } = useDDragon()
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
	} else if (note && bundle) {
		// key on note.id → different matchup remounts NoteCard, resetting local draft/editing state
		body = (
			<NoteCard
				key={note.id}
				note={note}
				bundle={bundle}
				version={version}
				variant="compact"
				onSaveBody={(body) => {
					if (!upsert.isPending) upsert.mutate({ id: note.id, body })
				}}
				saving={upsert.isPending}
			/>
		)
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
