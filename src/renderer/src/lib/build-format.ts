export function formatWinRate(fraction: number): string {
	return `${Math.round(fraction * 100)}%`
}

export function formatGames(games: number): string {
	if (games >= 1_000_000) return `${(games / 1_000_000).toFixed(1)}M`
	if (games >= 1000) return `${(games / 1000).toFixed(1)}k`
	return String(games)
}

export function winSampleLabel(winRate: number, sampleSize: number): string {
	return `${formatWinRate(winRate)} · ${formatGames(sampleSize)} games`
}
