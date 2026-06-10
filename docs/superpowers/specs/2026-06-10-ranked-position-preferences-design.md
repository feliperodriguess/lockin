# Design: Configurable ranked position preferences

> **Status:** Approved (design phase). Source of truth for the implementation plan.
> **Date:** 2026-06-10
> **Scope:** Let the user configure the role (position) preferences sent when starting a ranked/flex queue from the tray, replacing the hardcoded `FILL`/`UNSELECTED`.

---

## 1. Summary & goals

When lockin starts a ranked or flex queue from the tray, it currently hardcodes the lobby position preferences to **auto-fill any role**:

```ts
// src/main/lcu.ts — startQueue()
{ firstPreference: "FILL", secondPreference: "UNSELECTED" }
```

This feature lets the user pick their **first** and **second** role preferences in Settings, and applies that pair when a ranked/flex queue is started. The default reproduces today's exact behavior (`FILL` / none), so nothing changes until the user configures it.

**Goals**

1. A single, shared position-preference pair (first + second) configured in Settings.
2. Applied to **both** ranked queue types (Solo/Duo `420`, Flex `440`) — the only queues where positions apply.
3. Zero behavior change for existing users until they touch the setting.

**Non-goals (explicitly out of scope)**

- **Rank-type selection** — the tray already exposes separate "Start ranked queue" and "Start flex queue" items; that need is met.
- **An in-app start-queue button** — queue-start stays tray-only.
- **Per-queue separate preferences** — one shared pair covers Solo and Flex (decided with the user; Solo is the common case).

---

## 2. Background: how queue-start works today

- Queue-start is **tray-only**. There is no renderer UI that calls `api.startQueue`.
- Tray menu items (`src/main/tray-queues.ts` → `QUEUE_ACTIONS`) map to `RANKED_QUEUE_ID.SOLO_DUO` (420) and `RANKED_QUEUE_ID.FLEX` (440).
- Click → `tray.ts startQueue(label, queueId)` → `index.ts startQueue(queueId)` → `lcu.ts` module `startQueue(queueId)` → `LcuService.startQueue(queueId)`.
- `LcuService.startQueue`:
  1. `POST /lol-lobby/v2/lobby { queueId }`
  2. **if** `queueId` is a ranked queue → `PUT /lol-lobby/v1/lobby/members/localMember/position-preferences { firstPreference, secondPreference }` (best-effort; failure is logged, not fatal)
  3. `POST /lol-matchmaking/v1/search`
- `LcuService` already imports and uses `getSettings()` from `store.ts` (for auto-accept). So `startQueue` can read the new preference **directly** — no need to thread it through the IPC/tray/`startQueue` signatures.

This keeps the change localized to three places: the settings **type/default**, the **`lcu.ts` PUT body**, and the **Settings UI**.

---

## 3. Data model

### 3.1 Shared type — `src/shared/types.ts`

```ts
/** LCU lobby position-preference strings (PUT .../position-preferences). */
export type RankedPosition =
	| "FILL"
	| "UNSELECTED"
	| "TOP"
	| "JUNGLE"
	| "MIDDLE"
	| "BOTTOM"
	| "UTILITY"
```

Stored as the LCU's own uppercase strings so there is **no mapping at the LCU boundary** — the stored values are exactly what the PUT body needs. The UI maps these to friendly labels (Top/Jungle/Mid/Bot/Support/Fill/None); main sends them verbatim.

Add to `AppSettings`:

```ts
rankedPositions: { first: RankedPosition; second: RankedPosition }
// default { first: "FILL", second: "UNSELECTED" }
```

Add to `DEFAULT_SETTINGS`:

```ts
rankedPositions: { first: "FILL", second: "UNSELECTED" },
```

**Backward compatibility:** `store.ts` `getSettings()` returns `{ ...DEFAULT_SETTINGS, ...store.get("settings") }`, so already-persisted settings (which lack `rankedPositions`) transparently fall back to the default. No migration needed.

---

## 4. Validation / normalize

A pure helper keeps the LCU body always-valid regardless of how the stored value got there:

```ts
// src/main/lcu-mappers.ts
export function resolveRankedPreferences(prefs: {
	first: RankedPosition
	second: RankedPosition
}): { firstPreference: RankedPosition; secondPreference: RankedPosition }
```

Rules:

- If `first === "FILL"` → `second` forced to `"UNSELECTED"` (League ignores a secondary when filling).
- If `second === first` and `first` is a specific role → `second` forced to `"UNSELECTED"` (League rejects duplicate primary/secondary).
- Otherwise pass through unchanged.

The UI prevents these states from being entered, but main normalizes **defensively** so a hand-edited store or a future bug can never send an invalid pair to the client.

`LcuService.startQueue` uses it:

```ts
if (queueId === RANKED_QUEUE_ID.SOLO_DUO || queueId === RANKED_QUEUE_ID.FLEX) {
	const body = resolveRankedPreferences(getSettings().rankedPositions)
	try {
		await this.request("PUT", "/lol-lobby/v1/lobby/members/localMember/position-preferences", body)
	} catch (error) {
		console.warn("[lcu] position-preferences (best-effort) failed:", error)
	}
}
```

