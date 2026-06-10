# Design: Build guidance, auto rune/spell setup, In-Game screen, tray, and polish

> **Status:** Approved (design phase). Source of truth for the implementation plan.
> **Date:** 2026-06-10
> **Scope:** Five features for the `lockin` Electron companion, plus the shared plumbing they need.

---

## 1. Summary & goals

Five features, in one cohesive pass:

1. **Responsive champ select + auto rune/spell setup.** The app reflects the champion you *hover* (no lock-in needed) and, when opted in, automatically applies the recommended **runes** and **summoner spells** to the client — the way Blitz/op.gg do.
2. **In-Game screen + champ-select "mains."** A new `InProgress` view (reusing the champ-select shell) that adds **recommended item build** and **skill (ability) order** below the notes; and a **"Your mains"** section that fills the dead space in the champ-select notes column.
3. **Sidebar identity.** Show the player's **nickname + avatar** in the sidebar footer when the client is connected.
4. **Tray.** A rich native macOS tray menu: auto-accept checkbox + global shortcut, nickname/status, start ranked/flex queue, new note, open, quit.
5. **Copy pass.** Rewrite user-facing copy to sound human (remove em dashes, drop the "marketing-AI" voice).

This requires a **deliberate scope change** to the PRD (see §3): adding an external recommendation source and expanding the set of automated client writes.

---

## 2. The data-source decision (settled, evidence-based)

DDragon and CommunityDragon are **catalog only** — they define what each rune/item/ability *is*, never what's *good* for champion X in role Y. Per-champ/per-role recommendations require an aggregated stats source. Live probes (2026-06-10):

| Source | Probe result | Verdict |
|---|---|---|
| U.GG static JSON (`stats2.u.gg`) | `403` Cloudflare JS challenge | Dead to plain/Electron fetch |
| Lolalytics `mega` (`a1.lolalytics.com`) | `200`, but undocumented/drifting params (`invalid end point` on guessed params) | Fragile fallback only |
| **OP.GG MCP (`mcp-api.op.gg/mcp`)** | `200`, **keyless**, full build payload confirmed | **Chosen** |

**Decision: OP.GG MCP, behind a swappable `BuildRecommendationProvider` interface, disk-cached per (champion, role, patch).** Lolalytics may be added later as a fallback adapter; U.GG is not viable.

### 2.1 OP.GG provider details (verified)

- **Transport:** HTTP `POST https://mcp-api.op.gg/mcp`, JSON-RPC 2.0.
  Headers: `content-type: application/json`, `accept: application/json, text/event-stream`.
  No MCP SDK or session handshake needed for a stateless `tools/call`.
- **Primary tool:** `lol_get_champion_analysis`.
  - Required args (all must be present together, or the result is empty): `game_mode` (`"ranked"`), `champion` (DDragon name, e.g. `"Aatrox"`), `position` (`TOP|JUNGLE|MID|ADC|SUPPORT` — confirm `ADC`/`SUPPORT` spelling during impl), `lang` (`"en_US"`), `tier` (`"emerald_plus"` default; `"platinum_plus"`, `"all"`, etc.).
  - `desired_output_fields` (optional) trims the payload.
