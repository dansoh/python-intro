#!/usr/bin/env bash
# Alpha-channel video versions of the overlay, for editors that flatten PNG alpha.
# VP9/WebM: lossless, tiny, profile 0 for max compatibility.
# QuickTime Animation (qtrle) MOV: lossless RGBA, the fallback if WebM alpha is ignored.
set -euo pipefail
SRC=${1:-seller-fees-dark.png}
SECS=${2:-6}

ffmpeg -y -loop 1 -framerate 30 -i "$SRC" -t "$SECS" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -lossless 1 -auto-alt-ref 0 -row-mt 1 \
  seller-fees-overlay.webm

ffmpeg -y -loop 1 -framerate 30 -i "$SRC" -t "$SECS" \
  -c:v qtrle -pix_fmt argb \
  seller-fees-overlay.mov
