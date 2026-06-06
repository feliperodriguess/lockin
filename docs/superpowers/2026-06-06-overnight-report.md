# Overnight report — phases 2–8 (2026-06-06, ~03:00–05:20)

> **TL;DR:** All seven phases landed. 40+ granular commits on `integration`, every PRD §8 channel
> real, all four engines live with 35 passing specs, zero `PHASE-1 GLUE` markers left. The rank
> spike **passed** — full-roster mode shipped. Two real bugs were caught by the review machinery
> and fixed before you woke up. Your remaining work: the [live-verification checklist](2026-06-06-live-verification-checklist.md)
> (~20 min with the client), then packaging whenever you're ready (E2 deferred it).

## What landed (per phase)

| Phase | Highlights | Verified overnight by |
|---|---|---|
| **2 — LCU backbone** | `lcu.ts` discovery loop, WS gameflow subscription, process watcher, snapshot-then-stream preload | Live smoke vs your real client (port 61472); 3-lens plan review clean on league-connect usage |
| **3 — Ready check** | Ready-check + champ-select pushes, auto-accept (delay + decline-guard in main), `declineReadyCheck` (D16), typed store + settings persistence (D11), CDP verification harness | Settings round-trip renderer→IPC→disk→restart via CDP; state machine re-traced post-impl; **settings left at defaults (auto-accept off)** |
| **4 — DDragon** | `ddragon.ts` cache-first (Δ refresh-disk-for-next-launch), bundle over IPC, retry hardening, bundle-optional champ select, timer-phase-aware sub-phase | Real fetch (16.11.1, 172 champs), disk cache, cache-hit relaunch, icons in UI |
| **5 — Notes** | Vitest enters; `notes-match.ts` (8 specs); store CRUD + IPC; engine replaces renderer glue | TDD; live CRUD round-trip via CDP incl. restart persistence; **store left empty as found** |
| **6 — Spells + bans** | `spells.ts` + `bans.ts` (16 specs); banlist persistence; hook on both engines | TDD; banlist renumber + disk + real settings-screen screenshot; **banlist restored as found** |
| **7 — Ranks** | Spike **PASS** (committed: `docs/spikes/2026-06-06-lcu-teammate-ranks.md`); `rank.ts` (11 specs); `getRanksForPuuids` with per-puuid degrade; apex display fix | Real rank fetched for a friend (GOLD IV) through the full renderer→IPC→LCU path; bogus puuid degrades to null |
| **8 — Polish + compliance** | Visual pass across 10 switcher states/pages (zero regressions); §14 compliance checklist with grep evidence; completeness critic over every exit criterion | Screenshots inspected; countdown fix verified ticking 1/s |

## Two real bugs the machinery caught (both fixed + verified)

1. **Terminal DDragon error** (Phase 4 plan review): the global `retry: false` QueryClient default would have made a single failed bundle fetch permanent — blank Notes/Settings until relaunch. Fixed: `useDDragon` retries with backoff + champ select became bundle-optional (D15 fallback tiles).
2. **Frozen champ-select countdown** (Phase 8 completeness critic): the real LCU pushes sessions on state changes, **not** 1 Hz — the fake's ticker masked a countdown that would freeze between pushes on the real client. Fixed with renderer-side interpolation (`a9c57d3` + `483f255` — the second commit because biome's `--unsafe` autofix silently broke the first version's deps array; the final pattern is ref-compare, linter-proof, verified ticking `7,7,6,6,5,5,4,4…` at 500ms sampling).

## Judgment calls made on your behalf

- **Never closed your League client** (protecting the logged-in session) — so the disconnect→reconnect cycle is checklist item A, untested overnight.
- **Solo-queue-only ranks** per PRD §6.5 — your own account is flex-ranked only, so you'll see yourself as "Unranked". That's spec-correct; a flex fallback is a product decision for later (noted in the spike doc).
- **§6.1 archetype spell fallbacks** (mid-assassin→Ignite etc.) deliberately deferred — role primaries only, same as the approved Phase-1 glue; documented in the Phase 6 plan + engine comment.
- Δ marks added to the spec where implementation interpreted the PRD (DDragon refresh semantics; rank engine signatures).

## Known small things

- Force-fake (`FAKE API` toggle in the dev switcher) is now the only way to preview ready-check/champ-select states without a queue — real channels win the merge everywhere else. By design (spec §3.2).
- First-ever run while fully offline → Notes/Settings minimal until connectivity (documented limitation, Phase 4 plan).
- Enemy-hover threat lift exists in the engine + tests but real LCU hides enemy intent — live verification covers pick-based lift only.
- During the night, two orphaned Electron helper processes survived several kills and squatted the CDP debug port for ~30 min (cost me a debugging detour around 05:00). Everything was killed clean by the end; if `pnpm dev` ever refuses CDP on 9223, check `lsof -i :9223` for zombies.

## Process artifacts

- Per-phase implementation plans (adversarially reviewed pre-execution, findings applied + committed): `docs/superpowers/plans/2026-06-06-phase-{2..8}-*.md`
- Post-implementation verification: independent agent per phase, all PASS (zero unexplained discrepancies across the run)
- Completeness critic verdict: every design §7 exit criterion + PRD §6 box is **done-verified** or **on the morning checklist**; nothing missing
- [Live-verification checklist](2026-06-06-live-verification-checklist.md) · [Compliance checklist](2026-06-06-compliance-checklist.md) · [Rank spike](../spikes/2026-06-06-lcu-teammate-ranks.md)

## Your next steps

1. Run the live checklist (queue a bot game — ~20 min).
2. Tell me what failed (if anything) — fixes are cheap now.
3. When ready to ship: signing/notarization + `pnpm build:mac` (compliance checklist has the open release-gate items).
