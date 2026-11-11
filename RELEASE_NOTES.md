# Release text for GitHub

Copy the title into the release **title** field and the description into the
release **description** field (Markdown works).

---

## Title

```
DeepSeek Harness 0.1.0 — macOS desktop app for Intel & Apple silicon (macOS 13+)
```

## Description

```markdown
An unofficial macOS desktop app for **DeepSeek Harness** — a real window for the
Harness UI instead of a browser tab, built for the Macs the official desktop app
leaves out.

### Why this exists

The official **DeepSeek Harness Desktop** is distributed for **Apple silicon
only** — its macOS guide states: *"Apple Silicon (arm64) only. Intel Macs are not
supported; Rosetta cannot run an arm64 build."* On an Intel Mac the official app
cannot run at all. This wrapper runs the same official Harness UI (the published
`@deepseek-ai/dsh` packages) inside its own window, natively on Intel.

### Compatibility

| System | This app | Official desktop app |
| --- | --- | --- |
| Intel Mac (x86_64) | ✅ native `x64` build | ❌ not supported (arm64 only) |
| Apple silicon (M1–M4) | ✅ native `arm64` build | ✅ unsigned preview |
| macOS 13 Ventura – 15 Sequoia | ✅ | ✅ (13+) |
| macOS 12 Monterey or older | ❌ (Electron 45 floor) | ❌ |

**Tested on:** macOS 15.8.2 (Sequoia), Intel `x86_64`, Node.js v25.1.0,
dsh 0.2.2-rc.1, Electron 45.3.0 — app version **0.1.0**.
The `arm64` build is byte-verified and signed but was not launched on this Intel
machine; report anything odd in Issues.

### Download

| Mac | File |
| --- | --- |
| Intel (x86_64) | `DeepSeek-Harness-0.1.0-macOS-x64.dmg` |
| Apple silicon (M1–M4) | `DeepSeek-Harness-0.1.0-macOS-arm64.dmg` |

Apple menu → **About This Mac** → "Chip" tells you which one you need.

### Install

1. Open the `.dmg` and drag **DeepSeek Harness** into **Applications**.
2. Ad-hoc signed, not notarized. If macOS says it "cannot be opened" or is
   "damaged", run:
   ```bash
   xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
   ```
   (macOS 15 removed the right-click → Open bypass; System Settings →
   Privacy & Security → **Open Anyway** also works.)
3. Launch it. First start takes a few seconds while the local server boots.

### Requirements

- macOS 13 Ventura or newer.
- **Node.js 20+** — https://nodejs.org — the app uses it to run the Harness server.
- A `dsh` install. The app finds an existing one automatically; otherwise it
  downloads `@deepseek-ai/dsh` on first launch (~900 MB, one time). To skip
  that: `npm i -g @deepseek-ai/dsh`.
- No Apple developer account, no Rosetta, no Apple silicon needed.

### What it does

- Starts a private `dsh web` server on a random loopback port and loads it in a
  native window; the server stops when you quit.
- Shares `~/.dsh` with the browser UI, so sessions, workspaces, plugins and
  sign-in carry over.
- Menu extras: **Open Web UI in Browser** (⇧⌘O), **Show Server Log**, Retry on
  startup failure.

### Known limitations

- On some networks DeepSeek's account endpoint (`platform.deepseek.com/auth-api`)
  answers **403 Request blocked** (CloudFront). The app stays signed in and your
  sessions work normally, but the profile name/avatar cannot load — this is a
  network/region block, not the wrapper.
- Sessions started here default to the **Full access** permission preset; switch
  it to *Workspace Write* in the composer if you want sandboxed shell commands.
- Not notarized, so Gatekeeper needs the `xattr` step above.
- No auto-update: download the newer DMG from Releases.

### Checksums

```
SHA256 (DeepSeek-Harness-0.1.0-macOS-arm64.dmg) = 799e6b2fe6d4c8d7a9253d4bb0b97b1db08ed0ddc5c3c2c4cc4c6fcce58b29cb
SHA256 (DeepSeek-Harness-0.1.0-macOS-x64.dmg)   = 83fb0e28fed00067b23ed4e1596da784f53c8bd2f2c3646c9bb6cc494fdfdb2a
```

Built with Electron 45.3.0 on macOS 15.8.2. Not affiliated with DeepSeek;
"DeepSeek" and the whale mark belong to their owners. All credit for the product
itself goes to DeepSeek — this repo only wraps the published Harness UI.
```

---

## Upload steps

### Option A — GitHub website

1. Repository → **Releases** → **Draft a new release** (or edit the existing `v0.1.0`).
2. Tag: `v0.1.0`.
3. Title: paste the title above.
4. Description: paste the description block above.
5. Drag both `.dmg` files into **Attach binaries**.
6. **Publish release** / **Update release**.

### Option B — GitHub CLI

```bash
gh release edit v0.1.0 \
  --title "DeepSeek Harness 0.1.0 — macOS desktop app for Intel & Apple silicon (macOS 13+)" \
  --notes-file .cache/release-body-v2.md
```

### Option C — REST API

```bash
curl -X PATCH \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/iiisajidkhan/deepseek-harness-desktop/releases/tags/v0.1.0 \
  -d "$(jq -n --arg t "DeepSeek Harness 0.1.0 — macOS desktop app for Intel & Apple silicon (macOS 13+)" --rawfile b .cache/release-body-v2.md '{name:$t, body:$b}')"
```
