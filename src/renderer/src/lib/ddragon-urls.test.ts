import { describe, expect, it } from "vitest"

import {
	champIconUrl,
	itemIconUrl,
	profileIconUrl,
	runeIconUrl,
	spellIconUrl,
} from "./ddragon-urls"

const V = "14.10.1"
const CDN = "https://ddragon.leagueoflegends.com/cdn"

describe("ddragon url helpers", () => {
	it("builds champion + spell urls (existing)", () => {
		expect(champIconUrl(V, "Aatrox.png")).toBe(`${CDN}/${V}/img/champion/Aatrox.png`)
		expect(spellIconUrl(V, "SummonerFlash.png")).toBe(`${CDN}/${V}/img/spell/SummonerFlash.png`)
	})

	it("builds an item icon url from a numeric id (version-pathed)", () => {
		expect(itemIconUrl(V, 3006)).toBe(`${CDN}/${V}/img/item/3006.png`)
	})

	it("builds a profile-icon url from a numeric id (version-pathed)", () => {
		expect(profileIconUrl(V, 4567)).toBe(`${CDN}/${V}/img/profileicon/4567.png`)
	})

	it("builds a rune icon url from a perk icon path (NOT version-pathed)", () => {
		expect(runeIconUrl("perk-images/Styles/Precision/Conqueror/Conqueror.png")).toBe(
			`${CDN}/img/perk-images/Styles/Precision/Conqueror/Conqueror.png`,
		)
	})
})
