// The screen bake (SHOTS §0.4): screenshots screen/bake.html (the PH rig in bake mode + js/screen_tl.js) at
// deviceScaleFactor 3 for every film frame f708..f1188 → assets/screen_seq/scr_%04d.png, numbered f − 707
// (scr_0001 = f708, scr_0481 = f1188; 1206x2622 each). Frames f708–f802 are pure black (screen off).
//   node tools/bake_screen.cjs [--from 708] [--to 1188] [--out assets/screen_seq] [--only 830,930,1107]
// Frame f is rendered at t = f/30 (+0.5 ms, as tools/snap.sh does, so a tl.set placed exactly on the frame applies).
// QC afterwards: python3 tools/bake_qc.py. Blender reads the folder as an image SEQUENCE (TECH §2: file n ↔ frame n + offset).
const path = require("path");
const fs = require("fs");
const ROOT = path.resolve(__dirname, "..");
const NM = path.join(ROOT, "node_modules");
const puppeteer = require(path.join(NM, "puppeteer-core"));

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = +arg("from", 708), TO = +arg("to", 1188), OUT = path.resolve(ROOT, arg("out", "assets/screen_seq"));
const ONLY = arg("only", "") ? arg("only", "").split(",").map(Number) : null;
const FIRST = 708; // scr_0001
const EXE = ["/opt/pw-browsers/chromium", path.join(process.env.HOME || "/root", ".cache/hyperframes/chrome/chrome-headless-shell")].find((p) => fs.existsSync(p));
if (!EXE) throw new Error("no Chromium found (/opt/pw-browsers/chromium or ~/.cache/hyperframes/chrome/chrome-headless-shell)");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const t0 = Date.now();
  const b = await puppeteer.launch({ executablePath: EXE, args: ["--no-sandbox", "--allow-file-access-from-files", "--force-color-profile=srgb"] });
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") console.log("[page]", m.text()); });
  await p.setViewport({ width: 402, height: 874, deviceScaleFactor: 3 });
  await p.goto("file://" + path.join(ROOT, "screen", "bake.html"), { waitUntil: "load" });
  const info = await p.evaluate(() => window.__bakeReady);
  await p.evaluate(() => document.fonts.ready.then(() => document.fonts.status));
  if (errs.length) { console.error("page errors:", errs); process.exit(1); }
  console.log("screen timeline:", JSON.stringify(info));
  const frames = ONLY || Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i);
  // prime: seek away from 0 once so zero-duration sets at later times behave as in a forward render
  await p.evaluate(() => { window.__timelines.screen.seek(1, false); });
  let n = 0;
  for (const f of frames) {
    const t = f / 30 + 0.0005;
    await p.evaluate((t) => { window.__timelines.screen.seek(t, false); }, t);
    const file = path.join(OUT, `scr_${String(f - FIRST + 1).padStart(4, "0")}.png`);
    await p.screenshot({ path: file, clip: { x: 0, y: 0, width: 402, height: 874 }, omitBackground: false });
    n++;
    if (n % 60 === 0 || f === frames[frames.length - 1]) console.log(`f${f} → ${path.basename(file)}  (${n}/${frames.length}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  await b.close();
  const meta = { first_frame: FIRST, count: frames.length, from: FROM, to: TO, size: [1206, 2622], events: info.events, baked: new Date().toISOString(), seconds: (Date.now() - t0) / 1000 };
  if (!ONLY) fs.writeFileSync(path.join(OUT, "seq.json"), JSON.stringify(meta, null, 1));
  console.log(`done: ${n} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
