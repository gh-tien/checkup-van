# ⚠️ BEFORE CODE HANDOVER — must-address requirements

These are NOT built in the prototype yet. Flag and decide before handing the build to code.

## 1. One-time access code — device binding
- On first sign-in, verify access with a **one-time access code** that **binds the app to that device**.
- After binding, that install is tied to the device (a signature comes from a known phone).

## 2. Location-gated vehicle check
- A user **cannot perform a Vehicle Check unless they are in the set location** (depot geofence).
- Out of location → check is blocked (needs a clear "you're not at the depot" state).

## 3. Binding exemptions
- **Device binding does NOT apply to Manager+ and Admin roles** — they can operate without being bound to a single device.

## Open / to confirm
- **Padlock unlock gesture** — a new padlock element; **long-press to re-access the app** (re-entry after lock).

---
_Reminder: surface this file to the user before any Claude Code / developer handoff._
