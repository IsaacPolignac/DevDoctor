// Stills of the iPhone screen (1206x2622) for the Blender phone textures: assets/site/screen_<name>.png
// node tools/render_screens.cjs [name:page:scrollPt ...]   default: home:home:0 cart:cart3:420
const puppeteer = require('/home/user/DevDoctor/ads/purepeptide-film-en/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');
const SITE = path.resolve(__dirname, '../assets/site') + '/';
const jobs = (process.argv.slice(2).length ? process.argv.slice(2) : ['home:home:0', 'cart:cart3:150', 'product:product_3:1000']).map(s => s.split(':'));
(async () => {
  const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 402, height: 874, deviceScaleFactor: 3 });
  for (const [name, page, scroll] of jobs) {
    const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="file://${SITE}screen/phone-screen.css">
<script src="file://${SITE}screen/phone-screen.js"></script><style>html,body{margin:0;background:#000}</style></head>
<body><div class="ps" id="s"></div><script>const s=document.getElementById('s');s.innerHTML=PhoneScreen.markup([${JSON.stringify(page)}], ${JSON.stringify('file://' + SITE)});
PhoneScreen.scroll(s, ${JSON.stringify(page)}, ${+scroll});</script></body></html>`;
    const tmp = SITE + 'screen/_render.html';
    fs.writeFileSync(tmp, html);
    await p.goto('file://' + tmp, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 300));
    await p.screenshot({ path: SITE + `screen_${name}.png` });
    console.log('screen_' + name + '.png', page, scroll);
  }
  fs.unlinkSync(SITE + 'screen/_render.html');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
