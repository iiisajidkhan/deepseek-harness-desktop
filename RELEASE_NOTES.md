# Release text for GitHub

Copy the title into the release **title** field and the description into the
release **description** field (Markdown works).

---

## Title

```
DeepSeek Harness 0.1.0 — macOS desktop app (Intel + Apple silicon)
```

## Description

```markdown
An unofficial macOS desktop app for **DeepSeek Harness** — a real window for the
Harness UI instead of a browser tab. Not affiliated with DeepSeek.

### Download

| Mac | File |
| --- | --- |
| Apple silicon (M1/M2/M3/M4) | `DeepSeek-Harness-0.1.0-macOS-arm64.dmg` |
| Intel | `DeepSeek-Harness-0.1.0-macOS-x64.dmg` |

Not sure which one? Apple menu → **About This Mac** → look at "Chip".
Apple silicon Macs can run either build (the x64 one through Rosetta 2);
Intel Macs need the x64 build.

### Install

1. Open the `.dmg` and drag **DeepSeek Harness** into **Applications**.
2. The app is ad-hoc signed, not notarized by Apple. On first launch macOS may
   say it "cannot be opened" or is "damaged". Fix it with one of:
   - Right-click the app in Applications → **Open** → **Open**, or
   - `xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"`
3. Launch it. The first start takes a few seconds while the local server boots.

### Requirements

- macOS 13 or newer.
- **Node.js 20+** — https://nodejs.org (the app needs it to run the Harness server).
- A `dsh` install. The app finds an existing one automatically. If you don't
  have one, it downloads `@deepseek-ai/dsh` on first launch (~900 MB, one time).
  To skip that download: `npm i -g @deepseek-ai/dsh`.

### What it does

- Starts a private `dsh web` server on a random loopback port and loads it in a
  native window; the server is stopped when you quit.
- Shares `~/.dsh` with the browser UI, so sessions, workspaces, plugins and
  sign-in carry over.
- Menu extras: **Open Web UI in Browser** (⇧⌘O), **Show Server Log**, Retry on
  startup failure.

### Notes

- This is a thin wrapper around the official Harness UI, built from the
  published `@deepseek-ai/dsh` packages. All credit for the product belongs to
  DeepSeek; this repo only packages the window.
- Builds are ad-hoc signed, so Gatekeeper warnings are expected (see step 2).
- Sessions and API keys stay local in `~/.dsh` — nothing is uploaded by this app.

### Checksums

```
SHA256 (DeepSeek-Harness-0.1.0-macOS-arm64.dmg) = 799e6b2fe6d4c8d7a9253d4bb0b97b1db08ed0ddc5c3c2c4cc4c6fcce58b29cb
SHA256 (DeepSeek-Harness-0.1.0-macOS-x64.dmg)   = 83fb0e28fed00067b23ed4e1596da784f53c8bd2f2c3646c9bb6cc494fdfdb2a
```

Built with Electron 45.3.0 on macOS 15.8.2.
```

---

## Upload steps

### Option A — GitHub website

1. Create a repository (or open the existing one) → **Releases** → **Draft a new release**.
2. **Choose a tag** → type `v0.1.0` → *Create new tag on publish*.
3. Title: paste the title above.
4. Description: paste the description block above.
5. Drag both `.dmg` files into the **Attach binaries** box (each is under
   GitHub's 2 GB asset limit).
6. **Publish release**.

### Option B — GitHub CLI

```bash
gh release create v0.1.0 \
  "dist/DeepSeek-Harness-0.1.0-macOS-x64.dmg" \
  "dist/DeepSeek-Harness-0.1.0-macOS-arm64.dmg" \
  --title "DeepSeek Harness 0.1.0 — macOS desktop app (Intel + Apple silicon)" \
  --notes-file RELEASE_NOTES.md
```

(The `--notes-file` variant needs the description block extracted into
`RELEASE_NOTES.md` without the "Title/Description" headings.)
