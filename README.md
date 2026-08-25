# Fleet Spot-Check Manager v2

A mobile-first PWA for walking a depot's vans and recording spot-checks. No build
step, no framework, no server-side anything: `index.html` loads `app.css`,
`store.js`, `photos.js` and `app.js` as plain script tags. Every record lives in
the phone's own `localStorage`; walk-around photos are downscaled and their blobs
live in `IndexedDB` (only the photo ids sit on the check record).

## ⚠️ This repo holds two different codebases

`checkup-van` contains **two separate implementations** of the same product on different branches.
They share a name and a few filenames (`store.js`, `PROGRESS.md`) but are **not** the same code —
don't try to merge one into the other.

| Branch | Stack | What it is |
|---|---|---|
| [`main`](../../tree/main) | Vanilla PWA (`index.html` / `app.js` / `sw.js`) | **This branch** — the original build, v37 |
| [`expo-rewrite`](../../tree/expo-rewrite) | React Native + Expo (`react-native-web`) | The ground-up native rewrite |

You are reading the **`main`** README. See the [`expo-rewrite` branch](../../tree/expo-rewrite) for the rewrite.

**Hosting:** only this branch's app is hosted — **live at <https://checkup-van.netlify.app>** (below).
The `expo-rewrite` branch is backed up on GitHub but not yet hosted; its web build is one command
away (`npx expo export --platform web`) once that rewrite is feature-complete.

```
index.html            shell
app.css               all styling
store.js              domain records (spotcheck.db.v1) behind a swappable driver
photos.js             photo blobs (spotcheck.photos, IndexedDB) — ids only on records
app.js                UI state (spotcheck.ui.v3), views, actions
sw.js                 offline shell cache — bump VERSION on every shell change
manifest.webmanifest  install metadata
icons/                app icons
```

**Live at <https://checkup-van.netlify.app>** (Netlify static hosting, HTTPS).
Because that is a secure origin, the phone gets what the LAN never could: the
service worker registers, the shell caches, it installs to the home screen, and it
opens with no signal and the laptop off. This is the copy to put on a real phone.

**It is still local-first — nothing about hosting changes where the data lives.**
There is no backend and no account: every record stays in that device's own
`localStorage` and `IndexedDB`, and each phone that opens the URL keeps its own
separate depot. The link ships the *app*, not anybody's data. A fresh visit shows
an empty depot ready to set up (the seed carries only the checklist template).

