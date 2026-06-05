import type { Api } from "@/shared/api"

export const FORCE_FAKE_KEY = "lockin:forceFake"

/* DEV: load the fake bridge (tree-shaken from production builds).
   Top-level await is fine — Vite renderer targets modern Chromium. */
const fake = import.meta.env.DEV ? (await import("./fake/bridge")).fakeBridge : undefined

const forceFake = import.meta.env.DEV && window.localStorage.getItem(FORCE_FAKE_KEY) === "1"

/* Real preload channels win key-by-key; unimplemented ones answer from the fake.
   NOTE: production builds need the real bridge complete (Phase 7) — until then
   prod is not a shipping target (packaging is Phase 8). */
export const api: Api = forceFake && fake ? fake : ({ ...fake, ...window.api } as Api)
