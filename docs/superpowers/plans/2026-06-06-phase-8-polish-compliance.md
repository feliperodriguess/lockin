# Phase 8 — Polish Pass + Compliance Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Final visual pass across all dev-switcher states (regression hunt — integration must not have broken the Phase-1-approved look), the PRD §14 compliance release-gate checklist committed to the repo, and small repo hygiene. **No packaging/signing (E2).**

**Method:** force-fake mode (`localStorage["lockin:forceFake"]="1"` + reload — the flag is read once at module init) routes the whole API to the fake bridge, making every switcher state drivable without a client. CDP clicks the switcher buttons and screenshots each state; each PNG is inspected for obvious breakage (layout, icons, empty states, regressions vs the Phase-1 look Felipe approved). Compliance is verified by grep-audit of the actual code surface, not assertions from memory.

**States to capture (handoff coverage):** Disconnected · Idle · Ready Check (waiting) · Champ Select ban (enemy hidden) · Champ Select pick (enemy shown) · ranks N/A · note none · role pending · Notes page · Settings page.

---

### Task 1: Repo hygiene

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1:** Append `.claude/` to `.gitignore` (scheduler lock artifacts appeared during the overnight run).
- [ ] **Step 2:** `git add .gitignore && git commit -m "chore: ignore .claude/ session artifacts"`

---

### Task 2: Visual regression pass (force-fake, all states)

**Files:** none (verification; fixes get their own commits)

- [ ] **Step 1:** Boot (`ELECTRON_ENABLE_LOGGING=1 pnpm dev > /tmp/lockin-phase8-smoke.log 2>&1`), wait for connect, then enable force-fake and reload:

```bash
node scripts/cdp.mjs eval 'localStorage.setItem("lockin:forceFake", "1"); location.reload(); "reloading"'
```

(Confirm afterwards: `node scripts/cdp.mjs eval 'localStorage.getItem("lockin:forceFake")'` → `"1"`; the switcher's FAKE API toggle shows on.)

- [ ] **Step 2:** For each state, click the switcher button by label and screenshot. Generic click helper (buttons are plain `<button>`s inside the switcher):

```bash
node scripts/cdp.mjs eval '[...document.querySelectorAll("button")].find(b => b.textContent.trim() === "<LABEL>")?.click() ?? "not-found"'
node scripts/cdp.mjs shot /tmp/lockin-p8-<state>.png
```

Sequence (reset to defaults between champ-select variants where needed):
1. `Disconnected` → shot `disconnected`
2. `Idle` → shot `idle`
3. `Ready Check` → shot `ready` (countdown visibly ticking — take two shots 2s apart, numbers differ)
4. `Champ Selection` + `Ban` + `Hidden` → shot `cs-ban-hidden`
5. `Pick` + `Shown` → shot `cs-pick-shown`
6. `N/A` (ranks) → shot `cs-ranks-na` → click `OK` to restore
7. `None` (note) → shot `cs-note-none` → click `Has`
8. `Pending` (role) → shot `cs-role-pending` → click `Set`
9. Sidebar `Notes` → shot `notes` (fake notes visible in force-fake)
10. Sidebar `Settings` → shot `settings`

- [ ] **Step 3:** Read every PNG. Hunt for: missing icons/fallback tiles where icons should resolve, broken layout/overflow, empty regions that should have content, wrong badges ("Your pick", threat, mismatch flag per state), countdown not ticking. Fix any regression found (own commit per fix), re-shoot.

- [ ] **Step 4:** Disable force-fake and confirm real mode returns:

```bash
node scripts/cdp.mjs eval 'localStorage.removeItem("lockin:forceFake"); location.reload(); "reloading"'
```
Expect Idle (real client) after reload. Kill the app.

---

### Task 3: Compliance release-gate checklist (PRD §14)

**Files:**
- Create: `docs/superpowers/2026-06-06-compliance-checklist.md`

- [ ] **Step 1:** Audit the code surface with greps (record outputs in the doc):
- LCU-only, no game process: `grep -rn "2999\|liveclientdata\|game.exe\|memory" src/` → empty (the Live Client Data API runs on :2999 — we never touch it).
- Write surface: `grep -rn '"POST"\|method: "POST"' src/main/` → exactly the ready-check accept + decline paths in `lcu.ts`; `grep -rn "PUT\|PATCH\|DELETE" src/main/lcu*.ts` → none.
- Auto-anything: `grep -rn "autoAccept" src/` → setting + guard paths only; no auto-pick/ban/dodge code anywhere.
- Off by default: `DEFAULT_SETTINGS.autoAccept === false` in `src/shared/types.ts`.
- Branding: `grep -rni "league of legends\|riot games" src/ package.json index.html` → no use in app identity (PRD §14; code comments/API URLs are fine); app name is `lockin`.

- [ ] **Step 2:** Write the checklist doc with the audit evidence + the open release-gate items (signing/notarization deferred per E2; "verify current Riot third-party policy + Vanguard posture before public release" — explicitly Felipe's pre-release action; auto-accept risk note per §14).

- [ ] **Step 3:** `git add docs/superpowers/2026-06-06-compliance-checklist.md && git commit -m "docs: PRD §14 compliance release-gate checklist with code-audit evidence"`

---

### Task 4: Completeness critic (final gate)

**Files:** none

- [ ] **Step 1:** Dispatch a fresh-eyes agent over the design doc §7 exit criteria + every PRD §6 acceptance box. For each: classify **done-verified** (with evidence pointer), **on-morning-checklist** (queue/client-dependent), or **MISSING**. Anything MISSING becomes immediate work tonight.

- [ ] **Step 2:** Fold the classification into the morning report.
