# Phase 7 — Rank Diff Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-roster team ranks via LCU (spike **PASSED** — `docs/spikes/2026-06-06-lcu-teammate-ranks.md`), the `rank.ts` pure engine (+ specs), and the hook's last `PHASE-1 GLUE` block retired. Exit: PRD §6.5 boxes (live roster render → morning checklist; the rank fetch path is verifiable overnight with real puuids).

**Architecture:** `lcu.ts` gains `getRanksForPuuids` — N parallel read-only GETs to `/lol-ranked/v1/ranked-stats/{puuid}` through the existing resilient `fetchJson` (per-puuid failure → `null`, never rejects the whole map — §6.5 "never blocks champ-select UI"). The raw→`RankInfo` mapper lives in `lcu-mappers.ts` (`queueMap.RANKED_SOLO_5x5`; empty `tier` = unranked → `null`, spike-verified). Scoring/spread/mismatch move to `src/shared/lib/rank.ts`; the renderer's `rank-format.ts` keeps display-only concerns (TIERS colors, `formatRank`) and gets the deferred apex fix (MASTER+ shows no division — LCU reports `"I"`/`"NA"` noise).

**Scoring note (improves on the glue):** ordinal score = `tierIdx * 4 + divisionSteps` (IRON IV = 0 … CHALLENGER = 39). Apex tiers (MASTER+) normalize division to the top step — the glue scored a `division: "NA"` MASTER below a `division: "I"` MASTER; the engine doesn't. Default threshold 8 = two whole tiers (unchanged).

---

### Task 1: `rank.ts` engine (TDD)

**Files:**
- Create: `src/shared/lib/rank.test.ts`
- Create: `src/shared/lib/rank.ts`

- [ ] **Step 1: Write the failing spec**

```ts
import { describe, expect, it } from "vitest"

import type { RankInfo } from "@/shared/types"

import { flagMismatch, isApexTier, rankScore, rankSpread } from "./rank"

const rank = (tier: string, division = "I", lp = 0): RankInfo => ({
	tier,
	division,
	lp,
	queueType: "RANKED_SOLO_5x5",
})

describe("rankScore (§6.5 ordinal scoring)", () => {
	it("scores IRON IV as 0 and CHALLENGER as 39", () => {
		expect(rankScore(rank("IRON", "IV"))).toBe(0)
		expect(rankScore(rank("CHALLENGER"))).toBe(39)
	})

	it("steps by division within a tier", () => {
		expect(rankScore(rank("GOLD", "IV"))).toBe(12)
		expect(rankScore(rank("GOLD", "I"))).toBe(15)
		expect(rankScore(rank("PLATINUM", "IV"))).toBe(16)
	})

	it("returns -1 for unranked/unknown", () => {
		expect(rankScore(null)).toBe(-1)
		expect(rankScore(rank("WOOD", "IV"))).toBe(-1)
	})

	it("normalizes apex divisions (MASTER NA == MASTER I)", () => {
		expect(rankScore(rank("MASTER", "NA"))).toBe(rankScore(rank("MASTER", "I")))
		expect(rankScore(rank("MASTER", "NA"))).toBeGreaterThan(rankScore(rank("DIAMOND", "I")))
		expect(rankScore(rank("GRANDMASTER", "IV"))).toBe(rankScore(rank("GRANDMASTER")))
	})

	it("scores EMERALD in the post-2023 ladder (between PLATINUM and DIAMOND)", () => {
		expect(rankScore(rank("EMERALD", "IV"))).toBe(20)
		expect(rankScore(rank("EMERALD", "IV"))).toBeGreaterThan(rankScore(rank("PLATINUM", "I")))
		expect(rankScore(rank("DIAMOND", "IV"))).toBeGreaterThan(rankScore(rank("EMERALD", "I")))
	})

	it("unknown division scores as the tier floor", () => {
		expect(rankScore(rank("GOLD", "weird"))).toBe(12)
	})
})

describe("rankSpread (§6.5 — unranked excluded)", () => {
	it("is max minus min over ranked players only", () => {
		expect(rankSpread([rank("GOLD", "IV"), rank("DIAMOND", "IV"), null])).toBe(12)
	})

	it("is 0 with fewer than two ranked players", () => {
		expect(rankSpread([rank("GOLD", "IV"), null, null])).toBe(0)
		expect(rankSpread([])).toBe(0)
	})
})

describe("flagMismatch", () => {
	const team = [rank("GOLD", "IV"), rank("DIAMOND", "IV")] // spread 12

	it("flags when spread meets/exceeds the threshold", () => {
		expect(flagMismatch(team, 12)).toBe(true)
		expect(flagMismatch(team, 8)).toBe(true)
		expect(flagMismatch(team, 13)).toBe(false)
	})

	it("never flags on a non-positive threshold (defensive)", () => {
		expect(flagMismatch(team, 0)).toBe(false)
	})
})

describe("isApexTier", () => {
	it("true for MASTER+, false below and for unknown", () => {
		expect(isApexTier("MASTER")).toBe(true)
		expect(isApexTier("GRANDMASTER")).toBe(true)
		expect(isApexTier("CHALLENGER")).toBe(true)
		expect(isApexTier("DIAMOND")).toBe(false)
		expect(isApexTier("")).toBe(false)
	})
})
```

