import type { BuildRecommendation } from "@/shared/types"

export interface BuildProvider {
	getBuild(
		championKey: number,
		position: string,
		opts?: { tier?: string },
	): Promise<BuildRecommendation | null>
}
