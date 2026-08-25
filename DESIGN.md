---
name: Vehicle Spot-Check
version: alpha
description: Design tokens for Vehicle Spot-Check — a React Native / Expo depot fleet spot-check app. Values are the real tokens shipped in src/theme.js (palette C, fonts F). Sizes are React Native density-independent px (unitless in code).
colors:
  primary: "#1B4D7A"
  on-primary: "#FFFFFF"
  primary-deep: "#14375A"
  secondary: "#5B6670"
  on-secondary: "#FFFFFF"
  tertiary: "#E9F0F6"
  on-tertiary: "#1B4D7A"
  neutral: "#616B73"
  surface: "#FFFFFF"
  on-surface: "#1B2126"
  app-background: "#FFFFFF"
  error: "#A03428"
  on-error: "#FFFFFF"
  error-surface: "#FBEEEC"
  error-surface-soft: "#FDF6F5"
  error-outline: "#F0D9D5"
  warning: "#8A6116"
  warning-surface: "#FBF3E7"
  success: "#397B43"
  on-success: "#FFFFFF"
  success-surface: "#EAF3EC"
  success-surface-soft: "#EFF6F0"
  success-tint: "#F4FAF5"
  success-outline: "#BCD9C2"
  success-outline-soft: "#CFE6D4"
  surface-subtle: "#FAFBFC"
  surface-alt: "#FBFBFA"
  input-surface: "#F6F7F8"
  primary-surface-soft: "#F6F9FC"
  primary-outline-soft: "#E3EBF2"
  outline: "#E7EBEE"
  outline-soft: "#EEF1F3"
  outline-strong: "#D3D9DD"
  outline-muted: "#C6D2DC"
  hairline: "#F1F2F3"
  disabled-surface: "#F1F2F3"
  on-disabled: "#58626A"
  muted: "#616B73"
  muted-strong: "#58626A"
  muted-soft: "#68727A"
  chevron: "#8B9197"
  draw: "#F4C430"
  draw-outline: "#E0B420"
typography:
  display:
    fontFamily: Fustat_700Bold
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.15
  headline-lg:
    fontFamily: Fustat_700Bold
    fontSize: 19px
    fontWeight: 700
    lineHeight: 1.25
  headline-md:
    fontFamily: Fustat_700Bold
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: Fustat_600SemiBold
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: Fustat_400Regular
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.4
  body-md:
    fontFamily: Fustat_400Regular
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: Fustat_400Regular
    fontSize: 12.5px
    fontWeight: 400
    lineHeight: 1.4
  label-lg:
    fontFamily: Fustat_500Medium
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
  label-md:
    fontFamily: Fustat_500Medium
    fontSize: 12.5px
    fontWeight: 500
    lineHeight: 1.35
  label-sm:
    fontFamily: Fustat_600SemiBold
    fontSize: 11px
    fontWeight: 600
    lineHeight: 1.3
  mono-md:
    fontFamily: IBMPlexMono_500Medium
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.4
  mono-sm:
    fontFamily: IBMPlexMono_600SemiBold
    fontSize: 10px
    fontWeight: 600
    lineHeight: 1.3
controls:
  sm: 44px
  md: 48px
  lg: 56px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
rounded:
  none: 0px
  sm: 6px
  md: 11px
  lg: 14px
  xl: 16px
  sheet: 22px
  pill: 999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
    padding: 14px
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: 14px
  button-danger:
    backgroundColor: "{colors.error}"
    textColor: "{colors.on-error}"
    rounded: "{rounded.xl}"
    padding: 14px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xl}"
    padding: 14px
  stat-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 13px
  input:
    backgroundColor: "{colors.input-surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 12px
  badge-status:
    backgroundColor: "{colors.outline-soft}"
    textColor: "{colors.muted-strong}"
    rounded: "{rounded.sm}"
    padding: 4px
---

## Overview

Design tokens for **Vehicle Spot-Check**, a React Native / Expo phone app for depot fleet
spot-checks. These are the **real** shipped tokens — mirrored from `src/theme.js` (`C` palette,
`F` font families) — not a placeholder scaffold. In code, tokens are consumed as plain JS objects
(`C.primary`, `F.sansBold`) inside `StyleSheet.create(...)`, so values are React Native
density-independent pixels (unitless numbers in code; written here with `px` for the linter).

