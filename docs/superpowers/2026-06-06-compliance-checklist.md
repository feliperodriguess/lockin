# PRD §14 compliance — release-gate checklist (audited 2026-06-06)

> Code-audit evidence from the overnight integration run. Re-run the greps before any public release.

## Audited tonight — PASS

| Constraint (PRD §14) | Evidence |
|---|---|
| **LCU (client) API only — never the game process/memory** | `grep -rn "2999\|liveclientdata\|GameClient\|game memory" src/` → empty. All network surface: `league-connect` to `127.0.0.1:<lcu-port>` (main only) + DDragon CDN + nothing else. |
| **Write surface = ready check only** | `grep -rn '"POST"' src/main/` → exactly 3 hits, all in `lcu.ts`: the `request()` helper (typed `method: "POST"` only) and the two call sites — `/lol-matchmaking/v1/ready-check/accept`, `/lol-matchmaking/v1/ready-check/decline`. No PUT/PATCH/DELETE anywhere in main. The decline is a **manual** action (D16 contract addition); the only *automated* write is accept. |
| **Auto-accept off by default** | `DEFAULT_SETTINGS.autoAccept: false` (`src/shared/types.ts:117`); fresh-store boot verified returning `false` in the Phase 3 smoke; settings screen copy says "Off by default — you stay in control." |
| **No auto-pick/ban/dodge** | The auto-accept state machine is the only automation (`lcu.ts`); decline-guard re-traced in the Phase 3 post-impl verification; no champ-select write endpoints exist in the codebase. |
| **No Riot branding in app identity** | `grep -rni "league of legends\|riot games"` over renderer components, `index.html`, `package.json` → no hits. App name `lockin`, own wordmark/icon. (PRD.md/docs mention the names descriptively — allowed; DDragon champion/spell icons are explicitly fine.) |
| **Data Dragon usage** | Static catalog + icons by URL only, `en_US` constant, disk-cached (PRD §10). |

## Open release-gate items (Felipe, pre-release)

- [ ] **Riot policy + Vanguard posture check** (PRD §14): verify the current third-party tooling policy and Vanguard behavior before any public distribution. The app stays on the tolerated LCU surface, but §14 makes this an explicit release-time human decision.
- [ ] **Auto-accept risk acknowledgment**: §14 flags it as the one gray-area feature. It ships off-by-default with explanatory copy — confirm you're comfortable shipping it at all.
- [ ] **Signing + notarization** (deferred per E2): unsigned builds need a manual Gatekeeper override; distribution requires Developer ID + notarization via electron-builder's `mac`/`notarize` config (PRD §13).
- [ ] **Packaging** (deferred per E2): `pnpm build:mac` once signing is configured.
