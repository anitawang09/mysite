# anitawang09.github.io/mysite

My portfolio — a single static page, no build step. The repository is the
site: push to `main` and GitHub Pages publishes it.

**Live:** https://anitawang09.github.io/mysite/

## What's in here

```
index.html            the whole page
404.html              lands anyone on a bad URL back at the site
favicon.svg           the tab icon
assets/css/style.css  one stylesheet, in cascade layers
assets/js/            six small scripts, no framework, no bundler
assets/work/          photos for the work-history polaroids  (see its README)
assets/stickers/      optional artwork for the skills pile   (see its README)
```

Nothing is compiled or minified. Open `index.html` in a browser and it runs.

## Editing it

Text lives in `index.html` — search for the words you want to change.

Two things are data rather than markup, and each has its own README:

- **Work photos** — `assets/work/manifest.json` maps a job card to an image
  file. A job with no photo shows a tinted monogram instead.
- **Skill stickers** — `assets/stickers/manifest.json` adds your own artwork
  to the physics pile in the Skills section.

Colour is one block. `assets/css/style.css` sets a ground, a surface, an ink
and four accents at the top of the theme layer; everything else on the page —
every grey, rule, and tint — is derived from those with `color-mix`. Change
those seven values and the whole site follows.

## Running it locally

```sh
python3 -m http.server 8000
```

then open http://localhost:8000. A plain file:// open mostly works too, but
the manifests are fetched, so the photos and stickers need a server.

## Third-party code

Two libraries, both from a CDN, both pinned:

- [Lenis](https://github.com/darkroomengineering/lenis) 1.3.26 — smooth scrolling
- [Matter.js](https://brm.io/matter-js/) 0.19.0 — the sticker physics

Everything else — the jigsaw geometry, the hand-drawn marks, the sticker
artwork, the squircle paths — is generated in this repository.
