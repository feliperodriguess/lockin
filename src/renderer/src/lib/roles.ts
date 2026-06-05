/* LCU assignedPosition → display role (prototype uses Top/Jungle/Mid/Bot/Support) */
export type DisplayRole = "Top" | "Jungle" | "Mid" | "Bot" | "Support"

const BY_POSITION: Record<string, DisplayRole> = {
	top: "Top",
	jungle: "Jungle",
	middle: "Mid",
	bottom: "Bot",
	utility: "Support",
}

export function displayRole(assignedPosition: string): DisplayRole | null {
	return BY_POSITION[assignedPosition] ?? null
}

export const ROLE_ABBR: Record<DisplayRole, string> = {
	Top: "TOP",
	Jungle: "JNG",
	Mid: "MID",
	Bot: "BOT",
	Support: "SUP",
}

/* role-glyph dot positions on the diagonal (champ-art.jsx:468) */
export const ROLE_GLYPH_POS: Record<DisplayRole, [number, number]> = {
	Top: [6, 6],
	Jungle: [9, 14],
	Mid: [12, 12],
	Bot: [18, 18],
	Support: [15, 19],
}
