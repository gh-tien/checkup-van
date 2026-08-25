# Task: Design critique of the full Vehicle Spot-Check build (/design:design-critique "full build")
Status: 8 of 14 surfaces reviewed | batch size: 1 surface per turn (heavy: screenshot + source + computed styles)
Session log: resumed after compaction mid check-flow; checkpoint created retroactively at surface 08

Output: final critique posted in chat, in the design-critique skill's markdown template.
Findings accumulate in this file so a dropped turn loses nothing.

## Decisions and conventions
- Review is measured against `CLAUDE.md` (craft rules), `DESIGN.md` (token + closed type scale), `DECISIONS.md` (prior rationale).
- Live build attached at http://localhost:8081 (someone else's dev server; do NOT restart it), 375x812 mobile preset.
- RN-web quirks: `Pressable` ignores bare synthetic clicks -> use injected `window.__tap(text, idx)`.
  `ScrollView` ignores synthetic wheel -> set `scrollTop` directly. Re-inject `__tap` if the page reloads.
- Contrast measured from live computed styles, not guessed. AA = 4.5:1 body, 3:1 large (>=24px or >=18.66px bold).
- Sign-in: PIN 1234. Phuog Lam = Inspector. Tien Nguyen = Admin/Manager.
- This is a REVIEW job. No project file is to be edited except this checkpoint.

## Items (surfaces)
- [x] 01 Gate / PIN sign-in
- [x] 02 Inspector Dashboard
- [x] 03 Spot-check: driver/keyholder step
- [x] 04 Spot-check: photos step (skippable, 0/6)
- [x] 05 Spot-check: checklist + FailSheet
- [x] 06 Spot-check: review & sign
- [x] 07 Spot-check: done step
- [x] 08 Fleet list + vehicle record (VanScreen)
- [ ] 09 Manager/Admin dashboard (sign in as Tien Nguyen)   <- NEXT
- [ ] 10 Approvals (countersign, send-back sheet, approved records)
- [ ] 11 Defects screen
- [ ] 12 More + Settings + Depot configuration + ResetModal
- [ ] 13 People + Profile + Help
- [ ] 14 Draw overlay
- [ ] 15 Write the final critique

## Findings so far
### Accessibility (measured)
- White on `#9FB2C4` (Submit for approval, disabled-look, 16px semi) = **2.18:1 FAIL**
- `#9AA3AA` on `#F7F8F9` ("Record the odometer to sign", 14px) = **2.41:1 FAIL**
- `#9AA3AA` on white (inactive BottomNav labels, C.muted3) = **2.56:1 FAIL**
- `#79838B` on white (stat labels, 11px, C.muted) = **3.87:1 FAIL** (needs 4.5)
- `#58626A` on `#FDF6F5` 13px = 5.84:1 pass; `#8A6116` on `#FBF3E2` = 5.00:1 pass; `#A03428` on `#FDF6F5` 19px bold = 6.53:1 pass
- BottomNav has ZERO accessibilityLabels (5 tabs, icon+label but no role/label props)
- Pass/Fail buttons `minHeight: 38` — under the 44pt minimum (CheckScreen `pfBtn`)
- Severity chip renders at 9.5px — below the closed scale floor (`mono-sm` = 10)

### Usability
- `chkToList()` / `chkToReview()` have NO guard: advanced Photos 0/6 -> Checklist -> Review with 26 of 27 items unanswered, no warning. Review then reports "0 Passed / 1 Failed / 0 Photos" and the 26 unanswered items appear nowhere.
- `openFailSheet` pre-fills `desc` with the item's own name (`store.js:448`), so `saveFail()`'s `if (!desc)` guard can never fire — dead validation, and a defect can be saved whose description is just "Engine Oil / Level".
- Submit button looks disabled (`#9FB2C4`) but is fully tappable; tapping fires a toast instead. Disabled affordance lying about state.
- "Back to van record" (done step) actually routes to the **Fleet list** (`finishCheck()` -> `screen:'vans'`), not the vehicle record.
- Keyholder is confirmed twice: once in the `driver` step, again in Review ("CONFIRM KEYHOLDER").
- Hidden long-press dev shortcut on the step label passes all 27 items (`delayLongPress={600}`) — undiscoverable gesture shipped in the UI.
- BottomNav stays mounted through the whole check flow — a 5-tab escape hatch during a form that has unsaved state.
- Inspector's "Approvals" badge shows `st.queue.length`, the depot-wide queue, even though the header renames the tab "My checks".

### Consistency
- `SEV_COLOR` in CheckScreen re-declares tokens and invents `#FBF3E2` (token `amberBg` is `#FBF3E7`) — verified live.
- Review verdict styling uses off-token `#FDF6F5`/`#F0D9D5`/`#EFF6F0`/`#CFE6D4`; signed card uses `#F4FAF5`.
- `C.primaryDim` and `C.dangerDim` EXIST but CheckScreen hardcodes `#9FB2C4` / `#D5A9A2` instead.
- DashboardScreen hardcodes `#fff`, `rgba(255,255,255,.85/.9/.14/.16)`, `#FBEEEC`, `#EEF1F3`, `#9AA3AA`.
- Manager hero turns `C.danger` when `mine > 0` — error red for a non-error state (work assigned).
- Legacy copy leaked into UI against the locked naming: "Back to **van** record", "1 **fault(s)** raised", "Describe the **fault**", Fleet search "Search **plate** or model...". A `plural()` helper exists and is used elsewhere, yet DoneStep writes "fault(s)".
- Signature timestamp "Signed · 24 Aug 2026" is a hardcoded string (`CheckScreen.js:266`).

### What works
- Token file is genuinely well-structured; semantic roles are clear and mostly honoured outside CheckScreen.
- Fleet list: filter chips with live counts (Overdue 22 / Open jobs 13 / Blocked 4) + status badges carrying a WORD not just a hue — satisfies "never colour alone".
- Vehicle record blocked state explains *why* and *what to do* ("Insurance expired 1 day ago. Clear the document to put it back") and disables the check CTA with an explicit reason line.
- Mono family for regos/odometer/dates is a real information-design choice, consistently applied.
- One soft shadow, thin borders, generous whitespace — the restraint reads as quality.


### Vehicle record (VanScreen) — surface 08 detail
- Activity log header reads "6 events · audit" then lists 5 rows and a "Show all 6" button. Hiding ONE row behind a tap is friction with no payoff; "audit" is a dangling word with no affordance.
- Activity copy carries legacy naming again: "Spot-check logged — **fault found**" (locked copy is Defect).
- "Mark fixed" is a **success-green** button sitting inside a danger-tinted defect row — two competing semantic colours in one 44pt strip, and it mutates state with no confirm and no undo.
- The defect row text itself is not tappable — the only affordance is the resolve button, so there is no way to inspect a defect from the record.
- Documents list is the strongest pattern in the app: label + mono date + a red "overdue 1d" badge that names the state in words.

## Problems
- (none yet)
