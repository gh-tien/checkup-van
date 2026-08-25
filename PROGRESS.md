# Vehicle Spot-Check — build progress

Porting the Claude Design prototype `SpotCheckPhone.dc.html` to a real **React Native / Expo** app.

## Decisions (locked with user)
- **Stack:** React Native / Expo (genuine native app).
- **Scope:** Runnable slice first — Lock/PIN → Dashboard → Draw → Spot-check → Submit. Then add the rest.
- **Device frame:** DROPPED. No iOS bezel/status bar/dynamic island — app fills the real screen.

## Naming (UI copy only; code keeps old identifiers like vanId/genVans/'vans')
Vehicle (not Van) · Fleet · Rego · Spot-check · Defect · Keyholder (not Driver) ·
Approve/Confirm · Send back · Redo · Draw · Pass/Fail · Mark fixed.
Roles: Inspector → Manager → Manager+ → Admin (inherit downward).

## Slice checklist — COMPLETE (bundles clean: "iOS Bundled index.js, 723 modules")
- [x] Read all slice template blocks (gate, dashboard, draw, check flow, bottom nav)
- [x] Scaffold Expo project (package.json, app.json, babel, index, App)
- [x] theme.js (palette + fonts)
- [x] data: people, checklist, fleet (genVans)
- [x] store.js (state machine + AsyncStorage persistence)
- [x] Icon component (react-native-svg)
- [x] GateScreen (search-pick + PIN pad; demo PIN 1234; dev skip / admin)
- [x] DashboardScreen (inspector + manager variants)
- [x] DrawOverlay (spin → settle → confirm/redraw)
- [x] CheckScreen (keyholder → photos → checklist pass/fail + defect sheet → review/sign → done)
- [x] BottomNav shell
- [x] Wire App.js — validated via `npx expo export -p ios` (723 modules, no errors). Run: `npx expo start`.

## Pass 2 — nav-level screens — COMPLETE (bundles clean: "iOS Bundled index.js, 728 modules")
- [x] `src/format.js` — fmtDate / parseDate / daysUntil / fmtNum / plural (Hermes has no Intl grouping)
- [x] theme.js + DESIGN.md token additions (dangerBorder, dangerDim, greenBorder, cardSubtle, cardAlt,
      inputBg, tintBlue, tintBlueBorder, primaryDim, slate) — `npx @google/design.md lint DESIGN.md` clean
- [x] Icon glyphs added: listCheck, users, help, gear, trash
- [x] store.js — STATUS map, roleOf/isManager/isAdmin/hasJobs/isOverdue/statOf/vanById,
      nav + fleet/van/doc/defect/approval actions, `submitCheck()` now attaches a `submission` payload
- [x] FleetScreen (search + filter chips with counts + status badges)
- [x] VanScreen (blocked banner, CTA, keyholder/odometer, documents + add/edit sheet, photo timeline,
      open jobs + Mark fixed, activity log)
- [x] ApprovalsScreen (returned/redo, awaiting queue, submission accordion, countersign + send-back sheet,
      week/month segment, approved records)
- [x] DefectsScreen (search, per-vehicle accordion, Mark fixed, open vehicle record)
- [x] MoreScreen (Management / Fleet / Support / App sections; admin-only rows)
- [x] Shell wiring: App.js routes + new `'van'` screen, AppHeader title/back for `'van'`
      (+ "My checks" title for inspectors), BottomNav marks Fleet active on `'van'`
- Three design-context files now exist: `DESIGN.md`, `CLAUDE.md`, `DECISIONS.md`.
- `src/screens/Placeholder.js` is no longer referenced by App.js; kept for the remaining deep screens.

## Pass 3 — real camera capture — COMPLETE (bundles clean: "iOS Bundled index.js, 735 modules")
- [x] `expo-camera ~16.0.18` installed; `app.json` declares the plugin + camera permission string
- [x] `src/components/CameraCapture.js` — full-screen overlay: permission gate → live preview →
      shutter / flip → confirm (Retake · Use photo). Mounted from `App.js` only while `state.camera` is set.
- [x] store: `camera` state + `capturePhoto(angle)` / `captureDefectPhoto()` / `savePhoto(uri)` /
      `closeCamera()` / `photosFor(angle)` / `photoCount()`
- [x] `checkPhotoMap` is now `{ angle: [fileUri, …] }` (was a per-angle count); defect
      `photos` is now an array of URIs (was a count). All readers updated.
- [x] Photos step shows the captured frame as the tile, with a translucent caption bar
- [x] Defect sheet shows 48pt thumbnails with per-photo remove; it hides while the camera is up
      rather than stacking two modals
- [x] `submitCheck()` stores `submission.shots` (one frame per angle) so Approvals →
      "View submission" renders the real photos; seeded checks still fall back to angle names

