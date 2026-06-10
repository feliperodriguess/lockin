# lockin — Product Requirements Document

> **Name:** lockin
> **What it is:** An unofficial macOS desktop companion for the League of Legends client. It listens to the local League Client (LCU) and gives you matchup-aware help during champion select — recommended summoner spells, your own matchup notes, ban guidance, a clean queue-pop auto-accept, and a team rank-diff flag.
> **Audience for this doc:** Claude Code (implementation).
> **Design:** Delivered separately via Claude Design — **fetch and implement it** (see §11).
> **Platform:** macOS only (Apple Silicon + Intel).
> **Backend:** None. All static data comes from Riot's Data Dragon CDN; all user data is stored locally.

---

## 1. Summary

Blitz and Mobalytics are big, account-linked analytics suites. lockin intentionally does **one moment well**: champion select. When you queue and lock in, a compact window beside your client shows everything you actually use in those 60 seconds — and nothing else. The differentiator versus generic tools is that the matchup advice is **yours** (notes you wrote), not crowd-sourced averages.

The app is read-mostly: it reads state from the local League client and (optionally) sends exactly one write — accepting the ready check. Everything else is local.

---

## 2. Goals & Non-Goals

### 2.1 Goals
- Detect when the League client is running and reflect its current phase in real time.
- During **champion select**, surface: recommended summoner spells, your matchup notes, ban suggestions, a phase/dodge countdown, and your team's ranks with mismatch flags.
- On **queue pop (ready check)**, optionally auto-accept and always show a clean countdown.
- Let the user create, edit, search, and pin matchup notes (persisted locally).
- Work with zero backend and zero login.

### 2.2 Non-Goals (explicitly out of scope for v1)
- **No** post-game analytics, match history, or stat tracking.
- ~~**No** starting-item recommendations and **no** crowd-sourced / "pro" data~~ **Now in scope (v1.1):** item builds, rune pages, skill order, and summoner-spell recommendations are sourced from **one external read source (OP.GG MCP)** behind a swappable `BuildProvider`, disk-cached per (champion, role, patch). DDragon remains the catalog. Still **no first-party backend** and no other crowd-sourced surfaces (no win-rate dashboards, no match history). User-defined matchup notes and the offline spell heuristic remain and take precedence over OP.GG where they apply. See §6.1.
- **No** in-game overlay or interaction with the running game process / Live Client Data API. We touch the **client** (LCU) only — never the game. (See §14 Compliance.)
- **No** Windows/Linux build.
- **No** multi-account sync, cloud storage, or telemetry.
- **No** auto-pick / auto-ban / auto-dodge. **Now in scope (v1.1), opt-in and off by default:** automatic application of recommended **rune pages** and **summoner spells** during champ select, and **user-clicked** queue start from the tray. The line we hold: no automation of gameplay *decisions* (pick/ban/dodge), and queue-start is **never** chained with auto-accept into a hands-off matchmaking loop. See §14.
- **No** language/locale, always-on-top, or launch-on-login settings in v1.

---

## 3. Tech Stack & Key Dependencies

Use the **latest stable version** of each library below. Pin exact versions at scaffold time and verify cross-compatibility (especially Tailwind v4 + shadcn/ui + React 19). Where a major version is named, treat it as a minimum and take the newest stable.

