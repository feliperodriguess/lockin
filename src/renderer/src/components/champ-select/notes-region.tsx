import { Section } from "@renderer/components/champ-select/section"
import { MatchupPill } from "@renderer/components/game/matchup-pill"
import { NoteCard } from "@renderer/components/notes/note-card"
import { NoteEmptyState } from "@renderer/components/notes/note-empty-state"
import type { ChampSelectVM } from "@renderer/hooks/use-champ-select"
import { useDDragon, useUpsertNote } from "@renderer/hooks/use-data"
import { timeAgo } from "@renderer/lib/time"
import { EyeOff } from "lucide-react"

import type { MatchupDifficulty } from "@/shared/lib/counters"
import type { ChampionStatic, MatchupNote } from "@/shared/types"

interface NotesRegionProps {
	note: MatchupNote | null
	enemyHidden: boolean
	me: ChampSelectVM["me"]
	opponent: ChampionStatic | null
	version: string
	grow?: boolean
	difficulty: MatchupDifficulty | null
}

export function NotesRegion({
	note,
	enemyHidden,
	me,
	opponent,
	version,
	grow,
	difficulty,
}: NotesRegionProps): React.JSX.Element {
	const upsert = useUpsertNote()
	const { data: bundle } = useDDragon()
	const showNote = !!note && !enemyHidden

	let body: React.JSX.Element
	if (enemyHidden) {
		body = (
			<div className="flex flex-1 flex-col items-center justify-center gap-[10px] px-3 py-2 text-center">
				<EyeOff size={24} strokeWidth={2} className="text-paper-400" />
				<p className="m-0 text-[14px] font-medium leading-[1.4] text-paper-200">
					Enemy laner not revealed yet
				</p>
				<p className="m-0 max-w-[280px] text-[12.5px] leading-normal text-paper-400">
					Your <b className="font-semibold text-paper-200">{me.champion?.name}</b> matchup notes
					show up here once they lock in.
				</p>
			</div>
		)
	} else if (note && bundle) {
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
		// opponent may be null: role pending, or no enemy maps to my lane
		body = <NoteEmptyState champion={me.champion} opponent={opponent} version={version} />
	}

	return (
		<Section
			label="Your note"
			grow={grow}
			emphasis={showNote}
			right={
				difficulty || showNote ? (
					<div className="flex items-center gap-2">
						{difficulty && <MatchupPill difficulty={difficulty} />}
						{showNote && (
							<time
								dateTime={note.updatedAt}
								className="font-mono text-[10px] leading-none text-paper-400"
							>
								{timeAgo(note.updatedAt)}
							</time>
						)}
					</div>
				) : null
			}
		>
			{body}
		</Section>
	)
}
