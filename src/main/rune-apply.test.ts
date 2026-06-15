import { describe, expect, it } from "vitest"

import type { RunePageRec } from "@/shared/types"

import { applyRunePage, type LcuRequest } from "./rune-apply"

const RUNES: RunePageRec = {
	primaryStyleId: 8200,
	subStyleId: 8400,
	selectedPerkIds: [8229, 8226, 8210, 8237, 8444, 8451, 5005, 5001, 5001],
	primaryName: "Sorcery",
	secondaryName: "Resolve",
}

interface ServerPage {
	id: number
	name?: string
	isEditable?: boolean
	current?: boolean
	subStyleId?: number
	selectedPerkIds?: number[]
}

interface Call {
	method: string
	url: string
	body?: Record<string, unknown>
}

function harness(opts: { canAddCustomPage: boolean; pages: ServerPage[]; deleteError?: string }) {
	const calls: Call[] = []
	const request: LcuRequest = async (method, url, body) => {
		calls.push({ method, url, body: body as Record<string, unknown> })
		if (method === "GET" && url === "/lol-perks/v1/inventory") {
			return { canAddCustomPage: opts.canAddCustomPage }
		}
		if (method === "GET" && url === "/lol-perks/v1/pages") return opts.pages
		if (method === "DELETE") {
			if (opts.deleteError) throw new Error(opts.deleteError)
			return null
		}
		if (method === "PUT") return null
		if (method === "POST") return { id: 999 }
		return null
	}
	let trackedId: number | null = null
	return {
		calls,
		deps: {
			request,
			getTrackedPageId: () => trackedId,
			setTrackedPageId: (id: number | null) => {
				trackedId = id
			},
		},
		tracked: () => trackedId,
		setTracked: (id: number | null) => {
			trackedId = id
		},
	}
}

const realPage = (id: number, current: boolean): ServerPage => ({
	id,
	isEditable: true,
	current,
	subStyleId: 8300,
	selectedPerkIds: [8112, 8143, 8140, 8106, 8304, 8347, 5008, 5008, 5001],
})
const blankPage = (id: number, current = false): ServerPage => ({
	id,
	name: "",
	isEditable: true,
	current,
	subStyleId: -1,
	selectedPerkIds: [-1, -1, -1, -1, -1, -1, -1, -1, -1],
})

describe("applyRunePage", () => {
	it("repurposes a blank page when slots are full and the tracked id is stale", async () => {
		// the real-world bug: store points at a lockin page the user deleted, and
		// every rune slot is taken. We must not POST (would fail, full) — instead
		// claim the blank page in place.
		const h = harness({
			canAddCustomPage: false,
			pages: [realPage(285443979, true), realPage(1719806403, false), blankPage(1734854685)],
		})
		h.setTracked(1589632827) // stale — not among the pages

		const res = await applyRunePage(h.deps, RUNES, "Malphite")

		expect(res.ok).toBe(true)
		const put = h.calls.find((c) => c.method === "PUT")
		expect(put?.url).toBe("/lol-perks/v1/pages/1734854685")
		expect(put?.body).toMatchObject({
			selectedPerkIds: RUNES.selectedPerkIds,
			current: true,
			name: "lockin: Malphite (Sorcery)",
		})
		expect(h.calls.some((c) => c.method === "POST")).toBe(false)
		expect(h.tracked()).toBe(1734854685) // now tracks the claimed page
	})

	it("takes over the active page when slots are full and there is no blank page", async () => {
		const h = harness({
			canAddCustomPage: false,
			pages: [realPage(10, false), realPage(20, true)],
		})

		const res = await applyRunePage(h.deps, RUNES, "Malphite")

		expect(res.ok).toBe(true)
		expect(h.calls.find((c) => c.method === "PUT")?.url).toBe("/lol-perks/v1/pages/20")
		expect(h.tracked()).toBe(20)
	})

	it("never overwrites an uneditable page", async () => {
		const h = harness({
			canAddCustomPage: false,
			// the blank+current page is uneditable (e.g. a reserved page) — skip it
			pages: [{ ...blankPage(1, true), isEditable: false }, realPage(2, false)],
		})

		const res = await applyRunePage(h.deps, RUNES, "Malphite")

		expect(res.ok).toBe(true)
		expect(h.calls.find((c) => c.method === "PUT")?.url).toBe("/lol-perks/v1/pages/2")
	})

	it("overwrites our own page in place when we already own one (no slot needed)", async () => {
		const h = harness({ canAddCustomPage: false, pages: [realPage(555, true)] })
		h.setTracked(555)

		const res = await applyRunePage(h.deps, RUNES, "Malphite")

		expect(res.ok).toBe(true)
		expect(h.calls.find((c) => c.method === "PUT")?.url).toBe("/lol-perks/v1/pages/555")
		expect(h.calls.some((c) => c.method === "POST")).toBe(false)
		expect(h.tracked()).toBe(555)
	})

	it("forgets a stale tracked id and creates a fresh page when a slot is free", async () => {
		const h = harness({ canAddCustomPage: true, pages: [realPage(1, true)] })
		h.setTracked(99999) // stale

		const res = await applyRunePage(h.deps, RUNES, "Malphite")

		expect(res.ok).toBe(true)
		expect(h.calls.some((c) => c.method === "POST" && c.url === "/lol-perks/v1/pages")).toBe(true)
		expect(h.calls.some((c) => c.method === "PUT")).toBe(false) // never touched the user's page
		expect(h.tracked()).toBe(999)
	})

	it("creates a fresh page when none is tracked and a slot is free", async () => {
		const h = harness({ canAddCustomPage: true, pages: [realPage(1, true)] })

		const res = await applyRunePage(h.deps, RUNES, "Malphite")

		expect(res.ok).toBe(true)
		expect(h.calls.find((c) => c.method === "POST")?.body).toMatchObject({
			name: "lockin: Malphite (Sorcery)",
			current: true,
		})
		expect(h.tracked()).toBe(999)
	})
})
