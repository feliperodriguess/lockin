import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { app } from "electron"

import type { ChampionStatic, DDragonBundle, SummonerSpellStatic } from "@/shared/types"

import { normalizeItems, normalizeRunes, type RawRuneStyle } from "./ddragon-normalize"

const BASE = "https://ddragon.leagueoflegends.com"
const LOCALE = "en_US"
const FETCH_TIMEOUT_MS = 10_000

interface RawEntry {
	id?: string
	key?: string // DDragon serializes the numeric key as a string ("266")
	name?: string
	title?: string
	tags?: string[]
	image?: { full?: string }
}

function cachePath(): string {
	return join(app.getPath("userData"), "ddragon-cache.json")
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
	if (!response.ok) throw new Error(`GET ${url} → ${response.status}`)
	return (await response.json()) as T
}

async function resolveLatestVersion(): Promise<string> {
	const versions = await fetchJson<string[]>(`${BASE}/api/versions.json`)
	const latest = versions[0]
	if (!latest) throw new Error("ddragon versions.json came back empty")
	return latest
}

function normalizeChampions(data: Record<string, RawEntry>): Record<number, ChampionStatic> {
	const byKey: Record<number, ChampionStatic> = {}
	for (const entry of Object.values(data)) {
		const key = Number(entry.key)
		if (!Number.isFinite(key)) continue
		byKey[key] = {
			id: entry.id ?? "",
			key,
			name: entry.name ?? entry.id ?? "",
			title: entry.title ?? "",
			tags: entry.tags ?? [],
			imageFull: entry.image?.full ?? `${entry.id}.png`,
		}
	}
	return byKey
}

function normalizeSpells(data: Record<string, RawEntry>): Record<number, SummonerSpellStatic> {
	const byKey: Record<number, SummonerSpellStatic> = {}
	for (const entry of Object.values(data)) {
		const key = Number(entry.key)
		if (!Number.isFinite(key)) continue
		byKey[key] = {
			id: entry.id ?? "",
			key,
			name: entry.name ?? entry.id ?? "",
			imageFull: entry.image?.full ?? `${entry.id}.png`,
		}
	}
	return byKey
}

async function fetchBundle(version: string): Promise<DDragonBundle> {
	const [champions, spells, runes, items] = await Promise.all([
		fetchJson<{ data: Record<string, RawEntry> }>(
			`${BASE}/cdn/${version}/data/${LOCALE}/champion.json`,
		),
		fetchJson<{ data: Record<string, RawEntry> }>(
			`${BASE}/cdn/${version}/data/${LOCALE}/summoner.json`,
		),
		fetchJson<RawRuneStyle[]>(`${BASE}/cdn/${version}/data/${LOCALE}/runesReforged.json`),
		fetchJson<{ data: Record<string, { name?: string; image?: { full?: string } }> }>(
			`${BASE}/cdn/${version}/data/${LOCALE}/item.json`,
		),
	])
	return {
		version,
		championsByKey: normalizeChampions(champions.data),
		spellsByKey: normalizeSpells(spells.data),
		runesById: normalizeRunes(runes),
		itemsById: normalizeItems(items.data),
	}
}

async function readCache(): Promise<DDragonBundle | null> {
	try {
		const bundle = JSON.parse(await readFile(cachePath(), "utf8")) as DDragonBundle
		// require the runes/items keys so caches written before this version refetch
		return bundle.version &&
			bundle.championsByKey &&
			bundle.spellsByKey &&
			bundle.runesById &&
			bundle.itemsById
			? bundle
			: null
	} catch {
		return null // no cache / corrupt cache — treated as absent
	}
}

async function writeCache(bundle: DDragonBundle): Promise<void> {
	try {
		await writeFile(cachePath(), JSON.stringify(bundle))
	} catch (error) {
		console.warn("[ddragon] cache write failed:", error)
	}
}

async function refreshIfStale(cachedVersion: string): Promise<void> {
	try {
		const latest = await resolveLatestVersion()
		if (latest === cachedVersion) return
		console.log(`[ddragon] patch change ${cachedVersion} → ${latest}, refreshing cache`)
		await writeCache(await fetchBundle(latest))
	} catch (error) {
		console.warn("[ddragon] background refresh failed:", error) // offline is fine — cache serves
	}
}

async function loadBundle(): Promise<DDragonBundle> {
	const cached = await readCache()
	if (cached) {
		void refreshIfStale(cached.version) // background; the NEXT launch picks up a new patch
		console.log(`[ddragon] serving cached bundle ${cached.version}`)
		return cached
	}
	const version = await resolveLatestVersion()
	const bundle = await fetchBundle(version)
	await writeCache(bundle)
	console.log(`[ddragon] fetched fresh bundle ${version}`)
	return bundle
}

/* session memo — matches the renderer's staleTime: Infinity; a failed load is
   not memoized so Query retries hit the network again */
let memo: DDragonBundle | null = null
let loading: Promise<DDragonBundle> | null = null

export function getDDragonBundle(): Promise<DDragonBundle> {
	if (memo) return Promise.resolve(memo)
	if (!loading) {
		loading = loadBundle()
			.then((bundle) => {
				memo = bundle
				return bundle
			})
			.finally(() => {
				loading = null
			})
	}
	return loading
}