- [ ] **Step 2: Run, watch it fail**

Run: `pnpm test`
Expected: FAIL — `rank.ts` does not exist.

- [ ] **Step 3: Implement**

```ts
import type { RankInfo } from "@/shared/types"

/**
 * Rank scoring (PRD §6.5): tier+division → ordinal (IRON IV = 0 … CHALLENGER
 * = 39) so deltas are comparable. Unranked/unknown → -1 and excluded from the
 * spread. Apex tiers (MASTER+) have no real division — the LCU reports "I" or
 * "NA" — so they normalize to the tier's top step. Pure + deterministic.
 *
 * Supersedes the design §4 shorthand signatures: rankScore takes the whole
 * RankInfo (not tier+div), and the flag helper is singular `flagMismatch`.
 */

const TIER_ORDER = [
	"IRON",
	"BRONZE",
	"SILVER",
	"GOLD",
	"PLATINUM",
	"EMERALD",
	"DIAMOND",
	"MASTER",
	"GRANDMASTER",
	"CHALLENGER",
] as const

const APEX_START = TIER_ORDER.indexOf("MASTER")

const DIV_STEPS: Record<string, number> = { I: 3, II: 2, III: 1, IV: 0 }

export function isApexTier(tier: string): boolean {
	const idx = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number])
	return idx >= APEX_START
}

export function rankScore(rank: RankInfo | null): number {
	if (!rank) return -1
	const tierIdx = TIER_ORDER.indexOf(rank.tier as (typeof TIER_ORDER)[number])
	if (tierIdx < 0) return -1
	if (tierIdx >= APEX_START) return tierIdx * 4 + 3
	return tierIdx * 4 + (DIV_STEPS[rank.division] ?? 0)
}

export function rankSpread(ranks: readonly (RankInfo | null)[]): number {
	const scores = ranks.map(rankScore).filter((s) => s >= 0)
	if (scores.length < 2) return 0
	return Math.max(...scores) - Math.min(...scores)
}

export function flagMismatch(ranks: readonly (RankInfo | null)[], threshold: number): boolean {
	if (threshold <= 0) return false
	return rankSpread(ranks) >= threshold
}
```

- [ ] **Step 4: Run, watch it pass**

Run: `pnpm test`
Expected: all green (all prior engine specs + the new rank specs).

- [ ] **Step 5: Typecheck + format, commit**

```bash
pnpm typecheck && pnpm format
git add src/shared/lib/rank.ts src/shared/lib/rank.test.ts
git commit -m "feat(shared): rank engine + vitest spec (§6.5)"
```

---

### Task 2: Rank fetch in main (`getRanksForPuuids`)

**Files:**
- Modify: `src/main/lcu-mappers.ts`
- Modify: `src/main/lcu.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Mapper (append to `src/main/lcu-mappers.ts`)**

Add `RankInfo` to the shared-types type import, then:

```ts
export interface RawRankedStats {
	queueMap?: Record<string, { tier?: string; division?: string; leaguePoints?: number }>
}

/** Spike-verified (docs/spikes/2026-06-06-lcu-teammate-ranks.md): empty tier = unranked → null. */
export function toRankInfo(raw: RawRankedStats): RankInfo | null {
	const solo = raw.queueMap?.RANKED_SOLO_5x5
	if (!solo?.tier) return null
	return {
		tier: solo.tier,
		division: solo.division ?? "NA",
		lp: solo.leaguePoints ?? 0,
		queueType: "RANKED_SOLO_5x5",
	}
}
```

- [ ] **Step 2: Service method (in `src/main/lcu.ts`, after `setChampSelect`)**

Extend the mapper import with `type RawRankedStats, toRankInfo` and the types import with `RankInfo`, then add to the class:

```ts
	/** §6.5: per-puuid failures → null — ranks degrade, never block champ select. */
	async getRanksForPuuids(puuids: string[]): Promise<Record<string, RankInfo | null>> {
		const out: Record<string, RankInfo | null> = {}
		const credentials = this.credentials
		const targets = puuids.filter(Boolean)
		if (!credentials) {
			for (const puuid of targets) out[puuid] = null
			return out
		}
		await Promise.all(
			targets.map(async (puuid) => {
				const raw = await this.fetchJson<RawRankedStats>(
					`/lol-ranked/v1/ranked-stats/${puuid}`,
					credentials,
				)
				out[puuid] = raw ? toRankInfo(raw) : null
			}),
		)
		return out
	}
