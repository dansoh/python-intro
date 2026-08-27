#!/usr/bin/env bash
# Encode the frames/ rendered by animate.js into alpha-channel clips.
set -euo pipefail
FPS=${1:-60}

ffmpeg -y -framerate "$FPS" -i frames/f%04d.png \
  -c:v libvpx-vp9 -pix_fmt yuva420p -lossless 1 -auto-alt-ref 0 -row-mt 1 \
  seller-fees-highlight.webm

ffmpeg -y -framerate "$FPS" -i frames/f%04d.png \
  -c:v qtrle -pix_fmt argb \
  seller-fees-highlight.mov
