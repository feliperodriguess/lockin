const CDN = "https://ddragon.leagueoflegends.com/cdn"

export const champIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/champion/${imageFull}`

export const spellIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/spell/${imageFull}`

/* deterministic on-brand fallback tint per champion (replaces data.js per-champ colors) */
export function championFallbackColor(key: number): string {
	const hue = Math.round((key * 137.508) % 360) // golden-angle spread
	return `hsl(${hue} 32% 30%)`
}
