#!/usr/bin/env node
// S02 / P0-E: loads sub/typevial/index.html headless, writes assets/typevial/density.json (glyphs landed per plate frame,
// mean landing x, key event times) for the SFX glyph grains (BRIEF §8 #4–5), and optional PNG probes:
//   node tools/typevial_density.mjs [--probe 105,140,262 --out dir]
import path from "path";
import fs from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const puppeteer = require(path.join(ROOT, "node_modules", "puppeteer-core"));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const b = await puppeteer.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage();
await p.setViewport({ width: 1920, height: 1080 });
p.on("console", (m) => { if (m.type() === "warning" || m.type() === "error") console.log("[page]", m.text()); });
await p.goto("file://" + path.join(ROOT, "sub/typevial/index.html"), { waitUntil: "load" });
await p.evaluate(() => window.__ready);
const d = await p.evaluate(() => Object.assign(TV.density(), { info: TV.info() }));
fs.writeFileSync(path.join(ROOT, "assets/typevial/density.json"), JSON.stringify(d));
console.log("density.json: glyphs", d.counts.reduce((a, b) => a + b, 0), "info", JSON.stringify(d.info));
const probe = arg("probe");
if (probe) {
  const out = arg("out", "/tmp/tv");
  fs.mkdirSync(out, { recursive: true });
  for (const f of probe.split(",")) {
    await p.evaluate((T) => TV.draw(T), +f / 30);
    await p.screenshot({ path: path.join(out, `f${f}.png`) });
  }
}
await b.close();