```

And the module-level export (after `declineReadyCheck`):

```ts
export async function getRanksForPuuids(
	puuids: string[],
): Promise<Record<string, RankInfo | null>> {
	if (!service) return Object.fromEntries(puuids.filter(Boolean).map((p) => [p, null]))
	return service.getRanksForPuuids(puuids)
}
```

(Disconnected/absent service → all-null map, not a rejection — same degrade-don't-block rule.)

- [ ] **Step 3: IPC handler (append to `src/main/ipc.ts`)**

Extend the lcu import with `getRanksForPuuids`, then:

```ts
ipcMain.handle(IPC.RANK_GET_FOR_PUUIDS, (_event, puuids: string[]) => getRanksForPuuids(puuids))
```

- [ ] **Step 4: Bridge channel (add to the `api` object in `src/preload/index.ts`)**

```ts
	getRanksForPuuids: (puuids) => ipcRenderer.invoke(IPC.RANK_GET_FOR_PUUIDS, puuids),
```

- [ ] **Step 5: Typecheck + format, commit**

```bash
pnpm typecheck && pnpm format
git add src/main/lcu-mappers.ts src/main/lcu.ts src/main/ipc.ts src/preload/index.ts
git commit -m "feat: real rank:getForPuuids — parallel LCU ranked-stats with per-puuid degrade (§6.5)"
```

---

### Task 3: Renderer — engine swap + apex display fix

**Files:**
- Modify: `src/renderer/src/hooks/use-champ-select.ts`
- Modify: `src/renderer/src/lib/rank-format.ts`

- [ ] **Step 1: Swap the last glue block in `use-champ-select.ts`**

Replace the import `import { rankScore } from "@renderer/lib/rank-format"` with nothing (it becomes unused), add `import { flagMismatch } from "@/shared/lib/rank"` (biome sorts), and replace:

```ts
		// PHASE-1 GLUE — replaced by src/shared/lib/rank.ts in Phase 7
		const scores = team.map((t) => rankScore(t.rank)).filter((s) => s >= 0)
		const spread = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0
		const mismatch = ranksAvailable && spread >= (settings?.rankDiffThreshold ?? 8)
```

with:

```ts
		const mismatch =
			ranksAvailable &&
			flagMismatch(
				team.map((t) => t.rank),
				settings?.rankDiffThreshold ?? 8,
			)
```

- [ ] **Step 2: `rank-format.ts` — drop the glue, fix apex display**

Replace the `rankScore` function and the TODO comment + `formatRank` with:

```ts
import { isApexTier } from "@/shared/lib/rank"
```

(at top, after the existing import) and:

```ts
export function formatRank(rank: RankInfo | null): string {
	if (!rank || !TIERS[rank.tier]) return "Unranked"
	if (isApexTier(rank.tier)) return TIERS[rank.tier].label // LCU division is "I"/"NA" noise
	return `${TIERS[rank.tier].label} ${rank.division}`
}
```

Delete the exported `rankScore` (engine owns scoring now) and the `DIV_NUM` constant if unused. Check for other `rankScore` importers first: `grep -rn "from \"@renderer/lib/rank-format\"" src/` — only `use-champ-select.ts` (already updated) and any component importing `TIERS`/`formatRank` (keep those).

- [ ] **Step 3: Typecheck + format + test, commit**

```bash
pnpm typecheck && pnpm format && pnpm test
git add src/renderer/src/hooks/use-champ-select.ts src/renderer/src/lib/rank-format.ts
git commit -m "feat(renderer): rank mismatch via the rank engine; apex tiers render without division"
```

---

### Task 4: Live smoke — real rank fetch end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Boot**

Run (background): `ELECTRON_ENABLE_LOGGING=1 pnpm dev > /tmp/lockin-phase7-smoke.log 2>&1`, wait for `[lcu] status: connected`.

- [ ] **Step 2: Real ranks through the full path (renderer → IPC → LCU)**

Use the spike's known puuids — self (GOLD IV), a ranked friend (GOLD IV), an unranked friend, plus a blank to confirm filtering:

```bash
node scripts/cdp.mjs eval 'window.api.getRanksForPuuids(["21126cd9-4102-502e-b9ab-4023315523c6", "0025a82b-a624-5d72-be51-435b9f9c6c32", "01994359-2948-5df2-b553-1687a49ca401", ""])'
```

Expected: self + friend 1 → `{ tier: "GOLD", division: "IV", lp: <n>, queueType: "RANKED_SOLO_5x5" }`; unranked friend → `null`; blank puuid absent from the map; no rejection.

- [ ] **Step 3: Bogus puuid degrades, never rejects**

```bash
node scripts/cdp.mjs eval 'window.api.getRanksForPuuids(["00000000-0000-0000-0000-000000000000"])'
```

Expected: `{ "00000000-...": null }` (LCU 404/error → null via fetchJson).

- [ ] **Step 4: Kill, record evidence**

Stop the app, no orphans, excerpts → morning notes. Live §6.5 boxes (roster renders with ranks during a real champ select, mismatch flag) → morning checklist.
