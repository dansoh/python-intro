# Seller fees table — overlay

Edge-to-edge table graphic with 22px rounded corners: no outer card, no
border, no padding around the grid, so the PNG bounds are exactly the table.
Drop straight into an editor.

| File | Use |
| --- | --- |
| `seller-fees-transparent.png` | alpha background, text + dividers only — for dark footage |
| `seller-fees-dark.png` | opaque `#1D2634` fill |
| `seller-fees-glass.png` | `rgba(23,31,44,.82)` fill — reads over busy footage |

All three are 3600 × 930 (1200 × 310 CSS at 3×).

`seller-fees-table.html` is the source. Edit the copy there, then
`node render.js` to re-export all three. Body class picks the fill:
`clear` / `solid` / `glass`. Corner radius is `border-radius` on `#table`.
