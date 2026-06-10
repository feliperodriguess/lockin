import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { app } from "electron"

import type { BuildRecommendation } from "@/shared/types"

type CacheMap = Record<string, BuildRecommendation>

const TTL_MS = 12 * 60 * 60 * 1000 // a patch is stable for days; refresh twice a day at most

let memo: CacheMap | null = null
let writeChain: Promise<void> = Promise.resolve()
/** per-key guard so a background refresh fires at most once at a time */
const refreshing = new Set<string>()
let prunedPatch: string | null = null

function cachePath(): string {
	return join(app.getPath("userData"), "opgg-cache.json")
}

export function buildCacheKey(
	championKey: number,
	position: string,
	tier: string,
	patch: string,
): string {
	return `${championKey}:${position}:${tier}:${patch}`
}

function patchOf(key: string): string {
	return key.slice(key.lastIndexOf(":") + 1)
}

function pruneStalePatches(map: CacheMap, patch: string): boolean {
	let changed = false
	for (const k of Object.keys(map)) {
		if (patchOf(k) !== patch) {
			delete map[k]
			changed = true
		}
	}
	return changed
}

async function load(): Promise<CacheMap> {
	if (memo) return memo
	try {
		memo = JSON.parse(await readFile(cachePath(), "utf8")) as CacheMap
	} catch {
		memo = {} // no cache / corrupt cache — start empty
	}
	return memo
}

function persist(map: CacheMap): void {
	// serialize writes so concurrent champ-select hovers don't clobber the file
	writeChain = writeChain
		.then(() => writeFile(cachePath(), JSON.stringify(map)))
		.catch((error) => console.warn("[opgg] cache write failed:", error))
}

function isFresh(entry: BuildRecommendation | undefined): entry is BuildRecommendation {
	if (!entry) return false
	const at = (entry as BuildRecommendation & { __cachedAt?: number }).__cachedAt
	return typeof at === "number" && Date.now() - at < TTL_MS
}

/**
 * Cache-through wrapper. Serves a fresh cache hit immediately. A stale hit is
 * served immediately while a single background refresh runs. A miss awaits the
 * fetch. `fetcher` failure → return whatever cache we have (even stale), else null.
 */
export async function withCache(
	key: string,
	fetcher: () => Promise<BuildRecommendation | null>,
): Promise<BuildRecommendation | null> {
	const map = await load()

	const patch = patchOf(key)
	if (prunedPatch !== patch) {
		prunedPatch = patch
		if (pruneStalePatches(map, patch)) persist(map)
	}

	const cached = map[key]

	if (isFresh(cached)) return strip(cached)

	if (cached) {
		// stale — serve it, refresh in the background once
		if (!refreshing.has(key)) {
			refreshing.add(key)
			void fetcher()
				.then((fresh) => {
					if (fresh) {
						map[key] = stamp(fresh)
						persist(map)
					}
				})
				.catch((error) => console.warn("[opgg] background refresh failed:", error))
				.finally(() => refreshing.delete(key))
		}
		return strip(cached)
	}

	// miss — await the fetch
	try {
		const fresh = await fetcher()
		if (!fresh) return null
		map[key] = stamp(fresh)
		persist(map)
		return strip(fresh)
	} catch (error) {
		console.warn("[opgg] fetch failed:", error)
		return null
	}
}

function stamp(rec: BuildRecommendation): BuildRecommendation {
	return { ...rec, __cachedAt: Date.now() } as BuildRecommendation
}

function strip(rec: BuildRecommendation): BuildRecommendation {
	const { __cachedAt, ...rest } = rec as BuildRecommendation & { __cachedAt?: number }
	void __cachedAt
	return rest
}
