import type { BuildRecommendation } from "@/shared/types"

import { getDDragonBundle } from "../ddragon"
import { buildCacheKey, withCache } from "./cache"
import { normalizeOpgg } from "./opgg-normalize"
import { parseOpggText } from "./opgg-parse"
import { type OpggPosition, positionFromRole, roleFromPosition } from "./position"
import type { BuildRecommendationProvider } from "./types"

const ENDPOINT = "https://mcp-api.op.gg/mcp"
const FETCH_TIMEOUT_MS = 12_000
const DEFAULT_TIER = "emerald_plus"

/** Extract result.content[0].text from a plain-JSON or SSE-framed body. */
function extractText(body: string): string | null {
	let envelope: { result?: { content?: { text?: string }[] } } | null = null
	try {
		envelope = JSON.parse(body)
	} catch {
		for (const line of body.split(/\r?\n/)) {
			const t = line.trim()
			if (!t.startsWith("data:")) continue
			const payload = t.slice(5).trim()
			if (payload === "" || payload === "[DONE]") continue
			try {
				const obj = JSON.parse(payload) as { result?: unknown }
				if (obj?.result) envelope = obj as typeof envelope
			} catch {
				// skip non-JSON SSE frames (e.g. event: lines)
			}
		}
	}
	const text = envelope?.result?.content?.[0]?.text
	return typeof text === "string" && text.length > 0 ? text : null
}

async function fetchAnalysisText(
	champion: string,
	position: OpggPosition,
	tier: string,
): Promise<string | null> {
	const requestBody = {
		jsonrpc: "2.0",
		id: 1,
		method: "tools/call",
		params: {
			name: "lol_get_champion_analysis",
			arguments: {
				game_mode: "ranked",
				champion,
				position,
				lang: "en_US",
				tier,
			},
		},
	}
	const response = await fetch(ENDPOINT, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
		},
		body: JSON.stringify(requestBody),
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	})
	if (!response.ok) throw new Error(`OP.GG POST → ${response.status}`)
	return extractText(await response.text())
}

class OpggProvider implements BuildRecommendationProvider {
	async getBuild(
		championKey: number,
		position: string,
		opts?: { tier?: string },
	): Promise<BuildRecommendation | null> {
		const role = roleFromPosition(position)
		if (!role) return null
		const tier = opts?.tier ?? DEFAULT_TIER

		const bundle = await getDDragonBundle()
		const champion = bundle.championsByKey[championKey]?.name
		if (!champion) return null
		const patch = bundle.version

		const key = buildCacheKey(championKey, role, tier, patch)
		return withCache(key, async () => {
			const text = await fetchAnalysisText(champion, positionFromRole(role), tier)
			if (!text) return null
			return normalizeOpgg(parseOpggText(text), { championKey, role, patch })
		})
	}
}

let provider: BuildRecommendationProvider | null = null

export function getBuildRecommendationProvider(): BuildRecommendationProvider {
	if (!provider) provider = new OpggProvider()
	return provider
}

export async function getBuild(
	championKey: number,
	position: string,
	tier?: string,
): Promise<BuildRecommendation | null> {
	return getBuildRecommendationProvider().getBuild(
		championKey,
		position,
		tier ? { tier } : undefined,
	)
}