| Concern | Choice | Notes |
|---|---|---|
| Desktop shell | **Electron** (latest stable) | `contextIsolation: true`, `nodeIntegration: false`, `sandbox` where feasible. |
| UI library | **React** (latest stable, v19+) | Function components + hooks. |
| Language | **TypeScript** (latest stable) | `strict: true`. |
| Linting + formatting | **Biome** | One fast (Rust-based) toolchain replacing ESLint + Prettier. Initialize with `npx @biomejs/biome init` (writes `biome.json`); enable the linter + formatter, run on save and in CI. |
| Bundler / dev server | **electron-vite** ([electron-vite.org](https://electron-vite.org)) | Vite-based tooling purpose-built for Electron — handles the main / preload / renderer builds and renderer HMR out of the box. Configured via `electron.vite.config.ts`. The official starter ships with electron-builder already wired (see §3.1, §13). |
| Styling | **Tailwind CSS** (latest, v4) | Use the v4 Vite plugin (`@tailwindcss/vite`) and CSS-first config. |
| Components | **shadcn/ui** | Installed via its CLI; components are copied into the repo. Confirm Tailwind v4 + React 19 support during init. |
| Data / async state | **TanStack Query** (`@tanstack/react-query`, v5) | Wraps the request/response IPC layer (notes, settings, Data Dragon, ranks). See §8.1. |
| Routing | **TanStack Router** (`@tanstack/react-router`, v1) | Renderer navigation (Live / Notes / Settings). Use memory or hash history (no real URL bar in Electron). |
| Global / client state | **Zustand** and/or **Jotai** (as needed) | For client state *not* owned by TanStack Query — e.g., the live LCU push state and cross-component UI state. Keep server/async data in Query; don't mirror it here. Add only when plain React state + props get awkward. |
| LCU integration | **`league-connect`** (npm) | Credential discovery (incl. macOS process scan), HTTPS against the self-signed cert, and the WebSocket subscription. Main process only. Verify current version/API at scaffold. |
| Local persistence | **`electron-store`** | JSON-backed, under `app.getPath('userData')`. Settings, notes, ban list. |
| HTTP (Data Dragon) | built-in `fetch` (main process) | Fixed locale `en_US`. Responses cached on disk. |
| Packaging / distribution | **electron-builder** | Packages the app and builds the macOS `.dmg`; comes pre-wired in the electron-vite starter. Configured via `electron-builder.yml` (or the `build` key); code signing + notarization via its `mac`/`dmg` config and `notarize` option (see §13). |

> **Architectural rule:** All LCU access, filesystem access, and Data Dragon fetching happen in the **main process**. The renderer is pure UI (React + Tailwind + shadcn/ui) and talks to main exclusively over a typed IPC bridge (`contextBridge`). The renderer never makes network calls to the LCU directly (CORS + self-signed cert + security).

### 3.1 Frontend stack integration notes
- **TanStack Query over IPC:** model the **request/response** IPC channels (§8) as Query *queries* (Data Dragon bundle, notes list, settings, team ranks) and *mutations* (notes upsert/delete, settings set, accept ready check). Treat the main process as the async data source the query/mutation functions call through the preload bridge.
- **Real-time events:** the **pushed** channels (`lcu:status`, `lcu:phase`, `lcu:readyCheck`, `lcu:champSelect`) are push, not poll. Subscribe once in a top-level provider and feed each event into a lightweight **Zustand store (or Jotai atoms)** that components read from. (Writing into the Query cache via `queryClient.setQueryData(...)` also works — pick one home for push state and stay consistent.) Do not poll for these.
- **State ownership (no duplication):** TanStack Query holds **server/async state** (everything behind the request/response IPC). **Zustand and/or Jotai** hold **client state** — the live LCU push state plus any UI state shared across components. Never keep the same data in both; keep small/local UI state in plain `useState`.
- **TanStack Router:** define three routes — `/live` (default), `/notes`, `/settings` — using memory or hash history. The `/live` route renders the phase-driven view (§12).
- **Tailwind v4:** wire `@tailwindcss/vite`; use the v4 token/config approach.
- **shadcn/ui:** initialize after Tailwind is working; pull in only the primitives the design needs. It is router-agnostic (works fine with TanStack Router).
- **electron-vite:** it already wires the main / preload / renderer builds and renderer HMR — define all three in `electron.vite.config.ts`. Easiest path is to scaffold from the official starter (`npm create @quick-start/electron`), which comes with electron-builder configured for packaging.

---

## 4. Glossary

- **LCU API** — "League Client Update" API. A local REST + WebSocket server the client runs on `127.0.0.1`. Auth is HTTP Basic (`riot:<token>`) over HTTPS with a self-signed cert. Port + token come from the client's lockfile or process arguments.
- **Data Dragon (DDragon)** — Riot's static-data CDN: champion + summoner-spell metadata and icons. Provided by Riot for third-party use.
- **Gameflow phase** — the client's high-level state: `None`, `Lobby`, `Matchmaking`, `ReadyCheck`, `ChampSelect`, `InProgress`, `EndOfGame`, etc.
- **Ready check** — the "queue pop" accept/decline prompt (~12s window).
- **Champ select session** — the live object describing teams, picks, bans, actions, and the phase timer.
- **Cell** — a player's slot in champ select, identified by `cellId`.

---

## 5. System Architecture

```
┌──────────────────────────── Electron (macOS) ─────────────────────────────┐
│                                                                            │
│   MAIN PROCESS (Node)                         RENDERER (React + TS)        │
│  ┌──────────────────────────┐                ┌──────────────────────────┐ │
│  │ LcuService               │   IPC events   │  App shell (TanStack       │ │
│  │  - connect/reconnect      │ ─────────────► │   Router: live/notes/      │ │
│  │  - watch gameflow phase   │  lcu:status    │   settings)                │ │
│  │  - watch ready check      │  lcu:phase     │   - Disconnected view      │ │
│  │  - watch champ select     │  lcu:readyCheck│   - Idle/dashboard         │ │
│  │  - accept ready check     │  lcu:champSelect│  - Ready-check view       │ │
│  └──────────────────────────┘                │   - Champ-select view      │ │
│  ┌──────────────────────────┐  IPC invoke    │   - Notes library          │ │
│  │ DDragonService (cached)  │ ◄───────────────│   - Settings               │ │
│  │ NotesStore (electron-store)                └──────────────────────────┘ │
│  │ SettingsStore             │                          ▲                   │
│  │ RankService (SPIKE)       │                          │ contextBridge     │
│  │ SpellRecommendationEngine │                          │ + TanStack Query  │
│  └──────────────────────────┘                          │                   │
└────────────────────────────────────────────────────────────────────────────┘
        │ HTTPS (Basic auth, self-signed) + WSS                  │ HTTPS
        ▼                                                        ▼
  League Client (LCU) on 127.0.0.1:<port>              ddragon.leagueoflegends.com
```

**Data flow during champ select:**
1. `LcuService` is subscribed to the champ-select WebSocket event and pushes each session update to the renderer via `lcu:champSelect`.
2. A provider writes the session into the live-state store (Zustand/Jotai); the renderer derives view data (my champion, role, enemy picks, timer).
3. For spells, notes, ban suggestions, and ranks, the renderer issues Query queries/mutations over `invoke` with the relevant IDs and renders the results.

---

## 6. Feature Specifications

Each feature lists: behavior, trigger, data source, edge cases, and acceptance criteria.

### 6.1 Recommended Summoner Spells

> **Honest scope note:** Data Dragon provides the **catalog** of summoner spells and their icons, but not per-matchup recommendations. v1 uses a deterministic **heuristic engine** plus **user overrides**. Starting-item recommendations and crowd-sourced data are deliberate non-goals.

**Behavior.** Once the user's champion + assigned role are known, show a suggested pair of summoner spells (2 icons). If the user has pinned spells on a matching note, **the pinned values win** and are labeled "Your pick."

**Heuristic engine (deterministic).**
- Flash is always slot A (respect the user's `spellSlotLayout` setting for D/F).
- Second spell by `assignedPosition`:
  - `jungle` → Smite
  - `top` → Teleport
  - `middle` → Teleport (fallback Ignite)
  - `bottom` (ADC) → Heal
  - `utility` (support) → Ignite (fallback Exhaust)
  - unknown/empty role → Ignite
- Suggestions resolve to DDragon icons + names for display.

**User override.** Pinned spells on a matching note replace the heuristic output for that matchup.

**Edge cases.**
- Role not yet assigned → show default spells with a subtle "role pending" hint.
- Spell key not resolvable from DDragon → fail gracefully; never crash the champ-select view.

**Acceptance criteria.**
- [ ] Given champion + role, the app renders 2 spell icons in champ select.
- [ ] Pinned note spells override heuristics and are visibly labeled "Your pick."
- [ ] Spell A/B placement respects the D/F layout setting.
- [ ] No crash when a spell ID doesn't resolve for the current patch.

---

### 6.2 Matchup Notes

**Behavior.** The user writes free-form notes tied to a champion they play, optionally scoped to a lane opponent (e.g. note for *Darius*, opponent *Quinn*: "respect early all-in, freeze"). Notes are created/edited in a **Notes Library** at any time, and the **relevant note(s) appear automatically during champ select** once the user has locked a champion.

**Trigger / surfacing logic.**
- In champ select: show notes where `note.championId === myChampionId` AND (`note.opponentChampionId == null` OR `opponentChampionId` matches a champion currently picked/hovered on the enemy team).
- General notes (no opponent) always show when you're on that champion.
- The champ-select notes panel is inline-editable (quick add/append without leaving the app).

**Data source.** Local only (`electron-store`). Champion identity comes from the champ-select session + DDragon mapping.

**Edge cases.**
- No note exists for the current matchup → show an empty "Add a note for {Champion} vs {Opponent}" prompt.
- Enemy champion hidden (common during your ban phase) → show general notes for your champion; surface opponent-specific notes as soon as the enemy locks.
- Multiple matching notes → list them, most-recently-updated first.

**Acceptance criteria.**
- [ ] User can create a note with: champion (required), opponent (optional), body text, optional pinned spells.
- [ ] User can edit and delete notes from the library.
- [ ] Library supports text search across body + champion names.
- [ ] During champ select, matching notes appear within 1s of locking a champion.
- [ ] Notes persist across app restarts.

---

### 6.3 Ban Suggestion

> **Timing reality:** Bans usually happen **before** the enemy reveals picks, so "react to enemy picks" only partially applies. v1 combines a **user-maintained personal ban list** with **session awareness** (it removes champs already banned/picked, and—when enemy intent/picks are visible—boosts threats the user listed).

**Behavior.** During the ban phase, show the user's top ban candidates (from their personal ban list, ordered by priority), filtered to those **still available** (not already banned by either team and not yet picked). If any enemy champion is visible (hover/pick) and appears on the user's threat list, lift it to the top with a "threat" badge.

**Data source.** Personal ban list (local) + champ-select session (`bans.myTeamBans`, `bans.theirTeamBans`, `actions[]`, `myTeam`/`theirTeam` champion IDs).

**Edge cases.**
- It's not your ban turn → still show the list as reference, but don't imply urgency.
- Empty ban list → prompt the user to build one (link to the ban-list editor in settings).
- All listed champs already banned/picked → show "your top bans are gone" with the next available options.

**Acceptance criteria.**
- [ ] User can manage a prioritized ban list (add/remove/reorder, optional reason) in settings.
- [ ] During ban phase, suggestions exclude already-banned and already-picked champions.
- [ ] Visible enemy champions that match the threat list are surfaced first with a badge.
- [ ] Suggestions update live as bans/picks come in.

---

### 6.4 Auto-Accept + Dodge/Phase Timer

**Behavior — Auto-accept.** When a ready check appears and `autoAccept` is enabled, the app accepts it (optionally after `autoAcceptDelayMs`). A clean countdown is always shown during the ready check regardless of the auto-accept setting, with manual Accept/Decline controls.

**Behavior — Dodge/phase timer.** During champ select, show the time remaining in the current phase (from `session.timer.adjustedTimeLeftInPhase`). This doubles as a **dodge window** indicator: it makes it obvious how long the user has to bail if the comp/matchup is bad, before lock-in/finalization.

> **Note:** The app does **not** dodge for the user (no automated leaving). It only displays the countdown. Auto-accept is the only automated write the app performs, and it is **off by default**.

**Data source.** `lol-matchmaking/v1/ready-check` (read) + `.../ready-check/accept` (write). `lol-champ-select/v1/session.timer` (read).

**Edge cases.**
- User manually declines while auto-accept is on → respect the decline; do not re-accept.
- Ready check appears and disappears rapidly (someone else declined) → reflect end state cleanly, no stuck UI.
- Phase timer reports `isInfinite` (custom lobbies) → hide the countdown.

**Acceptance criteria.**
- [ ] With auto-accept ON, the ready check is accepted automatically (respecting the configured delay).
- [ ] With auto-accept OFF, the countdown + manual Accept/Decline still render.
- [ ] Champ-select phase countdown is accurate within ~1s and stops at 0.
- [ ] No automated dodging occurs anywhere.

---

### 6.5 Rank Diff Notifier

> **TECHNICAL SPIKE REQUIRED — read before estimating.** The champ-select session reliably exposes **your own team's** `summonerId`/`puuid`. Whether teammate **ranked tiers** can be fetched purely via the LCU (no Riot API key, no backend) is uncertain and must be validated in a spike. The **enemy team is typically hidden** during champ select, so this feature targets **your 5-player side only**. If the spike fails, ship this feature in a degraded "self rank only" mode or defer it — it must not block the rest of v1.

**Behavior (target).** During champ select, list your team with each player's solo-queue rank, and flag mismatches: e.g., highlight when the spread between the highest and lowest ranked teammate meets/exceeds `rankDiffThreshold`, or when a player is N+ tiers off the lobby average.

**Data source.** Champ-select `myTeam[].puuid/summonerId` → ranked stats endpoint(s) (to be confirmed in spike) → numeric rank scoring for comparison.

**Rank scoring.** Map tier+division to an ordinal score (Iron IV = 0 … Challenger = top) so deltas are comparable. Unranked players are excluded from the spread calc but shown as "Unranked."

**Edge cases.**
- Rank unavailable for a player → show "—"/"Unranked", exclude from the diff math.
- Provisional/placement players → label accordingly.
- Threshold not met → no flags, just the roster.

**Acceptance criteria.**
- [ ] Spike documented: can teammate ranks be read via LCU? Result recorded in the repo.
- [ ] If feasible: team roster with ranks renders during champ select.
- [ ] Mismatches beyond the configured threshold are visually flagged.
- [ ] Graceful degradation when ranks are missing; never blocks champ-select UI.

---

## 7. Data Models (TypeScript)

```ts
// ---------- Static data (Data Dragon) ----------
interface ChampionStatic {
  id: string;        // "Aatrox" (DDragon string key, used in image paths)
  key: number;       // 266 — numeric id; equals LCU championId
  name: string;      // "Aatrox"
  title: string;
  tags: string[];    // ["Fighter","Tank"] — used for the spell heuristic fallback
  imageFull: string; // "Aatrox.png"
}

interface SummonerSpellStatic {
  id: string;        // "SummonerFlash"
  key: number;       // 4 — equals LCU spell id
  name: string;
  imageFull: string;
}

interface DDragonBundle {
  version: string;                       // resolved at runtime
  championsByKey: Record<number, ChampionStatic>;
  spellsByKey: Record<number, SummonerSpellStatic>;
}

// ---------- LCU session (subset we consume) ----------
type GameflowPhase =
  | "None" | "Lobby" | "Matchmaking" | "ReadyCheck"
  | "ChampSelect" | "GameStart" | "InProgress"
  | "Reconnect" | "WaitingForStats" | "PreEndOfGame" | "EndOfGame";

interface ChampSelectPlayer {
  cellId: number;
  championId: number;          // 0 if not locked/hidden
  championPickIntent: number;  // hovered champ
  assignedPosition: string;    // "top"|"jungle"|"middle"|"bottom"|"utility"|""
  summonerId: number;
  puuid: string;
  spell1Id: number;
  spell2Id: number;
  team: number;
}

interface ChampSelectAction {
  actorCellId: number;
  championId: number;
  completed: boolean;
  id: number;
  isAllyAction: boolean;
  isInProgress: boolean;
  pickTurn: number;
  type: "ban" | "pick" | string;
}

interface ChampSelectSession {
  actions: ChampSelectAction[][];
  bans: { myTeamBans: number[]; theirTeamBans: number[]; numBans: number };
  localPlayerCellId: number;
  myTeam: ChampSelectPlayer[];
  theirTeam: ChampSelectPlayer[];
  timer: {
    adjustedTimeLeftInPhase: number; // ms
    totalTimeInPhase: number;        // ms
    phase: string;                   // "PLANNING"|"BAN_PICK"|"FINALIZATION"
    isInfinite: boolean;
  };
}

interface ReadyCheck {
  state: "Invalid" | "InProgress";
  playerResponse: "None" | "Accepted" | "Declined";
  timer: number;
  declinerIds: number[];
}

interface RankInfo {              // result of the §6.5 spike
  tier: string;                   // "GOLD"
  division: string;               // "II"
  lp: number;
  queueType: string;              // "RANKED_SOLO_5x5"
}

// ---------- App domain (local) ----------
interface MatchupNote {
  id: string;                          // uuid
  championId: number;                  // champ you play
  opponentChampionId: number | null;   // optional lane opponent
  body: string;
  pinnedSpells?: [number, number];     // override summoner-spell keys
  createdAt: string;                   // ISO
  updatedAt: string;                   // ISO
}

interface BanListEntry {
  championId: number;
  priority: number;                    // 1 = highest
  reason?: string;
}

interface AppSettings {
  autoAccept: boolean;                 // default false
  autoAcceptDelayMs: number;           // default 0
  spellSlotLayout: "DF" | "FD";        // default "DF"
  rankDiffThreshold: number;           // tiers/divisions delta to flag
}
```

> Note: Data Dragon locale is a fixed internal constant (`en_US`) — it is **not** a user setting in v1.

---

## 8. IPC Contract (typed bridge)

Exposed via `contextBridge` in the preload script. The renderer never imports Node APIs directly.

**Main → Renderer (pushed events → into the live-state store, or the Query cache):**
| Channel | Payload |
|---|---|
| `lcu:status` | `{ connected: boolean }` |
| `lcu:phase` | `{ phase: GameflowPhase }` |
| `lcu:readyCheck` | `ReadyCheck \| null` |
| `lcu:champSelect` | `ChampSelectSession \| null` |

**Renderer → Main (`invoke`, request/response):**
| Channel | Args → Returns | Query role |
|---|---|---|
| `lcu:acceptReadyCheck` | `() → void` | mutation |
| `ddragon:getBundle` | `() → DDragonBundle` | query (long cache) |
| `settings:get` | `() → AppSettings` | query |
| `settings:set` | `(partial: Partial<AppSettings>) → AppSettings` | mutation |
| `notes:list` | `() → MatchupNote[]` | query |
| `notes:upsert` | `(note: Partial<MatchupNote>) → MatchupNote` | mutation |
| `notes:delete` | `(id: string) → void` | mutation |
| `banlist:get` | `() → BanListEntry[]` | query |
| `banlist:set` | `(entries: BanListEntry[]) → BanListEntry[]` | mutation |
| `rank:getForPuuids` | `(puuids: string[]) → Record<string, RankInfo \| null>` *(spike)* | query |

### 8.1 Wiring the IPC (TanStack Query + client store)
- Wrap each request/response channel in a typed function and expose via the preload bridge; call those from `useQuery`/`useMutation`.
- For the four pushed channels, subscribe once in a provider and push each event into the **Zustand/Jotai store** (recommended), so components read live state from there. Alternatively, call `queryClient.setQueryData(["lcu","champSelect"], payload)` to expose it through `useQuery`. Pick one approach and stay consistent. After relevant mutations (e.g., `notes:upsert`), invalidate the matching query key.

---

## 9. LCU Integration Details

- **Credential discovery:** prefer `league-connect`'s `authenticate()`, which on macOS locates the running client and returns `{ port, password/token }`. This is path-independent and handles the macOS process scan. (Fallback if hand-rolling: scan `ps -A -o args` for the `LeagueClientUx` process and parse `--app-port=` and `--remoting-auth-token=`; confirm the macOS lockfile path during the spike rather than assuming it.)
- **Auth:** HTTP Basic, username `riot`, password = token, over HTTPS to `127.0.0.1:<port>`. The cert is self-signed → requests must not reject it (`league-connect` handles this).
- **Live updates:** open the LCU WebSocket and subscribe to events:
  - `OnJsonApiEvent_lol-gameflow_v1_gameflow-phase` → drives top-level app view.
  - `OnJsonApiEvent_lol-matchmaking_v1_ready-check` → drives ready-check view + auto-accept.
  - `OnJsonApiEvent_lol-champ-select_v1_session` → drives the whole champ-select view.
- **Reconnect strategy:** the client may not be running at launch, may close, or may restart. `LcuService` must poll/retry connection with backoff, emit `lcu:status` accordingly, and resubscribe cleanly on reconnect. Never crash the app when the client is absent.
- **Champion ID mapping:** LCU `championId` is numeric and equals DDragon `key`. Map via `DDragonBundle.championsByKey`.

**Key endpoints (reference):**
| Purpose | Method | Path |
|---|---|---|
| Current gameflow phase | GET | `/lol-gameflow/v1/gameflow-phase` |
| Ready check state | GET | `/lol-matchmaking/v1/ready-check` |
| Accept ready check | POST | `/lol-matchmaking/v1/ready-check/accept` |
| Champ select session | GET | `/lol-champ-select/v1/session` |
| Current summoner | GET | `/lol-summoner/v1/current-summoner` |
| Ranked stats (self; teammate = spike) | GET | `/lol-ranked/v1/...` *(confirm in spike)* |

---

## 10. Data Dragon Integration

- **Resolve latest version:** `GET https://ddragon.leagueoflegends.com/api/versions.json` → first array element is the latest patch.
- **Champions:** `…/cdn/<version>/data/en_US/champion.json`
- **Summoner spells:** `…/cdn/<version>/data/en_US/summoner.json`
- **Icons:** champion `…/cdn/<version>/img/champion/<imageFull>`; spell `…/img/spell/<imageFull>`.
- **Caching:** fetch the bundle on startup (and when the patch changes), normalize into `DDragonBundle`, cache to disk under `userData`. Serve from cache when offline; refresh in the background. Spell/champion icons can be lazy-loaded directly from the CDN by URL (no need to bundle them).
- **Locale:** fixed `en_US` (internal constant, not user-configurable).

---

## 11. Design & UI Implementation

> ### ▶ Implement the UI from the Claude Design handoff
>
> **The Claude Design output is the source of truth for all visuals, layout, screens, components, and states.** Before building any UI, do exactly this:
>
> 1. **Fetch this design file:** `https://api.anthropic.com/v1/design/h/8YnAFGbCZWTUuBqlwFDT3A?open_file=Lockin+-+Prototype.html`
> 2. **Read its README.**
> 3. **Implement `Lockin - Prototype.html`** — build the relevant aspects of that prototype as the app's UI.

**Division of authority:** the **design** governs visual design, layout, and screen/state appearance; **this PRD** governs behavior, data, IPC, and architecture. Where they overlap (the screens/states below), match the design's look and this PRD's behavior. Build the UI with React + Tailwind v4 + shadcn/ui, navigated by TanStack Router and fed by TanStack Query (§3.1, §8.1).

**Screens in scope** (state-driven; the `/live` view swaps by client phase — see §12):
- **Disconnected** (client closed)
- **Idle / dashboard** (connected, not in queue)
- **Ready Check** (queue pop — countdown + accept/decline)
- **Champ Select** (the hero screen: recommended spells, matchup notes, ban suggestions, phase/dodge timer, team ranks)
- **Notes Library + note editor**
- **Settings**

**Settings screen contents (v1):** auto-accept toggle (off by default) + optional delay; summoner-spell key layout (D / F); rank-mismatch threshold; ban-list editor (add / drag-reorder / remove + optional reason). *(No language, always-on-top, or launch-on-login settings.)*

**Brand constraints (must follow):** ship the app as **unofficial**. Do **not** use Riot Games logos, wordmarks, or the "League of Legends" name in the app's identity. Champion/spell icons from Data Dragon are fine to display. The app name is **lockin**.

---

## 12. App Lifecycle & States (logic)

- App launches whether or not the client is running. `LcuService` attempts connection and retries with backoff.
- `lcu:phase` drives the `/live` route: `ReadyCheck` → ready-check screen; `ChampSelect` → champ-select screen; otherwise → idle dashboard.
- On client close: emit `lcu:status {connected:false}`, return to Disconnected, keep the app responsive (Notes/Settings still usable).
- On client reopen: reconnect, resubscribe, resume.
- The app runs in a single normal resizable window. Closing the window quits the app (standard macOS menu quit available). *(No always-on-top toggle and no launch-on-login in v1.)*
- Optional, low priority: a macOS menu-bar/tray presence — nice-to-have, not required for v1.

---

## 13. Packaging & Distribution (macOS)

- Build with **electron-vite** (`electron-vite build`), then package the `.dmg` with **electron-builder**; target both arm64 and x64 (universal or per-arch). The electron-vite starter wires this together (a build script that runs electron-vite, then electron-builder).
- For **distribution**, the app must be **code-signed (Apple Developer ID) and notarized**, or macOS Gatekeeper will block it — configure this in electron-builder's `mac` config (signing identity + entitlements) and enable its `notarize` option. For **personal use**, an unsigned build can be run with a manual Gatekeeper override.
- No auto-update server in v1 (non-goal). Manual `.dmg` releases.

---

## 14. Compliance & Risk

> Flagging honestly so it's a deliberate decision, not a surprise.

- **LCU read access is broadly tolerated.** Popular companion apps (Blitz, OP.GG, Porofessor, Mobalytics) read the local LCU API; Riot exposes it for third-party client apps. This app's read features sit in that well-trodden space.
- **Auto-accept is automation** and is the one feature in a gray area under Riot's third-party policies. Mainstream apps ship it and it functions, but it could be interpreted as automation. Mitigations: keep it **off by default**, opt-in, with a clear in-app note. The user assumes this risk.
- **Vanguard (anti-cheat).** Vanguard targets kernel-level cheats and game-process tampering. Stay strictly on the **LCU (client) API** and **never** read game memory or hook the running game; that keeps the app on the tolerated surface that other companion apps occupy. **Verify the current state of Riot's developer/automation policy and Vanguard behavior before public release** — treat this as a release-gate checklist item.
- **No automated dodging, picking, or banning.** The app advises; the human acts. The only write is accepting the ready check.
- **Branding.** Ship as unofficial; no Riot trademarks in the app identity (see §11).

---

## 15. Build Phases (suggested sequencing)

> **Strategy: UI-first, then integrate.** Build the whole presentational layer against mock data first (Phase 1), then progressively replace the mocks with real LCU / Data Dragon / persistence — ideally without touching the components. To make that swap painless, have every screen consume data through hooks (e.g. `useChampSelect()`, `useNotes()`, `useTeamRanks()`): in Phase 1 they return mock fixtures; each later phase just repoints the same hook at the real IPC / Query / store layer (§8, §8.1).

- **Phase 0 — Scaffold.** ✅ *Done.* Electron + **electron-vite** (`@quick-start/electron` starter) + React + TypeScript (strict); Tailwind v4 + shadcn/ui; **Biome**; TanStack Query + TanStack Router (+ Zustand/Jotai as needed); `contextIsolation`/no `nodeIntegration`; typed preload bridge; electron-store; **electron-builder**.
- **Phase 1 — Full UI, mocked data (pure UI).** Implement every screen from the design handoff — Disconnected, Idle/dashboard, Ready Check, Champ Select, Notes Library + editor, Settings — plus **all component variants and controls**. Everything is driven by **mock fixtures** behind the data hooks; no LCU, no network, no persistence yet. Add a **dev-only state switcher** so every variant is previewable without a running client: connected/disconnected, champ select vs. ready check, empty/loading/error, role pending, enemy hidden, ranks missing, "Your pick" override, threat badge, mismatch flag. *Done = the app looks and navigates exactly like the design, fully clickable on fake data.*
- **Phase 2 — LCU backbone** *(replaces the status/phase mock)*. `league-connect`: connect, retry/backoff, gameflow-phase subscription, `lcu:status`/`lcu:phase` pushed into the live-state store. Disconnected/Idle now react to the real client.
- **Phase 3 — Auto-accept + timers** *(replaces the ready-check mock)*. Real ready-check subscription + countdown; opt-in auto-accept (off by default); champ-select phase/dodge countdown from `session.timer`.
- **Phase 4 — Static data + champ-select data** *(replaces the champ-select mock)*. DDragon fetch/normalize/cache (champions + spells); render your champion, role, and teams from the real session.
- **Phase 5 — Notes** *(replaces the notes mock)*. Wire the library + in-champ-select notes to `electron-store`: real CRUD, search, surfacing, inline edit.
- **Phase 6 — Spell recommendations + bans.** Heuristic spell engine + user overrides; ban-list editor + session-aware ban suggestions.
- **Phase 7 — Rank diff (post-spike).** Run the §6.5 spike first; implement real roster ranks or the degraded mode based on the result.
- **Phase 8 — Settings + polish + packaging.** Persist settings (auto-accept + delay, D/F layout, rank threshold, ban list); final polish against the design; `.dmg` build + signing/notarization.

---

## 16. Open Questions

1. **Teammate ranks via LCU** — feasible without a Riot API key/backend? (§6.5 spike; gates that feature only.)
2. **macOS credential discovery** — confirm `league-connect` covers macOS cleanly; if hand-rolling, confirm the current lockfile path vs. process-args approach.
3. **Post-MVP:** would the user ever want an optional external data source for spells later, or keep recommendations strictly heuristic + personal? (Currently a non-goal.)
4. **Tray/menu-bar presence** — desired for v1 or defer?

---

## 17. Appendix — Minimal champ-select payload (shape reference)

```json
{
  "timer": {
    "phase": "BAN_PICK",
    "adjustedTimeLeftInPhase": 27000,
    "totalTimeInPhase": 30000,
    "isInfinite": false
  },
  "localPlayerCellId": 2,
  "bans": { "myTeamBans": [], "theirTeamBans": [], "numBans": 10 },
  "myTeam": [
    {
      "cellId": 2,
      "championId": 266,
      "championPickIntent": 0,
      "assignedPosition": "top",
      "summonerId": 123456,
      "puuid": "….",
      "spell1Id": 4,
      "spell2Id": 12,
      "team": 1
    }
  ],
  "theirTeam": [
    { "cellId": 5, "championId": 0, "assignedPosition": "", "puuid": "", "team": 2 }
  ],
  "actions": [
    [ { "actorCellId": 2, "type": "ban", "championId": 0, "completed": false, "isInProgress": true, "isAllyAction": true, "pickTurn": 1, "id": 10 } ]
  ]
}
```

*(`championId: 0` and empty `puuid` on the enemy side illustrate why enemy data is often unavailable during your ban phase — see §6.3 and §6.5.)*