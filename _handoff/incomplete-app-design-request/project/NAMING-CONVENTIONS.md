# Naming conventions — Vehicle Spot-Check app

**Status:** applied across `SpotCheckPhone.dc.html` (Aug 23, 2026). Code identifiers (e.g. `vanId`, `genVans`, screen key `vans`) intentionally keep the old spelling — only user-facing copy follows the table below.


The canonical term is on the left. Never use the "avoid" words in UI copy, labels, or toasts.

## Core objects
| Use | Avoid | Notes |
|---|---|---|
| **Vehicle** | Van | The thing being checked. "Vehicle" everywhere in UI. |
| **Fleet** | Vans (list) | The collection of vehicles / the tab. |
| **Rego** | Plate, number plate | Registration, e.g. BV70 XPO. |
| **Spot-check** | Walk, walkaround, inspection | The act of checking a vehicle. |
| **Defect** | Fault, issue, fail | A problem found during a spot-check. |
| **Keyholder** | Driver | Who currently holds the vehicle (confirmed at check start). |

## Actions / states
| Use | Avoid | Notes |
|---|---|---|
| **Approve** / **Confirm** | Countersign | Manager signs off an inspector's spot-check. |
| **Approved** / **Confirmed** | Countersigned | The signed-off state. |
| **Send back** | Reject, return | Manager returns a check to the inspector to redo. |
| **Redo** | — | Inspector re-walks a sent-back vehicle. |
| **Draw** | Random pick, roll | Picking a vehicle by the draw rules. |
| **Pass / Fail** | OK / Not OK | Per checklist item. |
| **Mark fixed** | Resolve, close | Clearing a defect after repair. |

## Screens / modules
| Use | Avoid | Notes |
|---|---|---|
| **Dashboard** | Home, Check home | Role landing screen. |
| **Defects** | Open faults, Faults | Depot-wide open defects tab. |
| **Approvals** | History | Queue + approved log. |
| **Personnel Management** | People, Staff | Manage people. |
| **Templates Management** | Form builder | Defect/handover form templates. |
| **Config Management** | Settings (for rules) | Permissions, permission values, draw rules, depot. |
| **Checklist** | — | The spot-check item list (Manager+ only). |
| **Settings** | — | Backup, restore, about, danger zone. |

## Procedure terms
- **Walk-around** (always hyphenated) — the physical inspection procedure and the checklist's name ("Vehicle walk-around", "walk-around photos"). The *record* it produces is a **spot-check**; never call the act itself "a walk".

| Use | Notes |
|---|---|
| **Inspector** | Does spot-checks. |
| **Manager** | Approves checks, raises defects. |
| **Manager +** | Manager with admin capabilities; cannot grant Admin or change own role. |
| **Admin (SA / System Admin)** | Full control; only role that can grant Admin. |