- **Bonus tools** (use later / where they fit):
  - `lol_get_lane_matchup_guide(my_champion, opponent_champion, position, lang)` → matchup-specific runes, item timings, tips — feeds **matchup notes**.
  - `lol_list_lane_meta_champions`, `strong_counters`/`weak_counters` from analysis → smarter **ban suggestions** (future enhancement, not in this scope's acceptance criteria).
- **Response shape** (`result.content[0].text`, a token-optimized "class schema + positional constructor" text format we parse). Confirmed fields under `Data`:
  - Items: `starter_items`, `boots`, `core_items`, `mythic_items`, `last_items`, `fourth_items`, `fifth_items`, `sixth_items` (each has `ids`, `ids_names`, `play`, `win`, `pick_rate`).
  - `summoner_spells` (ids + win/pick).
  - `runes`: `{ primary_page_id, primary_rune_ids, secondary_page_id, secondary_rune_ids, stat_mod_ids, ...names, play, win, pick_rate }`.
  - `skills`: `{ order, play, win, pick_rate }` (the level-by-level ability order).
  - `skill_combos` (`name`, `video_url`), `skill_masteries`.
  - `summary.average_stats`: `{ win_rate, pick_rate, ban_rate, tier, rank }` (drives the "62% · N games" label).
- **Parsing:** the text format self-describes field order via its `class X: a,b,c` header lines, then a positional constructor dump. Implement a **tolerant parser** keyed off the schema header (so field reordering by OP.GG doesn't silently misalign). Cover the parser with unit tests using a captured fixture.
- **Caching:** cache normalized results to disk under `userData` keyed by `championKey:role:patch`, mirroring `ddragon.ts`. Serve from cache; refresh in the background. Network failure → serve cache or return `null` gracefully (UI degrades, never crashes).

### 2.2 `BuildRecommendationProvider` interface

```ts
interface BuildRecommendationProvider {
  getBuild(championKey: number, role: DisplayRole, opts?: { tier?: string }): Promise<BuildRecommendation | null>
}
```

- `src/main/build-provider.ts` exports an OP.GG implementation + a small registry so the source is swappable.
- Role mapping: `top→TOP`, `jungle→JUNGLE`, `middle→MID`, `bottom→ADC`, `utility→SUPPORT`.
- Champion mapping: LCU `championId` → DDragon `championsByKey[id].name` for the `champion` arg.

---

## 3. PRD / compliance impact (must update during implementation)

Features 1 & 2 intentionally reverse current non-goals. Update **PRD.md** (§2.2, §6.1, §11, §14) and **CLAUDE.md** to record:

- **Crowd-sourced data is now in scope** via OP.GG (one external read source; still no first-party backend). DDragon remains the catalog.
- **Automated client writes expand** beyond ready-check accept to: (a) **opt-in, off-by-default** rune + spell application during champ select; (b) **user-clicked** queue start from the tray. Document the line we hold: no auto-pick/ban/dodge, and queue-start is **never** chained with auto-accept into a hands-off matchmaking loop.
- **Compliance rationale:** Riot's third-party policy explicitly permits rune/build/spell recommendation + import (Blitz/op.gg/Porofessor do exactly this); we keep automation opt-in and never automate gameplay decisions. Vanguard is irrelevant to LCU-only apps.

---

## 4. LCU capabilities (verified endpoints)

`league-connect@6.x` `createHttp1Request` supports all HTTP methods. **Widen `src/main/lcu.ts`'s POST-only `request()`** to accept `method: "GET"|"POST"|"PUT"|"PATCH"|"DELETE"` and an optional `body` object.

| Goal | Method + Path | Body |
|---|---|---|
| Set summoner spells | `PATCH /lol-champ-select/v1/session/my-selection` | `{ spell1Id, spell2Id }` |
| Read hover intent | `GET /lol-champ-select/v1/session` → `myTeam[].championPickIntent` + in-progress pick action | — (already in our session push) |
| List rune pages | `GET /lol-perks/v1/pages` | — |
| Inventory (page cap) | `GET /lol-perks/v1/inventory` → `canAddCustomPage` | — |
| Create rune page | `POST /lol-perks/v1/pages` | see below |
| Delete rune page | `DELETE /lol-perks/v1/pages/{id}` | — (handle 403 bug → fall back to `PUT /lol-perks/v1/pages/{id}`) |
| Current summoner | `GET /lol-summoner/v1/current-summoner` | — |
| In-game champion | `GET /lol-gameflow/v1/session` → `gameData.playerChampionSelections[]`, `gameData.queue.id` | — |
| Create lobby | `POST /lol-lobby/v2/lobby` | `{ queueId }` |
| Ranked position prefs | `PUT /lol-lobby/v1/lobby/members/localMember/position-preferences` | `{ firstPreference, secondPreference }` |
| Start / stop queue | `POST` / `DELETE /lol-matchmaking/v1/search` | — |
| Eligibility pre-flight | `GET /lol-lobby/v2/eligibility/party` | — |

**queueIds:** 400 Draft · 420 Ranked Solo/Duo · 430 Blind · 440 Ranked Flex · 450 ARAM.

### 4.1 Rune-apply flow (never touch the user's pages)

1. `GET /lol-perks/v1/inventory`; if `!canAddCustomPage` and no lockin page exists, abort with a friendly status.
2. If a persisted **lockin-owned** page id exists: `DELETE` it (on 403 — a known LCU bug — fall back to `PUT .../pages/{id}` to overwrite it in place).
3. `POST /lol-perks/v1/pages` with `current: true`; persist the returned `id` in `electron-store` for cross-restart cleanup.
4. Page name convention: `"lockin: <Champ> <Role>"`. Pages are not editable mid-game/lock-in — fail gracefully.

`selectedPerkIds` = `[...primary_rune_ids (4: keystone+3), ...secondary_rune_ids (2), ...stat_mod_ids (3)]` (exactly 9, order matters). `primaryStyleId = runes.primary_page_id`, `subStyleId = runes.secondary_page_id`.

### 4.2 Spell-apply

`PATCH .../my-selection { spell1Id, spell2Id }`. We set the spell *ids*; D/F key assignment is the user's client keybind (the `spellSlotLayout` setting only affects our display order, not the write).

---

## 5. New types & data models

```ts
// Recommendation (normalized from BuildRecommendationProvider) — shared/types.ts
interface RunePageRec {
  primaryStyleId: number
  subStyleId: number
  selectedPerkIds: number[]      // 9, in LCU order
  primaryName: string
  secondaryName: string
}
interface ItemGroup { ids: number[]; winRate?: number; pickRate?: number }
interface BuildRecommendation {
  championKey: number
  role: DisplayRole
  patch: string
  winRate: number                // 0..1
  sampleSize: number             // games (from play/total)
  runes: RunePageRec | null
  spells: [number, number] | null
  items: {
    starter: ItemGroup
    boots: ItemGroup
    core: ItemGroup              // the build-order sequence
    situational: ItemGroup       // 4th/5th/6th merged
  }
  skillOrder: ("Q"|"W"|"E"|"R")[] // length 18; the ability leveled at each level 1..18
  skillPriority: ("Q"|"W"|"E")[]  // max-order priority, e.g. ["Q","E","W"]
}

// Summoner identity — shared/types.ts
interface SummonerIdentity {
  gameName: string
  tagLine: string
  profileIconId: number
  summonerLevel: number
  puuid: string
}

// In-game snapshot — shared/types.ts
interface InGameState {
  championId: number
  spell1Id: number
  spell2Id: number
  queueId: number
}
```

Settings additions (`AppSettings` + `DEFAULT_SETTINGS`):

```ts
autoRunes: boolean        // default false
autoSpells: boolean       // default false
buildTier: string         // default "emerald_plus"
mains: { championId: number; role: DisplayRole }[]   // default []
```

`LcuSnapshot` gains `summoner: SummonerIdentity | null` and `inGame: InGameState | null`.

---

## 6. IPC contract additions

`src/shared/constants.ts`, `shared/api.ts`, `preload/index.ts`, `main/ipc.ts`:

**Push (Main → Renderer):**
- `lcu:summoner` → `SummonerIdentity | null`
- `lcu:inGame` → `InGameState | null`
- `nav:go` → `{ to: string; search?: Record<string, unknown> }` (tray-driven navigation, e.g. New Note)

**Invoke (Renderer → Main):**
- `build:get` `(championKey, role, tier?) → BuildRecommendation | null` (TanStack Query)
- `lcu:setSpells` `(spell1Id, spell2Id) → void`
- `lcu:applyRunes` `(page: RunePageRec) → { ok: boolean; error?: string }`
- `lcu:startQueue` `(queueId) → { ok: boolean; error?: string }`
- `lcu:stopQueue` `() → void`

The `lcu:summoner` / `lcu:inGame` pushes follow the existing `subscribeWithSnapshot` pattern in `preload/index.ts` and feed `LcuProvider`. `build:get` is a Query with long `staleTime` (data is patch-stable).

---

## 7. Feature designs

### 7.1 Responsive champ select + auto rune/spell setup

**Behavior**
- `useChampSelect` resolves the local champion from `championId || championPickIntent`, so the whole screen (header, spells, matchup note, recommendation) updates the instant you **hover** — pure read, fully compliant. Add a `hovering` flag (true when only intent is set) so we can subtly indicate "not locked yet."
- A **recommendation panel** (near the header strip) shows OP.GG runes (compact keystone cluster), recommended spells, and win%/sample. Driven by `build:get(championKey, role, tier)`.
- **Spell precedence:** pinned-note spells > OP.GG recommendation > existing heuristic (offline fallback). The existing `recommendSpells` heuristic stays as the last resort.
- **Auto-apply (opt-in, off by default):** when `autoSpells`/`autoRunes` are on, a change in the effective champion triggers `lcu:setSpells` / `lcu:applyRunes` (debounced ~400ms to avoid spamming during rapid hover). Show a small transient status ("Runes applied ✓" / "Spells applied ✓"). When off, the panel only *displays* the recommendation; no writes occur.

**Edge cases:** role pending → show recommendation once role known, otherwise a hint; build fetch fails/offline → hide build panel content, fall back to spell heuristic, never crash; rune inventory full → friendly status, no write; champion un-hovered → revert display to none.

**Acceptance**
- [ ] Hovering a champion in the client updates the champ-select view within ~1s without locking.
- [ ] Recommendation panel shows OP.GG runes + spells + win%/sample for the hovered/locked champ + role.
- [ ] With `autoRunes` on, a lockin-owned rune page is created/replaced and set current; the user's own pages are never modified.
- [ ] With `autoSpells` on, summoner spells are set on the client.
- [ ] Both toggles default off; with them off, no client writes happen.
- [ ] Pinned-note spells still override the recommendation and are labeled "Your pick."

### 7.2 In-Game screen + champ-select "mains"

**In-Game screen** (`home.tsx`: route `InProgress` (and `GameStart`) to a new `InGameScreen`; today it falls through to `Idle`).
- Layout (confirmed "Notes-led + right rail", "build + skill focus"):
  - **Main column:** header strip (champ from `lcu:inGame` + spells) → **Note** (matchup; resolve lane opponent from the gameflow teams as in champ select) → **Build** (horizontal item strips: Starting → Boots → Core with `→` arrows → Situational, smaller icons) → **Skill order** (color-coded 4×18 grid with level numbers, R only at 6/11/16; a `Q › E › W` priority line; a "**level up now**" highlight for the current level using live level data if available; win%/games label).
  - **Right rail (314px):** team list + a **compact runes reference** (keystone + shards, since runes are locked in-game).
- Data: `build:get(championKey, role)` using the in-game champion + the player's role (from gameflow selection or last champ-select role; fall back to `CHAMPION_LANE`).

**Champ-select "mains"** — fills the notes-column dead space.
- New **"Your mains"** section under the note in the champ-select left column, grouped by role (Top/JG/Mid/Bot/Sup), showing the user's configured main champions (portraits). Most useful pre-pick; stays compact when a long note is present (note scrolls).
- Configured in a new **Settings → "Your mains"** group: add/remove champions, each tagged with a role (reuse the champion picker + role selection patterns).

**Edge cases:** no mains configured → subtle empty prompt linking to settings; in-game champion unresolved → show note + team only; build unavailable → show note + team, hide build/skill.

**Acceptance**
- [ ] `InProgress` renders the In-Game screen (not Idle).
- [ ] Build (items) and skill order render from OP.GG for the in-game champion.
- [ ] Skill-order grid is correct (Q/W/E/R per level; R at 6/11/16) and color-coded.
- [ ] Champ-select shows a "Your mains" section populated from settings; empty state when none.
- [ ] Mains are editable in Settings and persist.

### 7.3 Sidebar nickname + avatar

- `lcu:summoner` feeds `LcuProvider`; the sidebar footer shows, when connected: DDragon **profile-icon avatar** (`…/cdn/<version>/img/profileicon/<profileIconId>.png`) + **`gameName#tagLine`**, above the existing "Client Connected / LCU · 127.0.0.1" lines.
- Disconnected → unchanged ("Client Not Detected").

**Acceptance:** [ ] When connected, the real nickname + avatar appear in the sidebar; they clear on disconnect.

### 7.4 Tray (rich native menu)

- `src/main/tray.ts`: build a dynamic `Menu`, **rebuilt** whenever status / summoner / settings change. Items:
  - Header (disabled): `● Connected · gameName#tagLine` or `○ Client not detected`.
  - **Auto-accept** (`type: "checkbox"`, bound to `settings.autoAccept`) + a **global accelerator** (`globalShortcut`, default `Control+Alt+A`) that toggles it.
  - **Start ranked queue** / **Start flex queue** (create lobby → set ranked position prefs → start search; disabled or error-noticed when not valid). Guardrails: explicit click each time; never invoked on a timer/loop; not auto-chained with auto-accept.
  - **New note…** → focus window + emit `nav:go` to `/notes?new`.
  - **Open lockin** → focus/restore window.
  - **Quit**.
- Tray needs access to settings, summoner, LCU actions, and the window — wire it to the existing main-process singletons. Errors from start-queue surface via a native `Notification`.

**Acceptance**
- [ ] Tray shows nickname/status when connected.
- [ ] Auto-accept checkbox reflects + toggles the setting; the global shortcut toggles it too.
- [ ] Start ranked/flex creates a lobby and begins matchmaking; failures show a notification.
- [ ] New note opens the app on the note-creation screen; Quit quits.

### 7.5 Copy pass (de-AI)

- Audit every user-facing string (idle, disconnected, settings, notes-region, empty states, etc.). Remove em dashes (`—`); replace the "marketing-AI" voice with direct, player-to-player phrasing.
- Examples:
  - "Hang tight — champ select pops the moment a game is found." → "Searching for a match. Champ select opens as soon as one's found."
  - "Off by default — you stay in control." → "Off by default, so nothing happens without you."
  - "Lockin wakes up the moment champ select begins. Until then, sharpen your notes." → "Lockin jumps in when champ select starts. Until then, tidy up your notes."

**Acceptance:** [ ] No em dashes remain in user-facing copy; tone reads natural and concise.

---

## 8. Dev tooling (UI-first)

Keep the **mock-first** discipline (PRD §15). Extend the fake layer so every new state is previewable without a client:
- `scenario.ts`/`bridge.ts`: add an **"In game"** phase, a **summoner** fixture, and a **build** fixture (sample `BuildRecommendation`).
- `state-switcher.tsx`: add the In-Game phase button, an auto-runes/auto-spells toggle preview, and a "build available / unavailable" toggle.
- Hooks (`useBuildRecommendation()`, `useSummoner()`, `useInGame()`) return mock fixtures first, repointed to real IPC later — components stay source-agnostic.

---

## 9. Suggested build order

1. **Plumbing:** widen `request()`; new types; IPC channels; settings; `BuildRecommendationProvider` (OP.GG adapter + parser + cache + tests); fake fixtures + state-switcher.
2. **Feature 3 (sidebar) + Feature 5 (copy)** — quick wins, low risk.
3. **Feature 4 (tray).**
4. **Feature 1 (responsiveness + auto-setup).**
5. **Feature 2 (in-game + mains).**
6. **PRD.md / CLAUDE.md updates** (can land alongside step 1).

Each step ends with `pnpm typecheck` + `pnpm format`, and Playwright verification of the affected screens (force-fake mode + state switcher).

---

## 10. Open risks

- **OP.GG MCP is a third-party dependency** (format/auth/rate-limit could change). Mitigated by the swappable interface + disk cache; Lolalytics is a possible future fallback adapter.
- **OP.GG text format parsing** — write a tolerant, fixture-tested parser; treat parse failure as "no build" (graceful).
- **Rune-page DELETE 403 bug** — implement the PUT-overwrite fallback.
- **`position`/`tier` enum spellings** for OP.GG — confirm `ADC`/`SUPPORT` and the tier list during implementation (probe).
- **Queue-start grey zone** — keep it manual-click only; never loop or chain with auto-accept.
