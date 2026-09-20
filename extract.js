#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";

// Anything matching these is the watermark/protected overlay, not a real photo.
const EXCLUDE = /event-logo-protected|storibox_watermark/i;

function parseArgs(argv) {
  const args = { input: null, url: null, out: null, includeWatermarked: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--out" || a === "-o") args.out = argv[++i];
    else if (a === "--include-watermarked") args.includeWatermarked = true;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let html;
  try {
    html = await getHtml(args);
  } catch (err) {
    console.error(`Could not read input: ${err.message}`);
    console.error(
      "Usage: extract-photos <album.html> [--url <page-url>] [--out urls.txt] [--include-watermarked]"
    );
    process.exit(1);
  }

  const rows = extract(html, args);
  const urls = rows.map((r) => r.url);

  if (args.out) {
    await writeFile(args.out, urls.join("\n") + "\n", "utf8");
    console.error(`Wrote ${urls.length} URL(s) to ${args.out}`);
  } else {
    console.log(urls.join("\n"));
  }

  const wm = rows.filter((r) => r.watermarked).length;
  console.error(
    `Found ${urls.length} URL(s)` +
      (args.includeWatermarked ? ` (${wm} watermarked included)` : "")
  );
}

main();
