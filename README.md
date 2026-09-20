# storibox-photo-extractor

Pulls the real photo/video-thumbnail URLs out of a Storibox album page and
skips the watermark overlay (`event-logo-protected` / `storibox_watermark`).

The watermark lives in a `.gallery__item-watermark` div's `background-image`,
while each photo is an `<img class="gallery__item-img">`, so targeting the img
elements gets the photos and never the watermark PNG.

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

Straight from the live page (works because the gallery is in the server HTML):

```bash
node extract.js --url "https://storibox.com/..." --out urls.txt
```

Piped in:

```bash
pbpaste | node extract.js
```

## Flags

| Flag | Meaning |
| --- | --- |
| `--out`, `-o <file>` | Write newline-separated URLs to a file instead of stdout |
| `--url <page-url>` | Fetch the page instead of reading a local file |
| `--include-watermarked` | Also include items that carry a watermark overlay (excluded by default) |

## Notes

- By default, items that still show a watermark overlay are **skipped** — those
  are the protected previews. Pass `--include-watermarked` to keep them.
- The album lazy-loads as you scroll, so if you're saving the page manually,
  scroll to the bottom first so every item is in the HTML.
