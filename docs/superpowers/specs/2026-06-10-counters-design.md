# Counters — design spec

**Date:** 2026-06-10
**Status:** Approved by Felipe (brainstorming session)
**Depends on:** the OP.GG build-recommendations pipeline on `feat/build-guidance-auto-setup` (`src/main/build-recommendations/`). Implementation stacks on that branch.

## Summary

Surface champion counter statistics during champ select and in-game, powered by counter
data the OP.GG MCP already returns (and the current normalizer discards). Three user-facing
pieces, one shared data layer:

1. **Counter-pick assist** — while your lane opponent is visible and you haven't locked,
   show the champions that statistically beat them, your mains first.
2. **Matchup difficulty meter** — once both laners are known, a compact pill
   (`Hard · 46.8% WR · 12.4k games`) in champ select and on the In-Game screen.
3. **Ban radar** — the existing ban-suggestions section, renamed, with "counters you"
   badges on your listed champs and a small statistical group of counters you don't track.

No new external dependency, no new compliance surface: same keyless OP.GG MCP endpoint,
main-process-only, disk-cached, suggestions only (no auto-ban — PRD §14 unchanged).

## Data layer

### Source

`lol_get_champion_analysis` on `https://mcp-api.op.gg/mcp` exposes per-champion counter
arrays via `desired_output_fields`:

- `data.strong_counters[].{champion_id, champion_name, play, win, win_rate}`
- `weak_counters` (same shape; named in the tool description)

Counter fetches request **only** these fields plus minimal summary — no build payload.

### Shared types (`src/shared/types.ts`)

```ts
export interface CounterEntry {
	championId: number
	winRate: number // 0..1, ALWAYS from the table-owner champion's perspective
	games: number
}

export interface CounterTable {
	championKey: number
	role: Role
	patch: string
	weakAgainst: CounterEntry[] // champions that beat this champion; worst matchup first
	strongAgainst: CounterEntry[] // champions this champion beats; best matchup first
}
```

### Win-rate perspective (landmine)

OP.GG's `win_rate` inside `weak_counters`/`strong_counters` has an ambiguous perspective.
During implementation, verify against the OP.GG website for a known lopsided matchup
(e.g. Malphite vs Yasuo top). The normalizer converts at ingestion so `CounterEntry.winRate`
is **always from the table-owner's perspective**; a fixture test pins the direction so it
cannot silently regress.

### Main process (`src/main/build-recommendations/`)

- Add `getCounters(championKey: number, position: Role, tier?: string): Promise<CounterTable | null>`
  to the `BuildRecommendationProvider` interface; implement in `OpggProvider` reusing the
  existing JSON-RPC/SSE client and 12 s timeout.
- New `opgg-counters-normalize.ts` + captured real response in `__fixtures__/`, with vitest
  coverage following the existing normalizer-test pattern.
- Disk cache via the existing `withCache` machinery, key
  `counters|{championKey}|{role}|{tier}|{patch}` — patch-keyed invalidation like builds.
- Tier reuses `settings.buildTier`.

### IPC + renderer

- Channel `counters:get` (`IPC.COUNTERS_GET`) → handler in `src/main/ipc.ts` → preload
  `api.getCounters(championKey, position, tier?)` → typed in `src/shared/api.ts`.
- Hook `useCounterTable(championKey: number | null, position: Role | null, tier?: string)`:
  TanStack Query, `staleTime: Infinity`, `enabled` only when champion + position known.
- Failure/timeout → `null` → consuming UI hides. Identical contract to builds; never crashes.

### Fetch volume

At most two tables per champ select: the **enemy laner's** (counter-pick assist + difficulty)
and **your hovered/picked champ's** (Ban radar + difficulty fallback). Both disk-cached, so
repeat matchups across games cost nothing.

## Champ select UI

### Counter-pick assist — `CounterPicksRegion`

New left-column section between `RecommendationPanel` and `NotesRegion`.

**Visibility — all of:**
- gameflow phase is champ select, during pick phase
- enemy laner identified (pick or hover), via the existing opponent matching in
  `useChampSelect()`
