# Decisions: Vehicle Spot-Check

> The *why* behind the design system. Tokens live in `DESIGN.md`; conventions live in `CLAUDE.md`; this file records the reasoning so Claude (and you) keep context over time.

## How to use this log

Add an entry whenever you make a design decision that future-you would otherwise have to reverse-engineer: a token choice, a tradeoff, a deviation from a default, a deliberate inconsistency. Newest at the top.

---

## 2026-08-25: Dashboard "Find a vehicle" is the direct-nav entry to a record

The vehicle detail screen (`van`) had no direct route — it was reachable only by drilling through a
Fleet row, a Defect, an Approval, or a Profile. Added a **Find a vehicle** search field on the
Dashboard (`VehicleFinder` in `DashboardScreen.js`), rendered on both the Inspector and Manager
dashboards directly under the hero. Type a plate or model → up to 6 live matches (each a plate,
`model · Bay`, and a status badge) → tap routes straight to `s.goVan(plate)`.

- **Reused the Fleet search idiom**, not a new pattern: same search-wrap/icon/clear layout, same
  `STATUS[s.statOf(v)]` badges as `FleetScreen`, so the two surfaces read as one system.
- **Placed under the hero, styled as a quiet input** — not a card or a second CTA — so it doesn't
  compete with the one primary action per view (`heroPrimary`). It's a utility, and reads as one.
- **Ephemeral local `useState`, not a `Store` field.** The query is view-local and should self-clear
  when you leave the Dashboard; persisting it (like `fleetQuery`) would be wrong here. This isn't a
  second state system — it's ordinary component state, same as `DriverSheet`'s `editing`.
- Results expand **in-flow** inside the Dashboard `ScrollView` (not an absolute overlay), avoiding
  z-index/clipping fights. Match cap of 6 keeps the list short; empty query shows nothing.

