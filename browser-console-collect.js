// Paste this into the DevTools Console (F12) on a Storibox album page and
// press Enter. It auto-scrolls to the bottom repeatedly, accumulating every
// `.gallery__item` it sees along the way — this handles galleries that
// virtualize the DOM (only rendering items near your current scroll
// position), where a single "Copy outerHTML" snapshot would miss most items.
//
// By default it downloads each clean (non-watermarked) file to your
// Downloads folder. Set DOWNLOAD_FILES to false to just log/copy the URL
// list instead of downloading.
(async () => {
  const INCLUDE_WATERMARKED = false; // set true to also keep protected previews
  const DOWNLOAD_FILES = true; // set false to only collect URLs, not download
  const DOWNLOAD_DELAY_MS = 300; // pause between downloads so the browser doesn't block them

  const seen = new Map();

  const collect = () => {
    document.querySelectorAll(".gallery__item").forEach((item) => {
      const img = item.querySelector(".gallery__item-img");
      const src = img && img.getAttribute("src");
      if (!src) return;
      const id = item.getAttribute("data-id") || src;
      seen.set(id, {
        src,
        type: item.getAttribute("data-type") || "regular",
        watermarked: !!item.querySelector(".gallery__item-watermark"),
      });
    });
  };

  let lastCount = -1;
  let stableRounds = 0;
  for (let i = 0; i < 500 && stableRounds < 3; i++) {
    collect();
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((r) => setTimeout(r, 500));
    if (seen.size === lastCount) stableRounds++;
    else stableRounds = 0;
    lastCount = seen.size;
  }
  collect();

  const rows = [...seen.values()];
  const targets = rows.filter((r) => INCLUDE_WATERMARKED || !r.watermarked);
  const urls = targets.map((r) => r.src);

  console.log(
    `Collected ${rows.length} total items (${rows.filter((r) => r.watermarked).length} watermarked), ` +
    `${urls.length} URL(s) to ${DOWNLOAD_FILES ? "download" : "collect"}.`
  );

  if (!DOWNLOAD_FILES) {
    const text = urls.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      console.log("Copied URL list to your clipboard.");
    } catch {
      console.log("Clipboard write failed, printing instead:");
      console.log(text);
    }
    window.__urls = urls;
    return;
  }

  function filenameFor(url, index) {
    try {
      const name = decodeURIComponent(new URL(url).pathname.split("/").pop());
      if (name && name.includes(".")) return name;
    } catch {}
    return `image-${String(index + 1).padStart(3, "0")}.jpg`;
  }

  let done = 0;
  let failed = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filenameFor(url, i);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      done++;
    } catch (err) {
      failed++;
      console.error(`Failed: ${url} (${err.message})`);
    }
    await new Promise((r) => setTimeout(r, DOWNLOAD_DELAY_MS));
  }

  console.log(`Downloaded ${done}/${urls.length} file(s)` + (failed ? ` (${failed} failed)` : "") + ".");
  window.__urls = urls;
})();