---

## 5. UI — Settings page

A new `Group label="Ranked"` in `src/renderer/src/pages/settings.tsx` (placed after the "Champ select" group, before `BanEditor`), containing one `Row`:

- **Title:** "Position preferences"
- **Desc:** "Roles requested when you start a ranked or flex queue from the tray."
- **Control:** two dropdowns side by side — **First** and **Second**.

Dropdown options + behavior:

- **First:** Fill, Top, Jungle, Mid, Bot, Support. (Maps to `FILL | TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY`.)
- **Second:** None, Top, Jungle, Mid, Bot, Support. (Maps to `UNSELECTED | TOP | JUNGLE | MIDDLE | BOTTOM | UTILITY`.)
- When **First = Fill**, the Second dropdown is **disabled and shows "None"** (writes `UNSELECTED`).
- The Second dropdown **excludes whichever role First currently is** (can't request the same role twice).
- Selecting a First that collides with the current Second resets Second to "None".

A small label map (`RankedPosition` ⇄ display label) lives next to the component. Writes go through the existing `useSetSettings()` mutation: `setSettings.mutate({ rankedPositions: { first, second } })`.

### 5.1 New `Select` primitive

There is no `Select` in `src/renderer/src/components/ui/` today (only button/input/switch/textarea). The `base-vega` shadcn style is **Base UI based** (e.g. `switch.tsx` wraps `@base-ui/react/switch`), and `@base-ui/react` (which ships a full `select` anatomy) is already a dependency. So rather than the `shadcn` CLI, hand-write a thin wrapper over `@base-ui/react/select` matching `switch.tsx`'s conventions (theme tokens in `global.css`, `cn()`, lucide icons). This is deterministic (no registry/network) and guaranteed to match the design system.

The wrapper exposes a simple controlled API (`value`, `options`, `onChange`, `disabled`) so the settings component doesn't juggle Base UI's sub-parts. Keep it under the ~300-line UI convention. The settings-row logic (option filtering, the "force None when Fill" / "exclude duplicate" rules, label maps) lives in a small dedicated component `components/settings/ranked-positions.tsx` with its pure logic split into `ranked-positions-logic.ts` (so it's unit-testable without rendering) — `settings.tsx` only mounts the group.

---

## 6. Testing

- **Unit-test `resolveRankedPreferences`** (`lcu-mappers` test) covering:
  - default `{ FILL, UNSELECTED }` → unchanged.
  - `first = "FILL"`, `second = "TOP"` → second forced `UNSELECTED`.
  - `first = "MIDDLE"`, `second = "MIDDLE"` → second forced `UNSELECTED`.
  - valid distinct pair (`first = "MIDDLE"`, `second = "TOP"`) → unchanged.
- **UI option-filtering** is trivial and covered by manual verification (force-fake mode / Vite renderer) — no heavy test.
- The default value guarantees existing-settings parity; a quick check that `getSettings()` on a store without the field returns the default is covered by the existing store behavior (spread of `DEFAULT_SETTINGS`).

### 6.1 Known untested-against-real-client surface

`LcuService.startQueue`'s live `PUT .../position-preferences` has **never been exercised against a running League client** — only the fake bridge + unit tests, consistent with the rest of the queue-start/auto-setup path on this branch. This feature is code-correct and unit-tested, but the end-to-end "does the client accept this body and seat me in my chosen role" check is **pending the same real-client smoke test** the branch already owes. The spec does not claim otherwise.

---

## 7. Files touched

| File | Change |
|---|---|
| `src/shared/types.ts` | Add `RankedPosition` type; add `rankedPositions` to `AppSettings` + `DEFAULT_SETTINGS`. |
| `src/main/lcu-mappers.ts` | Add `resolveRankedPreferences` helper. |
| `src/main/lcu-mappers.test.ts` | **New file** — unit tests for `resolveRankedPreferences`. |
| `src/main/lcu.ts` | Use `resolveRankedPreferences(getSettings().rankedPositions)` for the PUT body. |
| `src/renderer/src/components/ui/select.tsx` | New `Select` primitive wrapping `@base-ui/react/select`. |
| `src/renderer/src/components/settings/ranked-positions-logic.ts` | New file — pure label maps + option/clamp helpers. |
| `src/renderer/src/components/settings/ranked-positions-logic.test.ts` | New file — unit tests for the UI logic. |
| `src/renderer/src/components/settings/ranked-positions.tsx` | New settings-row component (the two dropdowns). |
| `src/renderer/src/pages/settings.tsx` | Add the "Ranked" group rendering the new component. |

No changes to IPC channels, the preload `Api`, the tray, or `startQueue` signatures.

---

## 8. Compliance check (PRD §14)

- Position preferences are part of **lobby setup**, set only on an explicit tray queue-start click. No new automated writes, no auto-pick/auto-ban/auto-dodge. The preference merely chooses which roles to *request* — the user still owns the click. Within the existing compliance envelope.
