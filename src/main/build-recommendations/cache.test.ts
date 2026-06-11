import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { BuildRecommendation } from "@/shared/types"

const FAKE_DIR = "/fake-userdata"
const FILE = join(FAKE_DIR, "opgg-cache.json")

/** in-memory stand-in for the cache file on disk */
let files: Record<string, string>

vi.mock("electron", () => ({ app: { getPath: () => FAKE_DIR } }))
vi.mock("node:fs/promises", () => ({
	readFile: vi.fn(async (p: string) => {
		if (p in files) return files[p]
		throw new Error("ENOENT")
	}),
	writeFile: vi.fn(async (p: string, data: string) => {
		files[p] = data
	}),
}))

function rec(championKey: number): BuildRecommendation {
	return {
		championKey,
		role: "top",
		patch: "x",
		winRate: 0.5,
		sampleSize: 100,
		runes: null,
		spells: null,
		items: {
			starter: { ids: [] },
			boots: { ids: [] },
			core: { ids: [] },
			fourth: [],
			fifth: [],
			sixth: [],
		},
		skillOrder: [],
		skillPriority: [],
		// stamped like a real cache entry so withCache treats it as a fresh hit
		__cachedAt: Date.now(),
	} as BuildRecommendation
}

beforeEach(() => {
	files = {}
	vi.clearAllMocks() // the fs mock instance survives resetModules — clear its call history
	// cache.ts holds module-level state (memo, prunedPatch) — reset between cases
	vi.resetModules()
})

describe("withCache stale-patch prune", () => {
	it("evicts old-patch entries on the first lookup of a new patch", async () => {
		const { withCache, buildCacheKey } = await import("./cache")
		const { writeFile } = await import("node:fs/promises")
		const stale = buildCacheKey(266, "TOP", "emerald_plus", "14.10.1")
		const fresh = buildCacheKey(266, "TOP", "emerald_plus", "14.11.1")
		files[FILE] = JSON.stringify({ [stale]: rec(266), [fresh]: rec(266) })

		await withCache(fresh, async () => rec(266))

		await vi.waitFor(() => expect(writeFile).toHaveBeenCalled())
		const persisted = JSON.parse(files[FILE]) as Record<string, unknown>
		expect(Object.keys(persisted)).toEqual([fresh]) // stale gone, current kept
	})

	it("does not rewrite the file when every entry is already on the current patch", async () => {
		const { withCache, buildCacheKey } = await import("./cache")
		const { writeFile } = await import("node:fs/promises")
		const fresh = buildCacheKey(266, "TOP", "emerald_plus", "14.11.1")
		files[FILE] = JSON.stringify({ [fresh]: rec(266) })

		// fresh cache hit → no fetch, and nothing stale to prune → no write
		await withCache(fresh, async () => rec(266))
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(writeFile).not.toHaveBeenCalled()
	})
})
