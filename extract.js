#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { load } from "cheerio";

// Anything matching these is the watermark/protected overlay, not a real photo.
const EXCLUDE = /event-logo-protected|storibox_watermark/i;

function parseArgs(argv) {
  const args = {
    input: null,
    url: null,
    out: null,
    includeWatermarked: false,
    download: null,
    concurrency: 5,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--out" || a === "-o") args.out = argv[++i];
    else if (a === "--include-watermarked") args.includeWatermarked = true;
    else if (a === "--download") args.download = argv[++i];
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]) || 5;
    else if (!a.startsWith("-")) args.input = a;
  }
  return args;
}

async function getHtml({ input, url }) {
  if (url) {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    return res.text();
  }
  if (input) return readFile(input, "utf8");
  // fallback: read piped stdin
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

function extract(html, { includeWatermarked }) {
  const $ = load(html);
  const seen = new Set();
  const rows = [];

  $(".gallery__item").each((_, el) => {
    const item = $(el);
    const src = item.find(".gallery__item-img").attr("src");
    if (!src) return;

    // The <img> src is always the real photo; the watermark lives in a
    // sibling div's background-image, so it never appears here. This guard
    // just catches any stray protected/watermark asset that slips in.
    if (EXCLUDE.test(src)) return;

    const hasWatermark = item.find(".gallery__item-watermark").length > 0;
    if (hasWatermark && !includeWatermarked) return;

    if (seen.has(src)) return;
    seen.add(src);

    rows.push({
      id: item.attr("data-id") || "",
      type: item.attr("data-type") || "regular",
      watermarked: hasWatermark,
      url: src,
    });
  });

  return rows;
}

function filenameFor(url, index) {
  let name;
  try {
    name = decodeURIComponent(path.basename(new URL(url).pathname));
  } catch {
    name = "";
  }
  if (!name || !path.extname(name)) {
    name = `image-${String(index + 1).padStart(3, "0")}.jpg`;
  }
  return name;
}

async function downloadAll(urls, dir, concurrency) {
  await mkdir(dir, { recursive: true });

  let done = 0;
  let failed = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      const i = cursor++;
      const url = urls[i];
      const dest = path.join(dir, filenameFor(url, i));
      try {
        const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
        done++;
      } catch (err) {
        failed++;
        console.error(`Failed: ${url} (${err.message})`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  console.error(`Downloaded ${done}/${urls.length} file(s) to ${dir}` + (failed ? ` (${failed} failed)` : ""));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let html;
  try {
    html = await getHtml(args);
  } catch (err) {
    console.error(`Could not read input: ${err.message}`);
    console.error(
      "Usage: extract-photos <album.html> [--url <page-url>] [--out urls.txt] " +
        "[--download <dir>] [--concurrency <n>] [--include-watermarked]"
    );
    process.exit(1);
  }

  const rows = extract(html, args);
  const urls = rows.map((r) => r.url);

  if (args.out) {
    await writeFile(args.out, urls.join("\n") + "\n", "utf8");
    console.error(`Wrote ${urls.length} URL(s) to ${args.out}`);
  } else if (!args.download) {
    console.log(urls.join("\n"));
  }

  const wm = rows.filter((r) => r.watermarked).length;
  console.error(
    `Found ${urls.length} URL(s)` +
      (args.includeWatermarked ? ` (${wm} watermarked included)` : "")
  );

  if (args.download) {
    await downloadAll(urls, args.download, args.concurrency);
  }
}

main();
