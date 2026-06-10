import { describe, expect, it } from "vitest"

import { normalizeItems, normalizeRunes } from "./ddragon-normalize"

describe("normalizeRunes (runesReforged.json → runesById)", () => {
	const styles = [
		{
			id: 8000,
			key: "Precision",
			name: "Precision",
			icon: "perk-images/Styles/7201_Precision.png",
			slots: [
				{
					runes: [
						{
							id: 8005,
							key: "PressTheAttack",
							name: "Press the Attack",
							icon: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
						},
						{
							id: 8021,
							key: "FleetFootwork",
							name: "Fleet Footwork",
							icon: "perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png",
						},
					],
				},
			],
		},
		{
			id: 8100,
			key: "Domination",
			name: "Domination",
			icon: "perk-images/Styles/7200_Domination.png",
			slots: [
				{
					runes: [
						{
							id: 8112,
							key: "Electrocute",
							name: "Electrocute",
							icon: "perk-images/Styles/Domination/Electrocute/Electrocute.png",
						},
					],
				},
			],
		},
	]

	it("flattens styles + slots + runes into an id-keyed map", () => {
		const byId = normalizeRunes(styles)
		expect(Object.keys(byId)).toHaveLength(3)
		expect(byId[8005]).toEqual({
			id: 8005,
			key: "PressTheAttack",
			name: "Press the Attack",
			icon: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
		})
		expect(byId[8112].name).toBe("Electrocute")
	})

	it("returns an empty map for empty input", () => {
		expect(normalizeRunes([])).toEqual({})
	})
})

describe("normalizeItems (item.json data → itemsById)", () => {
	const data = {
		"1001": { name: "Boots", image: { full: "1001.png" } },
		"3006": { name: "Berserker's Greaves", image: { full: "3006.png" } },
	}

	it("maps numeric ids to {id,name,imageFull}", () => {
		const byId = normalizeItems(data)
		expect(byId[1001]).toEqual({ id: 1001, name: "Boots", imageFull: "1001.png" })
		expect(byId[3006].name).toBe("Berserker's Greaves")
	})

	it("derives imageFull from the id when image.full is missing", () => {
		const byId = normalizeItems({ "2003": { name: "Health Potion" } })
		expect(byId[2003].imageFull).toBe("2003.png")
	})

	it("skips non-numeric keys", () => {
		const byId = normalizeItems({ foo: { name: "Bad" } })
		expect(Object.keys(byId)).toHaveLength(0)
	})
})
