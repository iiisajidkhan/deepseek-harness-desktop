#!/bin/bash
# Rasterize assets/icon.svg into assets/icon.icns using Electron + macOS built-ins.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p .cache
./node_modules/.bin/electron --no-sandbox --disable-gpu scripts/render-icon.js >/dev/null 2>&1

SRC=".cache/icon-render.png"
[ -f "$SRC" ] || { echo "could not rasterize icon.svg" >&2; exit 1; }

rm -rf .cache/icon.iconset
mkdir -p .cache/icon.iconset
for size in 16 32 128 256 512; do
  sips -z $size $size "$SRC" --out ".cache/icon.iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z $double $double "$SRC" --out ".cache/icon.iconset/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns .cache/icon.iconset -o assets/icon.icns
sips -z 512 512 "$SRC" --out assets/icon.png >/dev/null
echo "wrote assets/icon.icns"
