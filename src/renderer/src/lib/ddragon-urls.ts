const CDN = "https://ddragon.leagueoflegends.com/cdn"

export const champIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/champion/${imageFull}`

export const spellIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/spell/${imageFull}`

export const itemIconUrl = (version: string, itemId: number) =>
	`${CDN}/${version}/img/item/${itemId}.png`

export const passiveIconUrl = (version: string, imageFull: string) =>
	`${CDN}/${version}/img/passive/${imageFull}`

export const profileIconUrl = (version: string, iconId: number) =>
	`${CDN}/${version}/img/profileicon/${iconId}.png`

/* perk icons are NOT version-pathed — DDragon serves them under /cdn/img/<iconPath> */
export const runeIconUrl = (iconPath: string) => `${CDN}/img/${iconPath}`

/* deterministic on-brand fallback tint per champion (replaces data.js per-champ colors) */
export function championFallbackColor(key: number): string {
	const hue = Math.round((key * 137.508) % 360) // golden-angle spread
	return `hsl(${hue} 32% 30%)`
}
