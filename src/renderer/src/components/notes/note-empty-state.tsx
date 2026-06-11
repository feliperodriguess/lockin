import { ChampionPortrait } from "@renderer/components/game/champion-portrait"
import { Button } from "@renderer/components/ui/button"
import { useNavigate } from "@tanstack/react-router"
import { Plus } from "lucide-react"

import type { ChampionStatic } from "@/shared/types"

interface NoteEmptyStateProps {
	champion: ChampionStatic | null
	opponent?: ChampionStatic | null
	version: string
}

export function NoteEmptyState({
	champion,
	opponent,
	version,
}: NoteEmptyStateProps): React.JSX.Element {
	const navigate = useNavigate()
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-[10px] px-3 py-4 text-center">
			<div className="flex items-center gap-2">
				<ChampionPortrait champion={champion} version={version} size={28} />
				{opponent && (
					<>
						<span className="font-mono text-[10px] uppercase leading-none text-paper-400">vs</span>
						<ChampionPortrait champion={opponent} version={version} size={28} />
					</>
				)}
			</div>
			<p className="m-0 text-[14px] font-medium leading-[1.4] text-paper-200">
				{opponent ? (
					"No note for this matchup yet"
				) : (
					<>
						No notes for <b className="font-semibold text-paper-100">{champion?.name}</b> yet
					</>
				)}
			</p>
			<p className="m-0 max-w-[280px] text-[12.5px] leading-normal text-paper-400">
				{opponent ? (
					<>
						What you learn against <b className="font-semibold text-paper-200">{opponent.name}</b>{" "}
						shows up here next time you face them.
					</>
				) : (
					<>
						Notes you write for <b className="font-semibold text-paper-200">{champion?.name}</b>{" "}
						show up here once your lane opponent is revealed.
					</>
				)}
			</p>
			<Button
				variant="secondary"
				size="sm"
				className="mt-1"
				onClick={() => navigate({ to: "/notes", search: { new: true } })}
			>
				<Plus size={14} />
				Add a note
			</Button>
		</div>
	)
}
