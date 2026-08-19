# Task: Ship "Fleet Spot-Check Manager v2" design as a mobile-first PWA
Status: 23 of 23 complete; phase 4 complete. **v30 is live in production AND in source on main (verified 2026-08-20).** v30 = first-run setup-gate refinement (whole-screen centred gate, top bar + tabs dropped on `setup`, admin modal moved into `viewSetup()`, build stamp at the foot) in app.js/app.css/sw.js. Prior: v28 durable storage + header build stamp; v29 hidden admin role + first-run setup gate. Clean to keep building.   | batch size: 1 (session 0cc2950e dropped repeatedly with ECONNRESET)
Phase 3 opened 2026-08-17 22:56 after a go-live review — items 21-23.
Session log: phase 1 (port the design) done in 544d56b2; phase 2 (real data + real inputs) opened 2026-08-16 15:24;
  compacted after item 15, resumed same session 2026-08-16 17:16

Output: C:\Users\tienn\GIT\Checkup Van (index.html, app.css, app.js, store.js, photos.js, manifest.webmanifest, sw.js, icons/)

Post-completion (2026-08-18): two follow-ups after the 23 items —
  (1) "invisible scrolling" fix: evidence strip → 3-col grid (v16). See Problems.
  (2) DEPLOYED to HTTPS. Live at https://checkup-van.netlify.app (Netlify, site id
      a66b1464-2703-4498-beb5-6bd2d7cba85f, account slug tien-n, owner tien.n@outlook.com).
      This replaces "LAN-only" — a secure origin means the SW registers, the shell caches, and
      install/offline work (all verified live: isSecureContext true, SW active, 11 files in
      spotcheck-shell-v16, cache-served). Deploy is a static upload of runtime files ONLY from a
      staged folder — PROGRESS.md/README.md/design/ are kept OFF the public site (README has the
      exact redeploy snippet). The seed is minimal, so the live site is a clean first-run depot;
      the rich localhost demo data was hand-entered this session and lives only on the laptop.
      README's old "nothing is hosted, nothing is deployed" claim was corrected.

## Phase 4 — feedback batch (2026-08-18, CODE COMPLETE — deploy of v26 outstanding)
User (verbatim): "Change the Theme color and update the Top header tab nav the year when type for
the yyyyy its broken, can add someone. not able to signout. add if accident add can't del. do a
full build sweeep. and it app alike. better UX. responsive."

Decisions locked (AskUserQuestion, 2026-08-18):
- **Theme = Fleet green.** Depot/safety green accent on a clean light shell (not a hue-swap of the
  whole grey; green is the accent/action colour, header can go dark-green). Also update
  manifest theme_color + sw bump.
- **Sign-out = pick-who-you-are switcher.** No PINs. Tap the header identity to choose which person
  you are from the people list; "Sign out" clears it back to nobody. Needs a real current-user
  concept: today `me()` = first active manager (app.js ~384). Introduce a stored current user id
  (in store settings so it persists per-device) and make `me()` resolve it, falling back to nobody
  when cleared. Header shows who you are + a way to switch/sign out.

