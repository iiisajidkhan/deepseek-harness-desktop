# DeepSeek Harness — desktop app

A native macOS window around the DeepSeek Harness Web UI. It is a thin,
self-contained shell — the UI, agent, tools and sessions are the same ones the
`dsh web` browser app uses.

## Why this exists

The official **DeepSeek Harness Desktop** is Apple silicon only — its macOS
guide says *"Intel Macs are not supported; Rosetta cannot run an arm64 build."*
This wrapper runs the same official Harness UI natively on Intel Macs (x86_64)
and on Apple silicon (arm64).

| System | This app | Official desktop app |
| --- | --- | --- |
| Intel Mac (x86_64) | ✅ native `x64` build | ❌ not supported (arm64 only) |
| Apple silicon (M1–M4) | ✅ native `arm64` build | ✅ unsigned preview |
| macOS 13 Ventura – 15 Sequoia | ✅ | ✅ (13+) |
| macOS 12 Monterey or older | ❌ (Electron 45 floor) | ❌ |

Tested on macOS 15.8.2, Intel `x86_64`, Node v25.1.0, dsh 0.2.2-rc.1,
Electron 45.3.0.

## What it does on launch

1. Finds a local `dsh` install (newest `@deepseek-ai/dsh` in the npx cache,
   `~/.local`, `/usr/local`, or `$DSH_BIN`).
2. Starts a private `dsh web --no-open --port 0` server on a random loopback
   port, as a child process.
3. Reads the authenticated URL it prints and loads it in a Chromium window.
4. Kills the server when the app quits.

Because it uses the same `DSH_HOME` (`~/.dsh`), sessions, API keys, plugins and
workspaces are shared with `dsh web` in a browser. The app can run side by side
with a browser session.

## Install

Download the DMG for your Mac from the releases page:

- `DeepSeek-Harness-0.1.0-macOS-arm64.dmg` — Apple silicon
- `DeepSeek-Harness-0.1.0-macOS-x64.dmg` — Intel (or Apple silicon via Rosetta 2)

Open it, drag **DeepSeek Harness** onto **Applications**, then launch it.

The app is ad-hoc signed, not notarized, so the first launch may be blocked by
Gatekeeper ("cannot be opened" / "damaged"). Right-click → **Open**, or run:

```bash
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
```

Open it from Launchpad, Spotlight, or the Dock. To keep it in the Dock,
right-click its icon while running → **Options → Keep in Dock**.

## Requirements

- macOS 13 or newer (Apple silicon or Intel).
- Node.js 20+ available through the login shell (`/usr/local/bin/node` is fine).
- A `dsh` install. The app looks in, in order:
  - `$DSH_BIN` (path to `.../dsh/lib/bin.js`),
  - every `~/.npm/_npx/*/node_modules/@deepseek-ai/dsh` (newest wins),
  - `~/.local/lib/node_modules`, `/usr/local/lib/node_modules`,
    `/opt/homebrew/lib/node_modules`,
  - a bundled runtime under the app's support folder,
  - last resort: `npx -y @deepseek-ai/dsh@0.2.2-rc.1` (downloads on first run).

## Build from source

```bash
cd desktop
npm install                 # installs Electron + packager
bash scripts/make-icon.sh       # renders assets/icon.svg -> icon.icns
npm run build                   # -> dist/DeepSeek Harness-darwin-<arch>/DeepSeek Harness.app
npm run build -- --install      # also copies it to /Applications
bash scripts/make-dmg.sh x64    # distributable .dmg for Intel
bash scripts/make-dmg.sh arm64  # distributable .dmg for Apple silicon
```

Note: inside a sandboxed terminal, pass `--no-sandbox` to Electron for local
tests (`npm start -- --no-sandbox`); the installed app never needs that flag.

## Troubleshooting

- **Server log:** app menu → *DeepSeek Harness → Show Server Log*
  (`~/Library/Application Support/DeepSeek Harness/logs/server.log`).
- **Startup error window:** shows the last lines of server output; *Try Again*
  restarts the server without relaunching the app.
- **Open in browser:** menu → *Open Web UI in Browser* (⌘⇧O).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DSH_BIN` | Explicit path to `dsh/lib/bin.js` |
| `DSH_NODE` | Explicit path to the `node` binary |
| `DSH_HOME` | Alternate DeepSeek Harness home (profiles, sessions) |
| `DSH_DESKTOP_USER_DATA` | Alternate app support folder (cookies, window size) |
| `DSH_SEARCH_PATH` | Colon-separated `PATH` used to find `node` |

## Layout

```
src/main.js        Electron main process: server lifecycle + window
src/preload.js     IPC bridge for the splash window
src/splash.html    Loading / error screen
assets/icon.svg    Icon source
scripts/make-icon.sh  SVG -> .icns
scripts/build.js   Packaging + ad-hoc signing + optional /Applications install
```
