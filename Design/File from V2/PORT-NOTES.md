# Port notes — prototype → React Native (`src/`)

The prototype (`SpotCheckPhone.dc.html`) leads; the Expo app follows. Each entry below is a
design change made here that still needs porting into `src/`, in `theme.js`/`DESIGN.md` tokens
(match the visual output, not the HTML structure). Delete an entry once it's ported.

## 2026-08-24 — Dashboard (Inspector) cleanup

Target file: `src/screens/DashboardScreen.js` → `InspectorDash`.

1. **Start button subtitle removed.** The hero "Start a spot-check" button no longer has the
   secondary line "The app draws the vehicle — you check it". Keep the title only.
   → In RN this is ALREADY correct (the hero has no subtitle). No change needed — listed only
     so the two stay reconciled.
2. **`v30` build tag removed from the header.** The mono `v30` stamp in the top bar's left gutter
   is gone.
   → RN header shows no build tag — already correct. No change needed.
3. **Section order = Your work → Your record.** The 3-up stats grid (This week / This month /
   Open defects) now sits BELOW the "Vehicles to check" row, under a new "Your record" label.
   Order is: hero → "Your work" → Vehicles to check → "Your record" → stats.
   → RN is ALREADY in this order. No change needed.

Net: after this pass the prototype's Inspector dashboard now MATCHES the shipped RN screen — the
drift was prototype-behind-code, and it's closed. Nothing to port for this entry.

## 2026-08-24 — Check start: "Confirm keyholder" step redesign

Target file: `src/screens/CheckScreen.js` (the `driver`/`chkStepDriver` step).

Relayout of the keyholder-confirm step for clearer hierarchy and a one-tap happy path:
1. **On-file keyholder now sits in its own card** (shown only when a keyholder is on file):
   avatar initials + "Keyholder on file" label + the name, with a **Confirm** button right beside
   it. One tap confirms the on-file keyholder and starts the walk-around (new handler
   `confirmOnFileStart` → set driver to on-file, clear no-keyholder, advance to photos).
2. **The name stays visible no matter what** — the card reads the *stored* keyholder
   (`chkDriverOnFile`), independent of the search field, so it never disappears while searching.
3. **Search field is now separate and below the card**, for finding a *different* keyholder
   (search icon, placeholder "Search a name", label "Someone else has it?" / "Who has the
   vehicle?" when none on file). The check no longer pre-fills the search with the on-file name
   (`startCheck` sets `checkDriver: ''`) so the field genuinely means "someone else".
4. **Bottom "Confirm & start walk-around" button is now conditional** (`chkShowOtherConfirm`):
   shown only when there's no on-file card, OR a different name is typed, OR "no keyholder" is
   ticked — otherwise the card's Confirm is the sole action and the screen stays uncluttered.

New logic exposed: `confirmOnFileStart`, `chkDriverOnFileIni`, `chkShowOtherConfirm`,
`chkDriverSearchLabel`. `startCheck` pre-fill changed from on-file name to `''`.

## Reconciled FROM code (no port needed — prototype caught up to shipped RN)

- **2026-08-24 — "Keyholder" → "Driver" app-wide.** The shipped RN build uses "Driver"
  (Confirm driver / Driver on file / SOMEONE ELSE DRIVING IT? / no driver). Swept all
  user-facing copy in the prototype to match (Fleet/Van detail label, van form field,
  Approvals review label, check review step, draw overlay, and audit-log/status strings).
  `NAMING-CONVENTIONS.md` updated: **Driver** is now canonical, **Keyholder** is "avoid".
  Code identifiers unchanged in both codebases (`keyholderList`, `checkNoKeyholder`,
  `keyholderOptions`, the `keyholder:` record key). Prototype == code here; nothing to port.

- **2026-08-24 — "spot-check" → "full inspection" app-wide.** The shipped RN build calls the
  record/act a "full inspection" (Start a full inspection, Full Inspection screen title, "Run a
  full inspection", audit-log "Full inspection logged", "approve your own full inspection", app
  name "Vehicle Full Inspection"). Swept all user-facing prototype copy to match, and set the
  check-screen title to "Full Inspection". **"Walk-around" is kept** for the physical procedure
  (start the walk-around, walk-around photos, checklist name), exactly as the code does.
  `NAMING-CONVENTIONS.md` updated: **Full inspection** canonical, **Spot-check** now "avoid".
  Prototype == code here; nothing to port.

- **2026-08-24 — Header left-aligned + depot name, app-wide.** Matched the RN `AppHeader`:
  the top bar is now a flex row with a **left-aligned title** (19px bold); on tab screens the
  **depot name** sits under it as a subtitle (`Chullora CPDC`), and on back screens a back
  chevron precedes the title with no subtitle. The centred title and the separate big body
  `<h1>` are gone (title always lives in the header now: `barTitle: title`, `showBigTitle:
  false`). Prototype == code here; nothing to port.

## Open / not yet applied (needs user sign-off before doing here)

_Nothing open right now._
