#!/usr/bin/env node
// Ad-text QC (BRIEF §3, §10, SCENES Appendix B.2): every visible ad text node is ≥ 24 px at its rendered size
// (font-size × cumulative scale), has contrast ≥ 4.5:1 against the pixels behind it, and sits inside title-safe
// x 96–1824 / y 54–1026. Loads index.html in headless Chromium (file://, no HyperFrames runtime: main.js already gates
// sections and stage videos on their windows), seeks the master timeline and screenshots each sample time.
//   node tools/check_text.js                         every 0.5 s over 0–45
//   node tools/check_text.js --from 22 --to 37 --step 0.25 [--html index.html] [--json out.json]
// Exempt: the phone's own UI (#phone subtree: real site pixels and iOS chrome) and any element with
// [data-qc-skip] (or inside one). Text still in transition (cumulative opacity < 0.9 or a CSS blur) is reported as
// a warning, not a failure. Exit code 1 on any failure.
// ES module (package.json "type": "module"); CommonJS deps loaded through createRequire.
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NM = path.resolve(__dirname, "..", "node_modules"); // symlink to purepeptide-30s-saas/node_modules
const puppeteer = require(path.join(NM, "puppeteer-core"));
const sharp = require(path.join(NM, "sharp"));

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, "..");
const HTML = path.resolve(ROOT, arg("html", "index.html"));
const FROM = +arg("from", 0), TO = +arg("to", 44.99), STEP = +arg("step", 0.5);
const SAFE = { x0: 96, x1: 1824, y0: 54, y1: 1026 }, MIN_PX = 24, MIN_CR = 4.5;

const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const cr = (a, b) => { const L1 = lum(...a), L2 = lum(...b); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); };