**Test it:** `npx expo start`, open on a physical device (the iOS Simulator has no camera),
sign in with PIN 1234 → Draw or pick a vehicle → Spot-check → Step 1 · Photos → tap any angle.

## Deferred to later passes
**Inside Vehicle detail (deliberate, see DECISIONS.md):** vehicle-details editor row, "Export this van's
record", "Remove vehicle" (armed/idle), Fleet "Removed vehicles" collapsible, admin "+" add-vehicle button,
"Raise a defect" sheet, and document **file/photo attachments** (`CameraCapture` can now supply these —
only picking an existing file still needs a picker dependency).

**Photo durability:** captured frames live in the app cache directory, so a persisted queue item can
outlive its image if the OS reclaims the cache. Copying shots into `documentDirectory` needs
`expo-file-system` — not installed.

**Whole screens:** Checklist editor, Templates + template editor, Version history, Open-defects
screen (`showDefects`), Add-vehicle (`vanadd`), Makes & models, removed-vehicle restore/purge,
2-min idle auto-logout. (Settings, Config, People, Profile and Help landed in Pass 4; "System
admin" turned out to have no store model behind it — it is More → Settings → Depot configuration.)

## MUST surface to user before final handoff (HANDOVER-REQUIREMENTS.md — none built in prototype)
1. One-time access code device binding (first sign-in).
2. Location-gated check (depot geofence) — block check when off-site.
3. Binding exemptions for Manager+/Admin.
4. Padlock unlock gesture (long-press to re-access after lock).

## Palette
primary #1B4D7A · text #1B2126 · danger #A03428 · amber #8A6116 · green #3A7D44 ·
muted #79838B/#58626A · border #E7EBEE/#EEF1F3 · chevron #C3CBD1 · card #FFF · appBg #F2F2F7.
Fonts: Fustat (sans), IBM Plex Mono (mono). Demo PIN 1234. Idle logout 2 min.

---

## Dependency repair — Expo SDK 54 (2026-08-23)

The tree was mixing SDK 46, 52 and 57 packages; SDK 46's CLI can't drive a modern RN, so nothing
would run correctly on a phone. Everything is now aligned to **SDK 54** — the version the test
iPhone's App Store Expo Go actually runs (`Exponent/54.0.6`, `exposdk:54.0.0`). An SDK 57 attempt
failed on-device with "incompatible version of Expo Go"; see `DECISIONS.md` for why `latest` is the
wrong target.

- `expo` 54.0.37 · React 19.1.0 · React Native 0.81.5 · `expo-camera` 17.0.10
- `app.json`: removed `newArchEnabled` and `splash` (replaced by top-level `backgroundColor`)
- added `babel-preset-expo` 54.0.12 as a devDependency (Expo nests it under `node_modules/expo/`)
- added `@expo/ngrok` ^4.1.3 as a **local** devDependency — a global install does not satisfy `--tunnel`
- `npm cache clean --force` was needed — a stale packument kept resolving `expo@^57.0.15` to 46.0.21
- `npx expo-doctor` → **18/18 checks pass**; `npx expo export -p ios` → bundles clean (2.2 MB)

**Camera confirmed working on a physical iPhone, 2026-08-23.**

**Testing on a phone:** `npx expo start --tunnel`, then scan the QR from inside **Expo Go**. The
tunnel is a public HTTPS URL, so the phone does not need to be on the same Wi-Fi. A physical device
is required — the iOS Simulator has no camera. Then PIN `1234` → Draw or pick a vehicle →
Spot-check → Step 1 · Photos → tap any angle.

## Web viability — proven, not adopted (2026-08-23)

Asked how much work a web version would be, so it was measured rather than estimated.
`npx expo export -p web` **succeeds with zero source changes**; the exported build was served and
driven in a browser (Vehicle detail rendered fully, bottom nav worked, no console errors).

- added `react-native-web` 0.21.2 + `react-dom` 19.1.0 (the only additions needed)
- audit of all 21 files / 3,935 lines found **no** `Platform.OS`, `Dimensions`, `Animated`, `Alert`,
  `Linking`, `Vibration`, `Keyboard` or `expo-file-system` usage; `expo-camera` ships a web build
- cosmetic-only gaps: `elevation` ignored (shadow still renders), `expo-status-bar` is a no-op
- bundle 675 kB · `dist/` is a static `index.html` + one JS file, hostable anywhere

**Real work remaining if web is adopted (~½–1 day):** photo storage (web `takePictureAsync` returns a
data/blob URI that lands in `localStorage`'s ~5 MB cap — needs IndexedDB or upload-on-capture),
Safari safe-area insets, and a PWA manifest + icons. Web sidesteps the Apple Developer Program
entirely. **No decision made yet** — the deps and `dist/` are exploratory and reversible.

## Design-critique remediation — COMPLETE (bundles clean: `npx expo export -p ios`, 2.27 MB, no errors)

Applied every recommendation from `/design-critique full build`. Full rationale in `DECISIONS.md`
(2026-08-24). Summary of what changed:

- [x] Neutral ramp darkened to clear WCAG AA on its real surfaces (`muted`/`muted2`/`muted3`/`faint`
      re-solved along their own hues); `faint` is now graphics-only. `theme.js` + `DESIGN.md` in sync,
      DESIGN.md lints clean (EXIT=0).
- [x] `disabledBg`/`disabledTxt` pair replaces `primaryDim`/`dangerDim`; every not-ready button stays
      pressable + explains itself, with `accessibilityState`/`accessibilityHint`.
- [x] `store.approvalsCount()` — role-scoped nav badge + queue list (inspectors see only their own).
- [x] `CTRL = { sm:44, md:48, lg:56 }` token; all sub-44 controls lifted (Check/Approvals/Fleet/
      Defects/Van/Gate/People/Profile). Config badge kept small, tap target via `hitSlop`.
- [x] `__DEV__`-gated: Gate dev sign-in / Skip-PIN / demo PIN, Check pass-everything long-press.
- [x] 38 hex literals → tokens; Profile switch → RN `Switch`; sheet radii unified at 22.
- [x] Dashboard reordered (work row above stats); Config visible Edit toggle; More Templates inline
      "Coming soon"; Van empty photo tiles labelled; 28 unroled `Pressable`s given roles/labels.
- [x] Verify — `npx expo export -p ios` bundles clean; hex + Pressable-role audits re-run.

## Pass 4 — People / Profile / Help / Reset / routing — COMPLETE (bundles clean: 773 modules)

The store already carries every Pass 4 action and state key; what is missing is the screens that
drive them and the routing that reaches them. Nine items, three already landed.

- [x] 01 `store.js` Pass 4 state + actions (settings, backup/restore, reset modal, config draw
      rules, photo angles, hidden edit gesture, roles & capabilities, people, profile, help)
- [x] 02 `src/screens/SettingsScreen.js` (depot name, backup/restore, About, Danger zone)
- [x] 03 `src/screens/ConfigScreen.js` (draw rules, photo angles, roles & capabilities, hidden edit)
- [x] 04 `src/screens/PeopleScreen.js` — roster list, All/Managers/Inspectors segments, YOU chip,
      status dot + role chip, manager-only "…" row action and "+" FAB, add-person and manage sheets
- [x] 05 `src/screens/ProfileScreen.js` — 76pt identity header + role pill, month/week stat tiles that
      deep-link into Approvals, editable role block for an Admin viewing someone else (segments,
      system-admin switch, sticky Discard / Save bar) vs. read-only role row + capability chips,
      Last active / Member since, assigned-vehicle rows
- [x] 06 `HELP` content in `src/data/model.js` (2 groups, 5 topics, warn-toned paragraphs) +
      `src/screens/HelpScreen.js` — one-at-a-time accordion driven by `helpOpen`/`toggleHelp`.
      The Backup and Offline topics are **rewritten, not ported** — the prototype's copy described a
      web build (.json to downloads, install-as-PWA) that does not exist here. See `DECISIONS.md`.
- [x] 07 `src/components/ResetModal.js` — centred dialog (scrim + KeyboardAvoidingView), danger
      badge, mandatory reason field, Confirmed button that only turns red once a reason is typed.
      The warning line branches on `backupMeta`: `doReset()` never clears the backup slot, so it
      says the backup survives when one exists and "no copy anywhere else" when it does not.
- [x] 08 Routing — `App.js` routes for settings/config/people/profile/help + `ResetModal` mount;
      `AppHeader` titles (`profile` shows the person's name) + back targets that retrace how the
      screen was opened (config→settings, profile→people, the rest→more); `MoreScreen` People /
      How to & help / Settings now navigate (Templates keeps `soon()` — that screen is still
      deferred). Also: `BottomNav` gained a `CHILD_OF` map so a deep screen keeps its tab lit,
      and the More People row's subtitle now matches the roster the People screen shows.
- [x] 09 Verify — `npx expo export -p ios` → **"iOS Bundled index.js, 773 modules"**, 2.27 MB, no
      errors. Also statically checked every `s.*()` call and `Icon name=` in the six new files
      against `store.js` / `Icon.js` — all resolve, so nothing is waiting to blow up at render.

Icon glyphs needed by these screens (download, upload, arrowUp, arrowDown, plus, trash, users,
help, gear, person, lock) are all already in `Icon.js` — no glyph work required.

Note: the deferred "System admin" screen is covered by More → Settings → Depot configuration;
there is no separate admin screen in the store model.

**Test it:** `npx expo start --tunnel` → PIN `1234` (sign in as an Admin to see the Management and
App sections) → **More** → People / How to & help / Settings → Depot configuration. From People,
tap a person for their profile; from Settings, Danger zone → Factory reset raises the reset dialog.

Pass 4 leaves only one `soon()` stub in the app: More → Templates.
