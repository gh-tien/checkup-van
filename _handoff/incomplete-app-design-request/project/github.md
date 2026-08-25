repo: gh-tien/checkup-van
branch: main

## Last sync
date: 2026-08-23T02:54:11Z
upstream build: v30 (const BUILD in app.js) — unchanged since previous sync

### Updated in this project
- No upstream changes to pull: app.js still reports BUILD 'v30', the same source the project was built from on 2026-08-19. Nothing rebuilt this sync.
- Note: this project has intentionally diverged far from the repo (renamed Van→Vehicle, Countersign→Approve, removed Workshops/Coverage, added Templates/Config/Personnel/Dashboards, dd/mm/yyyy dates, vehicle CRUD + holding, submission review with photos). These are project-side changes, not upstream, so a future sync should only fold in NEW upstream commits, not revert them.

## Screen map
| Project screen | Repo files |
|---|---|
| More / Settings | app.js `HELP`, `RULES`, `TABS`, `ICON`, `depotName()`, backup/reset logic; app.css |
| Dashboard (Check) | app.js `drawBlock()`, `drawPool()`, `drawFacts()`, `coverageRows()` |
| Fleet / Vehicle detail | app.js `fleetList()`, `capVans()`, van record fields |
| Approvals | app.js `queueChecks()`, `historyChecks()`, `checkRow()`, countersign/send-back logic |
| Defects | app.js `openDefects()`, `defectStage()`, `defectMetaLine()` |
| Checklist / Templates | app.js `LIVE_LIST`, `buildList()`, `changeCount()`, `publishedList()` |

## Sync history
- 2026-08-19T23:11:52Z — built More/Settings from app.js+app.css v30; added More redesigns, Settings redesign, How-to/help screen.
