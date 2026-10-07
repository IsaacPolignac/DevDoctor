// "pure" in DM Sans 800 lowercase -> assets/type/pure_4k.png (RGBA, white ink, 4096 px wide, ink tight to the width)
// and pure_4k_mirror.png (horizontal flip: the S02 reflection texture). Sizes -> assets/type/pure_4k.json.
//   node tools/text_png.cjs
const puppeteer = require('puppeteer-core');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'type');
fs.mkdirSync(OUT, { recursive: true });
const FONT = 'file://' + path.join(ROOT, 'assets', 'fonts', 'dm-sans-latin-800-normal.woff2');
const W = 4096;
const TMP = path.join(OUT, '_text.html');

async function inkBox(buf) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
  let y0 = info.height, y1 = -1, x0 = info.width, x1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 8) {
    if (y < y0) y0 = y; if (y > y1) y1 = y; if (x < x0) x0 = x; if (x > x1) x1 = x;
  }
  return { x0, x1, y0, y1 };
}

(async () => {
  const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files', '--force-color-profile=srgb'] });
  const p = await b.newPage();
  const page = (px) => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:DMS;src:url(${FONT}) format('woff2');font-weight:800}
  html,body{margin:0;background:transparent}
  #w{position:absolute;left:200px;top:100px;font:800 ${px}px/1.3 DMS;color:#fff;white-space:nowrap;letter-spacing:-0.02em}
  </style></head><body><div id="w">pure</div></body></html>`;
  // pass 1: measure at 1000 px
  await p.setViewport({ width: 5000, height: 1800, deviceScaleFactor: 1 });
  fs.writeFileSync(TMP, page(1000)); await p.goto('file://' + TMP, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));
  const ok = await p.evaluate(() => document.fonts.check('800 1000px DMS'));
  if (!ok) throw new Error('DM Sans 800 did not load');
  let box = await inkBox(await p.screenshot({ omitBackground: true }));
  const s = W / (box.x1 - box.x0 + 1);
  const px = 1000 * s;
  // pass 2: at the final size, crop the ink box with a 2 % vertical pad
  const inkH = Math.round((box.y1 - box.y0 + 1) * s);
  await p.setViewport({ width: Math.ceil(W + 400 + 200 * s), height: Math.ceil(100 + px * 1.3 + 50), deviceScaleFactor: 1 });
  fs.writeFileSync(TMP, page(px)); await p.goto('file://' + TMP, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 300));
  const shot = await p.screenshot({ omitBackground: true });
  box = await inkBox(shot);
  const pad = Math.round(inkH * 0.02);
  const left = box.x0, width = Math.min(W, box.x1 - box.x0 + 1);
  const top = Math.max(0, box.y0 - pad), height = box.y1 - box.y0 + 1 + 2 * pad;
  const cut = await sharp(shot).extract({ left, top, width, height }).png().toBuffer();
  const final = width === W ? cut : await sharp(cut).resize({ width: W }).png().toBuffer();
  fs.writeFileSync(path.join(OUT, 'pure_4k.png'), final);
  await sharp(final).flop().png().toFile(path.join(OUT, 'pure_4k_mirror.png'));
  const m = await sharp(final).metadata();
  const meta = { width: m.width, height: m.height, ink_x: [0, m.width - 1], ink_y: [pad, m.height - 1 - pad], font_px: px, letter_spacing_em: -0.02,
    note: 'white DM Sans 800 "pure" on transparent, ink spans the full width; mirror = horizontal flip (S02 reflection texture)' };
  fs.writeFileSync(path.join(OUT, 'pure_4k.json'), JSON.stringify(meta, null, 1));
  console.log(JSON.stringify(meta));
  fs.unlinkSync(TMP);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
