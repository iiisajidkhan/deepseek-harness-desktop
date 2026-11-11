#!/bin/bash
# Build a distributable DMG for one macOS architecture.
#   bash scripts/make-dmg.sh            # host arch (x64 here)
#   bash scripts/make-dmg.sh arm64      # Apple silicon
set -euo pipefail
cd "$(dirname "$0")/.."

ARCH="${1:-x64}"
REPO_URL="${REPO_URL:-https://github.com/iiisajidkhan/deepseek-harness-desktop}"
VERSION="$(node -p "require('./package.json').version")"
APP="dist/DeepSeek Harness-darwin-$ARCH/DeepSeek Harness.app"
STAGE=".cache/dmg-$ARCH"
DMG="dist/DeepSeek-Harness-$VERSION-macOS-$ARCH.dmg"

node scripts/build.js --arch "$ARCH"

if [ "$ARCH" = "arm64" ]; then
  REQUIREMENT="Requires an Apple silicon Mac (M1 or newer)."
else
  REQUIREMENT="Requires an Intel Mac, or an Apple silicon Mac with Rosetta 2 (macOS offers to install it automatically)."
fi

rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

cat > "$STAGE/Read Me.txt" <<EOF
DeepSeek Harness $VERSION — macOS desktop app ($ARCH)
====================================================

INSTALL
  1. Drag "DeepSeek Harness" onto the Applications folder in this window.
  2. Open it from Applications (or Launchpad / Spotlight).

$REQUIREMENT

FIRST LAUNCH
  The app runs the DeepSeek Harness UI locally. It needs Node.js 20+ installed
  (https://nodejs.org) and a dsh install. It looks for an existing dsh
  automatically; if none is found it downloads one on first launch (~900 MB,
  one time only).

  The app is not notarized by Apple, so on first launch macOS may warn that it
  "cannot be opened" or is "damaged". Do one of these:

    • Right-click the app in Applications > Open > Open, or
    • run in Terminal:
        xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"

  Your sessions, plugins and API keys live in ~/.dsh and are shared with the
  dsh web UI if you also use that.

QUIT
  Closing the window quits the app and stops its local server.

SOURCE
  $REPO_URL
EOF

hdiutil create -volname "DeepSeek Harness" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
hdiutil verify "$DMG" >/dev/null

SIZE="$(du -h "$DMG" | awk '{print $1}')"
SHA="$(shasum -a 256 "$DMG" | awk '{print $1}')"
echo "dmg:    $DMG"
echo "size:   $SIZE"
echo "sha256: $SHA"