Verified in preview: typing "renault" listed 6 Renaults with correct badges; tapping ENS95D opened
its detail with Fleet marked active in the bottom nav (the van screen's parent per `navBack`).

---

## 2026-08-25: Australian terminology, not UK

The business is based in Australia; the seed data and doc chips had carried UK-fleet terms. Replaced
them everywhere in `src/` with Australian equivalents:

| Was (UK) | Now (AU) |
|---|---|
| MOT | Roadworthy |
| Vehicle tax | Registration (rego) |
| Tacho calibration | Service |
| PMI / safety inspection | Safety inspection |
| — | CTP (compulsory third-party, an add-doc chip) |

Touched `src/data/model.js` (seed docs + `blockDoc`/`blockReason`) and `src/screens/VanScreen.js`
(`DOC_TYPES` add-doc chips + search placeholder). **Code identifiers kept their legacy spelling**
(`motM`/`motY` locals) per the CLAUDE.md rule — only user-visible copy changed.

**Persistence gotcha:** `fleet` is a `PERSIST_KEY`, so a seed-data change only surfaces after clearing
`spotcheck:v2` / `spotcheck:backup:v2` in localStorage and reloading (otherwise the old UK terms stay
cached). Verified in preview after a reseed: Documents panel reads Roadworthy / Insurance / Service.

---

## 2026-08-25: Driver-confirm is a bottom sheet with a spare skip; primary button is origin-aware

Superseding the 2026-08-24 full-screen `DriverStep`, the driver-confirm gate is now the
`DriverSheet` bottom sheet (`driverLaunch: 'sheet'` default) that pops over the Dashboard/Fleet so the
vehicle context stays visible. The full-screen walk-around wizard only opens on Confirm. This is the
opposite of the 2026-08-24 "kept full-screen" call — it was reversed because the sheet keeps the plate
you're about to walk in view behind it, and the happy path (driver on file) is a single tap with no
keyboard, so the earlier keyboard-fight objection no longer applies. The reassign field stays behind a
pencil (progressive disclosure) rather than sitting open.

**Spare skip.** Ticking "Vehicle not in use (spare)" swaps the card to a no-driver state and makes the
**one primary button origin-aware**: default → **"Confirm"** (`confirmDriverStart()` → walk-around);
spare → **"Random Check"** (`skipAsSpare()` → `drawCheck(false)`), which draws a random *other*
vehicle to check instead. Spares are excluded from overdue/stat counts and the draw pool base filter.
Keeping it to one button (not a second CTA) holds the "one primary action per view" rule. Verified in
preview: Confirm → walk-around; Random Check → draw overlay lands on a random van.

---

## 2026-08-24: Driver-confirm step — card + Confirm, name always visible

Reworked the check flow's first step (`DriverStep` in `CheckScreen.js`) around a one-tap happy path.
The on-file driver now sits in its own card with a **Confirm** button right beside it — inspector taps
once and moves to photos. A separate, secondary field below handles the exception ("someone else is
driving it"). The driver name **stays on the card no matter what** you do in the field, so the person
you're confirming is never hidden behind an edit.

**Behaviour decisions:**
- **Field pre-fills with the on-file driver, and clears on focus.** Tapping into it is the explicit
  "someone else has it" gesture, so `onFocus` wipes the pre-filled value to a placeholder. The card
  keeps showing the on-file name; `confirmDriverStart()` falls back to on-file if the field is left
  empty, so an accidental tap-and-leave still records the right driver.
- **Confirm stays enabled whenever there's a name to act on** (`canConfirm = noDriver || typed ||
  onFile`) — the empty-field + on-file case is the common one and must not grey out.
- **Copy:** the field label is sentence case ("Someone else driving it?"), *not* the uppercase
  `miniLabel` the review/fail sheets use — added a dedicated `driverFieldLabel` style rather than
  changing the shared token. The spare-vehicle checkbox reads "Vehicle not in use (spare)" (was
  "Vehicle has no driver (spare / yard)").
- **Hierarchy:** the plate leads the wizard header in mono-bold 21px (`rego` style, matching the
  draw/fleet plate treatment), and the "Before you start · Confirm driver" helper was bumped to 13px
  / `muted2` so the two orienting lines read first.

**Kept full-screen, not a bottom sheet.** The driver step is the entry gate of a multi-step
full-screen wizard (driver → photos → checklist → review → done); a sheet would break that spatial
model, fight the keyboard on a screen whose primary job is a text field, and orphan the plate header.
Bottom sheets in this app are for *interruptions over a screen* (FailSheet, ManageSheet) — the check
wizard is the screen.

---

## 2026-08-24: Micro-copy sweep — cut explainer subtitles, keep state

Swept every screen for purely explanatory secondary text — the helper subtitle under a title, the
"how it works" paragraph, the tip footnote — and removed it, keeping the primary label of every
control and every line that carries real state or data (counts, statuses, timestamps, names,
values). The prototype leaned on explainer lines to teach a first-time reader; the built app doesn't
need to re-teach the obvious ("The app draws the vehicle — you check it") on every visit.

**Rules applied:**
- **Cut:** hero subtitles (Dashboard), "how it works" blocks, tip/footnote lines, redundant control
  descriptions (More rows, Config field notes, Settings nav subtitle, Gate role clauses).
- **Kept as data:** counts/status subs, timestamps, driver/model/bay lines, empty-state sentences,
  validation warnings, and the verdict/declaration copy in the check review (legal-ish, load-bearing).
- **Kept deliberately — destructive-action consequence warnings:** the factory-reset copy
  (`ResetModal`), the restore "Restoring puts this backup in place of everything on this phone…"
  warning (`SettingsScreen`), and the suspend/delete guidance (`PeopleScreen` `ManageSheet`). These
  aren't chrome — they're the last thing a user reads before an irreversible action, so they stay
  until explicitly told otherwise.
- **Left untouched:** `accessibilityLabel`s (screen-reader-only, not visible micro-copy) and
  `__DEV__`-gated hints.

**Spacing:** flexbox `gap` containers self-collapse when a child is removed, so most cuts tightened
on their own. Where a two-line stack lost its subtitle, dropped the now-dead `gap`/`gap: 3` on the
wrapping `<View>` so the remaining title sits flush rather than carrying an orphaned gap.

---

## 2026-08-24: Back-safety on the check flow (nav model + tab bar)

A flow trace of the app turned up two edges on the one flow that must never lose work — the
walk-around wizard (`driver -> photos -> list -> review -> done`).

**The persistent tab bar was a silent data-loss path.** `BottomNav` rendered on every screen, the
check included, and `startCheck()` clears `checkResults`/`checkDefects`. So one accidental tap on a
tab mid-inspection discarded every photo and pass/fail with no confirm. Fix: `BottomNav` returns
`null` on the `check` screen. The check is a full-screen commit flow now; the only way out is a
deliberate Back. Chose hiding over a "Discard?" confirm dialog because a wizard showing tabs invites
the mistap in the first place — remove the affordance, not just its consequence.

**Android hardware/gesture Back was unhandled.** No `BackHandler` existed anywhere, so mid-check the
system Back button dropped the user out of the app instead of stepping back. Fix: one `BackHandler`
subscription in `Shell` delegating to a new store method.

**One back-brain, two callers.** Rather than let the header chevron (`s.go(back)`, which on the check
screen jumped straight to the Dashboard and abandoned the walk) and hardware Back disagree, both now
route through `store.navBack()`: inside a check it steps the wizard back one stage, and at the first
stage leaves to the fleet; elsewhere it follows the same parent map the header already used
(`van->vans`, `config->settings`, `profile->people`, ...); at the Dashboard root it does nothing and
`hardwareBack()` returns `false` so the OS backgrounds the app. `hardwareBack()` also dismisses any
open overlay (camera, fail sheet, reset modal, draw) before touching screen state. This also gave the
wizard the "back a step" control it lacked — it's the existing header chevron, now smart, so no second
control was added. Bundles clean (`npx expo export -p ios`, EXIT=0).

---

## 2026-08-24: Design-critique remediation (accessibility, honesty, control scale)

Acting on the `/design-critique` findings for the full build. Five threads, all now in code and
bundling clean (`npx expo export -p ios`).

**The neutral ramp was darkened off the prototype — deliberately.** The ported greys failed WCAG AA
on their real surfaces (`muted` 3.87, `muted3` 2.56, `faint` 1.64 on white) and they carry nearly
every subtitle, placeholder and chevron in the app, so the failure was everywhere at once. Each grey
was re-solved along its own hue to clear the bar it is *actually* judged against — 4.5:1 for text,
3:1 for a meaningful UI graphic — while keeping the four tiers visually distinct (naively solving each
for 4.5:1 collapsed `muted`/`muted3` into the same colour). `faint` is now graphics-only (chevrons,
PIN dots) at 3:1; anything that had to stay text moved up a tier at its call site (BottomNav inactive
tab → `muted`, VanScreen disabled-primary text → the disabled pair). This is the one place the app
knowingly departs from the prototype's pixels; the fidelity rule yields to the contrast floor.

**One disabled look, and it is never truly inert.** Retired `primaryDim`/`dangerDim` (white on a pale
fill, ~1.8:1) in favour of a `disabledBg`/`disabledTxt` pair (5.56:1). Every not-ready button now
keeps the same bargain `ResetModal` already documented: the control stays pressable and the press
explains what is missing (`s.submitCheck()` etc. already `say()` the reason), rather than looking
dead. Paired with `accessibilityState={{ disabled }}` + a hint so a screen reader hears the same
thing. The visual defect never needed a logic change.

**Approvals now tells the truth about what you can do.** `canSign = mgr && !own` meant an Inspector
saw a queue — and a nav badge — full of work they could not touch (the "2" counted another
inspector's submission). Added `store.approvalsCount()` as the single role-scoped source: a manager's
badge counts submissions that are not their own; an inspector's counts only their own returned walks
to redo. The Approvals queue list is likewise scoped — an inspector sees only their own pending
submissions, a manager sees the board.

**Touch targets standardised on `CTRL` (44/48/56).** New token `CTRL = { sm: 44, md: 48, lg: 56 }`
in `theme.js`/`DESIGN.md`. `sm` is the HIG/WCAG floor (chips, segments, inline actions); `md` for
controls used repeatedly in the field (Pass/Fail, Submit); `lg` for a full-width end-of-flow commit.
Every sub-44 control was lifted to a token (Check `pfBtn` 38→md, Approvals `segBtn` 32→sm, Fleet
`chip` 34→sm, Defects/Van `fixBtn` 36→sm, Gate `devChip` 38→sm, People/Profile `seg` 40→sm; the
Config lock/remove badge stayed visually small but its interactive variant got `hitSlop` to a 50pt
effective target rather than inflating a shared decorative badge).

**Development affordances gated behind `__DEV__`.** Gate's dev quick-sign-in, Skip-PIN and "Demo PIN
1234", and Check's 600ms pass-everything long-press no longer reach a production bundle. An accidental
hold on a real checklist would silently falsify an inspection — that one is a correctness guard, not
just tidiness. Admin sign-in stays visible: it is a real route into depot setup.

**Smaller honesty/consistency fixes.** 38 hardcoded hexes → tokens (ten were exact duplicates of
existing tokens). Profile's hand-rolled switch → the same RN `Switch` Config uses (which also removed
the last `'#000'` shadow). Bottom-sheet radii unified at 22. Dashboard reordered so the work row
outranks the vanity stats. Config's hidden edit gesture kept, but a visible Edit/Done toggle added so
it is discoverable. More → Templates shows a "Coming soon" state in place instead of a post-tap toast.
Van's empty photo tiles now carry a camera glyph + label instead of reading as broken. 28 unroled
`Pressable`s across Gate/Dashboard/DrawOverlay/Check/Placeholder got roles/labels; the four that
remain roleless are genuinely non-interactive wrappers (gesture container, no-op tap-guard).

## 2026-08-23: Pass 3 — real camera capture

The photo steps were counters; they now take actual photographs via `expo-camera`.

**One overlay, not one per call site.** `CameraCapture` is mounted once in `App.js` and driven by a
single `state.camera` value (`{ mode, angle }`). `savePhoto(uri)` files the result wherever the overlay
was opened from. Adding a third capture point later (document attachments, "Raise a defect") means one
new `openCamera` call, not another camera screen.

**Photos are arrays of URIs, not counts.** `checkPhotoMap[angle]` and a defect's `photos` both hold
file URIs now. Counts are derived (`photoCount()`), so nothing can drift out of step with what was
actually shot.

**Capture is confirm-then-file.** The shutter shows the frame with Retake / Use photo rather than
saving straight away. A walk-around photo that turns out blurred is worthless to the manager approving
it, and re-shooting from the tile is a longer path than confirming in place.

**The defect sheet hides while the camera is up.** Two stacked native modals is fragile on iOS and adds
nothing here — `failSheet` lives in the store, so hiding the sheet loses no typed input and it comes
back with the new thumbnail attached.

**`submission.shots` carries one frame per angle.** Approvals' photo strip showed angle names on grey
tiles; it now shows the real image when a check was submitted with the camera. Seeded queue items have
no `shots` and keep the name tiles, so both render correctly side by side.

**Frames stay in the cache directory.** Persisting them properly means `expo-file-system`, which isn't
installed. Acceptable while this is a demo; noted in `PROGRESS.md` as a real gap before field use.

---

## 2026-08-23: Pass 2 — the five nav-level screens

Built Fleet, Vehicle detail, Approvals, Defects and More. Notes on the non-obvious calls:

**Ten tokens added rather than inlining prototype hexes.** The deferred screens needed shades the slice
never used — outline/disabled variants of error, a success outline, three near-white surfaces
(`surface-subtle`, `surface-alt`, `input-surface`), a soft primary tint pair, and a neutral `slate` for the
"Overdue" badge. Each went into `src/theme.js` **and** `DESIGN.md` before use, per the tokens-over-literals
rule; `DESIGN.md`'s input component now references `{colors.input-surface}` instead of repeating the hex.

**Overdue is `last == null || last >= 30`, app-wide.** The prototype tests `v.last > 30` in some places and
treats a never-checked vehicle as fine. Standardising on the inclusive rule (and counting never-checked as
overdue) makes Dashboard, Fleet chips and the status badge agree — the prototype's variants disagreed by
one vehicle.

**`submitCheck()` now stores a `submission` record.** Approvals' "View submission" panel needs odometer,
photo count, passed count, failed items, keyholder and photo angles. The prototype recomputed these from
transient check state; here the queue item carries them, so the panel works after a reload. Seeded queue
items have no `submission` and degrade to em-dashes.

**Documents open the edit sheet directly.** The prototype has a view sheet that then opens an edit sheet.
Two stacked bottom sheets is a web-modal idiom that reads badly on a phone, and the view sheet's only
unique content was the attachment thumbnail — which we can't show yet (below). One sheet, pre-filled.

**Attachments and the admin/destructive actions are deferred, not dropped.** No image/file picker is
installed (`expo-image-picker` isn't in `package.json`), so document attachments, "Export this van's
record", "Remove vehicle", the removed-vehicles collapsible, the admin add-vehicle button and the
"Raise a defect" sheet are all out of this pass. Listed in `PROGRESS.md`.

**Unbuilt More destinations toast instead of dead-ending.** Templates, People, Help and Settings show
"… — coming in a later pass." rather than routing to a blank screen; the Fleet row is live.

---

## 2026-08-23: Initialized with designagent

- **Canvas:** none (reference prototype: `_handoff/incomplete-app-design-request/project/SpotCheckPhone.dc.html`)
- **Design system:** custom — React Native `StyleSheet` composed from `src/theme.js` tokens
- **Framework(s):** React Native (Expo SDK 52)

Set up the three-file design context: `DESIGN.md` (tokens), `CLAUDE.md` (intelligence), `DECISIONS.md` (this log).

**`DESIGN.md` was populated from the real shipped tokens, not the neutral scaffold.** The project already
had a complete token system in `src/theme.js` (`C` palette, `F` font families, `cardShadow`), so the
setup skill's "don't leave placeholder tokens" guidance meant mirroring those exact values instead of
copying the placeholder defaults. `theme.js` remains what the app imports; `DESIGN.md` is the
human-readable / lintable mirror — the two must be changed together.

**`CLAUDE.md` React section was adapted for React Native, not web React.** The bundled `react.md`
template assumes web React with Tailwind utilities, `.tsx`, and DOM/ARIA semantics. This app is
plain-JS React Native with `StyleSheet` and no Tailwind, so the conventions section was rewritten to
match the actual stack: `StyleSheet.create` + `theme.js` tokens, the singleton `Store` +
`useSyncExternalStore` state model, the shared `Icon` component, and safe-area handling. Following the
web template verbatim would have documented idioms that don't exist in the codebase.

**Naming split recorded as a standing rule.** UI copy uses Vehicle / Fleet / Rego / Spot-check /
Defect / Keyholder / Approve / Send back / Redo / Draw / Pass·Fail / Mark fixed, and roles
Inspector → Manager → Manager+ → Admin. Code identifiers deliberately keep the older spelling
(`vanId`, `genVans`, screen key `'vans'`) to avoid churn — the two are intentionally out of step.

**Color semantics fixed to four families.** `primary` #1B4D7A (single accent / primary action),
`error` #A03428 (blocked, defect, destructive, send-back), `warning` #8A6116 (awaiting approval,
open jobs, expiring docs), `success` #3A7D44 (passed, OK, mark fixed). `draw` #F4C430 is reserved for
the random-draw overlay only. Each ships a soft `*-surface` tint for badges/banners.

**Pinned to Expo SDK 54 — the version the phone's Expo Go actually runs.** The tree had drifted
across three SDK generations at once: `package.json` declared SDK 46 versions while `node_modules`
held a mix of 46 (`expo`, `@expo/cli`, `expo-modules-core`), 52 (`expo-camera`, `expo-font`,
`react-native-svg`, `react-native-safe-area-context`, async-storage) and 57 (`react-native`,
`expo-asset`). Metro could still bundle, but SDK 46's CLI cannot drive a modern React Native, so
nothing would run correctly on a device. Everything is now pinned to **SDK 54** (`expo` 54.0.37,
React 19.1.0, RN 0.81.5, `expo-camera` 17.0.10, `babel-preset-expo` 54.0.12) via
`npx expo install --fix`. `npx expo-doctor` reports 18/18.

**The SDK is chosen by the phone, not by npm.** The first attempt went to SDK 57 on the assumption
that *Expo Go only ever ships the latest SDK*. **That assumption is wrong** — the device rejected the
bundle with "incompatible version of Expo Go" and the App Store offered no update. The phone's own
request headers, read from ngrok's inspector (`http://127.0.0.1:4040/api/requests/http`), settled it:

```
User-Agent:               Exponent/54.0.6 (iPhone17,1; iOS 26.6; Scale/3.00; en_AU)
Expo-Runtime-Version:     exposdk:54.0.0
Expo-Client-Release-Type: APPLE_APP_STORE
```

The App Store build was **three SDK generations behind npm's `latest` tag**. The rule to carry
forward: check `https://api.expo.dev/v2/versions/latest` for the SDK whose `iosClientVersion` matches
the installed Expo Go, and pin the project to that — never to `latest`. (That endpoint's top-level
`iosVersion` field is a stale legacy value; ignore it.) Expo Go remains the right harness because it
exercises the camera with no Apple Developer account, no Android Studio/JDK toolchain and no cable.

Three environment traps cost real time and will recur on any clean install:

- **`babel-preset-expo` must be an explicit root devDependency.** Expo nests it under
  `node_modules/expo/`, where the root `babel.config.js` cannot resolve it. Re-add it after every
  wipe-and-reinstall or `expo export` dies with `Cannot find module 'babel-preset-expo'`.
- **`@expo/ngrok` must be installed *locally*.** Expo's own prompt offers to install it globally,
  then immediately fails with `CommandError: Install @expo/ngrok@^4.1.0 and try again` — it only
  resolves the package from the project's `node_modules`.
- **npm's cached packument can silently lie.** A stale entry kept resolving `expo@^57.0.15` to
  46.0.21; only `npm cache clean --force` fixed it. Also note `npx expo install --fix` rewrites
  `package.json` correctly but its trailing `npm install` fails with ERESOLVE against an old tree —
  let it rewrite, then delete `node_modules` + the lockfile and install fresh.

The SDK move itself was low-risk: the app is plain function components, `StyleSheet` and
`useSyncExternalStore` with no deprecated lifecycle APIs, and `expo-camera`'s
`CameraView` / `useCameraPermissions` surface is unchanged across 52 → 54 → 57. **Camera capture was
confirmed working on a physical iPhone on 2026-08-23.**

## Help copy: the Backup and Offline topics were rewritten, not ported (2026-08-24)

Every other Pass 4 screen matches the prototype's wording verbatim. Two help topics do not, because
the prototype was a **web** build and the copy described a web app's storage model:

- *Backup and storage* told the reader a backup "writes the whole depot as one .json file to your
  downloads" and warned that "the browser may clear the depot" unless durable storage is granted.
- *Working offline & installing* told them to "add the app to your home screen" to get an offline
  shell and to earn that durable storage.

Neither is true of this build. A native app has no downloads folder, so `doBackup()` writes a second
AsyncStorage slot (`spotcheck:backup:v2`) alongside the live one — already recorded above — and
there is no PWA to install; the app is offline by construction. Shipping the original text would
have told a depot manager to look for a file that does not exist and to perform an install step that
does nothing, then left them believing they had an off-device copy when they do not.

The replacements state the real model — backup is a second slot on the same phone, so losing the
phone loses both — and the Offline topic now carries the genuine caveat, that captured photos live
in the phone's working storage and can be reclaimed under storage pressure (the durability gap
already logged in `PROGRESS.md`). If a server sync or `expo-file-system` copy-to-documents lands,
both topics need revisiting.

---

## Interface terminology standardised (Pass: naming review)

The UI carried several synonyms for the same concept, and one term that disagreed with the code.
Standardised the user-facing vocabulary (code identifiers keep their legacy spelling per CLAUDE.md —
`driver`/`driverSince`, `jobs`/`hasJobs`, `vanId`, the `'check'` screen key, `DrawOverlay`):

- **Keyholder → Driver.** The data model already stored this person as `driver`/`driverSince`, but
  every screen said "Keyholder". "Driver" is the standard fleet term for who a vehicle is assigned
  to, and it makes UI and code agree. Changed the 8 visible strings (van detail, check flow ×3,
  signature overlay, profile, approvals column, history log). Field names unchanged.
- **Job → Defect.** Both words meant "a failed item". Standardised the on-screen label on "Defect"
  ("Open jobs" → "Open defects"; "Raise a job" → "Raise a defect"). The `jobs[]` array and
  `hasJobs()` keep their names.
- **Van → Vehicle.** Already effectively done — no on-screen "Van" copy existed (screens say
  "Fleet"/"Vehicle"); the `van` tokens are all code. No change required.
- **Spot-check → Full Inspection.** Applied across headers, buttons, help/capability copy, and
  history log text. Case follows context: "Full Inspection" as a title/label, "full inspection" in
  running prose. The **product name "Vehicle Spot-Check"** (Help footer, app metadata) was left as a
  separate branding decision — flag if it should follow.

Signature ("Draw → Signature"): raised in review but **not applied** — the signature step is already
called "Sign"/"Tap to sign", not "Draw" (only the random vehicle lottery is "Draw"). Left for a
separate, deliberate decision so the vehicle-draw naming is never confused with the signature.
