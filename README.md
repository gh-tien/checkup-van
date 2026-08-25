# Vehicle Spot-Check

A fleet vehicle spot-check / full-inspection app for inspectors, managers, and admins:
dashboard, fleet register, guided check flow with photo capture, defect tracking,
approvals, and depot config.

## ⚠️ This repo holds two different codebases

`checkup-van` contains **two separate implementations** of the same product on different branches.
They share a name and a few filenames (`store.js`, `PROGRESS.md`) but are **not** the same code —
don't try to merge one into the other.

| Branch | Stack | What it is |
|---|---|---|
| [`main`](../../tree/main) | Vanilla PWA (`index.html` / `app.js` / `sw.js`) | The original build, v28–v37 |
| [`expo-rewrite`](../../tree/expo-rewrite) | React Native + Expo (`react-native-web`) | This branch — the ground-up native rewrite |

You are reading the **`expo-rewrite`** README.

## Stack

- **React Native** via **Expo SDK 54** (React 19, RN 0.81), plain JavaScript — no TypeScript
- State: a singleton `Store` (`src/store.js`) exposed through React context + `useSyncExternalStore`
- Styling: `StyleSheet` composed from design tokens in [`src/theme.js`](src/theme.js) (mirrored in [`DESIGN.md`](DESIGN.md))
- Icons: single SVG `Icon` component (`react-native-svg`)
- Runs on iOS, Android, and web (`react-native-web`)

Design intent and rationale live in [`CLAUDE.md`](CLAUDE.md), [`DESIGN.md`](DESIGN.md), and [`DECISIONS.md`](DECISIONS.md).

## Run locally

```bash
npm install
npm start        # Expo dev server — press i / a / w for iOS / Android / web
```

Or target a platform directly:

```bash
npm run web      # browser
npm run ios      # iOS simulator
npm run android  # Android emulator
```

## Web build

```bash
npx expo export --platform web   # static site → dist/
```

The `dist/` output is a static single-page app that any static host can serve.
