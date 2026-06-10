import type { Role } from "@/shared/types"

export interface MainGroup {
	role: Role
	championIds: number[]
}

/* fixed display order: Top → Jungle → Mid → Bot → Support */
export const MAIN_ROLE_ORDER: Role[] = ["top", "jungle", "middle", "bottom", "utility"]

export function groupMainsByRole(mains: { championId: number; role: Role }[]): MainGroup[] {
	return MAIN_ROLE_ORDER.map((role) => ({
		role,
		championIds: mains.filter((m) => m.role === role).map((m) => m.championId),
	}))
}
