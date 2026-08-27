# Seller fees table — overlay

Edge-to-edge table graphic with 22px rounded corners: no outer card, no
border, no padding around the grid, so the PNG bounds are exactly the table.
Drop straight into an editor.

| File | Use |
| --- | --- |
| `seller-fees-transparent.png` | alpha background, text + dividers only — for dark footage |
| `seller-fees-dark.png` | opaque `#1D2634` fill |
| `seller-fees-glass.png` | `rgba(23,31,44,.82)` fill — reads over busy footage |

All three are 2520 × 930 (840 × 310 CSS at 3×), 8-bit RGBA, no colour profile.

## If an editor flattens the alpha

Some editors composite an imported still against black instead of honouring
its alpha — the rounded corners fill in and it reads as a plain rectangle.
Drop the image on an *overlay* track rather than the main/background track
first; if that doesn't fix it, use one of the alpha video versions, which
editors treat as true overlay footage:

| File | Notes |
| --- | --- |
| `seller-fees-overlay.webm` | VP9 + alpha, lossless, ~210 KB, 6 s |
| `seller-fees-overlay.mov` | QuickTime Animation (RLE), lossless RGBA, ~4.4 MB, 6 s |

Regenerate with `./encode-alpha-video.sh [source.png] [seconds]`.

Grid rules are 2px (`--rule`) so they survive being scaled down in a
timeline, and the headline number sits in a gold `.chip` box.

`seller-fees-table.html` is the source. Edit the copy there, then
`node render.js` to re-export all three. Body class picks the fill:
`clear` / `solid` / `glass`. Corner radius is `border-radius` on `#table`.
