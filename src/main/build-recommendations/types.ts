import type { BuildRecommendation } from "@/shared/types"

export interface BuildRecommendationProvider {
	getBuild(
		championKey: number,
		position: string,
		opts?: { tier?: string },
	): Promise<BuildRecommendation | null>
}
