# storibox-photo-extractor

Pulls the real photo/video-thumbnail URLs out of a Storibox album page and
skips the watermark overlay (`event-logo-protected` / `storibox_watermark`).

The watermark lives in a `.gallery__item-watermark` div's `background-image`,
while each photo is an `<img class="gallery__item-img">`, so targeting the img
elements gets the photos and never the watermark PNG.

There's also a browser version of this tool (no install required) at
https://vinayakrevankar.com/storibox-photo-extractor/.

## Setup

```bash
cd storibox-photo-extractor
npm install
```

Requires Node 18+ (uses global `fetch`).

## Usage

From a saved HTML file:

```bash
node extract.js album.html                 # print URLs to stdout
node extract.js album.html --out urls.txt  # write URLs to a file
```

Straight from a live page, *if* the gallery is server-rendered (some Storibox
albums are; the JS-driven `webapp` build described below is not):

```bash
node extract.js --url "https://storibox.com/..." --out urls.txt
```

Piped in:

```bash
pbpaste | node extract.js
```

Download the extracted files straight to disk:

```bash
node extract.js album.html --download ./photos
node extract.js album.html --download ./photos --concurrency 10
```

## Flags

| Flag | Meaning |
| --- | --- |
| `--out`, `-o <file>` | Write newline-separated URLs to a file instead of stdout |
| `--url <page-url>` | Fetch the page instead of reading a local file |
| `--include-watermarked` | Also include items that carry a watermark overlay (excluded by default) |
| `--download <dir>` | Download every extracted URL into `<dir>` (created if missing) instead of printing them |
| `--concurrency <n>` | Parallel downloads when using `--download` (default 5) |

## Notes

- By default, items that still show a watermark overlay are **skipped** — those
  are the protected previews. Pass `--include-watermarked` to keep them.
- The album lazy-loads as you scroll, so if you're saving the page manually,
  scroll to the bottom first so every item is in the HTML.
- Some Storibox albums (the `webapp` build, loading `a-shoot.*.js`) render the
  gallery entirely client-side — the initial HTML is just an empty
  `<div class="gallery" style="display:none">`. For those, "View Page Source"
  and `--url` won't see any photos. Instead: open the album, scroll to load
  everything, open DevTools → Elements, find the `<div class="gallery">`
  element, right-click it → **Copy → Copy outerHTML**, and save that snippet
  to a file to pass to `extract.js` (or paste it into the browser version).
- Some albums also **virtualize** the gallery: only the items near your current
  scroll position actually exist in the DOM at any moment, so a single "Copy
  outerHTML" snapshot only captures whichever batch happened to be rendered.
  For those, run [`browser-console-collect.js`](browser-console-collect.js) in
  the DevTools Console on the album page instead — it auto-scrolls and
  accumulates every item it sees along the way, then copies the full URL list
  to your clipboard (or logs it, if clipboard access is unavailable).
- `--download` only fetches whatever URL is in `.gallery__item-img`. For
  `data-type="video"` items that's a poster-frame thumbnail, not the actual
  video file — the real video isn't present in the gallery HTML at all, so
  getting it requires finding its URL separately (e.g. via the Network tab
  while playing the video in the album).
