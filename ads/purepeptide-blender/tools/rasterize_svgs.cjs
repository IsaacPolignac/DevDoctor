// Rasterize brand SVGs to high-res transparent PNGs with headless Chrome (puppeteer-core).
// usage: node tools/rasterize_svgs.cjs
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const puppeteer = require(path.resolve(__dirname, '../../purepeptide-30s-saas/node_modules/puppeteer-core'));
const exe = execSync('find /root/.cache/hyperframes/chrome -name chrome-headless-shell -type f').toString().trim().split('\n')[0];
const jobs = [
  ['assets/brand-symbol.svg', 'assets/brand-symbol.png', 2000],
  ['assets/brand-wordmark.svg', 'assets/brand-wordmark.png', 3600],
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: exe, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  for (const [src, dst, width] of jobs) {
    const svg = fs.readFileSync(path.resolve(__dirname, '..', src), 'utf8');
    const vb = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    const height = Math.round(width * vb[3] / vb[2]);
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    const b64 = Buffer.from(svg).toString('base64');
    await page.setContent(`<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${b64}" style="width:${width}px;height:${height}px;display:block"></body></html>`);
    await page.evaluate(() => document.querySelector('img').decode());
    await page.screenshot({ path: path.resolve(__dirname, '..', dst), omitBackground: true, clip: { x: 0, y: 0, width, height } });
    console.log(dst, width, height);
  }
  await browser.close();
})();
