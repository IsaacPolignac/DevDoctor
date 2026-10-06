// Captures the real purepeptide.care mobile site at iPhone 17 Pro viewport (402x874 CSS px @3x -> 1206 px wide).
//   node tools/capture_site.cjs   -> assets/site/raw/<name>.png (full page, sticky header unstuck), <name>_top.png
//   (viewport as the visitor sees it), nav.png (the sticky header, re-stuck by phone-screen.js), meta.json.
// Never adds Retatrutide (86) or MT-2 (95) to the cart: they are not part of the ad's catalog.
const puppeteer = require('/home/user/DevDoctor/ads/purepeptide-film-en/node_modules/puppeteer-core');
const fs = require('fs');
const OUT = __dirname + '/../assets/site/raw/';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const HIDE = '.cartdw,.cookiebar,.cart-fab,.pp-agegate{display:none!important} header.nav{position:relative!important}';
const meta = {};
const wait = ms => new Promise(r => setTimeout(r, ms));

async function session(fn) {
  const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--proxy-server=' + (process.env.HTTPS_PROXY || '')] });
  const p = await b.newPage();
  await p.setUserAgent(UA);
  await p.setViewport({ width: 402, height: 874, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await fn(p);
  await b.close();
}
async function go(p, url) { await p.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }); await wait(1500); }
async function enter(p) {   // researcher verification gate + cookie notice
  await p.evaluate(() => { document.querySelectorAll('[data-agegate-check]').forEach(c => { if (!c.checked) c.click() }); document.getElementById('pp-agegate-enter')?.click();
    const n = document.querySelector('.cookiebar'); if (n) for (const el of n.querySelectorAll('button,a')) if (/accept|ok|got it|agree/i.test(el.innerText)) { el.click(); break } });
  await wait(1200);
}
async function shot(p, name, { full = true, keep = false } = {}) {
  await wait(700);
  await p.screenshot({ path: OUT + name + '_top.png' });          // what the visitor sees (viewport)
  if (full) {
    const tag = keep ? null : await p.addStyleTag({ content: HIDE });
    await wait(300);
    const y = await p.evaluate(() => scrollY);
    await p.evaluate(() => scrollTo(0, 0));
    await p.screenshot({ path: OUT + name + '.png', fullPage: true });
    meta[name] = { url: p.url(), height_pt: await p.evaluate(() => document.documentElement.scrollHeight),
      boxes: await p.evaluate(() => [...document.querySelectorAll('h1,h2,h3,button,a,.price,.amount,input,img,span,p,li')].map(e => { const r = e.getBoundingClientRect(); const t = (e.innerText || e.alt || e.value || '').trim(); return { tag: e.tagName, cls: String(e.className || '').slice(0, 50), text: t.slice(0, 90), x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) } }).filter(o => o.w > 0 && o.h > 0 && o.text && o.text.length < 90)) };
    if (tag) await tag.evaluate(t => t.remove());
    await p.evaluate(y => scrollTo(0, y), y);
  }
  console.log(name, p.url());
}

(async () => {
  await session(async p => {
    await go(p, 'https://purepeptide.care/?lang=en');
    await shot(p, 'gate', { full: false });
    await p.evaluate(() => document.querySelectorAll('[data-agegate-check]').forEach(c => c.click()));
    await shot(p, 'gate_checked', { full: false });
    await enter(p);
    await shot(p, 'home');
    const nav = await p.$('header.nav'); await nav.screenshot({ path: OUT + 'nav.png' });
    meta.nav = { note: 'sticky header: page y 46..117 pt, sticks at viewport top once scrolled past 46 pt' };
    await go(p, 'https://purepeptide.care/shop/'); await shot(p, 'shop');
    await go(p, 'https://purepeptide.care/product/bpc-157-tb-500/'); await shot(p, 'product');
    const opts = await p.$$('button.bundle-opt');
    await opts[1].click(); await shot(p, 'product_2');
    await opts[2].click(); await shot(p, 'product_3');
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /^Add to cart/.test(b.innerText.trim())); b.scrollIntoView({ block: 'center' }); b.click(); });
    await wait(3500);
    await shot(p, 'drawer', { full: false });                       // the cart drawer that opens after Add to cart
    await go(p, 'https://purepeptide.care/cart/'); await shot(p, 'cart_from_product');
  });
  await session(async p => {                                       // fresh visitor: 1, 2, 3 vials of the same compound
    await go(p, 'https://purepeptide.care/?lang=en'); await enter(p);
    for (const n of [1, 2, 3]) { await go(p, 'https://purepeptide.care/cart/?add-to-cart=93&quantity=1'); await go(p, 'https://purepeptide.care/cart/'); await shot(p, 'cart' + n); }
  });
  fs.writeFileSync(OUT + 'meta.json', JSON.stringify(meta, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
