# lockin v1 — Implementation Design

> **Status:** Approved 2026-06-05 (brainstorm with Felipe).
> **Scope:** Cross-cutting implementation decisions for all of v1. One implementation plan per phase gets written from this doc as each phase is reached, starting with Phase 1.
> **Authority:** `PRD.md` governs behavior/data/IPC; `lockin-design-handoff/` governs visuals; this doc locks the implementation decisions that bridge them. Where this doc deviates from either, the deviation is explicit and marked **Δ**.

## 1. Decisions log

| # | Decision | Ruling |
|---|---|---|
| D1 | Planning slicing | One design doc (this), then a detailed implementation plan **per phase**, written when the phase is reached |
| D2 | Note items divergence | **PRD strict.** `MatchupNote` has `pinnedSpells` only. No item picker in the note editor, no ItemRow in champ select (prototype shows them; we drop them) |
| D3 | Champ-select layout | **Rail only** (`champ-select.jsx` rail branch — the saved tweak default). Stacked/hero variants are not built |
| D4 | Testing | **Vitest for pure logic only** (the four engines). No component tests. UI verified by `pnpm typecheck` + Playwright MCP visual passes |
| D5 | Mock seam | **Fake `window.api` behind the real contract** (see §3). Hooks/providers written once against the production `Api` interface |
| D6 | Client state | **No Zustand.** Plain React context (`LcuProvider`, two churn-split contexts). Zustand is the escape hatch only if re-render pressure or prop drilling demands it. CLAUDE.md's state-ownership paragraph gets updated to match (Phase 1 housekeeping) |
| D7 | Phase 1 scope | **Strictly UI + mock data + dev switcher.** No logic engines, no tests in Phase 1; scenario states come from pre-baked fixture variants |
| D8 | Routes | Stay `/`, `/notes`, `/settings` (CLAUDE.md + scaffold win over PRD §3.1's `/live`) |
| D9 | Notes search | Renderer-side filtering over `notes:list` (PRD §8 has no search channel; champion-name search needs the DDragon bundle, which the renderer holds) |
| D10 | Engine placement | Pure functions in `src/shared/lib/`, computed **renderer-side** in hooks. Resolves the PRD §5-diagram vs §8-contract discrepancy: no spell/ban IPC channels exist, and the renderer holds all inputs |
| D11 | Settings persistence timing | **Δ** Pulled forward from PRD §15 Phase 8 to **Phase 3** — auto-accept needs a persisted setting |
| D12 | Champ-select session push timing | **Δ** Lands in **Phase 3** (the phase/dodge timer reads `session.timer`); full session rendering remains Phase 4 |
| D13 | Fonts | Bundled locally (Poppins, JetBrains Mono). No Google Fonts at runtime |
| D14 | Design tweaks | Locked: accent crimson `#f5003d` set, density "cozy", rail layout. The prototype's tweaks panel is a design-tool artifact, **not** app UI |
| D15 | Icons | Champion/spell icons hotlink from DDragon CDN by URL; handoff's tinted fallback tiles cover loading/offline/unresolvable states |
| D16 | Ready-check decline | **Contract addition.** §6.4 requires working manual Accept/Decline and "respect the decline", but §8 lists no decline channel. Add `declineReadyCheck(): Promise<void>` to the Api (LCU: `POST /lol-matchmaking/v1/ready-check/decline`). Fake in Phase 1; real in Phase 3 |

## 2. Module & file layout

Main process stays flat (CLAUDE.md: `ipc.ts` = all invoke handlers, `store.ts` = all persistence).

```
src/
  main/
    index.ts        window/lifecycle (exists)
    ipc.ts          ALL invoke handlers
    store.ts        electron-store schema + typed accessors: settings, notes, banlist
    lcu.ts          LcuService: league-connect auth, WS subscriptions, retry/backoff,
                    pushes the 4 lcu:* events to the renderer
    ddragon.ts      version resolve → fetch → normalize → DDragonBundle, disk cache
    tray.ts         (exists)
  preload/
    index.ts        real bridge implementing the shared Api interface (grows per phase)
  shared/
    types.ts        ALL PRD §7 types (LCU subset + domain + settings)
    constants.ts    IPC channel names
    api.ts          the `Api` interface — THE contract; real preload and fake both implement it
    lib/            pure engines (zero deps, deterministic, vitest-covered):
                    spells.ts · notes-match.ts · bans.ts · rank.ts
  renderer/src/
    api/
      index.ts      getApi() source selection (progressive merge + force-fake flag)
      fake/         fake bridge, typed fixtures (data.js content RETYPED to PRD §7
                    shapes — mock data flows through the real types), scenarios
    providers/      LcuProvider (push subscriptions → context), QueryClient setup
    hooks/          useLcuStatus, usePhase, useReadyCheck, useChampSelectSession,
                    useChampSelect (composite view-model), useNotes, useSettings,
                    useDDragon, useBanlist, useTeamRanks
    components/
      app/          shell: sidebar, window frame, connection indicator
      champ-select/ rail layout parts
      ready-check/  countdown + accept/decline
      notes/        library, editor
      settings/     groups + ban-list editor
      dev/          state switcher (DEV-only)
      ui/           shadcn primitives (exists)
    pages/          home (live) / notes / settings (exist, get real content)
    routes.tsx      (exists)
```

## 3. Data-layer seam

### 3.1 The contract

`src/shared/api.ts` defines one `Api` interface mirroring PRD §8 exactly — 10 invoke methods + 4 push subscriptions:

```ts
type Unsubscribe = () => void

interface Api {
  // invokes → TanStack Query
  acceptReadyCheck(): Promise<void>                              // mutation
  declineReadyCheck(): Promise<void>                             // mutation (D16)
  getDDragonBundle(): Promise<DDragonBundle>                     // query ['ddragon'], staleTime Infinity
  getSettings(): Promise<AppSettings>                            // query ['settings']
  setSettings(p: Partial<AppSettings>): Promise<AppSettings>     // mutation → invalidate ['settings']
  listNotes(): Promise<MatchupNote[]>                            // query ['notes']
  upsertNote(n: Partial<MatchupNote>): Promise<MatchupNote>      // mutation → invalidate ['notes']
  deleteNote(id: string): Promise<void>                          // mutation → invalidate ['notes']
  getBanList(): Promise<BanListEntry[]>                          // query ['banlist']
  setBanList(e: BanListEntry[]): Promise<BanListEntry[]>         // mutation → invalidate ['banlist']
  getRanksForPuuids(p: string[]): Promise<Record<string, RankInfo | null>>  // query ['ranks', hash]
  // pushes → LcuProvider context (never into the Query cache)
  onLcuStatus(cb: (s: { connected: boolean }) => void): Unsubscribe
  onGameflowPhase(cb: (p: { phase: GameflowPhase }) => void): Unsubscribe
  onReadyCheck(cb: (r: ReadyCheck | null) => void): Unsubscribe
  onChampSelect(cb: (s: ChampSelectSession | null) => void): Unsubscribe
}
```

### 3.2 Source selection — progressive override merge

`getApi()` returns `{ ...fakeBridge, ...window.api }`. The real preload bridge only exposes channels that are actually implemented, so each integration phase makes real channels win key-by-key while unimplemented ones keep answering from the fake.

- A dev-only **force-fake flag** (localStorage, surfaced in the state switcher) routes the full fake even when real channels exist — any scenario stays previewable without a running client, forever.
- The fake is `import.meta.env.DEV`-gated behind a dynamic import; production builds tree-shake it.

### 3.3 Client state — plain React, no Zustand

`LcuProvider` at the root subscribes to the 4 push channels exactly once, holds them in a `useReducer`, and exposes **two context values split by churn rate**:

- `{ connected, phase }` — sidebar dot, window frame, route-level view switch (changes a few times per queue)
- `{ readyCheck, champSelect }` — live page (changes every WS push during champ select)

Context is required regardless of preference: pages render through TanStack Router's `Outlet`, so no props path exists from shell to route components. Components consume via tiny hooks (`useLcuStatus()`, `usePhase()`, `useReadyCheck()`, `useChampSelectSession()`).

### 3.4 Hooks

Components never touch `getApi()` — only hooks. Query hooks wrap invokes with the keys above; mutations invalidate their key (PRD §8.1). `useChampSelect()` is the one composite hook: it derives the champ-select view-model (my champion, role, enemy picks, timer, spell recommendation, matched notes, ban suggestions, rank flags) from session context + Query data. In Phase 1 its internals map fixture payloads near-1:1; engines slot in at Phases 5–7 without touching components.

## 4. Pure logic engines (Phases 5–7)

Rules: live in `src/shared/lib/`, zero dependencies (types only), no `Date.now()`/IO — fully deterministic. Each ships with vitest specs **in the phase it lands**. Vitest enters as a devDependency at Phase 5 with a `pnpm test` script.

| Module | Signature (shape) | Spec | Phase |
|---|---|---|---|
| `notes-match.ts` | `matchNotes(notes, myChampionId, enemyChampionIds) → MatchupNote[]` | §6.2 — general + opponent-specific, most-recently-updated first | 5 |
| `spells.ts` | `recommendSpells({ role, settings, pinnedNote }) → { pair, source: 'heuristic'\|'pinned', rolePending }` | §6.1 — Flash slot per D/F layout, role table, fallbacks, pinned wins | 6 |
| `bans.ts` | `suggestBans(banlist, session) → { entries: [{ entry, status, threat }], allGone }` | §6.3 — exclude banned/picked, lift visible threats | 6 |
| `rank.ts` | `rankScore(tier, div)` · `rankSpread(team)` · `flagMismatches(team, threshold)` | §6.5 — ordinal scoring, unranked excluded from spread | 7 |

## 5. UI strategy

### 5.1 Theme

Port the handoff's `tokens.css` (ink scale, crimson accent set, fonts, easings, durations) into `global.css` as Tailwind v4 `@theme` tokens, replacing the default shadcn oklch block. **Alias the shadcn semantic vars** (`--background`, `--accent`, …) to handoff tokens so existing `ui/` primitives pick up the look automatically.

### 5.2 Screen ↔ handoff mapping

Match visual output; don't copy prototype structure. Drop prototype-only artifacts: tweaks panel, item chips/pickers (D2), stacked/hero layouts (D3), unused settings state keys (`alwaysOnTop`/`launchOnLogin`/`locale` exist in `app.jsx` state but are never rendered — PRD §2.2 excludes them anyway).

| App | Handoff source |
|---|---|
| Shell: sidebar (Live/Notes/Settings + connection dot + phase sub-label), window frame w/ `hiddenInset` drag region — replaces scaffold's temporary top-nav | `app.jsx` Sidebar/WindowFrame |
| `/` Live: Disconnected · Idle · Ready Check · Champ Select (rail) | `live-view.jsx`, `champ-select.jsx` (rail branch), `champ-select-parts.jsx`, `champ-art.jsx` |
| `/notes`: library (search, list) + editor (champion, opponent, body, pinned spells) | `notes.jsx` |
| `/settings`: Match group (auto-accept + delay) · Champ-select group (D/F keys, rank sensitivity) · ban-list editor (add/reorder/remove/reason) | `settings.jsx` |

shadcn primitives reused where they fit; missing ones pulled via CLI and restyled. Bespoke pieces (`RankEmblem`, `SpellIcon`, `ChampionPortrait`, `ThreatBadge`, `Eyebrow`, …) live under their feature folders. ~300-line component cap, semantic HTML (CLAUDE.md).

### 5.3 Dev state switcher

The prototype's `DemoBar`, rebuilt as `components/dev/state-switcher.tsx`, rendered only when `import.meta.env.DEV`. Drives the fake bridge's scenario state: client phase (disconnected/idle/ready/select) · CS sub-phase (ban/pick) · enemy hidden/shown · ranks ok/missing · note has/none · role set/pending · auto-accept fired · force-fake toggle. The fake bridge **ticks timers** (ready-check countdown, champ-select phase timer) so countdown UI is genuinely exercised without a client.

## 6. Edge handling

Each lands with its owning phase; most are previewable via the switcher.

- Champ select **never crashes** on unresolvable champion/spell IDs → fallback tile + name placeholder (D15).
- Disconnected keeps Notes/Settings fully usable; LCU reconnects with backoff and resubscribes cleanly (PRD §9).
- DDragon: serve disk cache when offline; background-refresh on patch change; no cache + offline → fallback tiles.
- Ready check vanish/race → clear state on `null` push, no stuck UI.
- Auto-accept fires only while `playerResponse === "None"`; a manual decline is never overridden (guard lives in main).
- Timer `isInfinite` → hide countdown. Role unassigned → defaults + "role pending" hint. Enemy hidden → general notes now, opponent-specific notes on reveal.

## 7. Phase map

One implementation plan per phase, written when the phase is reached. Exit criteria reference PRD §6 acceptance boxes.

| Plan | Scope | Exit criteria |
|---|---|---|
| **1 — UI on mock data** | Theme port; shared types + `Api` contract; fake bridge + typed fixtures (`data.js` content retyped to PRD §7 shapes) + scenario variants; shell + all screens (rail CS); dev switcher; CLAUDE.md state-ownership housekeeping (D6) | Looks/navigates like the design on fake data; every switcher state renders; `pnpm typecheck` + `pnpm format` clean |
| **2 — LCU backbone** | `lcu.ts` connect/retry/backoff; status + phase subscriptions; first real preload channels; progressive merge live | Disconnected/Idle react to the real client |
| **3 — Ready check + timers** | Ready-check push + auto-accept (delay, decline-guard); **Δ** settings persistence (D11); **Δ** session push for `session.timer` (D12) | §6.4 boxes |
| **4 — DDragon + CS data** | `ddragon.ts` fetch/normalize/disk-cache/offline; real session rendering (champs, roles, teams, picks/bans) | Real champ select renders from a live client |
| **5 — Notes** | Notes CRUD in `store.ts` + IPC; library + inline editor wired; `notes-match.ts` + vitest enters | §6.2 boxes |
| **6 — Spells + bans** | `spells.ts` + `bans.ts` + tests; banlist persistence; settings screen + ban editor wired | §6.1 + §6.3 boxes |
| **7 — Rank spike → feature** | Spike: teammate ranks via LCU only? Result committed to repo; `rank.ts` + tests; full roster ranks or degraded self-only mode | §6.5 boxes |
| **8 — Polish + packaging** | Final visual pass vs screenshots (all states); `.dmg` via electron-builder; signing + notarization; PRD §14 compliance release-gate checklist | Shippable build |

## 8. Out of scope (v1, confirmed)

Everything in PRD §2.2, plus the rulings above: no item pins on notes (D2), no stacked/hero layouts (D3), no component tests (D4), no Zustand (D6), no always-on-top / launch-on-login / locale settings, no auto-anything beyond ready-check accept (off by default).
