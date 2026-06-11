import { formatGames, formatWinRate } from "@renderer/lib/build-format"
import { cn } from "@renderer/lib/utils"

import type { MatchupDifficulty } from "@/shared/lib/counters"

const LABEL: Record<MatchupDifficulty["level"], string> = {
	easy: "Easy",
	even: "Even",
	hard: "Hard",
}

export function MatchupPill({ difficulty }: { difficulty: MatchupDifficulty }): React.JSX.Element {
	const { level, winRate, games, lowData } = difficulty
	const toned = winRate != null && !lowData
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-[7px] py-[2px]",
				"font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.06em]",
				toned && level === "easy" && "bg-(--pass-bg) text-pass",
				toned && level === "hard" && "bg-(--fail-bg) text-fail",
				(!toned || level === "even") && "bg-(--bg-hover) text-paper-300",
			)}
		>
			{winRate == null
				? "Even · no counter data"
				: `${LABEL[level]} · ${formatWinRate(winRate)} WR · ${formatGames(games)} games${
						lowData ? " · low data" : ""
					}`}
		</span>
	)
}
