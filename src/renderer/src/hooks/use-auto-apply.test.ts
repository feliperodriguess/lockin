// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { BuildRecommendation, RunePageRec, SummonerSpellStatic } from "@/shared/types"

import { type AutoApplyOptions, useAutoApply } from "./use-auto-apply"

vi.mock("@renderer/api", () => ({
	api: {
		setSpells: vi.fn(() => Promise.resolve()),
		applyRunes: vi.fn(() => Promise.resolve({ ok: true })),
	},
}))

import { api } from "@renderer/api"

const runes: RunePageRec = {
	primaryStyleId: 8000,
	subStyleId: 8100,
	selectedPerkIds: [8005, 9111, 9104, 8014, 8139, 8135, 5008, 5008, 5002],
	primaryName: "Precision",
	secondaryName: "Domination",
}

function makeBuild(championKey: number): BuildRecommendation {
	return { championKey, runes, spells: [4, 7] } as unknown as BuildRecommendation
}

function makePair(): [SummonerSpellStatic, SummonerSpellStatic] {
	return [
		{ id: "SummonerFlash", key: 4, name: "Flash", imageFull: "SummonerFlash.png" },
		{ id: "SummonerHeal", key: 7, name: "Heal", imageFull: "SummonerHeal.png" },
	]
}

function makeOptions(overrides: Partial<AutoApplyOptions> = {}): AutoApplyOptions {
	return {
		championKey: 81,
		build: makeBuild(81),
		spellPair: makePair(),
		autoRunes: true,
		autoSpells: true,
		championName: "Ezreal",
		layout: "DF",
		flash: vi.fn(),
		...overrides,
	}
}

const advance = (ms: number) =>
	act(async () => {
		await vi.advanceTimersByTimeAsync(ms)
	})

describe("useAutoApply", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.clearAllMocks()
	})
	afterEach(() => {
		cleanup()
		vi.useRealTimers()
	})

	it("applies once even when re-renders churn prop identity inside the debounce window", async () => {
		// champ select re-renders ~1 Hz (countdown tick) and on every session push,
		// rebuilding spellPair's identity — that must not cancel the pending apply
		const { rerender } = renderHook((props: AutoApplyOptions) => useAutoApply(props), {
			initialProps: makeOptions(),
		})
		await advance(200) // inside the 400ms debounce
		rerender(makeOptions()) // same values, fresh identities (pair, build, flash)
		await advance(2000)
		expect(api.applyRunes).toHaveBeenCalledTimes(1)
		expect(api.setSpells).toHaveBeenCalledTimes(1)
		expect(api.setSpells).toHaveBeenCalledWith(4, 7)
	})

	it("applies only the final champion when switching within the debounce window", async () => {
		const { rerender } = renderHook((props: AutoApplyOptions) => useAutoApply(props), {
			initialProps: makeOptions(),
		})
		await advance(100)
		rerender(makeOptions({ championKey: 103, build: makeBuild(103), championName: "Ahri" }))
		await advance(2000)
		expect(api.applyRunes).toHaveBeenCalledTimes(1)
		expect(api.applyRunes).toHaveBeenCalledWith(runes, "Ahri")
	})

	it("writes pair[0] to the F slot when the layout is FD", async () => {
		// pair[0] is the flash-key slot (shared/lib/spells.ts contract); the LCU's
		// spell1Id is always the D slot, so FD must swap the write order
		renderHook((props: AutoApplyOptions) => useAutoApply(props), {
			initialProps: makeOptions({ layout: "FD" }),
		})
		await advance(2000)
		expect(api.setSpells).toHaveBeenCalledWith(7, 4)
	})

	it("makes no calls when both toggles are off", async () => {
		renderHook((props: AutoApplyOptions) => useAutoApply(props), {
			initialProps: makeOptions({ autoRunes: false, autoSpells: false }),
		})
		await advance(2000)
		expect(api.applyRunes).not.toHaveBeenCalled()
		expect(api.setSpells).not.toHaveBeenCalled()
	})

	it("does not re-apply for the same champion after a successful apply", async () => {
		const { rerender } = renderHook((props: AutoApplyOptions) => useAutoApply(props), {
			initialProps: makeOptions(),
		})
		await advance(2000) // applied
		rerender(makeOptions()) // later churn: fresh identities, same champion
		await advance(2000)
		expect(api.applyRunes).toHaveBeenCalledTimes(1)
	})

	it("does not apply when unmounted mid-debounce (champ select ended)", async () => {
		const { unmount } = renderHook((props: AutoApplyOptions) => useAutoApply(props), {
			initialProps: makeOptions(),
		})
		await advance(200)
		unmount()
		await advance(2000)
		expect(api.applyRunes).not.toHaveBeenCalled()
	})
})
