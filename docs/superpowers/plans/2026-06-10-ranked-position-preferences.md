# Ranked Position Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user configure the first/second role preferences sent when starting a ranked or flex queue from the tray, replacing the hardcoded `FILL`/`UNSELECTED`.

**Architecture:** A new shared `rankedPositions` setting (stored as the LCU's own uppercase position strings, default `FILL`/none) is read directly by `LcuService.startQueue` via the already-imported `getSettings()` — so no IPC/tray/signature changes. A defensive `resolveRankedPreferences` normalizer guarantees a valid PUT body. The UI adds a "Ranked" Settings group with two dropdowns built on a new `@base-ui/react/select` wrapper.

**Tech Stack:** TypeScript, Electron (main), React 19 + Tailwind v4 (renderer), Base UI (`@base-ui/react`), Vitest, electron-store.

> **Session note:** The user asked not to commit anything this session. The plan includes commit steps as the standard format; if executing in that same session, skip the `git commit` steps (or confirm first) and run the verification commands only.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/shared/types.ts` | `RankedPosition` type; `rankedPositions` field on `AppSettings` + `DEFAULT_SETTINGS`. |
| `src/main/lcu-mappers.ts` | `resolveRankedPreferences` — defensive normalize → valid PUT body. |
| `src/main/lcu-mappers.test.ts` | **New** — unit tests for `resolveRankedPreferences`. |
| `src/main/lcu.ts` | `startQueue` reads the setting and sends the normalized body. |
| `src/renderer/src/components/ui/select.tsx` | **New** — controlled `Select` wrapper over `@base-ui/react/select`. |
| `src/renderer/src/components/settings/ranked-positions-logic.ts` | **New** — pure label maps + option/clamp helpers. |
| `src/renderer/src/components/settings/ranked-positions-logic.test.ts` | **New** — unit tests for the UI logic. |
| `src/renderer/src/components/settings/ranked-positions.tsx` | **New** — the two-dropdown settings row. |
| `src/renderer/src/pages/settings.tsx` | Mount a "Ranked" group. |

No changes to IPC channels, preload `Api`, tray, or `startQueue` signatures. `FIXTURE_SETTINGS = { ...DEFAULT_SETTINGS }`, so the fake bridge inherits the new field automatically.

---

## Task 1: Add the `RankedPosition` type and setting

**Files:**
- Modify: `src/shared/types.ts` (the `AppSettings` interface ~163-172 and `DEFAULT_SETTINGS` ~174-183)

- [ ] **Step 1: Add the `RankedPosition` type**

In `src/shared/types.ts`, directly above `export interface AppSettings {`, add:

```ts
/** LCU lobby position-preference strings (PUT /lol-lobby/v1/.../position-preferences). */
export type RankedPosition =
	| "FILL"
	| "UNSELECTED"
	| "TOP"
	| "JUNGLE"
	| "MIDDLE"
	| "BOTTOM"
	| "UTILITY"
```

- [ ] **Step 2: Add the field to `AppSettings`**

Inside `export interface AppSettings { ... }`, add after the `mains` line:

```ts
	// roles requested when starting a ranked/flex queue from the tray; default Fill/none
	rankedPositions: { first: RankedPosition; second: RankedPosition }
```

- [ ] **Step 3: Add the default to `DEFAULT_SETTINGS`**

Inside `export const DEFAULT_SETTINGS: AppSettings = { ... }`, add after the `mains: [],` line:

```ts
	rankedPositions: { first: "FILL", second: "UNSELECTED" },
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors. (`FIXTURE_SETTINGS` and `getSettings()` both spread `DEFAULT_SETTINGS`, so nothing else needs the field yet.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: add rankedPositions setting (default Fill/none)"
```

---

## Task 2: `resolveRankedPreferences` normalizer (TDD)

**Files:**
- Create: `src/main/lcu-mappers.test.ts`
- Modify: `src/main/lcu-mappers.ts` (add the export; it already exports `RANKED_QUEUE_ID`)

- [ ] **Step 1: Write the failing test**

Create `src/main/lcu-mappers.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { resolveRankedPreferences } from "./lcu-mappers"

describe("resolveRankedPreferences", () => {
	it("passes through the default Fill/none", () => {
		expect(resolveRankedPreferences({ first: "FILL", second: "UNSELECTED" })).toEqual({
			firstPreference: "FILL",
			secondPreference: "UNSELECTED",
		})
	})

	it("forces second to UNSELECTED when first is FILL", () => {
		expect(resolveRankedPreferences({ first: "FILL", second: "TOP" })).toEqual({
			firstPreference: "FILL",
			secondPreference: "UNSELECTED",
		})
	})

	it("forces second to UNSELECTED when it duplicates a specific first", () => {
		expect(resolveRankedPreferences({ first: "MIDDLE", second: "MIDDLE" })).toEqual({
			firstPreference: "MIDDLE",
			secondPreference: "UNSELECTED",
		})
	})

	it("passes through a valid distinct pair", () => {
		expect(resolveRankedPreferences({ first: "MIDDLE", second: "TOP" })).toEqual({
			firstPreference: "MIDDLE",
			secondPreference: "TOP",
		})
	})
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/main/lcu-mappers.test.ts`
Expected: FAIL — `resolveRankedPreferences` is not exported from `./lcu-mappers`.

- [ ] **Step 3: Implement the helper**

In `src/main/lcu-mappers.ts`, add `RankedPosition` to the existing top-of-file `import type { ... } from "@/shared/types"` block (it already imports `ChampSelectAction`, `RankInfo`, etc.). Exact placement doesn't matter — `pnpm format` (Task 7) reorders imports. Result, e.g.:

```ts
import type {
	ChampSelectAction,
	ChampSelectPlayer,
	ChampSelectSession,
	InGameState,
	RankedPosition,
	RankInfo,
	ReadyCheck,
	SummonerIdentity,
} from "@/shared/types"
```

Then add `resolveRankedPreferences`, directly below the `RANKED_QUEUE_ID` declaration (~line 103):

```ts
/**
 * Normalize a stored ranked-positions pair into a valid LCU position-preferences
 * body. The Settings UI prevents invalid pairs, but normalize defensively so a
 * hand-edited store or future bug can never send the client an illegal request.
 */
export function resolveRankedPreferences(prefs: {
	first: RankedPosition
	second: RankedPosition
}): { firstPreference: RankedPosition; secondPreference: RankedPosition } {
	const first = prefs.first
	// Fill ignores a secondary; a duplicate primary/secondary is rejected by the client
	const second = first === "FILL" || prefs.second === first ? "UNSELECTED" : prefs.second
	return { firstPreference: first, secondPreference: second }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/main/lcu-mappers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/main/lcu-mappers.ts src/main/lcu-mappers.test.ts
git commit -m "feat: add resolveRankedPreferences normalizer"
```

---

## Task 3: Wire the setting into `startQueue`

**Files:**
- Modify: `src/main/lcu.ts` (the `startQueue` method ~321-336; imports ~23-37)

- [ ] **Step 1: Import the helper**

In `src/main/lcu.ts`, the import block from `"./lcu-mappers"` already includes `RANKED_QUEUE_ID`. Add `resolveRankedPreferences` to that same import block (alphabetical order is enforced by biome; place it accordingly, e.g. after `rankedQueueOf`):

```ts
	RANKED_QUEUE_ID,
	type RawChampSelectSession,
	type RawCurrentSummoner,
	type RawGameflowSession,
	type RawRankedStats,
	type RawReadyCheck,
	rankedQueueOf,
	resolveRankedPreferences,
	toChampSelectSession,
```

(`getSettings` is already imported from `"./store"` on the line `import { getLockinRunePageId, getSettings, setLockinRunePageId } from "./store"`.)

- [ ] **Step 2: Replace the hardcoded body**

In `startQueue`, replace this block:

```ts
			if (queueId === RANKED_QUEUE_ID.SOLO_DUO || queueId === RANKED_QUEUE_ID.FLEX) {
				try {
					await this.request(
						"PUT",
						"/lol-lobby/v1/lobby/members/localMember/position-preferences",
						{ firstPreference: "FILL", secondPreference: "UNSELECTED" },
					)
				} catch (error) {
					console.warn("[lcu] position-preferences (best-effort) failed:", error)
				}
			}
```

with:

```ts
			if (queueId === RANKED_QUEUE_ID.SOLO_DUO || queueId === RANKED_QUEUE_ID.FLEX) {
				try {
					await this.request(
						"PUT",
						"/lol-lobby/v1/lobby/members/localMember/position-preferences",
						resolveRankedPreferences(getSettings().rankedPositions),
					)
				} catch (error) {
					console.warn("[lcu] position-preferences (best-effort) failed:", error)
				}
			}
```

- [ ] **Step 3: Verify typecheck and existing tests pass**

Run: `pnpm typecheck && pnpm vitest run src/main`
Expected: typecheck clean; all main-process tests pass (including the new `lcu-mappers.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/main/lcu.ts
git commit -m "feat: start ranked queue with configured position preferences"
```

---

## Task 4: `Select` UI primitive (Base UI wrapper)

**Files:**
- Create: `src/renderer/src/components/ui/select.tsx`

- [ ] **Step 1: Write the wrapper**

Create `src/renderer/src/components/ui/select.tsx`:

```tsx
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { cn } from "@renderer/lib/utils"
import { Check, ChevronDown } from "lucide-react"

export interface SelectOption<T extends string> {
	value: T
	label: string
	disabled?: boolean
}

interface SelectProps<T extends string> {
	value: T
	options: SelectOption<T>[]
	onChange: (value: T) => void
	disabled?: boolean
	className?: string
}

function Select<T extends string>({
	value,
	options,
	onChange,
	disabled,
	className,
}: SelectProps<T>): React.JSX.Element {
	const labelOf = (v: T): string => options.find((o) => o.value === v)?.label ?? String(v)
	return (
		<SelectPrimitive.Root
			value={value}
			disabled={disabled}
			onValueChange={(next) => onChange(next as T)}
		>
			<SelectPrimitive.Trigger
				data-slot="select-trigger"
				className={cn(
					"inline-flex h-8 min-w-[112px] items-center justify-between gap-2",
					"rounded-sm border border-(--stroke-default) bg-ink-950 px-3",
					"text-[12px] font-semibold leading-none text-(--fg-1)",
					"outline-none cursor-pointer",
					"transition-[border-color] duration-(--dur-base) ease-(--ease-standard)",
					"hover:border-(--stroke-strong) focus-visible:ring-2 focus-visible:ring-accent",
					"data-disabled:cursor-not-allowed data-disabled:opacity-40",
					className,
				)}
			>
				<SelectPrimitive.Value>{(v: T) => labelOf(v)}</SelectPrimitive.Value>
				<SelectPrimitive.Icon className="text-(--fg-4)">
					<ChevronDown size={14} />
				</SelectPrimitive.Icon>
			</SelectPrimitive.Trigger>
			<SelectPrimitive.Portal>
				<SelectPrimitive.Positioner sideOffset={4} align="start" className="z-50">
					<SelectPrimitive.Popup
						className={cn(
							"min-w-[var(--anchor-width)] overflow-hidden rounded-sm p-1",
							"border border-(--stroke-default) bg-ink-900 shadow-lg",
						)}
					>
						{options.map((opt) => (
							<SelectPrimitive.Item
								key={opt.value}
								value={opt.value}
								disabled={opt.disabled}
								className={cn(
									"flex cursor-pointer items-center justify-between gap-3 rounded-[4px]",
									"px-2 py-[6px] text-[12px] font-medium leading-none text-(--fg-2)",
									"outline-none select-none",
									"data-highlighted:bg-accent data-highlighted:text-accent-fg",
									"data-disabled:cursor-not-allowed data-disabled:opacity-40",
								)}
							>
								<SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
								<SelectPrimitive.ItemIndicator>
									<Check size={13} />
								</SelectPrimitive.ItemIndicator>
							</SelectPrimitive.Item>
						))}
					</SelectPrimitive.Popup>
				</SelectPrimitive.Positioner>
			</SelectPrimitive.Portal>
		</SelectPrimitive.Root>
	)
}

export { Select }
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors. If a Base UI prop name mismatches (e.g. `Value`'s render-children signature, or `Positioner` props), consult the installed types under `node_modules/@base-ui/react/select/**/*.d.ts` and adjust — `Root` takes `value` / `onValueChange` / `disabled`; `Item` takes `value` / `disabled`; `Value` children may be a node or `(value) => ReactNode`.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/ui/select.tsx
git commit -m "feat: add Select UI primitive over @base-ui/react/select"
```

---

## Task 5: Ranked-positions UI logic (TDD)

**Files:**
- Create: `src/renderer/src/components/settings/ranked-positions-logic.ts`
- Create: `src/renderer/src/components/settings/ranked-positions-logic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/renderer/src/components/settings/ranked-positions-logic.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { FIRST_OPTIONS, clampSecond, secondOptions } from "./ranked-positions-logic"

describe("ranked-positions-logic", () => {
	it("offers Fill + the five roles as first options", () => {
		expect(FIRST_OPTIONS.map((o) => o.value)).toEqual([
			"FILL",
			"TOP",
			"JUNGLE",
			"MIDDLE",
			"BOTTOM",
			"UTILITY",
		])
	})

	it("second options start with None and exclude the chosen first role", () => {
		const opts = secondOptions("MIDDLE").map((o) => o.value)
		expect(opts[0]).toBe("UNSELECTED")
		expect(opts).not.toContain("MIDDLE")
		expect(opts).toContain("TOP")
	})

	it("clampSecond forces UNSELECTED when first is FILL", () => {
		expect(clampSecond("FILL", "TOP")).toBe("UNSELECTED")
	})

	it("clampSecond forces UNSELECTED when second duplicates first", () => {
		expect(clampSecond("TOP", "TOP")).toBe("UNSELECTED")
	})

	it("clampSecond keeps a valid distinct second", () => {
		expect(clampSecond("MIDDLE", "TOP")).toBe("TOP")
	})
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/renderer/src/components/settings/ranked-positions-logic.test.ts`
Expected: FAIL — module `./ranked-positions-logic` not found.

- [ ] **Step 3: Implement the logic**

Create `src/renderer/src/components/settings/ranked-positions-logic.ts`:

```ts
import type { SelectOption } from "@renderer/components/ui/select"

import type { RankedPosition } from "@/shared/types"

/** The five assignable roles, in lane order. */
const ROLES: { value: RankedPosition; label: string }[] = [
	{ value: "TOP", label: "Top" },
	{ value: "JUNGLE", label: "Jungle" },
	{ value: "MIDDLE", label: "Mid" },
	{ value: "BOTTOM", label: "Bot" },
	{ value: "UTILITY", label: "Support" },
]

/** First-preference choices: Fill (auto) + the five roles. */
export const FIRST_OPTIONS: SelectOption<RankedPosition>[] = [
	{ value: "FILL", label: "Fill" },
	...ROLES,
]

/** Second-preference choices for a given first: None, then every role except first. */
export function secondOptions(first: RankedPosition): SelectOption<RankedPosition>[] {
	return [{ value: "UNSELECTED", label: "None" }, ...ROLES.filter((r) => r.value !== first)]
}

/** Keep a (first, second) pair legal: Fill or a duplicate collapses second to None. */
export function clampSecond(first: RankedPosition, second: RankedPosition): RankedPosition {
	return first === "FILL" || second === first ? "UNSELECTED" : second
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/renderer/src/components/settings/ranked-positions-logic.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/settings/ranked-positions-logic.ts src/renderer/src/components/settings/ranked-positions-logic.test.ts
git commit -m "feat: add ranked-positions UI option/clamp logic"
```

---

## Task 6: Ranked-positions settings component

**Files:**
- Create: `src/renderer/src/components/settings/ranked-positions.tsx`

- [ ] **Step 1: Write the component**

Create `src/renderer/src/components/settings/ranked-positions.tsx`:

```tsx
import { Row } from "@renderer/components/settings/settings-rows"
import { Select } from "@renderer/components/ui/select"
import { useSetSettings, useSettings } from "@renderer/hooks/use-data"

import type { RankedPosition } from "@/shared/types"

import { FIRST_OPTIONS, clampSecond, secondOptions } from "./ranked-positions-logic"

export function RankedPositions(): React.JSX.Element | null {
	const { data: settings } = useSettings()
	const setSettings = useSetSettings()
	if (!settings) return null

	const { first, second } = settings.rankedPositions
	const fillSelected = first === "FILL"

	const setFirst = (next: RankedPosition): void => {
		setSettings.mutate({
			rankedPositions: { first: next, second: clampSecond(next, second) },
		})
	}
	const setSecond = (next: RankedPosition): void => {
		setSettings.mutate({ rankedPositions: { first, second: clampSecond(first, next) } })
	}

	return (
		<Row
			last
			title="Position preferences"
			desc="Roles requested when you start a ranked or flex queue from the tray."
			control={
				<div className="flex items-center gap-2">
					<Select value={first} options={FIRST_OPTIONS} onChange={setFirst} />
					<Select
						value={fillSelected ? "UNSELECTED" : second}
						options={secondOptions(first)}
						onChange={setSecond}
						disabled={fillSelected}
					/>
				</div>
			}
		/>
	)
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: no errors. (`useSettings`/`useSetSettings` are exported from `@renderer/hooks/use-data`, confirmed by `settings.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/settings/ranked-positions.tsx
git commit -m "feat: add ranked position-preferences settings row"
```

---

## Task 7: Mount the "Ranked" group in Settings

**Files:**
- Modify: `src/renderer/src/pages/settings.tsx` (import ~1-9; JSX after the "Champ select" `</Group>` ~146, before `<BanEditor />` ~148)

- [ ] **Step 1: Import the component**

In `src/renderer/src/pages/settings.tsx`, add to the settings-component imports (next to `MainsEditor`):

```ts
import { RankedPositions } from "@renderer/components/settings/ranked-positions"
```

- [ ] **Step 2: Render a "Ranked" group**

Between the closing `</Group>` of the "Champ select" group and `<BanEditor />`, add:

```tsx
				<Group label="Ranked">
					<RankedPositions />
				</Group>
```

- [ ] **Step 3: Verify typecheck, format, and full suite**

Run: `pnpm typecheck && pnpm format && pnpm test`
Expected: typecheck clean; biome clean; all tests pass (the prior `94` plus the new `resolveRankedPreferences` (4) and `ranked-positions-logic` (5) tests).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/pages/settings.tsx
git commit -m "feat: surface ranked position preferences in Settings"
```

---

## Task 8: Manual verification (force-fake renderer)

**Files:** none (verification only)

- [ ] **Step 1: Launch the renderer in fake mode**

Run: `ELECTRON_ENABLE_LOGGING=1 pnpm dev` (leave running). The renderer is also served at `http://localhost:5173`; in a plain browser `window.api` is undefined so it auto-uses the fake bridge (no `forceFake` needed). See `lockin-dev-verification-setup` memory.

- [ ] **Step 2: Drive the Settings screen via Playwright MCP**

- `browser_navigate` → `http://localhost:5173`, then navigate to Settings (click the Settings nav).
- Confirm a **"Ranked"** group with a **"Position preferences"** row and two dropdowns.
- `browser_take_screenshot` for the default state (First = **Fill**, Second = **None**, second disabled).

- [ ] **Step 3: Verify the interaction rules**

- Set First = **Mid**: the Second dropdown enables, its options are None/Top/Jungle/Bot/Support (no **Mid**).
- Set Second = **Top**, then change First = **Top**: Second resets to **None** (clamp on duplicate).
- Set First back to **Fill**: Second disables and shows **None**.
- Screenshot each state. (These exercise `clampSecond` + `secondOptions` through the live component.)

- [ ] **Step 4: Note the real-client gap**

The live `PUT /lol-lobby/v1/.../position-preferences` is **not** exercised here (fake bridge). Record in the branch's pending smoke-test checklist: "start a ranked queue from the tray with a non-Fill preference and confirm the client seats the chosen role." Do not claim the end-to-end path is verified.

---

## Self-review notes

- **Spec coverage:** §3 data model → Task 1; §4 normalize → Task 2 + Task 3; §5 UI → Tasks 4–7; §5.1 Select primitive → Task 4; §6 testing → Tasks 2 & 5 (unit) + Task 8 (manual) + §6.1 real-client gap → Task 8 Step 4.
- **Type consistency:** `RankedPosition` (Task 1) is the single type used by `resolveRankedPreferences` (Task 2), `startQueue` (Task 3), `SelectOption<RankedPosition>` (Tasks 4–5), and the component (Task 6). Helper names are stable across tasks: `resolveRankedPreferences`, `FIRST_OPTIONS`, `secondOptions`, `clampSecond`, `Select`.
- **No new IPC/preload/tray/signature surface** — confirmed in the file structure table.
