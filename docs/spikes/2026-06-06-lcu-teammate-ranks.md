# Spike: teammate ranks via LCU only? — **PASS**

> PRD §6.5 / design §7 Phase 7. Run 2026-06-06 against a live, logged-in League client
> (BR, patch 16.11) with read-only GETs. No Riot API key, no backend.

## Question

Can the app fetch **teammates'** solo-queue ranks purely through the local LCU API,
given the champ-select session exposes `myTeam[].puuid`?

## Result

**Yes.** `GET /lol-ranked/v1/ranked-stats/{puuid}` returns the full ranked payload for
**arbitrary** puuids, not just the local player:

| Probe | Result |
|---|---|
| Self (`current-ranked-stats`) | 200 — GOLD IV, 96 LP |
| Self (by-puuid) | 200 — identical payload |
| **Other player 1** (friend puuid from `/lol-chat/v1/friends`) | 200 — `queueMap.RANKED_SOLO_5x5 = { tier: "GOLD", division: "IV", leaguePoints: 3, isProvisional: false }` |
| **Other player 2** (friend puuid, unranked) | 200 — `{ tier: "", division: "NA", leaguePoints: 0 }` |

## Payload mapping → `RankInfo` (PRD §7)

Source field: `queueMap["RANKED_SOLO_5x5"]`.

| RankInfo | LCU field | Notes |
|---|---|---|
| `tier` | `.tier` | already uppercase (`"GOLD"`); **empty string = unranked → map the whole entry to `null`** |
| `division` | `.division` | `"IV"`; `"NA"` when unranked |
| `lp` | `.leaguePoints` | number |
| `queueType` | constant `"RANKED_SOLO_5x5"` | the key we read from `queueMap` |

Also available if ever needed: `.isProvisional` (PRD §6.5 mentions labeling provisional players;
`wins`/`losses` also present).

## Phase 7 consequences

- **Full-roster mode ships.** The degraded self-only fallback stays as the error path
  (per-puuid failures → `null` → "Unranked"/— in the UI, excluded from spread math), not the primary mode.
- `rank:getForPuuids` (PRD §8) = N parallel GETs in main (5 per champ select); failures
  resolve to `null` per puuid, never reject the whole map.
- Caveat recorded: probed on patch 16.11/BR with friends' puuids (the closest live proxy for
  "arbitrary teammate" outside a queue). Morning checklist re-confirms with a real champ-select
  roster; if Riot ever locks this endpoint down, the fallback path is already wired.
