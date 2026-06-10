import type { BuildRecommendation, CounterTable } from "@/shared/types"

export interface BuildRecommendationProvider {
	getBuild(
		championKey: number,
		position: string,
		opts?: { tier?: string },
	): Promise<BuildRecommendation | null>
	getCounters(
		championKey: number,
		position: string,
		opts?: { tier?: string },
	): Promise<CounterTable | null>
}
