import { api } from "@renderer/api"
import { useEffect, useRef } from "react"

import type { BuildRecommendation, SummonerSpellStatic } from "@/shared/types"

export interface AutoApplyOptions {
	championKey: number | null
	build: BuildRecommendation | null
	spellPair: [SummonerSpellStatic, SummonerSpellStatic] | null
	autoRunes: boolean
	autoSpells: boolean
	championName: string | undefined
	layout: "DF" | "FD"
	flash: (msg: string) => void
}

/** Auto-apply: when opted in and the effective champion changes, debounce ~400ms
 *  (rapid hover shouldn't spam the client) then write spells/runes. Off by
 *  default → this hook makes no calls. Writes go through the already-wired
 *  invoke handlers (api.setSpells / api.applyRunes); no main-process code here. */
export function useAutoApply(options: AutoApplyOptions): void {
	const { championKey, build, autoRunes, autoSpells } = options
	const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
	const lastApplied = useRef<number | null>(null)

	// champ select re-renders ~1 Hz (countdown tick) and on every session push,
	// rebuilding spellPair/flash identities — the pending timer must survive that
	// churn, so it reads the freshest values from here instead of closing over deps
	const latest = useRef(options)
	latest.current = options

	useEffect(() => {
		if (!championKey || !build) return
		// one apply per effective champion: marked when the timer FIRES, so a
		// cancelled-and-rescheduled debounce still applies, while toggle flips and
		// build refetches after a successful apply never overwrite manual tweaks
		if (championKey === lastApplied.current) return
		if (!autoRunes && !autoSpells) return
		if (debounce.current) clearTimeout(debounce.current)
		debounce.current = setTimeout(async () => {
			lastApplied.current = championKey
			const { spellPair, championName, layout, flash } = latest.current
			// spells: write the precedence-RESOLVED pair shown in the panel
			// (pinned > OP.GG > heuristic) — never the raw OP.GG pair. pair[0] is
			// the flash-key slot (shared/lib/spells.ts) and the LCU's spell1Id is
			// always the D slot, so the FD layout writes the pair swapped
			if (autoSpells && spellPair) {
				const [dSpell, fSpell] = layout === "DF" ? spellPair : [spellPair[1], spellPair[0]]
				try {
					await api.setSpells(dSpell.key, fSpell.key)
					flash("Spells applied")
				} catch {
					flash("Couldn't set spells")
				}
			}
			if (autoRunes && build.runes) {
				try {
					const res = await api.applyRunes(build.runes, championName)
					flash(res.ok ? "Runes applied" : (res.error ?? "Couldn't set runes"))
				} catch {
					flash("Couldn't set runes")
				}
			}
		}, 400)
		return () => {
			if (debounce.current) clearTimeout(debounce.current)
		}
	}, [championKey, build, autoRunes, autoSpells])

	useEffect(() => {
		return () => {
			if (debounce.current) clearTimeout(debounce.current)
		}
	}, [])
}
