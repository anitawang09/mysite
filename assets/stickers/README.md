# Sticker artwork

Put your own sticker images in this folder, then list them in `manifest.json`.
They drop into the physics pile in the Skills section alongside the drawn set.

## Adding one

1. Save the file here, e.g. `assets/stickers/bolt.png`
   PNG or WebP with a transparent background works best; SVG works too.
2. Add it to `manifest.json`:

```json
{
  "stickers": [
    "bolt.png",
    { "file": "eyes.png",   "size": 96 },
    { "file": "smiley.png", "size": 80, "shape": "circle" }
  ]
}
```

| Field   | Meaning                                                              |
|---------|----------------------------------------------------------------------|
| `file`  | Filename in this folder. Required.                                    |
| `size`  | Longest side in pixels (default 84). The other side follows the image.|
| `shape` | `circle` for round stickers, so they roll. Anything else falls as a rectangle. |

A plain string is shorthand for `{ "file": "…" }`.

## Notes

- Proportions are read from the file, so wide or tall stickers stay wide or tall.
- Images are decoded before the physics starts, so each body matches its art.
- A filename that doesn't exist is skipped silently — the rest still work.
- Trim transparent padding before exporting; the physics body uses the image
  box, so extra empty space makes a sticker feel like it lands early.
- Around 300–500px on the longest side is plenty; they display at ~80px.

## Removing the drawn set

The built-in drawn stickers are listed near the top of
`assets/js/stickers.js` in `addArtStickers()`. Delete entries from that array
to drop them, or empty it to show only your own.