(async () => {
  const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
  const p = await b.newPage();
  await p.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto("file://" + HTML, { waitUntil: "load" });
  await p.evaluate(() => window.PP.ready.then(() => document.fonts.ready));
  await p.evaluate(() => Promise.all(Array.from(document.images).map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = im.onerror = r))))));
  if (errs.length) console.log("page errors:", errs);
  const fails = [], warns = [];
  for (let t = FROM; t <= TO + 1e-9; t += STEP) {
    const T = Math.round(t * 1000) / 1000;
    const items = await p.evaluate((T) => {
      // prime: a fresh paused timeline sitting at 0 does not render on seek(0) (immediateRender sets of later scenes
      // would leak into the t=0 sample). Seek away first, as the renderer effectively does.
      window.__timelines.main.seek(T > 0.5 ? 0 : 1, false);
      window.__timelines.main.seek(T, false);
      const out = [];
      const skip = (el) => el.closest("#phone, [data-qc-skip]");
      const walker = document.createTreeWalker(document.getElementById("stage"), NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        if (!el || seen.has(el) || skip(el)) continue;
        seen.add(el);
        let op = 1, blur = false, hidden = false;
        for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
          const c = getComputedStyle(a);
          if (c.display === "none" || c.visibility === "hidden") hidden = true;
          op *= +c.opacity;
          if (/blur\((?!0px)/.test(c.filter)) blur = true;
        }
        if (hidden || op < 0.05) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
        if (!rects.length) continue;
        const r = rects.reduce((u, q) => ({ left: Math.min(u.left, q.left), top: Math.min(u.top, q.top), right: Math.max(u.right, q.right), bottom: Math.max(u.bottom, q.bottom) }), { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 });
        // clip to every overflow-clipping ancestor (masks, roll strips): what is cut away is not on screen
        for (let a = el; a && a.nodeType === 1 && a.id !== "stage"; a = a.parentElement) {
          const c = getComputedStyle(a);
          if (c.overflowX === "visible" && c.overflowY === "visible") continue;
          const q = a.getBoundingClientRect();
          if (c.overflowX !== "visible") { r.left = Math.max(r.left, q.left); r.right = Math.min(r.right, q.right); }
          if (c.overflowY !== "visible") { r.top = Math.max(r.top, q.top); r.bottom = Math.min(r.bottom, q.bottom); }
        }
        if (r.right - r.left < 1 || r.bottom - r.top < 1) continue;
        if (r.right < 0 || r.left > 1920 || r.bottom < 0 || r.top > 1080) continue;
        const cs = getComputedStyle(el);
        let scale = 1;
        if (el instanceof SVGElement) {
          const m = el.getScreenCTM && el.getScreenCTM();
          if (m) scale = Math.hypot(m.a, m.b);
        } else {
          // cumulative CSS scale: compose the transform matrices up the tree
          for (let a = el; a && a.nodeType === 1; a = a.parentElement) {
            const tr = getComputedStyle(a).transform;
            if (tr && tr !== "none") { const m = new DOMMatrixReadOnly(tr); scale *= Math.hypot(m.a, m.b); }
          }
        }
        const col = cs.color.match(/[\d.]+/g).map(Number);
        out.push({ text: n.textContent.trim().slice(0, 40), sel: (el.closest("section") || {}).id + " " + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && el.className.baseVal == null ? "." + String(el.className).split(" ").join(".") : ""),
          px: parseFloat(cs.fontSize) * scale, rect: [r.left, r.top, r.right, r.bottom], color: col.slice(0, 3), op, blur });
      }
      return out;
    }, T);
    if (process.env.QC_DEBUG) console.log(T, JSON.stringify(items));
    if (!items.length) continue;
    const shot = await p.screenshot({ type: "png" });
    const raw = await sharp(shot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const img = { width: raw.info.width, data: raw.data, ch: raw.info.channels };
    for (const it of items) {
      const settled = it.op >= 0.9 && !it.blur;
      const bad = [];
      if (it.px < MIN_PX - 0.25) bad.push(`size ${it.px.toFixed(1)} px < ${MIN_PX}`);
      const [x0, y0, x1, y1] = it.rect;
      if (x0 < SAFE.x0 - 0.5 || x1 > SAFE.x1 + 0.5 || y0 < SAFE.y0 - 0.5 || y1 > SAFE.y1 + 0.5) bad.push(`outside title-safe [${it.rect.map((v) => Math.round(v)).join(",")}]`);
      if (img) {
        // background = pixels in the text box farthest from the text colour (top 40 % by distance), median
        const px = [];
        const X0 = Math.max(0, Math.floor(x0)), X1 = Math.min(1919, Math.ceil(x1)), Y0 = Math.max(0, Math.floor(y0)), Y1 = Math.min(1079, Math.ceil(y1));
        const stepS = Math.max(1, Math.floor(Math.sqrt(((X1 - X0) * (Y1 - Y0)) / 4000)));
        for (let y = Y0; y <= Y1; y += stepS) for (let x = X0; x <= X1; x += stepS) { const i = (y * img.width + x) * img.ch; px.push([img.data[i], img.data[i + 1], img.data[i + 2]]); }
        const d = (q) => Math.hypot(q[0] - it.color[0], q[1] - it.color[1], q[2] - it.color[2]);
        px.sort((a, b) => d(b) - d(a));
        const bgs = px.slice(0, Math.max(1, Math.floor(px.length * 0.4)));
        const bg = [0, 1, 2].map((k) => bgs.map((q) => q[k]).sort((a, b) => a - b)[bgs.length >> 1]);
        const c = cr(it.color, bg);
        it.contrast = c;
        if (c < MIN_CR) bad.push(`contrast ${c.toFixed(2)}:1 < ${MIN_CR} (text rgb(${it.color}) on ≈rgb(${bg}))`);
      }
      if (process.env.QC_DEBUG) console.log("  ", it.sel, it.px.toFixed(1) + "px", it.contrast && it.contrast.toFixed(2));
      if (bad.length) (settled ? fails : warns).push(`t=${T.toFixed(3)} f${Math.round(T * 30)} ${it.sel} "${it.text}": ${bad.join("; ")}`);
    }
  }
  await b.close();
  warns.forEach((w) => console.log("WARN (in transition)", w));
  fails.forEach((f) => console.log("FAIL", f));
  console.log(`check_text: ${fails.length} failure(s), ${warns.length} transitional warning(s) over ${FROM}–${TO} s step ${STEP}`);
  const j = arg("json");
  if (j) fs.writeFileSync(j, JSON.stringify({ fails, warns }, null, 1));
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
