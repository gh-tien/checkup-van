# Spot-Check — secret / hidden features

Notes so we remember the non-obvious gestures baked into the prototype.

## Config Management — edit mode (hidden)
Screen: **Settings → App → Config management** (`SpotCheckPhone.dc.html`, `showConfig`).

Edit mode lets you inline-rename capabilities, add a capability per group, and
delete unused ones (a lock shows on any capability currently granted to someone).

It is deliberately hidden. Two ways to toggle it on/off:
- **Long-press** anywhere on the Config screen (~0.5s).
- **Triple-tap** anywhere on the Config screen (3 taps within 0.6s).

Both flip the same `showAddValue` (edit-mode) state. Long-press = `holdStart`/`holdEnd`;
triple-tap = `tapOpen`, both wired on the screen's outer wrapper.

## Roles & permissions model
- Config Management defines capabilities grouped by role: **Inspector → Manager → Admin**, inheriting downward.
- A person's **Profile** (admin viewer only) picks a single **Role**; the capabilities follow by inheritance (`capsUpTo(role)`), shown read-only as "Can do" chips.
- Disabling a capability in Config removes it from every role's inherited set.

## Dev / testing shortcuts (not hidden, but temporary)
- Sign-in lock screen has **Skip PIN — dev** (bypasses PIN) and an **Admin** button (signs in as System Admin).
- Demo PIN is **1234**. Idle auto-logout is **2 minutes**.
- `openLocked` tweak controls whether the app opens on the lock screen.