Lint after any edit:

```
npx @google/design.md lint DESIGN.md
```

## Colors

Role-based tokens with `on-*` foregrounds. `primary` (#1B4D7A) is the depot brand blue and the single
accent for primary actions. Semantic families each ship a `*-surface` tint used for soft badges/banners:
- **error** `#A03428` — blocked vehicles, defects, destructive actions, "send back".
- **warning** `#8A6116` — awaiting approval, open jobs, documents expiring soon.
- **success** `#3A7D44` — passed checks, OK status, "mark fixed".
The neutral ramp (`muted-strong` → `muted` → `muted-soft` → `chevron`) drives secondary text and
disclosure affordances. It was **darkened from the prototype's values** so that every text tier clears
4.5:1 on `surface` and `chevron` clears the 3:1 UI-graphic bar — the ported greys were 3.87 / 2.56 /
1.64 and carried nearly all of the app's subtitles and placeholders. `chevron` is for graphics only,
never text. `disabled-surface` + `on-disabled` are the single not-ready pairing for buttons (5.56:1),
replacing the old `primary-disabled` / `error-disabled` washes that put white on a pale fill.
`draw` (#F4C430) is reserved for the random-draw overlay only.

## Typography

Two families, loaded via `@expo-google-fonts`: **Fustat** (sans, weights 400/500/600/700) for all UI
text, and **IBM Plex Mono** (weights 400/500/600/700) for regos, counts, version tags, and dense
metadata. The scale is closed — `display` down to `label-sm`, plus `mono-*`. `fontFamily` values are
the exact keys registered in `App.js` (e.g. `Fustat_700Bold`), because RN selects weight by family
name, not a numeric `fontWeight`.

## Layout

Base spacing is a 4px scale (`xs`…`xxl`). Note: several shipped surfaces use fractional inner padding
(e.g. 13/14px card padding) inherited from the prototype; treat `md`/`sm` as the default and match the
existing component when extending one.

`controls` is the closed scale of tappable minimum heights, consumed in code as `CTRL` from
`theme.js`: **`sm` 44** (the WCAG/HIG floor — chips, segmented controls, inline actions), **`md` 48**
(controls pressed repeatedly in the field: Pass/Fail, Submit, sheet saves), **`lg` 56** (a full-width
commit at the end of a flow). Never set a `minHeight` below `sm` on something pressable.

## Elevation & Depth

One shared soft shadow only: `cardShadow` in `theme.js` = `0 1px 2px rgba(27,33,38,.04)`
(iOS `shadow*` + Android `elevation: 1`). Cards are otherwise separated by 1px `outline` borders.
Keep it flat; don't introduce new shadow depths.

## Shapes

Corner radii cluster at `md` (11 — pills/badges/inputs), `lg` (14 — row cards, buttons),
`xl` (16 — content cards), `sheet` (22 — every bottom sheet), and `pill` (999 — chips, avatars,
status dots). Match the neighbor.

## Components

Token-composed primitives already in the codebase: `AppHeader`, `BottomNav`, `Icon` (SVG line icons,
viewBox 0 0 24 24), `Toast`, and per-screen cards. Reuse and compose these before adding new ones;
always reference tokens (`C.*`, `F.*`), never raw hex/px that a token already covers.

## Do's and Don'ts

- **Do** consume tokens through `theme.js` (`C`, `F`, `cardShadow`) — this file is the human-readable
  mirror; `theme.js` is what the app imports.
- **Do** keep contrast at WCAG AA and pair color-coded status with a text label (the status badges
  already do: "Blocked" / "Overdue" / "OK", not color alone).
- **Do** honour ≥44×44pt touch targets — use `CTRL.sm/md/lg`, never a bare `minHeight` number.
- **Don't** hardcode a hex or font size that exists here; add the token to `theme.js` and `DESIGN.md`.
- **Don't** invent new radii, shadow depths, or one-off font sizes.
</content>
</invoke>
