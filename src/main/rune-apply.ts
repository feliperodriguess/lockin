import type { RunePageRec } from "@/shared/types"

/** The LCU request primitive (LcuService.request), injected so this logic is
 *  testable without a live client. Resolves the parsed body; throws on non-2xx. */
export type LcuRequest = (
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
	url: string,
	body?: unknown,
) => Promise<unknown>

export interface RuneApplyDeps {
	request: LcuRequest
	/** the id of the page lockin currently owns, or null */
	getTrackedPageId: () => number | null
	setTrackedPageId: (id: number | null) => void
}

/** Shape of a /lol-perks/v1/pages entry — only the fields we read. */
interface LcuRunePage {
	id: number
	isEditable?: boolean
	current?: boolean
	subStyleId?: number
	selectedPerkIds?: number[]
}

const SLOTS_FULL_ERROR = "Rune page slots are full. Delete a page and try again."
const GENERIC_ERROR = "Couldn't apply runes — too late to swap rune pages."

/** Short, lockin-namespaced so it's always recognisable as ours:
 *  "lockin: Malphite (Sorcery)". */
export function runePageName(page: RunePageRec, championName?: string): string {
	return championName
		? `lockin: ${championName} (${page.primaryName})`
		: `lockin: ${page.primaryName}`
}

function pageBody(page: RunePageRec, name: string, id?: number): Record<string, unknown> {
	return {
		...(id != null ? { id } : {}),
		name,
		primaryStyleId: page.primaryStyleId,
		subStyleId: page.subStyleId,
		selectedPerkIds: page.selectedPerkIds,
		current: true,
	}
}

/** A page with no real runes chosen (a fresh "New Runes Page" the user never
 *  filled in) — safe to repurpose without destroying a setup they rely on. */
function isBlank(p: LcuRunePage): boolean {
	const perks = p.selectedPerkIds ?? []
	return !perks.some((id) => id > 0) || (p.subStyleId ?? -1) <= 0
}

/**
 * Apply lockin's recommended rune page, only ever owning a single page.
 *
 *  - We already own a live page → overwrite it in place (PUT, no slot needed).
 *  - A slot is free → create a fresh lockin page.
 *  - Slots are full and we own nothing → repurpose one of the user's editable
 *    pages: a blank one if available (nothing lost), otherwise the active page.
 *
 * The tracked id is reconciled against the live page list first, so a page the
 * user deleted out-of-band can't make us assume a delete will free a slot.
 */
export async function applyRunePage(
	deps: RuneApplyDeps,
	page: RunePageRec,
	championName?: string,
): Promise<{ ok: boolean; error?: string }> {
	const { request, getTrackedPageId, setTrackedPageId } = deps
	const name = runePageName(page, championName)
	try {
		const inventory = (await request("GET", "/lol-perks/v1/inventory")) as {
			canAddCustomPage?: boolean
		} | null
		const pages = ((await request("GET", "/lol-perks/v1/pages")) as LcuRunePage[] | null) ?? []
		const slotsFull = inventory?.canAddCustomPage === false

		// Reconcile: forget a tracked page that no longer exists.
		let trackedId = getTrackedPageId()
		if (trackedId !== null && !pages.some((p) => p.id === trackedId)) {
			setTrackedPageId(null)
			trackedId = null
		}

		// 1) We own a live page → overwrite it in place. Works even when full.
		if (trackedId !== null) {
			await request("PUT", `/lol-perks/v1/pages/${trackedId}`, pageBody(page, name, trackedId))
			return { ok: true }
		}

		// 2) A slot is free → create a fresh lockin page.
		if (!slotsFull) {
			const created = (await request("POST", "/lol-perks/v1/pages", pageBody(page, name))) as {
				id?: number
			} | null
			if (created?.id != null) setTrackedPageId(created.id)
			return { ok: true }
		}

		// 3) Full and nothing of ours: repurpose an editable page in place — a
		// blank one if we can find it, otherwise the active page.
		const editable = pages.filter((p) => p.isEditable !== false)
		const target = editable.find(isBlank) ?? editable.find((p) => p.current) ?? editable[0]
		if (!target) return { ok: false, error: SLOTS_FULL_ERROR }
		await request("PUT", `/lol-perks/v1/pages/${target.id}`, pageBody(page, name, target.id))
		setTrackedPageId(target.id)
		return { ok: true }
	} catch (error) {
		console.error("[lcu] applyRunePage failed:", error)
		return { ok: false, error: GENERIC_ERROR }
	}
}
