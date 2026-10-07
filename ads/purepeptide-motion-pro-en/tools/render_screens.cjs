// Stills of the iPhone screen (1206x2622 = 402x874 pt @3x), drawn by assets/site/screen/phone-screen.{js,css}.
//   node tools/render_screens.cjs [--dir clean] [name:page:scrollPt ...]
//   default dir: clean (the page PNGs are read from assets/site/<dir>/ and the stills written to assets/site/<dir>/screen_<name>.png;
//   phone-screen.js's own "raw/" path is rewritten to <dir>/ — the ad never shows raw/ captures).
//   default jobs: blank home:home:0 product:product:1000 cart:cart3:150
//   --dsf N            deviceScaleFactor (default 3; the S10 slab fronts use 6 = TECH §3 "6x capture crop")
//   --out DIR          where crop jobs are written (default assets/type/); a crop job is
//   name:page:scrollPt:x,y,w,h   page-pt rect -> screen pt (x, 62 + y - scroll) -> <out>/slab_<name>.png at dsf x
//   e.g. the three SHOTS S10 slabs (cart3 @ 150):
//   node tools/render_screens.cjs --dsf 6 stepper:cart3:150:113,511,132,38 total:cart3:150:297,553,75,28 name:cart3:150:113,401,149,28
//   "blank" (SCENES P0-B(1)): status bar + Safari bar + home indicator exactly as phone-screen draws them, the page area
//   filled with the home hero background only — sampled row by row from <dir>/home.png at page x 6 pt; page y 0–117
//   (banner + nav) take the colour at y 130 and rows from the marquee (y ≥ 686) down take the colour at y 685.
const puppeteer = require('/home/user/DevDoctor/ads/purepeptide-film-en/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');
const SITE = path.resolve(__dirname, '../assets/site') + '/';
let args = process.argv.slice(2), DIR = 'clean', DSF = 3, OUT = path.resolve(__dirname, '../assets/type') + '/';
const di = args.indexOf('--dir'); if (di >= 0) { DIR = args[di + 1]; args.splice(di, 2); }
const ds = args.indexOf('--dsf'); if (ds >= 0) { DSF = +args[ds + 1]; args.splice(ds, 2); }
const oi = args.indexOf('--out'); if (oi >= 0) { OUT = path.resolve(args[oi + 1]) + '/'; args.splice(oi, 2); }
const jobs = (args.length ? args : ['blank', 'home:home:0', 'product:product:1000', 'cart:cart3:150']).map(s => s.split(':'));
const NAV_H = 62;   // screen pt: status bar + Safari bar above the page (page pt (px,py) at scroll s -> screen (px, 62 + py - s))
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files', '--force-color-profile=srgb'] });
  const p = await b.newPage();
  await p.setViewport({ width: 402, height: 874, deviceScaleFactor: DSF });
  for (const [name, page, scroll, rect] of jobs) {
    const body = name === 'blank'
      ? `<div class="ps" id="s"></div><script>
const s = document.getElementById('s');
s.innerHTML = '<div class="ps-layer" data-page="blank"><canvas id="bg" width="1206" height="2436" style="width:402px;height:812px;display:block"></canvas></div>' +
  PhoneScreen.markup([], ${JSON.stringify('file://' + SITE)});
window.ready = new Promise(res => { const im = new Image(); im.onload = () => {
  const src = document.createElement('canvas'); src.width = im.width; src.height = im.height;
  const g0 = src.getContext('2d'); g0.drawImage(im, 0, 0);
  const col = g0.getImageData(18, 0, 1, im.height).data;          // page x 6 pt @3x
  const c = document.getElementById('bg'), g = c.getContext('2d'), out = g.createImageData(1206, 2436);
  for (let r = 0; r < 2436; r++) {
    const sr = r < 351 ? 390 : r >= 2058 ? 2057 : r;              // y<117 -> y130; y>=686 (marquee) -> y685
    for (let x = 0; x < 1206; x++) { const o = (r * 1206 + x) * 4; out.data[o] = col[sr * 4]; out.data[o + 1] = col[sr * 4 + 1]; out.data[o + 2] = col[sr * 4 + 2]; out.data[o + 3] = 255; }
  }
  g.putImageData(out, 0, 0); res();
}; im.src = ${JSON.stringify('file://' + SITE + DIR + '/home.png')}; });
</script>`
      : `<div class="ps" id="s"></div><script>const s=document.getElementById('s');
s.innerHTML=PhoneScreen.markup([${JSON.stringify(page)}], ${JSON.stringify('file://' + SITE)}).replace(/\\/raw\\//g, ${JSON.stringify('/' + DIR + '/')});
PhoneScreen.scroll(s, ${JSON.stringify(page)}, ${+scroll});
window.ready = Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));</script>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${SITE}screen/phone-screen.css">
<script src="file://${SITE}screen/phone-screen.js"></script><style>html,body{margin:0;background:#000}</style></head><body>${body}</body></html>`;
    const tmp = SITE + 'screen/_render.html';
    fs.writeFileSync(tmp, html);
    await p.goto('file://' + tmp, { waitUntil: 'load' });
    await p.evaluate(() => Promise.all([document.fonts.ready, window.ready]));
    const srcs = await p.evaluate(() => [...document.images].map(i => i.src));
    if (srcs.some(u => u.includes('/raw/'))) throw new Error('raw/ capture referenced: ' + srcs.join(' '));
    await new Promise(r => setTimeout(r, 300));
    if (rect) {
      const [x, y, w, h] = rect.split(',').map(Number);
      const sy = NAV_H + y - (+scroll);
      if (sy < NAV_H || sy + h > 874) throw new Error(`crop ${name} leaves the page area: screen y ${sy}..${sy + h}`);
      const out = OUT + `slab_${name}.png`;
      await p.screenshot({ path: out, clip: { x, y: sy, width: w, height: h } });
      console.log(path.relative(process.cwd(), out), page, '@' + scroll, `page rect ${rect} -> screen (${x}, ${sy}) ${w}x${h} pt @${DSF}x = ${w * DSF}x${h * DSF} px`);
      continue;
    }
    await p.screenshot({ path: SITE + DIR + `/screen_${name}.png` });
    console.log(DIR + '/screen_' + name + '.png', page || '', scroll || '', srcs.map(u => path.basename(path.dirname(u)) + '/' + path.basename(u)).join(' '));
  }
  fs.unlinkSync(SITE + 'screen/_render.html');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
