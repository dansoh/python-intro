#!/usr/bin/env python3
"""Stitch four QR-code quadrant photos into one readable QR code.

Usage:
    python3 stitch_qr.py TL.png TR.png BL.png BR.png -o stitched.png

Argument order is top-left, top-right, bottom-left, bottom-right.
Each quadrant photo is auto-cropped to the high-contrast QR region,
binarized, resized to a common square, then assembled into a 2x2 grid
with a white quiet zone added around the result.

Pass --no-crop to skip auto-cropping if your images are already tight,
and --size N to control the per-quadrant pixel size (default 300).
"""
import argparse
import numpy as np
from PIL import Image


def auto_crop(gray: np.ndarray, dark_thresh: int = 110, frac: float = 0.04) -> tuple:
    """Return (top, bottom, left, right) bounding box of the QR region.

    The QR contributes truly-dark pixels; textured gray backgrounds do not.
    We keep rows/columns whose fraction of dark pixels exceeds `frac`.
    """
    dark = gray < dark_thresh
    row_has = dark.mean(axis=1) > frac
    col_has = dark.mean(axis=0) > frac
    if not row_has.any() or not col_has.any():
        return 0, gray.shape[0], 0, gray.shape[1]
    rows = np.where(row_has)[0]
    cols = np.where(col_has)[0]
    return rows[0], rows[-1] + 1, cols[0], cols[-1] + 1


def prep(path: str, size: int, do_crop: bool) -> Image.Image:
    img = Image.open(path).convert("L")
    arr = np.asarray(img)
    if do_crop:
        t, b, l, r = auto_crop(arr)
        arr = arr[t:b, l:r]
    # Binarize so seams are clean black/white, not gray photo noise.
    thresh = (int(arr.min()) + int(arr.max())) // 2
    binar = np.where(arr > thresh, 255, 0).astype(np.uint8)
    return Image.fromarray(binar).resize((size, size), Image.NEAREST)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("tl")
    ap.add_argument("tr")
    ap.add_argument("bl")
    ap.add_argument("br")
    ap.add_argument("-o", "--out", default="stitched.png")
    ap.add_argument("--size", type=int, default=300, help="per-quadrant px")
    ap.add_argument("--no-crop", action="store_true")
    args = ap.parse_args()

    s = args.size
    do_crop = not args.no_crop
    quads = {
        "TL": prep(args.tl, s, do_crop),
        "TR": prep(args.tr, s, do_crop),
        "BL": prep(args.bl, s, do_crop),
        "BR": prep(args.br, s, do_crop),
    }

    quiet = max(s // 10, 16)  # white quiet zone (>= 4 modules typically)
    canvas = Image.new("L", (2 * s + 2 * quiet, 2 * s + 2 * quiet), 255)
    canvas.paste(quads["TL"], (quiet, quiet))
    canvas.paste(quads["TR"], (quiet + s, quiet))
    canvas.paste(quads["BL"], (quiet, quiet + s))
    canvas.paste(quads["BR"], (quiet + s, quiet + s))
    canvas.save(args.out)
    print(f"Wrote {args.out} ({canvas.size[0]}x{canvas.size[1]})")


if __name__ == "__main__":
    main()