Running it from the laptop over the LAN (below) is still the way to develop and to
test changes before they go live; that path has real limits, spelled out under
[What does *not* work over the LAN](#what-does-not-work-over-the-lan-and-why).

### Redeploying

Deploys are a plain static upload — no build. **Only the runtime files go public**;
`PROGRESS.md` (which carries the LAN IP), `README.md` and `design/` are dev-only and
must stay off the site. So the deploy runs from a staged folder, not the repo root —
`--dir .` would leak those. With `netlify-cli` logged in as the site owner:

```bash
pub=$(mktemp -d); mkdir -p "$pub/icons"
cp index.html app.css app.js photos.js store.js sw.js manifest.webmanifest "$pub/"
cp icons/* "$pub/icons/"
netlify deploy --prod --dir "$pub" --site a66b1464-2703-4498-beb5-6bd2d7cba85f
```

Target the site by **id**, not by name. `--site checkup-van` fails with "Failed
retrieving site data" — this folder has no `.netlify/state.json`, so the CLI falls
back to whatever project it last linked (an unrelated one), and the name lookup
comes up empty. The id above is the only unambiguous handle.

A `VERSION` bump in `sw.js` still governs whether phones pick the new shell up,
exactly as on the LAN — a deploy without it serves the same cached shell as before.

On Windows, `.publish/stage.ps1` does the staging step natively (it writes
`.publish/pub-vNN`, then prints a file list, a leak check and the staged
`VERSION`). Re-run it after any code change — a stale staged folder deploys the
old build while the repo looks current. `.publish/` is dev-only scratch and never
goes on the site.

---

## Running it

The dev server is declared in `.claude/launch.json` — Python's built-in static
file server, serving this folder as-is on port 4174:

```bash
python -m http.server 4174
```

Then open <http://localhost:4174> on this machine.

It is single-threaded and handles one request at a time, which is fine for one
phone and one laptop and is the reason a first cold load feels a beat slow.

To stop it, Ctrl-C the terminal it is running in (or stop it from wherever it was
started).

---

## Reaching it from the phone

**1. Put the phone on the same Wi-Fi as this machine.** Not the guest network,
not 4G. The current network on this machine is `No Connection_5GEXT` (Wi-Fi).

**2. Find this machine's LAN address.**

```bash
ipconfig
```

Read the **IPv4 Address** under the Wi-Fi adapter. Right now that is
**`192.168.50.162`** — but it is a DHCP lease, so it will change if the router
reassigns it or the machine moves networks. Check it again if the phone suddenly
cannot connect.

**3. On the phone, open:**

```
http://192.168.50.162:4174
```

The server already binds to `0.0.0.0`, so it listens on the LAN interface without
any extra flag.

**4. Firewall.** Windows Defender already has an enabled inbound Allow rule for
`C:\python313\python.exe` on the Public profile, and this Wi-Fi is categorised
Public — so nothing needs adding today. If the phone times out after a Python
upgrade or a network-category change, open an elevated PowerShell and add a rule
for the port itself:

```powershell
New-NetFirewallRule -DisplayName "Spot-Check dev server 4174" -Direction Inbound -Protocol TCP -LocalPort 4174 -Action Allow -Profile Private,Public
```

Remove it when you are done with it:

```powershell
Remove-NetFirewallRule -DisplayName "Spot-Check dev server 4174"
```

**A note on what this exposes.** `http.server` is an unauthenticated file server
pointed at this folder. On a home or depot Wi-Fi that is unremarkable; on a café
or hotel network anyone else on it can read the folder. Stop the server when you
are not using it.

---

## What does *not* work over the LAN, and why

**Service workers only register on a secure origin.** `https://` counts, and
`http://localhost` is specially exempted — but `http://192.168.50.162` is not.

The browser does not merely refuse the registration: on an insecure origin it
does not expose the APIs at all. Loaded over the LAN IP, `window.isSecureContext`
is `false`, `navigator.serviceWorker` is **undefined**, and the `caches` global is
**absent**. (Verified, not assumed — that is what the app reports when opened at
`http://192.168.50.162:4174`.) `app.js` guards its registration with
`'serviceWorker' in navigator`, which is why nothing throws and the app comes up
normally; anything added later that touches either API must guard the same way.

Concretely, when the app is opened at `http://192.168.50.162:4174`:

| | Over `http://localhost` | Over `http://192.168.x.x` |
|---|---|---|
| The app itself | works | **works** |
| Records, settings, checks (`localStorage`) | works | **works** |
| Walk-around photos (`IndexedDB`) | works | **works** |
| Offline shell cache (`sw.js`) | works | **API not available** |
| Works with the laptop off / phone off Wi-Fi | works | **no — blank page** |
| Chrome/Android install prompt | offered | **not offered** (needs a service worker) |
| iOS *Add to Home Screen* | works | works — launches standalone, but still needs the server up |

This is a browser security rule, not a bug in the app and not something a flag in
the server can turn off. The app is fully usable over the LAN; it just cannot go
offline there, because the shell it would serve offline was never allowed to be
cached.

**If offline needs testing on a real phone**, put the phone on `localhost` rather
than on an IP. On Android, with USB debugging on and the phone plugged in:

```bash
adb reverse tcp:4174 tcp:4174
```

The phone then reaches the same server at `http://localhost:4174`, which *is* a
secure context — the service worker registers, the shell caches, and install and
offline both behave as they would in production. iOS has no equivalent without
extra tooling; there, test offline on the desktop browser.

---

## Working on it

`sw.js` caches the shell files listed in `SHELL_FILES` and serves them
cache-first. **Any change to `index.html`, `app.css`, `store.js`, `photos.js` or
`app.js` must be accompanied by a bump to `VERSION` in `sw.js`**, and the page
must be *reloaded* after the new worker activates — navigating within the app is
not enough, because the old worker is still the one answering.

Current version: `v37`.

The version lives in **two** places that must agree: `VERSION` in `sw.js` and `BUILD` at the top of
`app.js`. `BUILD` is what the header shows in its left gutter, so a mismatch means the app reports a
build it isn't — `.publish/stage.ps1` refuses to stage when they differ. Bump both together.