- you have **not** locked (`me.championId === 0`)

The moment you lock, the region disappears — the decision is made.

**Content** — header `Counter picks · vs <Enemy>`, then up to two rows of champion
portraits (DDragon icons, same visual language as Your Mains), each labeled with its
**displayed winrate** into the enemy. Since `CounterEntry.winRate` is from the table
owner's (the enemy's) perspective, the displayed value is `1 − entry.winRate`:

- **Your picks** — your mains for the role that appear in the enemy's `weakAgainst`,
  sorted by displayed winrate desc. Row hidden if none qualify.
- **Best overall** — top 5 (constant) of the enemy's `weakAgainst` by displayed winrate.

Enemy hidden, fetch failed, or no data → region absent.

### Matchup difficulty pill

Compact pill in the `NotesRegion` header next to the opponent name:
`Hard · 46.8% WR · 12.4k games`.

- **Classification (your perspective):** ≥ 52% Easy · 48–52% Even · < 48% Hard.
- **Low data:** under 200 games (constant) → "Low data", neutral styling.
- **Lookup order:** your champ in the enemy's table (your WR = `1 − entry.winRate`) →
  enemy in your champ's table (your WR = `entry.winRate` directly) → found in neither →
  `Even · no counter data` (no invented numbers).

### Ban radar (rename of "Ban Suggestions")

- Section renamed to **"Ban radar"**.
- When your champion is hovered/picked: ban-list entries appearing in your champ's
  `weakAgainst` get a **"counters you" badge** with winrate (same visual pattern as the
  existing "threat" badge) and lift toward the top, alongside existing threat behavior.
- Below the personal list, a visually separated **statistical group**: top 3 champs
  (constant) from your `weakAgainst` not already on your list. Deduped against the
  personal list.
- Suggestions only. **No auto-ban, ever** (PRD §14).

## In-game

### Opponent carry-over (main process)

- On gameflow transition ChampSelect → InProgress, snapshot
  `{ opponentChampionId, assignedPosition }` from the just-watched session.
- Extend `InGameState` with `opponentChampionId: number | null` and
  `assignedPosition: Role | null`; include in the `lcu:inGame` push payload.
- Clear the snapshot when the phase resets (None/Lobby).
- App restarted mid-game → no snapshot → In-Game screen renders exactly as today.

### In-Game screen changes

- Difficulty pill in the "Your note" header (`vs <Opponent> · Hard · 46.8%`).
- Note resolution receives `opponentChampionId`, so **opponent-specific notes now match
  in-game** (today only general notes effectively match).
- Side fix: build recommendation uses the carried `assignedPosition` when present instead
  of the champion's default-lane inference (fixes e.g. off-role builds like Lulu top
  showing support builds).

## Error handling (one rule)

Counters are decoration, never load-bearing:

| Condition | Behavior |
| --- | --- |
| Fetch failure / 12 s timeout | `null` → region/pill/badges absent |
| No assigned position (blind pick) | existing `championLane()` inference |
| ARAM / queues without lane opponents | opponent never matches → counter UI never appears |
| Matchup sample < 200 games | "Low data", neutral styling |
| App restart mid-game | no carry-over → In-Game screen as today |

## Testing & verification

- **Vitest** (existing fixture pattern in `src/main/build-recommendations/`):
  - counters normalizer against a captured real MCP response
  - win-rate **perspective-pinning** test
  - difficulty classification thresholds + low-data boundary
  - Ban radar merge logic: badging, statistical group, dedupe vs personal list
- `pnpm typecheck` + `pnpm format`.
- **Visual verification:** cdp.mjs force-fake harness + Playwright MCP, with fake fixtures
  extended to include counter tables — cover assist visible/hidden, all pill variants,
  Ban radar groups, and in-game carry-over without a live League client.

## Out of scope

- Full in-game enemy-team threat board (only the lane opponent carries over).
- Any auto-action on counters (auto-ban/auto-pick — forbidden by PRD §14).
- Counter data sources other than the existing OP.GG MCP.
- ARAM/special modes.
