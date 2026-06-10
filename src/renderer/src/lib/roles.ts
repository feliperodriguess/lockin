import { championLaneRole } from "@/shared/lib/lanes"
import type { Role } from "@/shared/types"

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

/** Champion's default lane as a DisplayRole — table now lives in shared/lib/lanes. */
export function championLane(id: string): DisplayRole | null {
	const role = championLaneRole(id)
	return role ? ROLE_TO_DISPLAY[role] : null
}

/* Role (lowercase, shared contract) ↔ DisplayRole (renderer) ↔ OP.GG position enum */
const ROLE_TO_DISPLAY: Record<Role, DisplayRole> = {
	top: "Top",
	jungle: "Jungle",
	middle: "Mid",
	bottom: "Bot",
	utility: "Support",
}

const DISPLAY_TO_ROLE: Record<DisplayRole, Role> = {
	Top: "top",
	Jungle: "jungle",
	Mid: "middle",
	Bot: "bottom",
	Support: "utility",
}

const ROLE_TO_POSITION: Record<Role, string> = {
	top: "TOP",
	jungle: "JUNGLE",
	middle: "MID",
	bottom: "ADC",
	utility: "SUPPORT",
}

export function roleToDisplay(role: Role): DisplayRole {
	return ROLE_TO_DISPLAY[role]
}

export function displayToRole(role: DisplayRole): Role {
	return DISPLAY_TO_ROLE[role]
}

export function roleToPosition(role: Role): string {
	return ROLE_TO_POSITION[role]
}
