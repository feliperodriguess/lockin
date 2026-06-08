# Live-verification checklist — overnight run 2026-06-06

> Everything below needs the real League client doing things I couldn't trigger unattended
> (quitting it, queuing, champ select). Each item names its phase and the PRD §6 box it closes.
> Run the app with `pnpm dev`. The dev switcher only drives previews behind the **force-fake**
> toggle now — without it, everything visible is real.

## A. Connection lifecycle (Phase 2 — the one untested transition)

- [ ] With the app running and connected (sidebar dot lit, "Idle"), **quit the League client**.
      Expect within ~3s: Disconnected screen, sidebar "Disconnected", terminal logs
      `[lcu] status: disconnected` then `[lcu] waiting for League client…`. Notes/Settings stay usable.
- [ ] **Reopen the client.** Expect auto-reconnect (no app restart): `[lcu] client found`,
      `[lcu] status: connected`, Idle screen back.

## B. Ready check (Phase 3 — §6.4)

- [ ] Auto-accept **off** (default): queue → pop → app shows countdown + Accept/Decline; both buttons work; the client reflects whichever you press.
- [ ] Auto-accept **on**, delay `0`: pop → accepted automatically (≈ instantly); app shows "Auto-accept handled it".
- [ ] Auto-accept **on**, delay `2s`: pop → fires after ~2s; log `[lcu] auto-accepted ready check`.
- [ ] **Decline guard:** auto-accept on, delay `4s` → during the delay press **Decline** → it must NOT re-accept (PRD: a decline is final). Same if you decline in the League client itself.
- [ ] **Back-to-back pops** (dodge/decline → requeue): second pop behaves like a fresh cycle (auto-accept fires again if on).
- [ ] Someone else declines mid-pop → app reflects the end state cleanly, no stuck UI.

## C. Champ select (Phases 3/4 — §6.4 timer + D12 full rail)

- [ ] Enter a real champ select (bot game is fine). The **full rail renders**: your champion,
      role tag (or "Role pending"), real teams with picks, real bans, phase timer counting down.
- [ ] Timer accuracy ≈1s vs the client's own countdown; ban→pick phase label flips correctly.
- [ ] Custom game with infinite timer → countdown hidden (`isInfinite`).
- [ ] Champion/spell icons are real images (DDragon); an unresolvable ID shows the tinted fallback tile, no crash.

## D. Notes during champ select (Phase 5 — §6.2)

- [ ] Write a note for the champion you'll play (general, no opponent) in the library beforehand.
      Lock that champion → the note appears in the rail within ~1s.
- [ ] Opponent-specific note: appears only once that enemy champion is picked/visible; hidden during your ban phase (general notes show instead).
- [ ] Inline edit in the rail saves and persists (check the library afterwards).

## E. Spells + bans during champ select (Phase 6 — §6.1 + §6.3)

- [ ] Spell pair matches your assigned role (jungle→Smite, top/mid→TP, ADC→Heal, support→Ignite); Flash sits on your configured D/F key.
- [ ] Pin spells on the matching note → pair switches to the pinned values with the "Your pick" badge.
- [ ] Build a ban list in Settings beforehand. During ban phase: list renders in priority order; champs banned/picked by anyone gray out **live** as bans land; a listed champ visibly picked by the enemy lifts to the top with the threat badge. (Enemy *hover* lift is fixture/test-only — real LCU hides enemy intent.)
- [ ] All listed champs gone → "your top bans are gone" state.

## F. Team ranks (Phase 7 — §6.5)

> Lobby type matters: a solo bot game gives you 4 bots with no puuids — no rank data and no
> mismatch flag is **correct** there. Use a co-op/PvP lobby with ranked humans to exercise the
> rank render + mismatch flag.
>
> Ranks are now **queue-aware** (commit `c43db45`): the rank shown follows the lobby's queue —
> a **flex** lobby shows flex rank, a **solo/duo** lobby shows solo rank. Since your account is
> flex-ranked only, you'll see your **GOLD IV in a flex lobby** and "Unranked" in a solo lobby.

- [ ] In champ select, your 5-player side shows ranks (or "Unranked"/— where missing); never blocks the rail.
- [ ] **Queue-aware check:** in a **flex** ranked champ select, your own row shows your flex rank (GOLD IV), not "Unranked". (Confirms `gameData.queue.id == 440` maps to flex as expected.)
- [ ] Mismatch flag appears when the lobby spread ≥ the configured sensitivity (test with Strict if your lobby is even).
- [ ] Apex-tier players (Master+) show tier only, no division.

## G. DDragon offline behavior (Phase 4 — optional)

- [ ] Wi-Fi off → relaunch app → champ/spell icons unavailable but cached *data* serves (names render); log `[ddragon] serving cached bundle`. (First-run-offline blank-Notes limitation is documented in the phase 4 plan.)

## H. Auto-accept compliance spot-check (PRD §14)

- [ ] Fresh check: Settings shows auto-accept **off** by default on a clean store.
- [ ] Nothing anywhere auto-picks, auto-bans, or auto-dodges.
