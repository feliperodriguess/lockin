import type { Role } from "@/shared/types"

/** OP.GG `lol_get_champion_analysis` position enum. */
export type OpggPosition = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT"

const ROLE_TO_POSITION: Record<Role, OpggPosition> = {
	top: "TOP",
	jungle: "JUNGLE",
	middle: "MID",
	bottom: "ADC",
	utility: "SUPPORT",
}

export function positionFromRole(role: Role): OpggPosition {
	return ROLE_TO_POSITION[role]
}

/**
 * Tolerant inbound mapping. The `build:get` ipc takes a freeform `position: string`
 * which may be a Role ("middle"), an LCU assignedPosition ("bottom"/"utility"),
 * an OP.GG enum ("MID"/"ADC"/"SUPPORT"), or common shorthands ("bot"/"mid"/"sup").
 * Returns null when nothing matches so the provider can degrade to no build.
 */
export function roleFromPosition(position: string): Role | null {
	switch (position.trim().toLowerCase()) {
		case "top":
			return "top"
		case "jungle":
		case "jg":
		case "jung":
			return "jungle"
		case "middle":
		case "mid":
			return "middle"
		case "bottom":
		case "bot":
		case "adc":
			return "bottom"
		case "utility":
		case "support":
		case "sup":
		case "supp":
			return "utility"
		default:
			return null
	}
}