Phase-4 items (see ## Items, phase 4 block):
- P4-1 Year date bug: `pickDue` (app.js ~2252) snaps any typed date < today back to today, so
  typing yyyy digit-by-digit is impossible. Fix: don't clamp on input; validate at commit/approve.
- P4-2 Fleet-green theme tokens (app.css) + manifest theme_color.
- P4-3 Current-user model + header identity switcher + sign out.
- P4-4 Delete for people & vans (two-tap arming, reuse S.armReset pattern). People today only
  Suspend/Reinstate (viewPeople ~1389); vans only Retire.
- P4-5 Header + tab nav redesign (renderTopbar ~1770 / renderTabbar ~1792).
- P4-6 Full build sweep (node --check, dead code, copy, a11y, responsive at 375).
- P4-7 App-like / better UX / responsive polish.
- P4-8 Bump sw VERSION v16→(final), redeploy to Netlify from staged folder, update README version.

## Decisions and conventions
- Source of truth: design/Fleet Spot-Check Manager v2.dc.html + design/support.js (imported via claude_design MCP, then moved into design/).
- Only this one .dc file is in scope — user said "dont need the others dc".
- Target is a real app, mobile-first: "do what is needed to make it so its like a app. mainly use on mobile".
- Split the single-file design into static assets: index.html shell (topbar / screen / tabbar + toast), app.css, app.js. No build step, no framework.
- Fonts: Fustat + IBM Plex Mono from Google Fonts (external link retained in index.html).
- Colour: light scheme only, theme-color #EDF1F3, lang en-GB.
- Dev server defined in .claude/launch.json; preview via preview_start, never Bash.

### Data layer conventions (set by item 11, store.js)
- `store.js` loads BEFORE `app.js`, exposes `window.Store`, no modules/build step.
- Driver contract is three async methods: `load()` / `save(db)` / `clear()`. Whole-db save,
  last write wins. `localDriver` today; falls back to an in-memory driver if localStorage
  throws (quota / private mode). Swap with `Store.useDriver(d, {adopt})`.
- Reads are synchronous off an in-memory db so `render()` stays synchronous; writes hit
  memory + subscribers immediately and flush to the driver coalesced at 120 ms, plus on
  `pagehide` / tab-hidden. Only start-up is async: `await Store.ready()` before first render.
- Storage key is `spotcheck.db.v1` (the old whole-UI-state blob `spotcheck.state.v1` stays
  app.js's, and item 12 decides what remains in it — UI state only).
- Record shapes documented at the top of store.js. Rules: string ids from `Store.newId()`,
  ISO dates `YYYY-MM-DD` and ISO timestamps, lowercase string enums (NEVER array indexes),
  numbers for numbers. Collections: vans, people, workshops, checklist, checks, defects,
  plus a single `settings` record.
- `Store.init({seed})` applies `seed` on first run only — that is where the 31-item
  checklist template goes in item 13. Wiring the `<script>` tag into index.html happens in
  item 12, together with the first real use.

### App/store wiring (set by item 12)
- `index.html` loads `store.js` then `app.js`; `sw.js` caches store.js and its VERSION is now `v2`
  (bumping VERSION is what forces the old shell cache out — do it whenever a shell file changes).
- `S` (key `spotcheck.ui.v3`, bumped by item 13) is UI state ONLY: selection, half-typed text,
  what is expanded, plus the checklist DRAFT and the draw-rule indexes (move into `settings`
  in item 19). Domain records are never copied into `S`.
- Boot is async: `Store.init({seed: SEED}).then(...)` → `load()` → `Store.subscribe(invalidate)`
  → `booted = true` → first `render()`. Nothing renders before the driver has been read.
- Renders are coalesced: `invalidate()` queues one `render()` per microtask, so an action that
  writes S plus three Store collections still paints once. `push`/`goTab`/`popstate` set
  `transition` then call `invalidate()`.
- Enum values are stored as strings and cycled with `nextIn(list, value)` — never as an index
  into a module array, so reordering a list can't silently rewrite existing records.
- Countersigning is what raises a defect: `approve` updates the check, then inserts a `defects`
  row from the check's failed `results` entry. No defect exists before a manager signs.
- Dev server moved to port 4174 (`.claude/launch.json` name `spotcheck`) — 4173 is still held
  by the stray server from session 0cc2950e.

### Empty depot + checklist ownership (set by item 13)
- `SEED` is now a function returning ONLY `{ checklist: buildList(), settings: { checklistVersion: 1,
  checklistPublishedOn: '' } }`. Vans, people, workshops, checks and defects all start empty.
  Function form (not an object literal) so a reset always gets a fresh copy of the template.
- The PUBLISHED checklist lives in the store's `checklist` collection + `settings.checklistVersion`
  / `settings.checklistPublishedOn`. `S.list` is the manager's UNPUBLISHED DRAFT of it — real UI
  state. There is no `S.baseline` / `S.version` / `S.publishedOn` any more: `isDirty()` compares
  `JSON.stringify(S.list)` against `publishedList()` directly, so there is no third stale copy.
- `publish` writes the whole list in one `Store.replace('checklist', S.list)` plus one
  `Store.setSettings(...)` — a half-published checklist is worse than an out-of-date one.
- `freshState()` sets `list: null`; `load()` repairs it to `publishedList()`. `load()` must NOT
  early-return when there is no saved blob, or a first run renders with `S.list === null`.
- `curSection()` (`S.list[S.secIdx] || null`) guards every read of the current section —
  `secIdx` is a position in a list the manager reorders, never a stable handle.
- `sw.js` VERSION is now `v3`. Bump it on EVERY shell-file change or the browser keeps serving
  the cached old app.js and the change looks like it did nothing.
- More → "Empty this depot" (was "Reset demo data") — nothing demo ships any more.

### Empty states (set by item 14)
- One helper, `emptyState(title, body, cta)`, renders `.empty` with an optional `btn-add` CTA
  (`cta = { label, action, id }`, where `id` becomes `data-id` — so `{action:'tab', id:'vans'}`
  jumps tabs and `{action:'startAdd'}` opens the new-van form).
- Every empty screen distinguishes NOT SET UP YET from CAUGHT UP. They look the same and mean
  opposite things, and only the first one gets a CTA:
  - Queue: no vans -> "No fleet yet" + Add a van; fleet but no checks -> "Nothing waiting";
    otherwise the existing "Queue clear" footnote.
  - Defects: no countersigned checks -> "No defects yet"; else "No open defects".
  - Coverage: no vans -> "Nothing to cover yet" + Add a van (no dead grid, no dead draw rules).
  - Vans: empty fleet -> "No vans yet" + Add a van. "No vans match this filter" is kept for a
    non-empty fleet — a filter miss is not an empty depot.
- `sw.js` VERSION is now `v4`. It gets bumped on every item that touches a shell file.

### Real text/date inputs (set by item 15)
- Markup pattern for every real input from here on: `<label class="field">` wrapping
  `<span class="field-label">` + `<input class="field-input" data-a="…" data-fk="…">`.
  `data-a` is the action, `data-fk` is the focus key that survives a full re-render.
- `.field-input` is 16px and that is NOT a style choice — anything smaller makes iOS zoom
  the page the moment the field takes focus. Keep 16px on every new input.
- Reg is folded to UPPER CASE on input, so "kx21 hvd" and "KX21 HVD" can't become two vans.
  Rewriting `.value` moves the caret to the end, so `editReg` saves `selectionStart` and
  restores it — verified: caret held at position 3 mid-string.
- Trim on the way to disk (`saveVan`), never per keystroke: typing a space mid-name is
  normal and trimming live fights the caret. `draftNamed` uses `.trim()` so the save button
  will not arm on whitespace alone.
- `input[type="date"]` hands back `''` or ISO `YYYY-MM-DD` — already the stored shape, so no
  parsing. An unset date still shows the browser's dd/mm/yyyy, so `.is-empty` greys it like
  a placeholder.
- `MODELS` is a `<datalist id="van-models">` — suggestions, free typing still allowed. A new
  van starts with model blank, not `MODELS[0]`: a guessed model nobody corrects is worse
  than a gap somebody notices. `viewVans` falls back to "Model not set".
- Dead with the cycles and deleted: `BAYS`, `MOTS`, `NEW_REGS`, `dmyY`. `nextIn` stays (real
  enums still cycle: status, role, unit, filter).
- `sw.js` VERSION is now `v5`.

### Assignee + due date on countersign (set by item 16)
- The defect assignee stays a WORKSHOP, per store.js's own record shape ("workshops — assignees
  a defect can be sent to", defect holds `workshopId`). The item title said "people/workshops";
  people are the crew who run checks, workshops are who a job goes to. Sending a defect to a
  person would be a schema change, so it was not made — raise it if in-house repairs are wanted.
- `S.assigneeIdx` / `S.dueIdx` are gone. State is now `S.assigneeId` (a real workshop id, `''`
  = unpicked) and `S.dueOn` (ISO `YYYY-MM-DD`, `''` = unpicked). Same rule as the enums: never
  store a position in a list the depot edits.
- `pickedShop()` resolves `S.assigneeId` against the ACTIVE workshop list every render. A shop
  retired while the check sat in the queue reads as unpicked and disarms countersign — it never
  silently becomes whoever now sits at that index. Verified.
- `assignFields()` renders both fields, and returns a "Nowhere to send it" card + a Go to More
  button instead when the depot has no active workshops — an empty picker is a dead end.
  `assignReady()` (`pickedShop() && S.dueOn`) gates both `canApprove` and the `approve` action.
- Pick-one from a store-owned list uses a native `<select class="field-select">`: iOS gives it a
  wheel, Android a dialog, both better than tapping through an unbounded list. `appearance:none`
  removes the native arrow, so one is drawn as an inline-SVG background.
- **Event wiring fix:** `handle()` treated only INPUT/TEXTAREA as fields, so a `<select>` fired on
  CLICK (opening the list, with the old value) and its real `input` event was dropped. SELECT is
  now in the `isField` test. Any future `<select>` depends on this.
- Fix-by has `min="${Store.today()}"`, and `pickDue` clamps to today as well — the attribute only
  constrains the picker, a typed past date still arrives. Verified: 2020-01-01 → today.
- Dead with the cycles and deleted: `DUE_OFFSETS`, `assigneeOpts`, `assigneeLabel`, `dueOffset`,
  `dueDate`, `dueLabel`, `addDays`.
- `sw.js` VERSION is now `v6`.

### Workshops screen (set by item 17)
- New screen `workshops` (SCREENS entry, `back: true`), reached from More → Workshops via the
  `openWorkshops` action. It is the other half of item 16: item 16 spends the list, this fills it.
- The More row is RED (`is-red` on `.list-sub`) while there are no active workshops, and reads
  "None yet — defects can't be assigned". An empty workshop list is not a cosmetic gap, it blocks
  every countersign, so it is visible from the menu instead of discovered on a failed check.
- `shopOpenCount(id)` counts defects with that `workshopId` and `stage !== 'closed'`. It drives
  the per-card "1 OPEN JOB" flag and the retire toast. Verified: a closed defect is not counted.
- Retiring NEVER moves the jobs already sent to a shop — they stay open and chaseable. That is
  stated on the card, in the footnote, and in the toast ("N open jobs stay with them"), because
  a silent orphaning of live jobs is the one thing a depot cannot see happening.
- `toggleWorkshop` also clears `S.assigneeId` when the retired shop is the one a half-finished
  countersign is pointing at, so the screen and the state agree. Verified.
- When every shop is retired the screen shows a red "Nothing can be countersigned" card. Retired
  cards are `.card.is-dormant` (existing style), reusing the People screen's dormant treatment.
- **New focus mechanism:** module-level `let focusNext = ''`. An action that inserts a row the
  user must immediately name sets it to that row's `data-fk`; `render()` consumes it once, after
  `restoreFocus`, focuses the field and `select()`s it so the first keystroke replaces the
  placeholder. One-shot, deliberately NOT in `S` — it must never survive a second render.
  `addWorkshop` is the only user today; `addPerson` can adopt it if the same gap shows up there.
- `sw.js` VERSION is now `v7`.

### Capture flow (set by item 18)
- Three screens: `capture-start` (van / walked by / second pair of eyes / odometer) →
  `capture` (one SECTION per screen, Back / Next — <next section name>) → `capture-review`
  (tally, defect list, gaps, Submit). All three are `back: true`; the walk is not a tab.
- The in-progress walk lives in `S.cap` — UI state, not a record. Nothing is written to the
  store until Submit. `S.cap.res` is keyed by checklist item id, `S.cap.secIdx` is the section
  being walked. A walk therefore survives a reload, a tab switch and a phone locking, and it
  reaches nobody else until it is submitted. Verified across a full page reload.
- `capDraftCard()` puts the unsubmitted walk at the TOP of the Queue as a dashed-amber card
  ("NOT SUBMITTED · started HH:MM · N of M answered") with Discard / Carry on. Without it a
  half-finished walk is invisible and the manager thinks the van was never checked. Carry on
  returns to the exact section left off. While a draft exists the "+ Record a spot-check"
  button is suppressed — one walk at a time, and starting a second would silently eat the first.
- Discard is TWO-TAP (`S.capArmDiscard`): it sits a thumb's width from Carry on and there is no
  undo. `goTab()` disarms it, so a half-tapped discard cannot survive a trip to another tab.
- Answers are pass / fail / na as lowercase strings in a `.seg` segmented control. Tapping the
  answer already given takes it back off — a mis-tap must be undoable without a Clear button.
- MEASURED items are not answered by hand: `measuredOutcome()` derives pass/fail from the
  readings, and a SINGLE blank reading leaves the item unanswered rather than quietly passing
  it. `readingState()` marks each field red past `limit` and amber inside `warn`.
- Reading inputs are `type="text" inputmode="decimal"`, NOT `type="number"`: a number input
  reports `''` while the user is mid-decimal ("1.") and every keystroke re-renders, so the
  digit just typed would be deleted. Verified by typing "1.4" one key at a time.
- A fail defaults to the safest reading of itself (`failDefaults`): a critical item starts
  major and presumed not-safe-to-drive. Defaults never overwrite an answer already given.
- A fail REQUIRES a note before the check can be submitted — an empty note is why "N/S front
  tyre" jobs come back untouched. The review screen refuses to submit while any item is
  unanswered and offers a "Back to <section>" jump; a gap reads as "nobody looked".
- Submit copies `name` + `sectionName` + `crit` ONTO each result row and coerces readings to
  numbers. The checklist will be edited again; a finished check must not change shape when it is.
- **Multi-defect fix (data loss).** `viewCheck`/`approve` only ever showed and raised the FIRST
  failed item, because before capture existed a check carried at most one fail. A real walk
  fails as many items as are wrong. Now `failedResults()` returns all of them, the check screen
  renders "N jobs to raise" with one card each, the button reads "Countersign & raise N jobs",
  and `approve` inserts one defect per fail — all to the same workshop and due date, since it is
  one van making one visit. Verified: a 2-fail check raised exactly 2 defects.
- New CSS: `.seg` / `.seg-btn` / `.seg-btn.is-on.is-fail`, `.read-grid`, `.field.is-watch`.
- `sw.js` VERSION is now `v9`.

### Coverage from real history (set by item 19)
- The demo histogram (`VANS = [142, 118, …]`) is gone. Every figure on the screen is derived
  from `checks` + `vans` on each render; nothing about coverage is stored.
- Days-since-last-check comes from the CHECK HISTORY, never from `vans.lastCheckOn`. That field
  is a denormalised convenience and stops being true the moment a check is deleted or re-dated;
  the history is the only thing that cannot drift from itself. `lastWalkedOn()` builds the map.
- A SENT-BACK check still counts as "walked": somebody stood at the van and looked. Its defects
  were never raised, but the van was seen, and coverage measures seeing.
- RETIRED vans are excluded from coverage entirely (never drawn, never counted against the
  depot). OFF-ROAD vans still count — an off-road van is still uncovered.
- Never-walked is `days: null`, a first-class value, not a number: it sorts ABOVE every real
  figure, renders as `NEW`, counts as forced AND eligible, is left OUT of the average, and gets
  its own red line. Coercing it to 0 or to 9999 would lie in one direction or the other.
- All-retired fleet gets its own empty state ("Nothing left to cover"), distinct from item 14's
  "Nothing to cover yet" — a depot with nothing left to walk is not a depot with no vans.
- **Draw rules moved out of `S` into store `settings`** (the move item 12 flagged). They are
  depot policy — the same on every phone, and a phone that has never opened Coverage must still
  draw by them. `RULES` declares `{key,label,unit,min,max}`; `drawRules()` clamps on the way OUT
  as well as in, because these decide what gets checked.
- **`settings.targetPerDay` renamed to `targetPerWeek`.** It was always read as a weekly target
  (the label has said "Target per week" throughout) — 8 checks a day is not a thing a depot does.
  `migrate()` carries the number over and `delete`s the old key, so only one ever exists on disk.
- Rules are TYPED, not cycled (phase-2 rule: a number becomes a real input). `type="text"
  inputmode="numeric"`, same reason as the capture readings. `S.ruleDraft` (keyed by settings
  key) holds a value that does not parse inside its range, so a half-cleared field can never be
  saved as "exclude nothing"; the live rule is untouched until the draft is valid, a red note
  says so, and `goTab()` clears the draft on leaving. Verified: '' / '0' / '999' all held the
  stored 14, '3' committed.
- `.van-cell` is a real `<button>` now (tap opens the van), so app.css carries a UA button reset
  plus `.is-never` (solid red fill — it is already overdue; the fill is what says "no history").
- **Export is real.** The button said "Export this week (CSV)" while the action toasted "it
  lands in your email when the depot syncs" — impossible under "local only, no hosting, no
  deploy". It now builds the CSV from the week's finished checks and hands it to the browser as
  a Blob download (`spot-checks-YYYY-MM-DD.csv`, BOM for Excel, every cell quoted because a
  return note is free text). Empty week toasts instead of downloading an empty file.
- `sw.js` VERSION is now `v10`.

### Phone viewport + LAN access (set by item 20)
- Swept every screen at 375x812: the five tabs, van form, checklist, checklist section, people,
  workshops, check detail, capture-start, all five capture sections, the fail-detail UI, and
  capture-review. `document.documentElement.scrollWidth` stayed 375 everywhere — no horizontal
  overflow anywhere, and no console errors on either origin.
- Three tap targets were under `--tap: 44px` and are now at it: `.chip` 38→44, `.rename` 34→44,
  `.van-cell` 36→44 (54x44 after the fix). The rule is the one `.icon-btn` already stated — a
  control keeps a full target even when it is visually small, because it is tapped with a gloved
  thumb in a depot. Post-fix re-sweep of all 13 screen states: nothing under 44.
- NOT defects, checked and left alone: `.field` inputs measure ~21px, but `.field` is a `<label>`
  wrapping the control, so the whole 56px card is the tap target (verified with
  `elementFromPoint`). [The `.evidence` strip was reworked after this — see Problems: what read as
  "an intentional snap-scroller" stopped being defensible once the photos became real evidence.]
- `README.md` is new and is the LAN document: run it (`python -m http.server 4174`), find the
  host IP (`ipconfig` → 192.168.50.162, a DHCP lease), firewall (an existing python.exe Public
  Allow rule already covers it; a port rule is given for the user to run if that changes), and
  an exposure warning — `http.server` is unauthenticated, stop it when idle.
- **Service workers do not exist over the LAN IP, verified not assumed.** Opened at
  `http://192.168.50.162:4174`: `isSecureContext` false, `navigator.serviceWorker` **undefined**,
  `caches` **absent** — the APIs are not exposed at all on an insecure origin, not merely
  refused. `http://localhost` is exempt; `http://192.168.x.x` is not. The app still comes up
  fully (6 tabs, zero errors) only because `app.js:2218` guards with `'serviceWorker' in
  navigator`; anything added later that touches either API must guard the same way.
- To test offline on a real phone, put the phone on localhost rather than an IP:
  `adb reverse tcp:4174 tcp:4174` on Android. iOS has no equivalent without extra tooling —
  test offline on the desktop browser there.
- `sw.js` VERSION is now `v11` (app.css changed). Verified live: caches read `spotcheck-shell-v11`.

### Phase 2 decisions (2026-08-16, answered by user)
- **Data source: BOTH.** Build the in-app capture flow now, but route every read/write through a swappable data layer so a backend can replace localStorage later without touching the screens.
- **Checklist: keep the 31-item template as an editable default.** It is starting config, not mock data. The user shapes it via More → Checklist.
- **Deployment: local only for now.** Runs off the local dev server, reached from the phone over the LAN. No hosting, no deploy.
- Everything else demo-seeded gets emptied: checks, defects, fleet, people, coverage history.
- Tap-to-cycle stays only for genuine enums (unit, parts, fails-above/below, role, list filter). Anything that is a name, a date, a number, or free text becomes a real input.

### Phase 3 decisions (2026-08-17, go-live review, answered by user)
- **No backend, and no sharing.** Two users, each on their OWN device, each opening the link and
  working alone. Nothing syncs between them and nothing is meant to. This retires the objection
  raised in review that the inspector->manager countersign is a cross-device handoff: it is not,
  the same person does both on their own phone.
- **No login for this version.** Own phone = phone lock is the auth. Identity stays SELF-ASSERTED:
  `app.js:1211` says "Signs in by name — no PIN", the inspector is picked from a dropdown at
  capture-start, and countersigning stamps whichever name is selected. Fine between two colleagues
  who trust each other; NOT a signature that stands up to an insurer or DVSA. Flagged, deferred,
  not a blocker. `people.pinSetOn` remains an unused placeholder in the record shape.
- **Hosting is still required, and is not a backend.** Service workers do not exist on
  `http://192.168.x.x` (item 20, verified), so today the app only runs while the laptop serves it
  and the phone is on that Wi-Fi — in a depot with no signal it is a blank page. Any HTTPS static
  host (Pages/Netlify/Cloudflare) fixes it with zero server code.
- **Origin scoping is the migration trap.** localStorage is keyed by scheme+host+port, so
  `http://localhost:4174`, `http://192.168.50.162:4174` and a future `https://…` are THREE separate
  databases. The hosted app opens EMPTY. Item 21 exists because of this: the CSV covers one week of
  finished checks and cannot carry a depot across.
- **Photos were never implemented.** `app.js:629` renders eight empty divs from a hardcoded label
  array (FRONT/REAR/O-S/N-S/CAB/ODOMETER/LOAD/PLATE) — no camera, no file input, nothing stored;
  the item-18 walk has no photo step. Three pieces of copy claim otherwise (the countersign
  warning "the photos, the readings, the defect call"; the send-back reason "Photos too dark or
  blurred to judge"; the defects footnote "photographs the repair"). **Ruled: build them for real
  (item 23), do not delete the strip** — the photo IS the evidence a workshop acts on.
- **Photos cannot live in localStorage.** ~5MB per origin, strings only; one phone photo is 2-4MB
  before base64 adds a third. Decision: downscale to ~1000px JPEG (~150KB) and put the blobs in
  **IndexedDB**, keeping only photo ids on the check record. Second storage layer, deliberately.
- Finished checks never leave the Queue (`viewQueue` renders all of `doneChecks()`), so the Queue
  is today's archive and its heading "Awaiting your countersign — oldest first" stops being true
  as soon as anything is countersigned. There is no filter, no search, and no per-van history —
  the van screen shows status and MOT, not past checks. That is item 22.

### Backup file (set by item 21)
- **File shape:** `{ app: 'fleet-spot-check', format: 1, exportedAt: <ISO>, db: <Store.snapshot()> }`.
  The envelope exists so a stray .json is identifiable *before* it is allowed to overwrite a depot,
  and so `exportedAt` stays **out of** the database — `migrate()` is `assign(emptyDb(), stored)`,
  so anything sitting beside `schema` is carried into storage permanently.
- `readBackup(text)` is liberal in what it accepts (a bare `Store.export()` db restores as happily
  as a wrapped one — a backup that will not go back in is not a backup) and strict about what it
  then trusts. **This validation is load-bearing:** `Store.import({})` would sail through migrate()
  and silently empty the depot. Refusals: not-JSON, no numeric `schema`, `schema > Store.SCHEMA`
  (migrations only run forward), any of the six COLLECTIONS not an array. All five verified.
- **`pendingImport` is a module-level `let`, deliberately not in `S`.** Everything in S is
  stringified into localStorage on every keystroke; a depot's worth of records does not belong in
  that blob. `S.importSum` holds only counts, a filename and a date — enough to render the card.
- **The file picker is built in JS, not rendered into the markup.** A file input reports its choice
  as `change`, and `handle()` gates on `isField !== (e.type === 'input')` — a delegated one would
  never fire. One reused picker, `value=''` after each pick so re-picking the same file still fires.
- **After a restore, S is thrown away** (`{ ...freshState(), list: publishedList() }`, nav reset to
  More). A selected van, a half-walked check and a checklist draft all point at ids that no longer
  exist.
- **Filename:** `spot-check-backup-YYYY-MM-DD.json`. Download uses the same Blob/anchor/revoke
  pattern as `exportWeek`.
- `sw.js` VERSION is now `v13` (app.js changed twice). Verified live: caches read
  `spotcheck-shell-v13`. README's "Current version" line updated to match.
- Verified end to end on localhost: export captures 24,972 bytes with the right envelope and
  re-reads clean; a staged restore over a mutated depot removed the added van and persisted; cancel
  clears both `pendingImport` and `importSum`; arm/disarm and the load() clears all behave.

### History: queue vs archive + per-van record (set by item 22)
- **The queue is a to-do list again, not an archive.** `viewQueue` rendered all of
  `doneChecks()`, so every countersigned check stayed on it forever and the heading "Awaiting
  your countersign" quietly stopped being true. Now `queueChecks()` =
  `doneChecks().filter(c => c.decision !== 'countersigned')` — pending PLUS sent-back (a sent-back
  check is still open work: it comes back when the inspector resubmits, so it stays). Only a
  COUNTERSIGNED check — a finished document — leaves the queue.
- `historyChecks()` is the archive: countersigned only, sorted by `decidedAt || finishedAt`
  DESCENDING (newest signature first — History is browsed, not worked oldest-up like the queue).
- New screen `history` (SCREENS entry, `back: true`), reached from More → **Records → History**
  via `openHistory`. Read-only: tapping a row is the same `openCheck` the queue uses, and the
  check screen already renders a countersigned check as a finished, uneditable document.
- **Per-van history lives on the van detail screen** (the item-22 decision: "the van screen shows
  status and MOT, not past checks"). `vanHistoryBlock(vanId)` lists EVERY finished check on that
  van — countersigned, sent-back or pending — newest first, below the stats and the retiring note,
  above the dock. Only for a saved van (`savedVan`), never while adding. An empty van gets a
  "No spot-checks recorded on this van yet" line, not a missing section.
- **One shared row renderer, `checkRow(c, dim = true)`**, now backs the queue, History and van
  history. `dim` greys a settled row so it recedes among live ones IN THE QUEUE; History and van
  history browse settled records and pass `false`, so they read at full strength instead of a
  wall of grey. The decision→flag/colour logic that was inline in `viewQueue` moved into it
  verbatim.
- Queue empty state now distinguishes "Queue clear" (there ARE countersigned checks, pointed at
  More → History) from "Nothing waiting" (none ever submitted) — the old single "Nothing waiting"
  couldn't tell a caught-up depot from a brand-new one.
- Verified live against the real depot (1 van, 1 countersigned check) by driving `goTab`/`render`
  and reading the DOM: the countersigned check is OUT of the queue (queue shows "Queue clear" +
  "More → History"), IN History (1 row, topbar "History"), the More row renders, and a seeded
  3-check van (countersigned + pending + sent-back) showed all 3 in `vanHistoryBlock` with the
  right flags. `queueChecks`/`historyChecks` split confirmed (`['null','sent-back']` in the queue,
  every history row `decision === 'countersigned'`, sorted newest-first). Test data inserted under
  a `Store.export()` snapshot and rolled back with `Store.import(snap)` — depot left exactly as
  found. `node --check` clean on app.js and sw.js.
- `sw.js` VERSION is now `v14` (app.js changed). Asserted on new symbols
  (`typeof queueChecks === 'function'`, `SCREENS.history`) rather than the cache name, per the
  item-17/21 cache-trap lesson — the running build is the new one.

### Photos: real capture + IndexedDB (set by item 23 — the last item)
- **New file `photos.js`, a deliberate SECOND storage layer.** It owns an IndexedDB database
  `spotcheck.photos` (object store `blobs`), exposes `window.Photos`, and loads BETWEEN store.js
  and app.js (index.html). API: `put(blob)->id`, `get(id)->Blob|null`, `remove`, `removeMany`,
  `keys`, `gc(keepIds)`. Ids are `pho_<uuid>`. Mirrors store.js's driver pattern: if IndexedDB is
  missing or refused (private mode), it falls back to an in-memory Map so capture still works for
  the session — the photo just does not survive a reload, same graceful-degradation contract as
  the localStorage driver.
- **Why a second layer at all (the phase-3 ruling).** Photos cannot live in localStorage: ~5MB per
  origin, strings only, and one phone photo is 2-4MB before base64 adds a third. So blobs go in
  IndexedDB (megabytes, binary-native) and **only the photo id lives on the check record** —
  `check.photos` is `{ SHOT_LABEL: id }`. The check record in localStorage stays tiny; the bytes
  live elsewhere, keyed by the ids it holds.
- **Downscale before store, verified.** `downscale()` uses `createImageBitmap(file,
  {imageOrientation:'from-image'})` (so an EXIF-rotated phone photo is baked upright) → canvas →
  `toBlob('image/jpeg', 0.7)`, capped at `PHOTO_MAX = 1000`px on the long edge. Verified live: a
  2000x1500 source came back **1000x750**, 6.4KB. A phone photo lands ~150KB, not 3MB.
- **The eight shots** are `SHOTS = [FRONT, REAR, O/S, N/S, CAB, ODOMETER, LOAD, PLATE]` — the same
  labels the fake strip hardcoded, now real slots. Photos are OPTIONAL, not gated: `capSubmit`
  never requires one. A fail with no photo is still submittable — but the review shows a "N of 8"
  counter and the copy that always claimed photos exist (countersign warning, send-back "too dark
  or blurred", defects "photographs the repair") is now honest.
- **Sync render vs async IndexedDB — the seam.** `render()` stays synchronous; a photo thumbnail is
  emitted as `<img data-photo-id="…">` with NO src, then a post-render `hydratePhotos()` pass reads
  each blob from IndexedDB, makes an object URL, sets `.src`, and caches the URL in a module `Map`
  (`photoUrls`) so a re-render never refetches or flickers. Same pattern the whole app uses (render
  synchronous, side data filled after).
- **The file picker is built in JS, not markup** — reusing item 21's lesson: a file input reports
  its choice as `change`, and `handle()` gates on `isField !== (e.type === 'input')`, so a
  delegated markup input would never fire. One reused hidden `<input type="file" accept="image/*"
  capture="environment">`; `capture="environment"` asks for the rear camera on a phone and is
  ignored on desktop. `value=''` after each pick so re-picking the same file still fires. Verified.
- **Orphan management, both ends.** `releaseCapPhotos()` runs on discard/abandon and deletes every
  blob the in-progress draft put (verified: abandon dropped the blob 1->0). And `gcPhotos()` runs
  at BOOT (after first render, so a slow sweep never delays paint): it collects every id still
  referenced by a saved check plus the live `S.cap` draft and calls `Photos.gc(keep)`, dropping any
  blob nothing points at — the cleanup for a crash mid-capture or a restored backup. Verified: gc
  keeping one of two ids dropped the other.
- **Known limitation — a backup does NOT carry the photos.** The JSON backup (item 21) is a
  `Store.snapshot()` of localStorage; photo BLOBS live in IndexedDB, outside it. So a restored
  backup carries the photo IDS but the bytes stay on the origin they were taken on: the restored
  depot shows those slots empty. This is consistent with the "photos are a device-local second
  layer" ruling and is stated to the user in the backup screen's own note ("The photos stay on this
  phone… restoring it on another phone shows those slots empty"). store.js's record-shape comment
  documents the same. Carrying blobs in the JSON would reintroduce exactly the multi-MB-string
  problem the second layer exists to avoid; if photos must travel, that is a real backend (a
  phase-3 non-goal), not a bigger JSON.
- `sw.js` VERSION is now `v15` (new shell file photos.js + app.css + app.js changed); `photos.js`
  added to `SHELL_FILES`. Verified live end to end on localhost (see the item-23 Problems note on
  the cache trap): IndexedDB put/get/remove/gc roundtrip; the viewCheck evidence strip renders 8
  real slots (empty state tagged, N/S flagged) and hydrates a stored blob into a thumbnail; the
  full-screen enlarge overlay opens and taps closed; the capture-review photo grid renders 8 add
  tiles; a real 2000px image driven through the file input downscaled to 1000px, stored, and turned
  the tile into a thumbnail with retake/remove; remove deleted the blob; the draft persisted
  `photos: {REAR: pho_…}` — the exact object `capSubmit` spreads onto the record; abandon cleaned
  the blob up. Zero console errors throughout. Depot left as found.

## Items
- [x] 01 - Import design project via claude_design MCP
- [x] 02 - Extract .dc.html + support.js to disk
- [x] 03 - Audit external refs (scripts / URLs)
- [x] 04 - launch.json + first browser smoke test
- [x] 05 - index.html app shell
- [x] 06 - app.css
- [x] 07 - app.js (+ 3 follow-up edits)
- [x] 08 - manifest.webmanifest + sw.js + icons (192/512/maskable/apple-touch)
- [x] 09 - Test at phone viewport: 375x812, all 5 tabs render, no console errors, no h-overflow
- [x] 10 - Verify PWA wiring (SW active + controlling, 9 shell files + 4 font files cached, manifest standalone) + countersign flow end to end
- [x] 11 - store.js: persistence adapter, documented record shapes, swappable backend seam
- [x] 12 - Move seeded collections (checks, defects, fleet, people) out of module constants into store-managed state
- [x] 13 - Strip demo seeds to empty; keep the 31-item checklist as the default template
- [x] 14 - Empty states for Queue / Defects / Coverage / Vans
- [x] 15 - Real inputs on the van form: reg, model, bay (text), MOT (date)
- [x] 16 - Real due-date input + assignee picker sourced from real people/workshops
- [x] 17 - Workshops & assignees editable in More
- [x] 18 - Capture flow: "Record a spot-check" — pick van, walk checklist, flag defects, save to Queue
- [x] 19 - Coverage computed from real check history instead of the demo histogram
- [x] 20 - Phone-viewport test + LAN access instructions
- [x] 21 - JSON export/import: backup, and the only path that carries data to hosting
- [x] 22 - History: finished checks out of the Queue + per-van check history
- [x] 23 - Photos: real capture + IndexedDB storage (the app claims photos it cannot take)

## Items — phase 4 (feedback batch, 2026-08-18)
- [x] P4-1 Year date bug (pickDue clamp) — date fields now written quietly (no per-keystroke
      rebuild that dropped focus off the year segment); past-date rule moved to dueValid()/approve;
      added dueValid() + red "can't be in the past" note + .note.is-red. node --check clean.
- [x] P4-2 Fleet-green theme + manifest theme_color — repointed the single accent token
      `--ink` #2E4A5C→#1E6B45 (fleet green), so every action/selected state greens app-wide at
      once (buttons, chips, selected cards, tabs, focus, fields). Added header tokens
      (`--header` #123C29 dark depot green / `--header-text` #F1F6F3 / `--header-muted` #A9C4B6 /
      `--header-line`); `.topbar` now dark-green bg + light text, `.topbar-meta`/`.back` recoloured
      to read on it. Surfaces (`--page`/`--surface`) left neutral — NOT a whole-grey hue-swap.
      manifest theme_color + both meta theme-color → #123C29 (background_color stays light for the
      splash). sw VERSION v16→v17. Verified live (cleared SW cache first): --ink green, topbar bg
      rgb(18,60,41), theme-color #123C29 in DOM, and a screenshot showing the dark-green header,
      green +ADD A VAN, green active tab on a clean light shell. Header *layout* redesign is P4-5.
- [x] P4-extra Settings group (user ask: "create a setting group... so the screen less clutter").
      New `settings` screen (`viewSettings`, back:true) pulls the two heaviest, rarely-used blocks
      OFF the More menu: Backup (`backupBlock()` save/restore + staged-import red card) and This device
      (`resetAll` Empty-this-depot arming). More is now a clean menu — Depot setup (Checklist/People/
      Workshops) + Records (History) + a single "Settings" row under a new "Device" group. Added a
      gear `ICON.settings`, `openSettings: push('settings')`, and an About line (checklist version).
      Guard: popstate now clears a staged `importSum` when backing out of Settings (the red "replaces
      everything" card only renders there) — mirrors the goTab guard at line ~2036. sw VERSION v17→v18.
      Verified live (cleared SW cache): More menu screenshot clean, Settings screen shows Backup/This
      device/About, no console errors. Serves the P4-5/P4-7 declutter goals.
- [x] P4-reskin Full app reskin — the accepted answer to "it feel not like an app. very cramp
      better spacing. the either theme too much going on". Two AskUserQuestion decisions drove it:
      (a) light & airy shell, accent used ONLY for actions/active states — so the dark depot-green
      header from P4-2 is GONE, replaced by a near-white header (`--header` #FBFCFC) with a hairline
      and dark ink title; (b) "make it so it look like a app easy to use" — pulled back the ALL-CAPS
      mono, which now appears only on genuine data (reg plates, mileage, timestamps). Buttons,
      notes and labels are sentence-case sans. Spacing moved onto a --gap-1..5 scale.
      THEN the user rejected only the colour: "like this is fine.just. i dont like the green color
      tho. use something else more suitable". So `--ink` #1E6B45 → **#1B4D7A deep navy**, `--ink-wash`
      → #E9F0F6. Navy reads as document-and-authority and never argues with the red a defect is
      drawn in. Repo-wide grep: no green hex values remain (three prose comments still say "green").
      manifest + both meta theme-color → #FBFCFC, background_color #F4F6F7, color-scheme light.
      Verified live after clearing the SW cache: --ink #1B4D7A, --ink-wash #E9F0F6, --page #F4F6F7.
      Also in this pass: thumb-first sizing (--tap 46px), and a real signature pad (`.sig-pad`
      canvas, ink held as a PNG data-URL and repainted by hydrateSig() each render, guarded by a
      data-check id) wired into countersign — the app previously claimed a sign-off it couldn't take.
- [x] P4-3 Current-user model + header identity switcher + sign out.
      `S.userId` + `me()`; new `whoami` screen (`viewWho`, back:true) reached from a real
      `<button class="who">` in the topbar meta line (styled as a label, earns its tap target with
      negative margin, `›` affordance). `beMe` sets the id and pops back; `signOut` clears it and
      deliberately LEAVES a half-walked check alone — it already carries the inspector's id and name,
      so it is that person's work whoever picks the phone up next, and binning it would lose a real
      walk. `newCap()` now seeds "Walked by" from whoever is signed in — a default, not a lock, since
      a manager walking a van themselves is ordinary. Verified live: header read "Not signed in" →
      tapped through to "Who are you?" listing all 3 people with roles → signed in as Dan Whitrow
      (header "Inspector · Dan Whitrow", userId persisted) → signed out (header back to "Not signed
      in", userId ""). sw VERSION v19→v20.
- [x] P4-4 Delete for people & vans (two-tap arming) — answers "if accident add can't del" without
      giving anybody a one-tap way to shred a year of inspections. The two cases are deliberately
      ASYMMETRIC:
      * People can ALWAYS be deleted, because a check copies `inspectorName` onto itself at submit —
        past checks read identically afterwards. The armed note states how many checks carry their
        name (`personCheckCount`) so "nothing is lost" is demonstrated, not asserted. Deleting the
        signed-in person also clears `S.userId`. Suspend remains the right tool for a leaver.
      * Vans can be deleted ONLY with zero checks AND zero defects (`vanDeleteBlock`). Checks and
        defects point at `vanId` and coverage counts the van, so deleting one with history would
        leave records about a vehicle the depot has no record of. With history the block explains
        why and points at Retire (out of the draw, out of coverage, history intact). The count is
        re-checked inside `delVan` in case a check lands between the arming tap and the confirming one.
      Arming is honest: `handle()` disarms on any other action (per-row id comparison for people, so
      tapping Delete on a different person disarms the first), `goTab()` disarms on leaving, and
      `popstate` disarms on backing out — so "Tap anything else to cancel" is literally true.
- [x] P4-5 Header + tab nav redesign — folded into P4-reskin and confirmed at 375px. The topbar is
      now a near-white bar with a hairline rather than a slab of accent colour, the title sits in
      dark ink, and the only coloured things in the chrome are the active tab and the actions. The
      dock's five tabs (queue / defects / coverage / vans / more) each clear the 46px tap floor at
      375px with no horizontal overflow.
- [x] P4-6 Full build sweep — `node --check` clean, then the whole app walked end to end at 375px
      against a live server rather than read off the source. What the sweep actually exercised:
      * Capture journey: van pick → mileage → all 5 checklist sections → measured readings (tread /
        pressure) → review → submit. Draft persistence survives a full reload ("Carry on" resumes
        mid-walk). Submit gating works both ways: blocked at "22 still open" with a jump-back link,
        then a clean submit reading "LR70 BTU submitted clean." with `capCleared: true`.
      * Signature pad end to end: stroke → Clear appears and the hint goes → the ink survives later
        re-renders (hydratePhotos/hydrateSig re-paint) → approve stays gated behind the defect
        assignment ("Assign + due date required") until it's filled → after approve a 6,890-byte
        image/png sits in IndexedDB under the check's `signatureId` and renders as a blob: URL.
      * No horizontal overflow on any of the five tabs at 375px.
      Three real defects found and fixed by the sweep, plus one integrity finding:
      * Field tap target: a `.field` card is 46–74px tall but the input line inside it was only
        ~21px, so a thumb aimed at the middle of the card — or at its label — focused nothing.
        `flex:1 1 auto` on `.field-input` fixed the roomy cards but NOT the ones already
        content-sized by two-line labels (no free space to distribute), so the real fix is a
        delegated listener that focuses the input when any dead part of the card is tapped. The
        card looks like one control; it now behaves like one.
      * Two ALL-CAPS-in-prose misses left over from the de-capping pass. (a) A checklist seed hint
        still shouted 'LOOK UNDER, NOT JUST AROUND' → sentence case. The two other caps strings in
        that seed are DEAD (`hint: m ? '' : it[2]` discards them for measured items) so they were
        deliberately left alone rather than "fixed" invisibly. (b) The photo tiles read FRONT /
        REAR / ODOMETER etc. Those strings are storage KEYS of `check.photos` — renaming them
        orphans every existing photo id — so a `SHOT_LABEL` display map was added instead and the
        keys left shouting where they belong. O/S and N/S keep their caps: offside and nearside are
        abbreviations on the page, not emphasis. `.shot-tag` also had to lose mono, and so did its
        parent `.shot`, because the tag INHERITS letter-spacing from the tile — de-mono'ing only
        the tag left a sentence-case label still tracked out at 0.5px.
      * Integrity finding (a judgement call, flagged to the user): a manager can countersign a van
        they walked themselves, and the copy read "You're putting your name to Tien Nguyen's work"
        to Tien Nguyen — which reads as a bug and quietly dresses a self-signature up as a check.
        NOT hard-blocked: a one-manager depot would then never be able to close a record, and a
        stuck record is worse than a self-signed one. Instead a `selfSign` branch names it plainly
        in all four states — awaiting-self ("Your own walk · awaiting your countersign", red note
        saying it closes on your signature alone, no second pair of eyes, get another manager if
        one is about), awaiting-other (unchanged), decided-self (the record says it was never seen
        by a second person), decided-other (unchanged). Verified live on a real self-walked check.
- [x] P4-7 App-like / UX / responsive polish — the substance of this landed in P4-reskin (spacing
      scale, light shell, sentence-case chrome, 46px thumb targets, settings group) and the
      remainder in the P4-6 sweep fixes above. Nothing left that isn't already an entry.
- [x] P4-8 sw VERSION bump + Netlify redeploy + README version — all three done. `sw.js` is at
      `v24` (bumped on every shell change through this phase: v20 identity, v21 delete rules, v22
      field tap target, v23 photo-tile labels, v24 self-countersign copy) and README's "Current
      version" line now reads v24 instead of the stale v16. The staged folder was built exactly as
      the README snippet says — index.html, app.css, app.js, photos.js, store.js, sw.js,
      manifest.webmanifest and icons/ only, so PROGRESS.md (which carries the LAN IP), README.md and
      design/ stay off the public site. Deployed 2026-08-18 (deploy id 6a84489442f285e50793d557,
      6 changed files) and verified live: https://checkup-van.netlify.app/sw.js reads
      `const VERSION = 'v24'`, and PROGRESS.md, README.md and design/ all 404 as they must.
      One trap worth writing down: `--site checkup-van` FAILS with "Failed retrieving site data" —
      the CLI's default project in this folder resolves to an unrelated site (hourslog2, no
      .netlify/state.json here), and the name lookup doesn't find checkup-van. Deploy by SITE ID,
      not by name:
      `netlify deploy --prod --dir "$pub" --site a66b1464-2703-4498-beb5-6bd2d7cba85f`
      Getting this wrong once would have published a fleet app over somebody else's site.
- [x] P4-9 Self-countersign nudge names the alternates (v25). CODE DONE + VERIFIED; **DEPLOY
      OUTSTANDING** — see Problems, "v25 deploy blocked".
      This change was found on disk UNLOGGED at the start of the 2026-08-18 22:34 session: app.js
      and sw.js were newer than PROGRESS.md (22:05 vs 21:57) and sw.js read v25 while PROGRESS and
      README both said v24. With no git here, the previous state was recovered by diffing local
      files against the *deployed* v24 (curl of the live site) — the live site is the last
      known-good snapshot, which is worth remembering the next time a session drops mid-edit.
      Only app.js and sw.js differ; app.css, index.html, store.js, photos.js and the manifest are
      byte-identical to live.
      What it does: P4-6's `selfSign` copy ended on "If another manager is about, it is worth their
      signature instead of yours" — a generality, and generalities are easy to skip past. Two new
      helpers, `otherManagers()` (active managers who are not the signed-in user) and `nameList()`
      ("Dan", "Dan or Sam", "Dan, Sam or Jo"), let the awaiting-self note either NAME who could
      sign instead, or state plainly that there is nobody else — which turns the warning from a
      reproach into a fact. `alts` is only computed while the decision is open (`selfSign &&
      !csDone`), so decided records are untouched. Suspended managers are excluded deliberately:
      printing their name would send somebody off to find a person who can no longer sign.
      Verified this session against a live server, not read off the source: `node --check` clean on
      all four scripts; `nameList` correct at 0/1/2/3 names; SW cache cleared first, then the new
      symbols confirmed present (`typeof otherManagers === 'function'`) before asserting anything.
      Both branches exercised in the DOM — with a second active manager the red note reads "Dan
      Whitrow could countersign it instead, and it is worth the ask.", and with that manager
      suspended it falls back to "You are the only manager on the books, so this is the only way to
      close it." No console errors, no horizontal overflow at 375px (`is-push`/`is-pop` stripped
      before measuring, per the item-20 lesson).
      Test data: the depot has no OPEN self-walked check (all three are decided), so verifying
      meant temporarily nulling `decision`/`decidedAt`/`decidedBy` on `che_8c1d9570` and flipping
      Dan Whitrow to manager/suspended. All of it was restored afterwards and the restore was
      asserted, not assumed — the check compares byte-identical to its pre-test snapshot
      (`JSON.stringify` equal, 0 differing keys), Dan is back to inspector/active, and the depot
      still holds 2 vans / 2 people / 3 checks.
      README's "Current version" line updated v24 → v25 (it describes `sw.js` on disk, which is
      v25; the LIVE site is still serving v24 until the deploy runs).

- [x] P4-10 Top header nav bar rebuilt, avatar far right (v26). User ask, verbatim: "rebuild the
      Top Header Nav Bar. far right Avatar". CODE DONE + VERIFIED; **DEPLOY STILL OUTSTANDING** —
      this rides along with the blocked v25 deploy, which is now a v26 deploy.
      What changed. The topbar was a column flex of two stacked rows (title row, then a meta line
      of "Manager · Name ›" + sync status). It is now a 2-column CSS grid,
      `minmax(0, 1fr) auto`: both existing rows are pinned to column 1 and a new 40px avatar
      button sits in column 2 spanning both rows (`grid-row: 1 / span 2`, `align-self: center`),
      so it stays optically centred whether the header is 66px tall (no back button) or 82px
      (with one). `app.js` gained `ICON.person` — a ONE-figure glyph, deliberately not the
      two-figure `people` glyph, which in this app already means "the people list" — and an
      `initials()` helper (first letter of the first two words, uppercased).
      Signed in: navy pill (`--ink`) with white initials. Not signed in: hollow with a dashed
      navy border and the person icon, matching the "provisional / needs attention" dashed
      language used elsewhere. A blank name falls back to the icon rather than an empty pill.
      Why the name is still spelled out. The obvious reading of "far right avatar" is to replace
      the identity line with the avatar. That was rejected: on a shared depot phone the cost of a
      misread identity is a check signed in somebody else's name, and initials are ambiguous (two
      people can both be DW). So the meta line keeps the full "Manager · Dan Whitrow" text and
      stays tappable — but it is now `tabindex="-1"` + `aria-hidden="true"`, so keyboard and
      screen-reader users meet exactly ONE identity control instead of two that do the same
      thing. Confirmed in the a11y tree: the only exposed header control is the avatar, labelled
      "Manager · T — switch person or sign out". The `›` chevron on the meta line was dropped
      (the avatar is the affordance now), and the dead `.topbar-action` rule was deleted after a
      grep confirmed nothing renders that class.
      Tap target: the pill is 40px but carries an `::after { inset: -4px }` overlay, so the real
      hit area is 48px without the chrome looking heavy. Verified by hit-testing 2px above the
      pill's top edge — `document.elementFromPoint` returns `.avatar`.
      Verified live at 375px, `is-push`/`is-pop` stripped before measuring (item-20 lesson):
      grid resolves to `285px 40px`, avatar sits at x=317–357 against an 18px right padding, no
      horizontal overflow (`scrollWidth` 375 = viewport), no console errors, and the layout holds
      on a back-button screen (Record a spot-check: back at x=8, avatar still pinned right).
      `node --check` clean on all four scripts. `sw.js` VERSION v25 → v26 and README's
      "Current version" line v25 → v26.
      Dev-server cache trap, worth recording: after clearing the SW caches and unregistering the
      worker, the page still ran the NEW app.js but the OLD app.css — `python -m http.server`
      sends `Last-Modified` and no `Cache-Control`, so the browser heuristically reused the
      stylesheet from HTTP cache without revalidating. The SW was not the culprit this time.
      Diagnosed by diffing `document.styleSheets` rules (still had `.topbar-action`) against a
      `fetch('app.css', {cache:'reload'})` of the same file (did not). Fixed by swapping in a
      cache-busted `<link>`. Real devices are unaffected — they get the v26 shell.
      Deploy folder RE-STAGED for v26 (2026-08-18 23:30) from the README recipe, at
      %TEMP%/claude/C--Users-tienn-GIT-Checkup-Van/723e89f7-409c-419c-b97a-53de0e7ce43d/scratchpad/pub-v26
      Checked, not assumed: exactly the 11 runtime files; leak scan for PROGRESS.md / README.md /
      design/ / any *.md / .claude / launch.json returns nothing; all 11 byte-identical to the
      repo (`cmp`); staged `sw.js` reads v26; staged app.js and sw.js pass `node --check`; every
      local `src`/`href` in index.html and every entry in the SW's SHELL_FILES list resolves
      inside the folder. The stale pub-v25 folder was deleted so the wrong path cannot be pasted
      into the deploy command.
      Deploy command (site by ID — `--site checkup-van` silently targets an unrelated project):
        netlify deploy --prod --dir "<pub-v26 path above>" --site a66b1464-2703-4498-beb5-6bd2d7cba85f

- [x] P4-11 Header restyled as app chrome; sync status moved onto the avatar as a badge (v26).
      User asks, verbatim: "redesign the Top Header Tab Nav Bar. so it look more like a app." +
      "add shadow to the bottom and see", then "move it inside the avatar". CODE DONE +
      VERIFIED; **DEPLOY STILL OUTSTANDING** — rides the same blocked v26 deploy as P4-9/P4-10.
      Chrome, not a document edge. The 1px `border-bottom` was deleted and replaced with a
      two-layer shadow (`--shadow-header`: a .04 contact line plus a soft 12px spread). A border
      says "the page continues below"; a shadow says "this bar floats over the page", which is
      what native app chrome does. The title went to 700 22px with -.022em tracking so the bar
      leads with a headline rather than a label.
      Scroll-reactive lift. `syncHeaderLift()` (in app.js, right after `render()`) toggles
      `.is-lifted` on `#topbar` once `#screen.scrollTop > 1`, swapping in `--shadow-header-lift`
      (deeper, 20px). A module-level `headerLifted` flag means classList is only touched on the
      transition, not on every scroll event; the listener is bound ONCE at boot inside
      `Store.init(...).then(...)` with `{ passive: true }`, not per render. Transition is
      `box-shadow .2s ease`, nulled under `prefers-reduced-motion`. It is called at the end of
      `render()` too, so a screen change that resets scroll re-settles the shadow.
      One non-obvious fix: `.topbar` z-index went 2 → 5. `.dock` inside `.screen` is
      `position: sticky; z-index: 3`, so at z-index 2 the header's new shadow was painted UNDER
      the dock and vanished on any screen with a bottom action bar.
      Sync status moved into the avatar. It had been a line of text in `.topbar-meta`, then
      briefly an outlined pill; it is now `.avatar-badge` — absolutely positioned at
      `top/right: -3px` on the avatar, 18px min-width, `--amber` fill, white 700 10.5px, and a
      2px border in `--header` so it reads as punched out of the bar rather than stuck on top.
      Amber, not red: red in this app means a defect found on a van. A check waiting for a
      countersignature is attention, not damage, and colouring it red would teach people to read
      the strongest signal the app has as routine paperwork.
      Capped at 9+, and that is not a compromise — `renderTabbar()` already puts the EXACT
      pending count on the Queue tab. The avatar answers "is there something for me?"; the tab
      answers "how much?". Duplicating the precise figure in two places buys nothing and makes
      the header wider. No signer means no badge at all: with nobody signed in it is nobody's
      queue. The count is folded into the avatar's `aria-label`
      ("… — switch person or sign out. 2 checks waiting"), so the one AT-exposed header control
      still carries everything the sighted user gets.
      Verified both branches against a temporarily-seeded store, then restored and ASSERTED:
      2 pending → badge "2", `rgb(138, 97, 22)` on white, 18×18, 2px `rgb(251, 252, 252)` border,
      right edge 360 against the avatar's 357 (overhangs by design, no clipping),
      `document.scrollWidth` still 375 so nothing overflows at the narrow width.
      10 pending → badge "9+", 24px wide, right edge still 360, aria-label reads "10 checks
      waiting", and the Queue tab-badge simultaneously showed "10" — the division of labour
      working as intended. Restore asserted, not assumed: store byte-identical to its pre-test
      `JSON.stringify` snapshot, counts back to seed, badge element gone, `has-badge` class gone,
      aria-label back to plain "Manager · T — switch person or sign out".
      Async-render trap, second sighting this phase (see also item 20): the assertion run in the
      SAME tool call as `Store.remove` reported the badge still present with a stale aria-label.
      It was not a bug — `render()` is scheduled through `queueMicrotask`, so any DOM read in the
      same synchronous expression sees pre-render markup. Re-reading in a separate call showed it
      clear. Rule: never assert DOM state in the same evaluation that mutates the store.
      Dev-server origin note: `.claude/launch.json` now serves port 4175, and localStorage is
      origin-scoped, so `localhost:4175` has its own freshly-seeded depot (3 vans / 1 person /
      0 checks). The 2 vans / 2 people / 3 checks recorded earlier are NOT lost — they live under
      `localhost:4174` and come back if the server is moved to that port.
      Deploy folder pub-v26 RE-STAGED 2026-08-19 (app.css + app.js had changed after the first
      staging). Re-verified: 11 runtime files, all byte-identical to the repo by `cmp`, leak scan
      clean, staged `sw.js` still reads v26, all four scripts pass `node --check`. Path and
      deploy command unchanged from P4-10.

- [x] P4-12 Header identity line and two Who-screen paragraphs removed (v26). User ask, verbatim:
      "remove the one i circel in red", against a screenshot with two red marks on the
      "Who are you?" screen — one round the topbar's "Not signed in" text, one round the
      not-signed-in hint plus the "There is no password" card. CODE DONE + VERIFIED; rides the
      same blocked v26 deploy.
      Removed: the `.topbar-meta` row and its `.who` button from `renderTopbar()`, and the
      matching `.topbar-meta` / `.topbar-meta .who` / `.who.is-none` rules from app.css (grep
      confirms zero remaining references in either file). The topbar is now a single grid row —
      `row-gap: 2px` dropped and `.avatar` changed from `grid-row: 1 / span 2` to `grid-row: 1`,
      because with nothing in row 2 the span was manufacturing an empty implicit row.
      Removed from `renderWho()`: the not-signed-in branch of the faint note, and the
      "There is no password…" card. Kept, deliberately: the SIGNED-IN branch of that same note
      ("Everything you countersign from now on carries this name… switching person never rewrites
      history"). It is a different sentence, it states a real rule about records not being
      rewritten, and it was not on screen in the annotated shot — so it was not what was circled.
      Cutting it would have been collateral damage dressed up as following the instruction.
      Regression recorded, not hidden. P4-10 kept the spelled-out name on purpose: initials are
      ambiguous (two people can both be DW) and on a shared depot phone a misread identity means
      a check signed in somebody else's name. That safety net is now gone from the chrome. The
      full name still labels the avatar for assistive tech and still appears on the Who screen,
      but a sighted user who misreads two letters gets no second chance in the header — and it
      was checked, not assumed, that no signing screen names the signer before you commit
      (`Countersigned by <name>` is rendered AFTER the fact). If a wrong-name signature ever
      surfaces in the depot, putting this line back is the first fix to try. A comment in
      `renderTopbar()` says so at the point of change.
      Verified at 388px, `is-push`/`is-pop` stripped before measuring: header height 72 → 58px on
      a plain screen with the avatar at y 9–49 (9px clear top and bottom, optically centred), and
      64px on a back-button screen with the avatar at y 12–52 (12/12). Back button still at x=8,
      avatar right edge 370 against the 18px right padding, `document.scrollWidth` 375→388 equals
      the viewport so nothing overflows, resting shadow unchanged. No `.who` in the DOM and none
      in `document.styleSheets`. Both circled blocks gone from the not-signed-in Who screen; the
      signed-in Who screen still renders its two notes and no card. Zero console errors.
      Sign-in state was mutated to check the signed-in branch and then restored and ASSERTED:
      back to not-signed-in, avatar `is-none` with no initials, aria-label "Not signed in —
      switch person or sign out", counts at seed (3 vans / 1 person / 0 checks / 0 defects).
      Dev-server cache trap hit AGAIN and worth the repeat: a `fetch(…, {cache:'reload'})` plus
      `location.reload()` was NOT enough — the service worker serves the shell cache-first, so
      the page kept rendering the old header. Clearing `caches` and unregistering the worker
      before reloading is the step that actually lands a CSS/JS change on this dev server.
      pub-v26 re-staged again with the new app.css + app.js; all 11 files re-verified
      byte-identical by `cmp`, `node --check` clean, staged sw.js still v26.

- [x] P4-13 Coverage moved off the tab bar and into More, under Settings (v26). User ask, verbatim:
      "Move the Coverage into more and under setting". CODE DONE + VERIFIED; rides the same
      blocked v26 deploy.
      `TABS` is now four entries — queue / defects / vans / more. `SCREENS.coverage` gained
      `back: true` because it is reached by `push` now, not by a tab switch, and a new
      `openCoverage: () => push('coverage')` action sits directly after `openSettings` so the
      More list reads … Settings, then Coverage. Coverage got its own `Fleet` divider label
      rather than being dropped into the existing `Device` group: "under Settings" is satisfied
      positionally, and a fleet report filed under "Backup, restore and reset this depot" would
      have been a lie about what it is. The row carries a live summary — forced-van count when
      any van is past the force threshold (and `is-red` with it), otherwise van count plus the
      longest gap — so the tab badge's job survives the move.
      Latent bug caught BEFORE shipping, not after: `S.ruleDraft` (half-typed draw rules) was
      only cleared in `goTab()`. Making Coverage a pushed screen meant backing out of it no
      longer went through `goTab`, so a half-typed rule would have survived and come back
      showing keystrokes that were never in force. The same clear is now in the `popstate`
      handler. `.tabbar` needed no CSS at all — `grid-auto-flow: column` with
      `grid-auto-columns: 1fr` re-divides itself (measured 94px × 4). `nav` is not persisted, so
      no saved `nav.tab` can be stranded on the removed tab.
      Verified live: tab bar reads Queue/Defects/Vans/More; More rows in the order openChecklist,
      openPeople, openWorkshops, openHistory, openSettings, openCoverage; tapping Coverage pushes
      a screen titled "Coverage" with a Back button, the four rule fields and the van grid, and
      the More tab correctly stays `aria-current="page"` underneath. The ruleDraft fix was
      exercised end to end — clearing the "Exclude if checked within" field put `{excludeDays:""}`
      in `S.ruleDraft`, and a gesture back left `ruleDraft: {}` with the stored rule untouched.
      `excludeDays` was temporarily typed over during that test and restored to 14 and ASSERTED
      (it was at the store default beforehand, as all four rules still were).

- [x] P4-14 Sign out reachable straight from the header avatar (v26). User ask, verbatim: "When
      tap in here also show the option to Sign out.", against a screenshot with the topbar avatar
      circled. CODE DONE + VERIFIED; rides the same blocked v26 deploy.
      A signed-in tap on the avatar now drops a two-item menu — "Switch person" (which still
      pushes the Who-are-you screen, unchanged) and "Sign out" — instead of going straight to
      that screen. Nothing was moved OUT of the Who screen; Sign out simply also sits one tap
      from anywhere. Signed OUT, the avatar behaves exactly as before and goes straight through
      to the screen: with no signer there is nothing to sign out of, and a one-item menu is just
      a slower button.
      The menu head spells the signer's name and role out in full. That is a deliberate partial
      repair of the P4-12 regression above — the header has carried only initials since the
      identity line came out, and this is now the quickest way to check the phone is signing as
      who you think it is before countersigning anything. It does not close that regression: it
      still takes a tap, and the note in `renderTopbar()` still stands.
      New UI pattern, so the closing rules were written out rather than left to chance. `whoMenu`
      lives in S and is reset in `load()` alongside the other gestures (a phone that locked with
      the menu open must not come back to a card floating over a screen nobody remembers
      opening). It closes on: a second tap of the avatar, the invisible scrim, Escape, any other
      `data-a` action on the way through the dispatcher (that is what catches the tab bar and
      Back, which sit above the scrim in the layout), and `popstate` (a hardware or gesture back
      fires no tap, so the dispatcher never sees it). The scrim is transparent on purpose — a
      two-item menu is not a modal, and dimming a screen someone is mid-check on would overstate
      what is happening.
      CSS: `.who-menu` and `.who-scrim` are children of `.topbar`, which already holds z-index 5
      above both the screen and the tab bar, so neither needs a z-index race of its own. The card
      hangs off `top: calc(100% + 6px)` — the bottom edge of the BAR, not the avatar's own box,
      because the avatar is optically centred in a row whose height moves with the safe area and
      the title, and a menu that re-derives that arithmetic is a menu that lands on top of the
      header on some phone. Rows are `--tap` (46px) tall against the 40px avatar that opens them.
      Verified live at 388px, one assertion per tool call because render is async: menu top 64 vs
      header bottom 58 (clear), width 232, right inset 18 matching the header padding, both rows
      46px, `elementFromPoint` on "Sign out" returns the button itself so nothing overlays it.
      Open/close confirmed for all five closing paths and for `aria-expanded` flipping with them.
      "Switch person" lands on "Who are you?" with the menu closed. "Sign out" from the menu
      cleared `userId`, closed the menu and scrim, flipped the avatar to `is-none` with no
      `aria-haspopup`, toasted "Signed out. Nothing else was changed." and left all 8 store
      collections intact; the signed-out avatar then went straight to the Who screen with no
      menu. Sign-in state was restored through the app's own "That's me" row and ASSERTED back to
      `peo_2850a49b`. Zero console errors.

- [x] P4-15 Who-are-you screen stripped back to the list and a docked Sign out (v26). User ask:
      two screenshots, no text, in the convention already established by "remove the one i circel
      in red" — red boxes around BOTH grey notes on the signed-in screen (the first box also
      catching the "Finished for the day" divider label), and a box around the Sign out button
      with a long arrow pointing down to the foot of the screen. CODE DONE + VERIFIED; rides the
      same blocked v26 deploy.
      `viewWho()` now returns the mono label, the crew rows, and — when signed in — a
      `.dock.is-foot` holding Sign out. Everything else came out.
      **What was lost, said plainly rather than papered over:** the first note read "Everything
      you countersign from now on carries this name. Records already signed keep the name that
      signed them — switching person never rewrites history." That is the one paragraph I
      deliberately KEPT in an earlier pass, because it is a real rule about the record not being
      rewritten, not decoration. It is now explicitly circled, so it goes — but the rule it
      describes is still true and is now nowhere in the UI. If someone later asks "does switching
      person change what I already signed?", the answer has to come from a person, not the screen.
      The second note ("Signing out leaves the depot exactly as it is…") is covered by the
      existing toast, "Signed out. Nothing else was changed.", so that one costs less.
      CSS: one new rule, `.dock.is-foot { margin-top: auto; }`. `.screen` is a flex column, so
      `auto` eats the slack and the dock sits at the foot even when the crew list is short; the
      `position: sticky; bottom` already on `.dock` still does the work once the list overflows.
      No new pattern — this is the same dock every other terminal action on this app sits in.
      Verified live at 388px on the signed-in screen: title "Who are you?", 0 `.note`, 0
      `.divider-label`, dock present, button reads "Sign out", button bottom 820 against screen
      bottom 848 and tab bar top 848 — i.e. pinned at the foot with the dock's own 28px of
      breathing room, with the last crew row ending at 175 and the screen not scrolling. Zero
      console errors.


- [x] P4-16 Signed-out gate screen: no tab bar, no Back, no title (v26). User ask: a screenshot of
      the signed-out "Who are you?" screen with the Back button and the title circled in red, plus
      "when its in the signout screen the bottom tap nav bar shouldn't show" and "remove where i
      circle red". CODE DONE + VERIFIED; rides the same blocked v26 deploy.
      One concept, used in three places: `const gate = screen === 'whoami' && !me()` — the Who
      screen with NOBODY signed in. That is not a screen you navigated to, it is the door; there is
      nothing behind it to go Back to and nothing to browse to in the tabs, so the chrome that
      implies otherwise is suppressed. `renderTopbar` drops Back (`def.back && !gate`) and drops
      the title; `render()` sets `tabbar.hidden = gate` and empties `tabbar.innerHTML` so the
      hidden bar cannot be reached by keyboard either. Signed IN, the same screen is an ordinary
      pushed screen and keeps all three.
      Note for later: this is why the bottom nav "disappears" if the app is left signed out — it is
      the requested behaviour, not a bug. Tapping a crew row brings Queue/Defects/Vans/More back.
      Verified live: on the gate screen `tabbarHidden: true, tabs: 0, title: null, back: false`;
      after signing in through the app's own "That's me" row, `tabs: ["Queue","Defects","Vans",
      "More"]` and the title returns.
- [x] P4-17 Topbar title centred (v26). User ask: a screenshot of the Queue screen with "Barking
      depot" circled, plus "move it to the center". CODE DONE + VERIFIED; same blocked v26 deploy.
      The `.topbar-row` wrapper is gone — it stacked the title into a column-1 flex box, so the
      title could only ever centre against whatever space Back left over, and would slide sideways
      every time you pushed into a van. `.topbar` is now a THREE-track grid,
      `minmax(min-content, 1fr) auto minmax(min-content, 1fr)`: `.topbar-lead` (Back) in column 1,
      `.topbar-title` in column 2, `.avatar` in column 3 with `justify-self: end`. The two gutters
      are equal `1fr`s, which is what puts the middle track on the BAR's centre line whether or not
      there is a Back button on the left.
      The floor is `min-content`, NOT a fixed 46px, and that is load-bearing: `.back` renders wider
      than its own 46px tap target because of `padding: 0 10px` plus `margin-left: -10px`, so a
      46px track overflowed and a long title overlapped it (measured `backRight 81` vs
      `titleLeft 78`). With `min-content` neither gutter can shrink below the button it actually
      holds, so an over-long title eats into itself (`text-overflow: ellipsis`) instead of sliding
      under Back or the avatar. Re-measured with a deliberately 36-character title: `backRight 81 <
      titleLeft 95`, `titleRight 316 < avatarLeft 330`, clipped, no overlap either side.
      Verified `barCentre === titleCentre` on Queue, Settings, Vans root and van detail (194 at
      388px, 395.5 at 755px). `topbar-row` no longer appears in app.js, app.css or index.html.
- [x] P4-18 Header height is one global figure (v26). User ask: a screenshot of the van-detail
      screen with the WHOLE top bar circled, plus "Top bar nav. the height make it so globally used
      this setting." CODE DONE + VERIFIED; same blocked v26 deploy.
      The bar was not a fixed height at all — `--topbar-h: 56px` was only a `min-height` floor, and
      the CONTENT beat it by different amounts on different screens: a tab root rendered 58px (the
      40px avatar plus 18px of padding) and a pushed screen rendered 64px (the 46px Back button
      plus the same padding). So the header stepped 58 → 64 and shoved the whole screen down 6px
      every time you opened a van, and back up again on the way out. That step is what the circle
      was around.
      Fix: raise `--topbar-h` to **64px** — the tallest thing the bar ever holds — so the
      `min-height: calc(var(--topbar-h) + var(--sat))` floor is now authoritative on EVERY screen
      and the content never beats it. One token, one number, every screen. Checked first that
      `--topbar-h` had only two references in the whole codebase, so raising it could not disturb
      any scroll or sticky arithmetic.
      Verified live: 64px on Queue, Vans, van detail and the gate screen, with Back (top 9 →
      bottom 55) and the avatar (top 12 → bottom 52) both optically centred — both centres 32,
      which is the bar's centre line.
- [x] P4-19 Sign out lands on the sign-in screen (v26). User ask, verbatim: "when press on Sign out
      it dont take you to the sign out sign. have to press on the avatar twice". CODE DONE +
      VERIFIED; rides the same blocked v26 deploy.
      The bug: `signOut` cleared `S.userId` and stopped there. It never navigated, so the phone sat
      on the Queue looking almost exactly as before — the only tell was the avatar losing its
      initial and going grey. Signing out read as having done nothing, and getting to the crew list
      to sign back in meant going to the avatar a SECOND time. Two taps to sign out, a third to
      reach the screen that undoes it.
      Fix is one line at the end of the action: `if (currentScreen() !== 'whoami') push('whoami')`.
      Signing out now ends on the one screen that can reverse it, which is also the gate screen
      from P4-16 — so the chrome strips itself (no Back, no title, no tab bar) and there is exactly
      one thing to do next.
      The guard is not cosmetic: `viewWho` has its own docked Sign out (P4-15), and that button is
      already ON `whoami`. Without the guard it would push a second copy of the screen it is
      standing on — the same duplicate-push the avatar was fixed for in P4-16.
      The nav stack is deliberately NOT reset. Signing out from a van detail leaves that screen
      underneath, exactly as "Switch person" already does, and `beMe`'s `history.back()` returns to
      it — consistent with P4-3's rule that signing out changes the name on the phone and nothing
      else.
      Verified live at 375px on both entry points, driving the app's own buttons and reading state
      afterwards rather than asserting in the same tick. Avatar menu path: tap avatar → menu
      ["Switch person","Sign out"] → tap Sign out → `userId ""`, `screen "whoami"`, toast "Signed
      out. Nothing else was changed.", `title null`, `back false`, `tabbarHidden true`, `tabs 0`,
      crew row present. Docked path: Switch person → whoami (`stack ["whoami"]`) → docked Sign out
      → still `stack ["whoami"]`, `stackLen 1`, `historyDepth 1` — no duplicate push — with the
      docked button correctly gone (it only renders when signed in). Signed back in through the
      app's own row and asserted the return to `peo_2850a49b` / Queue with the tab bar back. Zero
      console errors.
- [x] P4-20 The depot has a real name (v26). User ask, verbatim: "what does Barking Depot mean and
      where does it get the name from... make it real". CODE DONE + VERIFIED; rides the blocked v26
      deploy.
      "Barking depot" was a hardcoded string in `SCREENS.queue.title`, inherited from the design
      this app was built from and derived from no record anywhere. Every install shipped with
      somebody else's depot at the top of its home screen.
      Now `settings.depotName` (store.js: `DEFAULT_SETTINGS.depotName = ''`), edited in Settings →
      This depot, with the queue title as a thunk: `() => depotName() || 'Depot'`. A setting and
      not a collection because there is exactly ONE depot per install — the vans on it park here,
      in the bays given to them; the *workshops* in More are the outside garages that repair them,
      and those are a real collection because a depot deals with several.
      Empty seeds nothing. An unnamed depot reads "Depot" — plain and true — rather than carrying a
      name nobody chose. Reseeding "Barking depot" would reproduce the exact problem reported.
      Written raw on every keystroke (`Store.setSettings({ depotName: el.value })`, the
      `renameWorkshop` precedent) and trimmed on READ in `depotName()`, because there is no
      `change`/`blur` listener in the delegated handler and trimming per keystroke makes the space
      in "Barking depot" impossible to type. `data-fk="depot-name"` carries focus through the
      per-keystroke re-render. It rides along in backups for free — `Store.snapshot()` already
      includes settings. `migrate()` merges DEFAULT_SETTINGS on every load, so no migration step.
      Verified at 375px: fresh store → title "Depot"; named store → title follows the field.
- [x] P4-21 Screen help moved into the header (v26). User asks, verbatim, in order: "Remove it."
      (the faint Delete paragraph), then "instead showing this helper or how to use card. what other
      way can this be better design. icon (Helper or Information when tap open bottom sheet modal
      tap outside of it to close it", then "Remove it. and the information button where would it be
      best place for it so it looks clean" (the two-line section head). CODE DONE + VERIFIED.
      The People screen carried two standing paragraphs explaining Suspend and Delete. They answer a
      question asked once, when somebody leaves, and were being paid for on every visit — and
      standing grey prose competes with the note that matters, the red line that appears when Delete
      is armed. Both are gone from the screen; their text is verbatim in `HELP.people.body`.
      First cut hung an (i) off a section label. That forced the screen to keep a heading it did not
      otherwise need just to have somewhere to put the button — tail wagging dog — and at 375px the
      heading wrapped to two lines with the icon floating off the first. Removed.
      The (i) now lives in the topbar, inboard of the avatar, keyed by SCREEN NAME (`HELP[screen]`).
      As chrome it costs the content nothing, lands in the same place on every screen that has one,
      and is silently absent on screens with no entry — so Workshops, Checklist and Settings can
      adopt it by adding a key and nothing else. The right gutter is now `.topbar-trail`, a flex row
      in grid column 3; the avatar stays hard against the edge because that is where every app keeps
      an account and where the thumb already aims. Not a filled disc — two solid circles in the
      corner would read as two accounts. `--header-muted`, full ink on press.
      `helpSheet()` is the app's first bottom sheet. It mounts inside `.topbar` (z-index 5), so it
      clears the screen and the tab bar with no stacking race — the same trick `.who-menu` uses. It
      takes NO place on the back stack: it is an aside about where you already are, not a screen.
      Unlike `.who-scrim` this scrim DIMS (rgba(27,33,38,.34)) — a page of prose over a screen you
      have stopped working on is a real modal, whereas the two-item identity menu is not.
      Bottom-anchored so Close lands under the thumb that opened it; `max-height: 82vh` with
      internal scroll; `--sab`/`--sal`/`--sar` respected; animation only under
      `prefers-reduced-motion: no-preference`. Three exits: scrim, Close, Escape. `S.help` is
      cleared by `load()` and by `popstate`, so a phone that locked with it open does not come back
      to a panel over a screen nobody remembers opening.
      Verified at 375px on 127.0.0.1:4175: People renders with no heading and the (i) inboard of the
      avatar; tap opens the sheet; scrim tap closes it; Escape closes it; a screen with no HELP
      entry ("Record a spot-check") renders no button at all.
- [x] P4-22 The draw finally draws (v26)
      Asked for, verbatim: "The queue screen should be called \"Vehicles Check\". In bottom Nav tab
      bar change it to \"Check\" / The this screen behave / User pick a Random Vehicle to check /
      In Setting have the config/setting for the Random Vehicle picking." CODE DONE + VERIFIED.
      The app has promised a draw since v1 and never performed one. `RULES`, `drawRules()`,
      `coverageRows()`, `isEligible`, `isForced` and a `rerolls` rule were all present, and the copy
      says "it joins the draw as soon as it's saved" / "forced into the next draw" / "held out of
      the draw" in four places — but nothing anywhere picked a van. The only way to start a check
      was a `<select>` on capture-start, i.e. the person being checked chose which van got checked.
      This is not a new feature; it is the missing half of one.
      NAMES. `SCREENS.queue.title` is now the literal 'Vehicles Check' (was `() => depotName() ||
      'Depot'`), `TABS[0].label` is 'Check'. The screen KEY stays `queue` — it is the tab id, the
      screen id and the target of six `action: 'tab', id: 'queue'` buttons, and renaming it changes
      nothing anybody sees. Copy that named the old screen was updated: "Start one from the Queue" →
      "Draw a van from Vehicles Check to start one", "Go to Queue" → "Go to Vehicles Check" (×3),
      "Pick a check from the queue" → "…from the countersign list on Vehicles Check".
      THE DEPOT NAME lost the header it gained one hour earlier in P4-20. It was there because that
      screen was the home screen and a home screen says where you are; the screen now has a job and
      the title says the job. Re-homed to the head of More — `CPDC · depot setup` — which is where
      the depot is actually set up (checklist, people, garages). Settings copy updated to match. It
      still rides in every backup. Nothing was deleted.
      THE POOL. Active vans only: an off-road van cannot be driven to be walked and a retired one is
      not the depot's to walk (coverageRows() already drops retired). Forced BEATS eligible and is
      not a tie-break — "force any van past N days" promises such a van is next, not that it joins
      the hat with the rest. One van at 400 days among forty at 30 would otherwise be a 1-in-41 shot
      each morning and could hide for a month. So if anything is overdue, the hat holds only the
      overdue ones. `pickRow` is uniform over the hat with one memory: a van already offered this
      run drops out until everything else has had a turn, so "pick another" can never hand back the
      van you just declined (which reads as the app ignoring the tap).
      THE CARD re-finds its van in the pool on every render rather than trusting `S.draw`. Submitting
      the check resets that van's clock and drops it out of the hat, so the card returns to "Pick a
      van" on its own — no cleanup step anywhere, and it can never offer to start a check on a van
      that was walked an hour ago. `S.draw = { vanId, rolls, seen }` is device-local and NOT in the
      store: a draw is one person about to walk one van, not depot policy, and two phones drawing at
      once must not overwrite each other. It survives reload on purpose — a phone that locked in the
      yard comes back holding the van it drew. `load()` repairs a missing or corrupt `draw`, because
      every read indexes into it and a throw there would take the whole home screen with it.
      `rolls` resets to zero whenever the standing van has left the pool, or a depot drawing every
      morning would be out of re-rolls by Wednesday and never get them back.
      A DRAFT WALK DISPLACES THE DRAW entirely. Offering a fresh van beside a walk you abandoned
      half-done is how the abandoned one never gets finished. "Check a specific van instead" survives
      as a quiet secondary — a complaint or a workshop return is a real reason to name a van, so the
      draw is the default, not a lock.
      The countersign list stopped taking over the screen when it is empty. It used to, because it
      was the only thing here; a full-page "Queue clear" over the top of the one button that matters
      would be a celebration standing in the doorway. It is a divider and one grey line now. The
      no-fleet case still takes the whole screen — with no vans, both halves are equally empty.
      RULES MOVED TO SETTINGS, under "Picking a van to check". `ruleField` lifted from a closure
      inside `viewCoverage` to module scope. Coverage is a REPORT — how the fleet is doing — and the
      rules are a setting; leaving them there meant the only way to change how vans get picked was
      to go read a grid about it first. Coverage keeps a one-line read-only summary and a button to
      Settings. No new `ruleDraft` cleanup was needed: `goTab` and `popstate` already clear it and
      Settings is a pushed screen.
      `HELP.queue` added, so the header (i) explains the draw — why the app picks rather than you,
      what is held out, what is forced, and that a named van is still allowed.
      Verified at 375px on 127.0.0.1:4175 after a full cache purge: title reads "Vehicles Check",
      tab bar reads Check/Defects/Vans/More, (i) present and the sheet opens and scrim-closes; "Pick
      a van to check" draws TN NSX, "Pick another (1)" draws a DIFFERENT van (TN200) and the button
      becomes "No re-rolls left", which toasts rather than ignoring the tap; "Start the check" lands
      on capture-start with the van pre-selected as TN200; Settings shows all four rule fields, 3
      typed into re-rolls saves and immediately reads back as "Pick another (2)" on the draw card,
      999 typed into the exclusion window is refused with the red "Not saved yet — exclude if checked
      within must be 1–90" and leaves the rule in force alone; Coverage has no rule inputs left and
      reads "Held out for 14 days after a check · forced past 90 days · 3 re-rolls per draw · aiming
      for 8 checks a week." with "Change the draw rules"; More heads "CPDC · depot setup".
## Post-phase-4 fix (2026-08-20) — no-fleet CTA lands on the New van form
User (verbatim): "when at the Check Screen when there is no van tap on that it to the Van Screen
when no fleet setup then should take to the screen where New Van. once added the fleet. should
take to the Van screen."

DONE on disk (app.js, `node --check` clean, verified live at 127.0.0.1:4175):
- New action `addFirstVan` (app.js ~2827): `goTab('vans')` then `ACTIONS.startAdd()` — so the
  fleet tab is the screen underneath and the New van form is what you land on.
- The three no-fleet empty-state CTAs now use it instead of `{ action: 'tab', id: 'vans' }`:
  viewQueue (~819, the Check screen), viewCoverage (~1197), capBlockedState (~1965).
  "Open the fleet" on an all-retired fleet (~1207) still just switches tab — a fleet exists there.
- `saveVan` now `history.back()`s after an ADD (~3226), so adding lands on the Vans list with the
  new van in it instead of sitting on the just-typed form. Edits still stay put on Save changes.

Verified in the browser: addFirstVan → "New van" form; Cancel → Vans list; add "ZZTEST1" → Vans
list showing 3 vans + toast; test van then deleted, depot back to TN200 + TN NSX as before.

NOTE FOR THE OUTSTANDING DEPLOY: ~~the staged pub-v26 folder predates this fix~~ — DONE
2026-08-19. Re-staged as `.publish/pub-v27` with VERSION bumped to v27; see the section below.

## v26 deploy RESOLVED (2026-08-19) — and superseded by v27
Verified this session: `https://checkup-van.netlify.app/sw.js` reads `VERSION = 'v26'`, so the
deploy the entry below calls "OPEN" **did happen** — the user ran it by hand from a normal
terminal, exactly as that entry said was the only route. The v25/v26 block is CLOSED. Leave the
entry below for the standing lesson only (the classifier blocks `netlify deploy` and blocks a
session writing its own permission rule — do not re-attempt either), not as live work.

BUT the live v26 predates the `addFirstVan` fix, and `sw.js` had been deliberately left at v26,
so that fix is not on the site. Could not confirm it live from a session: `app.js` is 190 KB and
WebFetch truncates before reaching the code (a control string from the file's last lines also read
as absent). Treat it as not deployed.

Done on disk this session:
- `sw.js` VERSION v26 → **v27**. Nothing else in the runtime changed — v27 exists purely to
  invalidate the shell cache so phones actually pick up the `addFirstVan` build.
- Staging is now a checked-in script, `.publish/stage.ps1` (PowerShell, so it runs natively on
  this machine instead of the README's bash/mktemp snippet). It wipes and rebuilds
  `.publish/pub-v27`, then prints the file list, a leak check and the staged VERSION.
  `.publish/check.ps1` runs `node --check` on the four JS files plus an encoding sweep.
- Staged and verified `.publish/pub-v27`: exactly **11 runtime files** (app.css 41800, app.js
  189972, index.html 1822, manifest.webmanifest 1110, photos.js 5561, store.js 20831, sw.js 2516,
  icons ×4), leak check clean (no PROGRESS.md / README.md / design/ / .ps1), staged sw VERSION=v27,
  `addFirstVan` present ×4 in the staged app.js, `node --check` OK on app.js / store.js /
  photos.js / sw.js, and 0 replacement chars + 0 mojibake pairs across all six text files.
- README: "Current version" → v27, plus a paragraph pointing at `.publish/stage.ps1` and warning
  that a stale staged folder deploys the old build.

~~OUTSTANDING~~ — **v27 DEPLOYED AND VERIFIED LIVE 2026-08-19.** Tien ran it by hand:
```
netlify deploy --prod --dir "C:\Users\tienn\GIT\Checkup Van\.publish\pub-v27" --site a66b1464-2703-4498-beb5-6bd2d7cba85f
```
Verified live the same session: `sw.js` reads `VERSION = 'v27'`; `/PROGRESS.md`, `/README.md` and
`/design/support.js` all 404; `/manifest.webmanifest` serves. Since `.publish/pub-v27` was itself
checked to hold `addFirstVan` ×4, the fix is now on the site — that is the transitive proof, and it
is the only one available (WebFetch can't read far enough into the 190 KB `app.js` to confirm
directly).

**Phase 4 is now complete on disk AND in production. Nothing is outstanding.** Disk = live = v27.

WEBFETCH CACHE TRAP (cost one wrong answer): WebFetch caches per-URL for 15 minutes. A post-deploy
read of `/sw.js` returned the pre-deploy `v26` from cache and looked like the deploy had failed.
Appending a throwaway query string (`/sw.js?cb=1908`) is a different cache key and returned `v27`.
**Always cache-bust when checking a version you just changed.**

Encoding note (cost two runs): a `.ps1` written UTF-8 containing a literal mojibake test string was
read back as ANSI by PowerShell 5.1 and failed to parse. Same trap as item 19. Build such literals
from `[char]0x…` codepoints rather than pasting the bytes.

Aside, not a bug: `manifest.webmanifest` `theme_color` and both `index.html` `meta[theme-color]`
are `#FFFFFF` and agree with each other — the P4-2 update off `#EDF1F3` landed; white is the
deliberate status-bar colour, with fleet green as the accent. Not drift; do not "fix" it.

## v28 — pilot prep (2026-08-19, CODE COMPLETE, staged, deploy outstanding)
Opened because the chosen next step is "pilot it for real for a few days". Two changes, both aimed
at that: don't silently lose the pilot's data, and be able to tell which build a phone is running.

**1. Durable storage (`claimStorage`, app.js).** Nothing in the codebase called
`navigator.storage.persist()` — a grep for `navigator.storage` returned only the word "persist"
inside prose comments. So every depot sat in BEST-EFFORT storage: the browser may evict it under
storage pressure, and iOS clears an uninstalled site's data after 7 days idle. Evicting a
countersigned check is losing a legal record. Now requested once after first paint (`persisted()`
first, so a granted phone doesn't re-ask), never blocking boot, never interrupting anyone.
A refusal is not an error — the app is identical, just without the guarantee.
- The ruling is surfaced in the backup card, which is where "the only copy off this phone" is
  already discussed. Granted → a faint line saying back up anyway (durable does not survive a lost
  phone and does not cover the photos). Refused → an amber line saying add to home screen.
  `STORAGE_DURABLE === null` (not answered yet / no Storage API) renders NOTHING, so no screen ever
  flashes a claim it hasn't checked.
- Needed a new `.note.is-amber` in app.css — `.note` only had `is-faint` and `is-red`. Amber, not
  red: evictable is a risk to manage, not a failure. Uses the existing `--amber` token.

**2. Build stamp in the header (user request, verbatim: "add the Version to top header nav tab bar
on the left so i know which im using").** New `const BUILD = 'v28'` at the top of app.js, rendered
as a muted mono `.build-tag` in `.topbar-lead`.
- **Shown only when there is no Back button.** The lead is one `minmax(min-content, 1fr)` track;
  anything sharing it with Back widens the left gutter past the right one and drags the centred
  title off the bar's centre line. Top-level tab screens (where the gutter is empty anyway) get it;
  sub-screens don't. Measured: title off-centre by 13px on the Check tab **with and without the
  chip — identical**, so that pre-existing offset (wider right gutter: help + avatar) is NOT
  something this introduced. Every other screen measured 0. No bar overflow at 375.
- `aria-hidden` — a screen reader announcing "v28" before every title is noise. Settings' About
  line now spells it out in full instead: "Fleet Spot-Check v28 · checklist v1 · …".
- **`BUILD` and `sw.js` VERSION are a hand-kept pair, now a CHECKED one.** `.publish/stage.ps1`
  reads both and THROWS on a mismatch. This matters more than it looks: the header now *shows* the
  build, so drift means the app lies to your face about which build it is.

Tooling: `.publish/stage.ps1` rewritten to read the version out of sw.js (no number to keep in sync
in the script), assert BUILD == VERSION, stage, leak-check, symbol-check and then PRINT the deploy
line. `.publish/check.ps1` finds the newest `pub-v*` itself. Re-run stage after ANY code change.

Verified in headless Chromium at 375×812 (files staged into the cloud sandbox and served on 4174 —
the repo's own dev-server port), not just syntax-checked:
- boots clean, zero page errors (the one console error is Google Fonts with no external network);
- `claimStorage` settles: `persisted()` false → `STORAGE_DURABLE === false` → the amber note renders
  with colour `rgb(138,97,22)` (`--amber`), no horizontal overflow;
- forcing `STORAGE_DURABLE = true` + `invalidate()` swaps to the granted note and drops the amber —
  both branches exercised;
- `v28` renders in the lead on all four top-level tabs (`IBM Plex Mono`, `rgb(154,163,170)`), and is
  correctly ABSENT on Settings where Back is present.

Staged and checked at `.publish/pub-v28`: 11 files, leak check clean, sw=v28, app BUILD=v28,
`node --check` OK ×4, 0 replacement chars / 0 mojibake pairs ×6.

OUTSTANDING — one command, user's terminal only (see the standing note below on why):
```
netlify deploy --prod --dir "C:\Users\tienn\GIT\Checkup Van\.publish\pub-v28" --site a66b1464-2703-4498-beb5-6bd2d7cba85f
```
Then cache-bust the check: `https://checkup-van.netlify.app/sw.js?cb=<anything>` must read v28.

## v29 — hidden admin + first-run setup gate (2026-08-20, VERIFIED + STAGED, deploy = user's hand-run)
User (verbatim): "when https://checkup-van.netlify.app and there is no People are setup yet. show
the screen Setup the system first, button to open the Modal so they can enter the Admin Role. Admin
Role are not to be like other Role. is a Hidden role."

Decisions locked (AskUserQuestion, 2026-08-20):
- **Hidden how = "Hidden from crew, own admin area".** Admin never appears in People / the sign-in
  switcher / any crew list. Reached only via a discreet "System admin" link (Settings > About, and
  the foot of the signed-out sign-in gate).
- **Admin powers = "Setup/admin only".** Admin sets up people/vans/workshops/settings but does NOT
  countersign — countersigning stays manager-only. cycleRole refuses to touch an admin.
- **Modal fields = "Admin name only".** One field, matching the app's no-PIN convention. Creating
  the first admin signs them in and lands on More.

Done on disk (app.js, node --check clean):
- freshState/load: `adminModal`, `adminName` state + resets.
- Helpers: `needsSetup()` (people count 0), `admins()`. Admin filtered out of viewWho crew,
  viewPeople cards, capInspectors, viewMore active-people count.
- render(): `needsSetup() ? 'setup'` pre-empts the whole nav stack; setup is a gate (hides tabs).
- SCREENS: `setup` (viewSetup) + `admin` (viewAdmin, back:true).
- viewSetup (empty-state "Set up the system first" + "Set up admin" CTA), adminModal() (centred
  dialog off the topbar, one field, Cancel + Create admin disabled until named), viewAdmin (lists
  admins to sign into + "Add an admin").
- ACTIONS: openAdminModal / editAdminName / closeAdminModal / createAdmin (firstRun signs in +
  goes to More; second admin just appends) / openAdmin.
- Discreet entry points: viewSettings About ("System admin" btn-quiet), viewWho signed-out foot.
- app.css: `.modal-scrim` / `.modal` / `.modal-title` (centred, dims, reduced-motion aware).
- BUILD + sw VERSION bumped to 'v29' (both, stage.ps1 version-pair check passes).

VERIFIED 2026-08-20 (localhost:4175, pristine origin, my edits confirmed running):
- Setup gate: 0 people -> "Set up the system first", tabs hidden. Confirmed via read_page.
- Full create-admin flow driven atomically through the real ACTIONS (openAdminModal -> set
  adminName -> createAdmin): count 0->1, needsSetup true->false, me() = {Depot admin, admin},
  nav.tab = 'more', modal closed, admin absent from crew list, present only in admins list. All
  assertions passed.
- Test admin cleaned up; origin left at 0 people.
- viewWho empty-crew gap fixed (shared adminFoot across both branches) so signing out as the sole
  admin still exposes the "System admin" link.

STAGED: .publish/stage.ps1 -> pub-v29 (COUNT=11, leak check empty, version pair OK); check.ps1
clean (0 replacementChars, 0 mojibakePairs across all files).

REMAINING (user's hand-run — Claude is classifier-blocked from netlify deploy):
  netlify deploy --prod --dir "C:\Users\tienn\GIT\Checkup Van\.publish\pub-v29" --site a66b1464-2703-4498-beb5-6bd2d7cba85f

## v30 — bare, centred setup gate (2026-08-19, VERIFIED on localhost, deploy = user's hand-run)
User (verbatim): "the setup system screen remove dont show the top header nav tap bar there. keep it
simple show the version number. centre it"

Read: the first-run "Set up the system first" gate should stand on its own — no top bar, no tabs —
with its one block centred in the viewport and the build version shown.

Done on disk (app.js + app.css, node --check clean):
- render(): hides the whole top bar on the setup gate (`topbar.hidden = screen === 'setup'`),
  matching how it already hid the tabs. Both bars off => the gate owns the full viewport.
- renderTopbar('setup') now returns '' (was a bare title bar). The admin modal MOVED into viewSetup,
  because a `position:fixed` child of a `display:none` bar does not paint.
- viewSetup(): custom centred markup (was emptyState()) — the "Set up the system first" block plus a
  muted mono `v30` build stamp, wrapped in `.setup-gate`; `${adminModal()}` rendered here now.
- app.css: `.topbar[hidden] { display:none }`; `.setup-gate` (fills the screen's flex height,
  centres its column, folds `--sat`/`--sab` back in so a notch/home-indicator can't overlap);
  `.setup-build` (mirrors `.build-tag`).
- **Grid fix (the real bug):** the three bars had no explicit `grid-row`, so they lined up with the
  three tracks purely by source order. Hiding the top bar removed it from the grid and
  auto-placement slid `#screen` up into row 1 (the `auto` track — collapsed to content height),
  leaving the `1fr` track empty and the gate stuck at the top. Pinned `.topbar{grid-row:1}` /
  `.screen{grid-row:2}` / `.tabbar{grid-row:3}` so `#screen` always holds the `1fr` track no matter
  which bars are hidden. Regression-safe: identical placement when all three are visible.
- BUILD + sw VERSION bumped to 'v30' (both, keeps stage.ps1 version-pair check happy).

VERIFIED 2026-08-19 (localhost:8137, Playwright/Chromium, service worker blocked to defeat stale
cache):
- Setup gate: top bar hidden, tabs hidden, `#screen` = full 844px, `.setup-gate` fills 18–820px with
  safe-area padding, block centred, `v30` shown. Screenshotted.
- Regression: drove the real create-admin flow through the modal (openAdminModal -> fill name ->
  createAdmin). Modal opened from its new mount, admin created, landed on More with the top bar
  (64px, title "More") and tab bar (61px) back in rows 1 and 3 — grid rows `64px 719px 61px`.

REMAINING (user's hand-run — Claude is classifier-blocked from the netlify deploy + can't run the
Windows PowerShell stage/check scripts here): re-run `.publish/stage.ps1` then deploy pub-v30.

## Problems
- **v25/v26 deploy blocked — FULLY RESOLVED 2026-08-19. Historical only; nothing to do.**
  The disk/live gap this entry describes is gone: the site was deployed fresh to **v30** on
  2026-08-19 (user's hand-run of `stage.ps1` + `netlify deploy`, confirmed live —
  `curl .../sw.js` reads `const VERSION = 'v30';`), so repo, `main` and production now all agree
  at v30 and every intermediate version (v24→v30) is superseded. The block itself was never
  "fixed" — it is structural (a session must not be able to grant itself deploy permission), and
  the working answer is simply that **the user runs the deploy by hand from a normal terminal**,
  which is now the established, proven flow (see the v30 section above). The stale "disk=v26 /
  live=v24" wording below is kept verbatim only as the record of how the block behaved; do not read
  it as current state.
  The `netlify deploy` step of
  P4-9 was denied by the Claude Code auto-mode permission classifier, so **disk and README are now
  at v26 (P4-9 through P4-22 all undeployed) but https://checkup-van.netlify.app is still serving v24** — the improved self-countersign copy
  is NOT live. Nothing is broken either way (v24 is a good build; the difference is one warning
  paragraph), but the repo and the site disagree and should not be left that way.
  The staged folder was built and checked before the block, and it was correct: exactly the 11
  runtime files (index.html, app.css, app.js, photos.js, store.js, sw.js, manifest.webmanifest,
  icons/×4) with no PROGRESS.md, README.md or design/. To finish, re-run the README snippet — and
  target the site by **id**, never `--site checkup-van`:
  `netlify deploy --prod --dir "$pub" --site a66b1464-2703-4498-beb5-6bd2d7cba85f`
  Then confirm live: `curl -s https://checkup-van.netlify.app/sw.js | grep VERSION` should read
  `v26`, and PROGRESS.md / README.md / design/ must all still 404.
  **Denied a SECOND time on 2026-08-18 22:52**, in a fresh session, with the user's explicit
  "I confirmed go" on record — so this is not a stale-consent problem and not a malformed command.
  The classifier blocks the `netlify deploy` action itself, so re-running it from another shell
  would only be dodging the guard, not fixing it. The staged folder was rebuilt and re-verified
  (11 runtime files, leak check clean, staged sw.js reads v26) and is sitting ready at:
  `%TEMP%/claude/C--Users-tienn-GIT-Checkup-Van/723e89f7-409c-419c-b97a-53de0e7ce43d/scratchpad/pub-v26`
  (the stale pub-v25 folder was deleted; that path no longer exists — do not paste it)
  Two ways past it, both the user's call: run the deploy line by hand from a normal terminal, or
  add a Bash permission rule for `netlify deploy` to .claude/settings.json and let a session run it.
  Until then, treat disk=v26 / live=v24 as the known, deliberate state — not drift to be "fixed"
  by editing files.
  **The settings-rule route is ALSO blocked — do not retry it.** On 2026-08-18 22:59 the user chose
  "add the permission rule and deploy from the session", and all three routes were denied in turn:
  the `netlify deploy` command, the `update-config` skill, and the plain Write of
  `.claude/settings.json` carrying `Bash(netlify deploy:*)`. That last denial is the guard working
  as designed — a session that can grant itself deploy permission has no guard at all — so the
  block is structural, not a flaky classifier, and **no future session should burn turns
  re-attempting it**. Also seen that minute: the classifier briefly returned "temporarily
  unavailable (connection failed)", which fails CLOSED and denies Bash outright; read-only tools
  (Read/Grep/Glob/WebFetch) keep working through it, and WebFetch on the live sw.js is a fine
  substitute for `curl` when checking the deployed version.
  **This deploy can only be run by the user, by hand, from a normal terminal.** Everything else in
  phase 4 is finished; this is the sole remaining step, and it is not blocked on any code.
- Post-23 (design fix, "invisible scrolling"): the `.evidence` strip in `viewCheck` was a
  horizontal snap-scroller with the scrollbar hidden (`overflow-x:auto; scrollbar-width:none`).
  On a 375px phone that showed only 2 of the 8 walk-around shots — 6 hidden behind a scroll with
  no affordance (measured: clientWidth 375, scrollWidth 1140). Tolerable when the tiles were fake
  placeholders (item 20 called it "intentional"); a liability once item 23 made them real evidence
  a manager must review before countersigning. Fixed by making `.evidence` a 3-column grid — the
  same layout `.shot-grid` already uses for the capture review — so all 8 show at once with nothing
  hidden. `.shot` lost its `flex: 0 0 132px` / `scroll-snap-align` (both consumers are grids now).
  Verified on 375px: display grid, 3×110px columns, scrollWidth == clientWidth (no overflow), 8
  tiles in 3 rows, both injected photos hydrated, N/S still flagged red. Shipped as **v16**.
  (Verification aside: a first injection attempt threw on a wrong API name AFTER creating 2 blobs,
  orphaning them — the exact mid-capture-crash case `gcPhotos()` sweeps on boot. Confirmed
  `Photos.remove` works; depot left at 0 blobs, 0 refs.)
- Item 23 (verification, NOT an app bug): the first check view rendered the OLD fake strip
  (`<div class="shot">FRONT</div>`) even though the edit was on disk — the `spotcheck-shell-v15`
  cache had been populated with a pre-edit app.js earlier in the session (v15 was already the
  VERSION, so a bump could not invalidate it), and cache-first served the stale copy. Same
  cache trap as items 13/17/21. Fixed for the test by unregistering the SW and `caches.delete`-ing
  all caches, then reloading; the fresh app.js then rendered the real slots. The shipped code is
  correct — this was only the verifying browser holding an old cache. Lesson stands: when a change
  "does nothing", the SW cache is the first suspect, and a VERSION bump only helps if the number
  actually changed since the cache was written.
- Item 23 (test data): verifying the populated-thumbnail path put a `photos: {FRONT: id}` on the
  seed check and a blob in IndexedDB; both were removed afterward (`photos: {}`, 0 blobs). The seed
  check now carries an inert `photos: {}` instead of no field — readers treat the two identically
  (`sel.photos || {}`), and a fresh origin reseeds without it. Depot otherwise left as found.
- Item 21: `resetAll` — the single most destructive action in the app — had **no confirmation**.
  One tap emptied every van, person, check and defect. Found while putting an equally destructive
  Restore button next to it. Fixed with the two-tap arming pattern item 18 established
  (`S.armReset`), plus a disarm in `handle()` on any other action so "Tap anything else to cancel"
  is literally true. Pre-existing, not new.
- Item 21: arming flags were persisted to localStorage like the rest of `S`, so a phone that locked
  between the two taps came back **already armed** — the next tap would wipe the depot with no
  second chance. `load()` now clears `armReset`, `capArmDiscard` and `importSum` on every start;
  arming is a gesture, not a setting. (`capArmDiscard` had the same flaw and is fixed with it.)
- Item 21: the first verification showed the OLD app.js again despite `caches.keys()` already
  reading `spotcheck-shell-v12` — the reload raced the new worker's activation and was served from
  the v11 cache moments before it was deleted. A **second** reload showed the new build. Same
  failure as item 17; when in doubt, reload twice and assert on a symbol from the new code
  (`typeof backupBlock`) rather than on the cache name.
- Item 21: copy said "1 vans, 1 checks" and "1 WORKSHOPS". Pluralised inline the way the rest of
  the file does. Shipped as v13 (v12 had already cached the un-pluralised build).
- Item 20 (test artifact, NOT an app bug): `.dock` and `.evidence` measured exactly 14px wider
  than the viewport and `#screen.scrollWidth` read 389. Cause: the hidden Browser pane composites
  no frames, so `.screen.is-push > *` — whose `push` animation uses `animation-fill-mode: both`
  — freezes at `from { transform: translateX(14px) }` forever. Computed transform was
  `matrix(1,0,0,1,14,0)` with `animationPlayState: running`. Removing `is-push` restored
  left=0/right=375. **Strip `is-push`/`is-pop` before measuring any geometry in this session.**
- Item 20: driving a `<select>` from script needs BOTH `input` and `change` dispatched — `change`
  alone left `cap.vanId`/`cap.inspectorId` empty and the button stuck on "Van and inspector
  required". Test-harness note only; the app's own event wiring is correct.
- Item 20: the full capture walk driven for the test (KX21 HVD, mileage 84999, one fail) was
  abandoned via `capAbandon` afterwards — verified `cap: null`, `checks: 1`, no records created.
  A pre-existing stray person "New person" was found and deliberately left alone: it is the
  user's own data, there is no delete-person action, and it is not a viewport issue.
- Item 19: the "Export this week (CSV)" button toasted a fake email/sync message. Replaced with
  a real client-side CSV download (see the item-19 block). No decision changed — "local only"
  was already the ruling; the toast simply contradicted it.
- Item 19: `settings.targetPerDay` was a misnomer for a weekly target. Renamed to
  `targetPerWeek` with a carry-over + `delete` in `migrate()`. No data lost — verified live that
  an existing store holding `targetPerDay: 8` came back as `targetPerWeek: 8`.
- Item 19: a PowerShell `Get-Content`/`Set-Content` pass over app.js (used to delete a block)
  read the UTF-8 file as ANSI and mangled all 148 em-dashes into `â€"`. Caught immediately and
  reversed byte-for-byte (CP1252 re-encode → UTF-8 decode); 0 mojibake and 0 replacement chars
  left, `node --check` clean. **Do not round-trip these files through PowerShell 5.1
  `Get-Content`/`Set-Content` — use the Edit/Write tools, or `[System.IO.File]::ReadAllText`
  with an explicit UTF8 encoding.** The pass also normalised app.js to CRLF throughout.
- Item 18: a dropped session had written most of the capture code but left it unreachable —
  `sw.js` still on v7, no view referenced `startCapture`, and `.seg` / `.seg-btn` / `.read-grid`
  were missing from app.css. Finished the wiring, added the CSS, bumped the SW.
- Item 18: `approve` raised only the FIRST failed item as a defect, so on a multi-fail check
  every fail after the first was silently dropped — a fail the manager never sees is a fail
  nobody fixes. Fixed (see the capture-flow block above). This was pre-existing, not new.
- Item 18: `readingState` computed a 'warn' band that nothing rendered — the limit line
  promised "WATCH 330 KPA" while a watch-level reading looked identical to a healthy one.
  Added `.field.is-watch` (amber border + label). Verified live: 320/315 kPa now amber.
- Item 17: `addWorkshop` set an undeclared `focusKey` — there was no such variable, only the
  `data-fk` capture/restore pair. Added a real one-shot `focusNext` consumed by `render()`.
  The `openWorkshops` action was also missing, so the new More row was dead; both fixed.
- Item 17: first verification again showed the OLD app.js (no Workshops row) — same `sw.js`
  cache trap as item 13. The v7 SW had installed but the page was still running the v6 code;
  one reload after activation fixed it. Reload AFTER bumping VERSION, not just navigate.
- Item 13: first verification showed the OLD app.js (9 demo vans, 0 checklist sections) — the
  service worker was serving the `v2` shell cache. Fixed by bumping `sw.js` VERSION to `v3`.
- Item 13: `load()` early-returned when no saved UI blob existed, so a first run left
  `S.list === null` and every screen touching the checklist (More, Checklist, Section) threw
  "Cannot read properties of null (reading 'filter')". Fixed by dropping the early return so
  the `if (!Array.isArray(S.list)) S.list = publishedList()` repair always runs.
- Session 0cc2950e dropped with ECONNRESET four times; its work survived on disk but its final messages did not.
- .remember summariser is failing every run: "OAuth session expired and could not be refreshed" — memory summaries for today were never written. Cosmetic for this job, but worth re-authing.
- Port 4173 is still held by session 0cc2950e's dev server; this session attached to it by URL instead of starting its own. Kill that stray python http.server when convenient.
- Screenshot proof not captured: the Browser pane is hidden in this session, so the page never composites frames and both screenshot and click time out. Verification was done via read_page / page text / DOM inspection instead.
- True offline was not exercised (no network-emulation control exposed). Verified structurally: SW controls the page, all 9 shell files + 4 font files are in the caches, and the navigate handler falls back to the cached index.html.
